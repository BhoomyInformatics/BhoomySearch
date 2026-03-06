//site.js - Updated for Elasticsearch 8+ with Modern Search Features

const { google } = require('googleapis');
const { Client } = require('@elastic/elasticsearch');
const { envManager } = require('../../../config/env-manager');
const redisCache = require('../../utils/redis-cache');
const BooleanQueryParser = require('../../utils/booleanQueryParser');

// Fallback memory cache for when Redis is unavailable
const searchCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Fast query cache for common single-word queries
const fastQueryCache = new Map();
const FAST_CACHE_TTL = 2 * 60 * 1000; // 2 minutes for fast queries

// Cache helper functions
const getCacheKey = (searchParams) => {
    return JSON.stringify({
        q: searchParams.q,
        page: searchParams.page,
        per_page: searchParams.per_page,
        filters: searchParams.filters
    });
};

const getCachedResult = async (cacheKey, searchParams) => {
    // Check fast cache for single-word queries first
    if (searchParams.q && searchParams.q.length < 20 && !searchParams.q.includes(' ')) {
        const fastCached = fastQueryCache.get(cacheKey);
        if (fastCached && (Date.now() - fastCached.timestamp) < FAST_CACHE_TTL) {
            console.log('Fast cache hit!');
            return fastCached.data;
        }
    }

    // Try Redis first
    try {
        const redisResult = await redisCache.get('search', cacheKey);
        if (redisResult) {
            return redisResult;
        }
    } catch (error) {
        console.warn('Redis cache get failed, falling back to memory cache:', error.message);
    }

    // Fallback to memory cache
    const cached = searchCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
        return cached.data;
    }
    if (cached) {
        searchCache.delete(cacheKey); // Remove expired cache
    }
    return null;
};

const setCachedResult = async (cacheKey, data, searchParams) => {
    // Set fast cache for single-word queries
    if (searchParams && searchParams.q && searchParams.q.length < 20 && !searchParams.q.includes(' ')) {
        if (fastQueryCache.size > 500) {
            const firstKey = fastQueryCache.keys().next().value;
            fastQueryCache.delete(firstKey);
        }
        fastQueryCache.set(cacheKey, {
            data: data,
            timestamp: Date.now()
        });
    }

    // Try Redis first with longer TTL for better performance
    try {
        const success = await redisCache.set('search', cacheKey, data, 600); // 10 minutes TTL for better cache hit rate
        if (success) {
            return;
        }
    } catch (error) {
        console.warn('Redis cache set failed, falling back to memory cache:', error.message);
    }

    // Fallback to memory cache with larger size limit
    if (searchCache.size > 2000) { // Increased cache size
        const firstKey = searchCache.keys().next().value;
        searchCache.delete(firstKey);
    }
    searchCache.set(cacheKey, {
        data: data,
        timestamp: Date.now()
    });
};

// Initialize Elasticsearch client with enhanced configuration
const client = new Client({
    node: envManager.get('ELASTICSEARCH_URL', 'https://localhost:9200'),
    auth: {
        username: envManager.get('ELASTICSEARCH_USERNAME', 'elastic'),
        password: envManager.get('ELASTICSEARCH_PASSWORD', 'bEvADDXp47tbSH32mPwB')
    },
    tls: {
        ca: envManager.get('ELASTICSEARCH_CA_CERT'),
        rejectUnauthorized: envManager.getBoolean('ELASTICSEARCH_SSL_VERIFY', false)
    },
    requestTimeout: envManager.getNumber('ELASTICSEARCH_REQUEST_TIMEOUT', 1000), // Reduced to 1s for fast response
    pingTimeout: envManager.getNumber('ELASTICSEARCH_PING_TIMEOUT', 5000),       // Reduced to 5s
    maxRetries: envManager.getNumber('ELASTICSEARCH_MAX_RETRIES', 2),            // Reduced to 2 for speed
    // Performance optimizations
    compression: 'gzip',
    suggestCompression: true,
    // Enhanced connection settings for Elasticsearch 8+
    // Remove agent configuration as it's not compatible with Undici
    // The Undici agent handles connection pooling automatically
    sniffOnStart: false,
    sniffOnConnectionFault: false,
    sniffInterval: false
});

// Check if Elasticsearch is available
const checkElasticsearchConnection = async () => {
    try {
        const response = await client.ping();
        console.log('Elasticsearch connection successful');
        return true;
    } catch (error) {
        console.log("Elasticsearch connection failed:", error.message);
        return false;
    }
};

