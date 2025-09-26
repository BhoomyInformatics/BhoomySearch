/**
 * Enhanced Error Handler for Crawler
 */

const { logger } = require('../utils/logger');

class ErrorHandler {
    constructor(userOptions = {}) {
        // Core counters
        this.errorCounts = new Map();
        this.siteErrorCounts = new Map();
        this.consecutiveErrors = 0;
        this.lastErrorReset = Date.now();

        // Thresholds and timing
        this.errorThresholds = {
            maxErrorsPerSite: 10,
            maxConsecutiveErrors: 5,
            errorResetInterval: 300000, // 5 minutes
            ...userOptions.errorThresholds
        };

        // Consolidated policy inspired by enhanced config
        this.policy = {
            http: {
                retryableCodes: [408, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524],
                nonRetryableCodes: [400, 401, 403, 404, 405, 406, 407, 409, 410, 411, 412, 413, 414, 415, 416, 417, 418, 421, 422, 423, 424, 426, 428, 431, 451],
                maxRetries: 3,
                retryDelay: 2000,
                backoffMultiplier: 1.5,
                rateLimitDelay: 5000,
                serverErrorDelay: 3000,
                clientErrorDelay: 1000,
                ...userOptions.http
            },
            network: {
                connectionErrors: ['ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND', 'EHOSTUNREACH', 'ETIMEDOUT'],
                sslErrors: ['CERT_HAS_EXPIRED', 'CERT_NOT_YET_VALID'],
                dnsErrors: ['ENOTFOUND', 'EHOSTUNREACH'],
                maxRetries: 2,
                retryDelay: 3000,
                backoffMultiplier: 2.0,
                ...userOptions.network
            },
            redirects: {
                maxRedirects: 5,
                loopDetection: true,
                maxLoopCount: 3,
                redirectCodes: [301, 302, 303, 307, 308],
                skipRedirectsFor: [404, 410, 451],
                ...userOptions.redirects
            },
            timeouts: {
                connect: 10000,
                socket: 30000,
                response: 45000,
                request: 60000,
                keepAlive: 30000,
                ...userOptions.timeouts
            },
            recovery: {
                circuitBreaker: { enabled: true, failureThreshold: 5, recoveryTimeout: 60000, halfOpenMaxRequests: 3 },
                exponentialBackoff: { enabled: true, initialDelay: 1000, maxDelay: 30000, multiplier: 2.0 },
                reportErrors: true,
                errorLogLevel: 'warn',
                ...userOptions.recovery
            }
        };
    }

    async handleError(error, context = {}) {
        const errorType = this.categorizeError(error);
        const errorKey = `${errorType}_${context.siteId || 'unknown'}`;

        this.trackError(errorKey, errorType, context);

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

        logger.error('Error occurred, continuing without retry', {
            service: 'ErrorHandler',
            errorType,
            error: error.message,
            context
        });

        return { shouldRetry: false, shouldStop: false };
    }

    categorizeError(error) {
        if (error.code === 'ER_LOCK_DEADLOCK') return 'DEADLOCK';
        if (error.code === 'ER_TABLEACCESS_DENIED_ERROR') return 'PERMISSION';
        if (typeof error.status === 'number') {
            if (this.policy.http.retryableCodes.includes(error.status)) return 'HTTP_RETRYABLE';
            if (this.policy.http.nonRetryableCodes.includes(error.status)) return 'HTTP_NON_RETRYABLE';
        }
        if (error.code && this.policy.network.connectionErrors.includes(error.code)) return 'CONNECTION_RESET';
        if (error.code && this.policy.network.dnsErrors.includes(error.code)) return 'DNS_ERROR';
        if (error.code && this.policy.network.sslErrors.includes(error.code)) return 'SSL_ERROR';
        if (error.message && error.message.includes('Cannot read properties of null')) return 'NULL_REFERENCE';
        if (error.message && error.message.includes('Input sanitization failed')) return 'SANITIZATION';
        if (error.message && error.message.includes('HTTP 404')) return 'NOT_FOUND';
        if (error.message && error.message.includes('HTTP 403')) return 'FORBIDDEN';
        if (error.message && error.message.includes('timeout')) return 'TIMEOUT';
        if (error.message && error.message.includes('ECONNRESET')) return 'CONNECTION_RESET';
        if (error.message && error.message.includes('ETIMEDOUT')) return 'CONNECTION_TIMEOUT';
        return 'UNKNOWN';
    }

