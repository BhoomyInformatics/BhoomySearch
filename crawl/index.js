/**
 * Search Engine Enhanced Crawler
 * Main entry point for the enhanced crawler with support for various content types
 */

// CRITICAL: Apply SSL and connection fixes FIRST before any other modules
require('./utils/fix-ssl-connections');

const { CrawlerCore } = require('./core/crawler');
const { ContentParser } = require('./core/parser');
const { ContentIndexer } = require('./core/indexer');

const { HtmlHandler } = require('./handlers/htmlHandler');
const { DocumentHandler } = require('./handlers/documentHandler');
const { ImageHandler } = require('./handlers/imageHandler');
const { DataHandler } = require('./handlers/dataHandler');
const { ContentTypeHandler } = require('./handlers/contentTypeHandler');

const { urlValidator } = require('./utils/urlValidator');
const { duplicateChecker } = require('./utils/duplicateChecker');
const { resourceMonitor } = require('./utils/resource-monitor');
const { logger } = require('./utils/logger');
const { ImageDuplicateChecker } = require('./utils/imageDuplicateChecker');


const { crawlerConfig } = require('./config/crawlerConfig');


/**
 * Main Crawler Class - Orchestrates the entire crawling process
 */
class SearchEngineCrawler {
    constructor(dbConnection, options = {}) {
        this.dbConnection = dbConnection;
        this.options = { ...crawlerConfig, ...options };
        
        // Initialize components
        this.parser = new ContentParser();
        this.indexer = new ContentIndexer(dbConnection);
        
        // Initialize handlers
        this.handlers = {
            html: new HtmlHandler(),
            doc: new DocumentHandler(),
            image: new ImageHandler(),
            content: new ContentTypeHandler(),
            Data: new DataHandler ()
        };
        
        // Set up duplicate checker with database connection
        duplicateChecker.setDatabaseConnection(dbConnection);
       
        // Enhanced Statistics with Site Tracking
        this.stats = {
            totalProcessed: 0,
            successful: 0,
            failed: 0,
            duplicates: 0,
            httpRequestsSaved: 0,
            uniqueUrlsCrawled: 0,
            duplicatesSkippedPreCrawl: 0,
            efficiency: 0,
            startTime: null,
            endTime: null,
            // New smart crawling statistics
            sitesProcessed: 0,
            sitesSkipped: 0,
            totalNewUrlsFound: 0,
            totalDuplicatesSkipped: 0,
            averageCrawlEfficiency: 0,
            siteStatistics: new Map() // siteId -> detailed stats
        };
        
        logger.info('SearchEngineCrawler initialized', {
            options: this.options,
            handlers: Object.keys(this.handlers)
        });
    }

    /**
     * Crawl a single URL with smart duplicate checking
     */
    async crawlUrl(url, siteId, options = {}) {
        try {
            this.stats.totalProcessed++;
            
            logger.info('Starting smart URL crawl', { url, siteId });
            
            // Create crawler instance for this URL
            const crawler = new CrawlerCore({ site_url: url, site_id: siteId }, this.dbConnection, {
                ...this.options,
                ...options
            });
            
            // Perform the crawl
            const result = await crawler.crawlPage(url);
            
            logger.debug('Page crawl completed', { 
                url,                 
                hasResult: !!result,
                hasParsedData: !!(result && result.parsedData),
                isDuplicate: result?.isDuplicate || false
            });
            
            if (result && result.success !== false) {
                // Track statistics based on result type
                if (result.isDuplicate) {
                    this.stats.duplicatesSkippedPreCrawl++;
                    this.stats.httpRequestsSaved++;
                    
                    logger.info('Duplicate URL detected via pre-crawl check', {
                        url,
                        message: result.message || 'Pre-crawl duplicate detected'
                    });
                    
                    return {
                        success: true,
                        url,
                        isDuplicate: true,
                        message: result.message || 'Pre-crawl duplicate detected',
                        extractedLinks: result.extractedLinks || [],
                        indexResult: {
                            success: false,
                            isDuplicate: true,
                            message: 'Skipped due to pre-crawl duplicate check'
                        }
                    };
                }
                
                // Process non-duplicate URLs
                if (result.parsedData) {
                    this.stats.uniqueUrlsCrawled++;
                    
                    logger.debug('Starting content indexing for unique URL', { url });
                    
                    // Index the content
                    const indexResult = await this.indexer.indexContent(
                        result.parsedData, 
                        url,
                        siteId
                    );
                    
                    this.stats.successful++;
                    
                    logger.info('URL crawl completed successfully', {
                        url,
                        dbId: indexResult.dbId,
                        elasticId: indexResult.elasticId,
                        linksExtracted: result.extractedLinks ? result.extractedLinks.length : 0
                    });
                    
                    return {
                        success: true,
                        url,
                        parsedData: result.parsedData,
                        indexResult,
                        extractedLinks: result.extractedLinks || [],
                        isDuplicate: false
                    };
                }
            }
            
            // Handle failed crawls
            this.stats.failed++;
            logger.warn('URL crawl returned no data or failed', { 
                url,
                resultType: typeof result,
                hasResult: !!result
            });
            return { success: false, url, error: 'No data returned or crawl failed' };
            
        } catch (error) {
            this.stats.failed++;
            logger.error('URL crawl failed', { 
                url, 
                siteId, 
                error: error.message,
                stack: error.stack
            });
            
            return {
                success: false,
                url,
                siteId,
                error: error.message
            };
        }
    }

