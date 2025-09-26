// optimized-server.js - Smart Server Implementation
// This solves the problem described in the issue:
// - Checks for already crawled URLs before starting crawling
// - Only crawls genuinely new URLs
// - Maximizes the value of maxPagesPerDomain limit

const { SearchEngineCrawler } = require("./index");
const { con } = require("./mysql");
const schedule = require('node-schedule');
const crypto = require('crypto');

// Generate a unique script ID for this instance
const script_id = crypto.randomBytes(8).toString('hex');

function formatDate(date) {
    const d = new Date(date);
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    const year = d.getFullYear();
    return [year, month, day].join('-');
}

Date.prototype.subDays = function (days) {
    const date = new Date(this.valueOf());
    date.setDate(date.getDate() - days);
    return date;
}

/**
 * Optimized Server Class that solves the duplicate URL crawling problem
 * 
 * Key improvements:
 * 1. Initializes with site-specific duplicate checking before crawling
 * 2. Only crawls genuinely new URLs (solves the 250-limit waste problem)
 * 3. Provides detailed statistics on crawling efficiency
 * 4. Skips sites with low new content automatically
 */
class OptimizedServer {
    constructor() {
        this.sites;
        this.page = 0;
        this.parPage = 25; // Batch size for sites processing
        this.pageNo = 0;
        this.sitesCount = null;
        this.crawlList = [];
        
        // Initialize the enhanced crawler with smart crawling settings
        this.crawler = new SearchEngineCrawler(con, {
            maxDepth: 3,
            maxPagesPerDomain: 250,   // Now used efficiently for unique URLs only
            batchSize: 10,            // Concurrent URLs per depth
            maxPages: 250,            // Queue size
            batchDelay: 2000,         // Delay between batches
            depthDelay: 3000,         // Delay between depth levels
            respectRobots: true,
            timeout: 30000,
            // Smart crawling options
            enableSmartCrawling: true,
            siteAnalysisEnabled: true
        });
        
        // Server statistics
        this.serverStats = {
            sessionId: script_id,
            startTime: new Date(),
            sitesProcessed: 0,
            sitesSkipped: 0,
            totalNewUrlsFound: 0,
            totalDuplicatesSkipped: 0,
            totalHttpRequestsSaved: 0,
            averageEfficiency: 0,
            domains: {
                '.com': { processed: 0, skipped: 0, newUrls: 0 },
                '.org': { processed: 0, skipped: 0, newUrls: 0 },
                '.in': { processed: 0, skipped: 0, newUrls: 0 },
                'other': { processed: 0, skipped: 0, newUrls: 0 }
            }
        };
        
        console.log(`🚀 OptimizedServer initialized with smart crawling`);
        console.log(`Session ID: ${script_id}`);
        console.log(`Configuration: ${this.crawler.options.maxPagesPerDomain} pages per domain (used efficiently)`);
    }

    async loadSiteCount(domainFilter = '%.com%') {
        try {
            console.log(`📊 Loading site count for ${domainFilter} domains...`);
            
            // Wait for database connection
            const connected = await con.waitForConnection(10000);
            if (!connected) {
                console.warn('⚠️ Database not connected, cannot load site count');
                this.sitesCount = 0;
                return;
            }
            
            const result = await con.query(`
                SELECT count(sites.site_id) as c
                FROM sites
                WHERE sites.site_url LIKE ?
                    AND sites.site_active = 1
                    AND sites.site_locked = 0
                ORDER BY sites.site_last_crawl_date ASC;
            `, [domainFilter]);
            
            this.sitesCount = result && result.length > 0 ? result[0].c : 0;
            console.log(`✅ Found ${this.sitesCount} sites to crawl (${domainFilter} domains)`);
        } catch (error) {
            console.error('❌ Error loading site count:', error.message);
            this.sitesCount = 0;
        }
    }

