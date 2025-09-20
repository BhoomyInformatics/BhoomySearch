const { logger } = require('../utils/logger');

/**
 * Enhanced Error Handling Configuration
 * 
 * This configuration provides robust error handling for the web crawler
 */

module.exports = {
    // HTTP Error Handling
    httpErrors: {
        // Retry configuration for different HTTP status codes
        retryableCodes: [408, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524],
        nonRetryableCodes: [400, 401, 403, 404, 405, 406, 407, 409, 410, 411, 412, 413, 414, 415, 416, 417, 418, 421, 422, 423, 424, 426, 428, 431, 451],
        
        // Retry settings
        maxRetries: 3,
        retryDelay: 2000,
        backoffMultiplier: 1.5,
        
        // Specific error handling
        rateLimitDelay: 5000,
        serverErrorDelay: 3000,
        clientErrorDelay: 1000
    },

    // Network Error Handling
    networkErrors: {
        // Connection errors
        connectionErrors: ['ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND', 'EHOSTUNREACH', 'ETIMEDOUT'],
        
        // SSL/TLS errors
        sslErrors: ['ECONNRESET', 'ENOTFOUND', 'CERT_HAS_EXPIRED', 'CERT_NOT_YET_VALID'],
        
        // DNS errors
        dnsErrors: ['ENOTFOUND', 'EHOSTUNREACH'],
        
        // Retry settings for network errors
        maxRetries: 2,
        retryDelay: 3000,
        backoffMultiplier: 2.0
    },

    // Redirect Handling
    redirects: {
        maxRedirects: 5,
        maxRedirectDepth: 3,
        allowRedirects: true,
        
        // Redirect loop detection
        loopDetection: true,
        maxLoopCount: 3,
        
        // Redirect status codes
        redirectCodes: [301, 302, 303, 307, 308],
        
        // Skip redirects for certain status codes
        skipRedirectsFor: [404, 410, 451]
    },

    // URL Validation and Cleaning
    urlValidation: {
        // Maximum URL length
        maxUrlLength: 2048,
        
        // Allowed protocols
        allowedProtocols: ['http:', 'https:'],
        
        // URL cleaning options
        removeTrailingSlash: false,
        normalizeProtocol: true,
        removeFragment: true,
        removeQueryParams: false,
        
        // Malformed URL handling
        fixMalformedUrls: true,
        removeTrailingPunctuation: true,
        removeBrackets: true,
        
        // URL patterns to skip
        skipPatterns: [
            /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|tar|gz|mp3|mp4|avi|mov|wmv|flv|webm|ogg|wav|jpg|jpeg|png|gif|bmp|svg|ico|css|js|xml|json|txt|log|csv)$/i,
            /^mailto:/,
            /^tel:/,
            /^javascript:/,
            /^data:/,
            /^ftp:/,
            /^file:/
        ]
    },

    // Robots.txt Handling
    robotsTxt: {
        // Respect robots.txt by default
        respectRobots: true,
        
        // Sites that should bypass robots.txt (for important content)
        bypassRobotsFor: [
            'news',
            'article',
            'blog',
            'content',
            'story',
            'post'
        ],
        
        // User agents to use when robots.txt is blocking
        userAgents: [
            'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
            'Mozilla/5.0 (compatible; Bingbot/2.0; +http://www.bing.com/bingbot.htm)',
            'Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)',
            'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)',
            'Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)'
        ],
        
        // Delay when robots.txt blocks
        blockedDelay: 1000,
        
        // Retry with different user agent when blocked
        retryWithDifferentUserAgent: true,
        maxUserAgentRetries: 2
    },

    // Content Processing
    contentProcessing: {
        // Maximum content size
        maxContentSize: '10MB',
        
        // Content type handling
        allowedContentTypes: [
            'text/html',
            'application/xhtml+xml',
            'application/xml',
            'text/xml'
        ],
        
        // Character encoding
        defaultEncoding: 'utf-8',
        fallbackEncodings: ['iso-8859-1', 'windows-1252', 'ascii'],
        
        // Content extraction
        extractText: true,
        extractLinks: true,
        extractImages: false,
        extractMeta: true,
        
        // Content cleaning
        removeScripts: true,
        removeStyles: true,
        removeComments: true,
        removeEmptyElements: true,
        
        // Minimum content length
        minContentLength: 100,
        
        // Maximum content length
        maxContentLength: 500000
    },

    // Duplicate Detection
    duplicateDetection: {
        // Enable duplicate detection
        enabled: true,
        
        // Duplicate checking methods
        checkUrlHash: true,
        checkContentHash: true,
        checkTitle: true,
        
        // Hash algorithms
        urlHashAlgorithm: 'sha256',
        contentHashAlgorithm: 'sha256',
        
        // Similarity thresholds
        titleSimilarityThreshold: 0.8,
        contentSimilarityThreshold: 0.9,
        
        // Cache settings
        maxCacheSize: 50000,
        cacheExpiry: 3600000, // 1 hour
        
        // Database storage
        useDatabaseStorage: true,
        batchSize: 100,
        
        // Memory-only fallback
        fallbackToMemory: true
    },

    // Rate Limiting
    rateLimiting: {
        // Global rate limiting
        enabled: true,
        maxRequestsPerSecond: 10,
        maxRequestsPerMinute: 300,
        
        // Per-domain rate limiting
        perDomain: {
            enabled: true,
            maxRequestsPerSecond: 2,
            maxRequestsPerMinute: 60,
            delayBetweenRequests: 1000
        },
        
        // Adaptive rate limiting
        adaptive: {
            enabled: true,
            initialDelay: 1000,
            maxDelay: 10000,
            backoffMultiplier: 1.5,
            successThreshold: 5
        }
    },

    // Timeout Configuration
    timeouts: {
        // Connection timeout
        connect: 10000,
        
        // Socket timeout
        socket: 30000,
        
        // Response timeout
        response: 45000,
        
        // DNS timeout
        dns: 10000,
        
        // Overall request timeout
        request: 60000,
        
        // Keep-alive timeout
        keepAlive: 30000
    },

    // Error Recovery
    errorRecovery: {
        // Enable error recovery
        enabled: true,
        
        // Circuit breaker settings
        circuitBreaker: {
            enabled: true,
            failureThreshold: 5,
            recoveryTimeout: 60000,
            halfOpenMaxRequests: 3
        },
        
        // Exponential backoff
        exponentialBackoff: {
            enabled: true,
            initialDelay: 1000,
            maxDelay: 30000,
            multiplier: 2.0
        },
        
        // Error categorization
        categorizeErrors: true,
        
        // Error reporting
        reportErrors: true,
        errorLogLevel: 'warn'
    },

    // Performance Optimization
    performance: {
        // Connection pooling
        connectionPool: {
            enabled: true,
            maxConnections: 100,
            maxConnectionsPerHost: 10,
            keepAlive: true,
            keepAliveMsecs: 30000
        },
        
        // Compression
        compression: {
            enabled: true,
            algorithms: ['gzip', 'deflate', 'br']
        },
        
        // Caching
        caching: {
            enabled: true,
            maxCacheSize: 1000,
            cacheExpiry: 300000 // 5 minutes
        },
        
        // Resource monitoring
        resourceMonitoring: {
            enabled: true,
            memoryThreshold: 0.8,
            cpuThreshold: 0.8,
            checkInterval: 5000
        }
    },

    // Logging Configuration
    logging: {
        // Log levels
        level: 'info',
        
        // Log formats
        format: 'json',
        
        // Log destinations
        destinations: ['console', 'file'],
        
        // Log rotation
        rotation: {
            enabled: true,
            maxSize: '10MB',
            maxFiles: 5
        },
        
        // Error logging
        errorLogging: {
            enabled: true,
            includeStack: true,
            includeContext: true
        }
    },

    // Security Settings
    security: {
        // User agent rotation
        userAgentRotation: true,
        
        // Request headers
        headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        },
        
        // SSL/TLS settings
        ssl: {
            rejectUnauthorized: false,
            secureProtocol: 'TLSv1_2_method'
        },
        
        // Proxy support
        proxy: {
            enabled: false,
            host: null,
            port: null,
            auth: null
        }
    },

    // Site-specific configurations
    siteSpecific: {
        // Government sites (slower, more retries)
        government: {
            patterns: ['.gov.', '.nic.in', '.maharashtra.gov', '.indiapost.gov'],
            timeout: 60000,
            maxRetries: 4,
            retryDelay: 8000,
            respectRobots: true
        },
        
        // Commercial sites (standard settings)
        commercial: {
            patterns: ['.com/', '.co.in/', '.org/', '.net/'],
            timeout: 30000,
            maxRetries: 2,
            retryDelay: 3000,
            respectRobots: true
        },
        
        // Social media sites (limited crawling)
        social: {
            patterns: ['facebook.com', 'twitter.com', 'instagram.com', 'linkedin.com'],
            timeout: 20000,
            maxRetries: 1,
            retryDelay: 2000,
            respectRobots: true,
            maxPages: 10
        },
        
        // E-commerce sites (comprehensive crawling)
        ecommerce: {
            patterns: ['amazon.', 'flipkart.', 'myntra.', 'paytm.', 'housing.com'],
            timeout: 25000,
            maxRetries: 2,
            retryDelay: 4000,
            respectRobots: true,
            maxPages: 100
        }
    }
}; 