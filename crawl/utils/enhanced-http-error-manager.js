/**
 * Enhanced HTTP Error Manager
 * 
 * Provides sophisticated error classification, retry strategies, circuit breaker patterns,
 * and comprehensive error reporting for HTTP requests.
 */

const { logger } = require('./logger');

class EnhancedHttpErrorManager {
    constructor(options = {}) {
        this.options = {
            maxRetries: options.maxRetries || 3,
            baseDelay: options.baseDelay || 1000,
            maxDelay: options.maxDelay || 30000,
            circuitBreakerThreshold: options.circuitBreakerThreshold || 5,
            circuitBreakerTimeout: options.circuitBreakerTimeout || 300000, // 5 minutes
            enableCircuitBreaker: options.enableCircuitBreaker !== false,
            enableRetryAfter: options.enableRetryAfter !== false,
            enableJitter: options.enableJitter !== false,
            trackErrorPatterns: options.trackErrorPatterns !== false,
            ...options
        };

        // Error classification maps
        this.errorCategories = {
            CLIENT_ERROR: '4xx',
            SERVER_ERROR: '5xx',
            NETWORK_ERROR: 'network',
            TIMEOUT_ERROR: 'timeout',
            DNS_ERROR: 'dns',
            CONNECTION_ERROR: 'connection',
            SSL_ERROR: 'ssl',
            RATE_LIMIT: 'rate_limit',
            AUTHENTICATION: 'auth',
            PERMANENT: 'permanent',
            TRANSIENT: 'transient'
        };

        // Circuit breaker state per domain
        this.circuitBreakers = new Map(); // domain -> { state, failures, lastFailure, nextRetry }
        
        // Error statistics and reporting
        this.errorStats = {
            totalErrors: 0,
            errorsByCategory: new Map(),
            errorsByDomain: new Map(),
            errorsByStatusCode: new Map(),
            retrySuccess: 0,
            retryFailures: 0,
            circuitBreakerTrips: 0,
            startTime: Date.now()
        };

        // Domain-specific error patterns
        this.domainErrorPatterns = new Map(); // domain -> error pattern analysis
        
        // Error recovery strategies
        this.recoveryStrategies = new Map([
            ['4xx', { retryable: false, backoff: 'none' }],
            ['5xx', { retryable: true, backoff: 'exponential' }],
            ['network', { retryable: true, backoff: 'exponential' }],
            ['timeout', { retryable: true, backoff: 'linear' }],
            ['dns', { retryable: false, backoff: 'none' }],
            ['connection', { retryable: true, backoff: 'exponential' }],
            ['ssl', { retryable: false, backoff: 'none' }],
            ['rate_limit', { retryable: true, backoff: 'exponential' }],
            ['auth', { retryable: false, backoff: 'none' }]
        ]);

        logger.info('Enhanced HTTP Error Manager initialized', {
            service: 'EnhancedHttpErrorManager',
            options: this.options,
            circuitBreakerEnabled: this.options.enableCircuitBreaker
        });
    }

