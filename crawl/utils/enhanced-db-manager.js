/**
 * Enhanced Database Connection Manager
 * Provides advanced connection pooling, health monitoring, and automatic recovery
 */

const mysql = require('mysql2/promise');
const os = require('os');
const { logger } = require('./logger');
const IndexPermissionHandler = require('./index-permission-handler');

class DatabaseConnectionManager {
    constructor(config = {}) {
        this.config = this.buildOptimalConfig(config);
        this.pool = null;
        this.connected = false;
        this.connectionPromise = null;
        this.indexPermissionHandler = null;
        
        // Health monitoring
        this.healthCheckInterval = null;
        this.lastHealthCheck = null;
        this.connectionErrors = [];
        this.isHealthy = false;
        
        // Metrics tracking
        this.metrics = {
            totalConnections: 0,
            activeConnections: 0,
            idleConnections: 0,
            connectionAcquisitionTime: [],
            queryExecutionTime: [],
            connectionErrors: 0,
            queryErrors: 0,
            reconnectAttempts: 0,
            startTime: Date.now(),
            lastQueryTime: null,
            poolUtilization: 0,
            averageQueryTime: 0,
            peakConnections: 0
        };
        
        // Recovery state
        this.recoveryInProgress = false;
        this.maxRecoveryAttempts = 5;
        this.recoveryAttempts = 0;
        this.lastRecoveryAttempt = null;
        
        // Alerting
        this.alertThresholds = {
            connectionPoolUtilization: 80, // Alert at 80% pool utilization
            averageQueryTime: 5000,        // Alert if avg query time > 5s
            errorRate: 0.05,               // Alert if error rate > 5%
            healthCheckFailures: 3         // Alert after 3 consecutive health check failures
        };
        
        this.consecutiveHealthCheckFailures = 0;
        this.lastAlert = {};
        
        this.initialize();
    }

    /**
     * Build optimal database configuration based on system resources
     */
    buildOptimalConfig(userConfig) {
        const systemInfo = this.getSystemInfo();
        
        // Calculate optimal pool size based on system resources
        const basePoolSize = Math.max(10, Math.min(100, Math.floor(systemInfo.totalMemoryGB * 10)));
        const adjustedPoolSize = userConfig.connectionLimit || basePoolSize;
        
        const optimalConfig = {
            // Connection settings
            host: userConfig.host || process.env.DB_HOST || 'localhost',
            user: userConfig.user || process.env.DB_USER || 'root',
            password: userConfig.password || process.env.DB_PASSWORD || '',
            database: userConfig.database || process.env.DB_NAME || 'mybhoomy_mytest',
            port: userConfig.port || process.env.DB_PORT || 3306,
            
            // Pool configuration optimized for system resources
            connectionLimit: adjustedPoolSize,
            queueLimit: Math.max(500, adjustedPoolSize * 2),
            acquireTimeout: userConfig.acquireTimeout || 30000,
            timeout: userConfig.timeout || 60000,
            
            // Connection management
            idleTimeout: userConfig.idleTimeout || 300000, // 5 minutes
            maxIdle: Math.max(5, Math.floor(adjustedPoolSize * 0.1)), // 10% of pool as idle
            evictionRunIntervalMillis: 30000, // Check every 30 seconds
            
            // Performance settings
            charset: userConfig.charset || 'utf8mb4',
            multipleStatements: userConfig.multipleStatements !== false,
            supportBigNumbers: userConfig.supportBigNumbers !== false,
            bigNumberStrings: userConfig.bigNumberStrings !== false,
            
            // Reliability settings
            reconnect: true,
            keepAliveInitialDelay: 0,
            enableKeepAlive: true,
            removeNodeErrorCount: 3,
            restoreNodeTimeout: 0,
            
            // Query timeouts
            queryTimeout: userConfig.queryTimeout || 30000,
            
            // SSL settings (if provided)
            ssl: userConfig.ssl || null
        };

        logger.info('Database configuration optimized for system', {
            service: 'DatabaseConnectionManager',
            systemInfo,
            poolConfig: {
                connectionLimit: optimalConfig.connectionLimit,
                queueLimit: optimalConfig.queueLimit,
                maxIdle: optimalConfig.maxIdle,
                idleTimeout: optimalConfig.idleTimeout
            }
        });

        return optimalConfig;
    }

