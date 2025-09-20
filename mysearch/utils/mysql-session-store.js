const mysql = require('../mysql');
const EventEmitter = require('events');

class MySQLSessionStore extends EventEmitter {
    constructor(options = {}) {
        super();
        this.options = {
            table: options.table || 'sessions',
            ttl: options.ttl || 86400, // 24 hours in seconds
            ...options
        };
        
        // Create sessions table if it doesn't exist (async, non-blocking)
        this.createTable().catch(error => {
            console.error('Failed to create sessions table on startup:', error.message);
            // Don't throw error, let the app continue with memory store fallback
        });
    }

    async createTable() {
        const maxRetries = 3;
        let retryCount = 0;
        
        while (retryCount < maxRetries) {
            try {
                const createTableSQL = `
                    CREATE TABLE IF NOT EXISTS ${this.options.table} (
                        session_id VARCHAR(128) NOT NULL PRIMARY KEY,
                        data TEXT,
                        expires BIGINT NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        INDEX idx_expires (expires)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                `;
                
                await mysql.query(createTableSQL);
                console.log(`Sessions table '${this.options.table}' is ready`);
                return; // Success, exit the retry loop
            } catch (error) {
                retryCount++;
                console.error(`Error creating sessions table (attempt ${retryCount}/${maxRetries}):`, error.message);
                
                if (retryCount >= maxRetries) {
                    console.error('Failed to create sessions table after all retries. Sessions will use memory store.');
                    // Don't throw error, let the app continue
                    return;
                }
                
                // Wait before retrying (exponential backoff)
                const waitTime = Math.pow(2, retryCount) * 1000; // 2s, 4s, 8s
                console.log(`Retrying in ${waitTime}ms...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
    }

    async get(sessionId, callback) {
        try {
            const now = Date.now();
            const sql = `SELECT data FROM ${this.options.table} WHERE session_id = ? AND expires > ?`;
            const rows = await mysql.query(sql, [sessionId, now]);
            
            if (rows.length === 0) {
                return callback(null, null);
            }
            
            const sessionData = rows[0].data;
            const parsedData = sessionData ? JSON.parse(sessionData) : {};
            callback(null, parsedData);
        } catch (error) {
            console.error('Error getting session:', error.message);
            callback(error, null);
        }
    }

    async set(sessionId, session, callback) {
        try {
            const now = Date.now();
            const expires = now + (this.options.ttl * 1000);
            const data = JSON.stringify(session);
            
            const sql = `
                INSERT INTO ${this.options.table} (session_id, data, expires) 
                VALUES (?, ?, ?) 
                ON DUPLICATE KEY UPDATE 
                data = VALUES(data), 
                expires = VALUES(expires),
                updated_at = CURRENT_TIMESTAMP
            `;
            
            await mysql.query(sql, [sessionId, data, expires]);
            callback(null);
        } catch (error) {
            console.error('Error setting session:', error.message);
            callback(error);
        }
    }

    async destroy(sessionId, callback) {
        try {
            const sql = `DELETE FROM ${this.options.table} WHERE session_id = ?`;
            await mysql.query(sql, [sessionId]);
            callback(null);
        } catch (error) {
            console.error('Error destroying session:', error.message);
            callback(error);
        }
    }

    async touch(sessionId, session, callback) {
        try {
            const now = Date.now();
            const expires = now + (this.options.ttl * 1000);
            
            const sql = `UPDATE ${this.options.table} SET expires = ? WHERE session_id = ?`;
            await mysql.query(sql, [expires, sessionId]);
            callback(null);
        } catch (error) {
            console.error('Error touching session:', error.message);
            callback(error);
        }
    }

    async length(callback) {
        try {
            const sql = `SELECT COUNT(*) as count FROM ${this.options.table} WHERE expires > ?`;
            const now = Date.now();
            const rows = await mysql.query(sql, [now]);
            callback(null, rows[0].count);
        } catch (error) {
            console.error('Error getting session count:', error.message);
            callback(error, 0);
        }
    }

    async clear(callback) {
        try {
            const sql = `DELETE FROM ${this.options.table}`;
            await mysql.query(sql);
            callback(null);
        } catch (error) {
            console.error('Error clearing sessions:', error.message);
            callback(error);
        }
    }

    async all(callback) {
        try {
            const now = Date.now();
            const sql = `SELECT session_id FROM ${this.options.table} WHERE expires > ?`;
            const rows = await mysql.query(sql, [now]);
            const sessionIds = rows.map(row => row.session_id);
            callback(null, sessionIds);
        } catch (error) {
            console.error('Error getting all sessions:', error.message);
            callback(error, []);
        }
    }

    // Clean up expired sessions
    async cleanup() {
        try {
            const now = Date.now();
            const sql = `DELETE FROM ${this.options.table} WHERE expires <= ?`;
            const result = await mysql.query(sql, [now]);
            console.log(`Cleaned up ${result.affectedRows} expired sessions`);
        } catch (error) {
            console.error('Error cleaning up sessions:', error.message);
        }
    }
}

module.exports = MySQLSessionStore;