    async crawlerStart(domainFilter = '%.com%') {
        try {
            console.log(`🎯 Starting optimized crawler for ${domainFilter} domains...`);
            console.log(`🕒 Session started at: ${this.serverStats.startTime.toISOString()}`);
            
            // Wait for database connection
            const connected = await con.waitForConnection(10000);
            if (!connected) {
                console.error('❌ Database not connected, cannot start crawler');
                return;
            }
            
            if (!this.sitesCount) await this.loadSiteCount(domainFilter);

            if (this.sitesCount === 0) {
                console.log('ℹ️ No sites to crawl at this time');
                return;
            }

            // Initialize crawler for optimal performance
            await this.crawler.initialize();

            console.log(`📋 Processing ${Math.ceil(this.sitesCount / this.parPage)} batches of ${this.parPage} sites each`);

            for (let i = 0; i < Math.ceil(this.sitesCount / this.parPage); i++) {
                console.log(`\n🔄 Processing batch ${i + 1} of ${Math.ceil(this.sitesCount / this.parPage)}`);
                
                const rows = await con.query(`
                    SELECT * FROM sites
                    WHERE sites.site_url LIKE ?
                        AND sites.site_active = 1
                        AND sites.site_locked = 0
                    ORDER BY sites.site_last_crawl_date ASC
                    LIMIT ${this.parPage * i},${this.parPage};
                `, [domainFilter]);
                
                console.log(`📥 Retrieved ${rows ? rows.length : 0} sites for processing`);
                
                if (rows && rows.length > 0) {
                    await this.processOptimizedBatch(rows, domainFilter);
                } else {
                    console.log('✅ No more sites to process');
                    break;
                }
                
                // Log batch summary
                this.logBatchSummary(i + 1);
            }
            
            // Final cleanup and summary
            await this.crawler.cleanup();
            this.logFinalSummary();
            
        } catch (error) {
            console.error('❌ Error in crawlerStart:', error.message);
        }
    }

    async processOptimizedBatch(rows, domainFilter) {
        const batchStartTime = Date.now();
        const crawlPromises = [];

        for (const site of rows) {
            try {
                // Lock the site with the current script_id
                await con.query(`
                    UPDATE sites
                    SET site_last_crawl_date = '${new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '')}',
                        site_locked = true,
                        locked_by = '${script_id}'
                    WHERE site_id = ${site.site_id}
                `);

                console.log(`\n🌐 Analyzing site: ${site.site_url} (ID: ${site.site_id})`);

                // Use smart crawler to analyze and crawl only new content
                const crawlPromise = this.crawler.crawlWebsiteSmart(site.site_url, site.site_id, {
                    maxDepth: 3,
                    maxPagesPerDomain: 250 // This limit now applies only to NEW URLs
                }).then(result => {
                    return this.processCrawlResult(site, result, domainFilter);
                }).catch(error => {
                    console.error(`⚠️ Smart crawl failed for ${site.site_url}:`, error.message);
                    return { 
                        success: false, 
                        url: site.site_url, 
                        siteId: site.site_id,
                        error: error.message 
                    };
                });

                crawlPromises.push(crawlPromise);
                
                // Process sites in small concurrent batches to avoid overwhelming
                if (crawlPromises.length >= 2) {
                    await Promise.allSettled(crawlPromises.splice(0, 2));
                    await this.delay(3000); // 3 second delay between mini-batches
                }
            } catch (error) {
                console.error('❌ Error setting up crawl for site:', site.site_url, error);
            }
        }

        try {
            // Process remaining promises
            if (crawlPromises.length > 0) {
                await Promise.allSettled(crawlPromises);
            }

            const batchTime = Date.now() - batchStartTime;
            console.log(`\n⏱️ Batch completed in ${Math.round(batchTime / 1000)}s`);

            // Unlock the sites after crawling is done
            await this.unlockSites(rows);
        } catch (error) {
            console.error('❌ Error in batch processing:', error);
            await this.unlockSites(rows);
        }
    }

