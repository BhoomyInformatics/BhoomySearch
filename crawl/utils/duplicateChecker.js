const crypto = require('crypto');
const { logger } = require('./logger');

/**
 * Bloom Filter implementation for fast duplicate detection
 * Provides probabilistic data structure for efficient membership testing
 */
class BloomFilter {
    constructor(size = 1000000, hashCount = 3) {
        this.size = size;
        this.hashCount = hashCount;
        this.bitArray = new Array(size).fill(false);
        this.itemCount = 0;
        this.falsePositiveRate = 0;
    }
    
    /**
     * Add item to bloom filter
     */
    add(item) {
        for (let i = 0; i < this.hashCount; i++) {
            const hash = this.hash(item, i);
            this.bitArray[hash % this.size] = true;
        }
        this.itemCount++;
        this.updateFalsePositiveRate();
    }
    
    /**
     * Check if item might be in the filter
     * Returns true if item might be present (with possibility of false positive)
     * Returns false if item is definitely not present
     */
    mightContain(item) {
        for (let i = 0; i < this.hashCount; i++) {
            const hash = this.hash(item, i);
            if (!this.bitArray[hash % this.size]) {
                return false;
            }
        }
        return true;
    }
    
    /**
     * Hash function with different seeds for multiple hash functions
     */
    hash(item, seed) {
        const hash = crypto.createHash('sha256');
        hash.update(item + seed.toString());
        const hex = hash.digest('hex');
        
        // Convert hex to integer
        let result = 0;
        for (let i = 0; i < hex.length; i += 2) {
            result = (result * 256 + parseInt(hex.substr(i, 2), 16)) % this.size;
        }
        return Math.abs(result);
    }
    
    /**
     * Calculate current false positive rate
     */
    updateFalsePositiveRate() {
        if (this.itemCount === 0) {
            this.falsePositiveRate = 0;
            return;
        }
        
        // Formula: (1 - e^(-k*n/m))^k
        // where k = hashCount, n = itemCount, m = size
        const k = this.hashCount;
        const n = this.itemCount;
        const m = this.size;
        
        const exponent = -(k * n) / m;
        const base = 1 - Math.exp(exponent);
        this.falsePositiveRate = Math.pow(base, k);
    }
    
    /**
     * Get statistics about the bloom filter
     */
    getStats() {
        return {
            size: this.size,
            hashCount: this.hashCount,
            itemCount: this.itemCount,
            falsePositiveRate: this.falsePositiveRate,
            utilization: (this.itemCount / this.size) * 100,
            bitsSet: this.bitArray.filter(bit => bit).length
        };
    }
    
    /**
     * Clear the bloom filter
     */
    clear() {
        this.bitArray.fill(false);
        this.itemCount = 0;
        this.falsePositiveRate = 0;
    }
    
    /**
     * Merge another bloom filter into this one
     */
    merge(other) {
        if (other.size !== this.size || other.hashCount !== this.hashCount) {
            throw new Error('Cannot merge bloom filters with different sizes or hash counts');
        }
        
        for (let i = 0; i < this.size; i++) {
            this.bitArray[i] = this.bitArray[i] || other.bitArray[i];
        }
        
        this.itemCount += other.itemCount;
        this.updateFalsePositiveRate();
    }
}

/**
 * Unified Duplicate Checker with Bloom Filter, Site-Aware Features, and Enhanced Performance
 * Combines all three duplicate checker implementations into one comprehensive solution
 */
