require('dotenv').config();
const mysql = require('mysql');

class Database {
    constructor() {
        this.connection = null;
        this.config = {
            host: process.env.DB_HOST || "localhost",
            user: process.env.DB_USER || "mybhoomy_admin",
            password: process.env.DB_PASSWORD || "mhQjj.%C-_LO_U4",
            database: process.env.DB_NAME || "mybhoomy_mysearch",
            charset: 'utf8mb4',
            timezone: 'UTC',
            acquireTimeout: 10000, // Reduced from 60000 to 10000 (10 seconds)
            timeout: 10000, // Reduced from 60000 to 10000 (10 seconds)
            connectTimeout: 10000, // Add connection timeout
            reconnect: true,
            ssl: process.env.DB_SSL === 'true' ? {} : false
        };
        
        // Remove undefined values
        Object.keys(this.config).forEach(key => {
            if (this.config[key] === undefined) {
                delete this.config[key];
            }
        });
    }

    async connect() {
        return new Promise((resolve, reject) => {
            if (this.connection) {
                return resolve();
            }

            this.connection = mysql.createConnection(this.config);
            
            this.connection.connect((err) => {
                if (err) {
                    console.error('Error connecting to MySQL:', err.message);
                    this.connection = null;
                    reject(err);
                } else {
                    console.log(`Connected to MySQL database: ${this.config.database}`);
                    
                    // Handle connection errors after initial connection
                    this.connection.on('error', (err) => {
                        console.error('MySQL connection error:', err);
                        if (err.code === 'PROTOCOL_CONNECTION_LOST') {
                            this.connection = null;
                            this.connect(); // Attempt to reconnect
                        }
                    });
                    
                    resolve();
                }
            });
        });
    }

    async query(sql, args = []) {
        try {
            // Ensure connection exists
            if (!this.connection) {
                await this.connect();
            }
            
            const rows = await this._query(sql, args);
            return rows;
        } catch (error) {
            console.error('Error executing query:', error.message);
            console.error('SQL:', sql);
            console.error('Args:', args);
            
            // If connection lost, try to reconnect and retry once
            if (error.code === 'PROTOCOL_CONNECTION_LOST' || error.code === 'ECONNRESET') {
                console.log('Attempting to reconnect and retry query...');
                this.connection = null;
                await this.connect();
                return this._query(sql, args);
            }
            
            throw error;
        }
    }

    _query(sql, args) {
        return new Promise((resolve, reject) => {
            this.connection.query(sql, args, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async close() {
        if (!this.connection) {
            return;
        }
        
        try {
            await this._close();
            console.log('MySQL connection closed');
            this.connection = null;
        } catch (error) {
            console.error('Error closing connection:', error.message);
            this.connection = null;
            throw error;
        }
    }

    _close() {
        return new Promise((resolve, reject) => {
            this.connection.end((err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    // Health check method
    async ping() {
        try {
            await this.query('SELECT 1 as ping');
            return true;
        } catch (error) {
            return false;
        }
    }

    // Get connection status
    isConnected() {
        return this.connection && this.connection.state === 'authenticated';
    }
}

// Create singleton instance
const database = new Database();

// Auto-connect on module load (with timeout)
(async () => {
    try {
        // Add a timeout to prevent hanging
        const connectPromise = database.connect();
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Connection timeout')), 15000)
        );
        
        await Promise.race([connectPromise, timeoutPromise]);
    } catch (error) {
        console.error('Failed to connect to MySQL on startup:', error.message);
        console.log('Database will attempt to connect on first query...');
    }
})();

// Export both the instance and the class for flexibility
module.exports = database;
module.exports.Database = Database;

// For backward compatibility
module.exports.con = database;