/**
 * HTTP Error Reporter
 * 
 * Provides comprehensive error reporting, analysis, and monitoring
 * for HTTP requests in the crawling system.
 */

const fs = require('fs');
const path = require('path');
const { logger } = require('./logger');

class HttpErrorReporter {
    constructor(options = {}) {
        this.options = {
            enableFileReporting: options.enableFileReporting !== false,
            reportDirectory: options.reportDirectory || './reports/http-errors',
            maxReportSize: options.maxReportSize || 10000, // Max errors per report
            reportInterval: options.reportInterval || 3600000, // 1 hour
            enableRealTimeAlerts: options.enableRealTimeAlerts !== false,
            alertThresholds: {
                errorRate: options.errorRate || 0.1, // 10% error rate
                domainFailures: options.domainFailures || 10,
                circuitBreakerTrips: options.circuitBreakerTrips || 5,
                ...options.alertThresholds
            },
            ...options
        };

        // Error collection
        this.errorLog = [];
        this.errorSummary = {
            totalErrors: 0,
            errorsByType: new Map(),
            errorsByDomain: new Map(),
            errorsByStatusCode: new Map(),
            errorsByTime: new Map(), // Hour-based tracking
            startTime: Date.now(),
            lastError: null
        };

        // Alert state
        this.alertState = {
            lastAlert: new Map(),
            alertCooldown: 300000, // 5 minutes between similar alerts
            criticalAlerts: 0,
            warningAlerts: 0
        };

        // Performance tracking
        this.performanceMetrics = {
            responseTimesByDomain: new Map(),
            successRateByDomain: new Map(),
            retryRatesByError: new Map()
        };

        // Ensure report directory exists
        this.ensureReportDirectory();

        // Start periodic reporting
        if (this.options.enableFileReporting) {
            this.startPeriodicReporting();
        }

        logger.info('HTTP Error Reporter initialized', {
            service: 'HttpErrorReporter',
            options: this.options
        });
    }

    /**
     * Record an HTTP error
     */
    recordError(error, statusCode, url, attempt = 1, responseTime = null, additionalContext = {}) {
        const errorRecord = {
            timestamp: Date.now(),
            timestampISO: new Date().toISOString(),
            error: error ? {
                message: error.message,
                code: error.code,
                stack: error.stack
            } : null,
            statusCode,
            url,
            domain: this.extractDomain(url),
            attempt,
            responseTime,
            context: additionalContext
        };

        // Add to error log
        this.errorLog.push(errorRecord);
        
        // Trim log if too large
        if (this.errorLog.length > this.options.maxReportSize) {
            this.errorLog = this.errorLog.slice(-this.options.maxReportSize);
        }

        // Update summary statistics
        this.updateErrorSummary(errorRecord);

        // Check for real-time alerts
        if (this.options.enableRealTimeAlerts) {
            this.checkRealTimeAlerts(errorRecord);
        }

        logger.debug('HTTP error recorded', {
            service: 'HttpErrorReporter',
            domain: errorRecord.domain,
            statusCode,
            attempt,
            totalErrors: this.errorSummary.totalErrors
        });
    }

    /**
     * Record successful request for comparison
     */
    recordSuccess(url, responseTime, additionalContext = {}) {
        const domain = this.extractDomain(url);
        
        // Update performance metrics
        if (responseTime && domain) {
            if (!this.performanceMetrics.responseTimesByDomain.has(domain)) {
                this.performanceMetrics.responseTimesByDomain.set(domain, []);
            }
            this.performanceMetrics.responseTimesByDomain.get(domain).push(responseTime);
            
            // Keep only last 100 response times per domain
            const times = this.performanceMetrics.responseTimesByDomain.get(domain);
            if (times.length > 100) {
                times.splice(0, times.length - 100);
            }
        }

        // Update success rate
        if (domain) {
            if (!this.performanceMetrics.successRateByDomain.has(domain)) {
                this.performanceMetrics.successRateByDomain.set(domain, { success: 0, total: 0 });
            }
            const stats = this.performanceMetrics.successRateByDomain.get(domain);
            stats.success++;
            stats.total++;
        }
    }

