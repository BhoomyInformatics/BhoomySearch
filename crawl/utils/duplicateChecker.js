const crypto = require('crypto');
const { logger } = require('./logger');

class DuplicateChecker {
    constructor(options = {}) {
        this.dbConnection = options.dbConnection || null;
        this.useDatabaseStorage = options.useDatabaseStorage !== false; // Default to true
        this.useContentHashing = options.useContentHashing !== false;
        this.normalizeUrls = options.normalizeUrls !== false;
        this.tableName = options.tableName || 'crawled_urls';
        this.maxCacheSize = options.maxCacheSize || 10000;
        this.batchSize = options.batchSize || 500;
        this.batchTimeout = options.batchTimeout || 30000;
        
        // In-memory caches for fast lookups
        this.crawledUrls = new Set();
        this.urlHashes = new Set();
        this.contentHashes = new Set();
        this.pendingBatch = [];
        this.batchTimer = null;
        
        // Statistics
        this.stats = {
            duplicatesFound: 0,
            urlDuplicates: 0,
            contentDuplicates: 0,
            cacheHits: 0,
            databaseHits: 0,
            totalChecked: 0
        };
        
        // Log configuration on startup
        logger.info('DuplicateChecker initialized', {
            useDatabaseStorage: this.useDatabaseStorage,
            useContentHashing: this.useContentHashing,
            normalizeUrls: this.normalizeUrls,
            maxCacheSize: this.maxCacheSize,
            hasDbConnection: !!this.dbConnection
        });
        
        // Create database table if needed
        if (this.dbConnection && this.useDatabaseStorage) {
            this.createDatabaseTable().catch(error => {
                logger.error('Failed to create duplicate checker table', { error: error.message });
                // Disable database storage if table creation fails
                this.useDatabaseStorage = false;
                logger.warn('Database storage disabled due to table creation failure');
            });
        } else {
            logger.warn('DuplicateChecker running in memory-only mode - links will not persist between sessions');
        }
    }

    setDatabaseConnection(dbConnection) {
        this.dbConnection = dbConnection;
        this.useDatabaseStorage = !!dbConnection; // Enable database storage when connection is set
        
        logger.info('Database connection set for DuplicateChecker', { 
            hasConnection: !!this.dbConnection,
            useDatabaseStorage: this.useDatabaseStorage 
        });
        
        // Create database table if connection is available
        if (this.dbConnection && this.useDatabaseStorage) {
            this.createDatabaseTable().catch(error => {
                logger.error('Failed to create duplicate checker table', { error: error.message });
                // Disable database storage if table creation fails
                this.useDatabaseStorage = false;
                logger.warn('Database storage disabled due to table creation failure');
            });
        }
    }

    async isDuplicate(url, siteId, options = {}) {
        try {
            const urlHash = this.generateUrlHash(url);
            
            // Check memory cache first
            const cacheKey = `${siteId}:${urlHash}`;
            if (this.urlCache.has(cacheKey)) {
                return { isDuplicate: true, reason: 'memory_cache' };
            }

            // Check database if connection is available
            if (this.dbConnection && this.useDatabaseStorage) {
                try {
                    const result = await this.dbConnection.query(
                        'SELECT url_id, url_hash, crawled_at FROM site_data WHERE site_id = ? AND url_hash = ?',
                        [siteId, urlHash]
                    );

                    if (result && result.length > 0) {
                        // Store in memory cache for faster future access
                        this.urlCache.set(cacheKey, {
                            urlHash,
                            crawledAt: result[0].crawled_at,
                            urlId: result[0].url_id
                        });
                        
                        return { 
                            isDuplicate: true, 
                            reason: 'database',
                            urlId: result[0].url_id,
                            crawledAt: result[0].crawled_at
                        };
                    }
                } catch (dbError) {
                    logger.warn('Database duplicate check failed, falling back to memory-only mode', {
                        error: dbError.message,
                        url,
                        siteId
                    });
                    // Continue with memory-only mode
                }
            }

            // If not found in database, check if URL should be crawled based on patterns
            const shouldCrawl = this.shouldCrawlUrl(url, options);
            if (!shouldCrawl) {
                return { isDuplicate: true, reason: 'url_pattern' };
            }

            return { isDuplicate: false, reason: 'new_url' };
        } catch (error) {
            logger.error('Error checking duplicate URL', {
                error: error.message,
                url,
                siteId
            });
            // Default to not duplicate on error to allow crawling
            return { isDuplicate: false, reason: 'error_fallback' };
        }
    }

