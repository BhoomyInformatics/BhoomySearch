const winston = require('winston');
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const crypto = require('crypto');

/**
 * Enhanced Logger System with Performance Monitoring and Log Aggregation
 * Addresses inconsistent logging levels and performance impact issues
 */
class EnhancedLogger {
    constructor(options = {}) {
        this.options = {
            // Environment-based configuration
            environment: process.env.NODE_ENV || 'development',
            logLevel: this.determineLogLevel(),
            
            // Performance monitoring settings
            enablePerformanceMonitoring: options.enablePerformanceMonitoring !== false,
            performanceThreshold: options.performanceThreshold || 100, // ms
            
            // Log aggregation settings
            enableLogAggregation: options.enableLogAggregation !== false,
            maxAggregatedLogs: options.maxAggregatedLogs || 10000,
            aggregationRetentionHours: options.aggregationRetentionHours || 24,
            
            // Search capabilities
            enableLogSearch: options.enableLogSearch !== false,
            searchIndexFields: options.searchIndexFields || ['message', 'component', 'operation', 'level'],
            
            // Production optimizations
            productionOptimizations: options.productionOptimizations !== false,
            asyncLogging: options.asyncLogging !== false,
            logSampling: options.logSampling || { debug: 0.1, verbose: 0.05 }, // Sample rates for high-volume logs
            
            // Format and structure
            enableStructuredLogging: options.enableStructuredLogging !== false,
            timestampFormat: options.timestampFormat || 'YYYY-MM-DD HH:mm:ss.SSS',
            
            ...options
        };

        // Performance tracking
        this.performanceStats = {
            totalLogs: 0,
            totalLoggingTime: 0,
            averageLoggingTime: 0,
            slowLogs: 0,
            logsByLevel: {
                error: 0,
                warn: 0,
                info: 0,
                debug: 0,
                verbose: 0
            },
            startTime: Date.now()
        };

        // Log aggregation storage
        this.aggregatedLogs = [];
        this.logIndex = new Map(); // For fast searching
        this.logSequence = 0;

        // Initialize enhanced winston logger
        this.winston = this.createEnhancedWinstonLogger();

        // Set up log aggregation cleanup
        if (this.options.enableLogAggregation) {
            this.setupLogAggregationCleanup();
        }

        // Initialize component loggers
        this.componentLoggers = new Map();
        
        console.log(`🚀 Enhanced Logger initialized for ${this.options.environment} environment`);
        console.log(`📊 Log Level: ${this.options.logLevel}, Performance Monitoring: ${this.options.enablePerformanceMonitoring ? 'ON' : 'OFF'}`);
    }

    /**
     * Determine appropriate log level based on environment and configuration
     */
    determineLogLevel() {
        // Explicit LOG_LEVEL environment variable takes precedence
        if (process.env.LOG_LEVEL) {
            return process.env.LOG_LEVEL.toLowerCase();
        }

        // Environment-based defaults
        switch (process.env.NODE_ENV) {
            case 'production':
                return 'warn'; // Only warnings and errors in production
            case 'test':
                return 'error'; // Minimal logging during tests
            case 'staging':
                return 'info'; // Informational logging in staging
            case 'development':
            default:
                return 'debug'; // Full logging in development
        }
    }

    /**
     * Create enhanced Winston logger with optimized configuration
     */
    createEnhancedWinstonLogger() {
        const LOG_DIR = path.join(__dirname, '../logs');
        if (!fs.existsSync(LOG_DIR)) {
            fs.mkdirSync(LOG_DIR, { recursive: true });
        }

        // Enhanced structured format
        const structuredFormat = winston.format.combine(
            winston.format.timestamp({ format: this.options.timestampFormat }),
            winston.format.errors({ stack: true }),
            winston.format.json(),
            winston.format.printf(({ timestamp, level, message, component, operation, requestId, userId, ...meta }) => {
                const logEntry = {
                    timestamp,
                    level: level.toUpperCase(),
                    message,
                    component: component || 'unknown',
                    operation: operation || null,
                    requestId: requestId || null,
                    userId: userId || null,
                    environment: this.options.environment,
                    sequence: ++this.logSequence,
                    metadata: meta
                };

                // Add to aggregated logs for search
                if (this.options.enableLogAggregation) {
                    this.addToAggregatedLogs(logEntry);
                }

                return JSON.stringify(logEntry, this.getJsonReplacer());
            })
        );

        // Console format for development
        const consoleFormat = winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp({ format: 'HH:mm:ss.SSS' }),
            winston.format.printf(({ timestamp, level, message, component, operation, requestId, ...meta }) => {
                let logMessage = `[${timestamp}] ${level}`;
                
                if (component) logMessage += ` [${component}]`;
                if (operation) logMessage += ` {${operation}}`;
                if (requestId) logMessage += ` (${requestId.substring(0, 8)})`;
                
                logMessage += `: ${message}`;

                // Add concise metadata for console
                if (Object.keys(meta).length > 0) {
                    const metaStr = this.formatMetadataForConsole(meta);
                    if (metaStr) logMessage += ` ${metaStr}`;
                }

                return logMessage;
            })
        );

