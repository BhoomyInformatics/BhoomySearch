const Crawler = require('crawler');
const cheerio = require('cheerio');
const { JSDOM } = require('jsdom');
const UserAgent = require('user-agents');
const RobotsParser = require('robots-parser');
const axios = require('axios');
const dns = require('dns');
const zlib = require('zlib');
const http = require('http');
const https = require('https');

const { userAgents } = require('../config/user-agents');
const { proxyList } = require('../config/proxies');
const { stealthHeaders } = require('../config/headers');
const { crawlerConfig } = require('../config/crawlerConfig');
const systemLimitsManager = require('../config/system-limits');

const { urlValidator } = require('../utils/urlValidator');
const { duplicateChecker } = require('../utils/duplicateChecker');
const { SiteAwareDuplicateChecker } = require('../utils/siteAwareDuplicateChecker');
const { resourceMonitor } = require('../utils/resource-monitor');

const { HtmlHandler } = require('../handlers/htmlHandler');
const { DocumentHandler } = require('../handlers/documentHandler');
const { ImageHandler } = require('../handlers/imageHandler');
const { DataHandler } = require('../handlers/dataHandler');
const { ContentTypeHandler } = require('../handlers/contentTypeHandler');
const { ErrorHandler } = require('../handlers/error-handler');
const { ContentIndexer } = require('./indexer');

const { logger } = require('../utils/logger');

// Set custom DNS servers for better reliability
dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);

// System-level HTTP agent configuration to prevent EMFILE
const httpAgent = new http.Agent({
    keepAlive: true,
    keepAliveMsecs: 30000,
    maxSockets: 200, // INCREASED from 100 to 200 to match maxGlobalConnections
    maxFreeSockets: 100, // INCREASED from 50 to 100 for better connection reuse
    timeout: 20000, // INCREASED from 15000 to 20000
    scheduling: 'fifo'
});

const httpsAgent = new https.Agent({
    keepAlive: true,
    keepAliveMsecs: 30000,
    maxSockets: 200, // INCREASED from 100 to 200 to match maxGlobalConnections  
    maxFreeSockets: 100, // INCREASED from 50 to 100 for better connection reuse
    timeout: 20000, // INCREASED from 15000 to 20000
    scheduling: 'fifo',
    rejectUnauthorized: false // Allow self-signed certificates
});

// Override default agents globally
http.globalAgent = httpAgent;
https.globalAgent = httpsAgent;

// System-level connection manager for EMFILE prevention
class SystemConnectionManager {
    constructor() {
        this.maxGlobalConnections = crawlerConfig.maxGlobalConnections || 2000; // INCREASED from 500 to 2000
        this.maxDomainConnections = crawlerConfig.maxConnectionsPerDomain || 5;  // INCREASED from 2 to 5
        this.activeConnections = 0;
        this.connectionsByDomain = new Map();
        this.queuedRequests = [];
        this.requestTimeout = crawlerConfig.queueTimeoutMs || 30000; // INCREASED from 15000 to 30000
        this.lastEmfileWarning = 0;
        this.maxQueueSize = crawlerConfig.maxQueueSize || 5000; // NEW: Configurable queue size
        this.enableBackpressure = crawlerConfig.enableBackpressure || true; // NEW: Backpressure control
        this.backpressureThreshold = crawlerConfig.backpressureThreshold || 0.8; // NEW: Backpressure threshold
        this.adaptiveDelay = crawlerConfig.adaptiveDelay || true; // NEW: Adaptive delay
        this.maxAdaptiveDelayMs = crawlerConfig.maxAdaptiveDelayMs || 10000; // NEW: Max adaptive delay
        
        // Start monitoring
        this.startMonitoring();
        
        logger.info('SystemConnectionManager initialized with optimized settings', {
            service: 'SystemConnectionManager',
            maxGlobalConnections: this.maxGlobalConnections,
            maxDomainConnections: this.maxDomainConnections,
            maxQueueSize: this.maxQueueSize,
            requestTimeout: this.requestTimeout,
            enableBackpressure: this.enableBackpressure,
            backpressureThreshold: this.backpressureThreshold
        });
    }

    startMonitoring() {
        // Monitor system health every 5 seconds
        setInterval(() => {
            this.logStats();
            this.cleanupStaleConnections();
            this.processQueueMaintenance();
        }, crawlerConfig.queueMonitoringInterval || 5000);
    }

    logStats() {
        const connectionUtilization = this.activeConnections / this.maxGlobalConnections;
        const queueUtilization = this.queuedRequests.length / this.maxQueueSize;
        
        // Warning at 60% connection utilization or 50% queue utilization
        if (connectionUtilization > 0.6 || queueUtilization > 0.5) {
            const now = Date.now();
            // Only warn every 10 seconds to avoid spam
            if (now - this.lastEmfileWarning > 10000) {
                this.lastEmfileWarning = now;
                logger.warn('Connection/Queue usage approaching limits', {
                    service: 'SystemConnectionManager',
                    activeConnections: this.activeConnections,
                    maxConnections: this.maxGlobalConnections,
                    queuedRequests: this.queuedRequests.length,
                    maxQueueSize: this.maxQueueSize,
                    connectionUtilization: Math.round(connectionUtilization * 100),
                    queueUtilization: Math.round(queueUtilization * 100),
                    connectionsByDomain: Object.fromEntries(this.connectionsByDomain),
                    riskLevel: connectionUtilization > 0.8 || queueUtilization > 0.8 ? 'HIGH' : 'MEDIUM'
                });
            }
        }
        
        // Emergency warning at 80% utilization
        if (connectionUtilization > 0.8) {
            logger.error('CRITICAL: Connection usage at dangerous levels', {
                service: 'SystemConnectionManager',
                activeConnections: this.activeConnections,
                maxConnections: this.maxGlobalConnections,
                utilizationPercent: Math.round(connectionUtilization * 100),
                action: 'Consider stopping some crawlers immediately'
            });
        }

        // Emergency warning for queue overflow risk
        if (queueUtilization > 0.9) {
            logger.error('CRITICAL: Queue near overflow', {
                service: 'SystemConnectionManager',
                queuedRequests: this.queuedRequests.length,
                maxQueueSize: this.maxQueueSize,
                queueUtilization: Math.round(queueUtilization * 100),
                action: 'Applying emergency backpressure'
            });
        }
    }

    // NEW: Queue maintenance to clean up stale requests
    processQueueMaintenance() {
        const now = Date.now();
        const staleTimeout = this.requestTimeout * 2; // Consider requests stale after 2x timeout
        
        this.queuedRequests = this.queuedRequests.filter(request => {
            if (now - request.timestamp > staleTimeout) {
                clearTimeout(request.timeout);
                request.reject(new Error('Request expired in queue'));
                return false;
            }
            return true;
        });
    }

    cleanupStaleConnections() {
        // Remove domains with zero connections
        for (const [domain, count] of this.connectionsByDomain.entries()) {
            if (count <= 0) {
                this.connectionsByDomain.delete(domain);
            }
        }
    }

    // NEW: Calculate adaptive delay based on queue pressure
    calculateAdaptiveDelay() {
        if (!this.adaptiveDelay) return 0;
        
        const queuePressure = this.queuedRequests.length / this.maxQueueSize;
        
        if (queuePressure > this.backpressureThreshold) {
            // Scale delay based on queue pressure
            const scaleFactor = (queuePressure - this.backpressureThreshold) / (1 - this.backpressureThreshold);
            return Math.min(this.maxAdaptiveDelayMs * scaleFactor, this.maxAdaptiveDelayMs);
        }
        
        return 0;
    }

    async acquire(domain) {
        // Check system-level safety first
        if (!systemLimitsManager.isConnectionSafe()) {
            throw new Error('System connection limit reached - EMFILE prevention');
        }

        // NEW: Apply adaptive delay if queue is under pressure
        const adaptiveDelay = this.calculateAdaptiveDelay();
        if (adaptiveDelay > 0) {
            logger.debug('Applying adaptive delay due to queue pressure', {
                service: 'SystemConnectionManager',
                delayMs: adaptiveDelay,
                queueSize: this.queuedRequests.length,
                maxQueueSize: this.maxQueueSize
            });
            await new Promise(resolve => setTimeout(resolve, adaptiveDelay));
        }

        return new Promise((resolve, reject) => {
            const request = {
                domain,
                resolve,
                reject,
                timestamp: Date.now(),
                timeout: setTimeout(() => {
                    const index = this.queuedRequests.indexOf(request);
                    if (index > -1) {
                        this.queuedRequests.splice(index, 1);
                    }
                    reject(new Error(`Connection timeout for domain: ${domain}`));
                }, this.requestTimeout)
            };

            if (this.canAcquire(domain)) {
                this.grantConnection(request);
            } else {
                this.queuedRequests.push(request);
                
                // IMPROVED: Better queue overflow handling
                if (this.queuedRequests.length > this.maxQueueSize) {
                    // Remove oldest requests instead of failing immediately
                    const overflowCount = this.queuedRequests.length - this.maxQueueSize;
                    const removedRequests = this.queuedRequests.splice(0, overflowCount);
                    
                    // Clean up removed requests
                    removedRequests.forEach(removedRequest => {
                        clearTimeout(removedRequest.timeout);
                        removedRequest.reject(new Error('Queue overflow - request evicted'));
                    });
                    
                    logger.warn('Queue overflow handled by evicting old requests', {
                        service: 'SystemConnectionManager',
                        evictedRequests: overflowCount,
                        currentQueueSize: this.queuedRequests.length,
                        maxQueueSize: this.maxQueueSize
                    });
                }
            }
        });
    }

