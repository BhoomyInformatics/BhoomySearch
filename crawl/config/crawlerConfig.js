const crawlerConfig = {
    // HIGH-PERFORMANCE SETTINGS for 128GB RAM / 24 CPU cores server
    maxConcurrentRequests: 5000,       // INCREASED dramatically for high-capacity server
    requestTimeout: 45000,           // INCREASED from 30000 to 45000 for slow websites
    maxRetries: 2,                   // INCREASED from 2 to 3 for better resilience
    retryDelay: 3000,                // INCREASED for better success rate on retries
    
    // ADAPTIVE TIMEOUT SETTINGS - Handle different website speeds
    baseTimeout: 30000,              // Base timeout for normal sites
    slowSiteTimeout: 60000,          // Extended timeout for slow government/enterprise sites
    fastSiteTimeout: 15000,          // Quick timeout for fast commercial sites
    
    // RETRY STRATEGIES - Different approaches for different errors
    retryStrategies: {
        'ECONNRESET': { maxRetries: 2, delay: 5000, backoff: 1.5 },     // Connection reset - retry more
        'ETIMEDOUT': { maxRetries: 2, delay: 8000, backoff: 2.0 },      // Timeout - longer delays
        'ENOTFOUND': { maxRetries: 2, delay: 2000, backoff: 1.0 },      // DNS issues - quick retries
        'EHOSTUNREACH': { maxRetries: 2, delay: 3000, backoff: 1.0 },   // Host unreachable
        'ECONNREFUSED': { maxRetries: 1, delay: 1000, backoff: 1.0 },   // Connection refused - likely blocked
        'HTTP_4XX': { maxRetries: 1, delay: 1000, backoff: 1.0 },       // Client errors - minimal retry
        'HTTP_5XX': { maxRetries: 2, delay: 4000, backoff: 1.8 },       // Server errors - retry more
        'REDIRECT_LOOP': { maxRetries: 0, delay: 0, backoff: 1.0 }      // Redirect loops - don't retry
    },
    
    // Timing - Optimized for high-throughput
    minDelay: 500,                   // REDUCED from 3000ms to 500ms for better performance
    maxDelay: 2000,                  // REDUCED from 8000ms to 2000ms for better throughput
    
    // Connection pool - Optimized for high-capacity server
    concurrentLimit: 5000,            // INCREASED dramatically from 100 to 5000
    connectionPoolSize: 2000,         // INCREASED from 500 to 2000 for high-performance
    
    // Headers for connection control
    keepAlive: true,                 
    useConnectionPool: true,         
    
    // Batch processing - Optimized for high throughput
    batchSize: 100,                   // INCREASED from 50 to 100 for better throughput
    maxDepth: 3,                     
    maxPagesPerSite: 2000,            
    
    // Politeness settings
    respectRobots: true,
    userAgentRotation: true,
    
    // Error handling
    skipErrors: true,
    continueOnError: true,
    logLevel: 'info',                
    
    // Site-specific limits
    maxLinksPerPage: 2000,             
    maxImageLinks: 2000,               
    maxDocumentLinks: 500,             
    
    // Content processing limits
    maxContentSize: '10MB',           
    maxImageSize: '5MB',             
    
    // System resource protection - Adjusted for high-capacity server
    memoryThreshold: 0.75,           // REDUCED from 0.85 to allow more memory usage
    cpuThreshold: 0.8,               
    
    // Network timeouts - Optimized for performance with better resilience
    dnsTimeout: 10000,               // INCREASED from 8000 to handle slow DNS
    connectTimeout: 15000,           // INCREASED from 12000 for slow connections
    responseTimeout: 45000,          // INCREASED to match requestTimeout
    
    // URL PATTERN DETECTION - Adaptive timeouts based on website type
    urlPatterns: {
        government: {
            patterns: ['.gov.', '.nic.in', '.maharashtra.gov', '.indiapost.gov'],
            timeout: 60000,          // Government sites are often slow
            maxRetries: 2,
            retryDelay: 8000
        },
        commercial: {
            patterns: ['.com/', '.co.in/', '.org/', '.net/'],
            timeout: 30000,          // Commercial sites should be faster
            maxRetries: 2,
            retryDelay: 3000
        },
        social: {
            patterns: ['facebook.com', 'twitter.com', 'instagram.com', 'linkedin.com'],
            timeout: 20000,          // Social sites block crawlers often
            maxRetries: 1,
            retryDelay: 2000
        },
        ecommerce: {
            patterns: ['amazon.', 'flipkart.', 'myntra.', 'paytm.', 'housing.com'],
            timeout: 25000,          // E-commerce sites may be slow/protected
            maxRetries: 2,
            retryDelay: 4000
        }
    },
    
    // NETWORK RESILIENCE SETTINGS
    networkResilience: {
        enableAdaptiveRetry: true,           // Use different retry strategies per error type
        enableTimeoutAdaptation: true,       // Adapt timeouts based on site patterns
        maxConsecutiveFailures: 5,           // Stop trying a domain after 5 consecutive failures
        domainCooldownMs: 300000,            // 5 minute cooldown for problematic domains
        
        // Connection pool resilience
        poolRecoveryEnabled: true,           // Auto-recover from connection pool issues
        poolRecoveryTimeMs: 30000,           // Wait 30s before trying to recover pool
        
        // Error classification for better handling
        temporaryErrors: ['ECONNRESET', 'ETIMEDOUT', 'EHOSTUNREACH', 'ENOTFOUND'],
        permanentErrors: ['ECONNREFUSED', 'HTTP_401', 'HTTP_403'],
        retryableHttpCodes: [500, 502, 503, 504, 408, 429]
    },
    
    // HIGH-CAPACITY CONNECTION LIMITS - Properly utilize server capacity
    emergencyStopOnEmfile: true,     
    maxGlobalConnections: 5000,       // INCREASED dramatically from 2000 to 5000
    maxConnectionsPerDomain: 10,      // INCREASED from 5 to 10
    maxQueueSize: 5000,              // INCREASED from 2000 to 5000
    
    // Backpressure and queue management - Adjusted for high capacity
    queueTimeoutMs: 45000,           
    enableBackpressure: true,        
    backpressureThreshold: 0.8,      // Increased back to 0.8 for higher capacity
    maxWaitTimeMs: 90000,            
    
    // Rate limiting - Optimized for high throughput
    adaptiveDelay: true,             
    maxAdaptiveDelayMs: 10000,       // REDUCED from 15000 to 10000
    queueMonitoringInterval: 2000    // REDUCED from 3000 to 2000 for better monitoring
};

