//news_site.js - Crawls news sites from newsurls.txt

// Use the legacy crawl class which has the ready_page method
const { SearchEngineCrawler } = require("./index");
const { con } = require("./mysql");
const schedule = require('node-schedule');
const crypto = require('crypto');
const fs = require('fs').promises;

// Generate a unique script ID for this instance
const script_id = crypto.randomBytes(8).toString('hex');

function formatDate(date) {
    const d = new Date(date);
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    const year = d.getFullYear();
    return [year, month, day].join('-');
}

Date.prototype.subDays = function(days) {
    const date = new Date(this.valueOf());
    date.setDate(date.getDate() - days);
    return date;
}

class Server {
    constructor() {
        this.sitesCount = null;
        this.crawlList = [];
        this.parPage = 20; // Number of sites to crawl per page
        this.newsUrls = [];

        this.crawler = new SearchEngineCrawler(con, {
            maxDepth: 3,
            maxPagesPerDomain: 1000,   // Your setting: 500 pages per domain
            batchSize: 10,            // Your setting: 10 URLs concurrent per depth
            maxPages: 1000,            // Your setting: 500 pages max queue size
            batchDelay: 2000,
            depthDelay: 3000,
            respectRobots: true,
            timeout: 30000
        });
    }

    async verifyDatabaseConnection() {
        try {
            const result = await con.query('SELECT 1');
            console.log('Database connection verified successfully');
            return true;
        } catch (error) {
            console.error('Database connection failed:', error);
            return false;
        }
    }

    async loadSiteUrls() {
        try {
            const data = await fs.readFile('newsurls.txt', 'utf-8');
            const urls = data.split('\n')
                .map(url => url.trim())
                .filter(Boolean)
                .map(url => {
                    // Ensure URL has proper format
                    if (!url.startsWith('http://') && !url.startsWith('https://')) {
                        return `https://${url}`;
                    }
                    return url;
                });
            
            // Extract domains from URLs for more flexible matching
            const domains = urls.map(url => {
                try {
                    // Extract domain without protocol and www
                    const urlObj = new URL(url);
                    let domain = urlObj.hostname;
                    // Remove www. if present
                    if (domain.startsWith('www.')) {
                        domain = domain.substring(4);
                    }
                    return domain;
                } catch (e) {
                    console.error(`Invalid URL: ${url}`, e);
                    return url; // Return original if parsing fails
                }
            });
            
            console.log(`Loaded ${urls.length} URLs from newsurls.txt`);
            console.log('Sample URLs:', urls.slice(0, 3));
            console.log('Extracted domains:', domains.slice(0, 3));
            return domains;
        } catch (error) {
            console.error('Error loading site URLs:', error);
            return [];
        }
    }

    async updateNews_site() {
        try {
            console.log('Updating News sites status...');
            
            // Create domain conditions for the query
            if (this.newsUrls.length === 0) {
                console.log('No domains to update');
                return 0;
            }
            
            // Create more flexible matching for domains
            const domainConditions = this.newsUrls
                .map(domain => `site_url LIKE ?`)
                .join(' OR ');
            
            // Create parameters with wildcards for LIKE query
            const domainParams = this.newsUrls.map(domain => `%${domain}%`);

            // Update all News sites to active and unlocked
            const updateResult = await con.query(`
                UPDATE sites 
                SET site_active = 1,
                    site_locked = 0,
                    locked_by = NULL
                WHERE ${domainConditions}
            `, domainParams);

            console.log(`Updated ${updateResult.affectedRows} News sites`);

            // Get current status of all News sites
            const statusResult = await con.query(`
                SELECT site_id, site_url, site_active, site_locked, site_last_crawl_date
                FROM sites
                WHERE ${domainConditions}
            `, domainParams);

            console.log('\nCurrent status of News sites:');
            if (statusResult.length === 0) {
                console.log('No matching sites found in database.');
                
                // Insert sites if they don't exist
                for (const domain of this.newsUrls) {
                    try {
                        console.log(`Checking if ${domain} exists in database...`);
                        const checkResult = await con.query(`
                            SELECT site_id FROM sites WHERE site_url LIKE ?
                        `, [`%${domain}%`]);
                        
                        if (checkResult.length === 0) {
                            console.log(`Inserting new site: ${domain}`);
                            const insertResult = await con.query(`
                                INSERT INTO sites (site_url, site_active, site_locked)
                                VALUES (?, 1, 0)
                            `, [`https://www.${domain}`]);
                            
                            console.log(`Inserted site with ID: ${insertResult.insertId}`);
                        }
                    } catch (err) {
                        console.error(`Error processing domain ${domain}:`, err);
                    }
                }
            } else {
                statusResult.forEach(site => {
                    console.log(`Site: ${site.site_url}`);
                    console.log(`  ID: ${site.site_id}`);
                    console.log(`  Active: ${site.site_active}`);
                    console.log(`  Locked: ${site.site_locked}`);
                    console.log(`  Last Crawl: ${site.site_last_crawl_date}`);
                    console.log('---');
                });
            }

            return updateResult.affectedRows;
        } catch (error) {
            console.error('Error updating News sites:', error);
            return 0;
        }
    }