    canAcquire(domain) {
        if (this.activeConnections >= this.maxGlobalConnections) {
            return false;
        }
        
        const domainCount = this.connectionsByDomain.get(domain) || 0;
        return domainCount < this.maxDomainConnections;
    }

    grantConnection(request) {
        const { domain, resolve, timeout } = request;
        
        this.activeConnections++;
        const currentDomainCount = this.connectionsByDomain.get(domain) || 0;
        this.connectionsByDomain.set(domain, currentDomainCount + 1);
        
        // Track with system limits manager
        systemLimitsManager.incrementConnections();
        
        clearTimeout(timeout);
        resolve();
    }

    release(domain) {
        this.activeConnections = Math.max(0, this.activeConnections - 1);
        
        if (domain) {
            const currentCount = this.connectionsByDomain.get(domain) || 0;
            this.connectionsByDomain.set(domain, Math.max(0, currentCount - 1));
        }

        // Track with system limits manager
        systemLimitsManager.decrementConnections();

        // Process next queued request
        this.processQueue();
    }

    processQueue() {
        if (this.queuedRequests.length === 0) return;

        // Sort by timestamp for fairness
        this.queuedRequests.sort((a, b) => a.timestamp - b.timestamp);

        // NEW: Process multiple requests if possible (up to 3 at once)
        let processed = 0;
        const maxProcessPerCycle = 3;
        
        for (let i = this.queuedRequests.length - 1; i >= 0 && processed < maxProcessPerCycle; i--) {
            const request = this.queuedRequests[i];
            if (this.canAcquire(request.domain)) {
                this.queuedRequests.splice(i, 1);
                this.grantConnection(request);
                processed++;
            }
        }
    }

    getStats() {
        return {
            activeConnections: this.activeConnections,
            maxGlobalConnections: this.maxGlobalConnections,
            queuedRequests: this.queuedRequests.length,
            maxQueueSize: this.maxQueueSize,
            queueUtilization: Math.round((this.queuedRequests.length / this.maxQueueSize) * 100),
            connectionUtilization: Math.round((this.activeConnections / this.maxGlobalConnections) * 100),
            connectionsByDomain: Object.fromEntries(this.connectionsByDomain)
        };
    }
}

// Global system manager instance
const systemConnectionManager = new SystemConnectionManager();

// Global enhanced error handling components

// Create handler instances
const htmlHandler = new HtmlHandler();
const documentHandler = new DocumentHandler();
const imageHandler = new ImageHandler();

class CrawlerCore {
    constructor(db_row, con, options = {}) {
        this.db_row = db_row;
        this.con = con;
        this.options = {
            maxRetries: options.maxRetries || 2,
            timeout: options.timeout || 30000,
            userAgent: options.userAgent || this.getRandomUserAgent(),
            proxy: options.proxy || this.getRandomProxy(),
            respectRobots: options.respectRobots !== false,
            ...options
        };
        
        this.site_data_db_row = {};
        this.$ = null;
        this.currentUrl = null;
        this.retryCount = 0;
        this.crawlQueue = new Set(); // Queue to track URLs to crawl
        this.crawledUrls = new Set(); // Track crawled URLs to avoid infinite loops
        
        // Enhanced error handling components (references to global instances)
        this.errorHandler = new ErrorHandler(this.options);
        
        // Initialize site-aware duplicate checker for smart crawling
        this.siteAwareDuplicateChecker = new SiteAwareDuplicateChecker(con, {
            maxCacheSize: options.maxCacheSize || 50000,
            batchSize: options.batchSize || 500,
            enableContentHashing: options.enableContentHashing !== false
        });
        
        // Initialize ContentIndexer for proper database storage
        this.contentIndexer = new ContentIndexer(con);
        
        // Smart crawling statistics
        this.smartStats = {
            siteId: db_row?.site_id || null,
            siteUrl: db_row?.site_url || null,
            totalUrlsDiscovered: 0,
            newUrlsFound: 0,
            duplicatesSkipped: 0,
            httpRequestsSaved: 0,
            crawlEfficiency: 0,
            siteInitialized: false,
            initializationTime: null,
            crawlStartTime: null,
            crawlEndTime: null,
            indexedToDatabase: 0,
            indexingErrors: 0,
            failedUrls: 0
        };
        
        // Reduced logging - only log essential info, not entire options object
        logger.info('CrawlerCore initialized with smart crawling capabilities', { 
            url: db_row?.site_url,
            siteId: this.smartStats.siteId,
            userAgent: this.options.userAgent,
            respectRobots: this.options.respectRobots,
            maxRetries: this.options.maxRetries,
            timeout: this.options.timeout
        });
    }

    getRandomUserAgent() {
        try {
            if (userAgents && userAgents.length > 0) {
                const randomIndex = Math.floor(Math.random() * userAgents.length);
                return userAgents[randomIndex];
            }
            return new UserAgent().toString();
        } catch (error) {
            logger.error('Error getting random user agent', error);
            return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
        }
    }

    getRandomProxy() {
        try {
            if (proxyList && proxyList.length > 0) {
                const randomIndex = Math.floor(Math.random() * proxyList.length);
                return proxyList[randomIndex];
            }
            return null;
        } catch (error) {
            logger.error('Error getting random proxy', error);
            return null;
        }
    }

    getRandomDelay() {
        return Math.floor(Math.random() * (crawlerConfig.maxDelay - crawlerConfig.minDelay + 1)) + crawlerConfig.minDelay;
    }

    /**
     * Initialize the crawler for a specific site
     * This is the key method that loads existing URLs and prepares for smart URL filtering
     */
    async initializeForSite(siteId, siteUrl = null) {
        try {
            this.smartStats.crawlStartTime = Date.now();
            
            logger.info('Initializing smart crawler for site', { siteId, siteUrl });
            
            // Initialize site-aware duplicate checker
            const initStartTime = Date.now();
            const siteStats = await this.siteAwareDuplicateChecker.initializeForSite(siteId, siteUrl);
            this.smartStats.initializationTime = Date.now() - initStartTime;
            
            // Update smart stats with site information
            this.smartStats.siteId = siteId;
            this.smartStats.siteUrl = siteUrl || siteStats.siteUrl;
            this.smartStats.siteInitialized = true;
            
            logger.info('Site initialization completed', {
                siteId,
                totalCrawledUrls: siteStats.totalCrawledUrls,
                urlsAddedToday: siteStats.urlsAddedToday,
                crawlPriority: siteStats.crawlPriority,
                estimatedNewUrls: siteStats.estimatedNewUrls,
                initializationTime: this.smartStats.initializationTime
            });
            
            // Decide if site should be crawled based on statistics
            return this.shouldCrawlSite(siteStats);
            
        } catch (error) {
            logger.error('Error initializing smart crawler for site', {
                siteId,
                siteUrl,
                error: error.message
            });
            throw error;
        }
    }
    
    /**
     * Determine if a site should be crawled based on its statistics
     */
    shouldCrawlSite(siteStats) {
        const decision = {
            shouldCrawl: true,
            reason: 'normal_crawl',
            action: 'full_crawl',
            estimatedNewUrls: siteStats.estimatedNewUrls
        };
        
        // Check for force crawl options (for news sites that need daily crawling)
        if (this.options.forceCrawl || this.options.skipRecentCheck) {
            decision.shouldCrawl = true;
            decision.reason = 'forced_daily_crawl';
            decision.action = 'full_crawl';
            decision.estimatedNewUrls = Math.max(siteStats.estimatedNewUrls, 50); // Ensure minimum crawl
            
            logger.info('Site crawl decision made (forced daily crawl)', {
                siteId: siteStats.siteId,
                ...decision,
                forceCrawl: this.options.forceCrawl,
                skipRecentCheck: this.options.skipRecentCheck
            });
            
            return decision;
        }
        
        // Skip crawling if site was crawled today and has low estimated new URLs
        if (siteStats.urlsAddedToday > 0 && siteStats.estimatedNewUrls < 10) {
            decision.shouldCrawl = false;
            decision.reason = 'recently_crawled_low_activity';
            decision.action = 'skip';
        }
        // Limit crawling for large sites crawled recently
        else if (siteStats.totalCrawledUrls > 5000 && siteStats.estimatedNewUrls < 50) {
            decision.shouldCrawl = true;
            decision.reason = 'large_site_limited_new_content';
            decision.action = 'limited_crawl';
            decision.estimatedNewUrls = Math.min(siteStats.estimatedNewUrls, 100);
        }
        // Full crawl for new sites or sites with lots of estimated new content
        else if (siteStats.totalCrawledUrls === 0 || siteStats.estimatedNewUrls > 200) {
            decision.shouldCrawl = true;
            decision.reason = 'new_site_or_high_activity';
            decision.action = 'full_crawl';
        }
        
        logger.info('Site crawl decision made', {
            siteId: siteStats.siteId,
            ...decision
        });
        
        return decision;
    }

