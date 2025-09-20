//rootController.js - Updated for Elasticsearch 8+ and Modern Features

const searchModel = require("../models/searchModel");
const elastic_sites = require('../models/elastic_search/site');
const { Client } = require("@elastic/elasticsearch");

// Initialize Elasticsearch client with proper configuration
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

const { con } = require("../mysql");

// Enhanced search function with filters support
const search = async(req, res) => {
    try {
        const startTime = Date.now();
        
        // Build search parameters with filters
        const searchParams = {
            q: req.query.q,
            page: parseInt(req.query.page) || 1,
            per_page: parseInt(req.query.per_page) || 20,
            filters: {
                category: req.query.category,
                language: req.query.language,
                country: req.query.country,
                content_type: req.query.content_type || 'all',
                sort_by: req.query.sort_by || 'relevance',
                date_range: {
                    from: req.query.date_from,
                    to: req.query.date_to
                }
            }
        };

        const searchResults = await elastic_sites.get(searchParams);
        
        // Handle different response formats (for backward compatibility)
        let responseData;
        if (searchResults.success !== undefined) {
            responseData = {
                success: searchResults.success,
                results: searchResults.results || [],
                total: searchResults.total || 0,
                pagination: searchResults.pagination || { current_page: 1, pages: [1] },
                related: searchResults.related || [],
                aggregations: searchResults.aggregations || {},
                time_taken: searchResults.time_taken || ((Date.now() - startTime) / 1000),
                query: searchResults.query || req.query.q,
                filters: searchResults.filters || {},
                error: searchResults.error
            };
        } else {
            responseData = {
                success: true,
                results: searchResults.data || [],
                total: searchResults.total || 0,
                pagination: searchResults.pagineatin || { current_page: 1, pages: [1] },
                related: searchResults.related || [],
                aggregations: searchResults.facets || {},
                time_taken: (Date.now() - startTime) / 1000,
                query: req.query.q,
                filters: searchParams.filters
            };
        }

        // Format dates consistently
        if (responseData.results && responseData.results.length > 0) {
            responseData.results.forEach(result => {
                if (result.site_data_last_update) {
                    result.site_data_last_update = result.site_data_last_update
                        .replace(/T/, ' ')
                        .replace(/\..+/, '');
                } else {
                    result.site_data_last_update = new Date().toISOString()
                        .replace(/T/, ' ')
                        .replace(/\..+/, '');
                }
            });
        }

        // Log search results for debugging
        console.log({
            query: req.query.q,
            total: responseData.total,
            results_count: responseData.results.length,
            time_taken: responseData.time_taken,
            filters: searchParams.filters,
            success: responseData.success
        });

        // Return JSON response for API usage
        res.json({
            success: responseData.success,
            data: {
                results: responseData.results,
                total: responseData.total,
                pagination: responseData.pagination,
                related: responseData.related,
                aggregations: responseData.aggregations,
                filters: searchParams.filters,
                time_taken: responseData.time_taken,
                query: req.query.q
            },
            error: responseData.error
        });

    } catch (error) {
        console.error('Search controller error:', error);
        res.status(500).json({
            success: false,
            data: {
                results: [],
                total: 0,
                pagination: { current_page: 1, pages: [1] },
                related: [],
                aggregations: {},
                filters: {}
            },
            error: 'Search service temporarily unavailable',
            query: req.query.q
        });
    }
};

// Enhanced image search with filters
const image_search = async(req, res) => {
    try {
        const startTime = Date.now();
        
        const searchParams = {
            q: req.query.q,
            page: parseInt(req.query.page) || 1,
            per_page: parseInt(req.query.per_page) || 50,
            filters: {
                category: req.query.category,
                sort_by: req.query.sort_by || 'relevance'
            }
        };

        const searchResults = await elastic_sites.get_images(searchParams);
        
        // Handle response format
        const responseData = searchResults.success !== undefined ? {
            results: searchResults.results || [],
            total: searchResults.total || 0,
            pagination: searchResults.pagination || { current_page: 1, pages: [1] },
            time_taken: searchResults.time_taken || ((Date.now() - startTime) / 1000)
        } : {
            results: searchResults.data || [],
            total: searchResults.total || 0,
            pagination: searchResults.pagineatin || { current_page: 1, pages: [1] },
            time_taken: (Date.now() - startTime) / 1000
        };

        res.json({
            success: true,
            data: {
                results: responseData.results,
                total: responseData.total,
                pagination: responseData.pagination,
                time_taken: responseData.time_taken,
                query: req.query.q,
                filters: searchParams.filters
            }
        });

    } catch (error) {
        console.error('Image search controller error:', error);
        res.status(500).json({
            success: false,
            data: {
                results: [],
                total: 0,
                pagination: { current_page: 1, pages: [1] }
            },
            error: 'Image search service temporarily unavailable',
            query: req.query.q
        });
    }
};