    /**
     * Get system information for optimization
     */
    getSystemInfo() {
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const cpuCount = os.cpus().length;
        
        return {
            totalMemoryGB: Math.round(totalMemory / (1024 * 1024 * 1024) * 100) / 100,
            freeMemoryGB: Math.round(freeMemory / (1024 * 1024 * 1024) * 100) / 100,
            memoryUsagePercent: Math.round((1 - freeMemory / totalMemory) * 100),
            cpuCount,
            platform: os.platform(),
            arch: os.arch(),
            nodeVersion: process.version
        };
    }

    /**
     * Initialize the database connection manager
     */
    async initialize() {
        try {
            logger.info('Initializing enhanced database connection manager', {
                service: 'DatabaseConnectionManager',
                config: {
                    host: this.config.host,
                    database: this.config.database,
                    connectionLimit: this.config.connectionLimit,
                    queueLimit: this.config.queueLimit
                }
            });

            await this.createConnectionPool();
            await this.startHealthMonitoring();
            
            // Initial connection test
            this.connectionPromise = this.testConnection();
            const connectionSuccess = await this.connectionPromise;
            
            if (connectionSuccess) {
                logger.info('Database connection manager initialized successfully', {
                    service: 'DatabaseConnectionManager',
                    poolStats: await this.getPoolStats()
                });
            } else {
                logger.error('Failed to establish initial database connection', {
                    service: 'DatabaseConnectionManager'
                });
            }

        } catch (error) {
            logger.error('Failed to initialize database connection manager', {
                service: 'DatabaseConnectionManager',
                error: error.message,
                stack: error.stack
            });
            
            // Attempt recovery
            await this.initiateRecovery();
        }
    }

