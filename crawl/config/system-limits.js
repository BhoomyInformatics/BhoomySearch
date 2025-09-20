// System limits configuration optimized for HIGH-CAPACITY server (128GB RAM, 24 CPU cores)
const os = require('os');
const process = require('process');

class SystemLimitsManager {
    constructor() {
        // Detect actual server capacity
        const totalMemoryGB = Math.round(os.totalmem() / 1024 / 1024 / 1024);
        const cpuCores = os.cpus().length;
        
        // HIGH-CAPACITY server configuration
        this.platformLimits = {
            win32: {
                defaultLimit: 8192,
                recommendedLimit: 6000,      
                warningThreshold: 0.85       
            },
            darwin: {
                defaultLimit: 10240,
                recommendedLimit: 8000,      
                warningThreshold: 0.85       
            },
            linux: {
                defaultLimit: 65536,         // Linux can handle much more
                recommendedLimit: totalMemoryGB > 100 ? 50000 : (totalMemoryGB > 128 ? 20000 : 10000), // MONSTER server support
                warningThreshold: 0.85       
            }
        };
         
        this.currentPlatform = os.platform();
        this.limits = this.platformLimits[this.currentPlatform] || this.platformLimits.linux;
        this.activeConnections = 0;
        
        // Add timestamp tracking for status logs
        this.lastStatusLogTime = 0;
        this.statusLogInterval = 120000; // 2 minutes in milliseconds
        
        // DYNAMIC scaling based on actual server capacity
        if (totalMemoryGB >= 120 && cpuCores >= 24) {
            // MONSTER server configuration (120GB+/24+ core class)
            this.maxSafeConnections = Math.floor(this.limits.recommendedLimit * 0.9); // INCREASED to 90% for monster servers
            console.log('🔥 MONSTER server detected - Using MAXIMUM high-capacity settings');
        } else if (totalMemoryGB >= 64 && cpuCores >= 16) {
            // HIGH-END server configuration
            this.maxSafeConnections = Math.floor(this.limits.recommendedLimit * 0.8); 
            console.log('🚀 HIGH-END server detected - Using optimized high-capacity settings');
        } else if (totalMemoryGB >= 32 && cpuCores >= 16) {
            // HIGH-CAPACITY server configuration  
            this.maxSafeConnections = Math.floor(this.limits.recommendedLimit * 0.7); 
            console.log('⚡ HIGH-CAPACITY server detected - Using enhanced settings');
        } else if (totalMemoryGB >= 16 && cpuCores >= 8) {
            // MEDIUM-CAPACITY server configuration
            this.maxSafeConnections = Math.floor(this.limits.recommendedLimit * 0.6); 
            console.log('📈 MEDIUM-CAPACITY server detected - Using improved settings');
        } else {
            // LOW-CAPACITY server configuration (original conservative settings)
            this.maxSafeConnections = Math.floor(this.limits.recommendedLimit * 0.4); 
            console.log('💻 STANDARD server detected - Using conservative settings');
        }
        
        // Log platform information
        this.logSystemInfo();
        
        // Start periodic health monitoring
        this.startHealthMonitoring();
    }

    logSystemInfo() {
        const totalMemoryGB = Math.round(os.totalmem() / 1024 / 1024 / 1024);
        const cpuCores = os.cpus().length;
        
        console.log('📊 OPTIMIZED System Information:');
        console.log(`   Platform: ${this.currentPlatform}`);
        console.log(`   Node.js Version: ${process.version}`);
        console.log(`   Architecture: ${process.arch}`);
        console.log(`   Total Memory: ${totalMemoryGB}GB`);
        console.log(`   Free Memory: ${Math.round(os.freemem() / 1024 / 1024 / 1024)}GB`);
        console.log(`   CPU Cores: ${cpuCores}`);
        console.log(`   Server Category: ${this.getServerCategory(totalMemoryGB, cpuCores)}`);
        console.log(`   Platform Limits: ${JSON.stringify(this.limits, null, 2)}`);
        console.log(`   Max Safe Connections: ${this.maxSafeConnections}`);
        console.log(`   Connection Safety Threshold: ${Math.round(this.maxSafeConnections * 0.8)}`);
        console.log(`   🎯 OPTIMIZED FOR HIGH-PERFORMANCE CRAWLING`);
    }