    trackError(errorKey, errorType, context) {
        const currentCount = this.errorCounts.get(errorKey) || 0;
        this.errorCounts.set(errorKey, currentCount + 1);
        if (context.siteId) {
            const siteCount = this.siteErrorCounts.get(context.siteId) || 0;
            this.siteErrorCounts.set(context.siteId, siteCount + 1);
        }
        if (Date.now() - this.lastErrorReset > this.errorThresholds.errorResetInterval) {
            this.resetErrorCounts();
        }
    }

    shouldStopProcessing(errorType, context) {
        const errorKey = `${errorType}_${context.siteId || 'unknown'}`;
        const errorCount = this.errorCounts.get(errorKey) || 0;
        const siteErrorCount = this.siteErrorCounts.get(context.siteId) || 0;
        if (errorCount > this.errorThresholds.maxErrorsPerSite) return true;
        if (siteErrorCount > this.errorThresholds.maxErrorsPerSite) return true;
        if (this.consecutiveErrors > this.errorThresholds.maxConsecutiveErrors) return true;
        return false;
    }

    getRetryStrategy(errorType, context) {
        const http = this.policy.http;
        const net = this.policy.network;
        const strategies = {
            DEADLOCK: { shouldRetry: true, delay: 1000 + Math.random() * 2000, maxRetries: 3 },
            HTTP_RETRYABLE: { shouldRetry: true, delay: http.retryDelay * (1 + Math.random()), maxRetries: http.maxRetries },
            HTTP_NON_RETRYABLE: { shouldRetry: false, delay: 0, maxRetries: 0 },
            CONNECTION_RESET: { shouldRetry: true, delay: net.retryDelay * (1 + Math.random()), maxRetries: net.maxRetries },
            CONNECTION_TIMEOUT: { shouldRetry: true, delay: net.retryDelay * (1 + Math.random()), maxRetries: net.maxRetries },
            TIMEOUT: { shouldRetry: true, delay: 5000 + Math.random() * 5000, maxRetries: 1 },
            NOT_FOUND: { shouldRetry: false, delay: 0, maxRetries: 0 },
            FORBIDDEN: { shouldRetry: false, delay: 0, maxRetries: 0 },
            PERMISSION: { shouldRetry: false, delay: 0, maxRetries: 0 },
            NULL_REFERENCE: { shouldRetry: false, delay: 0, maxRetries: 0 },
            SANITIZATION: { shouldRetry: false, delay: 0, maxRetries: 0 },
            UNKNOWN: { shouldRetry: true, delay: 1000 + Math.random() * 1000, maxRetries: 1 }
        };
        return strategies[errorType] || strategies.UNKNOWN;
    }

    resetErrorCounts() {
        this.errorCounts.clear();
        this.siteErrorCounts.clear();
        this.consecutiveErrors = 0;
        this.lastErrorReset = Date.now();
        logger.info('Error counts reset', { service: 'ErrorHandler', resetTime: new Date().toISOString() });
    }

    getErrorStats() {
        return {
            totalErrors: Array.from(this.errorCounts.values()).reduce((a, b) => a + b, 0),
            errorTypes: Object.fromEntries(this.errorCounts),
            siteErrors: Object.fromEntries(this.siteErrorCounts),
            consecutiveErrors: this.consecutiveErrors,
            lastReset: this.lastErrorReset
        };
    }

    resetConsecutiveErrors() { this.consecutiveErrors = 0; }
    incrementConsecutiveErrors() { this.consecutiveErrors++; }
}

module.exports = { ErrorHandler };


