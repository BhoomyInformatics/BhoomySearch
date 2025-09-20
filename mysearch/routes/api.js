const express = require('express');
const router = express.Router();
const Joi = require('joi');
const axios = require('axios');
const mysql = require('../mysql');
const { apiLogger, searchLogger } = require('../utils/logger');

// Validation schemas
const searchSchema = Joi.object({
    q: Joi.string().required().min(1).max(500),
    page: Joi.number().integer().min(1).default(1),
    per_page: Joi.number().integer().min(1).max(100).default(20),
    category: Joi.string().allow('').optional(),
    language: Joi.string().allow('').optional(),
    country: Joi.string().allow('').optional(),
    content_type: Joi.string().valid('all', 'text', 'images', 'videos', 'news').default('all'),
    sort_by: Joi.string().valid('relevance', 'date', 'popularity').default('relevance'),
    date_from: Joi.date().optional(),
    date_to: Joi.date().optional()
});

const siteSchema = Joi.object({
    site_title: Joi.string().required().max(500),
    site_url: Joi.string().uri().required(),
    site_description: Joi.string().optional().max(1000),
    site_keywords: Joi.string().optional().max(500),
    site_category: Joi.string().optional().max(100),
    site_language: Joi.string().optional().max(10),
    site_country: Joi.string().optional().max(10),
    site_priority: Joi.number().integer().min(1).max(10).default(5),
    site_crawl_frequency: Joi.string().valid('hourly', 'daily', 'weekly', 'monthly').default('daily')
});

// Helper function to handle async routes
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// Helper function to build Elasticsearch query
const buildElasticsearchQuery = (params) => {
    const { q, category, language, country, content_type, sort_by, date_from, date_to } = params;
    
    const query = {
        bool: {
            must: [
                {
                    multi_match: {
                        query: q,
                        fields: [
                            'site_data_title^3',
                            'site_data_h1^2.5',
                            'site_data_h2^2',
                            'site_data_description^1.5',
                            'site_data_keywords^1.5',
                            'site_data_article',
                            'site_title^2'
                        ],
                        type: 'best_fields',
                        fuzziness: 'AUTO'
                    }
                }
            ],
            filter: []
        }
    };

    // Add filters (only if not empty)
    if (category && category.trim() !== '') {
        query.bool.filter.push({ term: { 'site_category.keyword': category } });
    }
    
    if (language && language.trim() !== '') {
        query.bool.filter.push({ term: { 'site_language.keyword': language } });
    }
    
    if (country && country.trim() !== '') {
        query.bool.filter.push({ term: { 'site_country.keyword': country } });
    }
    
    if (content_type && content_type !== 'all') {
        // Add content type specific filters
        switch (content_type) {
            case 'images':
                query.bool.filter.push({ exists: { field: 'site_data_image' } });
                break;
            case 'videos':
                query.bool.filter.push({ term: { 'content_type.keyword': 'video' } });
                break;
            case 'news':
                query.bool.filter.push({ term: { 'site_category.keyword': 'news' } });
                break;
        }
    }
    
    if (date_from || date_to) {
        const dateRange = {};
        if (date_from) dateRange.gte = date_from;
        if (date_to) dateRange.lte = date_to;
        query.bool.filter.push({ range: { 'site_data_date': dateRange } });
    }

    return query;
};

// Helper function to build sort options
const buildSortOptions = (sort_by) => {
    switch (sort_by) {
        case 'date':
            return [
                { 'site_data_last_update': { order: 'desc', missing: '_last' } },
                { '_score': { order: 'desc' } }
            ];
        case 'popularity':
            return [
                { 'site_data_visit': { order: 'desc', missing: '_last' } },
                { '_score': { order: 'desc' } }
            ];
        default:
            return [{ '_score': { order: 'desc' } }];
    }
};

