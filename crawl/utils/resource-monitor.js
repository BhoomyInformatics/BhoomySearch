/**
 * Resource Monitor for Crawler
 * Monitors memory and CPU usage to prevent stalling and resource exhaustion
 */

class ResourceMonitor {
    constructor(options = {}) {
        this.options = {
            checkIntervalMs: options.checkIntervalMs || 30000, // Check every 30 seconds  
            memoryLimit: options.memoryLimit || 64 * 1024 * 1024 * 1024, // 64GB limit (50% of 128GB)
            cpuThreshold: options.cpuThreshold || 40.0, // Allow up to 40 cores (70% of 48 threads)
            ...options
        };
        
        this.startTime = Date.now();
        this.initialMemoryUsage = process.memoryUsage().rss;
        this.peakMemoryUsage = this.initialMemoryUsage;
        this.lastCpuUsage = process.cpuUsage();
        this.lastCheckTime = Date.now();
        this.monitorInterval = null;
        this.callbacks = {
            onMemoryWarning: options.onMemoryWarning || (() => {}),
            onMemoryCritical: options.onMemoryCritical || (() => {}),
            onCpuWarning: options.onCpuWarning || (() => {})
        };
    }
    
    /**
     * Start monitoring resources
     */
    start() {
        if (this.monitorInterval) {
            return;
        }
        
        this.monitorInterval = setInterval(() => {
            this.checkResources();
        }, this.options.checkIntervalMs);
    }
    
    /**
     * Stop monitoring resources
     */
    stop() {
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
        }
    }
    
    /**
     * Check current resource usage
     */
    checkResources() {
        try {
            // Check memory usage - wrap in try-catch for EMFILE errors
            const memUsage = process.memoryUsage();
            const currentMemoryUsage = memUsage.rss;
            this.peakMemoryUsage = Math.max(this.peakMemoryUsage, currentMemoryUsage);
            
            let canContinue = true;
            let suggestedDelay = 0;
            let warnings = [];
            
            // Trigger warnings based on memory usage
            if (currentMemoryUsage > this.options.memoryLimit * 0.8) {
                warnings.push('High memory usage');
                this.callbacks.onMemoryWarning(currentMemoryUsage);
                
                if (currentMemoryUsage > this.options.memoryLimit * 0.9) {
                    canContinue = false;
                    suggestedDelay = 5000; // 5 second delay
                } else {
                    suggestedDelay = 2000; // 2 second delay
                }
            }
            
            if (currentMemoryUsage > this.options.memoryLimit) {
                warnings.push('Critical memory usage');
                canContinue = false;
                suggestedDelay = 10000; // 10 second delay
                this.callbacks.onMemoryCritical(currentMemoryUsage);
            }
            
            // Check CPU usage
            const currentCpuUsage = process.cpuUsage();
            const elapsedTime = Date.now() - this.lastCheckTime;
            
            // Calculate CPU usage percentage over the interval
            const userCpuUsageMicros = currentCpuUsage.user - this.lastCpuUsage.user;
            const systemCpuUsageMicros = currentCpuUsage.system - this.lastCpuUsage.system;
            const totalCpuUsageMicros = userCpuUsageMicros + systemCpuUsageMicros;
            
            // Convert to percentage (0-1)
            const cpuUsagePercent = totalCpuUsageMicros / (elapsedTime * 1000);
            
            if (cpuUsagePercent > this.options.cpuThreshold) {
                warnings.push('High CPU usage');
                canContinue = false;
                suggestedDelay = Math.max(suggestedDelay, 3000); // At least 3 second delay
                this.callbacks.onCpuWarning(cpuUsagePercent);
            }
            
            // Update values for next check
            this.lastCpuUsage = currentCpuUsage;
            this.lastCheckTime = Date.now();
            
            // Return status object that crawler expects
            return {
                canContinue,
                suggestedDelay,
                warnings,
                memoryUsage: currentMemoryUsage,
                cpuUsage: cpuUsagePercent,
                timestamp: Date.now()
            };
        } catch (error) {
            // Handle EMFILE and other system errors
            if (error.code === 'EMFILE' || error.message.includes('too many open files')) {
                return {
                    canContinue: false,
                    suggestedDelay: 5000, // 5 second delay for file descriptor exhaustion (reduced for speed)
                    warnings: ['EMFILE: Too many open files - reducing concurrency'],
                    memoryUsage: this.peakMemoryUsage, // Use last known value
                    cpuUsage: 0,
                    timestamp: Date.now(),
                    systemError: true
                };
            }
            
            // For other errors, be conservative
            return {
                canContinue: false,
                suggestedDelay: 10000,
                warnings: [`Resource check failed: ${error.message}`],
                memoryUsage: this.peakMemoryUsage,
                cpuUsage: 0,
                timestamp: Date.now(),
                systemError: true
            };
        }
    }
    
    /**
     * Force garbage collection if available
     * Note: This requires running Node with --expose-gc flag
     */
    forceGarbageCollection() {
        if (global.gc) {
            global.gc();
            return true;
        }
        return false;
    }
    
    /**
     * Get resource usage statistics
     */
    getStats() {
        const currentMemoryUsage = process.memoryUsage().rss;
        return {
            uptime: (Date.now() - this.startTime) / 1000, // in seconds
            currentMemoryUsage: Math.round(currentMemoryUsage / 1024 / 1024), // in MB
            peakMemoryUsage: Math.round(this.peakMemoryUsage / 1024 / 1024), // in MB
            memoryIncreasePercent: Math.round((currentMemoryUsage - this.initialMemoryUsage) / this.initialMemoryUsage * 100),
            heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) // in MB
        };
    }
}

// Create a singleton instance for use throughout the application
const resourceMonitor = new ResourceMonitor();

module.exports = { ResourceMonitor, resourceMonitor };