// Multi-session configuration
const MULTI_SESSION_CONFIG = {
    enabled: process.env.MULTI_SESSION_ENABLED === 'true' || false,
    expectedSessions: parseInt(process.env.EXPECTED_SESSIONS) || 7,  // bhoomy_com, bhoomy_in, bhoomy_org, bhoomy_all, bhoomy_store, news_site, specialsite
    sessionId: process.env.SESSION_ID || process.pid.toString(),
    
    // Distribute resources across sessions
    distributedLimits: {
        globalConnections: Math.floor(600 / 7),      // ~85 connections per session
        connectionsPerDomain: 3,                     // Reduced from 5 to 3 for multi-session safety
        concurrentRequests: Math.floor(200 / 7),     // ~28 requests per session
        batchSize: Math.floor(100 / 7),              // ~14 per batch per session
        queueSize: Math.floor(5000 / 7)              // ~714 queue size per session
    }
};

// Environment-specific overrides
if (process.env.NODE_ENV === 'production' || process.env.OPTIMIZE_FOR_CAPACITY === 'true') {
    // Production optimizations - Even higher limits for production on high-end server
    crawlerConfig.maxConcurrentRequests = 5000;      // INCREASED from 2000 to 5000
    crawlerConfig.concurrentLimit = 5000;            // INCREASED from 2000 to 5000
    crawlerConfig.batchSize = 100;                   // Keep at 100
    crawlerConfig.minDelay = 100;                   // Keep optimized
    crawlerConfig.maxDelay = 500;                   // Keep optimized
    crawlerConfig.maxGlobalConnections = 5000;       // INCREASED from 2000 to 5000
    crawlerConfig.maxConnectionsPerDomain = 10;      // INCREASED from 5 to 10
    crawlerConfig.maxQueueSize = 5000;              // INCREASED from 2000 to 5000
    crawlerConfig.logLevel = 'warn';
    
    console.log('🚀 HIGH-PERFORMANCE MODE ENABLED for production/high-capacity server');
} else if (process.env.NODE_ENV === 'development') {
    // Development settings - Still much higher than before
    crawlerConfig.maxConcurrentRequests = 20;       // INCREASED from 5 to 20
    crawlerConfig.logLevel = 'debug';
    crawlerConfig.respectRateLimit = false;
    crawlerConfig.minDelay = 200;                   // REDUCED from 500
    crawlerConfig.maxDelay = 1000;                  // REDUCED from 1500
    crawlerConfig.maxGlobalConnections = 100;       // Set reasonable dev limit
    crawlerConfig.maxConnectionsPerDomain = 3;      // Increased for dev
} else {
    // Default to high-performance settings if environment is not explicitly set
    console.log('🚀 Environment not set, using high-performance defaults for high-capacity server');
    crawlerConfig.maxConcurrentRequests = 5000;
    crawlerConfig.concurrentLimit = 5000;
    crawlerConfig.maxGlobalConnections = 5000;
    crawlerConfig.maxConnectionsPerDomain = 10;
    crawlerConfig.maxQueueSize = 5000;
}