// Search endpoint
router.get('/search', asyncHandler(async (req, res) => {
    searchLogger.info('=== SEARCH API CALLED ===', {
        query: req.query,
        url: req.originalUrl,
        method: req.method,
        headers: req.headers
    });

    const { error, value } = searchSchema.validate(req.query);
    
    if (error) {
        searchLogger.error('Validation error in search API', { error: error.details[0].message, query: req.query });
        return res.status(400).json({
            success: false,
            error: error.details[0].message
        });
    }

    const { q, page, per_page, ...filters } = value;
    const from = (page - 1) * per_page;
    
    searchLogger.info('Search parameters validated', { q, page, per_page, filters, from });
    
    try {
        const startTime = Date.now();
        
        // Use the working elastic_sites model instead of direct elasticClient
        const elastic_sites = require('../models/elastic_search/site');
        
        searchLogger.info('Calling elastic_sites.get() with parameters', { q, page, per_page, filters });
        
        const searchResults = await elastic_sites.get({ 
            q, 
            page, 
            per_page, 
            filters 
        });
        
        searchLogger.info('Search results from elastic_sites.get()', {
            success: searchResults.success,
            total: searchResults.total,
            results_count: searchResults.results?.length || 0,
            query: q,
            searchResults_keys: Object.keys(searchResults),
            first_result: searchResults.results?.[0] ? {
                id: searchResults.results[0].id,
                site_data_title: searchResults.results[0].site_data_title,
                site_data_link: searchResults.results[0].site_data_link
            } : null
        });
        
        if (!searchResults.success) {
            console.log('Search failed:', searchResults.error || 'Unknown error');
            throw new Error(`Elasticsearch search failed: ${searchResults.error || 'Unknown error'}`);
        }
        
        if (!searchResults.results || searchResults.results.length === 0) {
            console.log('No results found in searchResults.results');
            throw new Error('No search results found');
        }

        const results = searchResults.results.map((result, index) => ({
            id: from + index + 1,
            site_data_title: result.site_data_title,
            site_data_description: result.site_data_description,
            site_data_article: result.site_data_article || result.site_data_content,
            site_data_link: result.site_data_link,
            site_data_image: result.site_data_image,
            site_data_date: result.site_data_date || result.site_data_last_update,
            site_data_word_count: result.site_data_word_count,
            site_data_content_length: result.site_data_content_length,
            site_title: result.site_title,
            site_url: result.site_url,
            site_category: result.site_category,
            site_language: result.site_language,
            site_country: result.site_country,
            score: result.score
        }));

        const time_taken = Date.now() - startTime;

        const finalResponse = {
            success: true,
            data: {
                results,
                total: searchResults.total,
                page,
                per_page,
                total_pages: searchResults.pagination?.total_pages || Math.ceil(searchResults.total / per_page),
                query: q,
                time_taken,
                filters,
                elasticsearch: true,
                cached: searchResults.cached || false
            }
        };

        searchLogger.info('Final API response prepared', {
            success: finalResponse.success,
            data_keys: Object.keys(finalResponse.data),
            results_count: finalResponse.data.results.length,
            total: finalResponse.data.total,
            query: finalResponse.data.query,
            first_result_title: finalResponse.data.results[0]?.site_data_title
        });

        // Log search query
        req.app.locals.logger?.info('Search performed via elastic_sites model', {
            query: q,
            results_count: results.length,
            total_results: searchResults.total,
            time_taken,
            page,
            filters
        });

        res.json(finalResponse);

    } catch (error) {
        req.app.locals.logger.error('Elasticsearch search failed, trying MySQL fallback:', error);
        
        // Fallback to MySQL search if Elasticsearch fails
        try {
            const fallbackStartTime = Date.now(); // Fix: Define startTime for fallback
            const mysqlQuery = `
                SELECT 
                    sd.site_data_id,
                    sd.site_data_site_id,
                    sd.site_data_link,
                    sd.site_data_title,
                    sd.site_data_description,
                    sd.site_data_icon as site_data_image,
                    sd.site_data_last_update as site_data_date,
                    sd.word_count as site_data_word_count,
                    sd.content_length as site_data_content_length,
                    s.site_title,
                    s.site_url,
                    s.site_category,
                    s.site_language,
                    s.site_country
                FROM site_data sd
                JOIN sites s ON sd.site_data_site_id = s.site_id
                WHERE (
                    sd.site_data_title LIKE ? OR 
                    sd.site_data_description LIKE ? OR 
                    sd.site_data_article LIKE ?
                )
                ${filters.category && filters.category.trim() !== '' ? 'AND s.site_category = ?' : ''}
                ${filters.language && filters.language.trim() !== '' ? 'AND s.site_language = ?' : ''}
                ORDER BY sd.site_data_last_update DESC
                LIMIT ? OFFSET ?
            `;
            
            const searchTerm = `%${q}%`;
            const queryParams = [searchTerm, searchTerm, searchTerm];
            
            if (filters.category && filters.category.trim() !== '') queryParams.push(filters.category);
            if (filters.language && filters.language.trim() !== '') queryParams.push(filters.language);
            
            queryParams.push(per_page, from);
            
            const results = await mysql.query(mysqlQuery, queryParams);
            
            res.json({
                success: true,
                data: {
                    results: results.map((result, index) => ({
                        id: from + index + 1,
                        ...result
                    })),
                    total: results.length,
                    page,
                    per_page,
                    total_pages: Math.ceil(results.length / per_page),
                    query: q,
                    time_taken: Date.now() - fallbackStartTime, // Fix: Use fallbackStartTime
                    fallback: true
                }
            });
            
        } catch (mysqlError) {
            req.app.locals.logger.error('MySQL fallback error:', mysqlError);
            res.status(500).json({
                success: false,
                error: 'Search service temporarily unavailable'
            });
        }
    }
}));

