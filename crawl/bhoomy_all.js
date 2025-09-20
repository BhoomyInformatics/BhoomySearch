//bhoomy.js all others Domain Site

// bhoomy_all.js - Crawls all domains except .in, .com, .info, .org, ,net, .online, .store, and .news

// Use the enhanced SearchEngineCrawler instead of legacy crawler
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

class Server {
    constructor() {
        this.sites;
        this.page = 0;
        this.parPage = 25; // Reduced batch size for full website crawling
        this.pageNo = 0;
        this.sitesCount = null;
        this.crawlList = [];
        
        // Initialize the enhanced crawler with your custom settings
        this.crawler = new SearchEngineCrawler(con, {
            maxDepth: 3,
            maxPagesPerDomain: 250,   // Your setting: 250 pages per domain
            batchSize: 10,            // Your setting: 10 URLs concurrent per depth
            maxPages: 250,            // Your setting: 250 pages max queue size
            batchDelay: 2000,
            depthDelay: 3000,
            respectRobots: true,
            timeout: 30000
        });
    }

    async loadSiteCount() {
        try {
            console.log('Loading site count for all other domains...');
            
            // Wait for database connection
            const connected = await con.waitForConnection(10000);
            if (!connected) {
                console.warn('Database not connected, cannot load site count');
                this.sitesCount = 0;
                return;
            }
            
            // Debug: Check total sites in database
            const totalSites = await con.query('SELECT COUNT(*) as total FROM sites');
            console.log(`Total sites in database: ${totalSites[0].total}`);
            
            // Debug: Check active sites
            const activeSites = await con.query('SELECT COUNT(*) as active FROM sites WHERE site_active = 1');
            console.log(`Active sites in database: ${activeSites[0].active}`);
            
            // Debug: Check sample domains
            const sampleDomains = await con.query('SELECT site_url FROM sites WHERE site_active = 1 LIMIT 5');
            console.log('Sample domains:', sampleDomains.map(s => s.site_url));
            
            const result = await con.query(`
                SELECT count(sites.site_id) as c
                FROM sites
                WHERE sites.site_url NOT LIKE '%.in%' 
                    AND sites.site_url NOT LIKE '%.com%'
                    AND sites.site_url NOT LIKE '%.info%'
                    AND sites.site_url NOT LIKE '%.org%'
                    AND sites.site_url NOT LIKE '%.net%'
                    AND sites.site_url NOT LIKE '%.online%'
                    AND sites.site_url NOT LIKE '%.store%'
                    AND sites.site_url NOT LIKE '%.news%'
                    AND sites.site_active = 1
                    AND sites.site_locked = 0
                ORDER BY sites.site_last_crawl_date ASC;
            `);
            
            this.sitesCount = result && result.length > 0 ? result[0].c : 0;
            console.log(`Found ${this.sitesCount} sites to crawl (excluding .in, .com, .info, .org, .net, .online, .store, .news domains)`);
        } catch (error) {
            console.error('Error loading site count:', error.message);
            this.sitesCount = 0;
        }
    }

    async crawlerStart() {
        try {
            console.log('Starting crawler for all other domains...');
            
            // Wait for database connection
            const connected = await con.waitForConnection(10000);
            if (!connected) {
                console.error('Database not connected, cannot start crawler');
                return;
            }
            
            if (!this.sitesCount) await this.loadSiteCount();

            if (this.sitesCount === 0) {
                console.log('No sites to crawl at this time');
                return;
            }
            
            // Initialize crawler
            await this.crawler.initialize();

            for (let i = 0; i < Math.ceil(this.sitesCount / this.parPage); i++) {
                console.log(`Processing batch ${i + 1} of ${Math.ceil(this.sitesCount / this.parPage)}`);
                const rows = await con.query(`
                    SELECT * FROM sites
                    WHERE sites.site_url NOT LIKE '%.in%' 
                        AND sites.site_url NOT LIKE '%.com%'
                        AND sites.site_url NOT LIKE '%.info%'
                        AND sites.site_url NOT LIKE '%.org%'
                        AND sites.site_url NOT LIKE '%.net%'
                        AND sites.site_url NOT LIKE '%.online%'
                        AND sites.site_url NOT LIKE '%.store%'
                        AND sites.site_url NOT LIKE '%.news%'
                        AND sites.site_active = 1
                        AND sites.site_locked = 0
                    ORDER BY sites.site_last_crawl_date ASC
                    LIMIT ${this.parPage * i},${this.parPage};
                `);
                
                console.log(`Retrieved ${rows ? rows.length : 0} sites for processing`);
                if (rows && rows.length > 0) {
                    await this.promissAll(rows);
                } else {
                    console.log('No more sites to process');
                    break;
                }
            }
            
            // Cleanup after all crawling is done
            await this.crawler.cleanup();
        } catch (error) {
            console.error('Error in crawlerStart:', error.message);
        }
    }

