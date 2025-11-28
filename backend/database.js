const Database = require('better-sqlite3');
const path = require('path');

// Initialize SQLite database
const db = new Database(path.join(__dirname, 'chat.db'));

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables FIRST
function initializeDatabase() {
    // Users table
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            socket_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_active DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Sessions table
    db.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT UNIQUE NOT NULL,
            user_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);

    // Messages table
    db.exec(`
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            username TEXT NOT NULL,
            message TEXT NOT NULL,
            is_user BOOLEAN DEFAULT 1,
            tone TEXT,
            sentiment_score REAL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (session_id) REFERENCES sessions(session_id)
        )
    `);

    // Sentiment history table
    db.exec(`
        CREATE TABLE IF NOT EXISTS sentiment_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            average_sentiment REAL NOT NULL,
            message_count INTEGER NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (session_id) REFERENCES sessions(session_id)
        )
    `);

    console.log('Database initialized successfully');
}

// Initialize database BEFORE creating prepared statements
initializeDatabase();

// User operations - NOW create prepared statements after tables exist
const userOps = {
    create: db.prepare(`
        INSERT INTO users (username, socket_id) 
        VALUES (?, ?)
        ON CONFLICT(username) DO UPDATE SET socket_id = ?, last_active = CURRENT_TIMESTAMP
    `),
    
    findByUsername: db.prepare('SELECT * FROM users WHERE username = ?'),
    
    updateLastActive: db.prepare('UPDATE users SET last_active = CURRENT_TIMESTAMP WHERE username = ?')
};

// Session operations
const sessionOps = {
    create: db.prepare(`
        INSERT INTO sessions (session_id, user_id) 
        VALUES (?, ?)
        ON CONFLICT(session_id) DO UPDATE SET last_activity = CURRENT_TIMESTAMP
    `),
    
    findById: db.prepare('SELECT * FROM sessions WHERE session_id = ?'),
    
    updateActivity: db.prepare('UPDATE sessions SET last_activity = CURRENT_TIMESTAMP WHERE session_id = ?'),
    
    getAll: db.prepare('SELECT * FROM sessions ORDER BY last_activity DESC'),
    
    deleteOld: db.prepare("DELETE FROM sessions WHERE last_activity < datetime('now', '-1 hour')")
};

// Message operations
const messageOps = {
    create: db.prepare(`
        INSERT INTO messages (session_id, username, message, is_user, tone, sentiment_score) 
        VALUES (?, ?, ?, ?, ?, ?)
    `),
    
    getBySession: db.prepare(`
        SELECT * FROM messages 
        WHERE session_id = ? 
        ORDER BY timestamp DESC 
        LIMIT ?
    `),
    
    getRecent: db.prepare(`
        SELECT * FROM messages 
        ORDER BY timestamp DESC 
        LIMIT ?
    `),
    
    count: db.prepare('SELECT COUNT(*) as count FROM messages WHERE session_id = ?')
};

// Sentiment operations
const sentimentOps = {
    create: db.prepare(`
        INSERT INTO sentiment_history (session_id, average_sentiment, message_count) 
        VALUES (?, ?, ?)
    `),
    
    getBySession: db.prepare(`
        SELECT * FROM sentiment_history 
        WHERE session_id = ? 
        ORDER BY timestamp DESC 
        LIMIT ?
    `)
};

// Helper functions
function createUser(username, socketId) {
    try {
        userOps.create.run(username, socketId, socketId);
        return userOps.findByUsername.get(username);
    } catch (err) {
        console.error('Error creating user:', err);
        return null;
    }
}

function createSession(sessionId, userId) {
    try {
        sessionOps.create.run(sessionId, userId);
        return sessionOps.findById.get(sessionId);
    } catch (err) {
        console.error('Error creating session:', err);
        return null;
    }
}

function saveMessage(sessionId, username, message, isUser, tone = null, sentimentScore = null) {
    try {
        messageOps.create.run(sessionId, username, message, isUser ? 1 : 0, tone, sentimentScore);
        sessionOps.updateActivity.run(sessionId);
        return true;
    } catch (err) {
        console.error('Error saving message:', err);
        return false;
    }
}

function getSessionMessages(sessionId, limit = 50) {
    try {
        return messageOps.getBySession.all(sessionId, limit);
    } catch (err) {
        console.error('Error getting messages:', err);
        return [];
    }
}

function saveSentiment(sessionId, averageSentiment, messageCount) {
    try {
        sentimentOps.create.run(sessionId, averageSentiment, messageCount);
        return true;
    } catch (err) {
        console.error('Error saving sentiment:', err);
        return false;
    }
}

function cleanupOldSessions() {
    try {
        const result = sessionOps.deleteOld.run();
        console.log(`Cleaned up ${result.changes} old sessions`);
        return result.changes;
    } catch (err) {
        console.error('Error cleaning up sessions:', err);
        return 0;
    }
}

function getAllSessions() {
    try {
        return sessionOps.getAll.all();
    } catch (err) {
        console.error('Error getting sessions:', err);
        return [];
    }
}

// Export functions (database already initialized above)
module.exports = {
    db,
    createUser,
    createSession,
    saveMessage,
    getSessionMessages,
    saveSentiment,
    cleanupOldSessions,
    getAllSessions
};