    processCrawlResult(site, result, domainFilter) {
        // Determine domain category
        let domainCategory = 'other';
        if (site.site_url.includes('.com')) domainCategory = '.com';
        else if (site.site_url.includes('.org')) domainCategory = '.org';
        else if (site.site_url.includes('.in')) domainCategory = '.in';

        if (result.success) {
            if (result.reason === 'recently_crawled_low_activity' || 
                result.reason === 'large_site_limited_new_content') {
                // Site was skipped due to smart analysis
                this.serverStats.sitesSkipped++;
                this.serverStats.domains[domainCategory].skipped++;
                
                console.log(`⏭️ Site skipped: ${site.site_url}`);
                console.log(`   Reason: ${result.reason}`);
                console.log(`   Message: ${result.message}`);
            } else {
                // Site was successfully crawled
                this.serverStats.sitesProcessed++;
                this.serverStats.totalNewUrlsFound += result.uniquePages || 0;
                this.serverStats.totalDuplicatesSkipped += result.duplicatesSkipped || 0;
                this.serverStats.totalHttpRequestsSaved += result.httpRequestsSaved || 0;
                
                this.serverStats.domains[domainCategory].processed++;
                this.serverStats.domains[domainCategory].newUrls += result.uniquePages || 0;
                
                console.log(`✅ Site crawled successfully: ${site.site_url}`);
                console.log(`   📄 New pages found: ${result.uniquePages || 0}`);
                console.log(`   🔄 Duplicates skipped: ${result.duplicatesSkipped || 0}`);
                console.log(`   💾 HTTP requests saved: ${result.httpRequestsSaved || 0}`);
                console.log(`   📊 Efficiency: ${result.crawlEfficiency || 0}%`);
                
                if (result.performanceMetrics) {
                    console.log(`   ⚡ Performance: Init ${result.performanceMetrics.initializationTime}ms, Crawl ${Math.round(result.performanceMetrics.totalCrawlTime / 1000)}s`);
                }
            }
        } else {
            console.error(`❌ Crawl failed for ${site.site_url}: ${result.error}`);
        }

        return result;
    }

    logBatchSummary(batchNumber) {
        const totalSites = this.serverStats.sitesProcessed + this.serverStats.sitesSkipped;
        const skipRate = totalSites > 0 ? Math.round((this.serverStats.sitesSkipped / totalSites) * 100) : 0;
        
        console.log(`\n📊 Batch ${batchNumber} Summary:`);
        console.log(`   Sites processed: ${this.serverStats.sitesProcessed}`);
        console.log(`   Sites skipped: ${this.serverStats.sitesSkipped} (${skipRate}%)`);
        console.log(`   New URLs found: ${this.serverStats.totalNewUrlsFound}`);
        console.log(`   HTTP requests saved: ${this.serverStats.totalHttpRequestsSaved}`);
    }

