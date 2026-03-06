const CrawlerLib = require('crawler');
const dns = require('dns');
const { robotsParser } = require('robots-parser');
const request = require('request');

const crawlerConfig = require('../config/crawlerConfig');
const proxyManager = require('../config/proxies');
const headers = require('../config/headers');
const { db } = require('../config/db');
const logger = require('../utils/logger');
const UrlValidator = require('../utils/urlValidator');
const ContentTypeHandler = require('../handlers/contentTypeHandler');
const DataHandler = require('../handlers/dataHandler');
const Parser = require('../core/parser');
const Indexer = require('../core/indexer');
const ImageHandler = require('../handlers/imageHandler');
const DocumentHandler = require('../handlers/documentHandler');

require('dotenv').config();

if (process.env.DNS_SERVERS) {
    dns.setServers(process.env.DNS_SERVERS.split(','));
}

const DEFAULT_MAX_PAGES = 2000;
const RECRAWL_SAMPLE_SIZE = 100; // how many existing pages to re-check for content change
const POLITENESS_DELAY_MS = 2000;

/**
 * Smart incremental web crawler.
 * - First crawl: BFS up to max_pages (default 2000) per site.
 * - Subsequent crawls: only new URLs + optional sample of existing for content change.
 * - Avoids re-crawling same URLs; uses DB + in-memory visited set.
 */
class Crawler {
    constructor(siteRow) {
        this.siteRow = siteRow;
        this.siteId = siteRow.site_id;
        this.url = siteRow.site_url;
        this.domain = UrlValidator.getDomain(this.url);
        this.rootDomain = UrlValidator.getRootDomain(this.domain);
        this.maxPages = Math.min(Number(siteRow.max_pages) || DEFAULT_MAX_PAGES, DEFAULT_MAX_PAGES);
        this.crawler = null;
        this.dataHandler = new DataHandler(this.siteId);
        this.indexer = new Indexer(this.siteId);
        this.discoveredSubdomains = new Set();
        // Incremental: known pages from DB (url_hash -> { status, content_hash })
        this.existingPagesMap = new Map();
        // Visited this run (url_hash) – do not queue again
        this.visitedUrlHashes = new Set();
        // BFS queue: list of { url, normalized } to crawl
        this.queue = [];
        // How many pages we've actually crawled this run
        this.crawledThisRun = 0;
        // Resolve promise when crawl session is done
        this.drainResolve = null;
        // Whether this is first crawl (no existing pages) or incremental
        this.isFirstCrawl = true;
    }

    async checkRobotsTxt(domain, userAgent = 'mybot') {
        return new Promise((resolve, reject) => {
            request(`${domain}/robots.txt`, (err, res, body) => {
                if (err) return resolve(true);
                if (res && res.statusCode === 404) return resolve(true);
                try {
                    const robots = robotsParser(`${domain}/robots.txt`, body || '');
                    const isAllowed = robots.isAllowed(this.url, userAgent);
                    resolve(isAllowed);
                } catch {
                    resolve(true);
                }
            });
        });
    }

    /** Load existing site_data URL hashes (and content_hash) for incremental crawl. */
    async loadExistingPages() {
        this.existingPagesMap = await DataHandler.getExistingPagesMap(this.siteId);
        for (const hash of this.existingPagesMap.keys()) {
            this.visitedUrlHashes.add(hash);
        }
        this.isFirstCrawl = this.existingPagesMap.size === 0;
        logger.info(`Site ${this.domain}: existing pages=${this.existingPagesMap.size}, firstCrawl=${this.isFirstCrawl}`);
    }

    /** Normalize and ensure same-domain; return null if external. */
    normalizeInternalUrl(currentUrl, href) {
        if (!href || href.includes('@')) return null;
        try {
            const resolved = UrlValidator.resolveUrl(currentUrl, href);
            const norm = UrlValidator.normalizeUrl(resolved);
            const targetDomain = UrlValidator.getDomain(norm);
            if (!UrlValidator.isRelatedDomain(targetDomain, this.rootDomain)) return null;
            return norm;
        } catch {
            return null;
        }
    }