    getServerCategory(memoryGB, cores) {
        if (memoryGB >= 120 && cores >= 24) return 'MONSTER SERVER (120GB+/24+ cores)';
        if (memoryGB >= 64 && cores >= 16) return 'HIGH-CAPACITY (64GB+/16+ cores)';
        if (memoryGB >= 32 && cores >= 8) return 'MEDIUM-CAPACITY (32GB+/8+ cores)';
        return 'STANDARD (<32GB/<8 cores)';
    }

    // Get current resource usage
    getResourceUsage() {
        const memUsage = process.memoryUsage();
        const freeMem = os.freemem();
        const totalMem = os.totalmem();
        const memUsagePercent = ((totalMem - freeMem) / totalMem) * 100;
        
        return {
            memory: {
                used: memUsage.heapUsed,
                total: memUsage.heapTotal,
                external: memUsage.external,
                rss: memUsage.rss,
                systemUsedPercent: memUsagePercent,
                freeBytes: freeMem,
                totalBytes: totalMem
            },
            connections: {
                active: this.activeConnections,
                max: this.maxSafeConnections,
                utilization: (this.activeConnections / this.maxSafeConnections) * 100,
                remaining: this.maxSafeConnections - this.activeConnections
            }
        };
    }

    checkSystemHealth() {
        const usage = this.getResourceUsage();
        const connectionsPercent = usage.connections.utilization;
        const memUsagePercent = usage.memory.systemUsedPercent;
        
        // ADJUSTED thresholds for high-capacity server
        if (connectionsPercent > 85) { // INCREASED threshold from 70% to 85%
            console.log('🚨 HIGH CONNECTION USAGE WARNING:');
            console.log(`   Active Connections: ${this.activeConnections}/${this.maxSafeConnections} (${connectionsPercent.toFixed(1)}%)`);
            console.log(`   Recommendation: Monitor connection usage`);
        }
        
        if (memUsagePercent > 90) { // INCREASED threshold from 85% to 90%
            console.log('🚨 HIGH MEMORY USAGE WARNING:');
            console.log(`   Memory Usage: ${memUsagePercent.toFixed(1)}%`);
            console.log(`   Free Memory: ${Math.round(usage.memory.freeBytes / 1024 / 1024)}MB`);
            console.log(`   Heap Used: ${Math.round(usage.memory.used / 1024 / 1024)}MB`);
        }
        
        // FIXED: Proper periodic status logging (only once per interval)
        const currentTime = Date.now();
        if (currentTime - this.lastStatusLogTime >= this.statusLogInterval) {
            console.log(`📊 High-Performance System Status:`);
            console.log(`   Memory: ${memUsagePercent.toFixed(1)}% used, ${Math.round(usage.memory.freeBytes / 1024 / 1024)}MB free`);
            console.log(`   Connections: ${this.activeConnections}/${this.maxSafeConnections} (${connectionsPercent.toFixed(1)}%)`);
            console.log(`   Heap: ${Math.round(usage.memory.used / 1024 / 1024)}MB used, ${Math.round(usage.memory.total / 1024 / 1024)}MB total`);
            this.lastStatusLogTime = currentTime;
        }
    }

    // Methods for connection tracking
    incrementConnections() {
        this.activeConnections++;
        
        // IMPROVED: More appropriate warnings for high-capacity server
        const utilizationPercent = (this.activeConnections / this.maxSafeConnections) * 200;
        
        if (utilizationPercent > 95) { // INCREASED from 85% to 95%
            console.log(`🔴 CRITICAL: Near connection limit (${this.activeConnections}/${this.maxSafeConnections} - ${utilizationPercent.toFixed(1)}%)`);
        } else if (utilizationPercent > 85) { // INCREASED from 70% to 85%
            console.log(`⚠️  Warning: High connection usage (${this.activeConnections}/${this.maxSafeConnections} - ${utilizationPercent.toFixed(1)}%)`);
        } else if (utilizationPercent > 70) { // INCREASED from 50% to 70%
            console.log(`ℹ️  Info: Moderate connection usage (${this.activeConnections}/${this.maxSafeConnections} - ${utilizationPercent.toFixed(1)}%)`);
        }
    }

    decrementConnections() {
        this.activeConnections = Math.max(0, this.activeConnections - 1);
    }

    getConnectionStats() {
        const utilization = (this.activeConnections / this.maxSafeConnections) * 200;
        
        return {
            active: this.activeConnections,
            max: this.maxSafeConnections,
            percentage: utilization,
            safe: this.activeConnections < this.maxSafeConnections * 0.85, // INCREASED from 0.7 to 0.85
            warning: utilization > 85, // INCREASED from 70% to 85%
            critical: utilization > 95, // INCREASED from 85% to 95%
            remaining: this.maxSafeConnections - this.activeConnections
        };
    }

