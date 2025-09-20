/**
 * Circuit Breaker Pattern Implementation
 * 
 * Provides circuit breaker functionality to prevent cascading failures
 * and protect against problematic domains/services.
 */

const { logger } = require('./logger');

class CircuitBreaker {
    constructor(name, options = {}) {
        this.name = name;
        this.options = {
            failureThreshold: options.failureThreshold || 5,     // Number of failures before opening
            successThreshold: options.successThreshold || 2,     // Number of successes to close circuit
            timeout: options.timeout || 60000,                   // Time before trying half-open (ms)
            monitor: options.monitor !== false,                  // Enable monitoring
            onStateChange: options.onStateChange || null,        // Callback for state changes
            onFailure: options.onFailure || null,               // Callback for failures
            onSuccess: options.onSuccess || null,               // Callback for successes
            ...options
        };

        // Circuit breaker states
        this.states = {
            CLOSED: 'closed',       // Normal operation
            OPEN: 'open',          // Circuit is open, requests fail fast
            HALF_OPEN: 'half_open' // Testing if service recovered
        };

        // Current state
        this.state = this.states.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        this.lastFailureTime = null;
        this.nextAttempt = null;

        // Statistics
        this.stats = {
            totalRequests: 0,
            totalFailures: 0,
            totalSuccesses: 0,
            circuitOpenings: 0,
            circuitClosings: 0,
            lastStateChange: Date.now(),
            uptime: Date.now()
        };

        logger.info('Circuit breaker initialized', {
            service: 'CircuitBreaker',
            name: this.name,
            options: this.options
        });
    }

    /**
     * Execute a function with circuit breaker protection
     */
    async execute(fn, fallback = null) {
        this.stats.totalRequests++;

        // Check if circuit is open
        if (this.state === this.states.OPEN) {
            if (this.canAttemptReset()) {
                this.setState(this.states.HALF_OPEN);
            } else {
                logger.debug('Circuit breaker open, failing fast', {
                    service: 'CircuitBreaker',
                    name: this.name,
                    state: this.state,
                    nextAttempt: this.nextAttempt
                });
                
                if (fallback && typeof fallback === 'function') {
                    return await fallback();
                }
                
                throw new Error(`Circuit breaker is open for ${this.name}`);
            }
        }

        try {
            const result = await fn();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure(error);
            throw error;
        }
    }

    /**
     * Handle successful execution
     */
    onSuccess() {
        this.stats.totalSuccesses++;
        
        if (this.state === this.states.HALF_OPEN) {
            this.successCount++;
            
            if (this.successCount >= this.options.successThreshold) {
                this.setState(this.states.CLOSED);
                this.reset();
                logger.info('Circuit breaker closed after successful recovery', {
                    service: 'CircuitBreaker',
                    name: this.name,
                    successCount: this.successCount
                });
            }
        } else if (this.state === this.states.CLOSED) {
            // Reset failure count on success
            this.failureCount = 0;
        }

        if (this.options.onSuccess) {
            this.options.onSuccess(this.name, this.state);
        }
    }

    /**
     * Handle failed execution
     */
    onFailure(error) {
        this.stats.totalFailures++;
        this.failureCount++;
        this.lastFailureTime = Date.now();

        logger.debug('Circuit breaker recorded failure', {
            service: 'CircuitBreaker',
            name: this.name,
            failureCount: this.failureCount,
            threshold: this.options.failureThreshold,
            error: error.message
        });

        if (this.state === this.states.HALF_OPEN) {
            // If we're testing and fail, immediately open circuit
            this.setState(this.states.OPEN);
            this.nextAttempt = Date.now() + this.options.timeout;
        } else if (this.state === this.states.CLOSED && this.failureCount >= this.options.failureThreshold) {
            // Open circuit if failure threshold reached
            this.setState(this.states.OPEN);
            this.nextAttempt = Date.now() + this.options.timeout;
            this.stats.circuitOpenings++;
            
            logger.warn('Circuit breaker opened due to failure threshold', {
                service: 'CircuitBreaker',
                name: this.name,
                failureCount: this.failureCount,
                threshold: this.options.failureThreshold,
                timeout: this.options.timeout
            });
        }

        if (this.options.onFailure) {
            this.options.onFailure(this.name, this.state, error);
        }
    }

    /**
     * Check if we can attempt to reset the circuit
     */
    canAttemptReset() {
        return this.state === this.states.OPEN && 
               this.nextAttempt && 
               Date.now() >= this.nextAttempt;
    }

    /**
     * Set circuit breaker state
     */
    setState(newState) {
        if (newState !== this.state) {
            const oldState = this.state;
            this.state = newState;
            this.stats.lastStateChange = Date.now();

            logger.info('Circuit breaker state changed', {
                service: 'CircuitBreaker',
                name: this.name,
                oldState,
                newState,
                failureCount: this.failureCount,
                successCount: this.successCount
            });

            if (newState === this.states.CLOSED) {
                this.stats.circuitClosings++;
            }

            if (this.options.onStateChange) {
                this.options.onStateChange(this.name, oldState, newState);
            }
        }
    }

    /**
     * Reset circuit breaker to initial state
     */
    reset() {
        this.failureCount = 0;
        this.successCount = 0;
        this.lastFailureTime = null;
        this.nextAttempt = null;
        this.setState(this.states.CLOSED);
        
        logger.info('Circuit breaker reset', {
            service: 'CircuitBreaker',
            name: this.name
        });
    }

    /**
     * Force open the circuit
     */
    forceOpen() {
        this.setState(this.states.OPEN);
        this.nextAttempt = Date.now() + this.options.timeout;
        
        logger.warn('Circuit breaker forced open', {
            service: 'CircuitBreaker',
            name: this.name
        });
    }

