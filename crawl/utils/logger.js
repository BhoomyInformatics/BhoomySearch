const winston = require('winston');
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const { promisify } = require('util');
const { EnhancedLogger } = require('./enhanced-logger');

// Create logs directory if it doesn't exist
const LOG_DIR = path.join(__dirname, '../logs');
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Memory monitoring for logger
class LoggerMemoryMonitor {
    constructor() {
        this.initialMemory = process.memoryUsage();
        this.peakMemory = { ...this.initialMemory };
        this.cleanupIntervals = new Set();
        this.isShuttingDown = false;
        
        // Start memory monitoring
        this.startMonitoring();
        
        // Setup cleanup handlers
        this.setupCleanupHandlers();
    }

    startMonitoring() {
        // Monitor memory usage every 30 seconds
        const memoryMonitorInterval = setInterval(() => {
            if (this.isShuttingDown) return;
            
            const current = process.memoryUsage();
            
            // Track peak memory usage
            Object.keys(current).forEach(key => {
                if (current[key] > this.peakMemory[key]) {
                    this.peakMemory[key] = current[key];
                }
            });
            
            // Log memory usage if it's growing significantly
            const heapUsedMB = current.heapUsed / 1024 / 1024;
            const rssUsedMB = current.rss / 1024 / 1024;
            
            if (heapUsedMB > 100 || rssUsedMB > 200) {
                console.warn(`⚠️  High memory usage detected - Heap: ${heapUsedMB.toFixed(2)}MB, RSS: ${rssUsedMB.toFixed(2)}MB`);
            }
            
        }, 30000); // Every 30 seconds
        
        this.cleanupIntervals.add(memoryMonitorInterval);
    }

    setupCleanupHandlers() {
        // Handle various exit scenarios
        const exitEvents = ['exit', 'SIGINT', 'SIGTERM', 'SIGUSR1', 'SIGUSR2', 'uncaughtException', 'unhandledRejection'];
        
        exitEvents.forEach(event => {
            process.on(event, (err) => {
                if (event === 'uncaughtException' || event === 'unhandledRejection') {
                    console.error(`${event}:`, err);
                }
                this.cleanup();
                if (event !== 'exit') {
                    process.exit(event === 'uncaughtException' || event === 'unhandledRejection' ? 1 : 0);
                }
            });
        });
    }

    cleanup() {
        if (this.isShuttingDown) return;
        this.isShuttingDown = true;
        
        console.log('🧹 Cleaning up logger resources...');
        
        // Clear all intervals
        this.cleanupIntervals.forEach(interval => {
            clearInterval(interval);
        });
        this.cleanupIntervals.clear();
        
        // Close winston transports
        if (global.logger && typeof global.logger.close === 'function') {
            global.logger.close();
        }
        
        console.log('✅ Logger cleanup completed');
    }

    getMemoryStats() {
        const current = process.memoryUsage();
        return {
            current: {
                heapUsed: (current.heapUsed / 1024 / 1024).toFixed(2) + ' MB',
                heapTotal: (current.heapTotal / 1024 / 1024).toFixed(2) + ' MB',
                rss: (current.rss / 1024 / 1024).toFixed(2) + ' MB',
                external: (current.external / 1024 / 1024).toFixed(2) + ' MB'
            },
            peak: {
                heapUsed: (this.peakMemory.heapUsed / 1024 / 1024).toFixed(2) + ' MB',
                heapTotal: (this.peakMemory.heapTotal / 1024 / 1024).toFixed(2) + ' MB',
                rss: (this.peakMemory.rss / 1024 / 1024).toFixed(2) + ' MB',
                external: (this.peakMemory.external / 1024 / 1024).toFixed(2) + ' MB'
            }
        };
    }
}

// Initialize memory monitor
const memoryMonitor = new LoggerMemoryMonitor();

