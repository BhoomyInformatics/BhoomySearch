const path = require('path');
const fs = require('fs');
const mysql = require('mysql2/promise');

// Load env from project root: prefer .env, fallback to 'env' (no dot)
const envPath = path.resolve(process.cwd(), '.env');
const envAltPath = path.resolve(process.cwd(), 'env');
require('dotenv').config({ path: fs.existsSync(envPath) ? envPath : envAltPath });

class Database {
    constructor() {
        this.pool = mysql.createPool({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '50', 10),
            waitForConnections: true,
            queueLimit: 500,
            enableKeepAlive: true,
            keepAliveInitialDelay: 0
        });
    }

    async query(sql, args = []) {
        try {
            const [rows] = await this.pool.execute(sql, args);
            return rows;
        } catch (error) {
            console.error('Database query error:', error.message);
            throw error;
        }
    }

    async close() {
        try {
            await this.pool.end();
            console.log('Database connection pool closed');
        } catch (error) {
            console.error('Error closing database pool:', error);
            throw error;
        }
    }

    async testConnection() {
        try {
            const [rows] = await this.pool.execute('SELECT 1 as test');
            return rows.length > 0;
        } catch (error) {
            console.error('Database connection test failed:', error.message);
            return false;
        }
    }
}

const db = new Database();

module.exports = { db };