    /**
     * Update error summary statistics
     */
    updateErrorSummary(errorRecord) {
        this.errorSummary.totalErrors++;
        this.errorSummary.lastError = errorRecord.timestamp;

        // Update by type (status code or error code)
        const errorType = errorRecord.statusCode || errorRecord.error?.code || 'unknown';
        this.errorSummary.errorsByType.set(errorType, 
            (this.errorSummary.errorsByType.get(errorType) || 0) + 1);

        // Update by domain
        if (errorRecord.domain) {
            this.errorSummary.errorsByDomain.set(errorRecord.domain,
                (this.errorSummary.errorsByDomain.get(errorRecord.domain) || 0) + 1);
            
            // Update domain failure rate
            if (!this.performanceMetrics.successRateByDomain.has(errorRecord.domain)) {
                this.performanceMetrics.successRateByDomain.set(errorRecord.domain, { success: 0, total: 0 });
            }
            const stats = this.performanceMetrics.successRateByDomain.get(errorRecord.domain);
            stats.total++;
        }

        // Update by status code
        if (errorRecord.statusCode) {
            this.errorSummary.errorsByStatusCode.set(errorRecord.statusCode,
                (this.errorSummary.errorsByStatusCode.get(errorRecord.statusCode) || 0) + 1);
        }

        // Update by hour for trend analysis
        const hour = new Date(errorRecord.timestamp).getHours();
        this.errorSummary.errorsByTime.set(hour,
            (this.errorSummary.errorsByTime.get(hour) || 0) + 1);
    }

    /**
     * Check for real-time alerts
     */
    checkRealTimeAlerts(errorRecord) {
        const now = Date.now();
        
        // Domain failure rate alert
        if (errorRecord.domain) {
            const domainErrors = this.errorSummary.errorsByDomain.get(errorRecord.domain) || 0;
            
            if (domainErrors >= this.options.alertThresholds.domainFailures) {
                this.sendAlert('WARNING', `High error count for domain ${errorRecord.domain}`, {
                    domain: errorRecord.domain,
                    errorCount: domainErrors,
                    threshold: this.options.alertThresholds.domainFailures
                });
            }
        }

        // Overall error rate alert
        const runtime = now - this.errorSummary.startTime;
        const runtimeHours = runtime / (1000 * 60 * 60);
        if (runtimeHours >= 0.1) { // At least 6 minutes of runtime
            const errorRate = this.errorSummary.totalErrors / runtimeHours;
            
            if (errorRate >= this.options.alertThresholds.errorRate * 100) { // Convert percentage to absolute
                this.sendAlert('WARNING', `High overall error rate detected`, {
                    errorRate: errorRate.toFixed(2) + ' errors/hour',
                    totalErrors: this.errorSummary.totalErrors,
                    runtime: runtimeHours.toFixed(2) + ' hours'
                });
            }
        }

        // Specific error pattern alerts
        if (errorRecord.statusCode) {
            this.checkStatusCodePatterns(errorRecord);
        }
    }

    /**
     * Check for specific status code patterns
     */
    checkStatusCodePatterns(errorRecord) {
        const statusCode = errorRecord.statusCode;
        const count = this.errorSummary.errorsByStatusCode.get(statusCode) || 0;

        // Alert thresholds for specific status codes
        const statusAlertThresholds = {
            429: 5,  // Rate limiting
            503: 10, // Service unavailable
            502: 10, // Bad gateway
            500: 15  // Internal server error
        };

        if (statusAlertThresholds[statusCode] && count >= statusAlertThresholds[statusCode]) {
            this.sendAlert('WARNING', `High frequency of HTTP ${statusCode} errors`, {
                statusCode,
                count,
                threshold: statusAlertThresholds[statusCode],
                domain: errorRecord.domain
            });
        }
    }

    /**
     * Send alert with cooldown mechanism
     */
    sendAlert(level, message, details = {}) {
        const alertKey = `${level}_${message}`;
        const now = Date.now();
        const lastAlert = this.alertState.lastAlert.get(alertKey) || 0;

        // Check cooldown
        if (now - lastAlert < this.alertState.alertCooldown) {
            return; // Skip alert due to cooldown
        }

        this.alertState.lastAlert.set(alertKey, now);

        if (level === 'CRITICAL') {
            this.alertState.criticalAlerts++;
        } else {
            this.alertState.warningAlerts++;
        }

        logger.warn(`HTTP Error Alert [${level}]: ${message}`, {
            service: 'HttpErrorReporter',
            level,
            message,
            details,
            alertCount: this.alertState.criticalAlerts + this.alertState.warningAlerts
        });

        // Here you could integrate with external alerting systems
        // e.g., Slack, email, PagerDuty, etc.
    }