// Initialize Enhanced Logger with environment-based configuration
const enhancedLogger = new EnhancedLogger({
    // Environment-based settings
    environment: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'warn' : 'info'),
    
    // Performance monitoring
    enablePerformanceMonitoring: process.env.ENABLE_PERFORMANCE_MONITORING !== 'false',
    performanceThreshold: parseInt(process.env.PERFORMANCE_THRESHOLD) || 100,
    
    // Log aggregation and search
    enableLogAggregation: process.env.ENABLE_LOG_AGGREGATION !== 'false',
    maxAggregatedLogs: parseInt(process.env.MAX_AGGREGATED_LOGS) || 10000,
    enableLogSearch: process.env.ENABLE_LOG_SEARCH !== 'false',
    
    // Production optimizations
    productionOptimizations: process.env.NODE_ENV === 'production',
    logSampling: {
        debug: process.env.ENABLE_DEBUG_LOGS === 'true' ? (parseFloat(process.env.DEBUG_LOG_SAMPLING) || 0.1) : 0,
        verbose: process.env.ENABLE_DEBUG_LOGS === 'true' ? (parseFloat(process.env.VERBOSE_LOG_SAMPLING) || 0.05) : 0
    }
});

// Define log levels for backward compatibility
const logLevels = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
    verbose: 4
};

// Define log colors
const logColors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    debug: 'blue',
    verbose: 'cyan'
};

// Add colors to winston
winston.addColors(logColors);

// Custom JSON replacer to handle circular references and filter out problematic objects
const jsonReplacer = (key, value) => {
    // Skip circular references
    if (typeof value === 'object' && value !== null) {
        // Skip database connection objects to prevent circular references
        if (value.constructor && (
            value.constructor.name === 'Pool' ||
            value.constructor.name === 'PoolConfig' ||
            value.constructor.name === 'ConnectionConfig' ||
            value.constructor.name === 'Connection' ||
            key === 'dbConnection' ||
            key === 'con' ||
            key === 'pool'
        )) {
            return '[Database Connection Object]';
        }
        
        // Skip other problematic objects
        if (value.constructor && value.constructor.name === 'Client') {
            return '[Elasticsearch Client]';
        }
        
        // Skip functions
        if (typeof value === 'function') {
            return '[Function]';
        }
        
        // Skip if object has circular reference indicators
        if (value.hasOwnProperty && value.hasOwnProperty('pool') && value.pool === value) {
            return '[Circular Reference]';
        }
    }
    
    return value;
};

// Custom format for files
const customFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
        
        // Add metadata if present
        if (Object.keys(meta).length > 0) {
            try {
                logMessage += ` ${JSON.stringify(meta, jsonReplacer)}`;
            } catch (error) {
                logMessage += ` [metadata serialization error: ${error.message}]`;
            }
        }
        
        return logMessage;
    })
);

// Console format for development
const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({
        format: 'HH:mm:ss'
    }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let logMessage = `[${timestamp}] ${level}: ${message}`;
        
        // Add metadata if present (simplified for console)
        if (Object.keys(meta).length > 0) {
            try {
                const metaStr = JSON.stringify(meta, jsonReplacer, 2);
                if (metaStr.length < 200) {
                    logMessage += ` ${metaStr}`;
                } else {
                    logMessage += ` [metadata available]`;
                }
            } catch (error) {
                logMessage += ` [metadata serialization error: ${error.message}]`;
            }
        }
        
        return logMessage;
    })
);

// Use the enhanced logger's winston instance for backward compatibility
const logger = enhancedLogger.winston;

// Store enhanced logger globally for cleanup and access
global.logger = logger;
global.enhancedLogger = enhancedLogger;

// Create specialized loggers for different components (enhanced version)
const createComponentLogger = (component) => {
    return enhancedLogger.createComponentLogger(component);
};

// Performance logging utility (enhanced version)
const performanceLogger = {
    start: (operation, component = 'unknown') => {
        return enhancedLogger.startTimer(operation, component);
    }
};

// Database operation logger
const dbLogger = createComponentLogger('database');

// Crawler operation logger
const crawlerLogger = createComponentLogger('crawler');