class DuplicateChecker {
    constructor(options = {}) {
        this.dbConnection = options.dbConnection || null;
        this.useDatabaseStorage = options.useDatabaseStorage !== false;
        this.useContentHashing = options.useContentHashing !== false;
        this.normalizeUrls = options.normalizeUrls !== false;
        this.tableName = options.tableName || 'crawled_urls';
        this.maxCacheSize = options.maxCacheSize || 10000;
        this.batchSize = options.batchSize || 500;
        this.batchTimeout = options.batchTimeout || 30000;
        
        // Enhanced caching with Bloom Filter
        this.bloomFilter = new BloomFilter(1000000, 3); // 1M items, 3 hash functions
        this.crawledUrls = new Set();
        this.urlHashes = new Set();
        this.contentHashes = new Set();
        this.pendingBatch = [];
        this.batchTimer = null;
        
        // Site-aware features
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
        
        // Performance tracking
        this.stats = {
            duplicatesFound: 0,
            urlDuplicates: 0,
            contentDuplicates: 0,
            cacheHits: 0,
            bloomFilterHits: 0,
            databaseHits: 0,
            totalChecked: 0,
            falsePositives: 0
        };
        
        logger.info('Unified DuplicateChecker initialized with Bloom Filter and Site-Aware features', {
            useDatabaseStorage: this.useDatabaseStorage,
            useContentHashing: this.useContentHashing,
            normalizeUrls: this.normalizeUrls,
            maxCacheSize: this.maxCacheSize,
            bloomFilterSize: this.bloomFilter.size,
            hasDbConnection: !!this.dbConnection
        });
        
        // Create database table if needed
        if (this.dbConnection && this.useDatabaseStorage) {
            this.createDatabaseTable().catch(error => {
                logger.error('Failed to create duplicate checker table', { error: error.message });
                this.useDatabaseStorage = false;
                logger.warn('Database storage disabled due to table creation failure');
            });
        } else {
            logger.warn('DuplicateChecker running in memory-only mode - links will not persist between sessions');
        }
    }

    setDatabaseConnection(dbConnection) {
        this.dbConnection = dbConnection;
        this.useDatabaseStorage = !!dbConnection;
        
        logger.info('Database connection set for DuplicateChecker', { 
            hasConnection: !!this.dbConnection,
            useDatabaseStorage: this.useDatabaseStorage 
        });
        
        if (this.dbConnection && this.useDatabaseStorage) {
            this.createDatabaseTable().catch(error => {
                logger.error('Failed to create duplicate checker table', { error: error.message });
                this.useDatabaseStorage = false;
                logger.warn('Database storage disabled due to table creation failure');
            });
        }
    }

    /**
     * Initialize duplicate checker for a specific site (Site-Aware feature)
     */
    async initializeForSite(siteId, siteUrl = null) {
        try {
            this.currentSiteId = siteId;
            
            if (this.siteCaches.has(siteId)) {
                this.currentSiteStats = this.siteCaches.get(siteId).stats;
                logger.info('Site already initialized, using cached data', {
                    siteId,
                    cachedUrls: this.currentSiteStats.totalCrawledUrls
                });
                return this.currentSiteStats;
            }
            
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
                    crawlPriority: 'normal'
                }
            };
            
            if (!this.dbConnection) {
                logger.warn('No database connection, using memory-only mode', { siteId });
                this.siteCaches.set(siteId, siteCache);
                this.currentSiteStats = siteCache.stats;
                return this.currentSiteStats;
            }
            
