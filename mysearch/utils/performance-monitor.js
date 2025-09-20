/**
 * Performance Monitoring Utility
 * Tracks and reports performance metrics for search operations
 */

const winston = require('winston');

class PerformanceMonitor {
    constructor() {
        this.metrics = new Map();
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.File({ filename: 'logs/performance.log' }),
                new winston.transports.Console({
                    format: winston.format.simple()
                })
            ]
        });
    }

    /**
     * Start timing an operation
     */
    startTimer(operationId, metadata = {}) {
        const startTime = process.hrtime.bigint();
        this.metrics.set(operationId, {
            startTime,
            metadata,
            status: 'running'
        });
        
        this.logger.info('Operation started', {
            operationId,
            metadata,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * End timing an operation
     */
    endTimer(operationId, result = {}) {
        const metric = this.metrics.get(operationId);
        if (!metric) {
            this.logger.warn('Timer not found for operation', { operationId });
            return null;
        }

        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - metric.startTime) / 1000000; // Convert to milliseconds
        
        const performanceData = {
            operationId,
            duration,
            metadata: metric.metadata,
            result,
            timestamp: new Date().toISOString(),
            status: 'completed'
        };

        this.metrics.set(operationId, {
            ...metric,
            endTime,
            duration,
            result,
            status: 'completed'
        });

        this.logger.info('Operation completed', performanceData);
        
        // Log performance warnings
        if (duration > 1000) {
            this.logger.warn('Slow operation detected', {
                operationId,
                duration,
                threshold: 1000
            });
        }

        return performanceData;
    }

    /**
     * Get performance statistics
     */
    getStats() {
        const completed = Array.from(this.metrics.values())
            .filter(m => m.status === 'completed');
        
        if (completed.length === 0) {
            return {
                totalOperations: 0,
                averageDuration: 0,
                slowOperations: 0,
                fastestOperation: 0,
                slowestOperation: 0
            };
        }

        const durations = completed.map(m => m.duration);
        const averageDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
        const slowOperations = durations.filter(d => d > 1000).length;
        const fastestOperation = Math.min(...durations);
        const slowestOperation = Math.max(...durations);

        return {
            totalOperations: completed.length,
            averageDuration: Math.round(averageDuration * 100) / 100,
            slowOperations,
            fastestOperation: Math.round(fastestOperation * 100) / 100,
            slowestOperation: Math.round(slowestOperation * 100) / 100,
            recentOperations: completed.slice(-10).map(m => ({
                operationId: m.operationId,
                duration: Math.round(m.duration * 100) / 100,
                metadata: m.metadata
            }))
        };
    }

    /**
     * Clear old metrics
     */
    clearOldMetrics(maxAge = 3600000) { // 1 hour default
        const now = Date.now();
        const cutoff = now - maxAge;
        
        for (const [operationId, metric] of this.metrics.entries()) {
            if (metric.timestamp && new Date(metric.timestamp).getTime() < cutoff) {
                this.metrics.delete(operationId);
            }
        }
    }

    /**
     * Monitor search performance
     */
    async monitorSearch(searchFunction, searchParams, operationId = null) {
        const id = operationId || `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        this.startTimer(id, {
            type: 'search',
            query: searchParams.q,
            page: searchParams.page,
            filters: searchParams.filters
        });

        try {
            const result = await searchFunction(searchParams);
            
            this.endTimer(id, {
                success: result.success,
                resultCount: result.results?.length || 0,
                totalResults: result.total || 0,
                cached: result.cached || false
            });

            return result;
        } catch (error) {
            this.endTimer(id, {
                success: false,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Monitor API performance
     */
    monitorAPI(req, res, next) {
        const operationId = `api_${req.method}_${req.path}_${Date.now()}`;
        
        this.startTimer(operationId, {
            type: 'api',
            method: req.method,
            path: req.path,
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });

        res.on('finish', () => {
            this.endTimer(operationId, {
                statusCode: res.statusCode,
                contentLength: res.get('Content-Length')
            });
        });

        next();
    }

    /**
     * Get health report
     */
    getHealthReport() {
        const stats = this.getStats();
        const runningOperations = Array.from(this.metrics.values())
            .filter(m => m.status === 'running').length;

        return {
            status: stats.averageDuration < 500 ? 'healthy' : 'degraded',
            performance: stats,
            runningOperations,
            timestamp: new Date().toISOString()
        };
    }
}

// Create singleton instance
const performanceMonitor = new PerformanceMonitor();

// Clean up old metrics every hour
setInterval(() => {
    performanceMonitor.clearOldMetrics();
}, 3600000);

module.exports = performanceMonitor;
