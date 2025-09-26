// bhoomy_in.js - Crawls .in and .info domains

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
        // Windowed processing: fetch 200, sub-batch process 20
        this.fetchBatchSize = 200;
        this.subBatchSize = 20;
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
            console.log('Loading site count for .in domains...');
            
            // Wait for database connection
            const connected = await con.waitForConnection(10000);
            if (!connected) {
                console.warn('Database not connected, cannot load site count');
                this.sitesCount = 0;
                return;
            }
            
            const result = await con.query(`
                SELECT count(sites.site_id) as c
                FROM sites
                WHERE (sites.site_url LIKE '%.in%'
                    OR sites.site_url LIKE '%.info%')
                    AND sites.site_active = 1
                    AND sites.site_locked = 0
                ORDER BY sites.site_last_crawl_date DESC;
            `);
            
            this.sitesCount = result && result.length > 0 ? result[0].c : 0;
            console.log(`Found ${this.sitesCount} sites to crawl (.in domains)`);
        } catch (error) {
            console.error('Error loading site count:', error.message);
            this.sitesCount = 0;
        }
    }

    async crawlerStart() {
        try {
            console.log('Starting crawler for .in domains...');
            
            // Wait for database connection
            const connected = await con.waitForConnection(10000);
            if (!connected) {
                console.error('Database not connected, cannot start crawler');
                return;
            }
            
            // Initialize crawler
            await this.crawler.initialize();

            let batchNumber = 0;
            while (true) {
                batchNumber++;
                const rows = await con.query(`
                    SELECT site_id, site_url FROM sites
                    WHERE (site_url LIKE '%.in%'
                           OR site_url LIKE '%.info%')
                      AND site_active = 1
                      AND site_locked = 0
                    ORDER BY site_last_crawl_date ASC
                    LIMIT ${this.fetchBatchSize};
                `);

                const count = rows ? rows.length : 0;
                if (!rows || count === 0) {
                    console.log('No more sites to process');
                    break;
                }

                console.log(`Processing window ${batchNumber} — fetched ${count} sites (max ${this.fetchBatchSize})`);

                const ids = rows.map(r => r.site_id).join(',');
                await con.query(`
                    UPDATE sites
                    SET site_locked = 1,
                        locked_by = '${script_id}',
                        site_last_crawl_date = '${new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '')}'
                    WHERE site_id IN (${ids}) AND site_locked = 0;
                `);

                const lockedRows = await con.query(`
                    SELECT * FROM sites
                    WHERE locked_by = '${script_id}' AND site_id IN (${ids})
                    ORDER BY site_last_crawl_date ASC;
                `);

                console.log(`Locked ${lockedRows ? lockedRows.length : 0} sites for this window`);

                for (let start = 0; start < lockedRows.length; start += this.subBatchSize) {
                    const slice = lockedRows.slice(start, start + this.subBatchSize);
                    console.log(`Processing sub-batch ${Math.floor(start / this.subBatchSize) + 1} of ${Math.ceil(lockedRows.length / this.subBatchSize)} (size ${slice.length})`);
                    await this.promissAll(slice);
                }

                await this.unlockSites(lockedRows);
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
                        console.log(`   📄 New pages indexed: ${result.uniquePages}`);
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

// Handle process termination gracefully
const handleExit = async (signal) => {
    console.log(`\nReceived ${signal}, gracefully shutting down...`);
    await unlockAllLockedSites();
    process.exit(0);
};

process.on('SIGINT', handleExit);
process.on('SIGTERM', handleExit);
process.on('exit', handleExit);

const server = new Server();

// Schedule job to run every 12 hours
const job = schedule.scheduleJob('0 */12 * * *', async () => {
    console.log(`\n=== Starting scheduled crawl for .in domains at ${new Date().toISOString()} ===`);
    await server.crawlerStart();
    console.log(`=== Completed scheduled crawl for .in domains at ${new Date().toISOString()} ===\n`);
});

console.log('Bhoomy .in crawler started with schedule: every 12 hours');
console.log(`Script ID: ${script_id}`);

// Run immediately on start
server.crawlerStart().then(() => {
    console.log('Initial crawl completed');
}).catch(error => {
    console.error('Initial crawl failed:', error);
});