            await this.loadSiteStatistics(siteId, siteCache);
            await this.loadSiteCrawledUrls(siteId, siteCache);
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
     * Fast pre-crawl duplicate checking using Bloom Filter (Enhanced feature)
     */
    async isUrlAlreadyCrawled(url, siteId = null) {
        try {
            this.stats.totalChecked++;
            
            const normalizedUrl = this.normalizeUrls ? this.normalizeUrl(url) : url;
            const urlHash = this.hashUrl(normalizedUrl);
            
            // First check: Bloom Filter (fastest)
            const bloomKey = siteId ? `${urlHash}:${siteId}` : urlHash;
            if (!this.bloomFilter.mightContain(bloomKey)) {
                return false;
            }
            
            // Second check: Memory cache (fast)
            const memoryKey = siteId ? `${urlHash}:${siteId}` : urlHash;
            if (this.urlHashes.has(memoryKey)) {
                this.stats.duplicatesFound++;
                this.stats.urlDuplicates++;
                this.stats.cacheHits++;
                logger.debug('URL already crawled (memory cache)', { 
                    url: normalizedUrl, 
                    siteId 
                });
                return true;
            }

            // Third check: Database (slower but definitive)
            if (this.dbConnection && this.useDatabaseStorage) {
                try {
                    const exists = await this.checkUrlInDatabase(normalizedUrl, urlHash, siteId);
                    if (exists) {
                        this.addToCache(normalizedUrl, urlHash, null, siteId);
                        this.stats.duplicatesFound++;
                        this.stats.urlDuplicates++;
                        this.stats.databaseHits++;
                        logger.debug('URL already crawled (database)', { 
                            url: normalizedUrl, 
                            siteId 
                        });
                        return true;
                    } else {
                        this.stats.falsePositives++;
                        logger.debug('Bloom filter false positive detected', { 
                            url: normalizedUrl, 
                            siteId 
                        });
                    }
                } catch (dbError) {
                    logger.warn('Database duplicate check failed, treating as non-duplicate', { 
                        url: normalizedUrl, 
                        error: dbError.message 
                    });
                }
            }

            return false;
        } catch (error) {
            logger.error('Error in pre-crawl duplicate check', { 
                url, 
                siteId, 
                error: error.message 
            });
            return false;
        }
    }

