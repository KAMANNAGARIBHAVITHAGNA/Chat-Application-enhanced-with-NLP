# AI-Enhanced NLP Chat Application

## Features

### 1. AI Chatbot Assistant
- **Intelligent Responses**: AI Assistant responds to all user messages
- **Context-Aware**: Remembers last 6 messages for coherent conversations
- **Natural Language**: Uses OpenRouter's GPT-OSS-20B model for human-like responses
- **Real-time**: Responses appear instantly in the chat

### 2. Session Management
- Each user gets a unique session when they join
- Sessions store user information and chat history
- Sessions persist for 1 hour after last activity
- Automatic cleanup of old sessions every 5 minutes

### 3. Memory Bank
- Stores last 10 messages per user session
- Provides context to AI for better responses
- Helps maintain conversation continuity
- Enables context-aware tone analysis

### 4. Tone Analysis with NLP
- **Real-time Tone Detection**: Analyzes emotional tone of messages
- **Tone Caching**: Identical messages return cached results instantly
- **Context-Aware**: Uses conversation history for accurate detection
- **Supported Tones**: Joy, Sadness, Anger, Fear, Confident, Tentative, Analytical, Neutral

### 5. Sentiment Tracking
- Real-time sentiment score using TensorFlow.js
- Tracks overall conversation mood
- Updates with each message

### 6. API Endpoints

#### Get Session History
```
GET /api/session/:sessionId
```
Returns session data including message history

#### Get All Active Sessions
```
GET /api/sessions
```
Returns list of all active sessions

## How It Works

1. **User joins** → Session created with unique ID
2. **User sends message** → Stored in session memory
3. **AI responds** → Generates contextual response using conversation history
4. **Tone analysis** → Detects emotional tone and displays it
5. **Sentiment update** → Updates overall conversation sentiment
6. **Session cleanup** → Inactive sessions removed after 1 hour

## Example Conversation

```
User: hello
AI Assistant: Hello! How can I help you today?

User: I'm feeling great today!
AI Assistant: That's wonderful to hear! What's making your day so great?

User: Just finished a big project
AI Assistant: Congratulations! Completing a big project is always a great feeling. What was the project about?
```

## Technology Stack

- **Backend**: Node.js, Express, Socket.IO
- **Database**: SQLite (better-sqlite3) for persistent storage
- **AI Model**: OpenRouter API with GPT-OSS-20B (free tier)
- **NLP**: TensorFlow.js for sentiment analysis
- **Frontend**: React, TypeScript, Bootstrap
- **Real-time**: WebSocket communication

## Database Schema

### Users Table
- Stores user information and socket connections
- Tracks last activity time

### Sessions Table
- Tracks chat sessions with timestamps
- Links to users table

### Messages Table
- Stores all chat messages (user and AI)
- Includes tone analysis and sentiment scores
- Preserves conversation history

### Sentiment History Table
- Tracks sentiment changes over time
- Records average sentiment per session

## Database Features

✅ **Persistent Storage** - All data saved to disk
✅ **Chat History** - Complete conversation logs
✅ **User Tracking** - User accounts and activity
✅ **Sentiment Analytics** - Historical sentiment data
✅ **Session Management** - Automatic cleanup of old sessions
✅ **Fast Queries** - Optimized with SQLite indexes

## View Database

Run this command to see database contents:
```bash
cd backend
node view-db.js
```
