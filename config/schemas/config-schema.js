/**
 * Configuration Schema Definition - Problem 24 Solution
 * 
 * Comprehensive schema validation for all configuration options
 */

const Joi = require('joi');

// Custom validators
const validators = {
    // URL validator
    url: Joi.string().uri({ scheme: ['http', 'https'] }),
    
    // Port validator
    port: Joi.number().port(),
    
    // File path validator
    filePath: Joi.string().pattern(/^[a-zA-Z0-9_\-\/\\.]+$/),
    
    // Secret key validator (minimum security requirements)
    secretKey: Joi.string().min(32).pattern(/^[a-zA-Z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]+$/),
    
    // Duration in milliseconds
    duration: Joi.number().positive(),
    
    // Log level validator
    logLevel: Joi.string().valid('error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'),
    
    // Environment validator
    environment: Joi.string().valid('development', 'test', 'staging', 'production')
};

// Database configuration schema
const databaseSchema = Joi.object({
    host: Joi.string().hostname().default('localhost'),
    port: validators.port.default(3306),
    name: Joi.string().alphanum().min(1).max(64).required(),
    user: Joi.string().alphanum().min(1).max(32).required(),
    password: Joi.string().min(8).required(),
    
    // Connection pool settings
    connectionLimit: Joi.number().min(1).max(100).default(20),
    acquireTimeout: validators.duration.default(60000),
    timeout: validators.duration.default(60000),
    
    // Advanced settings
    charset: Joi.string().default('utf8mb4'),
    timezone: Joi.string().default('UTC'),
    ssl: Joi.boolean().default(false),
    reconnect: Joi.boolean().default(true),
    
    // Performance settings
    enablePerformanceOptimization: Joi.boolean().default(true),
    enableQueryCaching: Joi.boolean().default(true),
    enableSlowQueryLogging: Joi.boolean().default(true),
    slowQueryThreshold: validators.duration.default(1000),
    cacheDefaultTTL: validators.duration.default(300)
}).required();

// Elasticsearch configuration schema
const elasticsearchSchema = Joi.object({
    url: validators.url.required(),
    host: Joi.string().hostname().default('localhost'),
    port: validators.port.default(9200),
    
    // Authentication
    username: Joi.string().default('elastic'),
    password: Joi.string().required(),
    apiKey: Joi.string().allow(''),
    cloudId: Joi.string().allow(''),
    
    // SSL/TLS configuration
    ssl: Joi.object({
        verify: Joi.boolean().default(false),
        ca: Joi.string().allow(''),
        cert: Joi.string().allow(''),
        key: Joi.string().allow(''),
        rejectUnauthorized: Joi.boolean().default(false)
    }).default({}),
    
    // Connection settings
    maxRetries: Joi.number().min(0).max(10).default(3),
    requestTimeout: validators.duration.default(30000),
    pingTimeout: validators.duration.default(3000),
    keepAlive: Joi.boolean().default(true),
    maxSockets: Joi.number().min(1).max(100).default(50),
    
    // Index configuration
    indices: Joi.object({
        main: Joi.string().default('bhoomy_search'),
        analytics: Joi.string().default('search_analytics'),
        images: Joi.string().default('site_img'),
        videos: Joi.string().default('site_videos'),
        documents: Joi.string().default('site_doc')
    }).default({})
}).required();

// Redis configuration schema
const redisSchema = Joi.object({
    enabled: Joi.boolean().default(false),
    host: Joi.string().hostname().default('localhost'),
    port: validators.port.default(6379),
    password: Joi.string().allow(''),
    db: Joi.number().min(0).max(15).default(0),
    
    // Connection settings
    maxConnections: Joi.number().min(1).max(100).default(10),
    retryDelayOnFailover: validators.duration.default(100),
    enableOfflineQueue: Joi.boolean().default(false),
    
    // Key management
    keyPrefix: Joi.string().default('bhoomy:'),
    compression: Joi.boolean().default(true),
    
    // TTL settings
    defaultTTL: validators.duration.default(3600),
    searchCacheTTL: validators.duration.default(600),
    imageCacheTTL: validators.duration.default(1800),
    videoCacheTTL: validators.duration.default(3600)
}).default({});