    /**
     * Site-aware URL filtering (Site-Aware feature)
     */
    async findNewUrls(urls, siteId = null, options = {}) {
        if (!Array.isArray(urls) || urls.length === 0) {
            return [];
        }
        
        const targetSiteId = siteId || this.currentSiteId;
        if (!targetSiteId) {
            logger.warn('No site ID available for URL filtering');
            return urls;
        }
        
        if (!this.siteCaches.has(targetSiteId)) {
            await this.initializeForSite(targetSiteId);
        }
        
        const siteCache = this.siteCaches.get(targetSiteId);
        const newUrls = [];
        const duplicateUrls = [];
        
        const isForceCrawl = options.forceCrawl || options.skipRecentCheck || options.crawlInterval === 'daily';
        
        logger.info('URL filtering starting', {
            siteId: targetSiteId,
            totalUrls: urls.length,
            isForceCrawl
        });
        
        for (const url of urls) {
            try {
                const normalizedUrl = this.normalizeUrl(url);
                const urlHash = this.hashUrl(normalizedUrl);
                
                if (isForceCrawl) {
                    newUrls.push(url);
                    this.globalStats.newUrlsFound++;
                    continue;
                }
                
                if (siteCache.urlHashes.has(urlHash)) {
                    const allowRecrawl = options.allowRecrawl || 
                                        options.maxAge || 
                                        siteCache.stats.estimatedNewUrls > 100;
                    
                    if (allowRecrawl) {
                        newUrls.push(url);
                        this.globalStats.newUrlsFound++;
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
                newUrls.push(url);
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
     * Mark URL as crawled and add to Bloom Filter
     */
    async markAsCrawled(url, content = null, siteId = null) {
        try {
            const normalizedUrl = this.normalizeUrls ? this.normalizeUrl(url) : url;
            const urlHash = this.hashUrl(normalizedUrl);
            let contentHash = null;

            if (content && this.useContentHashing) {
                contentHash = this.hashContent(content);
            }

            // Add to Bloom Filter first (fastest)
            const bloomKey = siteId ? `${urlHash}:${siteId}` : urlHash;
            this.bloomFilter.add(bloomKey);
            
            // Add to in-memory cache
            this.addToCache(normalizedUrl, urlHash, contentHash, siteId);

            // Add to site cache if siteId provided
            if (siteId) {
                if (!this.siteCaches.has(siteId)) {
                    await this.initializeForSite(siteId);
                }
                const siteCache = this.siteCaches.get(siteId);
                siteCache.urlHashes.add(urlHash);
                siteCache.crawledUrls.add(normalizedUrl);
                siteCache.stats.totalCrawledUrls++;
                
                if (contentHash) {
                    siteCache.contentHashes.add(contentHash);
                }
            }
            
            logger.debug('URL marked as crawled (Bloom Filter + memory)', { 
                url: normalizedUrl, 
                siteId,
                bloomFilterStats: this.bloomFilter.getStats()
            });

            return true;
        } catch (error) {
            logger.error('Error marking URL as crawled', { url, siteId, error: error.message });
            return false;
        }
    }

    /**
     * Add to cache with size management
     */
    addToCache(url, urlHash, contentHash, siteId = null) {
        try {
            if (this.crawledUrls.size >= this.maxCacheSize) {
                this.clearOldestEntries();
            }

            this.crawledUrls.add(url);
            this.urlHashes.add(urlHash);
            
            if (siteId) {
                this.urlHashes.add(`${urlHash}:${siteId}`);
            }
            
            if (contentHash) {
                this.contentHashes.add(contentHash);
                if (siteId) {
                    this.contentHashes.add(`${contentHash}:${siteId}`);
                }
            }
        } catch (error) {
            logger.error('Error adding to cache', { url, siteId, error: error.message });
        }
    }

    /**
     * Clear oldest cache entries to manage memory
     */
    clearOldestEntries() {
        try {
            const entriesToRemove = Math.floor(this.maxCacheSize * 0.1);
            
            const urlArray = Array.from(this.crawledUrls);
            const hashArray = Array.from(this.urlHashes);
            const contentHashArray = Array.from(this.contentHashes);
            
            this.crawledUrls = new Set(urlArray.slice(entriesToRemove));
            this.urlHashes = new Set(hashArray.slice(entriesToRemove));
            this.contentHashes = new Set(contentHashArray.slice(entriesToRemove));
            
            logger.debug('Cleared oldest cache entries', { removed: entriesToRemove });
        } catch (error) {
            logger.error('Error clearing cache entries', { error: error.message });
        }
    }

    /**
     * Load site statistics from database
     * OPTIMIZED: Added timeout handling and graceful degradation
     */
    async loadSiteStatistics(siteId, siteCache) {
        try {
            // Use a simpler, faster query that's less likely to timeout
            const statsQuery = `
                SELECT 
                    COUNT(*) AS total_crawled_urls,
                       MAX(crawl_date) AS last_crawl_date
                FROM site_data
                WHERE site_data_site_id = ?
            `;

            // Short timeout with graceful fallback
            const timeoutMs = 5000; // 5 seconds
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Stats query timeout')), timeoutMs);
            });
            
            const queryPromise = this.dbConnection.query(statsQuery, [siteId]);
            
            let statsRows;
            try {
                statsRows = await Promise.race([queryPromise, timeoutPromise]);
                
                // Normalize driver return shape
                if (Array.isArray(statsRows) && Array.isArray(statsRows[0])) {
                    statsRows = statsRows[0];
                }
                
                if (Array.isArray(statsRows) && statsRows[0]) {
                    const stats = statsRows[0];
                    siteCache.stats.totalCrawledUrls = parseInt(stats.total_crawled_urls || 0) || 0;
                    siteCache.stats.lastCrawlDate = stats.last_crawl_date || null;
                    
                    logger.debug('Loaded site statistics', {
                        siteId,
                        totalCrawledUrls: siteCache.stats.totalCrawledUrls,
                        lastCrawlDate: siteCache.stats.lastCrawlDate
                    });
                }
            } catch (timeoutError) {
                if (timeoutError.message === 'Stats query timeout') {
                    logger.warn('Site statistics query timed out, using defaults', {
                        siteId,
                        timeoutMs,
                        message: 'This is OK - crawler will work with default statistics'
                    });
                    // Use default values
                    siteCache.stats.totalCrawledUrls = 0;
                    siteCache.stats.uniqueContentHashes = 0;
                    siteCache.stats.lastCrawlDate = null;
                    siteCache.stats.urlsAddedToday = 0;
                    siteCache.stats.avgDailyUrls = 0;
                    return;
                }
                throw timeoutError;
            }
            
            // Skip the expensive queries for today's count and averages
            // These are not critical for basic crawling functionality
            siteCache.stats.urlsAddedToday = 0;
            siteCache.stats.avgDailyUrls = 0;
            siteCache.stats.uniqueContentHashes = 0;
            
        } catch (error) {
            logger.warn('Error loading site statistics, using defaults', { 
                siteId, 
                error: error.message,
                message: 'Crawler will work with default statistics'
            });
            // Use default values on error
            siteCache.stats.totalCrawledUrls = 0;
            siteCache.stats.uniqueContentHashes = 0;
            siteCache.stats.lastCrawlDate = null;
            siteCache.stats.urlsAddedToday = 0;
            siteCache.stats.avgDailyUrls = 0;
        }
    }

    /**
     * Load site crawled URLs into cache
     * OPTIMIZED: Removed ORDER BY to prevent filesort, added timeout handling
     */
    async loadSiteCrawledUrls(siteId, siteCache) {
        try {
            // OPTIMIZED: Removed ORDER BY to prevent expensive filesort on large tables
            // Removed date filter initially to test if there are any URLs at all
            const urlsQuery = `
                SELECT 
                    site_data_url_hash, 
                    site_data_link, 
                    content_hash
                FROM site_data 
                WHERE site_data_site_id = ? 
                    AND site_data_url_hash IS NOT NULL
                LIMIT ?
            `;
            
            const limit = Math.min(this.maxCacheSize, 5000); // Increased from 1000 to 5000
            
            // Use shorter timeout with graceful degradation
            const timeoutMs = 8000; // 8 seconds
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Query timeout')), timeoutMs);
            });
            
            const queryPromise = this.dbConnection.query(urlsQuery, [siteId, limit]);
            
            let urlResults;
            try {
                urlResults = await Promise.race([queryPromise, timeoutPromise]);
                
                // Normalize driver return shape (some drivers return [rows, fields])
                if (Array.isArray(urlResults) && Array.isArray(urlResults[0])) {
                    urlResults = urlResults[0];
                }
            } catch (timeoutError) {
                if (timeoutError.message === 'Query timeout') {
                    logger.warn('Site URL loading timed out, continuing with empty cache', {
                        siteId,
                        timeoutMs,
                        message: 'This is OK - crawler will work without pre-cached URLs'
                    });
                    return; // Continue without cached URLs
                }
                throw timeoutError;
            }
            
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
            
                logger.info('Loaded site URLs into cache', {
                siteId,
                    urlsLoaded: urlResults.length,
                cacheSize: siteCache.urlHashes.size
            });
            } else {
                logger.info('No cached URLs loaded for site', {
                    siteId,
                    message: 'This is OK for new sites or when table is empty'
                });
            }
            } catch (error) {
            logger.warn('Error loading site crawled URLs, continuing without cache', { 
                siteId, 
                error: error.message,
                message: 'Crawler will work without pre-cached URLs'
            });
            // Don't throw - allow crawler to continue without cached URLs
        }
    }