        // Create logger with optimized transports
        const logger = winston.createLogger({
            level: this.options.logLevel,
            format: structuredFormat,
            defaultMeta: { 
                service: 'bhoomy-crawler',
                environment: this.options.environment,
                pid: process.pid
            },
            transports: this.createOptimizedTransports(LOG_DIR, structuredFormat),
            exceptionHandlers: this.createExceptionHandlers(LOG_DIR),
            rejectionHandlers: this.createRejectionHandlers(LOG_DIR)
        });

        // Add console transport based on environment
        if (this.options.environment !== 'production') {
            logger.add(new winston.transports.Console({
                format: consoleFormat,
                level: this.options.environment === 'test' ? 'error' : 'info'
            }));
        } else if (this.options.environment === 'production') {
            // Production: only errors and warnings to console
            logger.add(new winston.transports.Console({
                format: consoleFormat,
                level: 'warn',
                silent: process.env.SILENT_CONSOLE === 'true'
            }));
        }

        return logger;
    }

    /**
     * Create optimized transports based on environment
     */
    createOptimizedTransports(logDir, format) {
        const transports = [];

        // Error log - Always present
        transports.push(new winston.transports.File({
            filename: path.join(logDir, 'error.log'),
            level: 'error',
            maxsize: this.options.environment === 'production' ? 5 * 1024 * 1024 : 3 * 1024 * 1024,
            maxFiles: this.options.environment === 'production' ? 3 : 2,
            tailable: true,
            zippedArchive: true
        }));

        // Warning log - For important non-error events
        transports.push(new winston.transports.File({
            filename: path.join(logDir, 'warnings.log'),
            level: 'warn',
            maxsize: 3 * 1024 * 1024,
            maxFiles: 2,
            tailable: true,
            zippedArchive: true
        }));

        // Combined log - Level based on environment
        if (this.options.logLevel !== 'error') {
            transports.push(new winston.transports.File({
                filename: path.join(logDir, 'combined.log'),
                level: this.options.environment === 'production' ? 'warn' : 'info',
                maxsize: this.options.environment === 'production' ? 10 * 1024 * 1024 : 5 * 1024 * 1024,
                maxFiles: this.options.environment === 'production' ? 5 : 3,
                tailable: true,
                zippedArchive: true
            }));
        }

        // Debug log - Only in development/staging
        if (this.options.environment !== 'production' && this.options.environment !== 'test') {
            transports.push(new winston.transports.File({
                filename: path.join(logDir, 'debug.log'),
                level: 'debug',
                maxsize: 2 * 1024 * 1024,
                maxFiles: 1,
                tailable: true,
                zippedArchive: true
            }));
        }

        // Performance log - Track slow operations
        if (this.options.enablePerformanceMonitoring) {
            transports.push(new winston.transports.File({
                filename: path.join(logDir, 'performance.log'),
                level: 'info',
                maxsize: 2 * 1024 * 1024,
                maxFiles: 2,
                tailable: true,
                zippedArchive: true,
                format: winston.format.combine(
                    winston.format.timestamp({ format: this.options.timestampFormat }),
                    winston.format.json(),
                    winston.format.printf((info) => {
                        // Only log performance-related entries
                        if (info.operation || info.duration || info.performance) {
                            return JSON.stringify(info);
                        }
                        return null;
                    })
                )
            }));
        }

        return transports;
    }

    /**
     * Create exception handlers
     */
    createExceptionHandlers(logDir) {
        return [
            new winston.transports.File({
                filename: path.join(logDir, 'exceptions.log'),
                maxsize: 2 * 1024 * 1024,
                maxFiles: 2,
                zippedArchive: true
            })
        ];
    }

    /**
     * Create rejection handlers
     */
    createRejectionHandlers(logDir) {
        return [
            new winston.transports.File({
                filename: path.join(logDir, 'rejections.log'),
                maxsize: 2 * 1024 * 1024,
                maxFiles: 2,
                zippedArchive: true
            })
        ];
    }

    /**
     * Enhanced JSON replacer for better serialization
     */
    getJsonReplacer() {
        const seen = new WeakSet();
        return (key, value) => {
            // Handle circular references
            if (typeof value === 'object' && value !== null) {
                if (seen.has(value)) {
                    return '[Circular Reference]';
                }
                seen.add(value);

                // Skip problematic objects
                if (value.constructor) {
                    const constructorName = value.constructor.name;
                    if (['Pool', 'PoolConfig', 'ConnectionConfig', 'Connection', 'Client'].includes(constructorName)) {
                        return `[${constructorName} Object]`;
                    }
                }

                // Skip database connections
                if (['dbConnection', 'con', 'pool'].includes(key)) {
                    return '[Database Connection]';
                }
            }

            // Skip functions
            if (typeof value === 'function') {
                return '[Function]';
            }

            // Truncate long strings in metadata
            if (typeof value === 'string' && value.length > 1000) {
                return value.substring(0, 997) + '...';
            }

            return value;
        };
    }

    /**
     * Format metadata for console output
     */
    formatMetadataForConsole(meta) {
        try {
            const filtered = Object.fromEntries(
                Object.entries(meta)
                    .filter(([key, value]) => key !== 'metadata' && value !== undefined)
                    .slice(0, 3) // Limit to 3 fields for console
            );

            if (Object.keys(filtered).length === 0) return '';

            return Object.entries(filtered)
                .map(([key, value]) => {
                    if (typeof value === 'object') {
                        return `${key}={object}`;
                    }
                    const strValue = String(value);
                    return `${key}=${strValue.length > 50 ? strValue.substring(0, 47) + '...' : strValue}`;
                })
                .join(' ');
        } catch (error) {
            return '[meta formatting error]';
        }
    }

    /**
     * Add log entry to aggregated logs for searching
     */
    addToAggregatedLogs(logEntry) {
        try {
            // Add to circular buffer
            if (this.aggregatedLogs.length >= this.options.maxAggregatedLogs) {
                const removed = this.aggregatedLogs.shift();
                // Remove from index
                if (removed && removed.sequence) {
                    this.logIndex.delete(removed.sequence);
                }
            }

            this.aggregatedLogs.push(logEntry);

            // Add to search index
            this.indexLogEntry(logEntry);
        } catch (error) {
            console.error('Error adding to aggregated logs:', error.message);
        }
    }

    /**
     * Index log entry for fast searching
     */
    indexLogEntry(logEntry) {
        const indexData = {
            sequence: logEntry.sequence,
            timestamp: logEntry.timestamp,
            level: logEntry.level,
            component: logEntry.component,
            operation: logEntry.operation,
            message: logEntry.message,
            searchableText: this.createSearchableText(logEntry)
        };

        this.logIndex.set(logEntry.sequence, indexData);
    }

    /**
     * Create searchable text from log entry
     */
    createSearchableText(logEntry) {
        const searchFields = [
            logEntry.message,
            logEntry.component,
            logEntry.operation,
            logEntry.level,
            JSON.stringify(logEntry.metadata)
        ].filter(Boolean);

        return searchFields.join(' ').toLowerCase();
    }

    /**
     * Enhanced logging method with performance monitoring
     */
    log(level, message, metadata = {}) {
        const startTime = this.options.enablePerformanceMonitoring ? Date.now() : null;

        try {
            // Apply log sampling for high-volume logs in production
            if (this.options.environment === 'production' && this.shouldSampleLog(level)) {
                return; // Skip this log entry
            }

            // Prepare enhanced metadata
            const enhancedMetadata = this.enhanceMetadata(metadata);

            // Log using Winston
            this.winston[level](message, enhancedMetadata);

            // Update performance statistics
            if (this.options.enablePerformanceMonitoring && startTime) {
                this.updatePerformanceStats(level, startTime);
            }

        } catch (error) {
            console.error('Logging error:', error.message);
        }
    }

    /**
     * Determine if log should be sampled (skipped) in production
     */
    shouldSampleLog(level) {
        if (!this.options.productionOptimizations) return false;

        const sampleRate = this.options.logSampling[level];
        if (!sampleRate) return false;

        return Math.random() > sampleRate;
    }

    /**
     * Enhance metadata with additional context
     */
    enhanceMetadata(metadata) {
        const enhanced = {
            ...metadata,
            timestamp: new Date().toISOString(),
            hostname: require('os').hostname(),
            environment: this.options.environment
        };

        // Add request context if available
        if (global.currentRequest) {
            enhanced.requestId = global.currentRequest.id;
            enhanced.userAgent = global.currentRequest.userAgent;
            enhanced.ip = global.currentRequest.ip;
        }

        // Add performance context
        const memUsage = process.memoryUsage();
        enhanced.memory = {
            heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
            heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) // MB
        };

        return enhanced;
    }

    /**
     * Update performance statistics
     */
    updatePerformanceStats(level, startTime) {
        const duration = Date.now() - startTime;
        
        this.performanceStats.totalLogs++;
        this.performanceStats.totalLoggingTime += duration;
        this.performanceStats.averageLoggingTime = 
            this.performanceStats.totalLoggingTime / this.performanceStats.totalLogs;
        
        if (level in this.performanceStats.logsByLevel) {
            this.performanceStats.logsByLevel[level]++;
        }

        if (duration > this.options.performanceThreshold) {
            this.performanceStats.slowLogs++;
            
            // Log slow logging operations
            this.winston.warn('Slow logging operation detected', {
                component: 'enhanced-logger',
                operation: 'log',
                duration: `${duration}ms`,
                level: level,
                threshold: `${this.options.performanceThreshold}ms`,
                performance: true
            });
        }
    }

    /**
     * Set up log aggregation cleanup
     */
    setupLogAggregationCleanup() {
        setInterval(() => {
            const cutoffTime = Date.now() - (this.options.aggregationRetentionHours * 60 * 60 * 1000);
            
            let removedCount = 0;
            this.aggregatedLogs = this.aggregatedLogs.filter(log => {
                const logTime = new Date(log.timestamp).getTime();
                if (logTime < cutoffTime) {
                    this.logIndex.delete(log.sequence);
                    removedCount++;
                    return false;
                }
                return true;
            });

            if (removedCount > 0) {
                console.log(`🧹 Cleaned ${removedCount} old aggregated logs`);
            }
        }, 60 * 60 * 1000); // Every hour
    }

    /**
     * Search aggregated logs
     */
    searchLogs(query, options = {}) {
        if (!this.options.enableLogSearch) {
            throw new Error('Log search is disabled');
        }

        const {
            level = null,
            component = null,
            operation = null,
            startTime = null,
            endTime = null,
            limit = 100,
            offset = 0
        } = options;

        let results = [];

        try {
            // Filter by criteria
            for (const [sequence, indexData] of this.logIndex) {
                // Level filter
                if (level && indexData.level !== level.toUpperCase()) continue;
                
                // Component filter
                if (component && indexData.component !== component) continue;
                
                // Operation filter
                if (operation && indexData.operation !== operation) continue;
                
                // Time range filter
                if (startTime || endTime) {
                    const logTime = new Date(indexData.timestamp).getTime();
                    if (startTime && logTime < new Date(startTime).getTime()) continue;
                    if (endTime && logTime > new Date(endTime).getTime()) continue;
                }

                // Text search
                if (query && !indexData.searchableText.includes(query.toLowerCase())) continue;

                results.push({
                    sequence: indexData.sequence,
                    timestamp: indexData.timestamp,
                    level: indexData.level,
                    component: indexData.component,
                    operation: indexData.operation,
                    message: indexData.message
                });
            }

            // Sort by timestamp (newest first)
            results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            // Apply pagination
            const paginatedResults = results.slice(offset, offset + limit);

            return {
                results: paginatedResults,
                total: results.length,
                limit,
                offset,
                hasMore: results.length > offset + limit
            };

        } catch (error) {
            throw new Error(`Log search failed: ${error.message}`);
        }
    }

    /**
     * Get aggregated logs by criteria
     */
    getAggregatedLogs(options = {}) {
        const {
            level = null,
            component = null,
            limit = 100,
            offset = 0
        } = options;

        let filteredLogs = this.aggregatedLogs;

        if (level) {
            filteredLogs = filteredLogs.filter(log => log.level === level.toUpperCase());
        }

        if (component) {
            filteredLogs = filteredLogs.filter(log => log.component === component);
        }

        // Sort by sequence (newest first)
        filteredLogs.sort((a, b) => b.sequence - a.sequence);

        return {
            logs: filteredLogs.slice(offset, offset + limit),
            total: filteredLogs.length,
            limit,
            offset
        };
    }

    /**
     * Get performance statistics
     */
    getPerformanceStats() {
        const uptime = Date.now() - this.performanceStats.startTime;
        const logsPerSecond = this.performanceStats.totalLogs / (uptime / 1000);

        return {
            ...this.performanceStats,
            uptime: `${Math.round(uptime / 1000)}s`,
            logsPerSecond: logsPerSecond.toFixed(2),
            slowLogPercentage: this.performanceStats.totalLogs > 0 ? 
                ((this.performanceStats.slowLogs / this.performanceStats.totalLogs) * 100).toFixed(2) + '%' : '0%',
            averageLoggingTime: `${this.performanceStats.averageLoggingTime.toFixed(2)}ms`,
            aggregatedLogsCount: this.aggregatedLogs.length,
            indexSize: this.logIndex.size
        };
    }

    /**
     * Create component logger with enhanced features
     */
    createComponentLogger(component) {
        if (this.componentLoggers.has(component)) {
            return this.componentLoggers.get(component);
        }

        const componentLogger = {
            error: (message, meta = {}) => this.log('error', message, { component, ...meta }),
            warn: (message, meta = {}) => this.log('warn', message, { component, ...meta }),
            info: (message, meta = {}) => this.log('info', message, { component, ...meta }),
            debug: (message, meta = {}) => this.log('debug', message, { component, ...meta }),
            verbose: (message, meta = {}) => this.log('verbose', message, { component, ...meta }),
            
            // Enhanced methods
            performance: (operation, duration, meta = {}) => {
                this.log('info', `Performance: ${operation}`, {
                    component,
                    operation,
                    duration: `${duration}ms`,
                    performance: true,
                    ...meta
                });
            },
            
            operation: (operation, message, meta = {}) => {
                this.log('info', message, { component, operation, ...meta });
            },
            
            security: (event, meta = {}) => {
                this.log('warn', `Security event: ${event}`, {
                    component,
                    operation: 'security',
                    event,
                    ...meta
                });
            }
        };

        this.componentLoggers.set(component, componentLogger);
        return componentLogger;
    }

    /**
     * Performance timer utility
     */
    startTimer(operation, component = 'unknown') {
        const startTime = Date.now();
        return {
            end: (meta = {}) => {
                const duration = Date.now() - startTime;
                
                if (this.options.enablePerformanceMonitoring) {
                    this.log('info', `Operation completed: ${operation}`, {
                        component,
                        operation,
                        duration: `${duration}ms`,
                        performance: true,
                        ...meta
                    });
                }
                
                return duration;
            }
        };
    }

    /**
     * Shutdown logger gracefully
     */
    shutdown() {
        console.log('🔄 Shutting down enhanced logger...');
        
        // Flush all logs
        if (this.winston && typeof this.winston.close === 'function') {
            this.winston.close();
        }
        
        // Clear aggregated logs
        this.aggregatedLogs.length = 0;
        this.logIndex.clear();
        this.componentLoggers.clear();
        
        console.log('✅ Enhanced logger shutdown completed');
    }

    /**
     * Configure logger at runtime
     */
    configure(newOptions) {
        Object.assign(this.options, newOptions);
        
        // Recreate Winston logger if log level changed
        if (newOptions.logLevel && newOptions.logLevel !== this.winston.level) {
            this.winston.level = newOptions.logLevel;
            console.log(`📊 Log level changed to: ${newOptions.logLevel}`);
        }

        console.log('⚙️  Logger configuration updated', { options: newOptions });
    }

    /**
     * Export logs for external analysis
     */
    exportLogs(format = 'json', options = {}) {
        const {
            level = null,
            component = null,
            startTime = null,
            endTime = null
        } = options;

        let logsToExport = this.aggregatedLogs;

        // Apply filters
        if (level) {
            logsToExport = logsToExport.filter(log => log.level === level.toUpperCase());
        }
        if (component) {
            logsToExport = logsToExport.filter(log => log.component === component);
        }
        if (startTime || endTime) {
            logsToExport = logsToExport.filter(log => {
                const logTime = new Date(log.timestamp).getTime();
                if (startTime && logTime < new Date(startTime).getTime()) return false;
                if (endTime && logTime > new Date(endTime).getTime()) return false;
                return true;
            });
        }

        // Format output
        switch (format.toLowerCase()) {
            case 'json':
                return JSON.stringify(logsToExport, null, 2);
            case 'csv':
                return this.formatLogsAsCsv(logsToExport);
            case 'text':
                return logsToExport.map(log => 
                    `[${log.timestamp}] [${log.level}] [${log.component}] ${log.message}`
                ).join('\n');
            default:
                throw new Error(`Unsupported export format: ${format}`);
        }
    }

    /**
     * Format logs as CSV
     */
    formatLogsAsCsv(logs) {
        if (logs.length === 0) return '';

        const headers = ['timestamp', 'level', 'component', 'operation', 'message'];
        const csvRows = [headers.join(',')];

        logs.forEach(log => {
            const row = [
                log.timestamp,
                log.level,
                log.component || '',
                log.operation || '',
                `"${(log.message || '').replace(/"/g, '""')}"`
            ];
            csvRows.push(row.join(','));
        });

        return csvRows.join('\n');
    }
}

module.exports = { EnhancedLogger };