// Helper function to extract YouTube video ID from embed URL
const extractYouTubeVideoId = (url) => {
    if (!url) return null;
    
    // Handle different YouTube URL formats
    const patterns = [
        /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,         // https://www.youtube.com/embed/VIDEO_ID
        /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,       // https://www.youtube.com/watch?v=VIDEO_ID
        /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,                   // https://youtu.be/VIDEO_ID
        /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,             // https://www.youtube.com/v/VIDEO_ID
        /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})\?/,       // https://www.youtube.com/embed/VIDEO_ID?params
        /(?:youtube\.com\/watch\?.*v=)([a-zA-Z0-9_-]{11})/,     // https://www.youtube.com/watch?other=val&v=VIDEO_ID
        /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})&/       // https://www.youtube.com/watch?v=VIDEO_ID&other=val
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    
    // If no pattern matches, try a more aggressive approach
    const fallbackMatch = url.match(/([a-zA-Z0-9_-]{11})/);
    if (fallbackMatch && url.includes('youtube.com')) {
        return fallbackMatch[1];
    }
    
    return null;
};

// Helper function to generate YouTube thumbnail URL
const generateYouTubeThumbnail = (url) => {
    const videoId = extractYouTubeVideoId(url);
    if (videoId) {
        return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    }
    return 'https://via.placeholder.com/320x180?text=Video+Thumbnail';
};

