const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'chat.db'));

console.log('\n=== USERS ===');
const users = db.prepare('SELECT * FROM users ORDER BY created_at DESC LIMIT 10').all();
console.table(users);

console.log('\n=== SESSIONS ===');
const sessions = db.prepare('SELECT * FROM sessions ORDER BY last_activity DESC LIMIT 10').all();
console.table(sessions);

console.log('\n=== RECENT MESSAGES ===');
const messages = db.prepare(`
    SELECT id, username, substr(message, 1, 50) as message, is_user, tone, 
           datetime(timestamp, 'localtime') as time
    FROM messages 
    ORDER BY timestamp DESC 
    LIMIT 20
`).all();
console.table(messages);

console.log('\n=== SENTIMENT HISTORY ===');
const sentiment = db.prepare(`
    SELECT session_id, average_sentiment, message_count, 
           datetime(timestamp, 'localtime') as time
    FROM sentiment_history 
    ORDER BY timestamp DESC 
    LIMIT 10
`).all();
console.table(sentiment);

console.log('\n=== STATISTICS ===');
const stats = db.prepare(`
    SELECT 
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM sessions) as total_sessions,
        (SELECT COUNT(*) FROM messages) as total_messages,
        (SELECT COUNT(*) FROM messages WHERE is_user = 1) as user_messages,
        (SELECT COUNT(*) FROM messages WHERE is_user = 0) as ai_messages
`).get();
console.table(stats);

db.close();