// Parser operation logger
const parserLogger = createComponentLogger('parser');

// Indexer operation logger
const indexerLogger = createComponentLogger('indexer');

// HTTP request logger
const httpLogger = createComponentLogger('http');

// Security logger for security-related events
const securityLogger = createComponentLogger('security');

// Utility functions for structured logging
const logUtils = {
    // Log HTTP requests
    logRequest: (method, url, statusCode, duration, meta = {}) => {
        const level = statusCode >= 400 ? 'warn' : 'info';
        httpLogger[level](`${method} ${url} ${statusCode}`, {
            method,
            url,
            statusCode,
            duration: `${duration}ms`,
            ...meta
        });
    },
    
    // Log database operations
    logDbOperation: (operation, table, duration, meta = {}) => {
        dbLogger.info(`DB ${operation} on ${table}`, {
            operation,
            table,
            duration: `${duration}ms`,
            ...meta
        });
    },
    
    // Log crawling operations
    logCrawlOperation: (operation, url, meta = {}) => {
        crawlerLogger.info(`Crawl ${operation}`, {
            operation,
            url,
            ...meta
        });
    },
    
    // Log parsing operations
    logParseOperation: (contentType, url, meta = {}) => {
        parserLogger.info(`Parsed ${contentType}`, {
            contentType,
            url,
            ...meta
        });
    },
    
    // Log indexing operations
    logIndexOperation: (operation, documentId, meta = {}) => {
        indexerLogger.info(`Index ${operation}`, {
            operation,
            documentId,
            ...meta
        });
    },
    
    // Log security events
    logSecurityEvent: (event, severity = 'warn', meta = {}) => {
        securityLogger[severity](`Security: ${event}`, {
            event,
            severity,
            timestamp: new Date().toISOString(),
            ...meta
        });
    },
    
    // Log errors with context
    logError: (error, context = {}) => {
        logger.error(error.message || error, {
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack,
                code: error.code
            },
            context
        });
    },
    
    // Log with custom metadata
    logWithMeta: (level, message, meta = {}) => {
        logger[level](message, {
            timestamp: new Date().toISOString(),
            ...meta
        });
    }
};

// Stream for Morgan HTTP logging middleware
const morganStream = {
    write: (message) => {
        httpLogger.info(message.trim());
    }
};