    /** Add URL to BFS queue if not already visited and under limit. */
    enqueueIfNew(url) {
        const urlHash = UrlValidator.generateUrlHash(url);
        if (this.visitedUrlHashes.has(urlHash)) return;
        if (this.crawledThisRun + this.queue.length >= this.maxPages) return;
        this.visitedUrlHashes.add(urlHash);
        this.queue.push(url);
    }

    /** Get next URL to crawl from queue. */
    nextInQueue() {
        return this.queue.shift() || null;
    }

    async readyPage(entryUrl) {
        return new Promise(async (resolve, reject) => {
            try {
                logger.info(`Starting crawl for domain: ${this.domain} (max ${this.maxPages} pages this run)`);

                await this.loadExistingPages();
                try {
                    await db.query(`UPDATE sites SET crawl_status = 'active' WHERE site_id = ?`, [this.siteId]);
                } catch (e) { /* crawl_status column may not exist yet */ }

                const proxyOptions = proxyManager.getProxyOptions();
                const defaultHeaders = headers.getDefaultHeaders();

                this.crawler = new CrawlerLib({
                    maxConnections: crawlerConfig.maxConnections,
                    timeout: crawlerConfig.timeout,
                    rateLimit: Math.max(crawlerConfig.rateLimit, crawlerConfig.crawlDelay || POLITENESS_DELAY_MS),
                    retries: crawlerConfig.retries,
                    retryTimeout: crawlerConfig.retryTimeout,
                    agent: proxyOptions.agent,
                    strictSSL: crawlerConfig.strictSSL,
                    rejectUnauthorized: crawlerConfig.rejectUnauthorized,
                    gzip: crawlerConfig.gzip,
                    preRequest: (options, done) => {
                        try {
                            if (proxyManager.enabled) {
                                options.proxy = proxyManager.proxyUrl;
                                options.tunnel = false;
                            }
                            if (options.uri && options.uri.startsWith('https')) {
                                options.headers = options.headers || {};
                                Object.assign(options.headers, defaultHeaders);
                                options.strictSSL = false;
                                options.rejectUnauthorized = false;
                            }
                            done();
                        } catch (error) {
                            logger.error(`Error in preRequest: ${error.message}`);
                            done();
                        }
                    },
                    jQuery: {
                        name: 'cheerio',
                        options: {
                            normalizeWhitespace: true,
                            xmlMode: false,
                            decodeEntities: true
                        }
                    },
                    headers: defaultHeaders,
                    callback: async (error, res, done) => {
                        await this.handleResponse(error, res, done);
                    }
                });

                this.drainResolve = resolve;
                // Always queue base URL so we (re)discover links (first crawl + incremental)
                const entry = entryUrl || this.url;
                const entryHash = UrlValidator.generateUrlHash(entry);
                this.visitedUrlHashes.add(entryHash);
                this.queue.push(entry);
                this.setupDrainHandler();

                const first = this.nextInQueue();
                if (first) {
                    logger.info(`Queueing first URL: ${first}`);
                    setTimeout(() => this.crawler.queue(first), POLITENESS_DELAY_MS);
                } else {
                    logger.info('No URLs to crawl.');
                    resolve();
                }
            } catch (error) {
                logger.error(`Error in readyPage: ${error.message}`);
                reject(error);
            }
        });
    }