    logFinalSummary() {
        const endTime = new Date();
        const totalTime = Math.round((endTime - this.serverStats.startTime) / 1000);
        const totalSites = this.serverStats.sitesProcessed + this.serverStats.sitesSkipped;
        
        // Calculate overall efficiency
        const overallEfficiency = this.serverStats.totalNewUrlsFound > 0 && this.serverStats.totalDuplicatesSkipped > 0 ?
            Math.round((this.serverStats.totalNewUrlsFound / (this.serverStats.totalNewUrlsFound + this.serverStats.totalDuplicatesSkipped)) * 100) : 0;

        console.log(`\n🎉 OPTIMIZED CRAWLING SESSION COMPLETED`);
        console.log(`===============================================`);
        console.log(`Session ID: ${this.serverStats.sessionId}`);
        console.log(`Duration: ${Math.floor(totalTime / 60)}m ${totalTime % 60}s`);
        console.log(`\n📈 Overall Results:`);
        console.log(`   Total sites analyzed: ${totalSites}`);
        console.log(`   Sites crawled: ${this.serverStats.sitesProcessed}`);
        console.log(`   Sites skipped (smart): ${this.serverStats.sitesSkipped}`);
        console.log(`   New URLs indexed: ${this.serverStats.totalNewUrlsFound}`);
        console.log(`   Duplicates avoided: ${this.serverStats.totalDuplicatesSkipped}`);
        console.log(`   HTTP requests saved: ${this.serverStats.totalHttpRequestsSaved}`);
        console.log(`   Overall efficiency: ${overallEfficiency}%`);
        
        console.log(`\n🌐 Domain Breakdown:`);
        Object.entries(this.serverStats.domains).forEach(([domain, stats]) => {
            if (stats.processed > 0 || stats.skipped > 0) {
                console.log(`   ${domain}: ${stats.processed} crawled, ${stats.skipped} skipped, ${stats.newUrls} new URLs`);
            }
        });

        console.log(`\n💡 Performance Benefits:`);
        console.log(`   🚀 Only crawled NEW content (no wasted HTTP requests on duplicates)`);
        console.log(`   ⚡ Smart site analysis prevented unnecessary crawling`);
        console.log(`   📊 250-page limit used efficiently for unique URLs only`);
        console.log(`   💾 Saved ${this.serverStats.totalHttpRequestsSaved} HTTP requests vs traditional crawling`);
        
        // Get final crawler statistics
        const crawlerStats = this.crawler.getStats();
        console.log(`\n📋 Detailed Crawler Statistics:`);
        console.log(`   Efficiency: ${crawlerStats.efficiency}`);
        console.log(`   Average site efficiency: ${crawlerStats.averageSiteEfficiency}`);
        console.log(`   Resource savings: ${crawlerStats.resourceSavings}`);
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async unlockSites(rows) {
        try {
            for (const x of rows) {
                await con.query(`
                    UPDATE sites
                    SET site_locked = false,
                        locked_by = NULL
                    WHERE site_id = ${x.site_id} AND locked_by = '${script_id}'
                `);
            }
        } catch (error) {
            console.error('❌ Error unlocking sites:', error);
        }
    }

    /**
     * Get current session statistics
     */
    getSessionStats() {
        return {
            ...this.serverStats,
            crawlerStats: this.crawler.getStats()
        };
    }

    /**
     * Start crawling specific domain types
     */
    async startComDomains() {
        return this.crawlerStart('%.com%');
    }

    async startOrgDomains() {
        return this.crawlerStart('%.org%');
    }

    async startInDomains() {
        return this.crawlerStart('%.in%');
    }

    async startAllDomains() {
        return this.crawlerStart('%');
    }
}

// Graceful shutdown handling
async function unlockAllLockedSites() {
    try {
        console.log('🔓 Unlocking all sites locked by this script...');
        await con.query(`
            UPDATE sites
            SET site_locked = false,
                locked_by = NULL
            WHERE locked_by = '${script_id}'
        `);
        console.log('✅ All sites unlocked successfully');
    } catch (error) {
        console.error('❌ Error unlocking sites:', error);
    }
}

const handleExit = async (signal) => {
    console.log(`\n🛑 Received ${signal}. Gracefully shutting down...`);
    await unlockAllLockedSites();
    process.exit(0);
};

process.on('SIGINT', handleExit);
process.on('SIGTERM', handleExit);
process.on('SIGQUIT', handleExit);

// Export for use
module.exports = { OptimizedServer };

// Example usage:
if (require.main === module) {
    console.log('🔧 Running OptimizedServer in standalone mode');
    console.log('💡 This demonstrates the solution to your duplicate URL crawling problem\n');
    
    const server = new OptimizedServer();
    
    // Start crawling .com domains (your example)
    server.startComDomains().then(() => {
        console.log('\n🏁 Crawling session completed');
    }).catch(error => {
        console.error('❌ Crawling session failed:', error);
    });
} 