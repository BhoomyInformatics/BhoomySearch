const elasticConfig = {
    // Connection settings
    node: process.env.ELASTICSEARCH_URL || 'https://localhost:9200',
    auth: {
        username: process.env.ELASTICSEARCH_USERNAME || 'elastic',
        password: process.env.ELASTICSEARCH_PASSWORD || 'MtuWUQonC5bUkcGyfPwh'
    },
    
    // SSL/TLS Configuration
    tls: {
        rejectUnauthorized: false, // For development with self-signed certificates
        // Add certificate verification bypass for Node.js
        ca: null,
        cert: null,
        key: null,
        secureProtocol: 'TLSv1_2_method'
    },
    
    // Additional SSL/TLS settings for Node.js client
    ssl: {
        rejectUnauthorized: false,
        checkServerIdentity: () => undefined // Disable server identity check
    },
    
    // Connection timeouts and retries
    requestTimeout: 60000, // 60 seconds (increased for high load)
    pingTimeout: 5000, // 5 seconds
    maxRetries: 5, // Increased retry attempts
    retryOnStatusCode: [502, 503, 504], // Retry on server errors
    
    // Connection Pool Configuration (Undici-compatible) - REDUCED for stability
    maxConnections: 2000, // REDUCED from 200 to 2000 to prevent connection exhaustion
    deadTimeout: 60000, // Time to wait before retrying a dead node
    connectionIdleTimeout: 30000, // Close idle connections after 30 seconds
    
    // Compression and performance
    compression: 'gzip', // Enable compression for better throughput
    sniffOnStart: false, // Disable node discovery for single-node setup
    sniffOnConnectionFault: false, // Disable sniffing on connection faults
    
    // Index settings
    indexName: process.env.ELASTICSEARCH_INDEX || 'bhoomy_search',
    indexPrefix: process.env.ELASTICSEARCH_INDEX_PREFIX || 'bhoomy',
    
    // Bulk operations
    batchSize: 2000,
    bulkTimeout: 30000, // 30 seconds
    maxBulkSize: 10 * 1024 * 1024, // 10MB
    
    // Index configuration
    indexSettings: {
        number_of_shards: 1,
        number_of_replicas: 0,
        refresh_interval: '30s',
        max_result_window: 50000,
        analysis: {
            analyzer: {
                content_analyzer: {
                    type: 'custom',
                    tokenizer: 'standard',
                    filter: [
                        'lowercase',
                        'stop',
                        'stemmer',
                        'word_delimiter'
                    ]
                },
                search_analyzer: {
                    type: 'custom',
                    tokenizer: 'standard',
                    filter: [
                        'lowercase',
                        'stop',
                        'stemmer'
                    ]
                }
            },
            filter: {
                stemmer: {
                    type: 'stemmer',
                    language: 'english'
                },
                word_delimiter: {
                    type: 'word_delimiter',
                    generate_word_parts: true,
                    generate_number_parts: true,
                    catenate_words: true,
                    catenate_numbers: true,
                    catenate_all: false,
                    split_on_case_change: true
                }
            }
        }
    },
    
    // Field mappings
    mappings: {
        properties: {
            site_id: {
                type: 'integer'
            },
            site_url: {
                type: 'keyword',
                index: true
            },
            db_id: {
                type: 'integer'
            },
            title: {
                type: 'text',
                analyzer: 'content_analyzer',
                search_analyzer: 'search_analyzer',
                fields: {
                    keyword: {
                        type: 'keyword',
                        ignore_above: 256
                    }
                }
            },
            description: {
                type: 'text',
                analyzer: 'content_analyzer',
                search_analyzer: 'search_analyzer'
            },
            keywords: {
                type: 'text',
                analyzer: 'content_analyzer',
                search_analyzer: 'search_analyzer'
            },
            content: {
                type: 'text',
                analyzer: 'content_analyzer',
                search_analyzer: 'search_analyzer'
            },
            headings: {
                properties: {
                    h1: {
                        type: 'text',
                        analyzer: 'content_analyzer',
                        boost: 2.0
                    },
                    h2: {
                        type: 'text',
                        analyzer: 'content_analyzer',
                        boost: 1.5
                    },
                    h3: {
                        type: 'text',
                        analyzer: 'content_analyzer'
                    },
                    h4: {
                        type: 'text',
                        analyzer: 'content_analyzer'
                    }
                }
            },
            links: {
                type: 'nested',
                properties: {
                    url: {
                        type: 'keyword'
                    },
                    text: {
                        type: 'text',
                        analyzer: 'content_analyzer'
                    },
                    title: {
                        type: 'text',
                        analyzer: 'content_analyzer'
                    }
                }
            },
            images: {
                type: 'nested',
                properties: {
                    url: {
                        type: 'keyword'
                    },
                    alt: {
                        type: 'text',
                        analyzer: 'content_analyzer'
                    },
                    title: {
                        type: 'text',
                        analyzer: 'content_analyzer'
                    },
                    width: {
                        type: 'integer'
                    },
                    height: {
                        type: 'integer'
                    }
                }
            },
            videos: {
                type: 'nested',
                properties: {
                    url: {
                        type: 'keyword'
                    },
                    title: {
                        type: 'text',
                        analyzer: 'content_analyzer'
                    },
                    type: {
                        type: 'keyword'
                    }
                }
            },
            metadata: {
                type: 'object',
                enabled: true
            },
            analytics: {
                type: 'text',
                index: false
            },
            icon: {
                type: 'keyword',
                index: false
            },
            crawl_date: {
                type: 'date',
                format: 'strict_date_optional_time||epoch_millis'
            },
            domain: {
                type: 'keyword'
            },
            url_path: {
                type: 'keyword'
            },
            content_length: {
                type: 'integer'
            },
            links_count: {
                type: 'integer'
            },
            images_count: {
                type: 'integer'
            },
            videos_count: {
                type: 'integer'
            },
            page_type: {
                type: 'keyword'
            },
            language: {
                type: 'keyword'
            },
            quality_score: {
                type: 'float'
            },
            last_updated: {
                type: 'date',
                format: 'strict_date_optional_time||epoch_millis'
            }
        }
    },
    
    // Search settings
    search: {
        defaultSize: 20,
        maxSize: 100,
        highlightFragmentSize: 150,
        highlightFragments: 3,
        fuzziness: 'AUTO',
        minimumShouldMatch: '75%'
    },
    
    // Aggregation settings
    aggregations: {
        maxBuckets: 10000,
        defaultSize: 10
    },
    
    // Performance settings
    performance: {
        enableCaching: true,
        cacheSize: 1000,
        cacheTtl: 300000, // 5 minutes
        enableCompression: true,
        enableSniffing: false,
        maxSockets: 20,
        keepAlive: true
    },
    
    // Monitoring settings
    monitoring: {
        enabled: true,
        logQueries: process.env.NODE_ENV !== 'production',
        logSlowQueries: true,
        slowQueryThreshold: 1000, // 1 second
        enableMetrics: true
    },
    
    // Index lifecycle management
    lifecycle: {
        enableIlm: false,
        hotPhase: {
            maxSize: '50gb',
            maxAge: '30d'
        },
        warmPhase: {
            maxAge: '90d'
        },
        coldPhase: {
            maxAge: '365d'
        },
        deletePhase: {
            maxAge: '2y'
        }
    },
    
    // Backup and restore
    backup: {
        enabled: false,
        repository: 'backup_repository',
        schedule: '0 2 * * *', // Daily at 2 AM
        retentionDays: 30
    }
};