    async handleResponse(error, res, done) {
        if (error) {
            logger.error(`Error crawling URL: ${res?.options?.uri || 'unknown'} - ${error.message}`);
            if (proxyManager.shouldRetryWithoutProxy && proxyManager.shouldRetryWithoutProxy(error) && res?.options?.uri) {
                setTimeout(() => {
                    this.crawler.queue({
                        uri: res.options.uri,
                        priority: 1,
                        proxy: null,
                        tunnel: false,
                        agent: null,
                        strictSSL: false,
                        rejectUnauthorized: false,
                        rateLimit: 5000,
                        headers: headers.getDefaultHeaders()
                    });
                }, 5000);
            }
            await new Promise(r => setTimeout(r, 2000));
            done();
            this.scheduleNextOrDrain();
            return;
        }

        const uri = res.options.uri;
        logger.info(`Crawling URL: ${uri}`);

        if (res.body && typeof res.body === 'string') {
            const proxyErrorPatterns = [
                'ERROR: The requested URL could not be retrieved',
                'Protocol error (TLS code: SQUID_ERR_SSL_HANDSHAKE)',
                'dh key too small'
            ];
            if (proxyErrorPatterns.some(p => res.body.includes(p))) {
                logger.error(`Detected proxy error page for ${uri}. Retrying without proxy.`);
                setTimeout(() => {
                    this.crawler.queue({
                        uri,
                        priority: 1,
                        proxy: null,
                        tunnel: false,
                        agent: null,
                        strictSSL: false,
                        rejectUnauthorized: false,
                        rateLimit: 5000,
                        headers: headers.getDefaultHeaders()
                    });
                }, 5000);
                done();
                this.scheduleNextOrDrain();
                return;
            }
        }

        let contentType = 'text/html';
        if (res.headers && res.headers['content-type']) {
            contentType = res.headers['content-type'].split(';')[0].toLowerCase();
        }

        if (ContentTypeHandler.isImage(contentType, uri)) {
            await this.handleImage(uri, res.body, contentType);
            done();
            this.scheduleNextOrDrain();
            return;
        }

        if (contentType.includes('text/html')) {
            await this.handleHtml(uri, res);
        } else {
            await this.handleNonHtmlContent(uri, res.body, contentType);
        }

        this.crawledThisRun++;
        done();
        this.scheduleNextOrDrain();
    }

    /** After each page: queue next URL. Drain listener (set once) handles when queue is empty. */
    scheduleNextOrDrain() {
        if (this.crawledThisRun >= this.maxPages) {
            logger.info(`Reached max pages (${this.maxPages}) for this site. Stopping.`);
            this.queue = [];
        }
        const nextUrl = this.nextInQueue();
        if (nextUrl) {
            setTimeout(() => this.crawler.queue(nextUrl), crawlerConfig.crawlDelay || POLITENESS_DELAY_MS);
        }
    }

    /** Call once after crawler is created to handle drain (no more work). */
    setupDrainHandler() {
        this.crawler.on('drain', () => {
            const nextUrl = this.nextInQueue();
            if (nextUrl) {
                setTimeout(() => this.crawler.queue(nextUrl), crawlerConfig.crawlDelay || POLITENESS_DELAY_MS);
            } else {
                logger.info('Crawler queue drained. Finishing site.');
                this.onDrain();
            }
        });
    }

    async onDrain() {
        try {
            await db.query(
                `UPDATE sites SET site_last_crawl_date = NOW(), crawl_status = 'completed'
                 WHERE site_id = ?`,
                [this.siteId]
            );
        } catch (e) {
            try {
                await db.query(`UPDATE sites SET site_last_crawl_date = NOW() WHERE site_id = ?`, [this.siteId]);
            } catch (e2) {
                logger.error(`Error updating site after drain: ${e2.message}`);
            }
        }
        if (this.drainResolve) this.drainResolve();
    }

