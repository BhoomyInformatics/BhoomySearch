const crypto = require('crypto');
const { logger } = require('./logger');

/**
 * Specialized Image Duplicate Checker
 * 
 * This utility provides efficient duplicate checking for image URLs to prevent
 * multiple indexing of the same images across different pages and crawling sessions.
 * 
 * Features:
 * - Fast in-memory cache for recently checked images
 * - Database-backed persistent storage
 * - URL normalization for better duplicate detection
 * - Batch checking capabilities
 * - Comprehensive statistics tracking
 */
class ImageDuplicateChecker {
    constructor(dbConnection, options = {}) {
        this.dbConnection = dbConnection;
        this.maxCacheSize = options.maxCacheSize || 10000;
        this.batchSize = options.batchSize || 100;
        this.enableUrlNormalization = options.enableUrlNormalization !== false;
        
        // In-memory caches for fast lookups
        this.imageUrlCache = new Map(); // url -> { siteId, imageId, checkedAt }
        this.imageHashCache = new Map(); // hash -> { url, siteId, imageId }
        
        // Statistics tracking
        this.stats = {
            totalChecked: 0,
            duplicatesFound: 0,
            cacheHits: 0,
            databaseHits: 0,
            urlNormalizations: 0,
            batchOperations: 0
        };
        
        logger.info('ImageDuplicateChecker initialized', {
            maxCacheSize: this.maxCacheSize,
            batchSize: this.batchSize,
            enableUrlNormalization: this.enableUrlNormalization,
            hasDbConnection: !!this.dbConnection
        });
    }

    /**
     * Normalize image URL for consistent duplicate checking
     */
    normalizeImageUrl(url) {
        if (!url || typeof url !== 'string') return null;
        
        try {
            // Remove query parameters that don't affect the image
            const urlObj = new URL(url);
            const cleanUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
            
            // Convert to lowercase for case-insensitive comparison
            const normalized = cleanUrl.toLowerCase();
            
            if (normalized !== url.toLowerCase()) {
                this.stats.urlNormalizations++;
                logger.debug('Image URL normalized', { original: url, normalized });
            }
            
            return normalized;
        } catch (error) {
            logger.warn('Failed to normalize image URL', { url, error: error.message });
            return url.toLowerCase();
        }
    }

    /**
     * Generate hash for image URL
     */
    generateImageUrlHash(url) {
        const normalizedUrl = this.enableUrlNormalization ? this.normalizeImageUrl(url) : url;
        return crypto.createHash('sha256').update(normalizedUrl || '').digest('hex');
    }

    /**
     * Check if image URL is already indexed
     */
    async isImageDuplicate(imageUrl, siteId) {
        try {
            this.stats.totalChecked++;
            
            if (!imageUrl || !siteId) {
                return { isDuplicate: false, reason: 'invalid_parameters' };
            }
            
            const normalizedUrl = this.enableUrlNormalization ? this.normalizeImageUrl(imageUrl) : imageUrl;
            const urlHash = this.generateImageUrlHash(normalizedUrl);
            
            // Debug logging for specific problematic URLs
            if (imageUrl.includes('i.iheart.com') || imageUrl.includes('ops=fit')) {
                logger.debug('Checking iHeart image URL', {
                    originalUrl: imageUrl,
                    normalizedUrl: normalizedUrl,
                    siteId
                });
            }
            
            // Check memory cache first
            const cacheKey = `${normalizedUrl}:${siteId}`;
            if (this.imageUrlCache.has(cacheKey)) {
                const cached = this.imageUrlCache.get(cacheKey);
                this.stats.cacheHits++;
                
                logger.debug('Image duplicate found in cache', { 
                    url: normalizedUrl, 
                    siteId,
                    imageId: cached.imageId 
                });
                
                return { 
                    isDuplicate: true, 
                    reason: 'memory_cache',
                    imageId: cached.imageId,
                    checkedAt: cached.checkedAt
                };
            }
            
            // Check database if connection is available
            if (this.dbConnection) {
                try {
                    // Check both original URL and normalized URL in database
                    const query = 'SELECT site_img_id FROM site_img WHERE (site_img_link = ? OR site_img_link = ?) AND site_img_site_id = ? LIMIT 1';
                    const raw = await this.dbConnection.query(query, [imageUrl, normalizedUrl, siteId]);
                    const rows = Array.isArray(raw) ? raw[0] : raw.rows || raw;
                    
                    if (rows && rows.length > 0) {
                        const imageId = rows[0].site_img_id;
                        
                        // Add to memory cache for faster future access
                        this.addToCache(normalizedUrl, siteId, imageId);
                        
                        this.stats.duplicatesFound++;
                        this.stats.databaseHits++;
                        
                        logger.debug('Image duplicate found in database', { 
                            originalUrl: imageUrl,
                            normalizedUrl: normalizedUrl, 
                            siteId,
                            imageId 
                        });
                        
                        return { 
                            isDuplicate: true, 
                            reason: 'database',
                            imageId,
                            checkedAt: new Date()
                        };
                    }
                } catch (dbError) {
                    logger.warn('Database image duplicate check failed', {
                        url: normalizedUrl,
                        siteId,
                        error: dbError.message
                    });
                    // Continue as non-duplicate if database check fails
                }
            }
            
            return { isDuplicate: false, reason: 'not_found' };
            
        } catch (error) {
            logger.error('Error checking image duplicate', { 
                imageUrl, 
                siteId, 
                error: error.message 
            });
            return { isDuplicate: false, reason: 'error' };
        }
    }

