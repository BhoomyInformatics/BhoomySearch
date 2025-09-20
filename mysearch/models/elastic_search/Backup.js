//site.js - Updated for Elasticsearch 8+ with Modern Search Features

const { google } = require('googleapis');
const { Client } = require('@elastic/elasticsearch');

// Simple memory cache for search results (5 minute TTL)
const searchCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Cache helper functions
const getCacheKey = (searchParams) => {
    return JSON.stringify({
        q: searchParams.q,
        page: searchParams.page,
        per_page: searchParams.per_page,
        filters: searchParams.filters
    });
};

const getCachedResult = (cacheKey) => {
    const cached = searchCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
        return cached.data;
    }
    if (cached) {
        searchCache.delete(cacheKey); // Remove expired cache
    }
    return null;
};

const setCachedResult = (cacheKey, data) => {
    // Limit cache size to prevent memory issues
    if (searchCache.size > 1000) {
        const firstKey = searchCache.keys().next().value;
        searchCache.delete(firstKey);
    }
    searchCache.set(cacheKey, {
        data: data,
        timestamp: Date.now()
    });
};

// Initialize Elasticsearch client with optimized configuration for performance
const client = new Client({
    node: process.env.ELASTICSEARCH_URL || 'https://localhost:9200',
    auth: {
        username: process.env.ELASTICSEARCH_USERNAME || 'elastic',
        password: process.env.ELASTICSEARCH_PASSWORD || 'bEvADDXp47tbSH32mPwB'
    },
    tls: {
        ca: process.env.ELASTICSEARCH_CA_CERT,
        rejectUnauthorized: false
    },
    requestTimeout: 1000, // Reduced timeout for faster response
    pingTimeout: 1000, // Faster ping timeout
    maxRetries: 1, // Reduce retries for speed
    // Performance optimizations
    compression: 'gzip',
    suggestCompression: true,
    // Connection pool optimizations
    maxSockets: 20,
    keepAlive: true,
    keepAliveTimeout: 60000,
    // Disable unnecessary features for speed
    deadTimeout: 60000,
    resurrectStrategy: 'ping'
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

// Build advanced search query with filters
const buildSearchQuery = (searchParams) => {
    const { q, filters = {} } = searchParams;
    const query = q || "Bhoomy";
    
    // Simplified, faster query structure
    const searchQuery = {
        bool: {
            must: [
                {
                    multi_match: {
                        query: query,
                        fields: [
                            "site_data_title^3",           // Boost title matches
                            "site_data_description^2"      // Boost description matches
                        ],
                        type: "best_fields",
                        fuzziness: "0",                     // Remove fuzziness for speed
                        operator: "or"
                    }
                }
            ],
            filter: []
        }
    };

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
    const cachedResult = getCachedResult(cacheKey);
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
        // Use simple, fast search query for performance
        const searchQuery = buildSearchQuery(searchParams);

        // Optimized search with performance settings
        const searchResponse = await client.search({
            index: ['site_data'],
            size: perPage,
            from: from,
            query: searchQuery,
            sort: buildSortConfig(searchParams.filters?.sort_by),
            timeout: '2000ms', // Reasonable timeout for complex queries
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
            track_total_hits: true, // Optimize total count calculation
            preference: '_local' // Use local shard for better performance
        });

        console.log(`Query completed in ${Date.now() - startTime}ms. Found ${searchResponse.hits.total.value} results.`);
        
        // Minimal result processing for speed
        const results = searchResponse.hits.hits.map(hit => ({
            ...hit._source,
            id: hit._id,
            score: hit._score
        }));

        // Fast pagination calculation
        const totalPages = Math.ceil(searchResponse.hits.total.value / perPage);
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
            total: searchResponse.hits.total.value,
            results: results,
            related: [], // Skip related searches for speed - load separately if needed
            duplicatesLeft: 0,
            time_taken: timeTaken,
            query: searchParams.q || "",
            filters: searchParams.filters || {},
            cached: false
        };

        // Cache the result for future requests (include cached flag in stored data)
        setCachedResult(cacheKey, {
            success: result.success,
            pagination: result.pagination,
            total: result.total,
            results: result.results,
            related: result.related,
            duplicatesLeft: result.duplicatesLeft,
            query: result.query,
            filters: result.filters,
            cached: false  // This will be overridden when returned from cache
        });

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

// Enhanced image search function
const get_images = async (searchParams = {}) => {
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

    const startTime = Date.now();
    const page = parseInt(searchParams.page) || 1;
    const perPage = parseInt(searchParams.per_page) || 50;
    const from = (page - 1) * perPage;

    try {
        const searchQuery = {
            bool: {
                must: [
                    {
                        multi_match: {
                            query: searchParams.q || "Bhoomy",
                            fields: ["site_img_title^2", "site_img_alt", "site_img_link"],
                            type: "best_fields",
                            fuzziness: "AUTO"
                        }
                    }
                ],
                filter: [
                    { exists: { field: "site_img_link" } }
                ]
            }
        };

        // Add filters
        if (searchParams.filters?.category) {
            searchQuery.bool.filter.push({
                term: { "site_img_category.keyword": searchParams.filters.category }
            });
        }

        const searchResponse = await client.search({
            index: ['site_img'],
            size: perPage * 2, // Fetch extra for deduplication
            from: from,
            query: searchQuery,
            sort: [
                { "_score": { "order": "desc" } }
            ]
        });

        // Remove duplicates based on image link
        const uniqueImages = new Set();
        const filteredResults = [];

        searchResponse.hits.hits.forEach(hit => {
            const imgLink = hit._source.site_img_link;
            if (!uniqueImages.has(imgLink) && filteredResults.length < perPage) {
                uniqueImages.add(imgLink);
                filteredResults.push({
                    ...hit._source,
                    id: hit._id,
                    score: hit._score
                });
            }
        });

        const totalPages = Math.ceil(searchResponse.hits.total.value / perPage);
        const pages = [];
        for (let i = 1; i <= Math.min(totalPages, 10); i++) {
            pages.push(i);
        }

        const endTime = Date.now();

        return {
            success: true,
            pagination: { 
                current_page: page, 
                total_pages: totalPages,
                pages: pages 
            },
            total: searchResponse.hits.total.value,
            results: filteredResults,
            time_taken: endTime - startTime  // Keep time in milliseconds
        };

    } catch (error) {
        console.log("Elasticsearch image search error:", error.message);
        return {
            success: false,
            pagination: { current_page: 1, pages: [1, 2, 3, 4, 5, 6] },
            total: 0,
            results: [],
            error: error.message,
            time_taken: Date.now() - startTime  // Keep time in milliseconds
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

        console.log(`Elasticsearch video search completed. Found ${searchResponse.hits.total.value} total results`);

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

        const totalPages = Math.ceil(searchResponse.hits.total.value / perPage);
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
            total: searchResponse.hits.total.value,
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

// Enhanced news search function
const get_news = async (searchParams = {}) => {
    // First check if Elasticsearch is available
    const isElasticsearchAvailable = await checkElasticsearchConnection();
    if (!isElasticsearchAvailable) {
        console.log("Elasticsearch not available for news search");
        return {
            success: false,
            pagination: { current_page: 1, pages: [1, 2, 3, 4, 5, 6] },
            total: 0,
            data: [], // Changed from 'results' to 'data' for consistency
            error: "Search service temporarily unavailable",
            time_taken: 0
        };
    }

    const startTime = Date.now();
    const page = parseInt(searchParams.page) || 1;
    const perPage = parseInt(searchParams.per_page) || 20;
    const from = (page - 1) * perPage;

    try {
        console.log(`Starting news search for: "${searchParams.q || 'Bhoomy'}" on page ${page}`);
        
        const searchQuery = {
            bool: {
                must: [
                    {
                        multi_match: {
                            query: searchParams.q || "india",
                            fields: [
                                "site_data_title^3",
                                "site_data_description^2", 
                                "site_data_keywords^2",
                                "site_data_h1^2",
                                "site_data_article",
                                "site_data_content"
                            ],
                            type: "best_fields",
                            fuzziness: "AUTO",
                            minimum_should_match: "30%"
                        }
                    }
                ],
                filter: [
                    // Remove the strict date filter that might be blocking results
                    { exists: { field: "site_data_title" } }
                ]
            }
        };

        // Add category filter for news
        if (searchParams.filters?.category) {
            searchQuery.bool.filter.push({
                term: { "site_category.keyword": searchParams.filters.category }
            });
        }

        // Build sort configuration with fallback for missing fields
        let sortConfig;
        if (searchParams.filters?.sort_by === 'relevance') {
            sortConfig = [{ "_score": { "order": "desc" } }];
        } else {
            // Use site_data_last_update instead of site_data_date for better compatibility
            sortConfig = [
                { "site_data_last_update": { "order": "desc", "missing": "_last" } },
                { "_score": { "order": "desc" } }
            ];
        }

        console.log(`Executing Elasticsearch news search on indices: site_data`);
        
        const searchResponse = await client.search({
            index: ['site_data'],
            size: perPage * 2, // Fetch extra for deduplication
            from: from,
            query: searchQuery,
            sort: sortConfig,
            highlight: {
                fields: {
                    "site_data_title": {
                        pre_tags: ["<mark>"],
                        post_tags: ["</mark>"]
                    },
                    "site_data_description": {
                        pre_tags: ["<mark>"],
                        post_tags: ["</mark>"]
                    }
                }
            },
            _source: [
                'site_data_id',
                'site_data_title', 
                'site_data_description',
                'site_data_link',
                'site_data_image',
                'site_data_article',
                'site_data_content',
                'site_data_last_update',
                'site_data_date',
                'site_data_author',
                'site_data_word_count',
                'site_title',
                'site_category'
            ]
        });

        console.log(`Elasticsearch news search completed. Found ${searchResponse.hits.total.value} total results`);

        // Remove duplicates based on title
        const uniqueTitles = new Set();
        const filteredResults = [];

        searchResponse.hits.hits.forEach(hit => {
            const title = hit._source.site_data_title;
            if (!uniqueTitles.has(title) && filteredResults.length < perPage) {
                uniqueTitles.add(title);
                filteredResults.push({
                    ...hit._source,
                    id: hit._id,
                    score: hit._score,
                    highlight: hit.highlight || {}
                });
            }
        });

        const totalPages = Math.ceil(searchResponse.hits.total.value / perPage);
        const pages = [];
        for (let i = 1; i <= Math.min(totalPages, 10); i++) {
            pages.push(i);
        }

        const endTime = Date.now();

        console.log(`News search successful: ${filteredResults.length} unique results returned`);

        return {
            success: true,
            pagination: { 
                current_page: page, 
                total_pages: totalPages,
                pages: pages 
            },
            total: searchResponse.hits.total.value,
            data: filteredResults, // Changed to 'data' for API consistency
            time_taken: endTime - startTime  // Keep time in milliseconds
        };

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

module.exports = {
    get,
    get_images,
    get_videos,
    get_news,
    get_suggestions,
    checkElasticsearchConnection,
    extractYouTubeVideoId
};
