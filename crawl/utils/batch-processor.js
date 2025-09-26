/**
 * Advanced Batch Processing Utility
 * Handles promise rejections, retries, and monitoring for robust batch operations
 */

const { logger } = require('./logger');

class BatchProcessor {
    constructor(options = {}) {
        this.maxRetries = options.maxRetries || 3;
        this.retryDelay = options.retryDelay || 1000; // 1 second
        this.timeoutMs = options.timeoutMs || 30000; // 30 seconds
        this.concurrencyLimit = options.concurrencyLimit || 50;
        this.enableMonitoring = options.enableMonitoring !== false;
        
        // Batch statistics
        this.stats = {
            totalBatches: 0,
            successfulBatches: 0,
            failedBatches: 0,
            totalItems: 0,
            successfulItems: 0,
            failedItems: 0,
            retriedItems: 0,
            startTime: null,
            endTime: null
        };
        
        this.resetStats();
    }

    /**
     * Reset batch processing statistics
     */
    resetStats() {
        Object.assign(this.stats, {
            totalBatches: 0,
            successfulBatches: 0,
            failedBatches: 0,
            totalItems: 0,
            successfulItems: 0,
            failedItems: 0,
            retriedItems: 0,
            startTime: Date.now(),
            endTime: null
        });
    }

    /**
     * Process a batch of operations with advanced error handling
     */
    async processBatch(operations, context = {}) {
        const batchId = this.generateBatchId();
        const startTime = Date.now();
        
        if (!Array.isArray(operations) || operations.length === 0) {
            logger.warn('Empty or invalid operations array provided to batch processor', { 
                batchId, 
                context 
            });
            return { success: true, results: [], errors: [], stats: this.getStats() };
        }

        this.stats.totalBatches++;
        this.stats.totalItems += operations.length;

        logger.info('Starting batch processing', {
            batchId,
            operationCount: operations.length,
            context,
            maxRetries: this.maxRetries,
            timeout: this.timeoutMs
        });

        try {
            // Create promises with timeout and error handling
            const batchPromises = operations.map((operation, index) => 
                this.createRobustPromise(operation, index, batchId, context)
            );

            // Use Promise.all since our promises are wrapped to never reject
            // This effectively gives us the behavior of Promise.allSettled
            const results = await Promise.all(batchPromises);
            
            // Process results and handle failures
            const processedResults = await this.processResults(results, operations, batchId, context);
            
            const duration = Date.now() - startTime;
            this.logBatchCompletion(batchId, processedResults, duration, context);
            
            return processedResults;

        } catch (error) {
            this.stats.failedBatches++;
            const duration = Date.now() - startTime;
            
            logger.error('Batch processing failed catastrophically', {
                batchId,
                error: error.message,
                duration: `${duration}ms`,
                context,
                stack: error.stack
            });

            return {
                success: false,
                results: [],
                errors: [{ error: error.message, index: -1, operation: 'batch_processor' }],
                stats: this.getStats()
            };
        }
    }