    /**
     * Batch check multiple image URLs for duplicates
     */
    async batchCheckImageDuplicates(imageUrls, siteId) {
        try {
            if (!imageUrls || imageUrls.length === 0) {
                return { results: [], stats: this.stats };
            }
            
            const results = [];
            const uniqueUrls = [];
            const duplicateUrls = [];
            
            // Pre-filter using memory cache
            for (const imageUrl of imageUrls) {
                const normalizedUrl = this.enableUrlNormalization ? this.normalizeImageUrl(imageUrl) : imageUrl;
                const cacheKey = `${normalizedUrl}:${siteId}`;
                
                if (this.imageUrlCache.has(cacheKey)) {
                    const cached = this.imageUrlCache.get(cacheKey);
                    results.push({
                        url: imageUrl,
                        normalizedUrl,
                        isDuplicate: true,
                        reason: 'memory_cache',
                        imageId: cached.imageId
                    });
                    duplicateUrls.push(imageUrl);
                } else {
                    uniqueUrls.push({ original: imageUrl, normalized: normalizedUrl });
                }
            }
            
            // Check remaining URLs in database
            if (uniqueUrls.length > 0 && this.dbConnection) {
                try {
                    // Create a list of all URLs to check (both original and normalized)
                    const allUrlsToCheck = [];
                    const urlMapping = new Map(); // normalized -> original
                    
                    for (const { original, normalized } of uniqueUrls) {
                        allUrlsToCheck.push(original);
                        allUrlsToCheck.push(normalized);
                        urlMapping.set(normalized, original);
                    }
                    
                    const placeholders = allUrlsToCheck.map(() => '?').join(',');
                    
                    const query = `
                        SELECT site_img_link, site_img_id 
                        FROM site_img 
                        WHERE site_img_link IN (${placeholders}) 
                        AND site_img_site_id = ?
                    `;
                    
                    const params = [...allUrlsToCheck, siteId];
                    const dbRaw = await this.dbConnection.query(query, params);
                    const dbResults = Array.isArray(dbRaw) ? dbRaw[0] : dbRaw.rows || dbRaw;
                    
                    // Create lookup map for fast checking
                    const existingUrls = new Map();
                    dbResults.forEach(row => {
                        existingUrls.set(row.site_img_link, row.site_img_id);
                    });
                    
                    // Process results
                    for (const { original, normalized } of uniqueUrls) {
                        // Check if either the original or normalized URL exists in database
                        const foundImageId = existingUrls.get(original) || existingUrls.get(normalized);
                        
                        if (foundImageId) {
                            // Add to cache using normalized URL as key
                            this.addToCache(normalized, siteId, foundImageId);
                            
                            results.push({
                                url: original,
                                normalizedUrl: normalized,
                                isDuplicate: true,
                                reason: 'database',
                                imageId: foundImageId
                            });
                            duplicateUrls.push(original);
                        } else {
                            results.push({
                                url: original,
                                normalizedUrl: normalized,
                                isDuplicate: false,
                                reason: 'not_found'
                            });
                        }
                    }
                    
                    this.stats.batchOperations++;
                    this.stats.databaseHits++;
                    
                } catch (dbError) {
                    logger.warn('Batch image duplicate check failed', {
                        siteId,
                        error: dbError.message
                    });
                    
                    // Mark all as non-duplicates if database check fails
                    for (const { original, normalized } of uniqueUrls) {
                        results.push({
                            url: original,
                            normalizedUrl: normalized,
                            isDuplicate: false,
                            reason: 'database_error'
                        });
                    }
                }
            }
            
            this.stats.duplicatesFound += duplicateUrls.length;
            
            logger.debug('Batch image duplicate check completed', {
                totalUrls: imageUrls.length,
                duplicates: duplicateUrls.length,
                unique: imageUrls.length - duplicateUrls.length,
                siteId
            });
            
            return { results, stats: this.stats };
            
        } catch (error) {
            logger.error('Error in batch image duplicate check', {
                siteId,
                error: error.message
            });
            return { results: [], stats: this.stats };
        }
    }