    // UPDATED threshold for high-capacity server
    isConnectionSafe() {
        const utilizationPercent = (this.activeConnections / this.maxSafeConnections) * 100;
        return utilizationPercent < 90; // INCREASED from 75% to 90% for high-capacity server
    }

    // OPTIMIZED: High-performance crawler settings based on server capacity
    getRecommendedCrawlerSettings() {
        const connectionStats = this.getConnectionStats();
        const systemLoad = this.getResourceUsage();
        const totalMemoryGB = Math.round(os.totalmem() / 1024 / 1024 / 1024);
        const cpuCores = os.cpus().length;
        
        // DYNAMIC settings based on actual server capacity
        let maxConcurrentRequests, rateLimit, timeout, maxRetries;
        
        if (totalMemoryGB >= 120 && cpuCores >= 24) {
            // MONSTER server settings
            maxConcurrentRequests = Math.min(1000, Math.floor(this.maxSafeConnections * 1.0));
            rateLimit = 500;  // Very fast for monster server
            timeout = 20000;
            maxRetries = 3;
        } else if (totalMemoryGB >= 64 && cpuCores >= 16) {
            // HIGH-CAPACITY server settings
            maxConcurrentRequests = Math.min(500, Math.floor(this.maxSafeConnections * 0.5));
            rateLimit = 500;
            timeout = 20000;
            maxRetries = 3;
        } else {
            // STANDARD server settings
            maxConcurrentRequests = Math.min(250, Math.floor(this.maxSafeConnections * 0.3));
            rateLimit = 250;
            timeout = 15000;
            maxRetries = 2;
        }
        
        // Adjust based on current load (less aggressive adjustments)
        if (connectionStats.critical) {
            maxConcurrentRequests = Math.max(10, Math.floor(maxConcurrentRequests * 0.6));
            rateLimit = rateLimit * 2;
        } else if (connectionStats.warning) {
            maxConcurrentRequests = Math.max(20, Math.floor(maxConcurrentRequests * 0.8));
            rateLimit = Math.floor(rateLimit * 1.5);
        }
        
        // Adjust for memory pressure (less sensitive)
        if (systemLoad.memory.systemUsedPercent > 95) { // INCREASED from 80% to 95%
            maxConcurrentRequests = Math.max(10, Math.floor(maxConcurrentRequests * 0.7));
            rateLimit += 500;
        }
        
        return {
            maxConcurrentRequests,
            maxConnectionsPerCrawler: totalMemoryGB >= 64 ? 8 : 4,  // INCREASED based on capacity
            rateLimit,
            timeout,
            maxRetries,
            batchDelay: Math.floor(rateLimit * 0.2), // REDUCED delay multiplier
            depthDelay: Math.floor(rateLimit * 0.8), // REDUCED delay multiplier
            adaptiveThrottling: true,
            systemLoad: {
                connectionUtilization: connectionStats.percentage,
                memoryUtilization: systemLoad.memory.systemUsedPercent,
                recommendationBasis: connectionStats.critical ? 'CRITICAL_LOAD' : 
                                   connectionStats.warning ? 'HIGH_LOAD' : 'NORMAL_LOAD',
                serverCapacity: this.getServerCategory(totalMemoryGB, cpuCores)
            }
        };
    }

    // UPDATED: Emergency throttle with higher thresholds
    emergencyThrottle() {
        console.log('🚨 EMERGENCY THROTTLE ACTIVATED (High-Capacity Server)');
        console.log(`   Current connections: ${this.activeConnections}/${this.maxSafeConnections}`);
        console.log('   Waiting for connections to decrease...');
        
        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                const utilizationPercent = (this.activeConnections / this.maxSafeConnections) * 100;
                
                if (utilizationPercent < 80) { // INCREASED from 60% to 80% for high-capacity
                    clearInterval(checkInterval);
                    console.log('✅ Emergency throttle released - connections decreased');
                    resolve();
                }
            }, 1000);
        });
    }

    startHealthMonitoring() {
        // Less frequent monitoring for high-performance server
        setInterval(() => {
            this.checkSystemHealth();
        }, 30000); // Every 30 seconds instead of default
        
        console.log('🔍 Health monitoring started (optimized for high-capacity server)');
    }
}

// Export singleton instance
module.exports = new SystemLimitsManager(); 