// Enhanced log rotation utility with compression and memory leak prevention
const logRotation = {
    // Compress a file using gzip
    compressFile: async (filePath) => {
        try {
            const readStream = fs.createReadStream(filePath);
            const writeStream = fs.createWriteStream(`${filePath}.gz`);
            const gzip = zlib.createGzip({ level: 9 }); // Maximum compression
            
            await new Promise((resolve, reject) => {
                readStream.pipe(gzip).pipe(writeStream)
                    .on('finish', resolve)
                    .on('error', reject);
            });
            
            // Remove original file after compression
            fs.unlinkSync(filePath);
            return `${filePath}.gz`;
        } catch (error) {
            console.error(`Failed to compress file ${filePath}:`, error.message);
            return null;
        }
    },

    // Manually rotate logs with compression
    rotateLogs: async () => {
        const logFiles = ['error.log', 'combined.log', 'debug.log', 'exceptions.log', 'rejections.log'];
        
        for (const file of logFiles) {
            const filePath = path.join(LOG_DIR, file);
            if (fs.existsSync(filePath)) {
                const stats = fs.statSync(filePath);
                let maxSize;
                
                // Different size limits based on file type
                switch (file) {
                    case 'debug.log':
                        maxSize = 1 * 1024 * 1024; // 1MB
                        break;
                    case 'error.log':
                    case 'exceptions.log':
                    case 'rejections.log':
                        maxSize = 2 * 1024 * 1024; // 2MB
                        break;
                    default:
                        maxSize = 3 * 1024 * 1024; // 3MB
                }
                
                if (stats.size > maxSize) {
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
                    const archivePath = path.join(LOG_DIR, `${file}.${timestamp}`);
                    
                    try {
                        // Rename current file
                        fs.renameSync(filePath, archivePath);
                        
                        // Compress the archived file
                        const compressedPath = await logRotation.compressFile(archivePath);
                        
                        if (compressedPath) {
                            console.log(`✅ Log file rotated and compressed: ${file} -> ${path.basename(compressedPath)}`);
                        } else {
                            console.log(`✅ Log file rotated: ${file} -> ${path.basename(archivePath)}`);
                        }
                    } catch (error) {
                        console.error(`❌ Failed to rotate log file: ${file}`, error.message);
                    }
                }
            }
        }
    },
    
    // Clean old log files with improved memory efficiency
    cleanOldLogs: (daysToKeep = 7) => { // Reduced from 30 to 7 days for memory efficiency
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
        
        try {
            const files = fs.readdirSync(LOG_DIR);
            let cleanedCount = 0;
            
            files.forEach(file => {
                const filePath = path.join(LOG_DIR, file);
                
                try {
                    const stats = fs.statSync(filePath);
                    
                    // Clean old archived log files (with timestamp in name)
                    if (stats.mtime < cutoffDate && 
                        (file.includes('.log.') || file.endsWith('.log.gz'))) {
                        fs.unlinkSync(filePath);
                        cleanedCount++;
                    }
                } catch (error) {
                    // Skip files that can't be accessed
                    console.warn(`Skipping file ${file}: ${error.message}`);
                }
            });
            
            if (cleanedCount > 0) {
                console.log(`🧹 Cleaned ${cleanedCount} old log files`);
            }
        } catch (error) {
            console.error('❌ Failed to clean old log files:', error.message);
        }
    },

    // Get disk usage statistics for log directory
    getLogDiskUsage: () => {
        try {
            const files = fs.readdirSync(LOG_DIR);
            let totalSize = 0;
            let fileCount = 0;
            
            files.forEach(file => {
                try {
                    const filePath = path.join(LOG_DIR, file);
                    const stats = fs.statSync(filePath);
                    if (stats.isFile()) {
                        totalSize += stats.size;
                        fileCount++;
                    }
                } catch (error) {
                    // Skip inaccessible files
                }
            });
            
            return {
                totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
                fileCount: fileCount,
                directory: LOG_DIR
            };
        } catch (error) {
            return {
                error: error.message,
                directory: LOG_DIR
            };
        }
    }
};

// Initialize log cleanup on startup with memory leak prevention
const initializeLogCleanup = () => {
    // Clean old logs on startup
    logRotation.cleanOldLogs();
    
    // Set up periodic log cleanup with proper memory management
    const cleanupInterval = setInterval(async () => {
        if (memoryMonitor.isShuttingDown) return;
        
        try {
            // Rotate logs first
            await logRotation.rotateLogs();
            
            // Then clean old logs
            logRotation.cleanOldLogs();
            
            // Log memory stats periodically
            const memStats = memoryMonitor.getMemoryStats();
            const diskStats = logRotation.getLogDiskUsage();
            
            console.log(`📊 Logger Stats - Memory: ${memStats.current.heapUsed}, Disk: ${diskStats.totalSizeMB}MB (${diskStats.fileCount} files)`);
        } catch (error) {
            console.error('❌ Error during log cleanup:', error.message);
        }
    }, 4 * 60 * 60 * 1000); // Every 4 hours (more frequent for better memory management)
    
    // Register cleanup interval for proper shutdown
    memoryMonitor.cleanupIntervals.add(cleanupInterval);
    
    // Also set up a more frequent rotation check for high-traffic scenarios
    const rotationCheckInterval = setInterval(async () => {
        if (memoryMonitor.isShuttingDown) return;
        
        try {
            await logRotation.rotateLogs();
        } catch (error) {
            console.error('❌ Error during log rotation check:', error.message);
        }
    }, 30 * 60 * 1000); // Every 30 minutes
    
    memoryMonitor.cleanupIntervals.add(rotationCheckInterval);
};