    /**
     * Crawl multiple URLs in batch with enhanced concurrent processing
     */
    async crawlBatch(urls, siteId, options = {}) {
        try {
            logger.info('Starting enhanced batch crawl', { 
                urlCount: urls.length, 
                siteId 
            });
            
            const results = [];
            const concurrentLimit = options.concurrentLimit || this.options.concurrentLimit || 5;
            const batchSize = options.batchSize || this.options.batchSize || 100;
            
            // Enhanced concurrent processing with semaphore-like behavior
            const processUrlWithLimit = async (url) => {
                return this.crawlUrl(url, siteId, options);
            };

            // Process URLs in smaller concurrent groups for better performance
            for (let i = 0; i < urls.length; i += batchSize) {
                const batch = urls.slice(i, i + batchSize);
                
                logger.debug('Processing concurrent batch', { 
                    batchIndex: Math.floor(i / batchSize) + 1,
                    batchSize: batch.length,
                    totalBatches: Math.ceil(urls.length / batchSize),
                    concurrentLimit
                });
                
                // Process batch with controlled concurrency
                const batchResults = await this.processConcurrently(
                    batch, 
                    processUrlWithLimit, 
                    concurrentLimit
                );
                
                results.push(...batchResults);
                
                // Log batch progress
                const successCount = batchResults.filter(r => r && r.success).length;
                logger.info('Batch completed', {
                    batchIndex: Math.floor(i / batchSize) + 1,
                    successful: successCount,
                    failed: batchResults.length - successCount,
                    totalProcessed: results.length
                });
                
                // Add small delay between batches if configured
                if (i + batchSize < urls.length && this.options.batchDelay) {
                    await this.delay(this.options.batchDelay);
                }
            }
            
            const successfulResults = results.filter(r => r && r.success);
            const failedResults = results.filter(r => !r || !r.success);
            
            logger.info('Enhanced batch crawl completed', {
                totalUrls: urls.length,
                successful: successfulResults.length,
                failed: failedResults.length,
                successRate: `${((successfulResults.length / urls.length) * 100).toFixed(1)}%`
            });
            
            return results;
            
        } catch (error) {
            logger.error('Enhanced batch crawl failed', { 
                urlCount: urls.length, 
                siteId, 
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Process items concurrently with controlled parallelism
     */
    async processConcurrently(items, processor, limit) {
        const results = [];
        const executing = [];
        
        for (const item of items) {
            const promise = processor(item).then(result => {
                results.push(result);
                return result;
            }).catch(error => {
                const errorResult = {
                    success: false,
                    url: item,
                    error: error.message
                };
                results.push(errorResult);
                return errorResult;
            });
            
            executing.push(promise);
            
            if (executing.length >= limit) {
                await Promise.race(executing);
                executing.splice(executing.findIndex(p => p === promise), 1);
            }
        }
        
        // Wait for all remaining promises
        await Promise.all(executing);
        
        return results;
    }

    /**
     * Crawl a website starting from a root URL
     */
    async crawlWebsite(rootUrl, siteId, options = {}) {
        try {
            this.stats.startTime = new Date();
            
            logger.info('Starting website crawl', { rootUrl, siteId });
            
            const crawledUrls = new Set();
            const urlQueue = [rootUrl];
            const results = [];
            
            const maxDepth = options.maxDepth || this.options.maxDepth || 3;
            const maxPages = options.maxPages || this.options.maxPagesPerDomain || 1000;
            
            let currentDepth = 0;
            
            while (urlQueue.length > 0 && crawledUrls.size < maxPages && currentDepth < maxDepth) {
                const currentBatch = urlQueue.splice(0, this.options.batchSize || 10);
                
                logger.debug('Processing website crawl batch', {
                    depth: currentDepth,
                    batchSize: currentBatch.length,
                    queueSize: urlQueue.length,
                    crawledCount: crawledUrls.size
                });
                
                const batchResults = await this.crawlBatch(currentBatch, siteId, options);
                results.push(...batchResults);
                
                // Add crawled URLs to set
                currentBatch.forEach(url => crawledUrls.add(url));
                
                // Extract new URLs from successful crawls
                batchResults.forEach(result => {
                    if (result.success && result.extractedLinks) {
                        result.extractedLinks.forEach(link => {
                            // Links are already strings, not objects with url property
                            const linkUrl = typeof link === 'string' ? link : link.url;
                            if (!crawledUrls.has(linkUrl) && 
                                !urlQueue.includes(linkUrl) &&
                                urlValidator.isValid(linkUrl)) {
                                urlQueue.push(linkUrl);
                            }
                        });
                    }
                });
                
                currentDepth++;
                
                // Add delay between depth levels
                if (urlQueue.length > 0 && this.options.depthDelay) {
                    await this.delay(this.options.depthDelay);
                }
            }
            
            this.stats.endTime = new Date();
            
            logger.info('Website crawl completed', {
                rootUrl,
                siteId,
                totalPages: crawledUrls.size,
                maxDepthReached: currentDepth,
                duration: this.stats.endTime - this.stats.startTime
            });
            
            return {
                success: true,
                rootUrl,
                siteId,
                totalPages: crawledUrls.size,
                results,
                stats: this.getStats()
            };
            
        } catch (error) {
            logger.error('Website crawl failed', { 
                rootUrl, 
                siteId, 
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Search indexed content
     */
    async search(query, options = {}) {
        try {
            logger.info('Performing search', { query, options });
            
            const searchResults = await this.indexer.searchContent(query, options);
            
            logger.info('Search completed', {
                query,
                totalHits: searchResults.total,
                returnedHits: searchResults.hits.length
            });
            
            return searchResults;
            
        } catch (error) {
            logger.error('Search failed', { query, error: error.message });
            throw error;
        }
    }

    /**
     * Get crawler statistics
     */
    getStats() {
        const totalAttempted = this.stats.totalProcessed;
        const totalUnique = this.stats.uniqueUrlsCrawled;
        const totalDuplicates = this.stats.duplicatesSkippedPreCrawl;
        
        // Calculate efficiency
        this.stats.efficiency = totalAttempted > 0 ? 
            Math.round((totalUnique / totalAttempted) * 100) : 0;
        
        // Calculate average efficiency across all sites
        let totalEfficiency = 0;
        let sitesWithData = 0;
        
        this.stats.siteStatistics.forEach(siteStats => {
            if (siteStats.averageEfficiency >= 0) {
                totalEfficiency += siteStats.averageEfficiency;
                sitesWithData++;
            }
        });
        
        const averageSiteEfficiency = sitesWithData > 0 ? 
            Math.round(totalEfficiency / sitesWithData) : 0;
            
        return {
            ...this.stats,
            efficiency: `${this.stats.efficiency}%`,
            averageSiteEfficiency: `${averageSiteEfficiency}%`,
            resourceSavings: `Saved ${this.stats.httpRequestsSaved} HTTP requests`,
            duplicateCheckStats: duplicateChecker.getStats(),
            // Convert Map to Object for JSON serialization
            siteStatistics: Object.fromEntries(this.stats.siteStatistics)
        };
    }
    
    /**
     * Get statistics for a specific site
     */
    getSiteStats(siteId) {
        return this.stats.siteStatistics.get(siteId) || null;
    }
    
    /**
     * Update site statistics after crawling
     */
    updateSiteStats(siteId, siteUrl, crawlResults) {
        const existingStats = this.stats.siteStatistics.get(siteId) || {
            siteId,
            siteUrl,
            totalCrawls: 0,
            totalPagesFound: 0,
            totalUniquePages: 0,
            totalDuplicatesSkipped: 0,
            totalHttpRequestsSaved: 0,
            averageEfficiency: 0,
            lastCrawlDate: null,
            crawlHistory: []
        };
        
        // Update cumulative statistics
        existingStats.totalCrawls++;
        existingStats.totalPagesFound += crawlResults.totalPages || 0;
        existingStats.totalUniquePages += crawlResults.uniquePages || 0;
        existingStats.totalDuplicatesSkipped += crawlResults.duplicatesSkipped || 0;
        existingStats.totalHttpRequestsSaved += crawlResults.httpRequestsSaved || 0;
        existingStats.lastCrawlDate = new Date().toISOString();
        
        // Calculate average efficiency
        const currentEfficiency = crawlResults.crawlEfficiency || 0;
        existingStats.averageEfficiency = Math.round(
            ((existingStats.averageEfficiency * (existingStats.totalCrawls - 1)) + currentEfficiency) / existingStats.totalCrawls
        );
        
        // Add to crawl history (keep last 10 crawls)
        existingStats.crawlHistory.push({
            date: existingStats.lastCrawlDate,
            totalPages: crawlResults.totalPages || 0,
            uniquePages: crawlResults.uniquePages || 0,
            duplicatesSkipped: crawlResults.duplicatesSkipped || 0,
            efficiency: currentEfficiency
        });
        
        if (existingStats.crawlHistory.length > 10) {
            existingStats.crawlHistory.shift(); // Remove oldest entry
        }
        
        this.stats.siteStatistics.set(siteId, existingStats);
        
        // Update global statistics
        this.stats.sitesProcessed++;
        this.stats.totalNewUrlsFound += crawlResults.uniquePages || 0;
        this.stats.totalDuplicatesSkipped += crawlResults.duplicatesSkipped || 0;
        
        return existingStats;
    }

    /**
     * Initialize database tables
     */
    async initialize() {
        try {
            logger.info('Initializing crawler components');
            
            // Create duplicate checker table
            await duplicateChecker.createDatabaseTable();
            
            // Load existing duplicate data
            await duplicateChecker.loadFromDatabase();
            
            logger.info('Crawler initialization completed');
            
        } catch (error) {
            logger.error('Crawler initialization failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        try {
            logger.info('Cleaning up crawler resources');
            
            // Flush any pending indexing operations
            await this.indexer.close();
            
            // Clear caches
            duplicateChecker.clearCache();
            
            logger.info('Crawler cleanup completed');
            
        } catch (error) {
            logger.error('Crawler cleanup failed', { error: error.message });
        }
    }

    /**
     * Utility method for delays
     */
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Smart website crawling that solves the duplicate URL problem
     * This method initializes with site statistics and only crawls new URLs
     */
    async crawlWebsiteSmart(rootUrl, siteId, options = {}) {
        try {
            this.stats.startTime = new Date();
            
            logger.info('Starting smart website crawl', { 
                rootUrl, 
                siteId,
                maxPagesPerDomain: options.maxPagesPerDomain || this.options.maxPagesPerDomain
            });
            
            // Create crawler instance with production-friendly options
            const crawler = new CrawlerCore({ site_url: rootUrl, site_id: siteId }, this.dbConnection, {
                ...this.options,
                ...options,
                // PRODUCTION FIX: Allow re-crawling of existing content for freshness
                allowRecrawl: true,
                maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days in milliseconds
            });
            
            // Start with root URL
            await crawler.addLinksToQueue([rootUrl], siteId);
            
            // Process queue
            const processResult = await crawler.processQueue(
                options.maxPagesPerDomain || this.options.maxPagesPerDomain,
                options.maxDepth || this.options.maxDepth
            );
            
            // Get comprehensive statistics
            const smartStats = crawler.getSmartStats();
            const crawlResults = {
                success: true,
                totalPages: processResult.totalProcessed || 0,
                uniquePages: smartStats.indexedToDatabase || 0, // Use actual indexed count instead of newUrlsFound
                duplicatesSkipped: smartStats.duplicatesSkipped || 0,
                httpRequestsSaved: smartStats.httpRequestsSaved || 0,
                crawlEfficiency: smartStats.crawlEfficiency || 0,
                indexedToDatabase: smartStats.indexedToDatabase || 0,
                indexingErrors: smartStats.indexingFailures || 0,
                siteStats: smartStats.siteStats,
                performanceMetrics: {
                    initializationTime: smartStats.initializationTime,
                    totalCrawlTime: smartStats.crawlEndTime - smartStats.crawlStartTime,
                    avgTimePerUrl: smartStats.newUrlsFound > 0 ? 
                        Math.round((smartStats.crawlEndTime - smartStats.crawlStartTime) / smartStats.newUrlsFound) : 0
                }
            };
            
            this.stats.endTime = new Date();
            this.stats.successful += crawlResults.uniquePages;
            this.stats.duplicates += crawlResults.duplicatesSkipped;
            this.stats.httpRequestsSaved += crawlResults.httpRequestsSaved;
            
            // Update site-specific statistics
            const siteStats = this.updateSiteStats(siteId, rootUrl, crawlResults);
            
            logger.info('Smart website crawl completed successfully', {
                siteId,
                rootUrl,
                ...crawlResults,
                siteStats: {
                    totalCrawls: siteStats.totalCrawls,
                    averageEfficiency: siteStats.averageEfficiency
                }
            });
            
            return crawlResults;
            
        } catch (error) {
            logger.error('Smart website crawl failed', {
                rootUrl,
                siteId,
                error: error.message,
                stack: error.stack
            });
            
            return {
                success: false,
                error: error.message,
                totalPages: 0,
                uniquePages: 0,
                duplicatesSkipped: 0
            };
        }
    }

    /**
     * Crawl an entire website by following internal links
     */
    async crawlWebsiteComplete(rootUrl, siteId, options = {}) {
        try {
            logger.info('Starting complete website crawl', { rootUrl, siteId });
            
            const startTime = Date.now();
            const crawledUrls = new Set();
            const failedUrls = new Set();
            const duplicateUrls = new Set();
            const crawlQueue = new Set([rootUrl]);
            
            const maxPages = options.maxPages || 50;
            const maxDepth = options.maxDepth || 3;
            let currentDepth = 0;
            
            const websiteStats = {
                totalProcessed: 0,
                successful: 0,
                failed: 0,
                duplicates: 0,
                extractedLinks: 0
            };
            
            // Create crawler instance
            const crawler = new CrawlerCore({ site_url: rootUrl }, this.dbConnection, {
                ...this.options,
                ...options
            });
            
            
            
            // Process URLs in batches
            while (crawlQueue.size > 0 && websiteStats.totalProcessed < maxPages && currentDepth <= maxDepth) {
                const currentBatch = Array.from(crawlQueue).slice(0, 5); // Process 5 URLs at a time
                crawlQueue.clear();
                
                logger.info('Processing crawl batch', { 
                    batchSize: currentBatch.length,
                    depth: currentDepth,
                    totalProcessed: websiteStats.totalProcessed
                });
                
                // Process batch concurrently
                const batchPromises = currentBatch.map(async (url) => {
                    try {
                        if (crawledUrls.has(url)) {
                            return null; // Skip already crawled URLs
                        }
                        
                        crawledUrls.add(url);
                        websiteStats.totalProcessed++;
                        
                        const result = await this.crawlUrl(url, siteId, options);
                        
                        if (result.success) {
                            if (result.isDuplicate) {
                                duplicateUrls.add(url);
                                websiteStats.duplicates++;
                            } else {
                                websiteStats.successful++;
                            }
                            
                            // Add extracted links to queue for next depth level
                            if (result.extractedLinks && result.extractedLinks.length > 0) {
                                result.extractedLinks.forEach(link => {
                                    if (!crawledUrls.has(link) && !failedUrls.has(link)) {
                                        crawlQueue.add(link);
                                    }
                                });
                                websiteStats.extractedLinks += result.extractedLinks.length;
                            }
                        } else {
                            failedUrls.add(url);
                            websiteStats.failed++;
                        }
                        
                        return result;
                    } catch (error) {
                        logger.error('Error in batch processing', { url, error: error.message });
                        failedUrls.add(url);
                        websiteStats.failed++;
                        return { success: false, url, error: error.message };
                    }
                });
                
                // Wait for batch completion with timeout
                const batchResults = await Promise.allSettled(batchPromises);
                
                // Process batch results
                batchResults.forEach((result, index) => {
                    if (result.status === 'rejected') {
                        logger.error('Batch promise rejected', { 
                            url: currentBatch[index], 
                            error: result.reason 
                        });
                    }
                });
                
                // Add delay between batches to be respectful
                if (crawlQueue.size > 0) {
                    await this.delay(2000); // 2 seconds between batches
                }
                
                currentDepth++;
                
                logger.info('Batch completed', { 
                    depth: currentDepth - 1,
                    processed: websiteStats.totalProcessed,
                    remaining: crawlQueue.size,
                    successful: websiteStats.successful,
                    duplicates: websiteStats.duplicates,
                    failed: websiteStats.failed
                });
            }
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            logger.info('Website crawl completed', {
                rootUrl,                
                duration: `${(duration / 1000).toFixed(2)}s`,
                stats: websiteStats,
                maxDepthReached: currentDepth,
                crawledUrls: crawledUrls.size,
                duplicateUrls: duplicateUrls.size,
                failedUrls: failedUrls.size
            });
            
            return {
                success: true,
                rootUrl,                
                stats: websiteStats,
                crawledUrls: Array.from(crawledUrls),
                duplicateUrls: Array.from(duplicateUrls),
                failedUrls: Array.from(failedUrls),
                duration
            };
            
        } catch (error) {
            logger.error('Website crawl failed', { 
                rootUrl, 
                siteId, 
                error: error.message,
                stack: error.stack
            });
            
            return {
                success: false,
                rootUrl,
                siteId,
                error: error.message
            };
        }
    }
}

// Legacy compatibility - maintain the old interface
class crawl {
    constructor(db_row, con, options = {}) {
        this.crawler = new SearchEngineCrawler(con, options);
        this.db_row = db_row;
        this.con = con;
        this.site_data_db_row = {};
        this.$ = null;
        
        logger.warn('Using legacy crawl class - consider migrating to SearchEngineCrawler');
    }

    async ready_page(url) {
        try {
            logger.debug('Legacy ready_page called - starting complete website crawl', { url, siteId: this.db_row.site_id });
            
            // Use crawlWebsiteComplete to process main page AND all internal links
            const result = await this.crawler.crawlWebsiteComplete(url, this.db_row.site_id, {
                maxPages: 50,  // Limit to prevent overwhelming
                maxDepth: 3    // Crawl up to 3 levels deep
            });
            
            logger.debug('Legacy ready_page result', { 
                url, 
                success: result.success,
                totalPages: result.stats ? result.stats.totalProcessed : 0,
                successful: result.stats ? result.stats.successful : 0
            });
            
            if (result.success) {
                // Set legacy properties for backward compatibility
                this.site_data_db_row = {
                    url: url,
                    totalPages: result.stats.totalProcessed,
                    successfulPages: result.stats.successful,
                    duplicatePages: result.stats.duplicates,
                    failedPages: result.stats.failed,
                    extractedLinks: result.stats.extractedLinks
                };
                
                // Create legacy-compatible return object
                return {
                    success: true,
                    parsedData: this.site_data_db_row,
                    extractedLinks: result.crawledUrls || [],
                    canContinue: true, // Legacy property
                    url: url,
                    siteId: this.db_row.site_id,
                    websiteStats: result.stats,
                    totalPagesCrawled: result.stats.totalProcessed
                };
            } else {
                logger.warn('Legacy ready_page failed', { 
                    url, 
                    error: result.error || 'Website crawl failed' 
                });
                
                return {
                    success: false,
                    error: result.error || 'Website crawl failed',
                    canContinue: false, // Legacy property
                    url: url,
                    siteId: this.db_row.site_id
                };
            }
        } catch (error) {
            logger.error('Legacy ready_page failed', { 
                url, 
                siteId: this.db_row.site_id,
                error: error.message,
                stack: error.stack
            });
            
            return {
                success: false,
                error: error.message,
                canContinue: false, // Legacy property
                url: url,
                siteId: this.db_row.site_id
            };
        }
    }
}

// Export both new and legacy interfaces
module.exports = {
    SearchEngineCrawler,
    crawl, // Legacy compatibility
    
    // Export individual components for advanced usage
    CrawlerCore,
    ContentParser,
    ContentIndexer,
    
    // Export handlers
    HtmlHandler,
    DocumentHandler,
    ImageHandler,
    ContentTypeHandler,
    DataHandler,
    
    // Export utilities
    urlValidator,
    duplicateChecker,
    resourceMonitor,
    logger,
    
    // Export configurations
    crawlerConfig
};
