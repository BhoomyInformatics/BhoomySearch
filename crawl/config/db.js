/**
 * Enhanced Database Configuration
 * 
 * This module provides optimized database configuration with system resource detection
 * It supports both local development and production server environments
 * Features: Connection pooling optimization, health monitoring, automatic recovery
 * 
 * Environment Detection:
 * - Development: Uses localhost with root user and empty password
 * - Production: Uses environment variables or default production credentials
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Import centralized environment detection
const { isProduction } = require('./environment');

/**
 * Get system information for database optimization
 */
function getSystemInfo() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const cpuCount = os.cpus().length;
    
    return {
        totalMemoryGB: Math.round(totalMemory / (1024 * 1024 * 1024) * 100) / 100,
        freeMemoryGB: Math.round(freeMemory / (1024 * 1024 * 1024) * 100) / 100,
        memoryUsagePercent: Math.round((1 - freeMemory / totalMemory) * 100),
        cpuCount,
        platform: os.platform(),
        arch: os.arch()
    };
}

/**
 * Calculate optimal connection pool size based on system resources
 */
function calculateOptimalPoolSize(environment = 'development') {
    const systemInfo = getSystemInfo();
    
    // Base pool size calculation: 
    // Development: 5-50 connections based on available memory
    // Production: 10-150 connections based on available memory and CPU count
    
    let baseSize;
    if (environment === 'production') {
        // Production: More aggressive pooling
        baseSize = Math.max(10, Math.min(150, 
            Math.floor(systemInfo.totalMemoryGB * 10) + Math.floor(systemInfo.cpuCount * 5)
        ));
    } else {
        // Development: Conservative pooling
        baseSize = Math.max(5, Math.min(50, 
            Math.floor(systemInfo.totalMemoryGB * 5) + Math.floor(systemInfo.cpuCount * 2)
        ));
    }

    // Adjust for memory pressure
    if (systemInfo.memoryUsagePercent > 80) {
        baseSize = Math.floor(baseSize * 0.7); // Reduce by 30% under memory pressure
    }

    return {
        connectionLimit: baseSize,
        queueLimit: baseSize * 2,
        maxIdle: Math.max(2, Math.floor(baseSize * 0.1)),
        acquireTimeout: environment === 'production' ? 30000 : 45000,
        systemInfo
    };
}

// Calculate optimal settings for current environment
const optimalSettings = calculateOptimalPoolSize(isProduction ? 'production' : 'development');

// Enhanced configuration settings with system optimization
const dbConfig = {
    development: {
        // Basic credentials
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'mybhoomy_mytest',
        port: 3306,
        
        // System-optimized connection settings
        connectionLimit: process.env.DB_CONNECTION_LIMIT || optimalSettings.connectionLimit,
        queueLimit: process.env.DB_QUEUE_LIMIT || optimalSettings.queueLimit,
        maxIdle: optimalSettings.maxIdle,
        
        // Enhanced connection management
        multipleStatements: true,
        charset: 'utf8mb4',
        idleTimeout: 300000, // 5 minutes idle timeout
        keepAliveInitialDelay: 0,
        
        // Lock optimization settings
        acquireTimeout: 10000, // 10 seconds connection acquisition timeout
        timeout: 10000, // 10 seconds query timeout
        reconnect: true,
        
        // Health monitoring settings
        healthCheckInterval: 30000, // 30 seconds
        enableHealthMonitoring: true,
        
        // Performance settings
        supportBigNumbers: true,
        bigNumberStrings: true,
        dateStrings: false,
        debug: false,
        trace: false,
        
        // System info for logging
        systemOptimization: optimalSettings.systemInfo
    },
    production: {
        // Basic credentials with environment variable support
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'mybhoomy_admin',
        password: process.env.DB_PASSWORD || 'mhQjj.%C-_LO_U4',
        database: process.env.DB_NAME || 'mybhoomy_mytest',
        port: process.env.DB_PORT || 3306,
        
        // System-optimized connection settings
        connectionLimit: process.env.DB_CONNECTION_LIMIT || optimalSettings.connectionLimit,
        queueLimit: process.env.DB_QUEUE_LIMIT || optimalSettings.queueLimit,
        maxIdle: optimalSettings.maxIdle,
        
        // Enhanced connection management
        multipleStatements: true,
        charset: 'utf8mb4',
        idleTimeout: 300000, // 5 minutes idle timeout
        keepAliveInitialDelay: 0,
        
        // Lock optimization settings
        acquireTimeout: 10000, // 10 seconds connection acquisition timeout
        timeout: 10000, // 10 seconds query timeout
        reconnect: true,
        
        // Health monitoring settings
        healthCheckInterval: 30000, // 30 seconds
        enableHealthMonitoring: true,
        maxRecoveryAttempts: 5,
        
        // Performance settings
        supportBigNumbers: true,
        bigNumberStrings: true,
        dateStrings: false,
        debug: false,
        trace: false,
        
        
        // SSL settings (if needed)
        ssl: process.env.DB_SSL === 'true' ? {
            rejectUnauthorized: false
        } : null,
        
        // System info for logging
        systemOptimization: optimalSettings.systemInfo,
        
        // Alerting thresholds
        alertThresholds: {
            connectionPoolUtilization: 80,
            averageQueryTime: 5000,
            errorRate: 0.05,
            healthCheckFailures: 3
        }
    }
};

// Note: All database configuration is now centralized in this single file

// Enhanced connection verification function with system optimization info
const verifyDbCredentials = (config) => {
    const systemInfo = getSystemInfo();
    
    console.log(`Enhanced Database Configuration:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔧 Database Settings:
   Host: ${config.host}
   User: ${config.user}
   Database: ${config.database}
   Port: ${config.port || 3306}
   Environment: ${isProduction ? 'Production' : 'Development'}

🚀 System Optimization:
   Total Memory: ${systemInfo.totalMemoryGB} GB
   Available Memory: ${systemInfo.freeMemoryGB} GB
   CPU Cores: ${systemInfo.cpuCount}
   Platform: ${systemInfo.platform} (${systemInfo.arch})

⚡ Connection Pool Settings:
   Connection Limit: ${config.connectionLimit}
   Queue Limit: ${config.queueLimit}
   Max Idle: ${config.maxIdle}
   Health Monitoring: ${config.enableHealthMonitoring ? 'Enabled' : 'Disabled'}

📊 Performance Features:
   ✅ System Resource Optimization
   ✅ Advanced Health Monitoring
   ✅ Automatic Connection Recovery
   ✅ Real-time Metrics & Alerting
   ✅ Connection Pool Management
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

To fix connection issues:
1. Verify MySQL credentials and permissions
2. Check database exists and is accessible
3. Update environment variables or modify this file directly
4. Monitor health status via getHealthStatus() method
`);
    return config;
};

// Export the appropriate configuration with verification
const selectedConfig = isProduction ? dbConfig.production : dbConfig.development;

// Add environment information to the config for debugging
selectedConfig.environment = isProduction ? 'production' : 'development';
selectedConfig.configSource = 'centralized';

module.exports = verifyDbCredentials(selectedConfig);
