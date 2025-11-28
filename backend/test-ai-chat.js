const fetch = require("node-fetch");
require('dotenv').config();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL_NAME = 'openai/gpt-oss-20b:free';

async function testAIChat() {
    console.log('Testing AI Chat Response...');
    console.log('API Key:', OPENROUTER_API_KEY ? 'Found' : 'Missing');
    console.log('Model:', MODEL_NAME);
    
    try {
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
                messages: [
                    {
                        role: 'system',
                        content: 'You are a helpful, friendly AI assistant. Respond naturally without using asterisks, markdown formatting, or parentheses. Give clear, informative answers.'
                    },
                    {
                        role: 'user',
                        content: 'Tell me about RRR movie'
                    }
                ],
                temperature: 0.7,
                max_tokens: 500
            })
        });

        const data = await response.json();
        console.log('\nAPI Response:');
        console.log(JSON.stringify(data, null, 2));
        
        if (data.choices && data.choices.length > 0) {
            const message = data.choices[0].message;
            const aiResponse = message.content || message.reasoning || '';
            console.log('\n=== AI Response ===');
            console.log(aiResponse);
        } else if (data.error) {
            console.log('\nAPI Error:', data.error);
        }
    } catch (err) {
        console.error('Error:', err.message);
    }
}

testAIChat();