    /**
     * Classify an error and determine appropriate handling strategy
     */
    classifyError(error, statusCode = null, url = null) {
        const classification = {
            category: this.errorCategories.TRANSIENT,
            subcategory: null,
            retryable: false,
            retryStrategy: 'none',
            suggestedDelay: 0,
            permanent: false,
            reason: 'Unknown error'
        };

        try {
            // HTTP Status Code Classification
            if (statusCode) {
                if (statusCode >= 400 && statusCode < 500) {
                    classification.category = this.errorCategories.CLIENT_ERROR;
                    classification.subcategory = `${statusCode}`;
                    classification.reason = `HTTP ${statusCode} Client Error`;
                    
                    // Specific 4xx handling
                    switch (statusCode) {
                        case 401:
                            classification.category = this.errorCategories.AUTHENTICATION;
                            classification.reason = 'Authentication required';
                            classification.permanent = true;
                            break;
                        case 403:
                            classification.reason = 'Access forbidden';
                            classification.permanent = true;
                            break;
                        case 404:
                            classification.reason = 'Resource not found';
                            classification.permanent = true;
                            break;
                        case 405:
                            classification.reason = 'Method not allowed';
                            classification.permanent = true;
                            break;
                        case 408:
                            classification.category = this.errorCategories.TIMEOUT_ERROR;
                            classification.retryable = true;
                            classification.retryStrategy = 'linear';
                            classification.reason = 'Request timeout';
                            break;
                        case 410:
                            classification.reason = 'Resource gone';
                            classification.permanent = true;
                            break;
                        case 429:
                            classification.category = this.errorCategories.RATE_LIMIT;
                            classification.retryable = true;
                            classification.retryStrategy = 'exponential';
                            classification.reason = 'Rate limit exceeded';
                            break;
                        default:
                            classification.retryable = statusCode === 400 ? false : true; // Don't retry bad requests
                    }
                } else if (statusCode >= 500 && statusCode < 600) {
                    classification.category = this.errorCategories.SERVER_ERROR;
                    classification.subcategory = `${statusCode}`;
                    classification.retryable = true;
                    classification.retryStrategy = 'exponential';
                    classification.reason = `HTTP ${statusCode} Server Error`;
                    
                    // Specific 5xx handling
                    switch (statusCode) {
                        case 502:
                            classification.reason = 'Bad gateway';
                            break;
                        case 503:
                            classification.reason = 'Service unavailable';
                            break;
                        case 504:
                            classification.category = this.errorCategories.TIMEOUT_ERROR;
                            classification.reason = 'Gateway timeout';
                            break;
                        default:
                            classification.reason = 'Internal server error';
                    }
                }
            }

            // Network/System Error Classification
            if (error && error.code) {
                switch (error.code) {
                    case 'ENOTFOUND':
                        classification.category = this.errorCategories.DNS_ERROR;
                        classification.reason = 'DNS resolution failed';
                        classification.permanent = true;
                        break;
                    case 'ECONNREFUSED':
                        classification.category = this.errorCategories.CONNECTION_ERROR;
                        classification.retryable = true;
                        classification.retryStrategy = 'exponential';
                        classification.reason = 'Connection refused';
                        break;
                    case 'ETIMEDOUT':
                    case 'ESOCKETTIMEDOUT':
                        classification.category = this.errorCategories.TIMEOUT_ERROR;
                        classification.retryable = true;
                        classification.retryStrategy = 'linear';
                        classification.reason = 'Request timeout';
                        break;
                    case 'ECONNRESET':
                        classification.category = this.errorCategories.CONNECTION_ERROR;
                        classification.retryable = true;
                        classification.retryStrategy = 'exponential';
                        classification.reason = 'Connection reset';
                        break;
                    case 'EHOSTUNREACH':
                        classification.category = this.errorCategories.NETWORK_ERROR;
                        classification.retryable = false;
                        classification.permanent = true;
                        classification.reason = 'Host unreachable';
                        break;
                    case 'EPROTO':
                    case 'CERT_CHAIN_TOO_LONG':
                    case 'UNABLE_TO_VERIFY_LEAF_SIGNATURE':
                        classification.category = this.errorCategories.SSL_ERROR;
                        classification.reason = 'SSL/TLS error';
                        classification.permanent = true;
                        break;
                    case 'EMFILE':
                    case 'ENFILE':
                        classification.category = this.errorCategories.NETWORK_ERROR;
                        classification.retryable = true;
                        classification.retryStrategy = 'exponential';
                        classification.reason = 'Too many open files';
                        classification.suggestedDelay = 5000; // Wait longer for file handle cleanup
                        break;
                    default:
                        classification.category = this.errorCategories.NETWORK_ERROR;
                        classification.retryable = true;
                        classification.reason = `Network error: ${error.code}`;
                }
            }

            // Message-based classification (fallback)
            if (error && error.message && !classification.category) {
                const message = error.message.toLowerCase();
                
                if (message.includes('timeout')) {
                    classification.category = this.errorCategories.TIMEOUT_ERROR;
                    classification.retryable = true;
                    classification.retryStrategy = 'linear';
                    classification.reason = 'Request timeout';
                } else if (message.includes('connection')) {
                    classification.category = this.errorCategories.CONNECTION_ERROR;
                    classification.retryable = true;
                    classification.retryStrategy = 'exponential';
                    classification.reason = 'Connection error';
                } else if (message.includes('rate limit') || message.includes('too many requests')) {
                    classification.category = this.errorCategories.RATE_LIMIT;
                    classification.retryable = true;
                    classification.retryStrategy = 'exponential';
                    classification.reason = 'Rate limit exceeded';
                }
            }

            // Apply recovery strategy
            const strategy = this.recoveryStrategies.get(classification.category);
            if (strategy) {
                classification.retryable = classification.retryable || strategy.retryable;
                if (classification.retryStrategy === 'none') {
                    classification.retryStrategy = strategy.backoff;
                }
            }

            // Calculate suggested delay
            if (classification.retryable && classification.suggestedDelay === 0) {
                classification.suggestedDelay = this.calculateDelay(1, classification.retryStrategy, error);
            }

        } catch (classificationError) {
            logger.warn('Error during error classification', {
                service: 'EnhancedHttpErrorManager',
                originalError: error ? error.message : 'Unknown',
                statusCode,
                classificationError: classificationError.message
            });
        }

        return classification;
    }

