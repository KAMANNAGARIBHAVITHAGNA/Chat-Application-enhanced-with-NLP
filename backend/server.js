const http = require("http");
const express = require("express");
const socket = require("socket.io");
var cors = require('cors')
const path = require('path');
const fetch = require("node-fetch");

// Configure env vars in env file
require('dotenv').config();

// Import database module
const {
    createUser,
    createSession,
    saveMessage,
    getSessionMessages,
    saveSentiment,
    cleanupOldSessions,
    getAllSessions
} = require('./database');


/////////////////////
//    OpenRouter API    //
/////////////////////

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL_NAME = 'openai/gpt-oss-20b:free';

//////////////////////////////
//    Memory & Session Management    //
//////////////////////////////

// Store chat history per session
const sessionMemory = new Map();
const MAX_MEMORY_MESSAGES = 10; // Keep last 10 messages per session

// Cache for tone analysis to speed up responses
const toneCache = new Map();
const MAX_CACHE_SIZE = 100;

// Session data structure with enhanced memory
class ChatSession {
    constructor(sessionId, username) {
        this.sessionId = sessionId;
        this.username = username;
        this.messages = [];
        this.conversationHistory = []; // Structured history for AI
        this.createdAt = new Date();
        this.lastActivity = new Date();
        this.topics = new Set(); // Track conversation topics
    }

    addMessage(message, isUser = true) {
        this.messages.push({
            text: message,
            timestamp: new Date(),
            isUser: isUser
        });
        
        // Add to conversation history with role
        this.conversationHistory.push({
            role: isUser ? 'user' : 'assistant',
            content: message
        });
        
        // Keep only last MAX_MEMORY_MESSAGES
        if (this.messages.length > MAX_MEMORY_MESSAGES) {
            this.messages.shift();
        }
        if (this.conversationHistory.length > MAX_MEMORY_MESSAGES) {
            this.conversationHistory.shift();
        }
        
        this.lastActivity = new Date();
    }

    getContext() {
        return this.messages.map(m => m.text).join('\n');
    }
    
    getConversationHistory() {
        return this.conversationHistory;
    }
    
    addTopic(topic) {
        this.topics.add(topic.toLowerCase());
    }
    
    getTopics() {
        return Array.from(this.topics).join(', ');
    }
}

// Clean up old sessions (older than 1 hour) - both memory and database
setInterval(() => {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    
    // Clean memory
    for (const [sessionId, session] of sessionMemory.entries()) {
        if (session.lastActivity.getTime() < oneHourAgo) {
            sessionMemory.delete(sessionId);
            console.log(`Cleaned up memory session: ${sessionId}`);
        }
    }
    
    // Clean database
    cleanupOldSessions();
}, 5 * 60 * 1000); // Run every 5 minutes


//////////////////////////////
//    Tensorflow-js Node    //
//////////////////////////////

const tf = require("@tensorflow/tfjs");

const getMetaData = async () => {
    const metadata = await fetch('https://storage.googleapis.com/tfjs-models/tfjs/sentiment_cnn_v1/metadata.json');
    return metadata.json();
};

const padSequences = (sequences, metadata) => {
    return sequences.map(seq => {
        if (seq.length > metadata.max_len) {
            seq.splice(0, seq.length - metadata.max_len);
        }
        if (seq.length < metadata.max_len) {
            const pad = [];
            for (let i = 0; i < metadata.max_len - seq.length; ++i) {
                pad.push(0);
            }
            seq = pad.concat(seq);
        }
        return seq;
    });
};

const loadModel = async () => {
    const url = `https://storage.googleapis.com/tfjs-models/tfjs/sentiment_cnn_v1/model.json`;
    const model = await tf.loadLayersModel(url);
    return model;
};

const predict = async (text) => {
    const model = await loadModel();
    const metadata = await getMetaData();

    const trimmed = text.trim().toLowerCase().replace(/(\.|\,|\!)/g, '').split(' ');
    const sequence = trimmed.map(word => {

        const wordIndex = metadata.word_index[word];
        if (typeof wordIndex === 'undefined') {
            return 2; //oov_index
        }

        return wordIndex + metadata.index_from;
    });
    const paddedSequence = padSequences([sequence], metadata);
    const input = tf.tensor2d(paddedSequence, [1, metadata.max_len]);

    const predictOut = model.predict(input);
    const score = predictOut.dataSync()[0];
    predictOut.dispose();
    return score;
};

//////////////////
//    Socket    //
//////////////////

const app = express();

app.use(cors());
app.use(express.json({ limit: '10kb' })); // Parse JSON

// Add a simple health check route
app.get('/', (req, res) => {
    res.json({ status: 'NLP Chat Server is running', port: process.env.PORT || 8000 });
});