    shouldCrawlUrl(url, options = {}) {
        try {
            const urlObj = new URL(url);
            
            // Skip certain file types
            const skipExtensions = [
                '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
                '.zip', '.rar', '.tar', '.gz', '.mp3', '.mp4', '.avi', '.mov',
                '.wmv', '.flv', '.webm', '.ogg', '.wav', '.jpg', '.jpeg',
                '.png', '.gif', '.bmp', '.svg', '.ico', '.css', '.js',
                '.xml', '.json', '.txt', '.log', '.csv'
            ];
            
            const pathname = urlObj.pathname.toLowerCase();
            // Check if URL ends with any of the skip extensions (with or without query parameters)
            if (skipExtensions.some(ext => pathname.endsWith(ext) || url.toLowerCase().includes(ext + '?'))) {
                return false;
            }

            // Skip certain protocols
            if (['mailto:', 'tel:', 'javascript:', 'data:', 'ftp:', 'file:'].some(protocol => 
                url.toLowerCase().startsWith(protocol))) {
                return false;
            }

            // Skip very long URLs
            if (url.length > 2048) {
                return false;
            }

            // Skip URLs with certain patterns
            const skipPatterns = [
                /\/wp-admin\//,
                /\/wp-includes\//,
                /\/wp-content\/uploads\//,
                /\/admin\//,
                /\/login\//,
                /\/logout\//,
                /\/register\//,
                /\/signup\//,
                /\/signin\//,
                /\/cart\//,
                /\/checkout\//,
                /\/payment\//,
                /\/api\//,
                /\/ajax\//,
                /\/search\?/,
                /\/tag\//,
                /\/category\//,
                /\/author\//,
                /\/page\//,
                /\/comment\//,
                /\/trackback\//,
                /\/pingback\//,
                /\/feed\//,
                /\/rss\//,
                /\/atom\//,
                /\/sitemap\//,
                /\.xml$/,
                /\.json$/,
                /\.txt$/,
                /\.log$/,
                /\.csv$/
            ];

            if (skipPatterns.some(pattern => pattern.test(url))) {
                return false;
            }

            // Allow URLs with content-related patterns
            const contentPatterns = [
                /\/article\//,
                /\/news\//,
                /\/blog\//,
                /\/post\//,
                /\/story\//,
                /\/content\//,
                /\/page\//,
                /\/about\//,
                /\/contact\//,
                /\/services\//,
                /\/products\//,
                /\/gallery\//,
                /\/photos\//,
                /\/videos\//,
                /\/events\//,
                /\/careers\//,
                /\/team\//,
                /\/faq\//,
                /\/help\//,
                /\/support\//,
                /\/privacy\//,
                /\/terms\//,
                /\/policy\//,
                /\/sitemap\//,
                /\/robots\//
            ];

            // If URL matches content patterns, allow crawling
            if (contentPatterns.some(pattern => pattern.test(url))) {
                return true;
            }

            // For other URLs, check if they have meaningful content indicators
            const hasContentIndicators = (
                url.includes('/') && 
                !url.includes('?') && 
                !url.includes('#') &&
                url.length > 10
            );

            return hasContentIndicators;
        } catch (error) {
            logger.error('Error in shouldCrawlUrl', {
                error: error.message,
                url
            });
            // Default to allowing crawl on error
            return true;
        }
    }

    /**
     * Fast pre-crawl duplicate checking for URLs
     * This method is optimized for checking URLs before making HTTP requests
     */
    async isUrlAlreadyCrawled(url, siteId = null) {
        try {
            this.stats.totalChecked++;
            
            // Normalize URL if enabled
            const normalizedUrl = this.normalizeUrls ? this.normalizeUrl(url) : url;
            const urlHash = this.hashUrl(normalizedUrl);
            
            // Fast in-memory check first
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

            // Database check if memory cache miss
            if (this.dbConnection && this.useDatabaseStorage) {
                try {
                    const exists = await this.checkUrlInDatabase(normalizedUrl, urlHash, siteId);
                    if (exists) {
                        // Add to memory cache for faster future lookups
                        this.addToCache(normalizedUrl, urlHash, null, siteId);
                        this.stats.duplicatesFound++;
                        this.stats.urlDuplicates++;
                        this.stats.databaseHits++;
                        logger.debug('URL already crawled (database)', { 
                            url: normalizedUrl, 
                            siteId 
                        });
                        return true;
                    }
                } catch (dbError) {
                    logger.warn('Database duplicate check failed, treating as non-duplicate', { 
                        url: normalizedUrl, 
                        error: dbError.message 
                    });
                    // Treat as non-duplicate if database check fails
                }
            }

            return false;
        } catch (error) {
            logger.error('Error in pre-crawl duplicate check', { 
                url, 
                siteId, 
                error: error.message 
            });
            return false; // Default to not duplicate on error
        }
    }