    async checkRobotsTxt(url) {
        // Bypass robots.txt entirely for forced crawls (e.g., news/day-based)
        if (this.options.forceCrawl || !this.options.respectRobots) {
            return true;
        }

        try {
            const urlObj = new URL(url);
            const robotsUrl = `${urlObj.protocol}//${urlObj.host}/robots.txt`;
            
            // Only log robots.txt check for new domains, not every URL
            const domain = urlObj.hostname;
            if (!this.robotsChecked) {
                this.robotsChecked = new Set();
            }
            
            if (!this.robotsChecked.has(domain)) {
                logger.info('Checking robots.txt for domain', { domain, robotsUrl });
                this.robotsChecked.add(domain);
            }
            
            const response = await axios.get(robotsUrl, {
                timeout: 10000,
                headers: {
                    'User-Agent': this.options.userAgent
                }
            });

            const robots = RobotsParser(robotsUrl, response.data);
            const isAllowed = robots.isAllowed(url, this.options.userAgent);
            
            if (!isAllowed) {
                logger.warn('URL blocked by robots.txt', { url }); // Only log when blocked
            }
            return isAllowed;
        } catch (error) {
            // Only log robots.txt errors occasionally to prevent spam
            if (Math.random() < 0.1) { // Log only 10% of robots.txt errors
                logger.warn('Could not fetch robots.txt, allowing crawl', { url, error: error.message });
            }
            return true; // If robots.txt is not accessible, allow crawling
        }
    }

    async crawlPage(url) {
        try {
            this.currentUrl = url;
            
            // Validate and clean URL
            const validatedUrl = urlValidator.isValid(url);
            if (!validatedUrl) {
                throw new Error('Invalid URL format');
            }
            
            // Use the cleaned URL if it was modified
            if (validatedUrl !== true && validatedUrl !== url) {
                logger.debug('Using cleaned URL', { original: url, cleaned: validatedUrl });
                url = validatedUrl;
                this.currentUrl = url;
            }

            // Check if URL was already crawled in this session to avoid infinite loops
            if (this.crawledUrls.has(url)) {
                logger.info('URL already crawled in this session, skipping', { url });
                return null;
            }

            // SMART CRAWLING: Use site-aware duplicate checker if available
            if (this.siteAwareDuplicateChecker && this.smartStats.siteId) {
                const isAlreadyCrawled = await this.siteAwareDuplicateChecker.isUrlAlreadyCrawled(
                    url, 
                    this.smartStats.siteId,
                    this.options || {}
                );
                
                if (isAlreadyCrawled) {
                    this.smartStats.duplicatesSkipped++;
                    this.smartStats.httpRequestsSaved++;
                    
                    logger.debug('URL skipped - already crawled (smart check)', { 
                        url,
                        siteId: this.smartStats.siteId
                    });
                    
                    return {
                        success: true,
                        url,
                        isDuplicate: true,
                        message: 'Pre-crawl duplicate detected - URL already crawled',
                        extractedLinks: [],
                        httpRequestSaved: true
                    };
                }
            } else {
                // Fallback to regular duplicate checking
            const siteId = this.db_row?.site_id;
            const isAlreadyCrawled = await duplicateChecker.isUrlAlreadyCrawled(url, siteId);
            
            if (isAlreadyCrawled) {
                logger.info('URL already crawled previously (pre-crawl check), skipping HTTP request', { 
                    url, 
                    siteId 
                });
                
                // Add to session crawled URLs to prevent re-checking
                this.crawledUrls.add(url);
                
                // Return a result indicating this is a duplicate but don't waste resources
                return {
                    success: true,
                    url: url,
                    isDuplicate: true,
                    shouldSkipIndexing: true,
                    extractedLinks: [], // No links extracted since we didn't fetch the page
                    message: 'URL already crawled (pre-crawl duplicate check)'
                };
                }
            }

            // Add to crawled URLs set immediately to prevent re-crawling in this session
            this.crawledUrls.add(url);

            // Check robots.txt
            if (!(await this.checkRobotsTxt(url))) {
                logger.info('URL blocked by robots.txt', { url });
                return null;
            }

            // Monitor resources
            const resourceStatus = resourceMonitor.checkResources();
            if (!resourceStatus.canContinue) {
                logger.warn('Resource limits reached, pausing crawl', resourceStatus);
                await this.delay(resourceStatus.suggestedDelay);
            }

            // Perform the actual crawl - only for non-duplicate URLs
            logger.debug('Starting HTTP request for URL (passed pre-crawl checks)', { url });
            let result = await this.performCrawl(url);
            
            // If result is null (CAPTCHA detected), try with different user agent
            if (!result && this.isCaptchaProtectedSite(url)) {
                logger.info('CAPTCHA detected, retrying with different user agent', { url });
                await this.delay(2000); // Wait 2 seconds before retry
                result = await this.performCrawlWithDifferentUserAgent(url);
            }
            
            // Process the crawl result
            if (result && result.parsedData) {
                // Extract internal links for continued crawling
                let extractedLinks = [];
                try {
                    extractedLinks = await this.extractInternalLinks(result.parsedData, url);
                result.extractedLinks = extractedLinks;
                } catch (extractError) {
                    logger.error('Error extracting internal links', { 
                        url, 
                        error: extractError.message,
                        stack: extractError.stack 
                    });
                    result.extractedLinks = [];
                    extractedLinks = [];
                }
                
                // Add new links to crawl queue with smart filtering
                if (extractedLinks.length > 0) {
                    try {
                        if (this.siteAwareDuplicateChecker && this.smartStats.siteId) {
                            await this.addLinksToQueueSmart(extractedLinks, this.smartStats.siteId);
                        } else {
                            await this.addLinksToQueue(extractedLinks, this.db_row?.site_id);
                        }
                    } catch (queueError) {
                        logger.error('Error adding links to queue', { 
                            url, 
                            error: queueError.message 
                        });
                    }
                }
                
                logger.info('Page crawled successfully with links extracted', { 
                    url, 
                    linksFound: extractedLinks.length
                });

                // SMART CRAWLING: Index content to database if available
                if (this.contentIndexer && this.smartStats.siteId && result.success !== false && !result.isDuplicate) {
                    try {
                        logger.debug('Starting content indexing for crawled URL', { 
                            url, 
                            siteId: this.smartStats.siteId,
                            hasTitle: !!result.parsedData.title,
                            hasContent: !!result.parsedData.article || !!result.parsedData.content
                        });
                        
                        const indexResult = await this.contentIndexer.indexContent(
                            result.parsedData,
                            url,
                            this.smartStats.siteId
                        );
                        
                        if (indexResult.success) {
                            this.smartStats.indexedToDatabase++;
                            
                            logger.info('Content indexed successfully to database', {
                                url,
                                siteId: this.smartStats.siteId,
                                dbId: indexResult.dbId,
                                elasticId: indexResult.elasticId,
                                isDuplicate: indexResult.isDuplicate
                            });
                            
                            // Add indexing info to result
                            result.indexResult = indexResult;
                        } else {
                            this.smartStats.indexingErrors++;
                            logger.warn('Content indexing failed', {
                                url,
                                siteId: this.smartStats.siteId,
                                error: indexResult.message || 'Unknown indexing error'
                            });
                        }
                        
                    } catch (indexingError) {
                        this.smartStats.indexingErrors++;
                        logger.error('Error during content indexing', {
                            url,
                            siteId: this.smartStats.siteId,
                            error: indexingError.message,
                            stack: indexingError.stack
                        });
                        
                        // Don't fail the crawl if indexing fails
                        result.indexError = indexingError.message;
                    }
                }

                // Mark URL as crawled in appropriate duplicate checker
                if (this.siteAwareDuplicateChecker && this.smartStats.siteId) {
                    await this.siteAwareDuplicateChecker.markAsCrawled(
                        url,
                        result.parsedData ? JSON.stringify(result.parsedData) : null,
                        this.smartStats.siteId
                    );
                } else {
                    await duplicateChecker.markAsCrawled(url, result.parsedData.content, this.db_row?.site_id);
                }
                logger.debug('URL marked as crawled in duplicate checker', { url });
            }
            
            return result;
        } catch (error) {
            // Reduce noise for common errors
            if (error.message.includes('HTTP 404') || error.message.includes('HTTP 500') || error.message.includes('ETIMEDOUT')) {
                logger.debug('Error in crawl page (common error)', {
                    url,
                    siteId: this.smartStats.siteId,
                    error: error.message
                });
            } else {
                logger.error('Error in crawlPage', { 
                    url, 
                    error: error.message,
                    stack: error.stack 
                });
            }
            throw error;
        }
    }