    /**
     * Create a robust promise with timeout and error handling
     */
    createRobustPromise(operation, index, batchId, context) {
        const operationId = `${batchId}-${index}`;
        
        // Return a promise that always resolves but indicates success/failure in the result
        return new Promise(async (resolve) => {
            try {
                // Validate operation
                if (!operation || typeof operation.execute !== 'function') {
                    throw new Error('Invalid operation: must have execute function');
                }

                // Set up timeout
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => {
                        reject(new Error(`Operation timeout after ${this.timeoutMs}ms`));
                    }, this.timeoutMs);
                });

                // Execute operation with timeout
                const result = await Promise.race([
                    this.executeWithRetry(operation, operationId, context),
                    timeoutPromise
                ]);

                this.stats.successfulItems++;
                resolve({ 
                    status: 'fulfilled', 
                    value: result, 
                    index, 
                    operationId,
                    operationType: operation.type || 'unknown'
                });

            } catch (error) {
                this.stats.failedItems++;
                
                logger.debug('Operation failed in batch', {
                    operationId,
                    batchId,
                    index,
                    error: error.message,
                    operationType: operation.type || 'unknown'
                });

                resolve({ 
                    status: 'rejected', 
                    reason: error, 
                    index, 
                    operationId,
                    operationType: operation.type || 'unknown'
                });
            }
        });
    }

    /**
     * Execute operation with retry mechanism
     */
    async executeWithRetry(operation, operationId, context, attempt = 1) {
        try {
            const startTime = Date.now();
            const result = await operation.execute(context);
            const duration = Date.now() - startTime;

            logger.debug('Operation executed successfully', {
                operationId,
                attempt,
                duration: `${duration}ms`,
                operationType: operation.type || 'unknown'
            });

            return result;

        } catch (error) {
            const shouldRetry = this.shouldRetry(error, attempt);
            
            if (shouldRetry) {
                this.stats.retriedItems++;
                
                logger.warn('Operation failed, retrying', {
                    operationId,
                    attempt,
                    maxRetries: this.maxRetries,
                    error: error.message,
                    nextAttemptIn: `${this.retryDelay}ms`
                });

                // Wait before retry with exponential backoff
                const delay = this.retryDelay * Math.pow(2, attempt - 1);
                await this.sleep(delay);

                return this.executeWithRetry(operation, operationId, context, attempt + 1);
            } else {
                logger.error('Operation failed permanently', {
                    operationId,
                    attempt,
                    error: error.message,
                    operationType: operation.type || 'unknown'
                });
                throw error;
            }
        }
    }

    /**
     * Determine if operation should be retried
     */
    shouldRetry(error, attempt) {
        if (attempt >= this.maxRetries) {
            return false;
        }

        // Don't retry certain types of errors
        const nonRetryableErrors = [
            'validation error',
            'invalid input',
            'authentication failed',
            'permission denied',
            'not found'
        ];

        const errorMessage = error.message.toLowerCase();
        return !nonRetryableErrors.some(pattern => errorMessage.includes(pattern));
    }

    /**
     * Process results from batch processing
     */
    async processResults(results, operations, batchId, context) {
        const successfulResults = [];
        const errors = [];
        const failedOperations = [];

        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                successfulResults.push({
                    index,
                    result: result.value,
                    operationId: result.operationId,
                    operationType: result.operationType
                });
            } else {
                const error = {
                    index,
                    error: result.reason.message || 'Unknown error',
                    operationId: result.operationId || `${batchId}-${index}`,
                    operationType: result.operationType || 'unknown',
                    operation: operations[index]
                };
                
                errors.push(error);
                failedOperations.push(operations[index]);
            }
        });

        // Handle partial batch failure
        if (errors.length > 0) {
            this.stats.failedBatches++;
            
            logger.warn('Batch completed with errors', {
                batchId,
                totalOperations: operations.length,
                successful: successfulResults.length,
                failed: errors.length,
                context
            });

            // Optionally retry failed operations as a separate batch
            if (failedOperations.length > 0 && this.shouldRetryBatch(failedOperations, context)) {
                await this.retryFailedOperations(failedOperations, batchId, context);
            }
        } else {
            this.stats.successfulBatches++;
            
            logger.info('Batch completed successfully', {
                batchId,
                totalOperations: operations.length,
                context
            });
        }

        return {
            success: errors.length === 0,
            results: successfulResults,
            errors,
            stats: this.getStats(),
            batchId
        };
    }

    /**
     * Determine if failed operations should be retried as a batch
     */
    shouldRetryBatch(failedOperations, context) {
        // Don't retry if too many operations failed (likely systemic issue)
        if (failedOperations.length > this.concurrencyLimit) {
            return false;
        }

        // Don't retry if this is already a retry attempt
        if (context.isRetry) {
            return false;
        }

        return true;
    }

    /**
     * Retry failed operations as a separate batch
     */
    async retryFailedOperations(failedOperations, originalBatchId, context) {
        logger.info('Retrying failed operations as separate batch', {
            originalBatchId,
            failedCount: failedOperations.length,
            context
        });

        const retryContext = { ...context, isRetry: true, originalBatchId };
        
        try {
            const retryResults = await this.processBatch(failedOperations, retryContext);
            
            logger.info('Retry batch completed', {
                originalBatchId,
                retryResults: {
                    successful: retryResults.results.length,
                    failed: retryResults.errors.length
                }
            });

            return retryResults;
        } catch (error) {
            logger.error('Retry batch failed', {
                originalBatchId,
                error: error.message
            });
        }
    }

    /**
     * Log batch completion with detailed statistics
     */
    logBatchCompletion(batchId, results, duration, context) {
        const stats = {
            batchId,
            duration: `${duration}ms`,
            totalOperations: results.results.length + results.errors.length,
            successful: results.results.length,
            failed: results.errors.length,
            successRate: `${((results.results.length / (results.results.length + results.errors.length)) * 100).toFixed(1)}%`,
            context
        };

        if (results.success) {
            logger.info('Batch processing completed successfully', stats);
        } else {
            logger.warn('Batch processing completed with errors', {
                ...stats,
                errors: results.errors.map(e => ({
                    index: e.index,
                    type: e.operationType,
                    error: e.error
                }))
            });
        }
    }

    /**
     * Generate unique batch ID
     */
    generateBatchId() {
        return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Sleep utility for delays
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get current batch processing statistics
     */
    getStats() {
        const now = Date.now();
        const runtime = now - this.stats.startTime;
        
        return {
            ...this.stats,
            endTime: now,
            runtime: `${runtime}ms`,
            successRate: this.stats.totalItems > 0 ? 
                `${((this.stats.successfulItems / this.stats.totalItems) * 100).toFixed(1)}%` : '0%',
            itemsPerSecond: runtime > 0 ? 
                Math.round((this.stats.totalItems / runtime) * 1000) : 0
        };
    }

    /**
     * Get detailed performance report
     */
    getPerformanceReport() {
        const stats = this.getStats();
        
        return {
            summary: {
                totalBatches: stats.totalBatches,
                totalItems: stats.totalItems,
                successRate: stats.successRate,
                runtime: stats.runtime,
                itemsPerSecond: stats.itemsPerSecond
            },
            batches: {
                successful: stats.successfulBatches,
                failed: stats.failedBatches,
                batchSuccessRate: stats.totalBatches > 0 ? 
                    `${((stats.successfulBatches / stats.totalBatches) * 100).toFixed(1)}%` : '0%'
            },
            items: {
                successful: stats.successfulItems,
                failed: stats.failedItems,
                retried: stats.retriedItems,
                retryRate: stats.totalItems > 0 ? 
                    `${((stats.retriedItems / stats.totalItems) * 100).toFixed(1)}%` : '0%'
            },
            configuration: {
                maxRetries: this.maxRetries,
                retryDelay: this.retryDelay,
                timeout: this.timeoutMs,
                concurrencyLimit: this.concurrencyLimit
            }
        };
    }

    /**
     * Create a simple operation wrapper
     */
    static createOperation(type, executeFunction, data = {}) {
        return {
            type,
            execute: executeFunction,
            data
        };
    }
}

module.exports = { BatchProcessor };