    /**
     * Mark image as indexed (add to cache)
     */
    markImageAsIndexed(imageUrl, siteId, imageId) {
        try {
            const normalizedUrl = this.enableUrlNormalization ? this.normalizeImageUrl(imageUrl) : imageUrl;
            this.addToCache(normalizedUrl, siteId, imageId);
            
            logger.debug('Image marked as indexed', {
                url: normalizedUrl,
                siteId,
                imageId
            });
            
            return true;
        } catch (error) {
            logger.error('Error marking image as indexed', {
                imageUrl,
                siteId,
                imageId,
                error: error.message
            });
            return false;
        }
    }

    /**
     * Add image to memory cache
     */
    addToCache(normalizedUrl, siteId, imageId) {
        try {
            const cacheKey = `${normalizedUrl}:${siteId}`;
            
            // Manage cache size
            if (this.imageUrlCache.size >= this.maxCacheSize) {
                // Remove oldest entries (simple FIFO)
                const firstKey = this.imageUrlCache.keys().next().value;
                this.imageUrlCache.delete(firstKey);
            }
            
            this.imageUrlCache.set(cacheKey, {
                siteId,
                imageId,
                checkedAt: new Date()
            });
            
        } catch (error) {
            logger.warn('Error adding image to cache', {
                normalizedUrl,
                siteId,
                imageId,
                error: error.message
            });
        }
    }

    /**
     * Get statistics
     */
    getStats() {
        return {
            ...this.stats,
            cacheSize: this.imageUrlCache.size,
            cacheHitRate: this.stats.totalChecked > 0 ? 
                (this.stats.cacheHits / this.stats.totalChecked * 100).toFixed(2) + '%' : '0%'
        };
    }

    /**
     * Clear memory cache
     */
    clearCache() {
        this.imageUrlCache.clear();
        this.imageHashCache.clear();
        logger.info('Image duplicate checker cache cleared');
    }

    /**
     * Preload common images into cache
     */
    async preloadCommonImages(siteId) {
        try {
            if (!this.dbConnection) return;
            
            const query = `
                SELECT site_img_link, site_img_id 
                FROM site_img 
                WHERE site_img_site_id = ? 
                ORDER BY site_img_created DESC 
                LIMIT ?
            `;
            
            const results = await this.dbConnection.query(query, [siteId, this.maxCacheSize / 2]);
            
            let preloadedCount = 0;
            for (const row of results) {
                const normalizedUrl = this.enableUrlNormalization ? 
                    this.normalizeImageUrl(row.site_img_link) : row.site_img_link;
                
                this.addToCache(normalizedUrl, siteId, row.site_img_id);
                preloadedCount++;
            }
            
            logger.info('Preloaded common images into cache', {
                siteId,
                preloadedCount,
                cacheSize: this.imageUrlCache.size
            });
            
        } catch (error) {
            logger.error('Error preloading common images', {
                siteId,
                error: error.message
            });
        }
    }
}

module.exports = { ImageDuplicateChecker }; 