// Helper function to format duration from seconds to MM:SS
const formatDuration = (seconds) => {
    if (!seconds || seconds === 0) return 'N/A';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

// MySQL fallback for video search when Elasticsearch is unavailable
const getVideosFromMySQL = async (searchParams) => {
    const startTime = Date.now();
    
    try {
        const { con } = require("../../mysql");
        const page = parseInt(searchParams.page) || 1;
        const perPage = parseInt(searchParams.per_page) || 20;
        const offset = (page - 1) * perPage;
        const query = searchParams.q || '';
        
        console.log(`MySQL Video Search: "${query}" - Page ${page}`);
        
        // Search in site_videos table
        const searchTerm = `%${query}%`;
        const videoQuery = `
            SELECT 
                sv.site_videos_id,
                sv.site_videos_title,
                sv.site_videos_description,
                sv.site_videos_link,
                sv.site_videos_thumbnail,
                sv.site_videos_duration,
                sv.site_videos_width,
                sv.site_videos_height,
                sv.site_videos_provider,
                sv.site_videos_created,
                s.site_title,
                s.site_url
            FROM site_videos sv
            LEFT JOIN sites s ON sv.site_videos_site_id = s.site_id
            WHERE 
                sv.site_videos_title LIKE ? OR 
                sv.site_videos_description LIKE ?
            ORDER BY sv.site_videos_created DESC
            LIMIT ? OFFSET ?
        `;
        
        // Count total results
        const countQuery = `
            SELECT COUNT(*) as total
            FROM site_videos sv
            WHERE 
                sv.site_videos_title LIKE ? OR 
                sv.site_videos_description LIKE ?
        `;
        
        const [results, countResults] = await Promise.all([
            con.query(videoQuery, [searchTerm, searchTerm, perPage, offset]),
            con.query(countQuery, [searchTerm, searchTerm])
        ]);
        
        const total = countResults[0]?.total || 0;
        
        console.log(`MySQL Video Search Results: ${results.length} videos found (${total} total)`);
        
        // Format results for frontend
        const formattedResults = results.map(video => {
            // Extract YouTube video ID for proper embedding
            const youtubeVideoId = extractYouTubeVideoId(video.site_videos_link);
            
            return {
                id: youtubeVideoId || video.site_videos_id, // Use YouTube video ID first
                title: video.site_videos_title || 'Untitled Video',
                description: video.site_videos_description || '',
                url: video.site_videos_link,
                thumbnail: video.site_videos_thumbnail || generateYouTubeThumbnail(video.site_videos_link),
                duration: formatDuration(video.site_videos_duration),
                width: video.site_videos_width,
                height: video.site_videos_height,
                provider: video.site_videos_provider || video.site_title || 'Unknown',
                publishedAt: video.site_videos_created,
                channel: video.site_title || 'Unknown Channel',
                channelUrl: video.site_url || '#'
            };
        });
        
        const totalPages = Math.ceil(total / perPage);
        
        return {
            success: true,
            pagination: { 
                current_page: page, 
                total_pages: totalPages,
                pages: Array.from({length: Math.min(totalPages, 10)}, (_, i) => i + 1)
            },
            total: total,
            data: formattedResults,
            time_taken: Date.now() - startTime,
            source: 'mysql'
        };
        
    } catch (error) {
        console.error("MySQL video search error:", error);
        return {
            success: false,
            pagination: { current_page: 1, pages: [1] },
            total: 0,
            data: [],
            error: error.message,
            time_taken: Date.now() - startTime,
            source: 'mysql_error'
        };
    }
};

// Enhanced helper function to filter duplicates and handle pagination
const filterAndPaginateResults = (hits, from, size) => {
    const uniqueTitles = new Set();
    const uniqueResults = [];
    const duplicates = [];

    // Separate unique and duplicate results based on title
    for (const hit of hits) {
        const title = hit._source.site_data_title;
        if (!uniqueTitles.has(title)) {
            uniqueTitles.add(title);
            uniqueResults.push(hit);
        } else {
            duplicates.push(hit);
        }
    }

    // Combine unique results with duplicates, paginating duplicates
    const paginatedResults = uniqueResults.slice(from, from + size);
    if (paginatedResults.length < size) {
        const remainingSlots = size - paginatedResults.length;
        paginatedResults.push(...duplicates.slice(0, remainingSlots));
    }

    return {
        paginatedResults,
        duplicatesLeft: duplicates.length - (size - paginatedResults.length)
    };
};

// Helper function to extract domain from URL or search query
const extractDomain = (query) => {
    // Check if the query looks like a domain (contains dots and no spaces)
    if (query.includes('.') && !query.includes(' ')) {
        // Remove protocol if present
        let domain = query.replace(/^https?:\/\//, '');
        // Remove www if present
        domain = domain.replace(/^www\./, '');
        // Remove trailing slash
        domain = domain.replace(/\/$/, '');
        // Remove any path after the domain
        domain = domain.split('/')[0];
        // Remove query parameters
        domain = domain.split('?')[0];
        return domain;
    }
    return null;
};

// Initialize boolean query parser
const booleanParser = new BooleanQueryParser();

// Build advanced search query with filters and boolean operators
const buildSearchQuery = (searchParams) => {
    const { q, filters = {} } = searchParams;
    const query = q || "Bhoomy";
    
    // Check if this is a boolean query (contains operators)
    const isBooleanQueryResult = isBooleanQuery(query);
    
    let searchQuery;
    
    if (isBooleanQueryResult) {
        console.log(`Boolean query detected: "${query}"`);
        
        // Use boolean parser for complex queries
        const parsedQuery = booleanParser.parse(query);
        searchQuery = parsedQuery.query;
        
        // Wrap in bool query if not already a bool query
        if (!searchQuery.bool) {
            searchQuery = {
                bool: {
                    must: [searchQuery],
                    filter: []
                }
            };
        } else {
            // Ensure filter array exists
            if (!searchQuery.bool.filter) {
                searchQuery.bool.filter = [];
            }
        }
    } else {
        // Check if this is a domain search
        const domain = extractDomain(query);
        
        // Simplified, faster query structure
        searchQuery = {
            bool: {
                must: [],
                filter: []
            }
        };
        
        if (domain) {
            console.log(`Domain search detected: "${domain}" for query: "${query}"`);
            
            // For domain searches, use regular multi_match with high boost on link field
            searchQuery.bool.must.push({
                multi_match: {
                    query: query,
                    fields: [
                        "site_data_link^5",           // Highest boost for link field
                        "site_data_title^3",           // High boost for title
                        "site_data_description^2",     // Medium boost for description
                        "site_data_article^1",         // Low boost for article content
                        "site_data_content^1"          // Low boost for content
                    ],
                    type: "best_fields",
                    fuzziness: "1",
                    operator: "or"
                }
            });
            
            // Also search for base domain name (e.g., "vtu" from "vtu.co.in")
            const baseDomain = domain.split('.')[0];
            if (baseDomain && baseDomain.length > 2) {
                searchQuery.bool.must.push({
                    multi_match: {
                        query: baseDomain,
                        fields: [
                            "site_data_link^3",
                            "site_data_title^2",
                            "site_data_description^1"
                        ],
                        type: "best_fields",
                        fuzziness: "1",
                        operator: "or"
                    }
                });
            }
        } else {
            // Ultra-fast regular search with performance optimizations
            searchQuery.bool.must.push({
                multi_match: {
                    query: query,
                    fields: [
                        "site_data_title^3",           // Boost title matches
                        "site_data_description^2",     // Boost description matches
                        "site_data_article^1"          // Include article content
                    ],
                    type: "best_fields",
                    fuzziness: "0",                    // Disable fuzziness for speed
                    operator: "or",
                    minimum_should_match: "30%"        // Reduced for faster matching
                }
            });
        }
    }

    // Only add filters that are actually set for performance
    if (filters.category && filters.category !== '') {
        searchQuery.bool.filter.push({
            term: { "site_category.keyword": filters.category }
        });
    }

    if (filters.language && filters.language !== '') {
        searchQuery.bool.filter.push({
            term: { "site_language.keyword": filters.language }
        });
    }

    // Skip complex content type and date filters for speed unless specifically needed
    if (filters.date_range && filters.date_range.from && filters.date_range.to) {
        searchQuery.bool.filter.push({
            range: { 
                site_data_date: { 
                    gte: filters.date_range.from,
                    lte: filters.date_range.to 
                } 
            }
        });
    }

    return searchQuery;
};

// Enhanced helper function to detect boolean queries and advanced search patterns
const isBooleanQuery = (query) => {
    if (!query || typeof query !== 'string') return false;
    
    // Check for explicit boolean operators (case insensitive)
    const booleanOperators = /\b(AND|OR|NOT)\b/i;
    if (booleanOperators.test(query)) return true;
    
    // Check for parentheses (grouping)
    if (query.includes('(') || query.includes(')')) return true;
    
    // Check for field:value syntax (title:, body:, author:, site:, intitle:, filetype:)
    const fieldPattern = /\b(title|body|author|site|intitle|filetype|date|visits|score):/i;
    if (fieldPattern.test(query)) return true;
    
    // Check for quoted phrases
    if (query.includes('"')) return true;
    
    // Check for range operators (>=, <=, >, <, =)
    const rangeOperators = /[><=]+/;
    if (rangeOperators.test(query)) return true;
    
    // Check for special operators (site:, intitle:, filetype:)
    const specialOperators = /\b(site|intitle|filetype):/i;
    if (specialOperators.test(query)) return true;
    
    // Check for multiple terms that might benefit from boolean logic
    const terms = query.trim().split(/\s+/);
    if (terms.length >= 3) {
        // Only treat as boolean if it contains explicit boolean operators or field syntax
        // Don't treat natural language questions as boolean queries
        const hasExplicitOperators = terms.some(term => 
            /^(AND|OR|NOT)$/i.test(term)
        );
        const hasFieldSyntax = terms.some(term => 
            /^[a-zA-Z_]+:/.test(term)
        );
        const hasQuotes = query.includes('"');
        const hasParentheses = query.includes('(') || query.includes(')');
        const hasRangeOperators = /[><=]+/.test(query);
        
        // Only return true if it has explicit boolean features
        if (hasExplicitOperators || hasFieldSyntax || hasQuotes || hasParentheses || hasRangeOperators) {
            return true;
        }
    }
    
    return false;
};

// Build sort configuration
const buildSortConfig = (sortBy) => {
    switch (sortBy) {
        case 'date':
            return [
                { "site_data_last_update": { "order": "desc", "missing": "_last" } },
                { "_score": { "order": "desc" } }
            ];
        case 'popularity':
            return [
                { "site_data_visit": { "order": "desc", "missing": "_last" } },
                { "_score": { "order": "desc" } }
            ];
        case 'relevance':
        default:
            return [
                { "_score": { "order": "desc" } },
                { "site_data_last_update": { "order": "desc", "missing": "_last" } }
            ];
    }
};

// Enhanced general search function with performance optimizations
const get = async (searchParams = {}) => {
    const startTime = Date.now();
    
    // Check cache first
    const cacheKey = getCacheKey(searchParams);
    const cachedResult = await getCachedResult(cacheKey, searchParams);
    if (cachedResult) {
        console.log(`Cache hit! Query served in ${Date.now() - startTime}ms`);
        return {
            ...cachedResult,
            time_taken: Date.now() - startTime,  // Return time in milliseconds
            cached: true
        };
    }

    const isElasticsearchAvailable = await checkElasticsearchConnection();
    if (!isElasticsearchAvailable) {
        return {
            success: false,
            pagination: { current_page: 1, total_pages: 0 },
            total: 0,
            results: [],
            related: [],
            duplicatesLeft: 0,
            time_taken: 0,
            message: "Search service temporarily unavailable. Please try again later."
        };
    }

    const page = parseInt(searchParams.page) || 1;
    const perPage = parseInt(searchParams.per_page) || 20;
    const from = (page - 1) * perPage;
    
    try {
        // Fast search mode for common queries
        const isCommonQuery = searchParams.q && searchParams.q.length < 20 && !searchParams.q.includes(' ');
        
        // Use simple, fast search query for performance
        const searchQuery = buildSearchQuery(searchParams);
        
        // Debug logging for domain searches
        if (searchParams.q && searchParams.q.includes('.')) {
            console.log(`Searching for domain: "${searchParams.q}"`);
            console.log('Search query:', JSON.stringify(searchQuery, null, 2));
            console.log('Domain detected:', extractDomain(searchParams.q));
        }

        // Ultra-fast search with aggressive performance settings
        const searchResponse = await client.search({
            index: ['site_data'],
            size: perPage,
            from: from,
            query: searchQuery,
            sort: buildSortConfig(searchParams.filters?.sort_by),
            timeout: '500ms', // Aggressive timeout for sub-second response
            _source: [
                "site_data_title",
                "site_data_description", 
                "site_data_link",
                "site_data_date",
                "site_data_icon",
                "site_title",
                "site_data_visit",
                "site_data_last_update"
            ], // Only fetch required fields
            track_total_hits: false, // Disable for faster response - we'll estimate
            preference: '_local', // Use local shard for better performance
            // Aggressive performance optimizations
            batched_reduce_size: 256, // Reduced for faster response
            max_concurrent_shard_requests: 3, // Reduced for faster response
            // Disable expensive features
            explain: false,
            profile: false,
            // Additional performance settings
            terminate_after: 10000, // Stop after 10k matches for speed
            search_type: 'query_then_fetch' // Faster search type
        });

        // Handle different total hits formats
        let totalHits = searchResponse.hits.total?.value || searchResponse.hits.total;
        if (typeof totalHits !== 'number') {
            // When track_total_hits is false, ES doesn't return a reliable total.
            // Do a lightweight count query to get an accurate total without changing UI logic.
            try {
                const countResponse = await client.count({ index: ['site_data'], query: searchQuery });
                totalHits = countResponse.count || searchResponse.hits.hits.length;
            } catch (countErr) {
                console.warn('Count fallback failed, using page size as total:', countErr?.message);
                totalHits = searchResponse.hits.hits.length;
            }
        }
        console.log(`Query completed in ${Date.now() - startTime}ms. Found ${totalHits} results.`);
        
        // Debug logging for domain searches
        if (searchParams.q && searchParams.q.includes('.')) {
            console.log(`Domain search results count: ${totalHits}`);
            console.log('Total hits available:', searchResponse.hits.total);
            console.log('Hits returned:', searchResponse.hits.hits.length);
            if (searchResponse.hits.hits.length > 0) {
                console.log('First result link:', searchResponse.hits.hits[0]._source.site_data_link);
                console.log('First result title:', searchResponse.hits.hits[0]._source.site_data_title);
                console.log('First result score:', searchResponse.hits.hits[0]._score);
            } else {
                console.log('No results found for domain search');
                console.log('Elasticsearch response:', JSON.stringify(searchResponse, null, 2));
            }
        }
        
        // Minimal result processing for speed
        const results = searchResponse.hits.hits.map(hit => ({
            ...hit._source,
            id: hit._id,
            score: hit._score
        }));

        // Fast pagination calculation
        const totalPages = Math.ceil(totalHits / perPage);
        const currentPage = page;

        const endTime = Date.now();
        const timeTaken = endTime - startTime;  // Keep time in milliseconds

        const result = {
            success: true,
            pagination: { 
                current_page: currentPage, 
                total_pages: totalPages,
                per_page: perPage,
                has_next: currentPage < totalPages,
                has_prev: currentPage > 1
            },
            total: totalHits,
            results: results,
            related: [], // Skip related searches for speed - load separately if needed
            duplicatesLeft: 0,
            time_taken: timeTaken,
            query: searchParams.q || "",
            filters: searchParams.filters || {},
            cached: false
        };

        // Cache the result for future requests (include cached flag in stored data)
        await setCachedResult(cacheKey, {
            success: result.success,
            pagination: result.pagination,
            total: result.total,
            results: result.results,
            related: result.related,
            duplicatesLeft: result.duplicatesLeft,
            query: result.query,
            filters: result.filters,
            cached: false  // This will be overridden when returned from cache
        }, searchParams);

        return result;

    } catch (error) {
        console.log("Elasticsearch error in get function:", error.message);
        const endTime = Date.now();
        const timeTaken = endTime - startTime;  // Keep time in milliseconds
        
        return {
            success: false,
            pagination: { current_page: 1, total_pages: 0 },
            total: 0,
            results: [],
            related: [],
            duplicatesLeft: 0,
            time_taken: timeTaken,
            error: error.message,
            query: searchParams.q || "",
            filters: searchParams.filters || {},
            cached: false
        };
    }
};

// Enhanced image search function with performance optimizations
const get_images = async (searchParams = {}) => {
    const startTime = Date.now();
    
    // Check cache first
    const cacheKey = getCacheKey({ ...searchParams, type: 'images' });
    const cachedResult = await getCachedResult(cacheKey, searchParams);
    if (cachedResult) {
        console.log(`Image cache hit! Query served in ${Date.now() - startTime}ms`);
        return {
            ...cachedResult,
            time_taken: Date.now() - startTime,
            cached: true
        };
    }

    const isElasticsearchAvailable = await checkElasticsearchConnection();
    if (!isElasticsearchAvailable) {
        return {
            success: false,
            pagination: { current_page: 1, pages: [1, 2, 3, 4, 5, 6] },
            total: 0,
            results: [],
            message: "Image search temporarily unavailable. Please try again later."
        };
    }

    const page = parseInt(searchParams.page) || 1;
    const perPage = Math.min(parseInt(searchParams.per_page) || 20, 100); // Limit to max 100 per page
    const from = (page - 1) * perPage;

    try {
        // Ultra-fast image search query
        const searchQuery = {
            bool: {
                must: [
                    {
                        multi_match: {
                            query: searchParams.q || "Bhoomy",
                            fields: [
                                "site_img_title^3", 
                                "site_img_alt^2"
                            ],
                            type: "best_fields",
                            fuzziness: "0",
                            operator: "or",
                            minimum_should_match: "30%" // Reduced for faster matching
                        }
                    }
                ],
                filter: [
                    { exists: { field: "site_img_link" } }
                ]
            }
        };

        // Add filters only if specified
        if (searchParams.filters?.category) {
            searchQuery.bool.filter.push({
                term: { "site_img_category.keyword": searchParams.filters.category }
            });
        }

        // Ultra-fast image search with aggressive performance settings
        const searchResponse = await client.search({
            index: ['site_img'],
            size: perPage,
            from: from,
            query: searchQuery,
            sort: [
                { "_score": { "order": "desc" } }
            ],
            timeout: '500ms', // Aggressive timeout for sub-second response
            _source: [
                'site_img_id',
                'site_img_title',
                'site_img_alt', 
                'site_img_link',
                'site_img_width',
                'site_img_height',
                'site_img_size',
                'site_img_source'
            ],
            track_total_hits: false, // Disable for faster response
            preference: '_local',
            // Performance optimizations
            terminate_after: 5000, // Stop after 5k matches for speed
            search_type: 'query_then_fetch',
            batched_reduce_size: 128,
            max_concurrent_shard_requests: 2
        });

        // Process results efficiently
        const results = searchResponse.hits.hits.map(hit => ({
            ...hit._source,
            id: hit._id,
            score: hit._score
        }));

        // Accurate total for images: when track_total_hits=false, total may be missing
        let totalHits = searchResponse.hits.total?.value || searchResponse.hits.total;
        if (typeof totalHits !== 'number') {
            try {
                const countResp = await client.count({ index: ['site_img'], query: searchQuery });
                totalHits = countResp.count || 0;
            } catch (e) {
                console.warn('Image count fallback failed:', e?.message);
                totalHits = results.length;
            }
        }
        const totalPages = Math.ceil(totalHits / perPage);
        const pages = [];
        for (let i = 1; i <= Math.min(totalPages, 10); i++) {
            pages.push(i);
        }

        const endTime = Date.now();
        const timeTaken = endTime - startTime;

        const result = {
            success: true,
            pagination: { 
                current_page: page, 
                total_pages: totalPages,
                pages: pages,
                per_page: perPage,
                has_next: page < totalPages,
                has_prev: page > 1
            },
            total: totalHits,
            results: results,
            time_taken: timeTaken,
            cached: false
        };

        // Cache the result for future requests
        await setCachedResult(cacheKey, {
            success: result.success,
            pagination: result.pagination,
            total: result.total,
            results: result.results,
            cached: false
        }, searchParams);

        return result;

    } catch (error) {
        console.log("Elasticsearch image search error:", error.message);
        return {
            success: false,
            pagination: { current_page: 1, pages: [1, 2, 3, 4, 5, 6] },
            total: 0,
            results: [],
            error: error.message,
            time_taken: Date.now() - startTime
        };
    }
};

// Enhanced video search using Elasticsearch site_videos index
const get_videos = async (searchParams = {}, pageToken = null) => {
    const isElasticsearchAvailable = await checkElasticsearchConnection();
    if (!isElasticsearchAvailable) {
        console.log("Elasticsearch not available, using MySQL fallback for videos");
        return await getVideosFromMySQL(searchParams);
    }

    const startTime = Date.now();
    const page = parseInt(searchParams.page) || 1;
    const perPage = parseInt(searchParams.per_page) || 20;
    const from = (page - 1) * perPage;

    try {
        console.log(`Starting video search for: "${searchParams.q || 'Bhoomy'}" on page ${page}`);
        
        // First check if the index has any data
        const countResponse = await client.count({
            index: ['site_videos']
        });
        console.log(`Total videos in index: ${countResponse.count}`);
        
        const searchQuery = {
            bool: {
                should: [
                    {
                        multi_match: {
                            query: searchParams.q || "Bhoomy",
                            fields: [
                                "site_videos_title^3",
                                "site_videos_description^2", 
                                "site_videos_tags^2",
                                "site_videos_keywords"
                            ],
                            type: "best_fields",
                            fuzziness: "AUTO"
                        }
                    },
                    {
                        wildcard: {
                            "site_videos_title": `*${(searchParams.q || "").toLowerCase()}*`
                        }
                    },
                    {
                        wildcard: {
                            "site_videos_description": `*${(searchParams.q || "").toLowerCase()}*`
                        }
                    }
                ],
                filter: [
                    { exists: { field: "site_videos_title" } }
                ],
                minimum_should_match: 1
            }
        };

        // Add category filter for videos
        if (searchParams.filters?.category) {
            searchQuery.bool.filter.push({
                term: { "site_videos_category.keyword": searchParams.filters.category }
            });
        }

        // Build sort configuration
        let sortConfig;
        if (searchParams.filters?.sort_by === 'date') {
            sortConfig = [
                { "site_videos_created": { "order": "desc", "missing": "_last" } },
                { "_score": { "order": "desc" } }
            ];
        } else {
            sortConfig = [{ "_score": { "order": "desc" } }];
        }

        console.log(`Executing Elasticsearch video search on indices: site_videos`);
        
        const searchResponse = await client.search({
            index: ['site_videos'],
            size: perPage * 2, // Fetch extra for deduplication
            from: from,
            query: searchQuery,
            sort: sortConfig,
            highlight: {
                fields: {
                    "site_videos_title": {
                        pre_tags: ["<mark>"],
                        post_tags: ["</mark>"]
                    },
                    "site_videos_description": {
                        pre_tags: ["<mark>"],
                        post_tags: ["</mark>"]
                    }
                }
            },
            _source: [
                'site_videos_id',
                'site_videos_title', 
                'site_videos_description',
                'site_videos_link',
                'site_videos_thumbnail',
                'site_videos_duration',
                'site_videos_width',
                'site_videos_height',
                'site_videos_provider',
                'site_videos_created',
                'site_videos_metadata'
            ]
        });

        const totalHits = searchResponse.hits.total?.value || searchResponse.hits.total || 0;
        console.log(`Elasticsearch video search completed. Found ${totalHits} total results`);

        // Remove duplicates based on title
        const uniqueTitles = new Set();
        const filteredResults = [];

        searchResponse.hits.hits.forEach(hit => {
            const title = hit._source.site_videos_title;
            if (!uniqueTitles.has(title) && filteredResults.length < perPage) {
                uniqueTitles.add(title);
                
                // Generate proper thumbnail for YouTube videos
                const videoUrl = hit._source.site_videos_link;
                const thumbnail = hit._source.site_videos_thumbnail || generateYouTubeThumbnail(videoUrl);
                
                // Extract YouTube video ID for proper embedding
                const youtubeVideoId = extractYouTubeVideoId(videoUrl);
                
                filteredResults.push({
                    id: youtubeVideoId || hit._source.site_videos_id || hit._id, // Use YouTube video ID first
                    title: hit._source.site_videos_title,
                    description: hit._source.site_videos_description,
                    url: videoUrl,
                    thumbnail: thumbnail,
                    duration: formatDuration(hit._source.site_videos_duration),
                    width: hit._source.site_videos_width,
                    height: hit._source.site_videos_height,
                    provider: hit._source.site_videos_provider || 'YouTube',
                    publishedAt: hit._source.site_videos_created,
                    metadata: hit._source.site_videos_metadata,
                    score: hit._score,
                    highlight: hit.highlight || {},
                    channel: hit._source.site_videos_provider || 'YouTube Channel',
                    channelUrl: '#'
                });
            }
        });

        const totalPages = Math.ceil(totalHits / perPage);
        const pages = [];
        for (let i = 1; i <= Math.min(totalPages, 10); i++) {
            pages.push(i);
        }

        const endTime = Date.now();

        console.log(`Video search successful: ${filteredResults.length} unique results returned`);

        return {
            success: true,
            pagination: { 
                current_page: page, 
                total_pages: totalPages,
                pages: pages 
            },
            total: totalHits,
            data: filteredResults,
            time_taken: endTime - startTime  // Keep time in milliseconds
        };

    } catch (error) {
        console.log("Elasticsearch video search error:", error.message);
        console.log("Full error:", error);
        return {
            success: false,
            pagination: { current_page: 1, pages: [1, 2, 3, 4, 5, 6] },
            total: 0,
            data: [],
            error: error.message,
            time_taken: Date.now() - startTime  // Keep time in milliseconds
        };
    }
};

// Optimized news search function with performance improvements
const get_news = async (searchParams = {}) => {
    const startTime = Date.now();
    
    // Check cache first
    const cacheKey = getCacheKey({ ...searchParams, type: 'news' });
    const cachedResult = await getCachedResult(cacheKey);
    if (cachedResult) {
        console.log(`News cache hit! Query served in ${Date.now() - startTime}ms`);
        return {
            ...cachedResult,
            time_taken: Date.now() - startTime,
            cached: true
        };
    }

    // First check if Elasticsearch is available
    const isElasticsearchAvailable = await checkElasticsearchConnection();
    if (!isElasticsearchAvailable) {
        console.log("Elasticsearch not available for news search");
        return {
            success: false,
            pagination: { current_page: 1, pages: [1, 2, 3, 4, 5, 6] },
            total: 0,
            data: [],
            error: "Search service temporarily unavailable",
            time_taken: 0
        };
    }

    const page = parseInt(searchParams.page) || 1;
    const perPage = parseInt(searchParams.per_page) || 20;
    const from = (page - 1) * perPage;

    try {
        console.log(`Starting optimized news search for: "${searchParams.q || 'Bhoomy'}" on page ${page}`);
        
        // Highly optimized search query for maximum performance
        const searchQuery = {
            bool: {
                must: [
                    {
                        multi_match: {
                            query: searchParams.q || "india",
                            fields: [
                                "site_data_title^3",        // Reduced boost for speed
                                "site_data_description^2"   // Only essential fields
                            ],
                            type: "best_fields",
                            fuzziness: "0",                 // Disable fuzziness for speed
                            minimum_should_match: "50%"     // Reduced for better performance
                        }
                    }
                ],
                filter: [
                    { exists: { field: "site_data_title" } },
                    { exists: { field: "site_data_description" } }
                ]
            }
        };

        // Add category filter for news
        if (searchParams.filters?.category) {
            searchQuery.bool.filter.push({
                term: { "site_category.keyword": searchParams.filters.category }
            });
        }

        // Optimized sort configuration
        const sortConfig = [
            { "_score": { "order": "desc" } },
            { "site_data_last_update": { "order": "desc", "missing": "_last" } }
        ];

        console.log(`Executing optimized Elasticsearch news search`);
        
        const searchResponse = await client.search({
            index: ['site_data'],
            size: perPage,
            from: from,
            query: searchQuery,
            sort: sortConfig,
            timeout: '500ms', // Further reduced timeout for speed
            _source: [
                'site_data_id',
                'site_data_title', 
                'site_data_description',
                'site_data_link',
                'site_data_image',       // Include image field for news articles
                'site_data_icon',        // Only field that actually exists
                'site_data_last_update',
                'site_data_date',
                'site_data_author',
                'site_title',
                'site_category',
                'site_data_source'       // Include source field if available
            ], // Only fetch fields that actually exist
            track_total_hits: true,
            preference: '_local',
            // Additional performance optimizations
            batched_reduce_size: 512,
            max_concurrent_shard_requests: 5,
            explain: false,
            profile: false
        });

        const totalHits = searchResponse.hits.total?.value || searchResponse.hits.total || 0;
        console.log(`Elasticsearch news search completed. Found ${totalHits} total results`);

        // Optimized result processing - no need for deduplication since we're not fetching extra
        const results = searchResponse.hits.hits.map(hit => ({
            ...hit._source,
            id: hit._id,
            score: hit._score
        }));

        const totalPages = Math.ceil(totalHits / perPage);
        const pages = [];
        for (let i = 1; i <= Math.min(totalPages, 10); i++) {
            pages.push(i);
        }

        const endTime = Date.now();
        const timeTaken = endTime - startTime;

        console.log(`News search successful: ${results.length} results returned in ${timeTaken}ms`);

        const result = {
            success: true,
            pagination: { 
                current_page: page, 
                total_pages: totalPages,
                pages: pages 
            },
            total: totalHits,
            data: results,
            time_taken: timeTaken,
            cached: false
        };

        // Cache the result for future requests
        await setCachedResult(cacheKey, {
            success: result.success,
            pagination: result.pagination,
            total: result.total,
            data: result.data,
            cached: false
        });

        return result;

    } catch (error) {
        console.log("Elasticsearch news search error:", error.message);
        console.log("Full error:", error);
        return {
            success: false,
            pagination: { current_page: 1, pages: [1, 2, 3, 4, 5, 6] },
            total: 0,
            data: [], // Changed to 'data' for consistency
            error: error.message,
            time_taken: Date.now() - startTime  // Keep time in milliseconds
        };
    }
};

// Search suggestions function
const get_suggestions = async (query) => {
    if (!query || query.length < 2) {
        return [];
    }

    try {
        const response = await client.search({
            index: ['search_analytics'],
            size: 10,
            query: {
                bool: {
                    should: [
                        {
                            prefix: {
                                "query.keyword": query
                            }
                        },
                        {
                            wildcard: {
                                "query.keyword": `*${query}*`
                            }
                        }
                    ]
                }
            },
            aggs: {
                suggestions: {
                    terms: {
                        field: "query.keyword",
                        size: 10,
                        order: { "_count": "desc" }
                    }
                }
            }
        });

        return response.aggregations.suggestions.buckets.map(bucket => bucket.key);
    } catch (error) {
        console.log("Suggestions error:", error.message);
        return [];
    }
};

// Get search syntax help
const get_syntax_help = () => {
    return booleanParser.getSyntaxHelp();
};

module.exports = {
    get,
    get_images,
    get_videos,
    get_news,
    get_suggestions,
    get_syntax_help,
    checkElasticsearchConnection,
    extractYouTubeVideoId
};