    async isContentDuplicate(content, siteId = null) {
        try {
            if (!content || typeof content !== 'string') {
                return false;
            }

            const contentHash = this.hashContent(content);
            
            // Check in-memory cache only (database disabled temporarily)
            if (this.contentHashes.has(contentHash)) {
                // If siteId is provided, check if it's a duplicate within the same site
                if (siteId) {
                    const cacheKey = `${contentHash}:${siteId}`;
                    if (this.contentHashes.has(cacheKey)) {
                        return true;
                    }
                } else {
                    return true;
                }
            }

            // Database checking temporarily disabled to prevent timeouts
            if (false && this.dbConnection && this.useDatabaseStorage) {
                const exists = await this.checkContentInDatabase(contentHash, siteId);
                if (exists) {
                    // Add to cache for faster future lookups
                    this.contentHashes.add(contentHash);
                    if (siteId) {
                        this.contentHashes.add(`${contentHash}:${siteId}`);
                    }
                    return true;
                }
            }

            return false;
        } catch (error) {
            logger.error('Error checking content duplicate', { siteId, error: error.message });
            return false;
        }
    }

    async markAsCrawled(url, content = null, siteId = null) {
        try {
            const normalizedUrl = this.normalizeUrls ? this.normalizeUrl(url) : url;
            const urlHash = this.hashUrl(normalizedUrl);
            let contentHash = null;

            if (content && this.useContentHashing) {
                contentHash = this.hashContent(content);
            }

            // Add to in-memory cache for performance
            this.addToCache(normalizedUrl, urlHash, contentHash, siteId);

            // Database storage disabled for DuplicateChecker to prevent placeholder titles
            // The ContentIndexer will handle database storage with proper titles
            logger.debug('URL marked as crawled (memory-only)', { 
                url: normalizedUrl, 
                siteId,
                reason: 'Database storage disabled to prevent placeholder titles'
            });
            
            /* DISABLED: Database storage moved to ContentIndexer only
            if (this.dbConnection && this.useDatabaseStorage) {
                try {
                    await this.storeInDatabase(normalizedUrl, urlHash, contentHash, siteId);
                    logger.debug('URL stored in database', { url: normalizedUrl, siteId });
                } catch (dbError) {
                    logger.warn('Failed to store URL in database, continuing with memory-only', { 
                        url: normalizedUrl, 
                        error: dbError.message 
                    });
                }
            }
            */

            return true;
        } catch (error) {
            logger.error('Error marking URL as crawled', { url, siteId, error: error.message });
            return false;
        }
    }