// Auto-detect server capacity and adjust if needed
const os = require('os');
const totalMemoryGB = Math.round(os.totalmem() / 1024 / 1024 / 1024);
const cpuCores = os.cpus().length;

if (totalMemoryGB >= 120 && cpuCores >= 24 && !process.env.NODE_ENV) {
    console.log(`🔥 AUTO-DETECTED MONSTER SERVER (${totalMemoryGB}GB RAM, ${cpuCores} cores)`);
    
    if (MULTI_SESSION_CONFIG.enabled) {
        console.log(`🔀 MULTI-SESSION MODE: Distributing resources across ${MULTI_SESSION_CONFIG.expectedSessions} sessions`);
        console.log(`   Session ID: ${MULTI_SESSION_CONFIG.sessionId}`);
        
        // DISTRIBUTED performance for multi-session crawling
        crawlerConfig.maxConcurrentRequests = MULTI_SESSION_CONFIG.distributedLimits.concurrentRequests;
        crawlerConfig.concurrentLimit = Math.floor(300 / MULTI_SESSION_CONFIG.expectedSessions);
        crawlerConfig.maxGlobalConnections = MULTI_SESSION_CONFIG.distributedLimits.globalConnections;
        crawlerConfig.maxConnectionsPerDomain = MULTI_SESSION_CONFIG.distributedLimits.connectionsPerDomain;
        crawlerConfig.maxQueueSize = MULTI_SESSION_CONFIG.distributedLimits.queueSize;
        crawlerConfig.batchSize = MULTI_SESSION_CONFIG.distributedLimits.batchSize;
        crawlerConfig.minDelay = 100;               // Slightly increased for multi-session politeness
        crawlerConfig.maxDelay = 500;               // Increased for better distribution
        
        console.log(`   🚀 DISTRIBUTED MODE: ${crawlerConfig.maxGlobalConnections} connections, ${crawlerConfig.maxConcurrentRequests} concurrent requests per session`);
        console.log(`   🤝 MULTI-SESSION POLITENESS: ${crawlerConfig.maxConnectionsPerDomain} connections per domain per session`);
    } else {
        console.log('   Automatically enabling MAXIMUM performance settings...');
        
        // MAXIMUM performance for monster server (125GB/48-core) - SINGLE SESSION
        crawlerConfig.maxConcurrentRequests = 5000;      // Utilize those 48 cores!
        crawlerConfig.concurrentLimit = 5000;            // Much higher for massive server
        crawlerConfig.maxGlobalConnections = 5000;       // INCREASED dramatically for 125GB server
        crawlerConfig.maxConnectionsPerDomain =10;      // REDUCED from 15 to 5 for politeness (prevents blocking)
        crawlerConfig.maxQueueSize = 5000;              // Massive queue for high throughput
        crawlerConfig.minDelay = 50;                    // Minimal delays for speed
        crawlerConfig.maxDelay = 200;                   // Fast processing
        crawlerConfig.batchSize = 100;                  // Large batches for efficiency
        
        console.log(`   🚀 MONSTER MODE: ${crawlerConfig.maxGlobalConnections} connections, ${crawlerConfig.maxConcurrentRequests} concurrent requests`);
        console.log(`   🤝 POLITENESS: ${crawlerConfig.maxConnectionsPerDomain} connections per domain (respectful to websites)`);
    }
} else if (totalMemoryGB >= 64 && cpuCores >= 24 && !process.env.NODE_ENV) {
    console.log(`🔥 AUTO-DETECTED HIGH-END SERVER (${totalMemoryGB}GB RAM, ${cpuCores} cores)`);
    console.log('   Automatically enabling HIGH-PERFORMANCE settings...');
    
    // HIGH performance for high-end server
    crawlerConfig.maxConcurrentRequests = MULTI_SESSION_CONFIG.enabled ? 
        Math.floor(250 / MULTI_SESSION_CONFIG.expectedSessions) : 250;
    crawlerConfig.concurrentLimit = MULTI_SESSION_CONFIG.enabled ? 
        Math.floor(300 / MULTI_SESSION_CONFIG.expectedSessions) : 300;
    crawlerConfig.maxGlobalConnections = MULTI_SESSION_CONFIG.enabled ? 
        Math.floor(500 / MULTI_SESSION_CONFIG.expectedSessions) : 500;
    crawlerConfig.maxConnectionsPerDomain = 5;      // Keep at 5 for politeness
    crawlerConfig.maxQueueSize = MULTI_SESSION_CONFIG.enabled ? 
        Math.floor(5000 / MULTI_SESSION_CONFIG.expectedSessions) : 5000;
    crawlerConfig.minDelay = 50;
    crawlerConfig.maxDelay = 200;
}