// Environment-specific overrides
if (process.env.NODE_ENV === 'production') {
    // Production settings
    elasticConfig.indexSettings.number_of_replicas = 1;
    elasticConfig.indexSettings.refresh_interval = '1s';
    elasticConfig.performance.enableSniffing = true;
    elasticConfig.lifecycle.enableIlm = true;
    elasticConfig.backup.enabled = true;
    elasticConfig.monitoring.logQueries = false;
} else if (process.env.NODE_ENV === 'development') {
    // Development settings
    elasticConfig.indexSettings.refresh_interval = '1s';
    elasticConfig.monitoring.logQueries = true;
    elasticConfig.batchSize = 10;
} else if (process.env.NODE_ENV === 'test') {
    // Test settings
    elasticConfig.indexName = 'test_bhoomy_search';
    elasticConfig.batchSize = 5;
    elasticConfig.monitoring.enabled = false;
}

// Validation function
function validateElasticConfig() {
    const errors = [];
    
    if (!elasticConfig.node) {
        errors.push('Elasticsearch node URL is required');
    }
    
    if (!elasticConfig.indexName) {
        errors.push('Index name is required');
    }
    
    if (elasticConfig.batchSize < 1) {
        errors.push('Batch size must be at least 1');
    }
    
    if (elasticConfig.requestTimeout < 1000) {
        errors.push('Request timeout must be at least 1000ms');
    }
    
    if (elasticConfig.search.defaultSize < 1) {
        errors.push('Default search size must be at least 1');
    }
    
    if (elasticConfig.search.maxSize < elasticConfig.search.defaultSize) {
        errors.push('Max search size must be greater than or equal to default size');
    }
    
    if (errors.length > 0) {
        throw new Error(`Elasticsearch configuration validation failed:\n${errors.join('\n')}`);
    }
    
    return true;
}

