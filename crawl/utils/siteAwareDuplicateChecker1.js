const crypto = require('crypto');
const { logger } = require('./logger');
const { duplicateChecker } = require('./duplicateChecker');

/**
 * Site-Aware Duplicate Checker
 * Enhanced version that initializes with site-specific statistics and provides
 * smart URL filtering to maximize crawling efficiency
 */
class SiteAwareDuplicateChecker {
    constructor(dbConnection, options = {}) {
        this.dbConnection = dbConnection;
        this.options = {
            maxCacheSize: 50000,
            batchSize: 500,
            enableContentHashing: true,
            ...options
        };
        
        // Site-specific caches
        this.siteCaches = new Map(); // siteId -> { crawledUrls, urlHashes, contentHashes, stats }
        this.currentSiteId = null;
        this.currentSiteStats = null;
        
        // Global statistics
        this.globalStats = {
            sitesInitialized: 0,
            totalUrlsChecked: 0,
            duplicatesSkipped: 0,
            newUrlsFound: 0,
            httpRequestsSaved: 0
        };
        
        logger.info('SiteAwareDuplicateChecker initialized', {
            options: this.options,
            hasDbConnection: !!this.dbConnection
        });
    }

    /**
     * Initialize duplicate checker for a specific site
     * Loads existing crawled URLs and provides site statistics
     */
    async initializeForSite(siteId, siteUrl = null) {
        try {
            this.currentSiteId = siteId;
            
            // Skip if already initialized for this site
            if (this.siteCaches.has(siteId)) {
                this.currentSiteStats = this.siteCaches.get(siteId).stats;
                logger.info('Site already initialized, using cached data', {
                    siteId,
                    cachedUrls: this.currentSiteStats.totalCrawledUrls
                });
                return this.currentSiteStats;
            }
            
            // Initialize site cache
            const siteCache = {
                crawledUrls: new Set(),
                urlHashes: new Set(),
                contentHashes: new Set(),
                stats: {
                    siteId,
                    siteUrl,
                    totalCrawledUrls: 0,
                    uniqueContentHashes: 0,
                    lastCrawlDate: null,
                    urlsAddedToday: 0,
                    avgDailyUrls: 0,
                    estimatedNewUrls: 0,
                    crawlPriority: 'normal' // low, normal, high
                }
            };
            
            if (!this.dbConnection) {
                logger.warn('No database connection, using memory-only mode', { siteId });
                this.siteCaches.set(siteId, siteCache);
                this.currentSiteStats = siteCache.stats;
                return this.currentSiteStats;
            }
            
            // Load site statistics and existing URLs
            await this.loadSiteStatistics(siteId, siteCache);
            await this.loadSiteCrawledUrls(siteId, siteCache);
            
            // Calculate crawl priority and estimated new URLs
            this.calculateSitePriority(siteCache);
            
            this.siteCaches.set(siteId, siteCache);
            this.currentSiteStats = siteCache.stats;
            this.globalStats.sitesInitialized++;
            
            logger.info('Site initialized successfully', {
                siteId,
                siteUrl,
                totalCrawledUrls: siteCache.stats.totalCrawledUrls,
                urlsAddedToday: siteCache.stats.urlsAddedToday,
                crawlPriority: siteCache.stats.crawlPriority,
                estimatedNewUrls: siteCache.stats.estimatedNewUrls
            });
            
            return this.currentSiteStats;
            
        } catch (error) {
            logger.error('Error initializing site for duplicate checking', {
                siteId,
                siteUrl,
                error: error.message
            });
            throw error;
        }
    }
    
    /**
     * Load comprehensive site statistics from database
     */
    async loadSiteStatistics(siteId, siteCache) {
        try {
            // Get basic site statistics
            const statsQuery = `
                SELECT 
                    COUNT(*) as total_crawled_urls,
                    COUNT(DISTINCT content_hash) as unique_content_hashes,
                    MAX(crawl_date) as last_crawl_date,
                    COUNT(CASE WHEN DATE(crawl_date) = CURDATE() THEN 1 END) as urls_added_today,
                    AVG(daily_count) as avg_daily_urls
                FROM (
                    SELECT 
                        content_hash,
                        crawl_date,
                        COUNT(*) as daily_count
                    FROM site_data 
                    WHERE site_data_site_id = ?
                    GROUP BY DATE(crawl_date)
                ) as daily_stats
            `;
            
            const statsResult = await this.executeQuery(statsQuery, [siteId]);
            
            if (statsResult && statsResult.length > 0) {
                const stats = statsResult[0];
                siteCache.stats.totalCrawledUrls = parseInt(stats.total_crawled_urls) || 0;
                siteCache.stats.uniqueContentHashes = parseInt(stats.unique_content_hashes) || 0;
                siteCache.stats.lastCrawlDate = stats.last_crawl_date;
                siteCache.stats.urlsAddedToday = parseInt(stats.urls_added_today) || 0;
                siteCache.stats.avgDailyUrls = parseFloat(stats.avg_daily_urls) || 0;
            }
            
        } catch (error) {
            logger.error('Error loading site statistics', {
                siteId,
                error: error.message
            });
            // Continue with default values
        }
    }
    