// Search suggestions endpoint
router.get('/search/suggestions', asyncHandler(async (req, res) => {
    const { q } = req.query;
    
    if (!q || q.length < 2) {
        return res.json({
            success: true,
            data: []
        });
    }

    try {
        // Get suggestions from search queries table
        const suggestions = await mysql.query(`
            SELECT DISTINCT query 
            FROM search_queries 
            WHERE query LIKE ? 
            ORDER BY results_count DESC 
            LIMIT 10
        `, [`${q}%`]);

        res.json({
            success: true,
            data: suggestions.map(s => s.query)
        });

    } catch (error) {
        req.app.locals.logger.error('Suggestions error:', error);
        res.json({
            success: true,
            data: []
        });
    }
}));

// Get categories endpoint
router.get('/categories', asyncHandler(async (req, res) => {
    try {
        const categories = await mysql.query(`
            SELECT DISTINCT site_category 
            FROM sites 
            WHERE site_category IS NOT NULL AND site_category != ''
            ORDER BY site_category
        `);

        res.json({
            success: true,
            data: categories.map(c => c.site_category)
        });

    } catch (error) {
        req.app.locals.logger.error('Categories error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch categories'
        });
    }
}));

// Get languages endpoint
router.get('/languages', asyncHandler(async (req, res) => {
    try {
        const languages = await mysql.query(`
            SELECT DISTINCT site_language 
            FROM sites 
            WHERE site_language IS NOT NULL AND site_language != ''
            ORDER BY site_language
        `);

        const languageMap = {
            'en': 'English',
            'hi': 'Hindi',
            'es': 'Spanish',
            'fr': 'French',
            'de': 'German',
            'it': 'Italian',
            'pt': 'Portuguese',
            'ru': 'Russian',
            'ja': 'Japanese',
            'ko': 'Korean',
            'zh': 'Chinese'
        };

        res.json({
            success: true,
            data: languages.map(l => ({
                code: l.site_language,
                name: languageMap[l.site_language] || l.site_language
            }))
        });

    } catch (error) {
        req.app.locals.logger.error('Languages error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch languages'
        });
    }
}));

// Sites management endpoints
router.get('/sites', asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const per_page = parseInt(req.query.per_page) || 20;
    const offset = (page - 1) * per_page;

    try {
        const sites = await mysql.query(`
            SELECT s.*, 
                   COUNT(sd.site_data_id) as total_pages_crawled,
                   SUM(CASE WHEN sd.status = 'indexed' THEN 1 ELSE 0 END) as successful_crawls,
                   SUM(CASE WHEN sd.status = 'failed' THEN 1 ELSE 0 END) as failed_crawls,
                   MAX(sd.crawl_date) as last_page_crawled
            FROM sites s
            LEFT JOIN site_data sd ON s.site_id = sd.site_data_site_id
            GROUP BY s.site_id
            ORDER BY s.site_created DESC
            LIMIT ? OFFSET ?
        `, [per_page, offset]);

        const totalCount = await mysql.query('SELECT COUNT(*) as count FROM sites');
        const total = totalCount[0].count;

        res.json({
            success: true,
            data: {
                sites: sites.map(site => ({
                    ...site,
                    success_rate: site.total_pages_crawled > 0 
                        ? (site.successful_crawls / site.total_pages_crawled) 
                        : 0
                })),
                total,
                page,
                per_page,
                total_pages: Math.ceil(total / per_page)
            }
        });

    } catch (error) {
        req.app.locals.logger.error('Sites fetch error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch sites'
        });
    }
}));

