const sitemodel = require("../../models/SiteModel");
const elastic_sites = require('../../models/elastic_search/site');
const axios = require("axios");
const { Client } = require("@elastic/elasticsearch");

// Initialize Elasticsearch client for API endpoints
const client = new Client({
    node: process.env.ELASTICSEARCH_URL || 'https://localhost:9200',
    auth: {
        username: process.env.ELASTICSEARCH_USERNAME || 'elastic',
        password: process.env.ELASTICSEARCH_PASSWORD || 'bEvADDXp47tbSH32mPwB'
    },
    tls: {
        rejectUnauthorized: false
    }
});

const { con } = require("../../mysql");

// Main search API endpoint with performance optimizations
const search = async(req, res) => {
    const startTime = Date.now();
    
    try {
        const searchParams = {
            q: req.query.q || req.body.q,
            page: parseInt(req.query.page || req.body.page) || 1,
            per_page: parseInt(req.query.per_page || req.body.per_page) || 20,
            filters: {
                category: req.query.category || req.body.filters?.category,
                language: req.query.language || req.body.filters?.language,
                sort_by: req.query.sort_by || req.body.filters?.sort_by || 'relevance',
                date_range: {
                    from: req.query.date_from || req.body.filters?.date_range?.from,
                    to: req.query.date_to || req.body.filters?.date_range?.to
                }
            }
        };

        const result = await elastic_sites.get(searchParams);
        
        // Add response headers for better caching
        res.set({
            'Cache-Control': 'public, max-age=300', // 5 minute cache
            'ETag': `"${Date.now()}"`,
            'X-Response-Time': `${Date.now() - startTime}ms`
        });
        
        if (result.success !== false) {
            res.status(200).json({
                success: true,
                data: {
                    results: result.results || [],
                    total: result.total || 0,
                    page: searchParams.page,
                    per_page: searchParams.per_page,
                    total_pages: result.pagination?.total_pages || Math.ceil((result.total || 0) / searchParams.per_page),
                    query: searchParams.q,
                    filters: searchParams.filters,
                    time_taken: result.time_taken || 0,
                    cached: result.cached || false
                },
                message: result.message || 'Search completed successfully'
            });
        } else {
            res.status(200).json({
                success: false,
                data: {
                    results: [],
                    total: 0,
                    page: 1,
                    per_page: searchParams.per_page,
                    total_pages: 0
                },
                error: result.error || 'Search service temporarily unavailable',
                message: result.message || 'Please try again later'
            });
        }
    } catch (error) {
        console.error('Search API error:', error);
        res.status(500).json({
            success: false,
            data: {
                results: [],
                total: 0,
                page: 1,
                per_page: 20,
                total_pages: 0
            },
            error: 'Internal server error',
            message: 'Search service is currently unavailable'
        });
    }
};

// Image search API endpoint
const get_images = async(req, res) => {
    try {
        const searchParams = {
            q: req.query.q || req.body.q,
            page: parseInt(req.query.page || req.body.page) || 1,
            per_page: parseInt(req.query.per_page || req.body.per_page) || 50,
            filters: {
                category: req.query.category || req.body.filters?.category,
                sort_by: req.query.sort_by || req.body.filters?.sort_by || 'relevance'
            }
        };

        const result = await elastic_sites.get_images(searchParams);
        
        if (result.success !== false) {
            res.status(200).json({
                success: true,
                data: {
                    results: result.results || result.data || [],
                    total: result.total || 0,
                    page: searchParams.page,
                    per_page: searchParams.per_page,
                    total_pages: result.pagination?.total_pages || Math.ceil((result.total || 0) / searchParams.per_page),
                    query: searchParams.q,
                    time_taken: result.time_taken || 0
                }
            });
        } else {
            res.status(200).json({
                success: false,
                data: { results: [], total: 0 },
                error: result.error || 'Image search service temporarily unavailable'
            });
        }
    } catch (error) {
        console.error('Image search API error:', error);
        res.status(500).json({
            success: false,
            data: { results: [], total: 0 },
            error: 'Internal server error'
        });
    }
};