// Environment variable overrides (highest priority)
if (process.env.CRAWLER_MAX_CONCURRENCY) {
    crawlerConfig.maxConcurrentRequests = parseInt(process.env.CRAWLER_MAX_CONCURRENCY);
}
if (process.env.CRAWLER_MAX_GLOBAL_CONNECTIONS) {
    crawlerConfig.maxGlobalConnections = parseInt(process.env.CRAWLER_MAX_GLOBAL_CONNECTIONS);
}
if (process.env.CRAWLER_MAX_CONNECTIONS_PER_DOMAIN) {
    crawlerConfig.maxConnectionsPerDomain = parseInt(process.env.CRAWLER_MAX_CONNECTIONS_PER_DOMAIN);
}
if (process.env.CRAWLER_CONCURRENT_LIMIT) {
    crawlerConfig.concurrentLimit = parseInt(process.env.CRAWLER_CONCURRENT_LIMIT);
}
if (process.env.CRAWLER_BATCH_SIZE) {
    crawlerConfig.batchSize = parseInt(process.env.CRAWLER_BATCH_SIZE);
}
if (process.env.CRAWLER_QUEUE_SIZE) {
    crawlerConfig.maxQueueSize = parseInt(process.env.CRAWLER_QUEUE_SIZE);
}
if (process.env.CRAWLER_MIN_DELAY) {
    crawlerConfig.minDelay = parseInt(process.env.CRAWLER_MIN_DELAY);
}
if (process.env.CRAWLER_MAX_DELAY) {
    crawlerConfig.maxDelay = parseInt(process.env.CRAWLER_MAX_DELAY);
}
if (process.env.CRAWLER_TIMEOUT) {
    crawlerConfig.requestTimeout = parseInt(process.env.CRAWLER_TIMEOUT);
}
if (process.env.CRAWLER_MAX_RETRIES) {
    crawlerConfig.maxRetries = parseInt(process.env.CRAWLER_MAX_RETRIES);
}
if (process.env.CRAWLER_RETRY_DELAY) {
    crawlerConfig.retryDelay = parseInt(process.env.CRAWLER_RETRY_DELAY);
}

console.log('📊 Final Configuration Summary:');
console.log(`   Global Connections: ${crawlerConfig.maxGlobalConnections}`);
console.log(`   Connections Per Domain: ${crawlerConfig.maxConnectionsPerDomain} (respectful limit)`);
console.log(`   Concurrent Requests: ${crawlerConfig.maxConcurrentRequests}`);
console.log(`   Delays: ${crawlerConfig.minDelay}ms - ${crawlerConfig.maxDelay}ms`);
console.log(`   Batch Size: ${crawlerConfig.batchSize}`);
console.log(`   Queue Size: ${crawlerConfig.maxQueueSize}`);

// Validation function
function validateConfig() {
    const errors = [];
    
    if (crawlerConfig.maxConcurrentRequests < 1) {
        errors.push('maxConcurrentRequests must be at least 1');
    }
    
    if (crawlerConfig.requestTimeout < 1000) {
        errors.push('requestTimeout must be at least 1000ms');
    }
    
    if (crawlerConfig.maxDepth < 1) {
        errors.push('maxDepth must be at least 1');
    }
    
    if (crawlerConfig.minDelay > crawlerConfig.maxDelay) {
        errors.push('minDelay cannot be greater than maxDelay');
    }
    
    if (crawlerConfig.maxContentSize < 2048) {
        errors.push('maxContentSize must be at least 1KB');
    }
    
    if (errors.length > 0) {
        throw new Error(`Crawler configuration validation failed:\n${errors.join('\n')}`);
    }
    
    return true;
}