    /**
     * Calculate retry delay based on strategy
     */
    calculateDelay(attempt, strategy, error = null, retryAfterHeader = null) {
        let delay = 0;

        // Check for Retry-After header first
        if (this.options.enableRetryAfter && retryAfterHeader) {
            const retryAfter = parseInt(retryAfterHeader);
            if (!isNaN(retryAfter)) {
                delay = Math.min(retryAfter * 1000, this.options.maxDelay);
                logger.debug('Using Retry-After header for delay', {
                    service: 'EnhancedHttpErrorManager',
                    retryAfter: retryAfter,
                    delayMs: delay
                });
                return delay;
            }
        }

        switch (strategy) {
            case 'exponential':
                delay = Math.min(
                    this.options.baseDelay * Math.pow(2, attempt - 1),
                    this.options.maxDelay
                );
                break;
            case 'linear':
                delay = Math.min(
                    this.options.baseDelay * attempt,
                    this.options.maxDelay
                );
                break;
            case 'fixed':
                delay = this.options.baseDelay;
                break;
            case 'none':
            default:
                delay = 0;
                break;
        }

        // Add jitter to prevent thundering herd
        if (this.options.enableJitter && delay > 0) {
            const jitter = Math.random() * delay * 0.1; // 10% jitter
            delay += jitter;
        }

        return Math.min(delay, this.options.maxDelay);
    }

    /**
     * Check if request should be retried based on error classification
     */
    shouldRetry(error, statusCode, attempt, url, retryAfterHeader = null) {
        const classification = this.classifyError(error, statusCode, url);
        const domain = this.extractDomain(url);

        // Update error statistics
        this.updateErrorStats(classification, domain, statusCode);

        // Check circuit breaker
        if (this.options.enableCircuitBreaker && this.isCircuitBreakerOpen(domain)) {
            logger.debug('Circuit breaker open for domain', {
                service: 'EnhancedHttpErrorManager',
                domain,
                error: error ? error.message : 'Unknown',
                statusCode
            });
            return {
                shouldRetry: false,
                reason: 'Circuit breaker open',
                delay: 0,
                classification
            };
        }

        // Check retry limits
        if (attempt >= this.options.maxRetries) {
            logger.debug('Maximum retry attempts reached', {
                service: 'EnhancedHttpErrorManager',
                attempt,
                maxRetries: this.options.maxRetries,
                error: error ? error.message : 'Unknown',
                statusCode
            });
            return {
                shouldRetry: false,
                reason: 'Maximum retries exceeded',
                delay: 0,
                classification
            };
        }

        // Check if error is retryable
        if (!classification.retryable) {
            logger.debug('Error not retryable', {
                service: 'EnhancedHttpErrorManager',
                category: classification.category,
                reason: classification.reason,
                error: error ? error.message : 'Unknown',
                statusCode
            });
            return {
                shouldRetry: false,
                reason: classification.reason,
                delay: 0,
                classification
            };
        }

        // Calculate delay
        const delay = this.calculateDelay(attempt, classification.retryStrategy, error, retryAfterHeader);

        logger.debug('Retry recommended', {
            service: 'EnhancedHttpErrorManager',
            attempt,
            delay,
            strategy: classification.retryStrategy,
            category: classification.category,
            error: error ? error.message : 'Unknown',
            statusCode
        });

        return {
            shouldRetry: true,
            reason: 'Retryable error',
            delay,
            classification
        };
    }