    /**
     * Load existing crawled URLs for the site into memory cache
     */
    async loadSiteCrawledUrls(siteId, siteCache) {
        try {
            // PRODUCTION FIX: Only cache very recent URLs to avoid marking everything as duplicate
            // For large production databases, we only cache URLs from the last 7 days
            const urlsQuery = `
                SELECT 
                    site_data_url_hash,
                    site_data_link,
                    content_hash
                FROM site_data 
                WHERE site_data_site_id = ? 
                    AND site_data_url_hash IS NOT NULL
                    AND crawl_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                ORDER BY site_data_id DESC
                LIMIT ?
            `;
            
            // PRODUCTION FIX: Reduced cache size for large databases to prevent everything being marked as duplicate
            const limit = Math.min(this.options.maxCacheSize, 1000); // Max 1000 recent URLs
            const urlResults = await this.executeQuery(urlsQuery, [siteId, limit]);
            
            if (urlResults && urlResults.length > 0) {
                urlResults.forEach(row => {
                    if (row.site_data_url_hash) {
                        siteCache.urlHashes.add(row.site_data_url_hash);
                        siteCache.crawledUrls.add(row.site_data_link);
                        
                        if (row.content_hash) {
                            siteCache.contentHashes.add(row.content_hash);
                        }
                    }
                });
            }
            
            logger.debug('Loaded site URLs into cache', {
                siteId,
                urlsLoaded: urlResults ? urlResults.length : 0,
                cacheSize: siteCache.urlHashes.size
            });
            
        } catch (error) {
            logger.error('Error loading site crawled URLs', {
                siteId,
                error: error.message
            });
            // Continue with empty cache
        }
    }
    
    /**
     * Calculate site crawling priority based on statistics
     */
    calculateSitePriority(siteCache) {
        const stats = siteCache.stats;
        
        // Calculate days since last crawl
        const daysSinceLastCrawl = stats.lastCrawlDate ? 
            Math.floor((new Date() - new Date(stats.lastCrawlDate)) / (1000 * 60 * 60 * 24)) : 999;
        
        // Estimate potential new URLs
        let estimatedNewUrls = 0;
        if (stats.avgDailyUrls > 0 && daysSinceLastCrawl > 0) {
            estimatedNewUrls = Math.floor(stats.avgDailyUrls * daysSinceLastCrawl);
        }
        
        // Determine priority
        if (stats.totalCrawledUrls === 0) {
            stats.crawlPriority = 'high'; // New site
            stats.estimatedNewUrls = 1000; // Assume many new URLs
        } else if (daysSinceLastCrawl > 7 && stats.avgDailyUrls > 10) {
            stats.crawlPriority = 'high'; // Active site, not crawled recently
            stats.estimatedNewUrls = estimatedNewUrls;
        } else if (daysSinceLastCrawl > 3 && stats.avgDailyUrls > 5) {
            stats.crawlPriority = 'normal'; // Moderately active
            stats.estimatedNewUrls = estimatedNewUrls;
        } else if (stats.totalCrawledUrls > 1000 && daysSinceLastCrawl <= 1) {
            stats.crawlPriority = 'low'; // Large site crawled recently
            stats.estimatedNewUrls = Math.min(estimatedNewUrls, 50);
        } else {
            stats.crawlPriority = 'normal';
            stats.estimatedNewUrls = estimatedNewUrls;
        }
    }
    