    /**
     * Generate comprehensive error report
     */
    generateErrorReport() {
        const now = Date.now();
        const runtime = now - this.errorSummary.startTime;
        
        const report = {
            metadata: {
                generatedAt: new Date().toISOString(),
                runtime: runtime,
                runtimeFormatted: this.formatDuration(runtime),
                reportPeriod: {
                    start: new Date(this.errorSummary.startTime).toISOString(),
                    end: new Date().toISOString()
                }
            },
            summary: {
                totalErrors: this.errorSummary.totalErrors,
                errorRate: runtime > 0 ? (this.errorSummary.totalErrors / (runtime / 1000 / 60 / 60)).toFixed(2) + ' errors/hour' : '0 errors/hour',
                lastError: this.errorSummary.lastError ? new Date(this.errorSummary.lastError).toISOString() : null,
                alertsGenerated: {
                    critical: this.alertState.criticalAlerts,
                    warning: this.alertState.warningAlerts,
                    total: this.alertState.criticalAlerts + this.alertState.warningAlerts
                }
            },
            breakdown: {
                byErrorType: this.mapToObject(this.errorSummary.errorsByType),
                byDomain: this.mapToObject(this.errorSummary.errorsByDomain),
                byStatusCode: this.mapToObject(this.errorSummary.errorsByStatusCode),
                byHour: this.mapToObject(this.errorSummary.errorsByTime)
            },
            performance: this.generatePerformanceReport(),
            recommendations: this.generateRecommendations(),
            recentErrors: this.errorLog.slice(-50).map(error => ({
                timestamp: error.timestampISO,
                statusCode: error.statusCode,
                domain: error.domain,
                error: error.error?.message,
                attempt: error.attempt
            }))
        };

        return report;
    }

    /**
     * Generate performance analysis
     */
    generatePerformanceReport() {
        const performance = {
            domainAnalysis: [],
            overallMetrics: {
                avgResponseTime: 0,
                totalDomains: this.performanceMetrics.responseTimesByDomain.size,
                domainsWithErrors: this.errorSummary.errorsByDomain.size
            }
        };

        // Analyze each domain
        let totalResponseTimes = [];
        
        for (const [domain, responseTimes] of this.performanceMetrics.responseTimesByDomain) {
            if (responseTimes.length > 0) {
                const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
                const errorCount = this.errorSummary.errorsByDomain.get(domain) || 0;
                const successStats = this.performanceMetrics.successRateByDomain.get(domain) || { success: 0, total: 1 };
                const successRate = (successStats.success / successStats.total) * 100;

                performance.domainAnalysis.push({
                    domain,
                    avgResponseTime: Math.round(avgResponseTime),
                    errorCount,
                    successRate: successRate.toFixed(1) + '%',
                    totalRequests: successStats.total,
                    health: this.calculateDomainHealth(successRate, avgResponseTime, errorCount)
                });

                totalResponseTimes.push(...responseTimes);
            }
        }

        // Calculate overall metrics
        if (totalResponseTimes.length > 0) {
            performance.overallMetrics.avgResponseTime = Math.round(
                totalResponseTimes.reduce((sum, time) => sum + time, 0) / totalResponseTimes.length
            );
        }

        // Sort domains by health (worst first)
        performance.domainAnalysis.sort((a, b) => {
            const healthOrder = { poor: 0, fair: 1, good: 2, excellent: 3 };
            return healthOrder[a.health] - healthOrder[b.health];
        });

        return performance;
    }

    /**
     * Calculate domain health score
     */
    calculateDomainHealth(successRate, avgResponseTime, errorCount) {
        if (successRate < 70 || errorCount > 20) return 'poor';
        if (successRate < 85 || avgResponseTime > 5000 || errorCount > 10) return 'fair';
        if (successRate < 95 || avgResponseTime > 2000 || errorCount > 5) return 'good';
        return 'excellent';
    }