    /**
     * Calculate site crawling priority
     */
    calculateSitePriority(siteCache) {
        const stats = siteCache.stats;
        
        const daysSinceLastCrawl = stats.lastCrawlDate ? 
            Math.floor((new Date() - new Date(stats.lastCrawlDate)) / (1000 * 60 * 60 * 24)) : 999;
        
        let estimatedNewUrls = 0;
        if (stats.avgDailyUrls > 0 && daysSinceLastCrawl > 0) {
            estimatedNewUrls = Math.floor(stats.avgDailyUrls * daysSinceLastCrawl);
        }
        
        if (stats.totalCrawledUrls === 0) {
            stats.crawlPriority = 'high';
            stats.estimatedNewUrls = 1000;
        } else if (daysSinceLastCrawl > 7 && stats.avgDailyUrls > 10) {
            stats.crawlPriority = 'high';
            stats.estimatedNewUrls = estimatedNewUrls;
        } else if (daysSinceLastCrawl > 3 && stats.avgDailyUrls > 5) {
            stats.crawlPriority = 'normal';
            stats.estimatedNewUrls = estimatedNewUrls;
        } else if (stats.totalCrawledUrls > 1000 && daysSinceLastCrawl <= 1) {
            stats.crawlPriority = 'low';
            stats.estimatedNewUrls = Math.min(estimatedNewUrls, 50);
        } else {
            stats.crawlPriority = 'normal';
            stats.estimatedNewUrls = estimatedNewUrls;
        }
    }

