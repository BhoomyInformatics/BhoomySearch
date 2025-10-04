/**
 * Enhanced Crawler Configuration for Maximum URL Discovery
 * Use this configuration to increase crawling depth and discover more URLs
 */
const enhancedCrawlerConfig = {
    // INCREASED LIMITS for better URL discovery
    maxDepth: 5,              // Increased from 3 to 5 for deeper crawling
    maxPagesPerDomain: 500,   // Increased from 250 to 500  
    batchSize: 15,            // Increased from 10 to 15 for better throughput
    maxPages: 500,            // Increased from 250 to 500
    
    // OPTIMIZED DELAYS for faster crawling
    batchDelay: 1000,         // Reduced from 2000 to 1000ms
    depthDelay: 2000,         // Reduced from 3000 to 2000ms
    
    // ENHANCED LINK DISCOVERY
    followSubdomains: true,    // Follow www, blog, news subdomains
    includeQueryParameters: false, // Skip query-based URLs to avoid duplicates
    maxLinksPerPage: 500,     // Increased from default to find more links
    
    // CONTENT TYPE EXPANSION
    crawlImages: true,        // Include image galleries
    crawlDocuments: true,     // Include PDF, DOC files
    crawlVideoPages: true,    // Include video/media pages
    
    // TIMEOUT ADJUSTMENTS for problematic sites
    timeout: 45000,           // Increased from 30000 to 45000ms
    requestTimeout: 25000,    // Increased timeout for slow-loading pages
    
    // POLITENESS SETTINGS (keep respectful)
    respectRobots: true,
    userAgentRotation: true,
    
    // RETRY CONFIGURATION for better success rates
    maxRetries: 2,            // Reduced retries for faster crawling
    retryDelay: 1000,         // Quick retry for transient failures
    
    // ADVANCED URL PATTERNS for better discovery
    includePatterns: [
        '/category/',         // Category pages often have many links
        '/archive/',          // Archive pages
        '/tag/',              // Tag pages
        '/news/',             // News sections
        '/blog/',             // Blog sections
        '/gallery/',          // Gallery sections
        '/photos/',           // Photo sections
        '/articles/',         // Article sections
    ],
    
    excludePatterns: [
        '/search?',           // Skip search result pages
        '/login',             // Skip login pages
        '/register',          // Skip registration
        '/admin',             // Skip admin pages
        '/api/',              // Skip API endpoints
        '.json',              // Skip JSON files
        '.xml',               // Skip XML files
        '/feed',              // Skip RSS feeds
        '#',                  // Skip anchor links
    ]
};

/**
 * Create Enhanced Crawler Instance for Maximum Discovery
 */
function createEnhancedCrawler(dbConnection) {
    const { SearchEngineCrawler } = require('./index');
    
    return new SearchEngineCrawler(dbConnection, enhancedCrawlerConfig);
}

/**
 * Enhanced Crawling Strategy for Deep Site Exploration
 */
async function enhancedCrawlStrategy(siteUrl, siteId, dbConnection) {
    const crawler = createEnhancedCrawler(dbConnection);
    
    console.log(`🚀 Starting Enhanced Crawl Strategy for ${siteUrl}`);
    console.log(`📊 Target: ${enhancedCrawlerConfig.maxPages} pages, Depth: ${enhancedCrawlerConfig.maxDepth}`);
    
    // Phase 1: Initialize and load existing duplicates
    await crawler.initialize();
    
    // Phase 2: Enhanced crawling with multiple entry points
    const entryPoints = await discoverEntryPoints(siteUrl);
    
    console.log(`🔍 Discovered ${entryPoints.length} entry points for comprehensive crawling`);
    
    let totalResults = [];
    let totalUnique = 0;
    let totalDuplicatesSkipped = 0;
    
    // Crawl from multiple entry points for better coverage
    for (const entryPoint of entryPoints) {
        console.log(`📄 Crawling from entry point: ${entryPoint}`);
        
        const result = await crawler.crawlWebsiteComplete(entryPoint, siteId, {
            maxPages: Math.ceil(enhancedCrawlerConfig.maxPages / entryPoints.length),
            maxDepth: enhancedCrawlerConfig.maxDepth
        });
        
        if (result && result.stats) {
            totalUnique += result.stats.uniqueUrlsCrawled || 0;
            totalDuplicatesSkipped += result.stats.duplicatesSkipped || 0;
            totalResults.push(result);
        }
        
        // Small delay between entry points
        await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    // Final statistics
    const finalStats = crawler.getStats();
    
    console.log('\n' + '='.repeat(60));
    console.log('🎯 ENHANCED CRAWLING RESULTS');
    console.log('='.repeat(60));
    console.log(`Site: ${siteUrl}`);
    console.log(`Entry Points Used: ${entryPoints.length}`);
    console.log(`Total Unique URLs Crawled: ${finalStats.uniqueUrlsCrawled}`);
    console.log(`Duplicates Skipped: ${finalStats.duplicatesSkippedPreCrawl}`);
    console.log(`Efficiency: ${finalStats.efficiency}`);
    console.log(`Resource Savings: ${finalStats.resourceSavings}`);
    console.log('='.repeat(60));
    
    return {
        success: true,
        totalUnique: finalStats.uniqueUrlsCrawled,
        duplicatesSkipped: finalStats.duplicatesSkippedPreCrawl,
        efficiency: finalStats.efficiency,
        entryPointsUsed: entryPoints.length,
        results: totalResults
    };
}

/**
 * Discover Multiple Entry Points for Comprehensive Crawling
 */
async function discoverEntryPoints(siteUrl) {
    const entryPoints = [siteUrl]; // Start with main URL
    
    try {
        const axios = require('axios');
        const cheerio = require('cheerio');
        
        // Get the main page to discover additional entry points
        const response = await axios.get(siteUrl, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(response.data);
        const baseUrl = new URL(siteUrl);
        
        // Look for common entry points
        const potentialEntryPoints = [
            '/news',
            '/articles', 
            '/blog',
            '/gallery',
            '/photos',
            '/category',
            '/archive',
            '/latest',
            '/popular'
        ];
        
        // Check if these entry points exist by looking for links
        $('a[href]').each((i, elem) => {
            const href = $(elem).attr('href');
            if (href) {
                try {
                    const linkUrl = new URL(href, siteUrl);
                    
                    // Only include same-domain URLs
                    if (linkUrl.hostname === baseUrl.hostname) {
                        const path = linkUrl.pathname.toLowerCase();
                        
                        // Check if this matches our entry point patterns
                        for (const pattern of potentialEntryPoints) {
                            if (path.includes(pattern) && !entryPoints.includes(linkUrl.href)) {
                                entryPoints.push(linkUrl.href);
                                break;
                            }
                        }
                    }
                } catch (urlError) {
                    // Skip invalid URLs
                }
            }
        });
        
    } catch (error) {
        console.log(`⚠️  Could not discover additional entry points: ${error.message}`);
    }
    
    // Limit to reasonable number of entry points
    return entryPoints.slice(0, 5);
}

module.exports = {
    enhancedCrawlerConfig,
    createEnhancedCrawler,
    enhancedCrawlStrategy,
    discoverEntryPoints
}; 