    async loadSiteCount() {
        try {
            // Verify database connection first
            if (!await this.verifyDatabaseConnection()) {
                throw new Error('Database connection failed');
            }

            // Load News URLs first
            this.newsUrls = await this.loadSiteUrls();
            
            if (this.newsUrls.length === 0) {
                console.log('No URLs found in newsurls.txt');
                this.sitesCount = 0;
                return;
            }

            // Update all News sites to active status
            await this.updateNews_site();

            // Create more flexible domain conditions for the query
            const domainConditions = this.newsUrls
                .map(domain => `sites.site_url LIKE ?`)
                .join(' OR ');
            
            // Create parameters with wildcards for LIKE query
            const domainParams = this.newsUrls.map(domain => `%${domain}%`);

            console.log('\nChecking for sites to crawl...');

            const result = await con.query(`
                SELECT count(sites.site_id) as c, GROUP_CONCAT(site_url) as urls
                FROM sites
                WHERE (${domainConditions})
                    AND sites.site_active = 1
                    AND sites.site_locked = 0
            `, domainParams);

            this.sitesCount = result[0].c;
            console.log(`Found ${this.sitesCount} sites ready to crawl`);
            if (result[0].urls) {
                console.log('Sites to crawl:', result[0].urls);
            }
        } catch (error) {
            console.error('Error loading site count:', error);
            this.sitesCount = 0;
        }
    }

    async crawlerStart() {
        try {
            console.log('Starting News sites crawler...');
            
            // Wait for database connection
            const connected = await con.waitForConnection(10000);
            if (!connected) {
                console.error('Database not connected, cannot start crawler');
                return;
            }
            
            if (!this.sitesCount) await this.loadSiteCount();

            if (this.sitesCount === 0) {
                console.log('No News sites to crawl at this time');
                return;
            }

            // Initialize crawler
            await this.crawler.initialize();

            // Create domain conditions for the query using LIKE for flexible matching
            const domainConditions = this.newsUrls
                .map(domain => `sites.site_url LIKE ?`)
                .join(' OR ');
            
            // Create parameters with wildcards for LIKE query
            const domainParams = this.newsUrls.map(domain => `%${domain}%`);

            for (let i = 0; i < Math.ceil(this.sitesCount / this.parPage); i++) {
                console.log(`Processing batch ${i + 1} of ${Math.ceil(this.sitesCount / this.parPage)}`);
                
                const rows = await con.query(`
                    SELECT * FROM sites
                    WHERE (${domainConditions})
                        AND site_active = 1
                        AND site_locked = 0
                    ORDER BY site_last_crawl_date ASC
                    LIMIT ${this.parPage * i}, ${this.parPage}
                `, domainParams);

                if (rows.length === 0) {
                    console.log('No more sites to process in this batch');
                    continue;
                }

                console.log(`Found ${rows.length} sites to process in this batch`);
                await this.promissAll(rows);
            }
            
            // Cleanup after all crawling is done
            await this.crawler.cleanup();
        } catch (error) {
            console.error('Error in crawlerStart:', error);
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
                    maxPagesPerDomain: 1000, // This limit now applies only to NEW URLs (solves your problem!)
                    forceCrawl: true, // Force daily crawling for news sites
                    skipRecentCheck: true, // Skip the recent crawl check for news sites
                    crawlInterval: 'daily' // Ensure daily crawling
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
                    SET site_locked = 0,
                        locked_by = NULL
                    WHERE site_id = ? AND locked_by = ?
                `, [x.site_id, script_id]);
            }
            console.log(`Unlocked ${rows.length} sites`);
        } catch (error) {
            console.error('Error unlocking sites:', error);
        }
    }
}

// Function to unlock all locked sites for the current script in case of termination
async function unlockAllLockedSites() {
    try {
        const result = await con.query(`
            UPDATE sites
            SET site_locked = 0,
                locked_by = NULL
            WHERE site_locked = 1 AND locked_by = ?
        `, [script_id]);
        console.log(`Unlocked ${result.affectedRows} sites on termination`);
    } catch (error) {
        console.error('Error unlocking sites on termination:', error);
    }
}

// Handle script termination (manual break, kill signal, or crash)
const handleExit = async (signal) => {
    console.log(`Received ${signal}. Unlocking all sites locked by this script (${script_id})...`);
    await unlockAllLockedSites();
    process.exit();
};

// Capture different termination signals to ensure proper site unlocking
process.on('SIGINT', handleExit);   // Interrupt signal (Ctrl + C)
process.on('SIGTERM', handleExit);  // Termination signal (kill command)
process.on('SIGHUP', handleExit);   // Hangup signal (terminal closed)
process.on('SIGQUIT', handleExit);  // Quit signal

// Schedule job to run every 10 hours (news sites need more frequent updates)
schedule.scheduleJob('0 */10 * * *', function () {
    console.log('Starting scheduled crawl...');
    const s = new Server();
    s.crawlerStart();
});

// Start crawling immediately
console.log('Starting initial crawl...');
new Server().crawlerStart();