    /**
     * Check if URL should be skipped based on patterns
     */
    shouldSkipUrl(url) {
        const skipPatterns = [
            /\/wp-admin\//,
            /\/admin\//,
            /\/login/,
            /\/signin/i,
            /\/users\/auth\//i,
            /\/auth\//i,
            /\/logout/,
            /\/register/,
            /\.(css|js|json|xml|txt|zip|rar|7z|tar|gz|mp3|mp4|avi|mov|wmv|exe|dmg|pkg|deb|rpm|pdf|doc|docx|xls|xlsx|ppt|pptx|jpg|jpeg|png|gif|bmp|svg|ico)(\?|$)/i,
            /\/feed\//,
            /\/rss/,
            /\/api\//,
            /\/ajax/,
            /\/xmlrpc\.php/,  // WordPress XML-RPC endpoints (cause HTTP 405)
            /\/feeds\/.*\/comments/, // Comment feeds (often cause ENOTFOUND)
            /\/wp-json\//,     // WordPress REST API (often requires auth)
            /\/users\/.*\/charts/, // User-specific content (often requires auth)
            /\/Special:/i, // MediaWiki maintenance pages
            /\?.*utm_/,
            /\#/,
            /mailto:/,
            /tel:/,
            /javascript:/,
            /^data:/,
            /^blob:/,
            /^about:/
        ];
        
        // Additional checks for problematic domains/patterns
        try {
            const urlObj = new URL(url);
            
            // Skip URLs with suspicious TLDs that often don't resolve
            const suspiciousTlds = ['.test', '.local', '.localhost', '.invalid'];
            if (suspiciousTlds.some(tld => urlObj.hostname.endsWith(tld))) {
                return true;
            }
            
            // Skip URLs with too many subdomains (often broken)
            const subdomainCount = urlObj.hostname.split('.').length - 2;
            if (subdomainCount > 3) {
                return true;
            }
            
            // Skip known problematic domains that consistently return errors
            const problematicDomains = [
                'as.baidu.com',      // Often times out
                'skipblast.com',     // Often times out
                'blog.onedash.com',   // Often returns 500 errors
                'idp.springernature.com',
                'verify.shiksha.com'
            ];
            if (problematicDomains.some(domain => urlObj.hostname.includes(domain))) {
                return true;
            }

            // Skip auth redirect targets for Springer/Nature communities
            if (/springernature\.com\/auth/i.test(urlObj.href) || /users\/auth\/springer_nature/i.test(urlObj.href)) {
                return true;
            }
            
        } catch (error) {
            // If URL parsing fails, skip it
            return true;
        }
        
        return skipPatterns.some(pattern => pattern.test(url));
    }

    /**
     * Get count of existing URLs in database for a specific site
     */
    async getExistingUrlCount(siteId) {
        try {
            const query = `
                SELECT COUNT(*) as count 
                FROM site_data 
                WHERE site_data_site_id = ? 
                AND status IN ('indexed', 'pending', 'crawled')
            `;
            
            const result = await this.con.query(query, [siteId]);
            return result[0]?.count || 0;
        } catch (error) {
            logger.error('Failed to get existing URL count from database', {
                siteId,
                error: error.message
            });
            return 0;
        }
    }

    /**
     * Enhanced URL discovery with smart filtering
     * This filters URLs BEFORE adding them to queue for maximum efficiency
     */
    async addLinksToQueueSmart(links, siteId = null) {
        if (!Array.isArray(links) || links.length === 0) {
            return [];
        }
        
        const targetSiteId = siteId || this.smartStats.siteId;
        if (!targetSiteId) {
            logger.warn('No site ID available for smart URL filtering');
            return super.addLinksToQueue(links, siteId);
        }
        
        try {
            // STEP 1: Filter URLs to find only new ones
            logger.info('Starting smart URL filtering', {
                siteId: targetSiteId,
                totalUrls: links.length
            });
            
            // Pass crawl options to respect force crawl settings
            const newUrls = await this.siteAwareDuplicateChecker.findNewUrls(links, targetSiteId, this.options || {});
            
            // Update statistics
            this.smartStats.totalUrlsDiscovered += links.length;
            this.smartStats.newUrlsFound += newUrls.length;
            this.smartStats.duplicatesSkipped += (links.length - newUrls.length);
            this.smartStats.httpRequestsSaved += (links.length - newUrls.length);
            
            // Calculate efficiency
            this.smartStats.crawlEfficiency = this.smartStats.totalUrlsDiscovered > 0 ? 
                Math.round((this.smartStats.newUrlsFound / this.smartStats.totalUrlsDiscovered) * 100) : 0;
            
            logger.info('Smart URL filtering completed', {
                siteId: targetSiteId,
                totalUrls: links.length,
                newUrls: newUrls.length,
                duplicatesSkipped: this.smartStats.duplicatesSkipped,
                efficiency: this.smartStats.crawlEfficiency
            });
            
            // STEP 2: Add only new URLs to the crawl queue
            if (newUrls.length > 0) {
                // Add URLs directly to queue without parent duplicate checking
                // since we've already done smart filtering
                for (const url of newUrls) {
                    if (!this.crawlQueue.has(url) && !this.crawledUrls.has(url)) {
                        this.crawlQueue.add(url);
                    }
                }
                
                logger.debug('URLs added directly to queue (smart filtering bypass)', {
                    siteId: targetSiteId,
                    urlsAdded: newUrls.length,
                    queueSize: this.crawlQueue.size
                });
                
                return newUrls; // Return the URLs that were added
            } else {
                logger.info('No new URLs to add to queue', { siteId: targetSiteId });
                return [];
            }
            
        } catch (error) {
            logger.error('Error in smart URL filtering', {
                siteId: targetSiteId,
                totalUrls: links.length,
                error: error.message
            });
            
            // Fallback to regular crawling if smart filtering fails
            logger.warn('Smart filtering failed, using parent method', { siteId: targetSiteId });
            await super.addLinksToQueue(links, siteId);
            return links; // Return the original links
        }
    }

    /**
     * Add links to crawl queue (with batch DB duplicate check)
     */
    async addLinksToQueue(links, siteId = null) {
        if (!links || !Array.isArray(links) || links.length === 0) {
            return;
        }
        
        // First, find which URLs are NEW (not in database) - prioritize these
        let newUrls = [];
        try {
            newUrls = await duplicateChecker.findNewUrls(links, siteId);
        } catch (e) {
            logger.warn('New URL check failed, falling back to regular duplicate check', { error: e.message });
            newUrls = []; // Fallback to empty new URLs
        }
        
        // Prioritize new URLs by adding them first
        const prioritizedLinks = [...newUrls, ...links.filter(url => !newUrls.includes(url))];
        
        // Batch DB check for already-crawled URLs
        let alreadyCrawledHashes = new Set();
        try {
            alreadyCrawledHashes = await duplicateChecker.batchCheckUrlsInDatabase(links, siteId);
        } catch (e) {
            logger.warn('Batch DB duplicate check failed, falling back to in-memory only', { error: e.message });
        }
        
        let addedCount = 0;
        let skippedCount = 0;
        let duplicateCount = 0;
        let newUrlsAdded = 0;
        
        for (const link of prioritizedLinks) {
            try {
                const linkUrl = typeof link === 'string' ? link : link.url;
                if (!linkUrl || typeof linkUrl !== 'string') {
                    skippedCount++;
                    continue;
                }
                
                // Skip if already in session crawled URLs
                if (this.crawledUrls.has(linkUrl)) {
                    duplicateCount++;
                    continue;
                }
                
                // Skip if already in queue
                if (this.crawlQueue.has(linkUrl)) {
                    duplicateCount++;
                    continue;
                }
                
                // Skip URLs that should be avoided
                if (this.shouldSkipUrl(linkUrl)) {
                    skippedCount++;
                    continue;
                }
                
                // Skip if already crawled in DB
                const urlHash = duplicateChecker.hashUrl(duplicateChecker.normalizeUrls ? duplicateChecker.normalizeUrl(linkUrl) : linkUrl);
                if (alreadyCrawledHashes.has(urlHash)) {
                    duplicateCount++;
                    continue;
                }
                
                // Add to queue
                this.crawlQueue.add(linkUrl);
                addedCount++;
                
                // Track new URLs added
                if (newUrls.includes(linkUrl)) {
                    newUrlsAdded++;
                }
                
            } catch (error) {
                logger.warn('Error processing link for queue', { link, error: error.message });
                skippedCount++;
            }
        }
        
        if (addedCount > 0 || duplicateCount > 0) {
            logger.debug('Links processed for crawl queue (with new URL prioritization)', {
                total: links.length,
                newUrlsFound: newUrls.length,
                newUrlsAdded: newUrlsAdded,
                added: addedCount,
                skipped: skippedCount,
                duplicates: duplicateCount,
                queueSize: this.crawlQueue.size
            });
        }
    }

    /**
     * Get next URL from crawl queue
     */
    getNextUrl() {
        if (this.crawlQueue.size === 0) {
            return null;
        }
        
        const nextUrl = this.crawlQueue.values().next().value;
        this.crawlQueue.delete(nextUrl);
        return nextUrl;
    }

    /**
     * Check if there are more URLs to crawl
     */
    hasMoreUrls() {
        return this.crawlQueue.size > 0;
    }

