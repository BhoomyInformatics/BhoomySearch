const mysql = require('mysql2/promise');
const { DatabaseConnectionManager } = require('./utils/enhanced-db-manager');
const { logger } = require('./utils/logger');

class Database {
    constructor() {
        // Legacy configuration for backward compatibility
        this.legacyConfig = {
            host: process.env.DB_HOST || "localhost",
            user: process.env.DB_USER || "mybhoomy_admin",
            password: process.env.DB_PASSWORD || "mhQjj.%C-_LO_U4",
            database: process.env.DB_NAME || "mybhoomy_mytest",
            connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 500,
            idleTimeout: 300000,
            enableKeepAlive: true,
            acquireTimeout: 90000,
            queueTimeout: 90000,
            queueLimit: 500,
            charset: 'utf8mb4',
            maxIdle: 10,
            idleTimeoutMillis: 30000,
            evictionRunIntervalMillis: 5000
        };

        // Initialize enhanced database manager
        this.enhancedManager = new DatabaseConnectionManager(this.legacyConfig);
        
        // Legacy properties for backward compatibility
        this.pool = null;
        this.connected = false;
        this.connectionPromise = null;
        this.config = this.legacyConfig;
        
        // Setup legacy compatibility
        this.setupLegacyCompatibility();
    }

    /**
     * Setup legacy compatibility layer
     */
    setupLegacyCompatibility() {
        // Sync legacy properties with enhanced manager
        setInterval(() => {
            this.connected = this.enhancedManager.isConnected();
            this.pool = this.enhancedManager.pool;
        }, 1000);

        logger.info('Database enhanced manager initialized with legacy compatibility', {
            service: 'Database',
            enhancedManager: 'enabled',
            legacyCompatibility: 'enabled'
        });
    }

    /**
     * @deprecated - Use enhanced manager instead
     */
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

    /**
     * @deprecated - Use enhanced manager instead
     */
    async connect() {
        // Use enhanced manager for connection
        return await this.enhancedManager.waitForConnection();
    }

    async waitForConnection(timeout = 15000) {
        // Use enhanced manager for connection waiting
        return await this.enhancedManager.waitForConnection(timeout);
    }

    async query(sql, args) {
        try {
            // Use enhanced manager for all queries
            return await this.enhancedManager.query(sql, args);
        } catch (error) {
            // Maintain backward compatibility for specific error handling
            if (error.code === 'ER_NO_SUCH_TABLE' || 
                error.code === 'ER_BAD_FIELD_ERROR' || 
                error.code === 'ER_PARSE_ERROR') {
                throw error;
            }
            
            // For other errors, return empty result for backward compatibility
            logger.warn('Database query failed, returning empty result for backward compatibility', {
                service: 'Database',
                error: error.message,
                query: sql.substring(0, 100) + '...'
            });
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
        try {
            await this.enhancedManager.closePool();
            this.connected = false;
        } catch (error) {
            logger.error('Error closing database connection', {
                service: 'Database',
                error: error.message
            });
        }
    }

    isConnected() {
        return this.enhancedManager.isConnected();
    }

    /**
     * Check if database is healthy
     */
    isHealthy() {
        return this.enhancedManager.isHealthyStatus();
    }

    /**
     * Get comprehensive database metrics
     */
    getMetrics() {
        return this.enhancedManager.getMetrics();
    }

    /**
     * Get pool statistics
     */
    async getPoolStats() {
        return await this.enhancedManager.getPoolStats();
    }

    /**
     * Get database health status
     */
    getHealthStatus() {
        return {
            connected: this.enhancedManager.isConnected(),
            healthy: this.enhancedManager.isHealthyStatus(),
            metrics: this.enhancedManager.getMetrics(),
            lastHealthCheck: this.enhancedManager.lastHealthCheck,
            consecutiveFailures: this.enhancedManager.consecutiveHealthCheckFailures
        };
    }

    /**
     * Force health check
     */
    async performHealthCheck() {
        return await this.enhancedManager.performHealthCheck();
    }

    /**
     * Get recent connection errors
     */
    getConnectionErrors() {
        return this.enhancedManager.connectionErrors || [];
    }
}

const con = new Database();

module.exports = { con };