    /**
     * Check URL in database
     */
    async checkUrlInDatabase(url, urlHash, siteId = null) {
        try {
            if (!this.dbConnection || !this.useDatabaseStorage) {
                return false;
            }

            let query, params;
            
            if (siteId) {
                query = `
                    SELECT 1 FROM site_data 
                    WHERE site_data_url_hash = ? AND site_data_site_id = ?
                    LIMIT 1
                `;
                params = [urlHash, siteId];
            } else {
                query = `
                    SELECT 1 FROM site_data 
                    WHERE site_data_url_hash = ?
                    LIMIT 1
                `;
                params = [urlHash];
            }

            // Use short timeout and treat timeouts as "not duplicate" to keep crawl flowing
            let rows = await this.dbConnection.query(query, params, { timeout: 5000 });
            // Normalize driver return shape
            if (Array.isArray(rows) && Array.isArray(rows[0])) {
                rows = rows[0];
            }
            return Array.isArray(rows) && rows.length > 0;
        } catch (error) {
            // Gracefully degrade on timeout
            if (String(error.message || '').toLowerCase().includes('timeout')) {
                logger.warn('Duplicate check timed out, allowing URL to proceed', { 
                    url, urlHash, siteId, timeoutMs: 5000 
                });
                return false;
            }
            logger.error('Database error during duplicate check', { 
                url, 
                urlHash, 
                siteId, 
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Batch check for already-crawled URLs in the database
     * @param {string[]} urls - Array of URLs to check
     * @param {number|null} siteId - Optional site ID for site-specific check
     * @returns {Promise<Set<string>>} - Set of urlHashes that are already crawled
     */
    async batchCheckUrlsInDatabase(urls, siteId = null) {
        if (!this.dbConnection || !this.useDatabaseStorage || !Array.isArray(urls) || urls.length === 0) {
            logger.warn('Batch DB duplicate check failed, falling back to in-memory only', {
                service: 'crawler',
                error: 'No database connection or empty URL list'
            });
            return new Set();
        }
        // Normalize and hash all URLs
        const urlHashes = urls.map(url => {
            try {
                const normalizedUrl = this.normalizeUrls ? this.normalizeUrl(url) : url;
                return this.hashUrl(normalizedUrl);
            } catch (error) {
                logger.warn('Error hashing URL in batch check', { url, error: error.message });
                return null;
            }
        }).filter(hash => hash !== null); // Remove any failed hashes
        if (urlHashes.length === 0) {
            return new Set();
        }
        // Remove duplicates
        const uniqueHashes = Array.from(new Set(urlHashes));
        // Limit batch size to prevent query too long errors
        const maxBatchSize = 100;
        const batches = [];
        for (let i = 0; i < uniqueHashes.length; i += maxBatchSize) {
            batches.push(uniqueHashes.slice(i, i + maxBatchSize));
        }
        const allResults = new Set();
        for (const batch of batches) {
            let query, params;
            if (siteId) {
                query = `SELECT site_data_url_hash FROM site_data WHERE site_data_url_hash IN (${batch.map(() => '?').join(',')}) AND site_data_site_id = ?`;
                params = [...batch, siteId];
            } else {
                query = `SELECT site_data_url_hash FROM site_data WHERE site_data_url_hash IN (${batch.map(() => '?').join(',')})`;
                params = batch;
            }
            try {
                const [rows] = await this.dbConnection.query(query, params);
                if (Array.isArray(rows) && rows.length > 0) {
                    rows.forEach(row => allResults.add(row.site_data_url_hash));
                }
            } catch (error) {
                logger.error('Error in batchCheckUrlsInDatabase', { error: error.message });
                // Continue with other batches even if one fails
            }
        }
        return allResults;
    }

    /**     
     */
    async createDatabaseTable() {
        try {
            if (!this.dbConnection) {
                logger.debug('No database connection, skipping table creation');
                return;
            }
            
            logger.info('Using existing site_data table for duplicate checking');
            // Database indexes already exist, no need to create them
            logger.debug('Database indexes already exist, skipping index creation');
        } catch (error) {
            logger.error('Error in database table setup', { error: error.message });
        }
    }

    /**
     * Execute database query
     */
    async executeQuery(query, params = []) {
        try {
            if (!this.dbConnection) {
                logger.warn('Database connection not available, skipping query', { 
                    query: query.substring(0, 100) + '...' 
                });
                return [];
            }

            let timeoutMs;
            if (query.includes('INSERT') && query.includes('crawled_urls')) {
                timeoutMs = 5000;
            } else if (query.includes('crawled_urls')) {
                timeoutMs = 10000;
            } else {
                timeoutMs = 15000;
            }

            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                    logger.error('Database query timeout', { 
                        query: query.substring(0, 100) + '...',
                        timeout: timeoutMs 
                    });
                    reject(new Error('Database query timeout'));
                }, timeoutMs);
            });

            const queryPromise = this.dbConnection.query(query, params);
            const results = await Promise.race([queryPromise, timeoutPromise]);
            return results;
        } catch (error) {
            logger.error('Database query error', { 
                query: query.substring(0, 100) + '...',
                error: error.message,
                code: error.code,
                errno: error.errno
            });
            
            if (query.includes('SELECT') && query.includes('crawled_urls')) {
                logger.warn('crawled_urls table query failed, skipping duplicate check');
                return [];
            } else if (query.includes('INSERT') && query.includes('crawled_urls')) {
                logger.warn('crawled_urls table INSERT failed, continuing without storage');
                return [];
            } else {
                throw error;
            }
        }
    }