// Helper functions
const configHelpers = {
    // Get adaptive timeout based on URL pattern
    getAdaptiveTimeout: (url) => {
        if (!crawlerConfig.networkResilience.enableTimeoutAdaptation) {
            return crawlerConfig.requestTimeout;
        }
        
        const urlLower = url.toLowerCase();
        
        // Check each pattern category
        for (const [category, config] of Object.entries(crawlerConfig.urlPatterns)) {
            if (config.patterns.some(pattern => urlLower.includes(pattern.toLowerCase()))) {
                return config.timeout;
            }
        }
        
        return crawlerConfig.baseTimeout || crawlerConfig.requestTimeout;
    },
    
    // Get retry strategy based on error type
    getRetryStrategy: (error) => {
        if (!crawlerConfig.networkResilience.enableAdaptiveRetry) {
            return { 
                maxRetries: crawlerConfig.maxRetries, 
                delay: crawlerConfig.retryDelay, 
                backoff: 1.0 
            };
        }
        
        // Check for specific error codes
        const errorCode = error.code || error.message || '';
        const statusCode = error.statusCode || error.status;
        
        // HTTP status code errors
        if (statusCode) {
            if (statusCode >= 400 && statusCode < 500) {
                return crawlerConfig.retryStrategies['HTTP_4XX'];
            } else if (statusCode >= 500) {
                return crawlerConfig.retryStrategies['HTTP_5XX'];
            }
        }
        
        // Network errors
        if (errorCode.includes('ECONNRESET')) {
            return crawlerConfig.retryStrategies['ECONNRESET'];
        } else if (errorCode.includes('ETIMEDOUT')) {
            return crawlerConfig.retryStrategies['ETIMEDOUT'];
        } else if (errorCode.includes('ENOTFOUND')) {
            return crawlerConfig.retryStrategies['ENOTFOUND'];
        } else if (errorCode.includes('EHOSTUNREACH')) {
            return crawlerConfig.retryStrategies['EHOSTUNREACH'];
        } else if (errorCode.includes('ECONNREFUSED')) {
            return crawlerConfig.retryStrategies['ECONNREFUSED'];
        } else if (errorCode.includes('redirect loop')) {
            return crawlerConfig.retryStrategies['REDIRECT_LOOP'];
        }
        
        // Default strategy
        return { 
            maxRetries: crawlerConfig.maxRetries, 
            delay: crawlerConfig.retryDelay, 
            backoff: 1.0 
        };
    },
    
    // Check if error is temporary (worth retrying)
    isTemporaryError: (error) => {
        const errorCode = error.code || error.message || '';
        const statusCode = error.statusCode || error.status;
        
        // Check for temporary error codes
        if (crawlerConfig.networkResilience.temporaryErrors.some(temp => 
            errorCode.includes(temp))) {
            return true;
        }
        
        // Check for retryable HTTP codes
        if (statusCode && crawlerConfig.networkResilience.retryableHttpCodes.includes(statusCode)) {
            return true;
        }
        
        return false;
    },
    
    // Get timeout for specific content type
    getTimeoutForContentType: (contentType) => {
        if (contentType.includes('pdf')) {
            return crawlerConfig.pdfTextExtractionTimeout;
        }
        return crawlerConfig.requestTimeout;
    },
    
    // Get max size for specific content type
    getMaxSizeForContentType: (contentType) => {
        if (contentType.includes('html')) {
            return crawlerConfig.maxPageSize;
        } else if (contentType.includes('pdf')) {
            return crawlerConfig.maxPdfSize;
        } else if (contentType.includes('image')) {
            return crawlerConfig.maxImageSize;
        }
        return crawlerConfig.maxContentSize;
    },
    
    // Check if URL should be excluded
    shouldExcludeUrl: (url) => {
        return crawlerConfig.excludedUrlPatterns && crawlerConfig.excludedUrlPatterns.some(pattern => pattern.test(url));
    },
    
    // Check if content type is allowed
    isContentTypeAllowed: (contentType) => {
        return crawlerConfig.allowedContentTypes && crawlerConfig.allowedContentTypes.some(allowed => 
            contentType.toLowerCase().includes(allowed.toLowerCase())
        );
    },
    
    // Get delay based on current settings
    getRandomDelay: () => {
        const min = crawlerConfig.minDelay;
        const max = crawlerConfig.maxDelay;
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },
    
    // Update configuration at runtime
    updateConfig: (updates) => {
        Object.assign(crawlerConfig, updates);
        validateConfig();
    },
    
    // Get configuration for specific environment
    getEnvironmentConfig: (env) => {
        const config = { ...crawlerConfig };
        
        if (env === 'test') {
            config.maxConcurrentRequests = 1;
            config.respectRateLimit = false;
            config.minDelay = 100;
            config.maxDelay = 200;
            config.development.enableTestMode = true;
        }
        
        return config;
    }
};

// Validate configuration on load
validateConfig();

module.exports = {
    crawlerConfig,
    validateConfig,
    configHelpers
}; 