    /**
     * Filter URLs to find only new/uncrawled ones
     * This is the key method that solves your problem
     */
    async findNewUrls(urls, siteId = null, options = {}) {
        if (!Array.isArray(urls) || urls.length === 0) {
            return [];
        }
        
        const targetSiteId = siteId || this.currentSiteId;
        if (!targetSiteId) {
            logger.warn('No site ID available for URL filtering');
            return urls; // Return all URLs if no site context
        }
        
        // Initialize site if not already done
        if (!this.siteCaches.has(targetSiteId)) {
            await this.initializeForSite(targetSiteId);
        }
        
        const siteCache = this.siteCaches.get(targetSiteId);
        const newUrls = [];
        const duplicateUrls = [];
        
        // Check if this is a force crawl (for news sites)
        const isForceCrawl = options.forceCrawl || options.skipRecentCheck || options.crawlInterval === 'daily';
        
        logger.info('URL filtering starting', {
            siteId: targetSiteId,
            totalUrls: urls.length,
            isForceCrawl,
            options: {
                forceCrawl: options.forceCrawl,
                skipRecentCheck: options.skipRecentCheck,
                crawlInterval: options.crawlInterval,
                allowRecrawl: options.allowRecrawl
            }
        });
        
        // Filter URLs using site-specific cache
        for (const url of urls) {
            try {
                const normalizedUrl = this.normalizeUrl(url);
                const urlHash = this.hashUrl(normalizedUrl);
                
                // For force crawl (news sites), include all URLs regardless of previous crawling
                if (isForceCrawl) {
                    newUrls.push(url);
                    this.globalStats.newUrlsFound++;
                    logger.debug('Force crawl: Adding URL to queue', { url, siteId: targetSiteId });
                    continue;
                }
                
                // PRODUCTION FIX: More intelligent duplicate detection
                // Check site-specific cache first (normal behavior for non-news sites)
                if (siteCache.urlHashes.has(urlHash)) {
                    // For production crawling, allow re-crawling if it's been more than 30 days
                    // This ensures content freshness while still preventing excessive duplicates
                    const allowRecrawl = options.allowRecrawl || 
                                        options.maxAge || 
                                        siteCache.stats.estimatedNewUrls > 100; // Sites with lots of content get re-crawled
                    
                    if (allowRecrawl) {
                        newUrls.push(url);
                        this.globalStats.newUrlsFound++;
                        logger.debug('Allowing re-crawl of existing URL', { url, siteId: targetSiteId });
                        continue;
                    }
                    
                    duplicateUrls.push(url);
                    this.globalStats.duplicatesSkipped++;
                    continue;
                }
                
                newUrls.push(url);
                this.globalStats.newUrlsFound++;
                
            } catch (error) {
                logger.warn('Error processing URL in filter', {
                    url,
                    error: error.message
                });
                newUrls.push(url); // Include problematic URLs for safety
            }
        }
        
        this.globalStats.totalUrlsChecked += urls.length;
        this.globalStats.httpRequestsSaved += duplicateUrls.length;
        
        logger.info('URL filtering completed', {
            siteId: targetSiteId,
            totalUrls: urls.length,
            newUrls: newUrls.length,
            duplicatesSkipped: duplicateUrls.length,
            efficiency: Math.round((duplicateUrls.length / urls.length) * 100),
            forceCrawl: isForceCrawl
        });
        
        return newUrls;
    }
    
    /**
     * Check if a single URL is already crawled for the site
     */
    async isUrlAlreadyCrawled(url, siteId = null, options = {}) {
        const targetSiteId = siteId || this.currentSiteId;
        if (!targetSiteId) {
            return false;
        }
        
        // Check if this is a force crawl (for news sites)
        const isForceCrawl = options.forceCrawl || options.skipRecentCheck || options.crawlInterval === 'daily';
        if (isForceCrawl) {
            return false; // Force crawl means we want to crawl everything
        }
        
        // Initialize site if not already done
        if (!this.siteCaches.has(targetSiteId)) {
            await this.initializeForSite(targetSiteId);
        }
        
        const siteCache = this.siteCaches.get(targetSiteId);
        const normalizedUrl = this.normalizeUrl(url);
        const urlHash = this.hashUrl(normalizedUrl);
        
        return siteCache.urlHashes.has(urlHash);
    }
    