    addToCache(url, urlHash, contentHash, siteId = null) {
        try {
            // Manage cache size
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

    clearOldestEntries() {
        try {
            const entriesToRemove = Math.floor(this.maxCacheSize * 0.1); // Remove 10%
            
            // Convert sets to arrays, remove oldest entries, convert back
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

    async checkUrlInDatabase(url, urlHash, siteId = null) {
        try {
            if (!this.dbConnection || !this.useDatabaseStorage) {
                logger.debug('Database not available or disabled, skipping URL duplicate check', { url });
                return false; // Assume not duplicate if DB unavailable or disabled
            }

            // Check in both crawled_urls table and site_data table
            let query, params;
            
            if (siteId) {
                // Check within specific site
                query = `
                    SELECT 1 FROM site_data 
                    WHERE site_data_url_hash = ? AND site_data_site_id = ?
                    LIMIT 1
                `;
                params = [urlHash, siteId];
            } else {
                // Check across all sites
                query = `
                    SELECT 1 FROM site_data 
                    WHERE site_data_url_hash = ?
                    LIMIT 1
                `;
                params = [urlHash];
            }

            const [rows] = await this.dbConnection.query(query, params);
            const exists = rows && rows.length > 0;
            
            logger.debug('Database duplicate check completed', { 
                url, 
                urlHash, 
                siteId, 
                exists 
            });
            
            return exists;
        } catch (error) {
            logger.error('Database error during duplicate check', { 
                url, 
                urlHash, 
                siteId, 
                error: error.message 
            });
            throw error; // Re-throw to be handled by caller
        }
    }

    async checkContentInDatabase(contentHash, siteId = null) {
        try {
            if (!this.dbConnection) {
                logger.debug('Database not available, skipping content duplicate check');
                return false; // Assume not duplicate if DB unavailable
            }

            const query = `
                SELECT 1 FROM ${this.tableName} 
                WHERE content_hash = ? 
                LIMIT 1
            `;
            
            const result = await this.executeQuery(query, [contentHash]);
            return result.length > 0;
        } catch (error) {
            logger.warn('Error checking content in database, assuming not duplicate', { 
                error: error.message 
            });
            return false; // Assume not duplicate on error
        }
    }

    async storeInDatabase(url, urlHash, contentHash, siteId = null) {
        try {
            // DISABLED: DuplicateChecker should not insert into site_data table
            // The site_data table should only be populated by ContentIndexer with real titles
            // This prevents "Pre-crawl duplicate check" placeholder titles from being inserted
            
            logger.debug('Database storage disabled for DuplicateChecker to prevent placeholder titles', { 
                url, 
                reason: 'site_data table should only contain real content with proper titles'
            });
            
            return; // Skip database storage entirely
            
            /* ORIGINAL CODE DISABLED TO PREVENT PLACEHOLDER TITLES:
            if (!this.dbConnection || !this.useDatabaseStorage) {
                logger.debug('Database not available or disabled, skipping URL storage', { url });
                return; // Skip storage if DB unavailable or disabled
            }

            // Use INSERT IGNORE for better performance and duplicate handling
            const insertQuery = `
                INSERT IGNORE INTO site_data (
                    site_data_url_hash, 
                    site_data_site_id, 
                    site_data_link, 
                    site_data_title,
                    status,
                    crawl_date
                ) VALUES (?, ?, ?, ?, 'duplicate_check', NOW())
            `;

            const values = [
                urlHash,
                siteId,
                url,
                'Pre-crawl duplicate check', // Placeholder title - THIS WAS THE PROBLEM
            ];

            logger.debug('Storing URL in database for duplicate tracking', { 
                url, 
                urlHash: urlHash.substring(0, 8) + '...',
                siteId 
            });

            const result = await this.dbConnection.query(insertQuery, values);
            
            if (result.affectedRows > 0) {
                logger.debug('URL stored in database successfully', { 
                    url, 
                    insertId: result.insertId 
                });
            } else {
                logger.debug('URL already exists in database (INSERT IGNORE)', { url });
            }
            */

        } catch (error) {
            logger.error('Error in storeInDatabase (disabled)', { 
                url, 
                error: error.message 
            });
            // Don't throw error - continue with memory-only if DB fails
        }
    }

    resetBatchTimer() {
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
        }
        
        this.batchTimer = setTimeout(async () => {
            try {
                await this.processBatch();
            } catch (error) {
                logger.warn('Error in batch timer processing', { error: error.message });
            }
        }, this.batchTimeout);
    }

    async processBatch() {
        try {
            // Database batch processing completely disabled for performance
            logger.debug('Database batch processing disabled, using memory-only duplicate checking');
            
            // Clear pending inserts without processing
            this.pendingBatch = [];
            this.clearBatchTimer();
            
            return; // Skip all database batch operations
            
            // Original batch processing code disabled:
            /*
            if (!this.dbConnection || this.pendingInserts.length === 0) {
                return;
            }

            this.clearBatchTimer();
            
            const batch = [...this.pendingInserts];
            this.pendingInserts = [];

            // Create table if not exists
            await this.createDatabaseTable();

            // Prepare batch insert
            const values = batch.map(item => [
                item.url,
                item.urlHash,
                item.contentHash || '',
                item.siteId || null,
                item.timestamp
            ]);

            if (values.length === 0) {
                return;
            }

            const placeholders = values.map(() => '(?, ?, ?, ?, ?)').join(', ');
            const query = `
                INSERT IGNORE INTO ${this.tableName} 
                (url, url_hash, content_hash, site_id, crawled_at) 
                VALUES ${placeholders}
            `;

            const flatValues = values.flat();
            
            const result = await this.executeQuery(query, flatValues);
            
            this.stats.batchedInserts += batch.length;
            
            logger.debug('Batch processed successfully', { 
                batchSize: batch.length,
                totalBatched: this.stats.batchedInserts
            });
            */
        } catch (error) {
            logger.error('Error in batch processing (disabled)', { error: error.message });
            // Clear pending to prevent accumulation
            this.pendingBatch = [];
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
                const rows = await this.dbConnection.query(query, params);
                // Handle MySQL2 result structure - rows is directly the array
                if (Array.isArray(rows) && rows.length > 0) {
                    rows.forEach(row => allResults.add(row.site_data_url_hash));
                } else if (Array.isArray(rows) && rows.length === 0) {
                    // Empty result set - no action needed
                } else {
                    // No results or unexpected structure - no action needed
                }
            } catch (error) {
                logger.error('Error in batchCheckUrlsInDatabase', { error: error.message });
                // Continue with other batches even if one fails
            }
        }
        
        return allResults;
    }

    async createDatabaseTable() {
        try {
            if (!this.dbConnection) {
                logger.debug('No database connection, skipping table creation');
                return;
            }

            // We'll use the existing site_data table structure for duplicate checking
            // No need to create a separate table since site_data already has the required fields:
            // - site_data_url_hash (VARCHAR(64))
            // - site_data_site_id (INT)
            // - site_data_link (VARCHAR(2048))
            // - status (for tracking duplicate check vs indexed)
            
            logger.info('Using existing site_data table for duplicate checking');
            
            // Ensure indexes exist for optimal performance
            const indexQueries = [
                `CREATE INDEX IF NOT EXISTS idx_url_hash_site ON site_data (site_data_url_hash, site_data_site_id)`,
                `CREATE INDEX IF NOT EXISTS idx_url_hash ON site_data (site_data_url_hash)`,
                `CREATE INDEX IF NOT EXISTS idx_status ON site_data (status)`
            ];

            for (const query of indexQueries) {
                try {
                    await this.dbConnection.query(query);
                    logger.debug('Database index created/verified');
                } catch (indexError) {
                    logger.warn('Index creation failed (may already exist)', { 
                        error: indexError.message 
                    });
                }
            }

        } catch (error) {
            logger.error('Error in database table setup', { error: error.message });
        }
    }

    hashUrl(url) {
        try {
            return crypto.createHash('sha256').update(url).digest('hex');
        } catch (error) {
            logger.error('Error hashing URL', { url, error: error.message });
            return url; // Fallback to original URL
        }
    }

    hashContent(content) {
        try {
            // Normalize content before hashing
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
            
            // Remove fragment
            urlObj.hash = '';
            
            // Remove common tracking parameters
            const trackingParams = [
                'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
                'fbclid', 'gclid', 'msclkid', 'ref', 'source'
            ];
            
            const params = new URLSearchParams(urlObj.search);
            trackingParams.forEach(param => params.delete(param));
            urlObj.search = params.toString();
            
            // Normalize hostname
            urlObj.hostname = urlObj.hostname.toLowerCase();
            
            // Remove trailing slash except for root
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
                .replace(/\s+/g, ' ')           // Normalize whitespace
                .replace(/[\r\n\t]/g, ' ')      // Replace line breaks and tabs
                .trim()                         // Remove leading/trailing whitespace
                .toLowerCase();                 // Convert to lowercase for comparison
        } catch (error) {
            logger.error('Error normalizing content', { error: error.message });
            return content;
        }
    }

    async executeQuery(query, params = []) {
        try {
            if (!this.dbConnection) {
                logger.warn('Database connection not available, skipping query', { 
                    query: query.substring(0, 100) + '...' 
                });
                return []; // Return empty result instead of rejecting
            }

            // Use shorter timeouts to prevent blocking
            let timeoutMs;
            if (query.includes('INSERT') && query.includes('crawled_urls')) {
                timeoutMs = 5000; // 5 seconds for INSERT operations (reduced from 30s)
            } else if (query.includes('crawled_urls')) {
                timeoutMs = 10000; // 10 seconds for other crawled_urls operations (reduced from 120s)
            } else {
                timeoutMs = 15000; // 15 seconds for other operations (reduced from 60s)
            }

            // Create a timeout promise
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                    logger.error('Database query timeout', { 
                        query: query.substring(0, 100) + '...',
                        timeout: timeoutMs 
                    });
                    reject(new Error('Database query timeout'));
                }, timeoutMs);
            });