// Get single site
router.get('/sites/:id', asyncHandler(async (req, res) => {
    const siteId = parseInt(req.params.id);

    if (!siteId) {
        return res.status(400).json({
            success: false,
            error: 'Invalid site ID'
        });
    }

    try {
        const sites = await mysql.query(`
            SELECT s.*, 
                   COUNT(sd.site_data_id) as total_pages_crawled,
                   SUM(CASE WHEN sd.site_data_status = 'indexed' THEN 1 ELSE 0 END) as successful_crawls,
                   SUM(CASE WHEN sd.site_data_status = 'failed' THEN 1 ELSE 0 END) as failed_crawls
            FROM sites s
            LEFT JOIN site_data sd ON s.site_id = sd.site_data_site_id
            WHERE s.site_id = ?
            GROUP BY s.site_id
        `, [siteId]);

        if (sites.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Site not found'
            });
        }

        const site = sites[0];
        site.success_rate = site.total_pages_crawled > 0 
            ? (site.successful_crawls / site.total_pages_crawled) 
            : 0;

        res.json({
            success: true,
            data: site
        });

    } catch (error) {
        req.app.locals.logger.error('Site fetch error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch site'
        });
    }
}));

// Add new site
router.post('/sites', asyncHandler(async (req, res) => {
    const { error, value } = siteSchema.validate(req.body);
    
    if (error) {
        return res.status(400).json({
            success: false,
            error: error.details[0].message
        });
    }

    try {
        // Check if site already exists
        const existingSites = await mysql.query(
            'SELECT site_id FROM sites WHERE site_url = ?',
            [value.site_url]
        );

        if (existingSites.length > 0) {
            return res.status(409).json({
                success: false,
                error: 'Site already exists'
            });
        }

        // Insert new site
        const result = await mysql.query(`
            INSERT INTO sites (
                site_title, site_url, site_description, site_keywords,
                site_category, site_language, site_country, site_priority,
                site_crawl_frequency, site_created, site_updated
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        `, [
            value.site_title,
            value.site_url,
            value.site_description || '',
            value.site_keywords || '',
            value.site_category || '',
            value.site_language || 'en',
            value.site_country || '',
            value.site_priority,
            value.site_crawl_frequency
        ]);

        const newSite = await mysql.query(
            'SELECT * FROM sites WHERE site_id = ?',
            [result.insertId]
        );

        req.app.locals.logger.info('New site added', {
            site_id: result.insertId,
            site_url: value.site_url
        });

        res.status(201).json({
            success: true,
            data: newSite[0],
            message: 'Site added successfully'
        });

    } catch (error) {
        req.app.locals.logger.error('Site creation error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to add site'
        });
    }
}));

// Update site
router.put('/sites/:id', asyncHandler(async (req, res) => {
    const siteId = parseInt(req.params.id);
    const { error, value } = siteSchema.validate(req.body);
    
    if (!siteId) {
        return res.status(400).json({
            success: false,
            error: 'Invalid site ID'
        });
    }

    if (error) {
        return res.status(400).json({
            success: false,
            error: error.details[0].message
        });
    }

    try {
        // Check if site exists
        const existingSites = await mysql.query(
            'SELECT site_id FROM sites WHERE site_id = ?',
            [siteId]
        );

        if (existingSites.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Site not found'
            });
        }

        // Update site
        await mysql.query(`
            UPDATE sites SET 
                site_title = ?, site_url = ?, site_description = ?, 
                site_keywords = ?, site_category = ?, site_language = ?, 
                site_country = ?, site_priority = ?, site_crawl_frequency = ?,
                site_updated = NOW()
            WHERE site_id = ?
        `, [
            value.site_title,
            value.site_url,
            value.site_description || '',
            value.site_keywords || '',
            value.site_category || '',
            value.site_language || 'en',
            value.site_country || '',
            value.site_priority,
            value.site_crawl_frequency,
            siteId
        ]);

        const updatedSite = await mysql.query(
            'SELECT * FROM sites WHERE site_id = ?',
            [siteId]
        );

        req.app.locals.logger.info('Site updated', {
            site_id: siteId,
            site_url: value.site_url
        });

        res.json({
            success: true,
            data: updatedSite[0],
            message: 'Site updated successfully'
        });

    } catch (error) {
        req.app.locals.logger.error('Site update error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update site'
        });
    }
}));