    /**
     * Utility methods
     */
    hashUrl(url) {
        try {
            return crypto.createHash('sha256').update(url).digest('hex');
        } catch (error) {
            logger.error('Error hashing URL', { url, error: error.message });
            return url;
        }
    }

    hashContent(content) {
        try {
            const normalizedContent = this.normalizeContent(content);
            return crypto.createHash('sha256').update(normalizedContent).digest('hex');
        } catch (error) {
            logger.error('Error hashing content', { error: error.message });
            return null;
        }
    }

    normalizeUrl(url) {
        try {
            const urlObj = new URL(url);
            
            urlObj.hash = '';
            
            const trackingParams = [
                'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
                'fbclid', 'gclid', 'msclkid', 'ref', 'source'
            ];
            
            const params = new URLSearchParams(urlObj.search);
            trackingParams.forEach(param => params.delete(param));
            urlObj.search = params.toString();
            
            urlObj.hostname = urlObj.hostname.toLowerCase();
            
            if (urlObj.pathname !== '/') {
                urlObj.pathname = urlObj.pathname.replace(/\/+$/, '');
            }
            
            return urlObj.toString();
        } catch (error) {
            logger.error('Error normalizing URL', { url, error: error.message });
            return url;
        }
    }

    normalizeContent(content) {
        try {
            return content
                .replace(/\s+/g, ' ')
                .replace(/[\r\n\t]/g, ' ')
                .trim()
                .toLowerCase();
        } catch (error) {
            logger.error('Error normalizing content', { error: error.message });
            return content;
        }
    }