    /**
     * Force close the circuit
     */
    forceClose() {
        this.reset();
        
        logger.info('Circuit breaker forced closed', {
            service: 'CircuitBreaker',
            name: this.name
        });
    }

    /**
     * Get current status
     */
    getStatus() {
        return {
            name: this.name,
            state: this.state,
            failureCount: this.failureCount,
            successCount: this.successCount,
            lastFailureTime: this.lastFailureTime ? new Date(this.lastFailureTime).toISOString() : null,
            nextAttempt: this.nextAttempt ? new Date(this.nextAttempt).toISOString() : null,
            canAttemptReset: this.canAttemptReset(),
            options: this.options,
            stats: {
                ...this.stats,
                uptime: Date.now() - this.stats.uptime,
                failureRate: this.stats.totalRequests > 0 ? 
                    ((this.stats.totalFailures / this.stats.totalRequests) * 100).toFixed(2) + '%' : '0%',
                successRate: this.stats.totalRequests > 0 ? 
                    ((this.stats.totalSuccesses / this.stats.totalRequests) * 100).toFixed(2) + '%' : '0%'
            }
        };
    }

    /**
     * Check if circuit is open
     */
    isOpen() {
        return this.state === this.states.OPEN;
    }

    /**
     * Check if circuit is closed
     */
    isClosed() {
        return this.state === this.states.CLOSED;
    }

    /**
     * Check if circuit is half-open
     */
    isHalfOpen() {
        return this.state === this.states.HALF_OPEN;
    }
}

/**
 * Circuit Breaker Manager
 * Manages multiple circuit breakers by name/domain
 */
class CircuitBreakerManager {
    constructor(defaultOptions = {}) {
        this.breakers = new Map();
        this.defaultOptions = {
            failureThreshold: 5,
            successThreshold: 2,
            timeout: 300000, // 5 minutes
            monitor: true,
            ...defaultOptions
        };

        this.stats = {
            totalBreakers: 0,
            activeBreakers: 0,
            openBreakers: 0,
            createdAt: Date.now()
        };

        logger.info('Circuit Breaker Manager initialized', {
            service: 'CircuitBreakerManager',
            defaultOptions: this.defaultOptions
        });
    }

    /**
     * Get or create circuit breaker for a name/domain
     */
    getBreaker(name, options = {}) {
        if (!this.breakers.has(name)) {
            const breakerOptions = { ...this.defaultOptions, ...options };
            const breaker = new CircuitBreaker(name, breakerOptions);
            this.breakers.set(name, breaker);
            this.stats.totalBreakers++;
            this.stats.activeBreakers++;
            
            logger.debug('Created new circuit breaker', {
                service: 'CircuitBreakerManager',
                name,
                totalBreakers: this.stats.totalBreakers
            });
        }

        return this.breakers.get(name);
    }

    /**
     * Execute function with circuit breaker protection
     */
    async execute(name, fn, fallback = null, options = {}) {
        const breaker = this.getBreaker(name, options);
        return await breaker.execute(fn, fallback);
    }

    /**
     * Remove circuit breaker
     */
    removeBreaker(name) {
        if (this.breakers.has(name)) {
            this.breakers.delete(name);
            this.stats.activeBreakers--;
            
            logger.info('Circuit breaker removed', {
                service: 'CircuitBreakerManager',
                name,
                activeBreakers: this.stats.activeBreakers
            });
        }
    }

    /**
     * Get all breaker statuses
     */
    getAllStatuses() {
        const statuses = [];
        this.stats.openBreakers = 0;

        for (const [name, breaker] of this.breakers) {
            const status = breaker.getStatus();
            statuses.push(status);
            
            if (breaker.isOpen()) {
                this.stats.openBreakers++;
            }
        }

        return {
            breakers: statuses,
            summary: {
                ...this.stats,
                openBreakers: this.stats.openBreakers,
                closedBreakers: this.stats.activeBreakers - this.stats.openBreakers
            }
        };
    }

    /**
     * Get breaker status by name
     */
    getStatus(name) {
        const breaker = this.breakers.get(name);
        return breaker ? breaker.getStatus() : null;
    }

    /**
     * Reset all circuit breakers
     */
    resetAll() {
        for (const breaker of this.breakers.values()) {
            breaker.reset();
        }
        
        logger.info('All circuit breakers reset', {
            service: 'CircuitBreakerManager',
            count: this.breakers.size
        });
    }

    /**
     * Remove all circuit breakers
     */
    clearAll() {
        this.breakers.clear();
        this.stats.activeBreakers = 0;
        this.stats.openBreakers = 0;
        
        logger.info('All circuit breakers cleared', {
            service: 'CircuitBreakerManager'
        });
    }

    /**
     * Get circuit breaker health summary
     */
    getHealthSummary() {
        const statuses = this.getAllStatuses();
        const breakers = statuses.breakers;
        
        const healthy = breakers.filter(b => b.state === 'closed').length;
        const unhealthy = breakers.filter(b => b.state === 'open').length;
        const recovering = breakers.filter(b => b.state === 'half_open').length;
        
        return {
            total: breakers.length,
            healthy,
            unhealthy,
            recovering,
            healthPercentage: breakers.length > 0 ? 
                ((healthy / breakers.length) * 100).toFixed(1) + '%' : '100%',
            status: unhealthy === 0 ? 'healthy' : unhealthy < healthy ? 'degraded' : 'critical'
        };
    }
}

module.exports = { CircuitBreaker, CircuitBreakerManager };