    /**
     * Process the entire crawl queue - crawl all extracted links with smart crawling features
     */
    async processQueue(maxPages = 250, maxDepth = 3) {
        try {
            // Check existing URLs in database before starting
        let existingUrlCount = 0;
        let remainingPagesToCrawl = maxPages;
        
            const siteId = this.smartStats.siteId || this.db_row?.site_id;
            
            if (siteId) {
            try {
                    existingUrlCount = await this.getExistingUrlCount(siteId);
                remainingPagesToCrawl = Math.max(0, maxPages - existingUrlCount);
                
                    logger.info('Smart crawler pre-crawl database check', {
                        siteId: siteId,
                    existingUrlsInDb: existingUrlCount,
                    maxPagesLimit: maxPages,
                    remainingPagesToCrawl: remainingPagesToCrawl,
                    efficiency: `${((existingUrlCount / (existingUrlCount + remainingPagesToCrawl)) * 100).toFixed(1)}% existing`
                });
                
                // If we already have enough URLs in database, skip crawling (unless forceCrawl is enabled)
                if (remainingPagesToCrawl <= 0 && !this.options.forceCrawl) {
                        logger.info('Smart crawler: Site already has sufficient URLs in database, skipping crawl', {
                            siteId: siteId,
                        existingUrls: existingUrlCount,
                        maxPages: maxPages
                    });
                        return [];
                } else if (remainingPagesToCrawl <= 0 && this.options.forceCrawl) {
                        // Ensure we still have a positive budget to process
                        remainingPagesToCrawl = maxPages; // use full budget when forcing crawl
                        logger.info('Smart crawler: Force crawl enabled, proceeding despite sufficient URLs in database', {
                            siteId: siteId,
                        existingUrls: existingUrlCount,
                        maxPages: maxPages,
                        assignedBudget: remainingPagesToCrawl
                    });
                }
            } catch (error) {
                    logger.warn('Smart crawler: Failed to check existing URLs, proceeding with full crawl', {
                        siteId: siteId,
                    error: error.message
                });
                remainingPagesToCrawl = maxPages;
            }
        }
        
            logger.info('Starting smart queue processing with database optimization', {
                siteId: siteId,
            maxPages: remainingPagesToCrawl,
            maxDepth,
                queueSize: this.crawlQueue.size,
            existingUrlsInDb: existingUrlCount
        });
            
            const results = [];
            let currentDepth = 0;
            let duplicatesSkipped = 0;
            let uniquePagesCrawled = 0;
            let httpRequestsMade = 0;
        
        while (this.hasMoreUrls() && uniquePagesCrawled < remainingPagesToCrawl && currentDepth < maxDepth) {
            const batchSize = Math.min(10, this.crawlQueue.size);
            const currentBatch = [];
            
            // Get URLs from queue
            for (let i = 0; i < batchSize && this.hasMoreUrls(); i++) {
                const url = this.getNextUrl();
                if (url && !this.crawledUrls.has(url)) {
                    currentBatch.push(url);
                }
            }
            
            if (currentBatch.length === 0) {
                break; // No more valid URLs to process
            }
            
                logger.debug('Processing queue batch with smart crawling', { 
                depth: currentDepth,
                batchSize: currentBatch.length,
                queueSize: this.crawlQueue.size,
                uniquePagesCrawled,
                duplicatesSkipped,
                httpRequestsMade
            });
            
            // Process batch concurrently
            const batchPromises = currentBatch.map(async (url) => {
                try {
                    const result = await this.crawlPage(url);
                    
                    if (result) {
                        if (result.isDuplicate) {
                            duplicatesSkipped++;
                        } else {
                            uniquePagesCrawled++;
                            httpRequestsMade++;
                        }
                        
                            // Add newly extracted links to queue with smart filtering
                        if (result.extractedLinks) {
                                if (this.siteAwareDuplicateChecker && this.smartStats.siteId) {
                                    await this.addLinksToQueueSmart(result.extractedLinks, this.smartStats.siteId);
                                } else {
                                    await this.addLinksToQueue(result.extractedLinks, siteId);
                                }
                        }
                    }
                    
                    return result;
                } catch (error) {
                    logger.error('Error processing URL in queue', { url, error: error.message });
                    return { success: false, url, error: error.message };
                }
            });
            
            const batchResults = await Promise.allSettled(batchPromises);
            
            // Collect successful results
            batchResults.forEach((result, index) => {
                if (result.status === 'fulfilled' && result.value) {
                    results.push(result.value);
                } else if (result.status === 'rejected') {
                    logger.error('Batch promise rejected', { 
                        url: currentBatch[index], 
                        error: result.reason 
                    });
                }
            });
            
            // Add delay between batches to be respectful
            if (this.hasMoreUrls() && uniquePagesCrawled < remainingPagesToCrawl) {
                await this.delay(1000); // 1 second between batches
            }
            
            currentDepth++;
            
            logger.info('Queue batch completed', { 
                depth: currentDepth - 1,
                batchProcessed: batchResults.length,
                queueRemaining: this.crawlQueue.size,
                uniquePagesCrawled,
                duplicatesSkipped,
                httpRequestsMade,
                efficiency: `${((uniquePagesCrawled / (uniquePagesCrawled + duplicatesSkipped)) * 100).toFixed(1)}%`
            });
        }
            
            // Update end time for smart stats
            this.smartStats.crawlEndTime = Date.now();
            
            // Update smart stats with database optimization info
            this.smartStats.existingUrlsInDb = existingUrlCount;
            this.smartStats.totalUrlsForSite = existingUrlCount + (results?.length || 0);
        
        const totalUrlsForSite = existingUrlCount + uniquePagesCrawled;
        
            // Log final smart statistics
            this.logSmartCrawlResults();
            
            logger.info('Smart queue processing completed', {
            totalResults: results.length,
            uniquePagesCrawled,
            duplicatesSkipped,
            httpRequestsMade,
            maxDepthReached: currentDepth,
            finalQueueSize: this.crawlQueue.size,
            existingUrlsInDb: existingUrlCount,
            totalUrlsForSite: totalUrlsForSite,
            efficiency: `${((uniquePagesCrawled / (uniquePagesCrawled + duplicatesSkipped)) * 100).toFixed(1)}%`,
            resourceSavings: `Saved ${duplicatesSkipped} unnecessary HTTP requests`,
            databaseOptimization: `Found ${existingUrlCount} existing URLs, crawled ${uniquePagesCrawled} new URLs (Total: ${totalUrlsForSite})`
        });
        
        return results;
            
        } catch (error) {
            logger.error('Error in smart queue processing', {
                siteId: this.smartStats.siteId,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Properly encode URL to handle Unicode characters
     */
    encodeUrl(url) {
        try {
            const urlObj = new URL(url);
            
            // Encode the pathname to handle Unicode characters
            urlObj.pathname = encodeURI(urlObj.pathname);
            
            return urlObj.toString();
        } catch (error) {
            logger.warn('Error encoding URL, using original', { url, error: error.message });
            return url;
        }
    }

    /**
     * Properly decompress gzipped/deflated content
     */
    async decompressContent(body, headers) {
        try {
            const contentEncoding = headers['content-encoding'];
            
            if (!contentEncoding) {
                // No compression, return Buffer
                return Buffer.isBuffer(body) ? body : Buffer.from(body);
            }
            
            // Convert body to Buffer if it's not already
            const bodyBuffer = Buffer.isBuffer(body) ? body : Buffer.from(body);
            
            if (contentEncoding.includes('gzip')) {
                logger.debug('Decompressing gzip content');
                const decompressed = await new Promise((resolve, reject) => {
                    zlib.gunzip(bodyBuffer, (err, result) => {
                        if (err) reject(err);
                        else resolve(result);
                    });
                });
                return decompressed;
            } else if (contentEncoding.includes('deflate')) {
                logger.debug('Decompressing deflate content');
                const decompressed = await new Promise((resolve, reject) => {
                    zlib.inflate(bodyBuffer, (err, result) => {
                        if (err) reject(err);
                        else resolve(result);
                    });
                });
                return decompressed;
            } else if (contentEncoding.includes('br')) {
                logger.debug('Decompressing brotli content');
                const decompressed = await new Promise((resolve, reject) => {
                    zlib.brotliDecompress(bodyBuffer, (err, result) => {
                        if (err) reject(err);
                        else resolve(result);
                    });
                });
                return decompressed;
            } else {
                // Unknown compression, try as-is
                logger.warn('Unknown content encoding, treating as uncompressed', { contentEncoding });
                return Buffer.isBuffer(body) ? body : Buffer.from(body);
            }
        } catch (error) {
            logger.error('Error decompressing content', { error: error.message });
            // Fallback to original content as Buffer
            return Buffer.isBuffer(body) ? body : Buffer.from(body);
        }
    }

    /**
     * Detect charset from headers or meta tags. Defaults to utf-8.
     */
    detectCharset(headers = {}, buffer = Buffer.alloc(0)) {
        try {
            const headerCt = headers['content-type'] || '';
            const headerMatch = headerCt.match(/charset=([^;\s]+)/i);
            if (headerMatch) {
                return headerMatch[1].toLowerCase();
            }
            const head = buffer.toString('ascii', 0, Math.min(buffer.length, 4096));
            const metaMatch = head.match(/<meta[^>]+charset=["']?([^"'>\s]+)/i) ||
                              head.match(/<meta[^>]+content=["'][^"']*;\s*charset=([^"'>\s]+)/i);
            if (metaMatch) {
                return metaMatch[1].toLowerCase();
            }
        } catch (_) {}
        return 'utf-8';
    }

    /**
     * Decode buffer to string using detected charset. Fallbacks to utf8, then latin1.
     */
    decodeContent(buffer, charset = 'utf-8') {
        try {
            const cs = (charset || 'utf-8').toLowerCase();
            if (cs.includes('utf')) return buffer.toString('utf8');
            if (cs.includes('1252') || cs.includes('windows-1252') || cs.includes('latin1') || cs.includes('iso-8859-1')) {
                return buffer.toString('latin1');
            }
            return buffer.toString('utf8');
        } catch (e) {
            try { return buffer.toString('utf8'); } catch (_) {}
            try { return buffer.toString('latin1'); } catch (_) {}
            return buffer.toString();
        }
    }

    async performCrawl(url) {
        const encodedUrl = this.encodeUrl(url);
        const domain = this.getDomainInfo(url)?.hostname;
        let attempt = 0;
        let lastError = null;

        // Check circuit breaker before attempting request

        while (attempt < 3) { // Default max retries
            attempt++;
            const requestStartTime = Date.now();

            try {
                // Acquire connection from pool with domain awareness
                await systemConnectionManager.acquire(domain);
                
                const result = await this.executeHttpRequest(encodedUrl, url, domain, requestStartTime);

                return result;

            } catch (error) {
                lastError = error;
                const responseTime = Date.now() - requestStartTime;
                
                // Extract status code from error message if available
                let statusCode = null;
                const httpStatusMatch = error.message.match(/HTTP (\d{3})/);
                if (httpStatusMatch) {
                    statusCode = parseInt(httpStatusMatch[1]);
                }

                // Use ErrorHandler to determine retry strategy
                const errorContext = {
                    siteId: this.smartStats.siteId,
                    url: url,
                    domain: domain,
                    attempt: attempt,
                    statusCode: statusCode,
                    responseTime: responseTime
                };

                const errorResult = await this.errorHandler.handleError(error, errorContext);

                if (errorResult.shouldStop) {
                    // Increment failed URL counter for stats
                    if (this.smartStats) {
                        this.smartStats.failedUrls = (this.smartStats.failedUrls || 0) + 1;
                    }
                    
                    logger.error('Error threshold exceeded, stopping crawl', {
                        url,
                        error: error.message,
                        siteId: this.smartStats.siteId
                    });
                    
                    throw error;
                }

                if (!errorResult.shouldRetry || attempt >= 3) {
                    // Increment failed URL counter for stats
                    if (this.smartStats) {
                        this.smartStats.failedUrls = (this.smartStats.failedUrls || 0) + 1;
                    }
                    
                    logger.warn('Max retries exceeded or non-retryable error', {
                        url,
                        error: error.message,
                        attempt,
                        maxRetries: 3,
                        shouldRetry: errorResult.shouldRetry
                    });
                    
                    throw error;
                }

                // Wait before retry using ErrorHandler delay
                if (errorResult.retryDelay > 0) {
                    logger.debug('Waiting before retry', {
                        url,
                        attempt,
                        delay: errorResult.retryDelay
                    });
                    await this.delay(errorResult.retryDelay);
                }

                logger.info('Retrying request with ErrorHandler strategy', {
                    url,
                    attempt,
                    maxRetries: 3,
                    retryDelay: errorResult.retryDelay
                });
            }
        }

        // If we get here, all retries have been exhausted
        throw lastError;
    }

    async executeHttpRequest(encodedUrl, originalUrl, domain, startTime) {
        return new Promise((resolve, reject) => {
                    // Add timeout to prevent hanging requests
                    const requestTimeoutId = setTimeout(() => {
                logger.warn('Request timeout, force closing', { 
                    url: originalUrl, 
                    timeout: this.options.requestTimeout 
                });
                        systemConnectionManager.release(domain);
                        reject(new Error('Request timeout'));
                    }, (this.options.requestTimeout || 15000) + 5000);
                    
                    const crawler = new Crawler({
                        maxConnections: 1,    // EXTREMELY conservative - only 1 connection
                        rateLimit: 5000,      // 5 second delay between requests
                        timeout: 10000,       // Reduced to 10 seconds
                        retries: 0,           // No retries - we handle manually
                        retryTimeout: 0,      // No retry delay
                        userAgent: this.options.userAgent,
                        proxy: this.options.proxy,
                        headers: {
                            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                            'Accept-Language': 'en-US,en;q=0.5',
                            'Accept-Encoding': 'gzip, deflate',
                            'Connection': 'close', // Force connection close to prevent buildup
                            'Cache-Control': 'no-cache',
                            ...stealthHeaders
                        },
                        // Force use of our custom agents to respect system limits
                agentClass: originalUrl.startsWith('https:') ? https.Agent : http.Agent,
                agentOptions: originalUrl.startsWith('https:') ? {
                            keepAlive: false,  // No keep-alive
                            maxSockets: 1,     // Only 1 socket
                            timeout: 10000,
                            rejectUnauthorized: false
                        } : {
                            keepAlive: false,  // No keep-alive  
                            maxSockets: 1,     // Only 1 socket
                            timeout: 10000
                        },
                        // Minimal settings to prevent connection buildup
                        jQuery: false,        // Don't load jQuery to save memory
                        gzip: false,         // Disable automatic gzip (we handle manually)
                        encoding: null,      // Get raw buffer for manual processing
                        maxRedirects: 3,     // Limit redirects
                        rejectUnauthorized: false,  // Accept self-signed certificates
                        strictSSL: false,           // Disable strict SSL
                        forever: false,             // No persistent connections
                        pool: false,               // No connection pooling
                        keepAlive: false,          // No keep-alive
                        // Follow redirects, but some domains like nature.com loop on cookie pages
                        followRedirect: true,      // Follow redirects
                        followAllRedirects: false, // Don't follow all redirects
                        callback: async (error, res, done) => {
                            try {
                                const loadTime = Date.now() - startTime;
                                
                                if (error) {
                            // Enhanced error classification for different error types
                            this.logEnhancedError(error, originalUrl, domain, loadTime);
                            done();
                            clearTimeout(requestTimeoutId);
                            systemConnectionManager.release(domain);
                            reject(error);
                            return;
                        }

                        if (!res) {
                            const noResponseError = new Error('No response received');
                            logger.error('No response received', { url: originalUrl, loadTime });
                            done();
                            clearTimeout(requestTimeoutId);
                            systemConnectionManager.release(domain);
                            reject(noResponseError);
                            return;
                        }

                        // Handle known redirect-loop and auth domains
                        const reqHref = res?.request?.uri?.href || originalUrl;
                        if (/nature\.com\/.*cookies_not_supported/i.test(reqHref) || /idp\.springernature\.com\/auth/i.test(reqHref) || /users\/auth\/springer_nature/i.test(reqHref)) {
                            done();
                            clearTimeout(requestTimeoutId);
                            systemConnectionManager.release(domain);
                            reject(new Error('Redirect loop due to cookie wall'));
                            return;
                        }

                        if (res.statusCode !== 200) {
                            const statusCode = res.statusCode;
                            const statusError = new Error(`HTTP ${statusCode}: ${res.statusMessage}`);
                            
                            // Enhanced status code handling
                            this.handleHttpStatusCode(statusCode, originalUrl, res.statusMessage, loadTime);
                            
                            done();
                            clearTimeout(requestTimeoutId);
                            systemConnectionManager.release(domain);
                            reject(statusError);
                            return;
                        }

                        // Successful response processing
                        const result = await this.processSuccessfulResponse(res, originalUrl, loadTime);
                        
                        done();
                        clearTimeout(requestTimeoutId);
                        systemConnectionManager.release(domain);
                        resolve(result);
                        
                    } catch (processingError) {
                        logger.error('Error processing crawled content', { 
                            url: originalUrl, 
                            error: processingError.message,
                            stack: processingError.stack,
                            loadTime: Date.now() - startTime
                        });
                        done();
                        clearTimeout(requestTimeoutId);
                        systemConnectionManager.release(domain);
                        reject(processingError);
                    }
                }
            });

            // Add timeout handling with grace period
            const timeoutId = setTimeout(() => {
                logger.error('Crawler timeout exceeded', { 
                    url: originalUrl, 
                    timeout: this.options.timeout,
                    actualTime: Date.now() - startTime
                });
                
                // Clean up crawler resources properly
                try {
                    if (crawler && crawler.queue) {
                        crawler.queue = [];
                    }
                    if (crawler && typeof crawler.stop === 'function') {
                        crawler.stop();
                    }
                } catch (cleanupError) {
                    logger.warn('Error during crawler cleanup', { 
                        url: originalUrl, 
                        error: cleanupError.message 
                    });
                }
                
                reject(new Error(`Crawler timeout after ${this.options.timeout}ms`));
            }, this.options.timeout + 2000);

            crawler.queue({
                uri: encodedUrl,
                timeout: this.options.requestTimeout || 15000,
                retries: 0,
                rateLimits: 0
            });
            
            crawler.on('drain', () => {
                clearTimeout(timeoutId);
            });
        });
    }

    logEnhancedError(error, url, domain, loadTime) {
        // Simple error classification for logging
        if (error.code === 'ENOTFOUND' || error.code === 'ENODATA') {
            logger.debug('DNS resolution failed (domain not found)', { 
                url, 
                domain,
                loadTime,
                errorCode: error.code
            });
        } else if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
            logger.debug('Request timeout (slow server)', { 
                url, 
                loadTime,
                timeout: this.options.requestTimeout,
                errorCode: error.code
            });
        } else if (error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET') {
            logger.debug('Connection error', { 
                url, 
                loadTime,
                errorCode: error.code
            });
        } else {
            logger.error('Crawler HTTP error', { 
                url, 
                error: error.message,
                code: error.code,
                loadTime
            });
        }
    }

    handleHttpStatusCode(statusCode, url, statusMessage, loadTime) {
        // Simple status code classification
        if ([403, 429, 503].includes(statusCode)) {
            logger.info('Website blocking crawler (expected behavior)', { 
                url, 
                statusCode,
                statusMessage
            });
        } else if (statusCode === 404) {
            logger.debug('Page not found (404)', { 
                url, 
                statusCode
            });
        } else if (statusCode === 405) {
            logger.debug('Method not allowed (405) - likely API endpoint', { 
                url, 
                statusCode,
                hint: 'Skipping non-crawlable endpoint'
            });
        } else if ([502, 503].includes(statusCode)) {
            logger.debug('Server temporarily unavailable', { 
                url, 
                statusCode
            });
        } else if (statusCode === 500) {
            logger.debug('Internal server error (500)', { 
                url, 
                statusCode
            });
        } else {
            logger.warn('Non-200 response', { 
                url, 
                statusCode,
                statusMessage
            });
        }
    }

    async processSuccessfulResponse(res, url, loadTime) {
                                const contentType = res.headers['content-type'] || '';
                                const contentLength = res.body ? res.body.length : 0;
                                
                                // Capture response metadata
                                const responseMetadata = {
                                    statusCode: res.statusCode,
                                    loadTime: loadTime,
                                    redirectUrl: res.request && res.request.uri && res.request.uri.href !== url ? res.request.uri.href : null,
                                    contentType: contentType,
                                    contentLength: contentLength
                                };
                                
                                logger.info('HTTP request successful', { 
                                    url, 
                                    contentType, 
                                    contentLength,
                                    statusCode: res.statusCode,
                                    loadTime: loadTime
                                });

                                // Process based on content type
                                let result;
                
                // Skip CSS and JavaScript files explicitly to prevent data corruption
                if (contentType.includes('text/css') || contentType.includes('application/javascript') || contentType.includes('text/javascript')) {
                    logger.info('Skipping CSS/JS file to prevent data corruption', { url, contentType });
                    return null;
                }
                
                if (contentType.includes('text/html')) {
                    const decompressedBuffer = await this.decompressContent(res.body, res.headers);
                    const charset = this.detectCharset(res.headers, decompressedBuffer);
                    const decodedHtml = this.decodeContent(decompressedBuffer, charset);
                    
                    // Check for CAPTCHA challenges before processing
                    if (this.isCaptchaChallenge(decodedHtml, url)) {
                        logger.warn('CAPTCHA challenge detected, skipping page', { url, contentType });
                        return null;
                    }
                    
                                    logger.info('Routing content to table', { url, contentType, targetTable: 'site_data' });
                                    logger.debug('Processing HTML content', { url });
                    result = await htmlHandler.process(decodedHtml, url, this, responseMetadata);
                                    logger.debug('HTML processing completed', { url, hasResult: !!result });
                                } else if (contentType.includes('application/json')) {
                                    logger.info('Routing content to table', { url, contentType, targetTable: 'site_data' });
                                    logger.debug('Processing JSON content', { url });
                                    try {
                        const decompressedBuffer = await this.decompressContent(res.body, res.headers);
                        let jsonText = decompressedBuffer.toString('utf8');
                        let jsonData;
                        try { jsonData = JSON.parse(jsonText); }
                        catch (_) { jsonText = decompressedBuffer.toString('latin1'); jsonData = JSON.parse(jsonText); }
                                        result = {
                                            parsedData: {
                                                title: jsonData.title || jsonData.name || `JSON Data from ${url}`,
                                                description: jsonData.description || jsonData.summary || 'JSON API Response',
                                                content: JSON.stringify(jsonData, null, 2),
                                                article: JSON.stringify(jsonData, null, 2),
                                                keywords: jsonData.keywords || jsonData.tags || [],
                                                author: jsonData.author || '',
                                                publishedTime: jsonData.publishedTime || jsonData.created_at || null,
                                                modifiedTime: jsonData.modifiedTime || jsonData.updated_at || null,
                                                language: jsonData.language || null,
                                                canonical: url,
                                                images: [],
                                                links: [],
                                                headings: { h1: '', h2: '', h3: '', h4: '' }
                                            },
                                            responseMetadata
                                        };
                                    } catch (jsonError) {
                                        logger.debug('Skipping invalid JSON content', { url, error: jsonError.message });
                                        result = null;
                                    }
                                    logger.debug('JSON processing completed', { url, hasResult: !!result });
                                } else if (contentType.includes('application/pdf') ||
                                          contentType.includes('application/msword') ||
                                          contentType.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document') ||
                                          contentType.includes('application/vnd.ms-excel') ||
                                          contentType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') ||
                                          contentType.includes('application/vnd.ms-powerpoint') ||
                                          contentType.includes('application/vnd.openxmlformats-officedocument.presentationml.presentation') ||
                                          contentType.includes('text/plain') ||
                                          contentType.includes('text/csv') ||
                                          contentType.includes('text/css') ||
                                          contentType.includes('application/rtf') ||
                                          contentType.includes('application/vnd.oasis.opendocument.text') ||
                                          contentType.includes('application/vnd.oasis.opendocument.spreadsheet') ||
                                          contentType.includes('application/vnd.oasis.opendocument.presentation')) {
                                    logger.info('Routing content to table', { url, contentType, targetTable: 'site_doc' });
                                    logger.debug('Processing document content', { url, contentType });
                                    result = await documentHandler.process(res.body, url, this, responseMetadata);
                                } else if (contentType.includes('image/')) {
                                    logger.info('Routing content to table', { url, contentType, targetTable: 'site_img' });
                                    logger.debug('Processing image content', { url });
                                    result = await imageHandler.process(res.body, url, this, responseMetadata);
                                } else {
                                    logger.warn('Unsupported content type', { url, contentType });
                                    result = null;
                                }

                                logger.info('Content processing completed', { 
                                    url, 
                                    hasResult: !!result,
                                    resultType: result ? typeof result : 'null'
                                });

        return result;
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Utility method to sanitize URLs
    sanitizeUrl(url) {
        try {
            const urlObj = new URL(url);
            // Remove fragments and normalize
            urlObj.hash = '';
            return urlObj.toString();
        } catch (error) {
            logger.error('Error sanitizing URL', { url, error: error.message });
            return url;
        }
    }

    // Method to get domain information
    getDomainInfo(url) {
        try {
            const urlObj = new URL(url);
            return {
                hostname: urlObj.hostname,
                protocol: urlObj.protocol,
                port: urlObj.port || (urlObj.protocol === 'https:' ? '443' : '80'),
                domain: urlObj.hostname.replace(/^www\./, '')
            };
        } catch (error) {
            logger.error('Error parsing domain info', { url, error: error.message });
            return null;
        }
    }

    /**
     * Generate site Title from URL and normalize URL (same logic as addsite.js)
     */
    generateSiteInfo(url) {
        let domain, normalizedUrl, title;
        
        try {
            // Add protocol if missing
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                url = 'https://' + url;
            }
            
            const parsedUrl = new URL(url);
            domain = parsedUrl.hostname.replace('www.', ''); // Remove 'www.' prefix if present
            normalizedUrl = parsedUrl.href;
            
            // Generate a nice title from domain (same as addsite.js)
            title = domain.split('.')[0];
            title = title.charAt(0).toUpperCase() + title.slice(1);
            
        } catch (error) {
            // If URL parsing fails, assume it's a domain without a scheme
            domain = url.replace('www.', '').replace(/^https?:\/\//, '');
            normalizedUrl = 'https://' + domain;
            title = domain.split('.')[0];
            title = title.charAt(0).toUpperCase() + title.slice(1);
        }
        
        return { domain, url: normalizedUrl, title };
    }    

    /**
     * Get comprehensive error statistics from all error handling components
     */
    getErrorStats() {
        return {
            errorHandler: this.errorHandler.getErrorStats(),
            summary: {
                timestamp: new Date().toISOString()
            }
        };
    }

    /**
     * Get domain-specific error report
     */
    getDomainErrorReport(domain) {
        return {
            domain: domain
        };
    }

    /**
     * Generate comprehensive HTTP error report
     */
    async generateHttpErrorReport() {
        return {
            enhancedErrorHandling: {
                recommendations: []
            }
        };
    }

    /**
     * Generate enhanced recommendations based on error patterns
     */
    generateEnhancedRecommendations(errorStats, circuitBreakerStatus) {
        const recommendations = [];
        return recommendations;
    }

    /**
     * Reset all error handling components
     */
    resetErrorHandling() {
        this.errorHandler.resetErrorCounts();
        logger.info('All error handling components reset', {
            service: 'CrawlerCore'
        });
    }

    /**
     * Force open circuit breaker for a domain (for testing or emergency)
     */
    forceOpenCircuitBreaker(domain) {
        logger.warn('Circuit breaker forced open', {
            service: 'CrawlerCore',
            domain
        });
    }

    /**
     * Force close circuit breaker for a domain
     */
    forceCloseCircuitBreaker(domain) {
        logger.info('Circuit breaker forced closed', {
            service: 'CrawlerCore',
            domain
        });
    }

    /**
     * Log comprehensive smart crawl results
     */
    logSmartCrawlResults() {
        const totalTime = this.smartStats.crawlEndTime - this.smartStats.crawlStartTime;
        const siteStats = this.siteAwareDuplicateChecker ? this.siteAwareDuplicateChecker.getSiteStats(this.smartStats.siteId) : null;
        
        logger.info('Smart crawl completed - Final Results', {
            siteId: this.smartStats.siteId,
            siteUrl: this.smartStats.siteUrl,
            performance: {
                totalTime: Math.round(totalTime / 1000) + 's',
                initializationTime: this.smartStats.initializationTime + 'ms',
                crawlEfficiency: this.smartStats.crawlEfficiency + '%'
            },
            urls: {
                totalDiscovered: this.smartStats.totalUrlsDiscovered,
                newUrlsFound: this.smartStats.newUrlsFound,
                duplicatesSkipped: this.smartStats.duplicatesSkipped,
                httpRequestsSaved: this.smartStats.httpRequestsSaved
            },
            database: {
                indexedToDatabase: this.smartStats.indexedToDatabase,
                indexingErrors: this.smartStats.indexingErrors,
                totalCrawledUrls: siteStats ? siteStats.totalCrawledUrls : 'unknown',
                cacheSize: siteStats ? siteStats.cacheSize : 'unknown'
            },
            optimization: {
                existingUrlsInDb: this.smartStats.existingUrlsInDb || 0,
                totalUrlsForSite: this.smartStats.totalUrlsForSite || 0,
                resourceOptimization: `Found ${this.smartStats.existingUrlsInDb || 0} existing URLs, crawled ${this.smartStats.newUrlsFound || 0} new URLs`
            }
        });
    }
    
    /**
     * Get smart crawling statistics
     */
    getSmartStats() {
        return {
            ...this.smartStats,
            siteStats: this.siteAwareDuplicateChecker ? this.siteAwareDuplicateChecker.getSiteStats(this.smartStats.siteId) : null,
            globalStats: this.siteAwareDuplicateChecker ? this.siteAwareDuplicateChecker.getGlobalStats() : null,
            indexingSuccess: this.smartStats.indexedToDatabase,
            indexingFailures: this.smartStats.indexingErrors
        };
    }
    
    /**
     * Extract internal links from parsed data - Enhanced version with smart filtering
     */
    async extractInternalLinks(parsedData, baseUrl) {
        const internalLinks = [];
        
        try {
            const baseUrlObj = new URL(baseUrl);
            const baseDomain = baseUrlObj.hostname;
            const linkSet = new Set(); // Prevent duplicates
            
            logger.debug('Extracting crawlable internal links', { baseUrl: baseUrl, baseDomain });
            
            // Extract links from various sources in parsed data
            if (parsedData.links && Array.isArray(parsedData.links)) {
                for (const linkObj of parsedData.links) {
                    try {
                        let linkUrl = linkObj.url || linkObj.href || linkObj;
                        
                        // Skip empty or invalid links
                        if (!linkUrl || typeof linkUrl !== 'string') continue;
                        
                        // Convert relative URLs to absolute
                        if (linkUrl.startsWith('/')) {
                            linkUrl = `${baseUrlObj.protocol}//${baseUrlObj.host}${linkUrl}`;
                        } else if (linkUrl.startsWith('./') || (!linkUrl.includes('://') && !linkUrl.startsWith('#'))) {
                            try {
                                linkUrl = new URL(linkUrl, baseUrl).href;
                            } catch (relativeError) {
                                continue; // Skip malformed relative URLs
                            }
                        }
                        
                        // Skip anchor links and javascript
                        if (linkUrl.startsWith('#') || linkUrl.startsWith('javascript:') || linkUrl.startsWith('mailto:')) {
                            continue;
                        }
                        
                        // Parse the link URL
                        const linkUrlObj = new URL(linkUrl);
                        
                        // Only include internal links (same domain or subdomain)
                        const isInternal = (
                            linkUrlObj.hostname === baseDomain || 
                            linkUrlObj.hostname === `www.${baseDomain}` || 
                            baseDomain === `www.${linkUrlObj.hostname}` ||
                            linkUrlObj.hostname.endsWith(`.${baseDomain}`)
                        );
                        
                        if (isInternal && !this.shouldSkipUrl(linkUrl) && !linkSet.has(linkUrl)) {
                            linkSet.add(linkUrl);
                            internalLinks.push(linkUrl);
                        }
                    } catch (linkError) {
                        logger.debug('Error processing individual link', { 
                            link: linkObj, 
                            error: linkError.message 
                        });
                        continue;
                    }
                }
            }
            
            // Limit the number of links to prevent overwhelming the crawler
            const maxLinksPerPage = this.options.maxLinksPerPage || 500;
            const limitedLinks = internalLinks.slice(0, maxLinksPerPage);
            
            logger.debug('Crawlable links extracted', { 
                baseUrl: baseUrl,
                totalLinks: parsedData.links ? parsedData.links.length : 0,
                crawlableLinks: limitedLinks.length
            });
            
            // If smart crawling is available, filter links immediately
            if (this.siteAwareDuplicateChecker && this.smartStats.siteId) {
                const filteredLinks = await this.addLinksToQueueSmart(limitedLinks, this.smartStats.siteId);
                return filteredLinks;
            }
            
            return limitedLinks;
        } catch (error) {
            logger.error('Error extracting internal links', { baseUrl, error: error.message });
            return [];
        }
    }

    /**
     * Detect CAPTCHA challenges in HTML content
     * @param {string} html - The HTML content to check
     * @param {string} url - The URL being crawled
     * @returns {boolean} - True if CAPTCHA challenge is detected
     */
    isCaptchaChallenge(html, url) {
        try {
            // Common CAPTCHA indicators
            const captchaPatterns = [
                /what code is in the image/i,
                /captcha/i,
                /prove you are human/i,
                /automated spam submission/i,
                /support id.*\d{19}/i,  // RBI support ID pattern
                /data:;base64,iVBORw0KGgo=/i,  // RBI CAPTCHA image pattern
                /audio is not supported in your browser/i,
                /testing whether you are a human visitor/i
            ];

            // Check if any CAPTCHA pattern matches
            const hasCaptchaPattern = captchaPatterns.some(pattern => pattern.test(html));
            
            if (hasCaptchaPattern) {
                logger.debug('CAPTCHA challenge detected', { 
                    url, 
                    patterns: captchaPatterns.filter(pattern => pattern.test(html)).map(p => p.source)
                });
                return true;
            }

            // Additional check: if content is very short and contains suspicious elements
            if (html.length < 1000 && (
                html.includes('support ID') || 
                html.includes('What code is in the image') ||
                html.includes('data:;base64,iVBORw0KGgo=')
            )) {
                logger.debug('Short content with CAPTCHA indicators detected', { url, contentLength: html.length });
                return true;
            }

            return false;
        } catch (error) {
            logger.error('Error detecting CAPTCHA challenge', { url, error: error.message });
            return false; // Default to not blocking on error
        }
    }

    /**
     * Check if a site is known to have CAPTCHA protection
     * @param {string} url - The URL to check
     * @returns {boolean} - True if site is known to have CAPTCHA protection
     */
    isCaptchaProtectedSite(url) {
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname.toLowerCase();
            
            // Known CAPTCHA-protected sites
            const captchaProtectedSites = [
                'rbi.org.in',
                'gov.in',
                'nic.in'
            ];
            
            return captchaProtectedSites.some(site => hostname.includes(site));
        } catch (error) {
            logger.error('Error checking CAPTCHA protected site', { url, error: error.message });
            return false;
        }
    }

    /**
     * Perform crawl with a different user agent to bypass CAPTCHA
     * @param {string} url - The URL to crawl
     * @returns {Promise} - The crawl result
     */
    async performCrawlWithDifferentUserAgent(url) {
        try {
            // Store original user agent
            const originalUserAgent = this.userAgent;
            
            // Use a different user agent that looks more like a real browser
            const alternativeUserAgents = [
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            ];
            
            // Select a random alternative user agent
            this.userAgent = alternativeUserAgents[Math.floor(Math.random() * alternativeUserAgents.length)];
            
            logger.debug('Retrying with different user agent', { 
                url, 
                originalUserAgent, 
                newUserAgent: this.userAgent 
            });
            
            // Perform crawl with new user agent
            const result = await this.performCrawl(url);
            
            // Restore original user agent
            this.userAgent = originalUserAgent;
            
            return result;
        } catch (error) {
            logger.error('Error in performCrawlWithDifferentUserAgent', { url, error: error.message });
            // Restore original user agent on error
            this.userAgent = originalUserAgent;
            return null;
        }
    }
}

module.exports = { CrawlerCore }; 