    /**
     * Get comprehensive statistics
     */
    getStats() {
        const bloomStats = this.bloomFilter.getStats();
        return {
            ...this.stats,
            cacheSize: {
                urls: this.crawledUrls.size,
                urlHashes: this.urlHashes.size,
                contentHashes: this.contentHashes.size
            },
            bloomFilter: bloomStats,
            duplicateRate: this.stats.totalChecked > 0 
                ? (this.stats.duplicatesFound / this.stats.totalChecked * 100).toFixed(2) + '%'
                : '0%',
            falsePositiveRate: (this.stats.falsePositives / this.stats.totalChecked * 100).toFixed(2) + '%',
            globalStats: this.globalStats,
            activeSites: this.siteCaches.size
        };
    }

    /**
     * Get global statistics (alias for getStats for backward compatibility)
     */
    getGlobalStats() {
        return this.getStats();
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
     * Clear all caches
     */
    clearCache() {
        try {
            this.crawledUrls.clear();
            this.urlHashes.clear();
            this.contentHashes.clear();
            this.bloomFilter.clear();
            this.siteCaches.clear();
            this.currentSiteId = null;
            this.currentSiteStats = null;
            
            logger.info('All duplicate checker caches cleared');
        } catch (error) {
            logger.error('Error clearing cache', { error: error.message });
        }
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

    /**
     * Disable database storage
     */
    disableDatabaseStorage() {
        this.useDatabaseStorage = false;
        logger.warn('Database storage disabled for duplicate checker to reduce DB load');
    }

    /**
     * Enable database storage
     */
    enableDatabaseStorage() {
        this.useDatabaseStorage = true;
        logger.info('Database storage re-enabled for duplicate checker');
    }

    /**
     * Load existing URLs from database into memory cache
     */
    async loadFromDatabase(limit = 2000) {
        try {
            if (!this.dbConnection) {
                logger.debug('No database connection, skipping data load');
                return;
            }

            // Load existing URLs without expensive ORDER BY to avoid filesort
            const query = `
                SELECT site_data_url_hash, site_data_link, site_data_site_id
                FROM site_data 
                WHERE site_data_url_hash IS NOT NULL
                LIMIT ?
            `;
            
            let results = await this.dbConnection.query(query, [limit], { timeout: 8000 });
            // Normalize driver return shape
            if (Array.isArray(results) && Array.isArray(results[0])) {
                results = results[0];
            }
            
            // Add URLs to memory cache for fast lookups
            if (Array.isArray(results) && results.length > 0) {
                for (const row of results) {
                    this.urlHashes.add(row.site_data_url_hash);
                    this.crawledUrls.add(row.site_data_link);
                    if (row.site_data_site_id) {
                        this.urlHashes.add(`${row.site_data_url_hash}:${row.site_data_site_id}`);
                    }
                }
            }
            
            logger.info('Loaded duplicate data from database', { 
                loaded: Array.isArray(results) ? results.length : 0,
                limit,
                totalInMemory: this.urlHashes.size
            });

        } catch (error) {
            if (String(error.message || '').toLowerCase().includes('timeout')) {
                logger.warn('Timeout while loading duplicate data; continuing with partial/empty cache', { limit });
                return;
            }
            logger.error('Error loading duplicate data from database', { 
                error: error.message 
            });
            // Continue with empty cache if loading fails
        }
    }
}

// Create singleton instance
const duplicateChecker = new DuplicateChecker();

module.exports = { 
    BloomFilter, 
    DuplicateChecker, 
    duplicateChecker 
};