// Application configuration schema
const appSchema = Joi.object({
    name: Joi.string().default('Bhoomy Search Engine'),
    version: Joi.string().pattern(/^\d+\.\d+\.\d+$/).default('1.0.0'),
    description: Joi.string().default('Advanced Search Engine Platform'),
    
    // Server settings
    port: validators.port.default(3000),
    host: Joi.string().hostname().default('localhost'),
    env: validators.environment.default('development'),
    
    // Operational settings
    debug: Joi.boolean().default(false),
    maintenance: Joi.boolean().default(false),
    
    // Process settings
    maxMemory: Joi.string().default('2048'),
    clusterWorkers: Joi.alternatives().try(
        Joi.string().valid('auto'),
        Joi.number().min(1).max(16)
    ).default('auto'),
    
    // CORS settings
    cors: Joi.object({
        enabled: Joi.boolean().default(true),
        origins: Joi.alternatives().try(
            Joi.string(),
            Joi.array().items(Joi.string())
        ).default('*'),
        credentials: Joi.boolean().default(false),
        optionsSuccessStatus: Joi.number().default(204)
    }).default({})
}).required();

// Security configuration schema
const securitySchema = Joi.object({
    // Authentication secrets
    jwtSecret: validators.secretKey.required(),
    sessionSecret: validators.secretKey.required(),
    encryptionKey: Joi.string().hex().length(64).optional(),
    
    // Rate limiting
    rateLimiting: Joi.object({
        enabled: Joi.boolean().default(true),
        maxRequests: Joi.number().min(1).max(10000).default(1000),
        windowMs: validators.duration.default(900000), // 15 minutes
        skipSuccessfulRequests: Joi.boolean().default(false),
        skipFailedRequests: Joi.boolean().default(false),
        standardHeaders: Joi.boolean().default(true),
        legacyHeaders: Joi.boolean().default(false)
    }).default({}),
    
    // Session configuration
    session: Joi.object({
        name: Joi.string().default('bhoomySession'),
        resave: Joi.boolean().default(false),
        saveUninitialized: Joi.boolean().default(false),
        rolling: Joi.boolean().default(true),
        maxAge: validators.duration.default(86400000), // 24 hours
        httpOnly: Joi.boolean().default(true),
        secure: Joi.boolean().default(false),
        sameSite: Joi.string().valid('strict', 'lax', 'none').default('lax')
    }).default({}),
    
    // Security headers
    headers: Joi.object({
        contentSecurityPolicy: Joi.boolean().default(true),
        crossOriginEmbedderPolicy: Joi.boolean().default(false),
        crossOriginOpenerPolicy: Joi.boolean().default(false),
        crossOriginResourcePolicy: Joi.boolean().default(false),
        originAgentCluster: Joi.boolean().default(false),
        referrerPolicy: Joi.string().default('no-referrer'),
        strictTransportSecurity: Joi.boolean().default(true),
        xContentTypeOptions: Joi.boolean().default(true),
        xDnsPrefetchControl: Joi.boolean().default(true),
        xFrameOptions: Joi.string().valid('DENY', 'SAMEORIGIN').default('DENY'),
        xPermittedCrossDomainPolicies: Joi.boolean().default(false),
        xPoweredBy: Joi.boolean().default(false),
        xXssProtection: Joi.boolean().default(true)
    }).default({})
}).required();

// Logging configuration schema
const loggingSchema = Joi.object({
    level: validators.logLevel.default('info'),
    
    // File logging
    file: validators.filePath.default('logs/app.log'),
    errorFile: validators.filePath.default('logs/error.log'),
    maxSize: Joi.string().default('10m'),
    maxFiles: Joi.number().min(1).max(100).default(5),
    
    // Console logging
    enableConsole: Joi.boolean().default(true),
    colorize: Joi.boolean().default(true),
    
    // Format settings
    format: Joi.string().valid('json', 'simple', 'combined').default('json'),
    timestamp: Joi.boolean().default(true),
    
    // Performance logging
    enablePerformanceLogs: Joi.boolean().default(true),
    enableSlowQueryLogs: Joi.boolean().default(true),
    enableAccessLogs: Joi.boolean().default(true),
    
    // Log rotation
    enableRotation: Joi.boolean().default(true),
    rotationInterval: Joi.string().valid('daily', 'weekly', 'monthly').default('daily'),
    
    // Structured logging
    enableStructuredLogs: Joi.boolean().default(true),
    logRequestId: Joi.boolean().default(true),
    logUserAgent: Joi.boolean().default(true)
}).default({});