// Delete site
router.delete('/sites/:id', asyncHandler(async (req, res) => {
    const siteId = parseInt(req.params.id);

    if (!siteId) {
        return res.status(400).json({
            success: false,
            error: 'Invalid site ID'
        });
    }

    try {
        // Check if site exists
        const existingSites = await mysql.query(
            'SELECT site_id FROM sites WHERE site_id = ?',
            [siteId]
        );

        if (existingSites.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Site not found'
            });
        }

        // Delete site data first (foreign key constraint)
        await mysql.query('DELETE FROM site_data WHERE site_data_site_id = ?', [siteId]);
        
        // Delete site
        await mysql.query('DELETE FROM sites WHERE site_id = ?', [siteId]);

        req.app.locals.logger.info('Site deleted', { site_id: siteId });

        res.json({
            success: true,
            message: 'Site deleted successfully'
        });

    } catch (error) {
        req.app.locals.logger.error('Site deletion error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete site'
        });
    }
}));

// Crawl statistics endpoint
router.get('/crawl/statistics', asyncHandler(async (req, res) => {
    const siteId = req.query.site_id;

    try {
        let query = `
            SELECT cs.*, s.site_title, s.site_url
            FROM crawl_statistics cs
            JOIN sites s ON cs.site_id = s.site_id
        `;
        
        const params = [];
        
        if (siteId) {
            query += ' WHERE cs.site_id = ?';
            params.push(parseInt(siteId));
        }
        
        query += ' ORDER BY cs.start_time DESC LIMIT 50';

        const statistics = await mysql.query(query, params);

        res.json({
            success: true,
            data: statistics
        });

    } catch (error) {
        req.app.locals.logger.error('Crawl statistics error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch crawl statistics'
        });
    }
}));

// Images search endpoint with optimized pagination and caching
router.get('/images', asyncHandler(async (req, res) => {
    const { error, value } = searchSchema.validate(req.query);
    
    if (error) {
        return res.status(400).json({
            success: false,
            error: error.details[0].message
        });
    }

    const { q, page, per_page } = value;
    const from = (page - 1) * per_page;
    
    // Add caching headers for better performance
    res.set({
        'Cache-Control': 'public, max-age=300', // 5 minute cache
        'ETag': `"${Date.now()}-${q}-${page}"`,
        'X-Response-Time': '0ms'
    });
    
    try {
        const startTime = Date.now();
        
        // Search in images indices using the elastic_sites model with optimized parameters
        const elastic_sites = require('../models/elastic_search/site');
        const imageResults = await elastic_sites.get_images({ 
            q, 
            page, 
            per_page: Math.min(per_page, 100) // Limit to max 100 images per page
        });
        
        if (!imageResults.success || !imageResults.results || imageResults.results.length === 0) {
            throw new Error('No image results found');
        }
        
        // Generate optimized thumbnails and format results
        const results = imageResults.results.map((result, index) => {
            const imageUrl = result.site_img_link;
            const thumbnailUrl = generateThumbnailUrl(imageUrl, 200, 200); // Generate thumbnail URL
            
            return {
                id: result.id || `img-${from + index + 1}`,
                title: result.site_img_title || result.site_img_link || 'Untitled Image',
                url: imageUrl,
                thumbnail: thumbnailUrl,
                source: result.site_img_source || 'Bhoomy Index',
                width: result.site_img_width,
                height: result.site_img_height,
                size: result.site_img_size,
                alt: result.site_img_alt || result.site_img_title || 'Image'
            };
        });

        const time_taken = Date.now() - startTime;
        
        // Add performance headers
        res.set('X-Response-Time', `${time_taken}ms`);

        res.json({
            success: true,
            data: {
                results,
                total: imageResults.total || results.length,
                page,
                per_page,
                total_pages: Math.ceil((imageResults.total || results.length) / per_page),
                query: q,
                time_taken,
                source: 'elasticsearch',
                cached: false
            }
        });
    } catch (error) {
        req.app.locals.logger.error('Images search failed - using fallback', { error: error.message, query: q });
        
        // Fallback to MySQL for images when Elasticsearch fails
        try {
            const fallbackStartTime = Date.now();
            const mysqlQuery = `
                SELECT 
                    site_img_id as id,
                    site_img_title as title,
                    site_img_link as url,
                    site_img_alt as alt,
                    site_img_width as width,
                    site_img_height as height,
                    site_img_size as size
                FROM site_img 
                WHERE site_img_title LIKE ? OR site_img_alt LIKE ?
                ORDER BY site_img_id DESC
                LIMIT ? OFFSET ?
            `;
            
            const searchTerm = `%${q}%`;
            const imageResults = await mysql.query(mysqlQuery, [searchTerm, searchTerm, per_page, from]);
            
            const time_taken = Date.now() - fallbackStartTime;
            
            // Generate optimized thumbnails for MySQL results
            const results = imageResults.map((result, index) => {
                const thumbnailUrl = generateThumbnailUrl(result.url, 200, 200);
                return {
                    id: `img-${from + index + 1}`,
                    title: result.title || 'Untitled Image',
                    url: result.url,
                    thumbnail: thumbnailUrl,
                    source: 'MySQL Fallback',
                    width: result.width,
                    height: result.height,
                    size: result.size,
                    alt: result.alt || result.title || 'Image'
                };
            });
            
            res.json({
                success: true,
                data: {
                    results,
                    total: imageResults.length,
                    page,
                    per_page,
                    total_pages: Math.ceil(imageResults.length / per_page),
                    query: q,
                    time_taken,
                    fallback: true,
                    cached: false
                }
            });
            
        } catch (mysqlError) {
            req.app.locals.logger.error('MySQL images fallback failed', { error: mysqlError.message, query: q });
            
            // Return empty results when both Elasticsearch and MySQL fail
            res.status(500).json({
                success: false,
                error: 'Image search service temporarily unavailable',
                data: {
                    results: [],
                    total: 0,
                    page,
                    per_page,
                    total_pages: 0,
                    query: q,
                    time_taken: 0
                }
            });
        }
    }
}));