    /**
     * Record successful retry
     */
    recordRetrySuccess(url) {
        this.errorStats.retrySuccess++;
        const domain = this.extractDomain(url);
        
        // Reset circuit breaker on success
        if (this.circuitBreakers.has(domain)) {
            const breaker = this.circuitBreakers.get(domain);
            breaker.failures = 0;
            breaker.state = 'closed';
            logger.debug('Circuit breaker reset after successful retry', {
                service: 'EnhancedHttpErrorManager',
                domain
            });
        }
    }

    /**
     * Record failed retry
     */
    recordRetryFailure(url, error, statusCode) {
        this.errorStats.retryFailures++;
        const domain = this.extractDomain(url);
        
        // Update circuit breaker
        if (this.options.enableCircuitBreaker) {
            this.updateCircuitBreaker(domain, error, statusCode);
        }
    }

    /**
     * Circuit breaker implementation
     */
    updateCircuitBreaker(domain, error, statusCode) {
        if (!this.circuitBreakers.has(domain)) {
            this.circuitBreakers.set(domain, {
                state: 'closed', // closed, open, half-open
                failures: 0,
                lastFailure: Date.now(),
                nextRetry: Date.now()
            });
        }

        const breaker = this.circuitBreakers.get(domain);
        breaker.failures++;
        breaker.lastFailure = Date.now();

        // Check if we should trip the circuit breaker
        if (breaker.failures >= this.options.circuitBreakerThreshold && breaker.state === 'closed') {
            breaker.state = 'open';
            breaker.nextRetry = Date.now() + this.options.circuitBreakerTimeout;
            this.errorStats.circuitBreakerTrips++;
            
            logger.warn('Circuit breaker tripped for domain', {
                service: 'EnhancedHttpErrorManager',
                domain,
                failures: breaker.failures,
                threshold: this.options.circuitBreakerThreshold,
                timeoutMs: this.options.circuitBreakerTimeout
            });
        }
    }

    /**
     * Check if circuit breaker is open for domain
     */
    isCircuitBreakerOpen(domain) {
        const breaker = this.circuitBreakers.get(domain);
        if (!breaker) return false;

        const now = Date.now();
        
        if (breaker.state === 'open') {
            if (now >= breaker.nextRetry) {
                // Transition to half-open
                breaker.state = 'half-open';
                logger.debug('Circuit breaker transitioning to half-open', {
                    service: 'EnhancedHttpErrorManager',
                    domain
                });
                return false;
            }
            return true;
        }

        return false;
    }

    /**
     * Update error statistics
     */
    updateErrorStats(classification, domain, statusCode) {
        this.errorStats.totalErrors++;

        // Update category stats
        const category = classification.category;
        this.errorStats.errorsByCategory.set(category, 
            (this.errorStats.errorsByCategory.get(category) || 0) + 1);

        // Update domain stats
        if (domain) {
            this.errorStats.errorsByDomain.set(domain,
                (this.errorStats.errorsByDomain.get(domain) || 0) + 1);
        }

        // Update status code stats
        if (statusCode) {
            this.errorStats.errorsByStatusCode.set(statusCode,
                (this.errorStats.errorsByStatusCode.get(statusCode) || 0) + 1);
        }

        // Track domain-specific error patterns
        if (this.options.trackErrorPatterns && domain) {
            this.trackDomainErrorPattern(domain, classification);
        }
    }

    /**
     * Track domain-specific error patterns
     */
    trackDomainErrorPattern(domain, classification) {
        if (!this.domainErrorPatterns.has(domain)) {
            this.domainErrorPatterns.set(domain, {
                errorCount: 0,
                errorTypes: new Map(),
                lastError: null,
                pattern: 'stable' // stable, degrading, failing
            });
        }

        const pattern = this.domainErrorPatterns.get(domain);
        pattern.errorCount++;
        pattern.lastError = Date.now();
        
        const errorType = classification.category;
        pattern.errorTypes.set(errorType, (pattern.errorTypes.get(errorType) || 0) + 1);

        // Analyze pattern
        if (pattern.errorCount > 10) {
            const recentErrorRate = pattern.errorCount / ((Date.now() - (pattern.lastError - 600000)) / 60000); // Errors per minute
            if (recentErrorRate > 5) {
                pattern.pattern = 'failing';
            } else if (recentErrorRate > 2) {
                pattern.pattern = 'degrading';
            } else {
                pattern.pattern = 'stable';
            }
        }
    }

    /**
     * Extract domain from URL
     */
    extractDomain(url) {
        try {
            if (!url) return null;
            const urlObj = new URL(url);
            return urlObj.hostname;
        } catch (error) {
            return null;
        }
    }