// Performance configuration schema
const performanceSchema = Joi.object({
    // Caching
    enableCaching: Joi.boolean().default(true),
    cacheDefaultTTL: validators.duration.default(300),
    cacheMaxSize: Joi.number().min(1).max(10000).default(1000),
    
    // Compression
    enableCompression: Joi.boolean().default(true),
    compressionLevel: Joi.number().min(1).max(9).default(6),
    compressionThreshold: Joi.number().min(0).default(1024),
    
    // Database performance
    enableDatabasePooling: Joi.boolean().default(true),
    enableQueryOptimization: Joi.boolean().default(true),
    enableIndexOptimization: Joi.boolean().default(true),
    
    // Search performance
    enableSearchCaching: Joi.boolean().default(true),
    enableResultPrefetching: Joi.boolean().default(true),
    enableQueryExpansion: Joi.boolean().default(true),
    
    // Monitoring
    enablePerformanceMonitoring: Joi.boolean().default(true),
    monitoringInterval: validators.duration.default(60000),
    enableAlerts: Joi.boolean().default(true),
    alertThresholds: Joi.object({
        responseTime: validators.duration.default(1000),
        memoryUsage: Joi.number().min(0).max(100).default(80),
        cpuUsage: Joi.number().min(0).max(100).default(80),
        errorRate: Joi.number().min(0).max(100).default(5)
    }).default({})
}).default({});

// Search configuration schema
const searchSchema = Joi.object({
    // Result settings
    resultsPerPage: Joi.number().min(1).max(100).default(20),
    maxResults: Joi.number().min(1).max(10000).default(1000),
    highlightLength: Joi.number().min(50).max(500).default(200),
    
    // Query settings
    minQueryLength: Joi.number().min(1).max(10).default(2),
    maxQueryLength: Joi.number().min(10).max(1000).default(200),
    
    // Feature flags
    enableAutoComplete: Joi.boolean().default(true),
    enableSpellCheck: Joi.boolean().default(true),
    enableFacetedSearch: Joi.boolean().default(true),
    enableSemanticSearch: Joi.boolean().default(false),
    enableImageSearch: Joi.boolean().default(true),
    enableVideoSearch: Joi.boolean().default(true),
    enableDocumentSearch: Joi.boolean().default(true),
    enableNewsSearch: Joi.boolean().default(true),
    
    // Advanced features
    enableFuzzySearch: Joi.boolean().default(true),
    enablePhraseSearch: Joi.boolean().default(true),
    enableWildcardSearch: Joi.boolean().default(true),
    enableBoostFields: Joi.boolean().default(true),
    enableHighlight: Joi.boolean().default(true),
    enableAggregations: Joi.boolean().default(true),
    
    // Filters
    enableDateFilters: Joi.boolean().default(true),
    enableCategoryFilters: Joi.boolean().default(true),
    enableLanguageFilters: Joi.boolean().default(true),
    enableCountryFilters: Joi.boolean().default(true),
    
    // Analytics
    enableSearchAnalytics: Joi.boolean().default(true),
    enableSearchSuggestions: Joi.boolean().default(true),
    trackSearchQueries: Joi.boolean().default(true),
    trackClickThrough: Joi.boolean().default(true),
    analyticsRetentionDays: Joi.number().min(1).max(365).default(180)
}).default({});

// API configuration schema
const apiSchema = Joi.object({
    version: Joi.string().default('v1'),
    prefix: Joi.string().default('/api'),
    
    // API features
    enableCors: Joi.boolean().default(true),
    enableCompression: Joi.boolean().default(true),
    enableRateLimiting: Joi.boolean().default(true),
    enableValidation: Joi.boolean().default(true),
    enableDocumentation: Joi.boolean().default(true),
    
    // Response settings
    enablePagination: Joi.boolean().default(true),
    defaultPageSize: Joi.number().min(1).max(100).default(20),
    maxPageSize: Joi.number().min(1).max(1000).default(100),
    
    // Security
    enableApiKeys: Joi.boolean().default(false),
    enableJwtAuth: Joi.boolean().default(true),
    enableRequestLogging: Joi.boolean().default(true),
    
    // External APIs
    externalApis: Joi.object({
        youtube: Joi.object({
            enabled: Joi.boolean().default(true),
            apiKey: Joi.string().allow(''),
            quotaLimit: Joi.number().min(0).default(10000)
        }).default({}),
        google: Joi.object({
            enabled: Joi.boolean().default(false),
            apiKey: Joi.string().allow(''),
            searchEngineId: Joi.string().allow('')
        }).default({})
    }).default({})
}).default({});