// Helper functions
const elasticHelpers = {
    // Get full index name with prefix
    getFullIndexName: () => {
        return elasticConfig.indexPrefix ? 
            `${elasticConfig.indexPrefix}_${elasticConfig.indexName}` : 
            elasticConfig.indexName;
    },
    
    // Get index name for specific date (for time-based indices)
    getDateIndexName: (date = new Date()) => {
        const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
        return `${elasticHelpers.getFullIndexName()}_${dateStr}`;
    },
    
    // Build search query
    buildSearchQuery: (query, options = {}) => {
        const searchBody = {
            query: {
                multi_match: {
                    query: query,
                    fields: [
                        'title^3',
                        'description^2',
                        'content',
                        'keywords^2',
                        'article^2',
                        'headings.h1^2',
                        'headings.h2^1.5',
                        'headings.h3',
                        'headings.h4'
                    ],
                    type: 'best_fields',
                    fuzziness: options.fuzziness || elasticConfig.search.fuzziness,
                    minimum_should_match: options.minimumShouldMatch || elasticConfig.search.minimumShouldMatch
                }
            },
            highlight: {
                fields: {
                    title: {},
                    description: {},
                    content: {
                        fragment_size: elasticConfig.search.highlightFragmentSize,
                        number_of_fragments: elasticConfig.search.highlightFragments
                    }
                }
            },
            size: options.size || elasticConfig.search.defaultSize,
            from: options.from || 0
        };
        
        // Add filters if provided
        if (options.filters) {
            searchBody.query = {
                bool: {
                    must: [searchBody.query],
                    filter: options.filters
                }
            };
        }
        
        // Add sorting if provided
        if (options.sort) {
            searchBody.sort = options.sort;
        }
        
        return searchBody;
    },
    
    // Build aggregation query
    buildAggregationQuery: (aggregations) => {
        const aggs = {};
        
        if (aggregations.includes('domains')) {
            aggs.domains = {
                terms: {
                    field: 'domain',
                    size: elasticConfig.aggregations.defaultSize
                }
            };
        }
        
        if (aggregations.includes('content_types')) {
            aggs.content_types = {
                terms: {
                    field: 'page_type',
                    size: elasticConfig.aggregations.defaultSize
                }
            };
        }
        
        if (aggregations.includes('languages')) {
            aggs.languages = {
                terms: {
                    field: 'language',
                    size: elasticConfig.aggregations.defaultSize
                }
            };
        }
        
        if (aggregations.includes('date_histogram')) {
            aggs.crawl_dates = {
                date_histogram: {
                    field: 'crawl_date',
                    calendar_interval: 'day'
                }
            };
        }
        
        return aggs;
    },
    
    // Update configuration at runtime
    updateConfig: (updates) => {
        Object.assign(elasticConfig, updates);
        validateElasticConfig();
    },
    
    // Get configuration for specific environment
    getEnvironmentConfig: (env) => {
        const config = { ...elasticConfig };
        
        if (env === 'test') {
            config.indexName = 'test_bhoomy_search';
            config.batchSize = 10;
            config.monitoring.enabled = false;
        }
        
        return config;
    },
    
    // Generate index template
    getIndexTemplate: () => {
        return {
            index_patterns: [`${elasticHelpers.getFullIndexName()}*`],
            settings: elasticConfig.indexSettings,
            mappings: elasticConfig.mappings
        };
    }
};

// Validate configuration on load
validateElasticConfig();

module.exports = {
    elasticConfig,
    validateElasticConfig,
    elasticHelpers
}; 