// Initialize in production and development for better log management
initializeLogCleanup();

// Enhanced logging features
const enhancedLogUtils = {
    // Original log utilities (preserved for backward compatibility)
    ...logUtils,
    
    // Enhanced search and aggregation features
    searchLogs: (query, options = {}) => enhancedLogger.searchLogs(query, options),
    getAggregatedLogs: (options = {}) => enhancedLogger.getAggregatedLogs(options),
    exportLogs: (format = 'json', options = {}) => enhancedLogger.exportLogs(format, options),
    
    // Performance monitoring
    getPerformanceStats: () => enhancedLogger.getPerformanceStats(),
    
    // Enhanced configuration
    configureLogger: (options) => enhancedLogger.configure(options),
    
    // Environment information
    getEnvironmentInfo: () => ({
        environment: enhancedLogger.options.environment,
        logLevel: enhancedLogger.options.logLevel,
        performanceMonitoring: enhancedLogger.options.enablePerformanceMonitoring,
        logAggregation: enhancedLogger.options.enableLogAggregation,
        logSearch: enhancedLogger.options.enableLogSearch,
        productionOptimizations: enhancedLogger.options.productionOptimizations
    }),
    
    // Advanced logging methods
    logWithTrace: (level, message, meta = {}) => {
        const trace = new Error().stack
            .split('\n')
            .slice(2, 5)
            .map(line => line.trim())
            .join(' -> ');
        enhancedLogger.log(level, message, { ...meta, trace });
    },
    
    logStructured: (level, operation, data, meta = {}) => {
        enhancedLogger.log(level, `Operation: ${operation}`, {
            operation,
            data,
            structured: true,
            ...meta
        });
    }
};

// Export the logger and utilities (enhanced version with backward compatibility)
module.exports = {
    // Core logger (maintains backward compatibility)
    logger,
    
    // Enhanced logger instance
    enhancedLogger,
    
    // Component logger creation
    createComponentLogger,
    
    // Performance utilities
    performanceLogger,
    
    // Pre-created component loggers
    dbLogger,
    crawlerLogger,
    parserLogger,
    indexerLogger,
    httpLogger,
    securityLogger,
    
    // Utilities (enhanced version)
    logUtils: enhancedLogUtils,
    
    // Stream for HTTP middleware
    morganStream,
    
    // Log management
    logRotation,
    memoryMonitor,
    
    // Directory info
    LOG_DIR,
    
    // Enhanced features
    searchLogs: enhancedLogUtils.searchLogs,
    getAggregatedLogs: enhancedLogUtils.getAggregatedLogs,
    exportLogs: enhancedLogUtils.exportLogs,
    getPerformanceStats: enhancedLogUtils.getPerformanceStats,
    configureLogger: enhancedLogUtils.configureLogger,
    getEnvironmentInfo: enhancedLogUtils.getEnvironmentInfo,
    
    // Advanced logging methods
    logWithTrace: enhancedLogUtils.logWithTrace,
    logStructured: enhancedLogUtils.logStructured,
    
    // Production optimization methods
    setLogLevel: (level) => {
        logger.level = level;
        enhancedLogger.configure({ logLevel: level });
        console.log(`📊 Log level changed to: ${level}`);
    },
    
    enableProductionMode: () => {
        enhancedLogger.configure({
            logLevel: 'warn',
            productionOptimizations: true,
            enablePerformanceMonitoring: true,
            logSampling: { debug: 0.01, verbose: 0.001 }
        });
        console.log('🚀 Production logging mode enabled');
    },
    
    enableDevelopmentMode: () => {
        enhancedLogger.configure({
            logLevel: 'debug',
            productionOptimizations: false,
            enablePerformanceMonitoring: true,
            logSampling: { debug: 1.0, verbose: 1.0 }
        });
        console.log('🔧 Development logging mode enabled');
    },
    
    // Graceful shutdown
    shutdown: () => {
        memoryMonitor.cleanup();
        enhancedLogger.shutdown();
    }
}; 