    /**
     * Create connection pool with advanced configuration
     */
    async createConnectionPool() {
        try {
            if (this.pool) {
                await this.closePool();
            }

            this.pool = mysql.createPool(this.config);
            
            // Set up pool event listeners
            this.setupPoolEventListeners();
            
            logger.info('Database connection pool created', {
                service: 'DatabaseConnectionManager',
                poolConfig: {
                    connectionLimit: this.config.connectionLimit,
                    queueLimit: this.config.queueLimit,
                    acquireTimeout: this.config.acquireTimeout,
                    idleTimeout: this.config.idleTimeout
                }
            });

        } catch (error) {
            logger.error('Failed to create database connection pool', {
                service: 'DatabaseConnectionManager',
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Set up pool event listeners for monitoring
     */
    setupPoolEventListeners() {
        if (!this.pool) return;

        // Connection events
        this.pool.on('connection', (connection) => {
            this.metrics.totalConnections++;
            this.metrics.activeConnections++;
            this.metrics.peakConnections = Math.max(this.metrics.peakConnections, this.metrics.activeConnections);
            
            logger.debug('New database connection established', {
                service: 'DatabaseConnectionManager',
                connectionId: connection.threadId,
                activeConnections: this.metrics.activeConnections
            });
        });

        this.pool.on('release', (connection) => {
            this.metrics.activeConnections = Math.max(0, this.metrics.activeConnections - 1);
            this.metrics.idleConnections++;
            
            logger.debug('Database connection released to pool', {
                service: 'DatabaseConnectionManager',
                connectionId: connection.threadId,
                activeConnections: this.metrics.activeConnections
            });
        });

        this.pool.on('enqueue', () => {
            logger.debug('Database connection request queued', {
                service: 'DatabaseConnectionManager',
                queueLength: this.pool._freeConnections ? this.pool._freeConnections.length : 'unknown'
            });
        });
    }

    /**
     * Test database connection
     */
    async testConnection() {
        if (!this.pool) {
            logger.warn('No database pool available for connection test', {
                service: 'DatabaseConnectionManager'
            });
            return false;
        }

        try {
            const startTime = Date.now();
            const connection = await this.pool.getConnection();
            const acquisitionTime = Date.now() - startTime;
            
            // Test query
            await connection.execute('SELECT 1 as test');
            connection.release();
            
            this.connected = true;
            this.isHealthy = true;
            this.lastHealthCheck = new Date();
            this.consecutiveHealthCheckFailures = 0;
            
            // Initialize index permission handler
            this.indexPermissionHandler = new IndexPermissionHandler(this);
            
            // Track metrics
            this.metrics.connectionAcquisitionTime.push(acquisitionTime);
            if (this.metrics.connectionAcquisitionTime.length > 100) {
                this.metrics.connectionAcquisitionTime.shift(); // Keep last 100 measurements
            }

            logger.debug('Database connection test successful', {
                service: 'DatabaseConnectionManager',
                acquisitionTime: `${acquisitionTime}ms`,
                poolStats: await this.getPoolStats()
            });

            return true;
        } catch (error) {
            this.connected = false;
            this.isHealthy = false;
            this.consecutiveHealthCheckFailures++;
            this.connectionErrors.push({
                timestamp: new Date(),
                error: error.message,
                code: error.code
            });
            
            // Keep only last 50 errors
            if (this.connectionErrors.length > 50) {
                this.connectionErrors.shift();
            }

            logger.error('Database connection test failed', {
                service: 'DatabaseConnectionManager',
                error: error.message,
                code: error.code,
                consecutiveFailures: this.consecutiveHealthCheckFailures
            });

            return false;
        }
    }

    /**
     * Start health monitoring
     */
    async startHealthMonitoring() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }

        this.healthCheckInterval = setInterval(async () => {
            await this.performHealthCheck();
        }, 30000); // Every 30 seconds

        logger.info('Database health monitoring started', {
            service: 'DatabaseConnectionManager',
            interval: '30 seconds'
        });
    }

    /**
     * Perform comprehensive health check
     */
    async performHealthCheck() {
        try {
            const healthStart = Date.now();
            
            // Test connection
            const connectionHealthy = await this.testConnection();
            
            // Check pool statistics
            const poolStats = await this.getPoolStats();
            
            // Check system resources
            const systemInfo = this.getSystemInfo();
            
            // Calculate health metrics
            const healthMetrics = {
                connectionHealthy,
                poolUtilization: poolStats.poolUtilization,
                averageQueryTime: this.calculateAverageQueryTime(),
                errorRate: this.calculateErrorRate(),
                systemMemoryUsage: systemInfo.memoryUsagePercent,
                healthCheckDuration: Date.now() - healthStart
            };

            // Update overall health status
            this.isHealthy = this.evaluateOverallHealth(healthMetrics);
            
            // Check for alerts
            await this.checkHealthAlerts(healthMetrics);
            
            logger.debug('Database health check completed', {
                service: 'DatabaseConnectionManager',
                healthy: this.isHealthy,
                metrics: healthMetrics,
                poolStats
            });

        } catch (error) {
            this.isHealthy = false;
            this.consecutiveHealthCheckFailures++;
            
            logger.error('Database health check failed', {
                service: 'DatabaseConnectionManager',
                error: error.message,
                consecutiveFailures: this.consecutiveHealthCheckFailures
            });

            // Trigger recovery if needed
            if (this.consecutiveHealthCheckFailures >= 3) {
                await this.initiateRecovery();
            }
        }
    }

    /**
     * Execute database query with comprehensive monitoring
     */
    async query(sql, args = [], options = {}) {
        const queryStart = Date.now();
        const queryId = `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const maxRetries = options.maxRetries || 3;
        const retryDelay = options.retryDelay || 1000;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                // Wait for connection if not ready
                if (!this.connected) {
                    await this.waitForConnection(15000);
                }

                if (!this.pool || !this.connected) {
                    throw new Error('Database not available');
                }

                // Get connection from pool
                const acquisitionStart = Date.now();
                const connection = await this.pool.getConnection();
                const acquisitionTime = Date.now() - acquisitionStart;
                
                this.metrics.connectionAcquisitionTime.push(acquisitionTime);
                if (this.metrics.connectionAcquisitionTime.length > 100) {
                    this.metrics.connectionAcquisitionTime.shift();
                }

                try {
                    // Execute query
                    const [result, fields] = await connection.execute(sql, args);
                    connection.release();
                    
                    // Track metrics
                    const executionTime = Date.now() - queryStart;
                    this.metrics.queryExecutionTime.push(executionTime);
                    if (this.metrics.queryExecutionTime.length > 1000) {
                        this.metrics.queryExecutionTime.shift();
                    }
                    this.metrics.lastQueryTime = Date.now();
                    
                    // Log slow queries
                    if (executionTime > 5000) {
                        logger.warn('Slow database query detected', {
                            service: 'DatabaseConnectionManager',
                            queryId,
                            executionTime: `${executionTime}ms`,
                            acquisitionTime: `${acquisitionTime}ms`,
                            query: sql.substring(0, 200) + '...'
                        });
                    }

                    // Process result based on query type
                    return this.processQueryResult(sql, result, fields);

                } catch (queryError) {
                    if (connection) connection.release();
                    throw queryError;
                }
            } catch (error) {
                const executionTime = Date.now() - queryStart;
                this.metrics.queryErrors++;
                
                // Check if this is a deadlock or retryable error
                const isDeadlock = error.code === 'ER_LOCK_DEADLOCK';
                const isRetryable = this.isRetryableError(error) || isDeadlock;
                
                if (isRetryable && attempt < maxRetries) {
                    const delay = retryDelay * Math.pow(2, attempt - 1) + Math.random() * 1000; // Exponential backoff with jitter
                    
                    logger.warn('Query failed, retrying...', {
                        service: 'DatabaseConnectionManager',
                        queryId,
                        error: error.message,
                        code: error.code,
                        attempt,
                        maxRetries,
                        retryDelay: `${delay}ms`,
                        query: sql.substring(0, 200) + '...'
                    });
                    
                    await this.sleep(delay);
                    continue;
                }
                
                logger.error('Database query failed', {
                    service: 'DatabaseConnectionManager',
                    queryId,
                    error: error.message,
                    code: error.code,
                    executionTime: `${executionTime}ms`,
                    query: sql.substring(0, 200) + '...',
                    retryable: isRetryable,
                    attempts: attempt
                });

                // Handle specific error types
                if (this.isConnectionError(error)) {
                    this.connected = false;
                    this.isHealthy = false;
                    await this.initiateRecovery();
                }

                // Handle duplicate entry errors gracefully
                if (error.code === 'ER_DUP_ENTRY') {
                    return this.handleDuplicateEntry(sql, error);
                }

                throw error;
            }
        }
    }

    /**
     * Process query result based on SQL type
     */
    processQueryResult(sql, result, fields) {
        const sqlType = sql.trim().toUpperCase().split(' ')[0];
        
        if (['INSERT', 'UPDATE', 'DELETE'].includes(sqlType)) {
            return {
                insertId: result.insertId || null,
                affectedRows: result.affectedRows || 0,
                changedRows: result.changedRows || 0,
                warningStatus: result.warningStatus || 0,
                info: result.info || '',
                serverStatus: result.serverStatus || 2,
                fieldCount: result.fieldCount || 0
            };
        }
        
        return result;
    }

    /**
     * Handle duplicate entry errors
     */
    handleDuplicateEntry(sql, error) {
        const sqlType = sql.trim().toUpperCase().split(' ')[0];
        
        if (sqlType === 'INSERT') {
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
        
        throw error;
    }

    /**
     * Wait for database connection
     */
    async waitForConnection(timeout = 15000) {
        if (this.connected) {
            return true;
        }

        try {
            await Promise.race([
                this.connectionPromise || this.testConnection(),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Connection timeout')), timeout)
                )
            ]);
            return this.connected;
        } catch (error) {
            logger.warn('Database connection wait timeout', {
                service: 'DatabaseConnectionManager',
                timeout: `${timeout}ms`,
                error: error.message
            });
            return false;
        }
    }

    /**
     * Initiate automatic recovery
     */
    async initiateRecovery() {
        if (this.recoveryInProgress) {
            logger.debug('Database recovery already in progress', {
                service: 'DatabaseConnectionManager'
            });
            return;
        }

        this.recoveryInProgress = true;
        this.lastRecoveryAttempt = Date.now();
        this.recoveryAttempts++;

        logger.warn('Initiating database connection recovery', {
            service: 'DatabaseConnectionManager',
            attempt: this.recoveryAttempts,
            maxAttempts: this.maxRecoveryAttempts
        });

        try {
            if (this.recoveryAttempts > this.maxRecoveryAttempts) {
                logger.error('Maximum recovery attempts exceeded', {
                    service: 'DatabaseConnectionManager',
                    attempts: this.recoveryAttempts,
                    maxAttempts: this.maxRecoveryAttempts
                });
                
                await this.sendAlert('CRITICAL', 'Database recovery failed - maximum attempts exceeded');
                return false;
            }

            // Wait before retry (exponential backoff)
            const backoffTime = Math.min(1000 * Math.pow(2, this.recoveryAttempts - 1), 30000);
            await new Promise(resolve => setTimeout(resolve, backoffTime));

            // Recreate connection pool
            await this.createConnectionPool();
            
            // Test connection
            const connectionSuccess = await this.testConnection();
            
            if (connectionSuccess) {
                logger.info('Database connection recovery successful', {
                    service: 'DatabaseConnectionManager',
                    attempt: this.recoveryAttempts,
                    backoffTime: `${backoffTime}ms`
                });
                
                this.recoveryAttempts = 0;
                this.recoveryInProgress = false;
                return true;
            } else {
                throw new Error('Connection test failed after recovery attempt');
            }

        } catch (error) {
            logger.error('Database recovery attempt failed', {
                service: 'DatabaseConnectionManager',
                attempt: this.recoveryAttempts,
                error: error.message
            });

            this.recoveryInProgress = false;
            
            // Schedule next recovery attempt
            setTimeout(() => {
                this.initiateRecovery();
            }, 5000);
            
            return false;
        }
    }

    /**
     * Get comprehensive pool statistics
     */
    async getPoolStats() {
        if (!this.pool) {
            return {
                totalConnections: 0,
                activeConnections: 0,
                idleConnections: 0,
                poolUtilization: 0,
                queueLength: 0
            };
        }

        try {
            const poolInfo = {
                totalConnections: this.pool._allConnections ? this.pool._allConnections.length : 0,
                activeConnections: this.pool._acquiringConnections ? this.pool._acquiringConnections.length : 0,
                idleConnections: this.pool._freeConnections ? this.pool._freeConnections.length : 0,
                queueLength: this.pool._connectionQueue ? this.pool._connectionQueue.length : 0,
                connectionLimit: this.config.connectionLimit
            };

            poolInfo.poolUtilization = poolInfo.connectionLimit > 0 ? 
                Math.round((poolInfo.activeConnections / poolInfo.connectionLimit) * 100) : 0;

            return poolInfo;
        } catch (error) {
            logger.debug('Error getting pool stats', {
                service: 'DatabaseConnectionManager',
                error: error.message
            });
            return {
                totalConnections: 0,
                activeConnections: 0,
                idleConnections: 0,
                poolUtilization: 0,
                queueLength: 0
            };
        }
    }

    /**
     * Calculate average query execution time
     */
    calculateAverageQueryTime() {
        if (this.metrics.queryExecutionTime.length === 0) return 0;
        
        const sum = this.metrics.queryExecutionTime.reduce((a, b) => a + b, 0);
        return Math.round(sum / this.metrics.queryExecutionTime.length);
    }

    /**
     * Calculate error rate
     */
    calculateErrorRate() {
        const totalQueries = this.metrics.queryExecutionTime.length + this.metrics.queryErrors;
        return totalQueries > 0 ? this.metrics.queryErrors / totalQueries : 0;
    }

    /**
     * Evaluate overall health status
     */
    evaluateOverallHealth(metrics) {
        const healthFactors = [
            metrics.connectionHealthy,
            metrics.poolUtilization < this.alertThresholds.connectionPoolUtilization,
            metrics.averageQueryTime < this.alertThresholds.averageQueryTime,
            metrics.errorRate < this.alertThresholds.errorRate,
            this.consecutiveHealthCheckFailures < this.alertThresholds.healthCheckFailures
        ];

        return healthFactors.filter(Boolean).length >= 4; // At least 4 out of 5 factors must be healthy
    }

    /**
     * Check for health alerts
     */
    async checkHealthAlerts(metrics) {
        const now = Date.now();
        const alertCooldown = 300000; // 5 minutes between similar alerts

        // Pool utilization alert
        if (metrics.poolUtilization >= this.alertThresholds.connectionPoolUtilization) {
            if (!this.lastAlert.poolUtilization || (now - this.lastAlert.poolUtilization) > alertCooldown) {
                await this.sendAlert('WARNING', `High connection pool utilization: ${metrics.poolUtilization}%`);
                this.lastAlert.poolUtilization = now;
            }
        }

        // Query time alert
        if (metrics.averageQueryTime >= this.alertThresholds.averageQueryTime) {
            if (!this.lastAlert.queryTime || (now - this.lastAlert.queryTime) > alertCooldown) {
                await this.sendAlert('WARNING', `High average query time: ${metrics.averageQueryTime}ms`);
                this.lastAlert.queryTime = now;
            }
        }

        // Error rate alert
        if (metrics.errorRate >= this.alertThresholds.errorRate) {
            if (!this.lastAlert.errorRate || (now - this.lastAlert.errorRate) > alertCooldown) {
                await this.sendAlert('WARNING', `High database error rate: ${(metrics.errorRate * 100).toFixed(2)}%`);
                this.lastAlert.errorRate = now;
            }
        }

        // Health check failures alert
        if (this.consecutiveHealthCheckFailures >= this.alertThresholds.healthCheckFailures) {
            if (!this.lastAlert.healthCheck || (now - this.lastAlert.healthCheck) > alertCooldown) {
                await this.sendAlert('CRITICAL', `Database health check failures: ${this.consecutiveHealthCheckFailures} consecutive failures`);
                this.lastAlert.healthCheck = now;
            }
        }
    }

    /**
     * Send alert notification
     */
    async sendAlert(level, message) {
        const alertData = {
            service: 'DatabaseConnectionManager',
            level,
            message,
            timestamp: new Date().toISOString(),
            metrics: {
                connected: this.connected,
                healthy: this.isHealthy,
                poolStats: await this.getPoolStats(),
                averageQueryTime: this.calculateAverageQueryTime(),
                errorRate: this.calculateErrorRate(),
                consecutiveHealthCheckFailures: this.consecutiveHealthCheckFailures
            }
        };

        if (level === 'CRITICAL') {
            logger.error('Database CRITICAL alert', alertData);
        } else if (level === 'WARNING') {
            logger.warn('Database WARNING alert', alertData);
        } else {
            logger.info('Database INFO alert', alertData);
        }

        // Here you could integrate with external alerting systems
        // e.g., Slack, email, PagerDuty, etc.
    }

    /**
     * Check if error is connection-related
     */
    isConnectionError(error) {
        const connectionErrorCodes = [
            'PROTOCOL_CONNECTION_LOST',
            'ECONNRESET',
            'ETIMEDOUT',
            'ENOTFOUND',
            'ECONNREFUSED',
            'PROTOCOL_ENQUEUE_AFTER_QUIT',
            'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR'
        ];

        return connectionErrorCodes.includes(error.code) || 
               error.message.includes('timeout') ||
               error.message.includes('connection');
    }

    /**
     * Check if error is retryable
     */
    isRetryableError(error) {
        const retryableErrorCodes = [
            'PROTOCOL_CONNECTION_LOST',
            'ECONNRESET',
            'ETIMEDOUT',
            'ENOTFOUND',
            'ECONNREFUSED'
        ];

        return retryableErrorCodes.includes(error.code);
    }

    /**
     * Get comprehensive metrics
     */
    getMetrics() {
        const runtime = Date.now() - this.metrics.startTime;
        
        return {
            ...this.metrics,
            runtime: `${runtime}ms`,
            averageQueryTime: this.calculateAverageQueryTime(),
            errorRate: this.calculateErrorRate(),
            connected: this.connected,
            healthy: this.isHealthy,
            recoveryAttempts: this.recoveryAttempts,
            lastRecoveryAttempt: this.lastRecoveryAttempt,
            consecutiveHealthCheckFailures: this.consecutiveHealthCheckFailures,
            poolUtilization: this.metrics.poolUtilization,
            systemInfo: this.getSystemInfo()
        };
    }

    /**
     * Close connection pool
     */
    async closePool() {
        try {
            if (this.healthCheckInterval) {
                clearInterval(this.healthCheckInterval);
                this.healthCheckInterval = null;
            }

            if (this.pool) {
                await this.pool.end();
                this.pool = null;
            }

            this.connected = false;
            this.isHealthy = false;

            logger.info('Database connection pool closed', {
                service: 'DatabaseConnectionManager'
            });

        } catch (error) {
            logger.error('Error closing database connection pool', {
                service: 'DatabaseConnectionManager',
                error: error.message
            });
        }
    }

    /**
     * Check if database is connected and healthy
     */
    isConnected() {
        return this.connected;
    }

    /**
     * Check if database is healthy
     */
    isHealthyStatus() {
        return this.isHealthy;
    }

    /**
     * Sleep utility for retry delays
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Safely create database indexes with permission checking
     */
    async createIndex(indexName, tableName, columns, options = {}) {
        if (!this.indexPermissionHandler) {
            logger.warn('Index permission handler not initialized, skipping index creation', {
                indexName,
                tableName
            });
            return false;
        }

        return await this.indexPermissionHandler.createIndex(indexName, tableName, columns, options);
    }

    /**
     * Create multiple indexes safely
     */
    async createIndexes(indexDefinitions) {
        if (!this.indexPermissionHandler) {
            logger.warn('Index permission handler not initialized, skipping index creation');
            return [];
        }

        return await this.indexPermissionHandler.createIndexes(indexDefinitions);
    }

    /**
     * Get index creation status
     */
    getIndexStatus() {
        return this.indexPermissionHandler ? this.indexPermissionHandler.getStatus() : {
            permissionChecked: false,
            indexCreationEnabled: false
        };
    }
}

module.exports = { DatabaseConnectionManager };
