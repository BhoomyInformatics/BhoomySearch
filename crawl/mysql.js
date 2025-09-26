const mysql = require('mysql2/promise');

class Database {
    constructor() {
        this.pool = null;
        this.connected = false;
        this.connectionPromise = null;
        this.config = {
            host: process.env.DB_HOST || "localhost",
            user: process.env.DB_USER || "mybhoomy_admin",
            password: process.env.DB_PASSWORD || "mhQjj.%C-_LO_U4",
            database: process.env.DB_NAME || "mybhoomy_mysearch",
            connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 100,
            idleTimeout: 300000,
            enableKeepAlive: true,
            acquireTimeout: 90000,      // Pool acquisition timeout
            queueTimeout: 90000,        // MySQL2 compatible timeout parameter
            queueLimit: 500,            // INCREASED queue limit for multi-session support
            charset: 'utf8mb4',         // Ensure proper UTF-8 support for international characters
            
            // Multi-session optimizations
            maxIdle: 10,                // Keep 10 idle connections ready
            idleTimeoutMillis: 30000,   // Close idle connections after 30s
            evictionRunIntervalMillis: 5000  // Check for idle connections every 5s
        };
        
        this.initializePool();
        this.connectionPromise = this.connect();
    }

    initializePool() {
        try {
            this.pool = mysql.createPool(this.config);
            console.log('Database pool created with config:', {
                host: this.config.host,
                user: this.config.user,
                database: this.config.database,
                connectionLimit: this.config.connectionLimit,
                timeout: this.config.timeout
            });
        } catch (error) {
            console.error('Error creating database pool:', error);
            this.pool = null;
        }
    }

    async connect() {
        if (!this.pool) {
            console.warn('Database pool not available, skipping connection test');
            return false;
        }

        try {
            const connection = await this.pool.getConnection();
            console.log('Connected to MySQL successfully');
            this.connected = true;
            connection.release();
            return true;
        } catch (error) {
            console.error('Error connecting to MySQL:', error.message);
            this.connected = false;
            return false;
        }
    }

    async waitForConnection(timeout = 15000) {
        if (this.connected) {
            return true;
        }

        try {
            await Promise.race([
                this.connectionPromise,
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Connection timeout')), timeout)
                )
            ]);
            return this.connected;
        } catch (error) {
            console.warn('Database connection timeout or failed:', error.message);
            return false;
        }
    }

    async query(sql, args) {
        if (!this.connected) {
            await this.waitForConnection(15000);
        }

        if (!this.pool || !this.connected) {
            console.warn('Database not available, skipping query:', sql.substring(0, 100) + '...');
            return [];
        }

        try {
            const [result, fields] = await this.pool.execute(sql, args);
            
            // For INSERT, UPDATE, DELETE operations, return the full result metadata
            // which includes insertId, affectedRows, etc.
            const sqlType = sql.trim().toUpperCase().split(' ')[0];
            if (['INSERT', 'UPDATE', 'DELETE'].includes(sqlType)) {
                // CRITICAL FIX: With mysql2, the result metadata is in the first element
                const resultData = {
                    insertId: result.insertId || null,
                    affectedRows: result.affectedRows || 0,
                    changedRows: result.changedRows || 0,
                    warningStatus: result.warningStatus || 0,
                    info: result.info || '',
                    serverStatus: result.serverStatus || 2,
                    fieldCount: result.fieldCount || 0
                };
                
                // Extra validation for INSERT operations
                if (sqlType === 'INSERT' && resultData.affectedRows > 0 && !resultData.insertId) {
                    console.warn('INSERT succeeded but no insertId returned:', {
                        affectedRows: resultData.affectedRows,
                        table: this.extractTableName(sql)
                    });
                    // Try to get the last insert ID
                    try {
                        const [lastIdRows] = await this.pool.execute('SELECT LAST_INSERT_ID() as lastId');
                        if (lastIdRows && lastIdRows[0] && lastIdRows[0].lastId) {
                            resultData.insertId = lastIdRows[0].lastId;
                            console.log('Retrieved insertId using LAST_INSERT_ID():', resultData.insertId);
                        }
                    } catch (lastIdError) {
                        console.warn('Could not retrieve LAST_INSERT_ID():', lastIdError.message);
                    }
                }
                
                return resultData;
            }
            
            // For SELECT operations, return just the result rows
            return result;
        } catch (error) {
            console.error('Error executing query:', error.message);
            console.error('SQL:', sql.substring(0, 200) + '...');
            console.error('Error code:', error.code);
            
            // Handle specific error types
            if (error.code === 'ER_DUP_ENTRY') {
                const sqlType = sql.trim().toUpperCase().split(' ')[0];
                if (sqlType === 'INSERT') {
                    console.log('Duplicate entry detected, handling gracefully');
                    return {
                        insertId: null,
                        affectedRows: 0,
                        changedRows: 0,
                        isDuplicate: true,
                        error: error.message,
                        warningStatus: 0,
                        info: 'Duplicate entry skipped',
                        serverStatus: 2,
                        fieldCount: 0
                    };
                }
            }
            
            // Handle timeout errors
            if (error.code === 'PROTOCOL_CONNECTION_LOST' || 
                error.code === 'ECONNRESET' || 
                error.code === 'ETIMEDOUT' ||
                error.message.includes('timeout')) {
                console.log('Database connection issue detected, attempting to reconnect...');
                this.connected = false;
                this.connectionPromise = this.connect();
                await this.connectionPromise;
                
                // Log timeout error details
                console.error('Database query timeout details:', {
                    query: sql.substring(0, 200) + '...',
                    timeout: this.config.timeout,
                    error: error.message
                });
            }
            
            // For critical errors that might affect data integrity, throw them
            if (error.code === 'ER_NO_SUCH_TABLE' || 
                error.code === 'ER_BAD_FIELD_ERROR' || 
                error.code === 'ER_PARSE_ERROR') {
                throw error;
            }
            
            // For other errors, return empty result for backward compatibility
            return [];
        }
    }

    /**
     * Extract table name from SQL query for logging
     */
    extractTableName(sql) {
        try {
            const match = sql.match(/(?:INTO|FROM|UPDATE)\s+`?(\w+)`?/i);
            return match ? match[1] : 'unknown';
        } catch (error) {
            return 'unknown';
        }
    }

    async close() {
        if (!this.pool) {
            return;
        }

        try {
            await this.pool.end();
            console.log('Connection pool closed');
            this.connected = false;
        } catch (error) {
            console.error('Error closing connection pool:', error);
        }
    }

    isConnected() {
        return this.connected;
    }
}

const con = new Database();

// Wait for connection to be established before exporting
con.waitForConnection().then(() => {
    console.log('Database connection ready for use');
}).catch((error) => {
    console.error('Database connection failed:', error);
});

module.exports = { con };