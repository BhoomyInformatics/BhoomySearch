const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Create logs directory if it doesn't exist
const LOG_DIR = path.join(__dirname, '../logs');
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Define log levels
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

// Create the logger
const logger = winston.createLogger({
    levels: logLevels,
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'warn' : 'info'),
    format: customFormat,
    defaultMeta: { service: 'crawler' },
    transports: [
        // Error log file
        new winston.transports.File({
            filename: path.join(LOG_DIR, 'error.log'),
            level: 'error',
            maxsize: 5 * 1024 * 1024, // Reduced to 5MB
            maxFiles: 3, // Reduced number of files
            tailable: true
        }),
        
        // Combined log file - Only for important messages
        new winston.transports.File({
            filename: path.join(LOG_DIR, 'combined.log'),
            level: 'info', // Changed from debug to info
            maxsize: 5 * 1024 * 1024, // Reduced to 5MB
            maxFiles: 3, // Reduced number of files
            tailable: true
        }),
        
        // Debug log file (only in development) - with stricter limits
        new winston.transports.File({
            filename: path.join(LOG_DIR, 'debug.log'),
            level: 'debug',
            maxsize: 2 * 1024 * 1024, // Reduced to 2MB
            maxFiles: 2, // Reduced to 2 files
            tailable: true,
            silent: process.env.NODE_ENV === 'production' // Disable debug logs in production
        })
    ],
    
    // Handle exceptions and rejections
    exceptionHandlers: [
        new winston.transports.File({
            filename: path.join(LOG_DIR, 'exceptions.log'),
            maxsize: 2 * 1024 * 1024, // Reduced size
            maxFiles: 2
        })
    ],
    
    rejectionHandlers: [
        new winston.transports.File({
            filename: path.join(LOG_DIR, 'rejections.log'),
            maxsize: 2 * 1024 * 1024, // Reduced size
            maxFiles: 2
        })
    ]
});

// Add console transport in development with limited verbosity
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: consoleFormat,
        level: 'info' // Changed from debug to info to reduce console noise
    }));
} else {
    // In production, only show warnings and errors on console
    logger.add(new winston.transports.Console({
        format: consoleFormat,
        level: 'warn'
    }));
}

// Create specialized loggers for different components
const createComponentLogger = (component) => {
    return {
        error: (message, meta = {}) => logger.error(message, { component, ...meta }),
        warn: (message, meta = {}) => logger.warn(message, { component, ...meta }),
        info: (message, meta = {}) => logger.info(message, { component, ...meta }),
        debug: (message, meta = {}) => logger.debug(message, { component, ...meta }),
        verbose: (message, meta = {}) => logger.verbose(message, { component, ...meta })
    };
};

// Performance logging utility
const performanceLogger = {
    start: (operation) => {
        const startTime = Date.now();
        return {
            end: (meta = {}) => {
                const duration = Date.now() - startTime;
                logger.info(`Performance: ${operation} completed`, {
                    operation,
                    duration: `${duration}ms`,
                    ...meta
                });
                return duration;
            }
        };
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

// Log rotation utility
const logRotation = {
    // Manually rotate logs
    rotateLogs: () => {
        const logFiles = ['error.log', 'combined.log', 'debug.log'];
        
        logFiles.forEach(file => {
            const filePath = path.join(LOG_DIR, file);
            if (fs.existsSync(filePath)) {
                const stats = fs.statSync(filePath);
                const maxSize = 10 * 1024 * 1024; // 10MB
                
                if (stats.size > maxSize) {
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                    const archivePath = path.join(LOG_DIR, `${file}.${timestamp}`);
                    
                    try {
                        fs.renameSync(filePath, archivePath);
                        logger.info(`Log file rotated: ${file} -> ${path.basename(archivePath)}`);
                    } catch (error) {
                        logger.error(`Failed to rotate log file: ${file}`, { error: error.message });
                    }
                }
            }
        });
    },
    
    // Clean old log files
    cleanOldLogs: (daysToKeep = 30) => {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
        
        try {
            const files = fs.readdirSync(LOG_DIR);
            
            files.forEach(file => {
                const filePath = path.join(LOG_DIR, file);
                const stats = fs.statSync(filePath);
                
                if (stats.mtime < cutoffDate && file.includes('.log.')) {
                    fs.unlinkSync(filePath);
                    logger.info(`Cleaned old log file: ${file}`);
                }
            });
        } catch (error) {
            logger.error('Failed to clean old log files', { error: error.message });
        }
    }
};

// Initialize log cleanup on startup
if (process.env.NODE_ENV === 'production') {
    // Clean old logs on startup
    logRotation.cleanOldLogs();
    
    // Set up periodic log cleanup (daily)
    setInterval(() => {
        logRotation.cleanOldLogs();
    }, 24 * 60 * 60 * 1000); // 24 hours
}

// Export the logger and utilities
module.exports = {
    logger,
    createComponentLogger,
    performanceLogger,
    dbLogger,
    crawlerLogger,
    parserLogger,
    indexerLogger,
    httpLogger,
    securityLogger,
    logUtils,
    morganStream,
    logRotation,
    LOG_DIR
}; 