// Helper function to generate thumbnail URLs with better fallbacks
function generateThumbnailUrl(originalUrl, width = 200, height = 200) {
    if (!originalUrl) return 'https://via.placeholder.com/200x200?text=No+Image';
    
    // For external images, use optimized thumbnail generation
    if (originalUrl.startsWith('http')) {
        // Handle YouTube thumbnails
        if (originalUrl.includes('youtube.com') || originalUrl.includes('youtu.be')) {
            const videoId = extractYouTubeVideoId(originalUrl);
            if (videoId) {
                return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
            }
        }
        
        // For other external images, use the image proxy with fallback
        return `/api/image-proxy?url=${encodeURIComponent(originalUrl)}`;
    }
    
    // For local images, you could implement thumbnail generation
    return originalUrl;
}

// Image proxy endpoint to handle CORS issues
router.get('/image-proxy', asyncHandler(async (req, res) => {
    const { url } = req.query;
    
    if (!url) {
        return res.status(400).json({ error: 'URL parameter is required' });
    }
    
    // Validate URL
    try {
        new URL(url);
    } catch (error) {
        return res.status(400).json({ error: 'Invalid URL format' });
    }
    
    try {
        console.log('🖼️ Image proxy: Fetching image:', url);
        
        const response = await axios.get(url, {
            responseType: 'stream',
            timeout: 5000, // Reduced timeout to 5 seconds
            maxRedirects: 3, // Reduced redirects
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            }
        });
        
        // Check if response is actually an image
        const contentType = response.headers['content-type'];
        if (!contentType || !contentType.startsWith('image/')) {
            console.warn('⚠️ Image proxy: Non-image content type:', contentType, 'for URL:', url);
            return res.status(400).json({ 
                error: 'URL does not point to an image',
                contentType: contentType,
                url: url
            });
        }
        
        // Set appropriate headers
        res.set({
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Content-Length': response.headers['content-length'] || 'unknown'
        });
        
        // Handle response errors
        response.data.on('error', (error) => {
            console.error('🖼️ Image proxy stream error:', error.message);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Failed to stream image data' });
            }
        });
        
        // Pipe the image data to the response
        response.data.pipe(res);
        
        console.log('✅ Image proxy: Successfully streaming image');
        
    } catch (error) {
        console.error('🖼️ Image proxy error:', {
            message: error.message,
            code: error.code,
            url: url,
            status: error.response?.status,
            statusText: error.response?.statusText
        });
        
        if (!res.headersSent) {
            // Instead of returning an error, redirect to a placeholder image
            const placeholderUrl = `https://via.placeholder.com/200x200?text=Image+Unavailable`;
            res.redirect(placeholderUrl);
        }
    }
}));