    /**
     * Generate actionable recommendations
     */
    generateRecommendations() {
        const recommendations = [];

        // Domain-specific recommendations
        const domainErrors = Array.from(this.errorSummary.errorsByDomain.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        if (domainErrors.length > 0) {
            recommendations.push({
                type: 'domain_errors',
                priority: 'high',
                title: 'High Error Domains',
                description: `Top domains with errors: ${domainErrors.map(([domain, count]) => `${domain} (${count})`).join(', ')}`,
                action: 'Consider implementing circuit breakers or reducing request frequency for these domains'
            });
        }

        // Status code patterns
        const statusErrors = Array.from(this.errorSummary.errorsByStatusCode.entries())
            .sort((a, b) => b[1] - a[1]);

        if (statusErrors.length > 0) {
            const topStatus = statusErrors[0];
            if (topStatus[1] > 10) {
                let action = 'Monitor and investigate root cause';
                
                switch (topStatus[0]) {
                    case 429:
                        action = 'Implement rate limiting and retry with exponential backoff';
                        break;
                    case 503:
                        action = 'Reduce request frequency and implement circuit breakers';
                        break;
                    case 404:
                        action = 'Review URL generation and remove invalid URLs from crawl queue';
                        break;
                    case 500:
                        action = 'Monitor target servers and implement retry logic for server errors';
                        break;
                }

                recommendations.push({
                    type: 'status_pattern',
                    priority: topStatus[1] > 50 ? 'high' : 'medium',
                    title: `Frequent HTTP ${topStatus[0]} Errors`,
                    description: `${topStatus[1]} occurrences of HTTP ${topStatus[0]} errors`,
                    action
                });
            }
        }

        // Performance recommendations
        const performance = this.generatePerformanceReport();
        const poorDomains = performance.domainAnalysis.filter(d => d.health === 'poor');
        
        if (poorDomains.length > 0) {
            recommendations.push({
                type: 'performance',
                priority: 'medium',
                title: 'Poor Performing Domains',
                description: `${poorDomains.length} domains showing poor performance`,
                action: 'Implement domain-specific rate limiting and consider excluding problematic domains'
            });
        }

        // Overall system recommendations
        if (this.errorSummary.totalErrors > 100) {
            const errorRate = (this.errorSummary.totalErrors / ((Date.now() - this.errorSummary.startTime) / 1000 / 60 / 60));
            if (errorRate > 10) {
                recommendations.push({
                    type: 'system',
                    priority: 'high',
                    title: 'High Overall Error Rate',
                    description: `System error rate is ${errorRate.toFixed(1)} errors/hour`,
                    action: 'Review crawling strategy, implement global rate limiting, and enhance error handling'
                });
            }
        }

        return recommendations;
    }

    /**
     * Save error report to file
     */
    async saveErrorReport(report = null) {
        if (!this.options.enableFileReporting) return null;

        try {
            const reportData = report || this.generateErrorReport();
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `http-error-report-${timestamp}.json`;
            const filepath = path.join(this.options.reportDirectory, filename);

            await fs.promises.writeFile(filepath, JSON.stringify(reportData, null, 2), 'utf8');

            logger.info('HTTP error report saved', {
                service: 'HttpErrorReporter',
                filepath,
                totalErrors: reportData.summary.totalErrors
            });

            return filepath;
        } catch (error) {
            logger.error('Failed to save error report', {
                service: 'HttpErrorReporter',
                error: error.message
            });
            return null;
        }
    }

    /**
     * Start periodic reporting
     */
    startPeriodicReporting() {
        setInterval(async () => {
            if (this.errorSummary.totalErrors > 0) {
                await this.saveErrorReport();
            }
        }, this.options.reportInterval);

        logger.info('Periodic error reporting started', {
            service: 'HttpErrorReporter',
            interval: this.options.reportInterval
        });
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
     * Convert Map to Object for JSON serialization
     */
    mapToObject(map) {
        const obj = {};
        for (const [key, value] of map) {
            obj[key] = value;
        }
        return obj;
    }

    /**
     * Format duration in human-readable format
     */
    formatDuration(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    /**
     * Ensure report directory exists
     */
    ensureReportDirectory() {
        try {
            if (!fs.existsSync(this.options.reportDirectory)) {
                fs.mkdirSync(this.options.reportDirectory, { recursive: true });
            }
        } catch (error) {
            logger.warn('Could not create report directory', {
                service: 'HttpErrorReporter',
                directory: this.options.reportDirectory,
                error: error.message
            });
        }
    }

    /**
     * Get current error statistics
     */
    getStats() {
        return {
            summary: {
                totalErrors: this.errorSummary.totalErrors,
                errorRate: this.errorSummary.totalErrors > 0 ? 
                    (this.errorSummary.totalErrors / ((Date.now() - this.errorSummary.startTime) / 1000 / 60 / 60)).toFixed(2) + ' errors/hour' : '0 errors/hour',
                runtime: this.formatDuration(Date.now() - this.errorSummary.startTime),
                lastError: this.errorSummary.lastError ? new Date(this.errorSummary.lastError).toISOString() : null
            },
            alerts: {
                critical: this.alertState.criticalAlerts,
                warning: this.alertState.warningAlerts,
                total: this.alertState.criticalAlerts + this.alertState.warningAlerts
            },
            topErrors: Array.from(this.errorSummary.errorsByType.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5),
            topDomains: Array.from(this.errorSummary.errorsByDomain.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
        };
    }

    /**
     * Clear all error data
     */
    clear() {
        this.errorLog = [];
        this.errorSummary = {
            totalErrors: 0,
            errorsByType: new Map(),
            errorsByDomain: new Map(),
            errorsByStatusCode: new Map(),
            errorsByTime: new Map(),
            startTime: Date.now(),
            lastError: null
        };
        this.alertState.lastAlert.clear();
        this.alertState.criticalAlerts = 0;
        this.alertState.warningAlerts = 0;
        this.performanceMetrics = {
            responseTimesByDomain: new Map(),
            successRateByDomain: new Map(),
            retryRatesByError: new Map()
        };

        logger.info('HTTP error data cleared', {
            service: 'HttpErrorReporter'
        });
    }
}

module.exports = { HttpErrorReporter };