// API endpoint to get session history from database
app.get('/api/session/:sessionId', (req, res) => {
    try {
        const messages = getSessionMessages(req.params.sessionId, 100);
        res.json({
            sessionId: req.params.sessionId,
            messages: messages,
            count: messages.length
        });
    } catch (err) {
        res.status(500).json({ error: 'Error fetching session data' });
    }
});

// API endpoint to get all active sessions from database
app.get('/api/sessions', (req, res) => {
    try {
        const sessions = getAllSessions();
        res.json({ sessions, count: sessions.length });
    } catch (err) {
        res.status(500).json({ error: 'Error fetching sessions' });
    }
});

const port = process.env.PORT || 8000;
const server = http.createServer(app);
const io = socket(server);

users = [];
ids = [];
connections = [];
total_sentiment_score = 0;
message_count = 0;

io.on("connection", socket => {

    connections.push(socket);
    console.log('Connected: %s sockets connected', connections.length)

    // Send client their id
    socket.emit("your id", socket.id);
    ids.push(socket.id);

    // New user - create session in memory and database
    socket.on('new user', body => {
        socket.username = body.Username;
        users.push(socket.username);
        
        // Create user in database
        const user = createUser(socket.username, socket.id);
        
        // Create session in memory
        const session = new ChatSession(socket.id, socket.username);
        sessionMemory.set(socket.id, session);
        
        // Create session in database
        if (user) {
            createSession(socket.id, user.id);
        }
        
        console.log(`Session created for ${socket.username}`);
        
        updateUsernames();
    });

    // Client send message, emit server
    socket.on("send message", message => {
        // Add user message to session memory
        const session = sessionMemory.get(socket.id);
        if (session) {
            session.addMessage(message.body, true); // true = user message
        }

        // Send user message immediately to all clients
        message.tone = 'Analyzing...';
        io.emit("message", message);

        // Get tone analysis asynchronously with context
        getToneWithContext(message.body, socket.id)
            .then(tone => {
                // Update message with actual tone
                message.tone = tone;
                io.emit("message update", { id: message.id, tone: tone });
                
                // Save user message to database with tone
                saveMessage(socket.id, socket.username, message.body, true, tone, null);
            });

        // Update sentiment asynchronously
        updateSentiment(message.body);

        // Generate AI bot response
        getAIResponse(message.body, socket.id)
            .then(aiResponse => {
                if (aiResponse) {
                    // Create bot message
                    const botMessage = {
                        body: aiResponse,
                        id: 'ai-bot',
                        username: 'AI Assistant',
                        tone: 'Analytical'
                    };
                    
                    // Add bot response to session memory
                    if (session) {
                        session.addMessage(aiResponse, false); // false = AI message
                    }
                    
                    // Save AI response to database
                    saveMessage(socket.id, 'AI Assistant', aiResponse, false, 'Analytical', null);
                    
                    // Send bot response to all clients
                    io.emit("message", botMessage);
                }
            })
            .catch(err => {
                console.log('Error generating AI response:', err);
            });
    });

    // Client disconnect
    socket.on('disconnect', () => {
        users.splice(users.indexOf(socket.username), 1);
        updateUsernames();
        connections.splice(connections.indexOf(socket), 1);
        
        // Keep session in memory for potential reconnection
        // It will be cleaned up by the interval if not used
        console.log('Disconnected: %s sockets connected', connections.length);
    });

    // Update list of users
    let updateUsernames = async () => {
        io.sockets.emit('get users', users);
    }

    // Get AI response using OpenRouter with conversation context
    let getAIResponse = async (input_text, sessionId) => {
        const session = sessionMemory.get(sessionId);

        try {
            // Build conversation messages with proper structure
            const messages = [];
            
            // Enhanced system prompt to reduce hallucinations
            messages.push({
                role: 'system',
                content: `You are a helpful, friendly AI assistant. Follow these rules strictly:
1. Only provide information you are confident about
2. If you don't know something, say "I don't have enough information about that"
3. Do not make up facts, dates, or details
4. Keep responses concise and natural
5. Do not use asterisks, markdown formatting, or parentheses
6. Be conversational and helpful
7. Stay on topic with the conversation`
            });

            // Add structured conversation history if available
            if (session && session.conversationHistory.length > 0) {
                // Get last 8 messages (4 exchanges) for context
                const recentHistory = session.conversationHistory.slice(-8);
                messages.push(...recentHistory);
            }

            // Add current message
            messages.push({
                role: 'user',
                content: input_text
            });

            const response = await fetch(OPENROUTER_API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'http://localhost:8000',
                    'X-Title': 'NLP Chat App'
                },
                body: JSON.stringify({
                    model: MODEL_NAME,
                    messages: messages,
                    temperature: 0.5,  // Lower temperature = more focused, less creative/hallucinatory
                    max_tokens: 400,   // Reasonable length for chat responses
                    top_p: 0.9         // Nucleus sampling for better quality
                })
            });

            const data = await response.json();
            
            if (data.choices && data.choices.length > 0 && data.choices[0].message) {
                let aiMessage = data.choices[0].message.content || '';
                
                // Clean up the response - remove unwanted formatting
                aiMessage = aiMessage
                    .replace(/\*\*([^*]+)\*\*/g, '$1')  // Remove **text** but keep text
                    .replace(/\*([^*]+)\*/g, '$1')      // Remove *text* but keep text
                    .replace(/^[-•]\s+/gm, '')          // Remove bullet points
                    .replace(/^#+\s+/gm, '')            // Remove markdown headers
                    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove markdown links
                    .replace(/\n{3,}/g, '\n\n')         // Max 2 newlines
                    .replace(/\s+/g, ' ')               // Normalize whitespace
                    .trim();
                
                // If content is empty or too short, don't return anything
                if (!aiMessage || aiMessage.length < 3) {
                    console.log('AI Response too short or empty, skipping');
                    return null;
                }
                
                // Limit response length to avoid overwhelming users
                if (aiMessage.length > 1000) {
                    aiMessage = aiMessage.substring(0, 1000) + '...';
                }
                
                console.log('AI Response (cleaned):', aiMessage.substring(0, 100) + '...');
                return aiMessage;
            } else if (data.error) {
                console.log('AI API Error:', data.error);
                return 'Sorry, I encountered an error. Please try again.';
            }
        } catch (err) {
            console.log('Error getting AI response:', err.message);
            return null;
        }
        
        return null;
    }

    // Get tone with context and caching for faster responses using OpenRouter
    let getToneWithContext = async (input_text, sessionId) => {
        // Check cache first for exact match
        const cacheKey = input_text.toLowerCase().trim();
        if (toneCache.has(cacheKey)) {
            console.log('Tone from cache:', toneCache.get(cacheKey));
            return toneCache.get(cacheKey);
        }

        let tone = 'Neutral';
        const session = sessionMemory.get(sessionId);
        const context = session ? session.getContext() : '';

        try {
            // Build simple prompt for tone classification
            let prompt = `Classify the tone of "${input_text}" as one word: Joy, Sadness, Anger, Fear, Confident, Tentative, Analytical, or Neutral.`;
            
            if (context) {
                prompt = `Context: ${context}\n\n` + prompt;
            }
            
            prompt += ' Answer:';

            const messages = [
                {
                    role: 'user',
                    content: prompt
                }
            ];

            const response = await fetch(OPENROUTER_API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'http://localhost:8000',
                    'X-Title': 'NLP Chat App'
                },
                body: JSON.stringify({
                    model: MODEL_NAME,
                    messages: messages,
                    temperature: 0.1,
                    max_tokens: 50
                })
            });

            const data = await response.json();
            console.log('OpenRouter Response:', JSON.stringify(data, null, 2));
            
            if (data.choices && data.choices.length > 0 && data.choices[0].message) {
                const message = data.choices[0].message;
                
                // Try to get content from message.content or message.reasoning
                let rawTone = message.content || message.reasoning || '';
                
                // Extract tone word from response
                const toneWords = ['Joy', 'Sadness', 'Anger', 'Fear', 'Confident', 'Tentative', 'Analytical', 'Neutral'];
                for (const word of toneWords) {
                    if (rawTone.includes(word)) {
                        tone = word;
                        break;
                    }
                }
                
                console.log('Detected tone:', tone);
                
                // Cache the result
                toneCache.set(cacheKey, tone);
                
                // Limit cache size
                if (toneCache.size > MAX_CACHE_SIZE) {
                    const firstKey = toneCache.keys().next().value;
                    toneCache.delete(firstKey);
                }
            } else if (data.error) {
                console.log('API Error:', data.error);
                tone = 'Neutral';
            } else {
                console.log('Unexpected API response structure');
                tone = 'Neutral';
            }
        } catch (err) {
            console.log('Error calling OpenRouter API:', err.message);
            tone = 'Neutral';
        }
        
        return tone;
    }

    // Get sentiment of message
    let updateSentiment = async (input_text) => {
        message_count++;
        predict(input_text)
            .then(sentiment => {
                total_sentiment_score += sentiment;
                const avgSentiment = total_sentiment_score / message_count;
                console.log('total sentiment:', avgSentiment);
                
                // Save sentiment to database
                saveSentiment(socket.id, avgSentiment, message_count);
                
                // Broadcast to all clients
                io.sockets.emit('get sentiment', avgSentiment);
            })
            .catch(err => {
                console.log('error:', err);
            });
    }

});

app.use(express.static('../nlp-chat-client/build'));
app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../nlp-chat-client/build', 'index.html'));
})

// Serve static assets in production (client)
if (process.env.NODE_ENV === 'production') {
    // Set static folder
    app.use(express.static('../nlp-chat-client/build'));
    app.get('*', (req, res) => {
        res.sendFile(path.resolve(__dirname, '../nlp-chat-client/build', 'index.html'));
    })
}

server.listen(port, () => console.log(`server is running on port ${port}`));