// Helper function to extract YouTube video ID
function extractYouTubeVideoId(url) {
    const patterns = [
        /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
        /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
        /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
        /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    
    return null;
}

// Videos search endpoint
router.get('/videos', asyncHandler(async (req, res) => {
    const { error, value } = searchSchema.validate(req.query);
    
    if (error) {
        return res.status(400).json({
            success: false,
            error: error.details[0].message
        });
    }

    const { q, page, per_page } = value;
    const startTime = Date.now(); // Move outside try block
    
    try {
        
        // Search videos using the elastic_sites model (prioritize actual video content)
        const elastic_sites = require('../models/elastic_search/site');
        const videoResults = await elastic_sites.get_videos({ q, page, per_page });
        
        if (!videoResults.success || !videoResults.data || videoResults.data.length === 0) {
            throw new Error('No video results found');
        }
        
        const results = videoResults.data.map((video, index) => ({
            id: video.id || `video-${index}`,
            title: video.title,
            description: video.description,
            thumbnail: video.thumbnail,
            url: video.url,
            publishedAt: video.publishedAt,
            channel: video.channel || video.provider || 'YouTube Channel',
            channelUrl: video.channelUrl || '#',
            duration: video.duration || 'N/A',
            views: video.views || 'N/A',
            width: video.width,
            height: video.height,
            source: videoResults.source || 'video_database'
        }));

        const time_taken = Date.now() - startTime;

        console.log(`Video Search Successful: Query="${q}", Results=${results.length}, Total=${videoResults.total}, Source=${videoResults.source || 'elasticsearch'}`);

        res.json({
            success: true,
            data: {
                results,
                total: videoResults.total || results.length,
                page,
                per_page,
                query: q,
                time_taken,
                source: videoResults.source || 'video_database'
            }
        });
    } catch (error) {
        req.app.locals.logger.error('YouTube API failed, trying Elasticsearch video fallback', { error: error.message, query: q });
        
        // Fallback to Elasticsearch site_videos index (videos available in DB)
        try {
            const elasticsearch = require('@elastic/elasticsearch');
            const client = new elasticsearch.Client({
                node: process.env.ELASTICSEARCH_URL || 'https://localhost:9200',
                auth: {
                    username: process.env.ELASTICSEARCH_USERNAME || 'elastic',
                    password: process.env.ELASTICSEARCH_PASSWORD || 'bEvADDXp47tbSH32mPwB'
                },
                tls: { rejectUnauthorized: false },
                requestTimeout: 30000,
                maxRetries: 3
            });

            const from = (page - 1) * per_page;
            const videoSearchResponse = await client.search({
                index: ['site_videos'],
                size: per_page,
                from: from,
                query: {
                    bool: {
                        should: [
                            {
                                multi_match: {
                                    query: q,
                                    fields: ['site_videos_title^2', 'site_videos_description', 'site_videos_tags'],
                                    type: 'best_fields',
                                    fuzziness: 'AUTO'
                                }
                            }
                        ]
                    }
                },
                sort: [
                    { '_score': { order: 'desc' } }
                ],
                _source: [
                    'site_videos_id',
                    'site_videos_title',
                    'site_videos_description', 
                    'site_videos_thumbnail',
                    'site_videos_url',
                    'site_videos_created',
                    'site_videos_channel',
                    'site_videos_channel_url',
                    'site_videos_duration',
                    'site_videos_views'
                ]
            });

            // ES 8+ doesn't use .body property
            const results = videoSearchResponse.hits.hits.map((hit, index) => ({
                id: hit._source.site_videos_id || `video-${from + index + 1}`,
                title: hit._source.site_videos_title,
                description: hit._source.site_videos_description,
                thumbnail: hit._source.site_videos_thumbnail,
                url: hit._source.site_videos_url,
                publishedAt: hit._source.site_videos_created,
                channel: hit._source.site_videos_channel,
                channelUrl: hit._source.site_videos_channel_url,
                duration: hit._source.site_videos_duration,
                views: hit._source.site_videos_views,
                source: 'Bhoomy Index'
            }));

            const time_taken = Date.now() - startTime;
            const total = videoSearchResponse.hits.total.value; // ES 8+ doesn't use .body

            res.json({
                success: true,
                data: {
                    results,
                    total,
                    page,
                    per_page,
                    query: q,
                    time_taken,
                    source: 'elasticsearch'
                }
            });

        } catch (elasticError) {
            req.app.locals.logger.error('Elasticsearch video fallback also failed', { error: elasticError.message, query: q });
            
            // Final fallback to demo data only if everything fails
            const time_taken = Date.now() - startTime;
            
            res.json({
                success: true,
                data: {
                    results: [
                        {
                            id: 'demo-video-1',
                            title: `Related Content: ${q}`,
                            description: `Video search is temporarily unavailable. This shows related web content for "${q}". We are working to restore video functionality.`,
                            thumbnail: 'https://via.placeholder.com/320x180?text=Video+Search+Unavailable',
                            url: `#`,
                            publishedAt: new Date().toISOString(),
                            channel: 'Bhoomy Search',
                            channelUrl: '#',
                            duration: 'N/A',
                            views: 'Demo Content',
                            demo: true
                        }
                    ],
                    total: 1,
                    page,
                    per_page,
                    query: q,
                    time_taken,
                    demo: true,
                    message: 'Video search temporarily unavailable - showing placeholder content'
                }
            });
        }
    }
}));

// News search endpoint
router.get('/news', asyncHandler(async (req, res) => {
    const { error, value } = searchSchema.validate(req.query);
    
    if (error) {
        return res.status(400).json({
            success: false,
            error: error.details[0].message
        });
    }

    const { q, page, per_page, category } = value;
    const from = (page - 1) * per_page;
    const startTime = Date.now(); // Move outside try block
    
    try {
        
        // Search news using the elastic_sites model with fallback to general search
        const elastic_sites = require('../models/elastic_search/site');
        let newsResults = await elastic_sites.get_news({ q, page, per_page });
        
        // If no news-specific results, try general search as fallback
        if (!newsResults.success || !newsResults.data || newsResults.data.length === 0) {
            console.log('No news-specific results, trying general search...');
            newsResults = await elastic_sites.get({ q, page, per_page });
        }
        
        if (!newsResults.success || (!newsResults.results && !newsResults.data) || 
            (newsResults.results && newsResults.results.length === 0) ||
            (newsResults.data && newsResults.data.length === 0)) {
            throw new Error('No news results found');
        }
        
        // Handle both news-specific data format and general search format
        const dataArray = newsResults.data || newsResults.results || [];
        const results = dataArray.map((hit, index) => ({
            id: `news-${from + index + 1}`,
            title: hit.site_data_title,
            description: hit.site_data_description || hit.site_data_h1,
            content: hit.site_data_article || hit.site_data_content,
            url: hit.site_data_link,
            image: hit.site_data_image,
            publishedAt: hit.site_data_last_update || hit.site_data_date,
            source: hit.site_title || 'Unknown Source',
            author: hit.site_data_author,
            category: hit.site_category || category || 'General',
            readTime: `${Math.ceil((hit.site_data_word_count || 500) / 200)} min read`
        }));

        const time_taken = Date.now() - startTime;

        res.json({
            success: true,
            data: {
                results,
                total: newsResults.total || results.length,
                page,
                per_page,
                query: q,
                time_taken,
                pagination: newsResults.pagination
            }
        });
    } catch (error) {
        req.app.locals.logger.error('News search failed - using fallback', { error: error.message, query: q });
        
        // Return demo news data for development
        const time_taken = Date.now() - startTime;
        
        res.json({
            success: true,
            data: {
                results: [
                    {
                        id: 'demo-news-1',
                        title: `Breaking: ${q} in the News`,
                        description: `This is a demo news article for your search query "${q}". News search requires Elasticsearch integration with news sources.`,
                        content: `Full article content about ${q} would appear here. This is demo content for development purposes.`,
                        url: `https://example.com/news/${encodeURIComponent(q)}`,
                        image: 'https://via.placeholder.com/400x200?text=News+Demo',
                        publishedAt: new Date().toISOString(),
                        source: 'Demo News Source',
                        author: 'Demo Author',
                        category: category || 'General',
                        readTime: '3 min read'
                    }
                ],
                total: 1,
                page,
                per_page,
                query: q,
                time_taken,
                demo: true
            }
        });
    }
}));

// Web search endpoint (alias for general search)
router.get('/web', asyncHandler(async (req, res) => {
    // Redirect to main search endpoint
    req.url = '/search';
    return router.handle(req, res);
}));

module.exports = router; 