    async promissAll(rows) {
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

                // Use SMART crawler to solve the duplicate URL problem
                const crawlPromise = this.crawler.crawlWebsiteSmart(site.site_url, site.site_id, {
                    maxDepth: 3,
                    maxPagesPerDomain: 250 // This limit now applies only to NEW URLs (solves your problem!)
                }).then(result => {
                    if (result.reason) {
                        console.log(`⏭️ Site skipped: ${site.site_url} - ${result.reason}`);
                        console.log(`   Message: ${result.message}`);
                    } else {
                        console.log(`✅ Smart crawl completed for ${site.site_url}:`);
                        console.log(`   📄 New pages indexed: ${result.newPagesIndexed ?? result.indexedToDatabase ?? result.uniquePages}`);
                        console.log(`   🔄 Duplicates skipped: ${result.duplicatesSkipped}`);
                        console.log(`   💾 HTTP requests saved: ${result.httpRequestsSaved}`);
                        console.log(`   📊 Efficiency: ${result.crawlEfficiency}%`);
                    }
                    return result;
                }).catch(error => {
                    console.error(`⚠ Smart crawl failed for ${site.site_url}:`, error.message);
                    return { success: false, url: site.site_url, error: error.message };
                });

                crawlPromises.push(crawlPromise);
                
                // Process sites sequentially with delay to avoid overwhelming
                if (crawlPromises.length >= 3) {
                    await Promise.allSettled(crawlPromises.splice(0, 3));
                    await this.delay(5000); // 5 second delay between site batches
                }
            } catch (error) {
                console.error('Error setting up crawl for site:', site.site_url, error);
            }
        }

        try {
            // Process remaining promises
            if (crawlPromises.length > 0) {
                await Promise.allSettled(crawlPromises);
            }

            console.log('Crawl batch completed: Processing stats...');
            const stats = this.crawler.getStats();
            console.log(`Batch stats: ${stats.successful} successful, ${stats.failed} failed`);

            // Unlock the sites after crawling is done
            await this.unlockSites(rows);
        } catch (error) {
            console.error('Error in Promise.all:', error);
            await this.unlockSites(rows);
        }
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
            console.error('Error unlocking sites:', error);
        }
    }
}

// Function to unlock all locked sites for the current script in case of termination
async function unlockAllLockedSites() {
    try {
        await con.query(`
            UPDATE sites
            SET site_locked = false,
                locked_by = NULL
            WHERE site_locked = true AND locked_by = '${script_id}'
        `);
        console.log(`All sites locked by script ${script_id} are now unlocked.`);
    } catch (error) {
        console.error('Error unlocking sites on termination:', error);
    }
}

// Handle script termination
const handleExit = async (signal) => {
    console.log(`Received ${signal}. Unlocking all sites locked by this script (${script_id})...`);
    await unlockAllLockedSites();
    process.exit();
};

process.on('SIGINT', handleExit);   
process.on('SIGTERM', handleExit);  
process.on('SIGHUP', handleExit);   
process.on('SIGQUIT', handleExit);  

// Schedule the crawling task
schedule.scheduleJob({ hour: 0, minute: 10 }, function () {
    const s = new Server();
    s.crawlerStart();
});

// Add debug information
console.log('Bhoomy ALL domains crawler started');
console.log(`Script ID: ${script_id}`);

// Test database connection before starting
con.query('SELECT 1')
    .then(() => {
        console.log('Database connection verified');
        // Start crawling immediately  
        new Server().crawlerStart();
    })
    .catch(error => {
        console.error('Database connection failed:', error.message);
        console.log('Please check your database connection and try again');
    });