            // Create the query promise
            const queryPromise = this.dbConnection.query(query, params);

            // Race between query and timeout
            const results = await Promise.race([queryPromise, timeoutPromise]);
            return results;

        } catch (error) {
            logger.error('Database query error', { 
                query: query.substring(0, 100) + '...',
                error: error.message,
                code: error.code,
                errno: error.errno
            });
            
            // For duplicate checking, return empty result instead of failing
            if (query.includes('SELECT') && query.includes('crawled_urls')) {
                logger.warn('crawled_urls table query failed, skipping duplicate check');
                return [];
            } else if (query.includes('INSERT') && query.includes('crawled_urls')) {
                logger.warn('crawled_urls table INSERT failed, continuing without storage');
                return []; // Don't throw for INSERT failures
            } else {
                throw error;
            }
        }
    }

    getStats() {
        return {
            ...this.stats,
            cacheSize: {
                urls: this.crawledUrls.size,
                urlHashes: this.urlHashes.size,
                contentHashes: this.contentHashes.size
            },
            duplicateRate: this.stats.totalChecked > 0 
                ? (this.stats.duplicatesFound / this.stats.totalChecked * 100).toFixed(2) + '%'
                : '0%'
        };
    }

    clearCache() {
        try {
            this.crawledUrls.clear();
            this.urlHashes.clear();
            this.contentHashes.clear();
            
            logger.info('Duplicate checker cache cleared');
        } catch (error) {
            logger.error('Error clearing cache', { error: error.message });
        }
    }

    async flushPendingBatches() {
        try {
            if (this.pendingBatch.length > 0) {
                logger.info('Flushing pending batches on shutdown', { 
                    pendingCount: this.pendingBatch.length 
                });
                await this.processBatch();
            }
        } catch (error) {
            logger.error('Error flushing pending batches', { error: error.message });
        }
    }

    // Temporarily disable database storage to reduce load
    disableDatabaseStorage() {
        this.useDatabaseStorage = false;
        logger.warn('Database storage disabled for duplicate checker to reduce DB load');
    }

    // Re-enable database storage
    enableDatabaseStorage() {
        this.useDatabaseStorage = true;
        logger.info('Database storage re-enabled for duplicate checker');
    }

    async clearDatabase() {
        try {
            if (!this.dbConnection) {
                throw new Error('Database connection not available');
            }

            const query = `DELETE FROM ${this.tableName}`;
            await this.executeQuery(query);
            
            logger.info('Duplicate checker database cleared');
        } catch (error) {
            logger.error('Error clearing database', { error: error.message });
            throw error;
        }
    }

    async loadFromDatabase(limit = 10000) {
        try {
            if (!this.dbConnection) {
                logger.debug('No database connection, skipping data load');
                return;
            }

            // Load existing URLs from site_data table
            const query = `
                SELECT site_data_url_hash, site_data_link, site_data_site_id
                FROM site_data 
                WHERE site_data_url_hash IS NOT NULL
                ORDER BY site_data_id DESC 
                LIMIT ?
            `;
            
            const results = await this.dbConnection.query(query, [limit]);
            
            // Add URLs to memory cache for fast lookups
            if (results && results.length > 0) {
                results.forEach(row => {
                    this.urlHashes.add(row.site_data_url_hash);
                    this.crawledUrls.add(row.site_data_link);
                    
                    // Also add site-specific hash for better isolation
                    if (row.site_data_site_id) {
                        this.urlHashes.add(`${row.site_data_url_hash}:${row.site_data_site_id}`);
                    }
                });
            }
            
            logger.info('Loaded duplicate data from database', { 
                loaded: results ? results.length : 0,
                limit,
                totalInMemory: this.urlHashes.size
            });

        } catch (error) {
            logger.error('Error loading duplicate data from database', { 
                error: error.message 
            });
            // Continue with empty cache if loading fails
        }
    }

    // Method to check similarity between content (for near-duplicate detection)
    calculateContentSimilarity(content1, content2) {
        try {
            if (!content1 || !content2) return 0;
            
            const normalized1 = this.normalizeContent(content1);
            const normalized2 = this.normalizeContent(content2);
            
            // Simple Jaccard similarity using word sets
            const words1 = new Set(normalized1.split(' ').filter(w => w.length > 2));
            const words2 = new Set(normalized2.split(' ').filter(w => w.length > 2));
            
            const intersection = new Set([...words1].filter(w => words2.has(w)));
            const union = new Set([...words1, ...words2]);
            
            return union.size > 0 ? intersection.size / union.size : 0;
        } catch (error) {
            logger.error('Error calculating content similarity', { error: error.message });
            return 0;
        }
    }

    /**
     * Find URLs that are NOT in the database (for discovering new content)
     * @param {string[]} urls - Array of URLs to check
     * @param {number|null} siteId - Optional site ID for site-specific check
     * @returns {Promise<string[]>} - Array of URLs that are NOT in the database
     */
    async findNewUrls(urls, siteId = null) {
        if (!this.dbConnection || !this.useDatabaseStorage || !Array.isArray(urls) || urls.length === 0) {
            return urls; // Return all URLs if no DB check possible
        }
        
        try {
            // Normalize and hash all URLs
            const urlHashes = urls.map(url => {
                try {
                    const normalizedUrl = this.normalizeUrls ? this.normalizeUrl(url) : url;
                    return this.hashUrl(normalizedUrl);
                } catch (error) {
                    logger.warn('Error hashing URL in findNewUrls', { url, error: error.message });
                    return null;
                }
            }).filter(hash => hash !== null);
            
            if (urlHashes.length === 0) {
                return [];
            }
            
            // Remove duplicates
            const uniqueHashes = Array.from(new Set(urlHashes));
            
            // Create URL to hash mapping for reverse lookup
            const urlToHash = new Map();
            urls.forEach((url, index) => {
                if (urlHashes[index]) {
                    urlToHash.set(url, urlHashes[index]);
                }
            });
            
            // Process in batches to avoid query limits
            const batchSize = 100;
            const newUrls = [];
            
            for (let i = 0; i < uniqueHashes.length; i += batchSize) {
                const batch = uniqueHashes.slice(i, i + batchSize);
                
                let query, params;
                if (siteId) {
                    query = `SELECT site_data_url_hash FROM site_data WHERE site_data_url_hash IN (${batch.map(() => '?').join(',')}) AND site_data_site_id = ?`;
                    params = [...batch, siteId];
                } else {
                    query = `SELECT site_data_url_hash FROM site_data WHERE site_data_url_hash IN (${batch.map(() => '?').join(',')})`;
                    params = batch;
                }
                
                try {
                    const rows = await this.dbConnection.query(query, params);
                    
                    // Handle MySQL2 result structure - rows is directly the array
                    let existingHashes;
                    if (Array.isArray(rows) && rows.length > 0) {
                        existingHashes = new Set(rows.map(row => row.site_data_url_hash));
                    } else if (Array.isArray(rows) && rows.length === 0) {
                        // Empty result set
                        existingHashes = new Set();
                    } else {
                        // No results or unexpected structure
                        existingHashes = new Set();
                    }
                    
                    // Find URLs that are NOT in the database
                    for (const [url, hash] of urlToHash) {
                        if (!existingHashes.has(hash)) {
                            newUrls.push(url);
                        }
                    }
                    
                } catch (error) {
                    logger.error('Error in findNewUrls batch query', { 
                        batchIndex: Math.floor(i / batchSize), 
                        error: error.message 
                    });
                    // Continue with other batches
                }
            }
            
            logger.debug('New URLs found', { 
                totalChecked: urls.length, 
                newUrlsFound: newUrls.length,
                siteId 
            });
            
            return newUrls;
            
        } catch (error) {
            logger.error('Error in findNewUrls', { error: error.message });
            return urls; // Return all URLs if check fails
        }
    }
}

// Create singleton instance
const duplicateChecker = new DuplicateChecker();

module.exports = { duplicateChecker, DuplicateChecker }; 