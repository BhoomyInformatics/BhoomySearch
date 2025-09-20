/**
 * Enhanced Error Handler for Crawler
 * Provides comprehensive error handling, retry logic, and recovery mechanisms
 */

const { logger } = require('./logger');

class ErrorHandler {
    constructor() {
        this.errorCounts = new Map();
        this.errorThresholds = {
            maxErrorsPerSite: 10,
            maxConsecutiveErrors: 5,
            errorResetInterval: 300000 // 5 minutes
        };
        this.siteErrorCounts = new Map();
        this.consecutiveErrors = 0;
        this.lastErrorReset = Date.now();
    }

    /**
     * Handle errors with appropriate retry logic and recovery
     */
    async handleError(error, context = {}) {
        const errorType = this.categorizeError(error);
        const errorKey = `${errorType}_${context.siteId || 'unknown'}`;
        
        // Track error counts
        this.trackError(errorKey, errorType, context);
        
        // Check if we should stop processing
        if (this.shouldStopProcessing(errorType, context)) {
            logger.error('Error threshold exceeded, stopping processing', {
                service: 'ErrorHandler',
                errorType,
                siteId: context.siteId,
                errorCount: this.errorCounts.get(errorKey) || 0,
                consecutiveErrors: this.consecutiveErrors
            });
            return { shouldRetry: false, shouldStop: true };
        }

        // Determine retry strategy
        const retryStrategy = this.getRetryStrategy(errorType, context);
        
        if (retryStrategy.shouldRetry) {
            logger.warn('Error occurred, will retry', {
                service: 'ErrorHandler',
                errorType,
                error: error.message,
                retryDelay: retryStrategy.delay,
                maxRetries: retryStrategy.maxRetries,
                context
            });
            
            return {
                shouldRetry: true,
                retryDelay: retryStrategy.delay,
                maxRetries: retryStrategy.maxRetries,
                shouldStop: false
            };
        }

        // Log error and continue
        logger.error('Error occurred, continuing without retry', {
            service: 'ErrorHandler',
            errorType,
            error: error.message,
            context
        });

        return { shouldRetry: false, shouldStop: false };
    }

    /**
     * Categorize error types for appropriate handling
     */
    categorizeError(error) {
        if (error.code === 'ER_LOCK_DEADLOCK') {
            return 'DEADLOCK';
        }
        if (error.code === 'ER_TABLEACCESS_DENIED_ERROR') {
            return 'PERMISSION';
        }
        if (error.message && error.message.includes('Cannot read properties of null')) {
            return 'NULL_REFERENCE';
        }
        if (error.message && error.message.includes('Input sanitization failed')) {
            return 'SANITIZATION';
        }
        if (error.message && error.message.includes('HTTP 404')) {
            return 'NOT_FOUND';
        }
        if (error.message && error.message.includes('HTTP 403')) {
            return 'FORBIDDEN';
        }
        if (error.message && error.message.includes('timeout')) {
            return 'TIMEOUT';
        }
        if (error.message && error.message.includes('ECONNRESET')) {
            return 'CONNECTION_RESET';
        }
        if (error.message && error.message.includes('ETIMEDOUT')) {
            return 'CONNECTION_TIMEOUT';
        }
        
        return 'UNKNOWN';
    }

    /**
     * Track error counts and patterns
     */
    trackError(errorKey, errorType, context) {
        const currentCount = this.errorCounts.get(errorKey) || 0;
        this.errorCounts.set(errorKey, currentCount + 1);
        
        if (context.siteId) {
            const siteCount = this.siteErrorCounts.get(context.siteId) || 0;
            this.siteErrorCounts.set(context.siteId, siteCount + 1);
        }
        
        // Reset error counts periodically
        if (Date.now() - this.lastErrorReset > this.errorThresholds.errorResetInterval) {
            this.resetErrorCounts();
        }
    }

    /**
     * Determine if processing should stop
     */
    shouldStopProcessing(errorType, context) {
        const errorKey = `${errorType}_${context.siteId || 'unknown'}`;
        const errorCount = this.errorCounts.get(errorKey) || 0;
        const siteErrorCount = this.siteErrorCounts.get(context.siteId) || 0;
        
        // Stop if too many errors of this type
        if (errorCount > this.errorThresholds.maxErrorsPerSite) {
            return true;
        }
        
        // Stop if too many errors for this site
        if (siteErrorCount > this.errorThresholds.maxErrorsPerSite) {
            return true;
        }
        
        // Stop if too many consecutive errors
        if (this.consecutiveErrors > this.errorThresholds.maxConsecutiveErrors) {
            return true;
        }
        
        return false;
    }

    /**
     * Get retry strategy based on error type
     */
    getRetryStrategy(errorType, context) {
        const strategies = {
            DEADLOCK: {
                shouldRetry: true,
                delay: 1000 + Math.random() * 2000, // 1-3 seconds with jitter
                maxRetries: 3
            },
            CONNECTION_RESET: {
                shouldRetry: true,
                delay: 2000 + Math.random() * 3000, // 2-5 seconds with jitter
                maxRetries: 2
            },
            CONNECTION_TIMEOUT: {
                shouldRetry: true,
                delay: 3000 + Math.random() * 2000, // 3-5 seconds with jitter
                maxRetries: 2
            },
            TIMEOUT: {
                shouldRetry: true,
                delay: 5000 + Math.random() * 5000, // 5-10 seconds with jitter
                maxRetries: 1
            },
            NOT_FOUND: {
                shouldRetry: false,
                delay: 0,
                maxRetries: 0
            },
            FORBIDDEN: {
                shouldRetry: false,
                delay: 0,
                maxRetries: 0
            },
            PERMISSION: {
                shouldRetry: false,
                delay: 0,
                maxRetries: 0
            },
            NULL_REFERENCE: {
                shouldRetry: false,
                delay: 0,
                maxRetries: 0
            },
            SANITIZATION: {
                shouldRetry: false,
                delay: 0,
                maxRetries: 0
            },
            UNKNOWN: {
                shouldRetry: true,
                delay: 1000 + Math.random() * 1000, // 1-2 seconds with jitter
                maxRetries: 1
            }
        };
        
        return strategies[errorType] || strategies.UNKNOWN;
    }

    /**
     * Reset error counts
     */
    resetErrorCounts() {
        this.errorCounts.clear();
        this.siteErrorCounts.clear();
        this.consecutiveErrors = 0;
        this.lastErrorReset = Date.now();
        
        logger.info('Error counts reset', {
            service: 'ErrorHandler',
            resetTime: new Date().toISOString()
        });
    }

    /**
     * Get error statistics
     */
    getErrorStats() {
        return {
            totalErrors: Array.from(this.errorCounts.values()).reduce((a, b) => a + b, 0),
            errorTypes: Object.fromEntries(this.errorCounts),
            siteErrors: Object.fromEntries(this.siteErrorCounts),
            consecutiveErrors: this.consecutiveErrors,
            lastReset: this.lastErrorReset
        };
    }

    /**
     * Reset consecutive error count (call on successful operation)
     */
    resetConsecutiveErrors() {
        this.consecutiveErrors = 0;
    }

    /**
     * Increment consecutive error count
     */
    incrementConsecutiveErrors() {
        this.consecutiveErrors++;
    }
}

module.exports = { ErrorHandler };