// Enhanced video search
const videos_search = async(req, res) => {
    try {
        const startTime = Date.now();
        
        const searchParams = {
            q: req.query.q,
            page: parseInt(req.query.page) || 1,
            per_page: parseInt(req.query.per_page) || 20,
            filters: {
                category: req.query.category,
                country: req.query.country,
                sort_by: req.query.sort_by || 'relevance'
            }
        };

        const searchResults = await elastic_sites.get_videos(searchParams, req.query.pageToken);
        
        const responseData = searchResults.success !== undefined ? {
            results: searchResults.results || [],
            total: searchResults.total || 0,
            pagination: searchResults.pagination || { current_page: 1, pages: [1] },
            time_taken: searchResults.time_taken || ((Date.now() - startTime) / 1000),
            nextPageToken: searchResults.nextPageToken,
            prevPageToken: searchResults.prevPageToken
        } : {
            results: searchResults.data || [],
            total: searchResults.totalResults || 0,
            pagination: searchResults.pagineatin || { current_page: 1, pages: [1] },
            time_taken: (Date.now() - startTime) / 1000,
            nextPageToken: searchResults.nextPageToken,
            prevPageToken: searchResults.prevPageToken
        };

        res.json({
            success: true,
            data: {
                results: responseData.results,
                total: responseData.total,
                pagination: responseData.pagination,
                nextPageToken: responseData.nextPageToken,
                prevPageToken: responseData.prevPageToken,
                time_taken: responseData.time_taken,
                query: req.query.q,
                filters: searchParams.filters
            }
        });

    } catch (error) {
        console.error('Video search controller error:', error);
        res.status(500).json({
            success: false,
            data: {
                results: [],
                total: 0,
                pagination: { current_page: 1, pages: [1] }
            },
            error: 'Video search service temporarily unavailable',
            query: req.query.q
        });
    }
};

// Enhanced news search
const news_search = async(req, res) => {
    try {
        const startTime = Date.now();
        
        const searchParams = {
            q: req.query.q,
            page: parseInt(req.query.page) || 1,
            per_page: parseInt(req.query.per_page) || 20,
            filters: {
                category: req.query.category,
                sort_by: req.query.sort_by || 'date',
                date_range: {
                    from: req.query.date_from || "now-30d",
                    to: req.query.date_to
                }
            }
        };

        const searchResults = await elastic_sites.get_news(searchParams);
        
        const responseData = searchResults.success !== undefined ? {
            results: searchResults.results || [],
            total: searchResults.total || 0,
            pagination: searchResults.pagination || { current_page: 1, pages: [1] },
            time_taken: searchResults.time_taken || ((Date.now() - startTime) / 1000)
        } : {
            results: searchResults.data || [],
            total: searchResults.total || 0,
            pagination: searchResults.pagineatin || { current_page: 1, pages: [1] },
            time_taken: (Date.now() - startTime) / 1000
        };

        res.json({
            success: true,
            data: {
                results: responseData.results,
                total: responseData.total,
                pagination: responseData.pagination,
                time_taken: responseData.time_taken,
                query: req.query.q,
                filters: searchParams.filters
            }
        });

    } catch (error) {
        console.error('News search controller error:', error);
        res.status(500).json({
            success: false,
            data: {
                results: [],
                total: 0,
                pagination: { current_page: 1, pages: [1] }
            },
            error: 'News search service temporarily unavailable',
            query: req.query.q
        });
    }
};

// Other controller functions converted to JSON responses
const index = async(req, res) => {
    res.json({
        success: true,
        data: {
            message: "Homepage - please use React frontend",
            session: req.session ? "active" : "inactive"
        }
    });
};

const login = async(req, res) => {
    res.json({
        success: true,
        data: {
            message: "Login page - please use React frontend",
            session: req.session ? "active" : "inactive"
        }
    });
};

const login_post = async(req, res) => {
    try {
        if (searchModel.login(req.body).length == 0) {
            return res.status(401).json({
                success: false,
                error: "Invalid credentials"
            });
        }
        res.json({
            success: true,
            data: {
                message: "Login successful - redirecting to admin",
                redirect: "/administrator"
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: "Login error"
        });
    }
};

const go = async(req, res) => {
    if (req.query.id === undefined) res.redirect('/');
    else {
        try {
            var row = await con.query(`SELECT * FROM site_data WHERE site_data_id = ${req.query.id};`);
            if (row && row.length > 0) {
                row[0].site_data_visit = parseInt(row[0].site_data_visit) + 1;
                con.query(`UPDATE site_data SET site_data_visit = '${row[0].site_data_visit}' WHERE site_data.site_data_id = ${row[0].site_data_id};`);
                add(row[0]);
                res.redirect(row[0].site_data_link);
            } else {
                res.redirect('/');
            }
        } catch (error) {
            console.error('Go controller error:', error);
            res.redirect('/');
        }
    }
};

// Updated add function for Elasticsearch 8+
async function add(x) {
    try {
        await client.index({
            index: 'sites',
            id: x.site_data_id,
            document: x
        });
    } catch (error) {
        console.error('Error indexing document:', error);
    }
}

function about(req, res) {
    res.json({
        success: true,
        data: {
            message: "About page - please use React frontend",
            app: "Bhoomy Search Engine",
            version: "5.2.0"
        }
    });
}

module.exports = {
    search,
    index,
    login,
    login_post,
    image_search,
    videos_search,
    news_search,
    go,
    about
};