    async handleHtml(uri, res) {
        const normalizedUri = UrlValidator.normalizeUrl(uri);
        try {
            if (typeof res.$ !== 'function') {
                logger.warn(`No valid HTML returned for: ${uri}`);
                return;
            }

            const currentHost = UrlValidator.getDomain(uri);
            if (UrlValidator.isRelatedDomain(currentHost, this.rootDomain) && currentHost !== this.rootDomain) {
                if (!this.discoveredSubdomains.has(currentHost)) {
                    this.discoveredSubdomains.add(currentHost);
                    logger.info(`Processing subdomain: ${currentHost} of root domain: ${this.rootDomain}`);
                }
            }

            const parser = new Parser(this.siteId, null, uri, res.$);
            const parsedData = await parser.parse();
            const videos = parser.extractVideos();
            const isMainPage = normalizedUri === UrlValidator.normalizeUrl(this.url);
            const linkType = isMainPage ? 'main_page' : 'internal';

            const siteData = await this.dataHandler.saveOrUpdateSiteData(normalizedUri, parsedData, linkType);

            if (siteData && siteData.site_data_id) {
                const imageHandler = new ImageHandler(this.siteId, siteData.site_data_id, uri);
                await imageHandler.extractAndSaveImages(res.$, this.domain);

                const documentHandler = new DocumentHandler(this.siteId, siteData.site_data_id, uri);
                await documentHandler.extractAndSaveDocuments(res.$);

                for (const video of videos) {
                    await this.indexer.indexVideo(
                        video.video,
                        video.title,
                        siteData.site_data_id,
                        video.description || '',
                        video.thumbnail || ''
                    );
                }
                await this.dataHandler.updateStatus(normalizedUri, 'indexed');
            }

            this.extractLinks(res.$, uri);
        } catch (error) {
            logger.error(`Error handling HTML: ${error.message}`);
            await this.dataHandler.updateStatus(normalizedUri, 'failed');
        }
    }

    extractLinks($, currentUrl) {
        const self = this;
        $('a[href]').each(function () {
            try {
                const href = $(this).attr('href');
                const normalized = self.normalizeInternalUrl(currentUrl, href);
                if (normalized) self.enqueueIfNew(normalized);
            } catch (e) { /* skip */ }
        });
    }

    async handleImage(uri, body, contentType) {
        try {
            logger.info(`Processing image: ${uri}`);
            let width = null, height = null;
            if (Buffer.isBuffer(body)) {
                try {
                    const sizeOf = require('image-size');
                    if (sizeOf && typeof sizeOf === 'function') {
                        const size = sizeOf(body);
                        if (size) { width = size.width; height = size.height; }
                    }
                } catch (err) { /* ignore */ }
            }
            const imageHandler = new ImageHandler(this.siteId, null, uri);
            await imageHandler.saveImage(
                uri,
                UrlValidator.getFilenameFromUrl(uri),
                '',
                width,
                height
            );
        } catch (error) {
            logger.error(`Error handling image: ${error.message}`);
        }
    }

    async handleNonHtmlContent(uri, body, contentType) {
        try {
            if (ContentTypeHandler.isDocument(contentType, uri)) {
                const documentHandler = new DocumentHandler(this.siteId, null, uri);
                if (contentType.includes('pdf') && Buffer.isBuffer(body)) {
                    const pdfData = await documentHandler.processPdfContent(body, uri);
                    const normUri = UrlValidator.normalizeUrl(uri);
                    const siteData = await this.dataHandler.saveOrUpdateSiteData(normUri, {
                        title: pdfData.title,
                        description: '',
                        keywords: '',
                        author: pdfData.author,
                        generator: '',
                        h1: '', h2: '', h3: '', h4: '',
                        article: (pdfData.content || '').substring(0, 2096000),
                        icon: ''
                    }, 'document');
                    if (siteData && siteData.site_data_id) {
                        const docWithId = new DocumentHandler(this.siteId, siteData.site_data_id, uri);
                        await docWithId.saveDocument(
                            uri,
                            pdfData.title,
                            'PDF',
                            (pdfData.content || '').substring(0, 500),
                            pdfData.content || ''
                        );
                        await this.dataHandler.updateStatus(normUri, 'indexed');
                    }
                }
            }
        } catch (error) {
            logger.error(`Error handling non-HTML content: ${error.message}`);
        }
    }
}

module.exports = { Crawler: Crawler };