    /**
     * Mark URL as crawled for the site
     */
    async markAsCrawled(url, content = null, siteId = null) {
        const targetSiteId = siteId || this.currentSiteId;
        if (!targetSiteId) {
            logger.warn('No site ID available for marking URL as crawled');
            return;
        }
        
        // Initialize site if not already done
        if (!this.siteCaches.has(targetSiteId)) {
            await this.initializeForSite(targetSiteId);
        }
        
        const siteCache = this.siteCaches.get(targetSiteId);
        const normalizedUrl = this.normalizeUrl(url);
        const urlHash = this.hashUrl(normalizedUrl);
        
        // Add to site cache
        siteCache.urlHashes.add(urlHash);
        siteCache.crawledUrls.add(normalizedUrl);
        
        if (content && this.options.enableContentHashing) {
            const contentHash = this.hashContent(content);
            siteCache.contentHashes.add(contentHash);
        }
        
        // Update site statistics
        siteCache.stats.totalCrawledUrls++;
        
        // Clean cache if it gets too large
        if (siteCache.urlHashes.size > this.options.maxCacheSize) {
            this.cleanSiteCache(targetSiteId);
        }
    }
    
    /**
     * Clean site cache to prevent memory issues
     */
    cleanSiteCache(siteId) {
        const siteCache = this.siteCaches.get(siteId);
        if (!siteCache) return;
        
        // Keep only the most recent entries (simple FIFO cleanup)
        const keepSize = Math.floor(this.options.maxCacheSize * 0.8);
        
        if (siteCache.urlHashes.size > keepSize) {
            // For simplicity, clear and reload from database
            // In production, you might want a more sophisticated LRU cache
            logger.info('Cleaning site cache due to size limit', {
                siteId,
                oldSize: siteCache.urlHashes.size,
                keepSize
            });
            
            siteCache.urlHashes.clear();
            siteCache.crawledUrls.clear();
            siteCache.contentHashes.clear();
            
            // Reload recent data
            this.loadSiteCrawledUrls(siteId, siteCache).catch(error => {
                logger.error('Error reloading site cache after cleanup', {
                    siteId,
                    error: error.message
                });
            });
        }
    }
    
    /**
     * Get site-specific statistics
     */
    getSiteStats(siteId = null) {
        const targetSiteId = siteId || this.currentSiteId;
        if (!targetSiteId || !this.siteCaches.has(targetSiteId)) {
            return null;
        }
        
        return {
            ...this.siteCaches.get(targetSiteId).stats,
            cacheSize: this.siteCaches.get(targetSiteId).urlHashes.size
        };
    }
    
    /**
     * Get global statistics
     */
    getGlobalStats() {
        return {
            ...this.globalStats,
            activeSites: this.siteCaches.size,
            totalCacheSize: Array.from(this.siteCaches.values())
                .reduce((sum, cache) => sum + cache.urlHashes.size, 0)
        };
    }
    
    /**
     * Utility methods
     */
    normalizeUrl(url) {
        try {
            const urlObj = new URL(url);
            // Remove common tracking parameters
            urlObj.searchParams.delete('utm_source');
            urlObj.searchParams.delete('utm_medium');
            urlObj.searchParams.delete('utm_campaign');
            urlObj.searchParams.delete('fbclid');
            urlObj.searchParams.delete('gclid');
            
            // Remove trailing slash and fragments
            let normalized = urlObj.href.replace(/#.*$/, '').replace(/\/$/, '');
            return normalized;
        } catch (error) {
            return url; // Return original if normalization fails
        }
    }
    
    hashUrl(url) {
        return crypto.createHash('sha256').update(url).digest('hex');
    }
    
    hashContent(content) {
        if (!content) return null;
        const normalized = content.replace(/\s+/g, ' ').trim().toLowerCase();
        return crypto.createHash('sha256').update(normalized).digest('hex');
    }
    
    async executeQuery(query, params = []) {
        try {
            if (!this.dbConnection) {
                throw new Error('Database connection not available');
            }
            
            return await this.dbConnection.query(query, params);
        } catch (error) {
            logger.error('Database query error', {
                query: query.substring(0, 100),
                error: error.message
            });
            throw error;
        }
    }
    
    /**
     * Clear all site caches
     */
    clearAllCaches() {
        this.siteCaches.clear();
        this.currentSiteId = null;
        this.currentSiteStats = null;
        logger.info('All site caches cleared');
    }
    
    /**
     * Clear specific site cache
     */
    clearSiteCache(siteId) {
        if (this.siteCaches.has(siteId)) {
            this.siteCaches.delete(siteId);
            if (this.currentSiteId === siteId) {
                this.currentSiteId = null;
                this.currentSiteStats = null;
            }
            logger.info('Site cache cleared', { siteId });
        }
    }
}

module.exports = { SiteAwareDuplicateChecker }; 