    /**
     * Get comprehensive error statistics
     */
    getErrorStats() {
        const runtime = Date.now() - this.errorStats.startTime;
        
        return {
            ...this.errorStats,
            runtime: `${runtime}ms`,
            errorRate: this.errorStats.totalErrors > 0 ? 
                ((this.errorStats.totalErrors / (runtime / 1000)) * 60).toFixed(2) + ' errors/min' : '0 errors/min',
            retrySuccessRate: this.errorStats.retrySuccess + this.errorStats.retryFailures > 0 ?
                ((this.errorStats.retrySuccess / (this.errorStats.retrySuccess + this.errorStats.retryFailures)) * 100).toFixed(1) + '%' : '0%',
            circuitBreakerStats: {
                openCircuits: Array.from(this.circuitBreakers.entries())
                    .filter(([domain, breaker]) => breaker.state === 'open')
                    .map(([domain, breaker]) => ({
                        domain,
                        failures: breaker.failures,
                        nextRetry: new Date(breaker.nextRetry).toISOString()
                    })),
                totalCircuits: this.circuitBreakers.size
            },
            domainPatterns: this.options.trackErrorPatterns ? 
                Object.fromEntries(
                    Array.from(this.domainErrorPatterns.entries())
                        .map(([domain, pattern]) => [domain, {
                            errorCount: pattern.errorCount,
                            pattern: pattern.pattern,
                            lastError: pattern.lastError ? new Date(pattern.lastError).toISOString() : null
                        }])
                ) : {}
        };
    }

    /**
     * Get domain-specific error report
     */
    getDomainErrorReport(domain) {
        const circuitBreaker = this.circuitBreakers.get(domain);
        const errorPattern = this.domainErrorPatterns.get(domain);
        const errorCount = this.errorStats.errorsByDomain.get(domain) || 0;

        return {
            domain,
            totalErrors: errorCount,
            circuitBreaker: circuitBreaker ? {
                state: circuitBreaker.state,
                failures: circuitBreaker.failures,
                lastFailure: new Date(circuitBreaker.lastFailure).toISOString(),
                nextRetry: circuitBreaker.state === 'open' ? new Date(circuitBreaker.nextRetry).toISOString() : null
            } : null,
            errorPattern: errorPattern ? {
                pattern: errorPattern.pattern,
                errorCount: errorPattern.errorCount,
                errorTypes: Object.fromEntries(errorPattern.errorTypes),
                lastError: errorPattern.lastError ? new Date(errorPattern.lastError).toISOString() : null
            } : null,
            recommendation: this.generateDomainRecommendation(domain, circuitBreaker, errorPattern, errorCount)
        };
    }

    /**
     * Generate recommendation for domain
     */
    generateDomainRecommendation(domain, circuitBreaker, errorPattern, errorCount) {
        if (!domain) return 'No specific recommendations available';

        if (circuitBreaker && circuitBreaker.state === 'open') {
            return 'Domain is circuit broken - avoid requests until circuit resets';
        }

        if (errorPattern) {
            switch (errorPattern.pattern) {
                case 'failing':
                    return 'Domain showing high error rate - consider reducing request frequency';
                case 'degrading':
                    return 'Domain performance degrading - monitor closely';
                case 'stable':
                    return 'Domain error pattern is stable - normal operation';
            }
        }

        if (errorCount > 20) {
            return 'High error count for domain - investigate potential issues';
        }

        return 'No specific issues detected for this domain';
    }

    /**
     * Clear all circuit breakers (for testing or reset)
     */
    clearCircuitBreakers() {
        this.circuitBreakers.clear();
        logger.info('All circuit breakers cleared', {
            service: 'EnhancedHttpErrorManager'
        });
    }

    /**
     * Reset error statistics
     */
    resetStats() {
        this.errorStats = {
            totalErrors: 0,
            errorsByCategory: new Map(),
            errorsByDomain: new Map(),
            errorsByStatusCode: new Map(),
            retrySuccess: 0,
            retryFailures: 0,
            circuitBreakerTrips: 0,
            startTime: Date.now()
        };
        this.domainErrorPatterns.clear();
        logger.info('Error statistics reset', {
            service: 'EnhancedHttpErrorManager'
        });
    }
}

module.exports = { EnhancedHttpErrorManager };
