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
            database: process.env.DB_NAME || "mybhoomy_mytest",
            connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 200,
            idleTimeout: 600000,
            enableKeepAlive: true,
            queueLimit: 500,            // INCREASED queue limit for multi-session support
            charset: 'utf8mb4'          // Ensure proper UTF-8 support for international characters
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
            const trimmed = (sql || '').trim();
            const firstWord = trimmed.split(/\s+/)[0].toUpperCase();
            const isTxnOrSession = ['START', 'COMMIT', 'ROLLBACK', 'SET', 'BEGIN', 'SAVEPOINT', 'RELEASE', 'UNLOCK', 'LOCK', 'SHOW', 'USE'].includes(firstWord);
            const hasParams = Array.isArray(args) && args.length > 0;
            const containsPlaceholders = /\?/g.test(trimmed);

            let result, fields;

            // Route transaction/session and non-parameterized statements to pool.query
            if (isTxnOrSession || (!hasParams && !containsPlaceholders)) {
                [result, fields] = await this.pool.query(sql);
            } else {
                // Parameterized DML/SELECT go through execute (prepared statements)
                [result, fields] = await this.pool.execute(sql, args);
            }
            
            // For INSERT, UPDATE, DELETE operations, return the full result metadata
            const sqlType = trimmed.toUpperCase().split(' ')[0];
            if (['INSERT', 'UPDATE', 'DELETE', 'REPLACE'].includes(sqlType)) {
                const resultData = {
                    insertId: result?.insertId || null,
                    affectedRows: result?.affectedRows || 0,
                    changedRows: result?.changedRows || 0,
                    warningStatus: result?.warningStatus || 0,
                    info: result?.info || '',
                    serverStatus: result?.serverStatus || 2,
                    fieldCount: result?.fieldCount || 0
                };
                
                if (sqlType === 'INSERT' && resultData.affectedRows > 0 && !resultData.insertId) {
                    try {
                        const [lastIdRows] = await this.pool.query('SELECT LAST_INSERT_ID() as lastId');
                        if (lastIdRows && lastIdRows[0] && lastIdRows[0].lastId) {
                            resultData.insertId = lastIdRows[0].lastId;
                        }
                    } catch (_) {}
                }
                
                return resultData;
            }
            
            // For SELECT and other queries, return rows (for SHOW/SET/START etc. this is fine too)
            return result;
        } catch (error) {
            console.error('Error executing query:', error.message);
            console.error('SQL:', sql.substring(0, 200) + '...');
            console.error('Error code:', error.code);

            const trimmed = (sql || '').trim();
            const sqlType = trimmed.split(/\s+/)[0]?.toUpperCase();

            if (error.code === 'ER_DUP_ENTRY') {
                if (sqlType === 'INSERT') {
                    return {
                        insertId: null,
                        affectedRows: 0,
                        changedRows: 0,
                        isDuplicate: true,
                        isError: false,
                        error: error.message,
                        warningStatus: 0,
                        info: 'Duplicate entry skipped',
                        serverStatus: 2,
                        fieldCount: 0
                    };
                }
            }

            const isTransient = (
                error.code === 'PROTOCOL_CONNECTION_LOST' ||
                error.code === 'ECONNRESET' ||
                error.code === 'ETIMEDOUT' ||
                (error.message || '').toLowerCase().includes('timeout')
            );

            if (isTransient) {
                console.log('Database connection issue detected, attempting to reconnect...');
                this.connected = false;
                this.connectionPromise = this.connect();
                await this.connectionPromise;

                console.error('Database query timeout details:', {
                    query: sql.substring(0, 200) + '...',
                    timeout: this.config.timeout,
                    error: error.message
                });
            }

            if (error.code === 'ER_NO_SUCH_TABLE' ||
                error.code === 'ER_BAD_FIELD_ERROR' ||
                error.code === 'ER_PARSE_ERROR') {
                // Hard errors should bubble up for callers to handle/migrate
                throw error;
            }

            // For DML statements, return a structured error object so callers don't see []
            if (['INSERT', 'UPDATE', 'DELETE', 'REPLACE'].includes(sqlType)) {
                return {
                    insertId: null,
                    affectedRows: 0,
                    changedRows: 0,
                    isDuplicate: false,
                    isError: true,
                    isTransient,
                    error: error.message,
                    code: error.code || null,
                    warningStatus: 0,
                    info: 'DML failed',
                    serverStatus: 2,
                    fieldCount: 0
                };
            }

            // For SELECT/others, maintain existing behaviour
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

module.exports = { con };