// UI configuration schema
const uiSchema = Joi.object({
    theme: Joi.string().valid('light', 'dark', 'auto').default('light'),
    language: Joi.string().length(2).default('en'),
    resultsLayout: Joi.string().valid('list', 'grid', 'card').default('list'),
    
    // Feature toggles
    enableFilters: Joi.boolean().default(true),
    enableSorting: Joi.boolean().default(true),
    enableSuggestions: Joi.boolean().default(true),
    enableInfiniteScroll: Joi.boolean().default(false),
    enableKeyboardShortcuts: Joi.boolean().default(true),
    
    // Performance
    lazyLoadImages: Joi.boolean().default(true),
    enableVirtualization: Joi.boolean().default(false),
    enablePrefetching: Joi.boolean().default(true),
    
    // Customization
    brandName: Joi.string().default('Bhoomy Search'),
    brandLogo: Joi.string().allow(''),
    customCSS: Joi.string().allow(''),
    customJS: Joi.string().allow('')
}).default({});

// Monitoring configuration schema
const monitoringSchema = Joi.object({
    enabled: Joi.boolean().default(true),
    
    // Health checks
    healthCheckEnabled: Joi.boolean().default(true),
    healthCheckInterval: validators.duration.default(30000),
    healthCheckPath: Joi.string().default('/health'),
    
    // Metrics
    metricsEnabled: Joi.boolean().default(true),
    metricsPort: validators.port.default(9090),
    metricsPath: Joi.string().default('/metrics'),
    
    // Alerting
    alerting: Joi.object({
        enabled: Joi.boolean().default(true),
        channels: Joi.array().items(
            Joi.string().valid('email', 'slack', 'webhook', 'console')
        ).default(['console']),
        thresholds: Joi.object({
            responseTime: validators.duration.default(5000),
            errorRate: Joi.number().min(0).max(100).default(5),
            memoryUsage: Joi.number().min(0).max(100).default(90),
            diskUsage: Joi.number().min(0).max(100).default(90)
        }).default({})
    }).default({})
}).default({});

// Main configuration schema
const configSchema = Joi.object({
    // Core configurations
    app: appSchema,
    database: databaseSchema,
    elasticsearch: elasticsearchSchema,
    redis: redisSchema,
    
    // Feature configurations
    security: securitySchema,
    logging: loggingSchema,
    performance: performanceSchema,
    search: searchSchema,
    api: apiSchema,
    ui: uiSchema,
    monitoring: monitoringSchema,
    
    // Metadata (automatically populated)
    _metadata: Joi.object({
        loadTime: Joi.string().isoDate(),
        environment: validators.environment,
        configSources: Joi.array().items(Joi.object()),
        version: Joi.string()
    }).default({})
}).options({
    allowUnknown: false,
    stripUnknown: true
});

// Environment-specific schema overrides
const environmentSchemas = {
    development: configSchema.concat(Joi.object({
        app: Joi.object({
            debug: Joi.boolean().default(true),
            port: validators.port.default(3000)
        }),
        logging: Joi.object({
            level: validators.logLevel.default('debug'),
            enableConsole: Joi.boolean().default(true)
        }),
        performance: Joi.object({
            enableCaching: Joi.boolean().default(false)
        })
    })),
    
    test: configSchema.concat(Joi.object({
        app: Joi.object({
            port: validators.port.default(3001)
        }),
        database: Joi.object({
            name: Joi.string().default('mybhoomy_test')
        }),
        logging: Joi.object({
            level: validators.logLevel.default('warn'),
            enableConsole: Joi.boolean().default(false)
        })
    })),
    
    staging: configSchema.concat(Joi.object({
        app: Joi.object({
            debug: Joi.boolean().default(false),
            port: validators.port.default(8080)
        }),
        security: Joi.object({
            rateLimiting: Joi.object({
                maxRequests: Joi.number().default(2000)
            })
        })
    })),
    
    production: configSchema.concat(Joi.object({
        app: Joi.object({
            debug: Joi.boolean().default(false),
            port: validators.port.default(80)
        }),
        logging: Joi.object({
            level: validators.logLevel.default('warn'),
            enableConsole: Joi.boolean().default(false)
        }),
        security: Joi.object({
            session: Joi.object({
                secure: Joi.boolean().default(true)
            }),
            rateLimiting: Joi.object({
                maxRequests: Joi.number().default(500)
            })
        })
    }))
};

module.exports = {
    schema: configSchema,
    environmentSchemas,
    validators
};