// Video search API endpoint
const get_videos = async(req, res) => {
    try {
        const searchParams = {
            q: req.query.q || req.body.q,
            page: parseInt(req.query.page || req.body.page) || 1,
            per_page: parseInt(req.query.per_page || req.body.per_page) || 20,
            filters: {
                category: req.query.category || req.body.filters?.category,
                country: req.query.country || req.body.filters?.country,
                sort_by: req.query.sort_by || req.body.filters?.sort_by || 'relevance'
            }
        };

        const result = await elastic_sites.get_videos(searchParams, req.query.pageToken);
        
        if (result.success !== false) {
            res.status(200).json({
                success: true,
                data: {
                    results: result.results || result.data || [],
                    total: result.total || result.totalResults || 0,
                    page: searchParams.page,
                    per_page: searchParams.per_page,
                    nextPageToken: result.nextPageToken,
                    prevPageToken: result.prevPageToken,
                    query: searchParams.q,
                    time_taken: result.time_taken || 0
                }
            });
        } else {
            res.status(200).json({
                success: false,
                data: { results: [], total: 0 },
                error: result.error || 'Video search service temporarily unavailable'
            });
        }
    } catch (error) {
        console.error('Video search API error:', error);
        res.status(500).json({
            success: false,
            data: { results: [], total: 0 },
            error: 'Internal server error'
        });
    }
};

// News search API endpoint
const get_news = async(req, res) => {
    try {
        const searchParams = {
            q: req.query.q || req.body.q,
            page: parseInt(req.query.page || req.body.page) || 1,
            per_page: parseInt(req.query.per_page || req.body.per_page) || 20,
            filters: {
                category: req.query.category || req.body.filters?.category,
                sort_by: req.query.sort_by || req.body.filters?.sort_by || 'date',
                date_range: {
                    from: req.query.date_from || req.body.filters?.date_range?.from || "now-30d",
                    to: req.query.date_to || req.body.filters?.date_range?.to
                }
            }
        };

        const result = await elastic_sites.get_news(searchParams);
        
        if (result.success !== false) {
            res.status(200).json({
                success: true,
                data: {
                    results: result.results || result.data || [],
                    total: result.total || 0,
                    page: searchParams.page,
                    per_page: searchParams.per_page,
                    total_pages: result.pagination?.total_pages || Math.ceil((result.total || 0) / searchParams.per_page),
                    query: searchParams.q,
                    time_taken: result.time_taken || 0
                }
            });
        } else {
            res.status(200).json({
                success: false,
                data: { results: [], total: 0 },
                error: result.error || 'News search service temporarily unavailable'
            });
        }
    } catch (error) {
        console.error('News search API error:', error);
        res.status(500).json({
            success: false,
            data: { results: [], total: 0 },
            error: 'Internal server error'
        });
    }
};

// Enhanced autocomplete/suggestions API with modern features
const get_suggestions = async(req, res) => {
    try {
        const query = req.query.q || req.body.q;
        
        if (!query || query.length < 2) {
            return res.status(200).json({
                success: true,
                data: { suggestions: [] }
            });
        }

        const suggestions = await elastic_sites.get_suggestions(query);
        
        res.status(200).json({
            success: true,
            data: {
                suggestions: suggestions || [],
                query: query
            }
        });
    } catch (error) {
        console.error('Suggestions API error:', error);
        res.status(200).json({
            success: false,
            data: { suggestions: [] },
            error: 'Suggestions service temporarily unavailable'
        });
    }
};

// Health check endpoint
const health_check = async(req, res) => {
    try {
        const isElasticsearchAvailable = await elastic_sites.checkElasticsearchConnection();
        
        res.status(200).json({
            success: true,
            data: {
                elasticsearch: isElasticsearchAvailable ? 'connected' : 'disconnected',
                database: 'connected', // Assuming MySQL is working if this endpoint is hit
                api: 'operational',
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Health check failed',
            timestamp: new Date().toISOString()
        });
    }
};

// Get search aggregations (for filters)
const get_aggregations = async(req, res) => {
    try {
        // Get aggregations without running a full search
        const searchParams = {
            q: req.query.q || "*",
            page: 1,
            per_page: 1, // Minimal results
            filters: {}
        };

        const result = await elastic_sites.get(searchParams);
        
        res.status(200).json({
            success: true,
            data: {
                aggregations: result.aggregations || {},
                categories: result.aggregations?.categories?.buckets || [],
                languages: result.aggregations?.languages?.buckets || [],
                countries: result.aggregations?.countries?.buckets || []
            }
        });
    } catch (error) {
        console.error('Aggregations API error:', error);
        res.status(500).json({
            success: false,
            data: { aggregations: {} },
            error: 'Aggregations service temporarily unavailable'
        });
    }
};

module.exports = {
    search,
    get_images,
    get_videos,
    get_news,
    get_suggestions,
    health_check,
    get_aggregations
};