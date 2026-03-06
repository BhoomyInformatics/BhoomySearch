const { Crawler } = require('./core/crawler');
const { db } = require('./config/db');
const schedule = require('node-schedule');
const crypto = require('crypto');
const logger = require('./utils/logger');
const fs = require('fs').promises;

const script_id = crypto.randomBytes(8).toString('hex');

function formatDate(date) {
    const d = new Date(date);
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${year}-${month}-${day}`;
}

class Server {
    constructor() {
        this.sitesCount = null;
        this.crawlList = [];
        this.parPage = 100;
        this.specialUrls = [];
    }

    async verifyDatabaseConnection() {
        try {
            const result = await db.query('SELECT 1');
            logger.info('Database connection verified successfully');
            return true;
        } catch (error) {
            logger.error(`Database connection failed: ${error.message}`);
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
                    if (!url.startsWith('http://') && !url.startsWith('https://')) {
                        return `https://${url}`;
                    }
                    return url;
                });
            logger.info(`Loaded ${urls.length} URLs from newsurls.txt`);
            logger.info(`Sample URLs: ${urls.slice(0, 3).join(', ')}`);
            return urls;
        } catch (error) {
            logger.error(`Error loading site URLs: ${error.message}`);
            return [];
        }
    }

    async updateSpecialSites() {
        try {
            logger.info('Updating special sites status...');
            
            const urlConditions = this.specialUrls
                .map(() => 'site_url = ?')
                .join(' OR ');

            const updateResult = await db.query(`
                UPDATE sites 
                SET site_active = 1,
                    site_locked = 0,
                    locked_by = NULL
                WHERE ${urlConditions}
            `, this.specialUrls);

            logger.info(`Updated ${updateResult.affectedRows} special sites`);

            const statusResult = await db.query(`
                SELECT site_id, site_url, site_active, site_locked, site_last_crawl_date
                FROM sites
                WHERE ${urlConditions}
            `, this.specialUrls);

            logger.info('\nCurrent status of special sites:');
            statusResult.forEach(site => {
                logger.info(`Site: ${site.site_url}, ID: ${site.site_id}, Active: ${site.site_active}, Locked: ${site.site_locked}`);
            });

            return updateResult.affectedRows;
        } catch (error) {
            logger.error(`Error updating special sites: ${error.message}`);
            return 0;
        }
    }

    async loadSiteCount() {
        try {
            if (!await this.verifyDatabaseConnection()) {
                throw new Error('Database connection failed');
            }

            this.specialUrls = await this.loadSiteUrls();
            
            if (this.specialUrls.length === 0) {
                logger.info('No URLs found in newsurls.txt');
                this.sitesCount = 0;
                return;
            }

            await this.updateSpecialSites();

            const urlConditions = this.specialUrls
                .map(() => 'sites.site_url = ?')
                .join(' OR ');

            logger.info('\nChecking for sites to crawl...');

            const result = await db.query(`
                SELECT count(sites.site_id) as c, GROUP_CONCAT(site_url) as urls
                FROM sites
                WHERE (${urlConditions})
                    AND sites.site_active = 1
                    AND sites.site_locked = 0
            `, this.specialUrls);

            this.sitesCount = result[0].c;
            logger.info(`Found ${this.sitesCount} sites ready to crawl`);
            if (result[0].urls) {
                logger.info(`Sites to crawl: ${result[0].urls}`);
            }
        } catch (error) {
            logger.error(`Error loading site count: ${error.message}`);
            this.sitesCount = 0;
        }
    }

    async crawlerStart() {
        try {
            logger.info('Starting special sites crawler...');
            
            if (!this.sitesCount) await this.loadSiteCount();

            if (this.sitesCount === 0) {
                logger.info('No special sites to crawl at this time');
                return;
            }

            const urlConditions = this.specialUrls
                .map(() => 'sites.site_url = ?')
                .join(' OR ');

            for (let i = 0; i < Math.ceil(this.sitesCount / this.parPage); i++) {
                logger.info(`Processing batch ${i + 1} of ${Math.ceil(this.sitesCount / this.parPage)}`);
                
                const rows = await db.query(`
                    SELECT * FROM sites
                    WHERE (${urlConditions})
                        AND site_active = 1
                        AND site_locked = 0
                    ORDER BY site_last_crawl_date ASC
                    LIMIT ? OFFSET ?
                `, [...this.specialUrls, this.parPage, this.parPage * i]);

                if (rows.length === 0) {
                    logger.info('No more sites to process in this batch');
                    continue;
                }

                logger.info(`Found ${rows.length} sites to process in this batch`);
                await this.promissAll(rows);
            }
        } catch (error) {
            logger.error(`Error in crawlerStart: ${error.message}`);
        }
    }

    async promissAll(rows) {
        const list = [];

        for (const x of rows) {
            try {
                const lockResult = await db.query(`
                    UPDATE sites
                    SET site_locked = 1,
                        locked_by = ?
                    WHERE site_id = ? AND site_locked = 0
                `, [script_id, x.site_id]);

                if (lockResult.affectedRows > 0) {
                    logger.info(`Locked site ${x.site_url} for processing`);
                    const crawler = new Crawler(x);
                    list.push(crawler.readyPage(x.site_url));
                } else {
                    logger.info(`Site ${x.site_url} was already locked, skipping`);
                }
            } catch (error) {
                logger.error(`Error processing site ${x.site_url}: ${error.message}`);
            }
        }

        try {
            if (list.length > 0) {
                await Promise.all(list);
                logger.info(`Completed processing ${list.length} sites`);
            }
        } catch (error) {
            logger.error(`Error in Promise.all: ${error.message}`);
        } finally {
            await this.unlockSites(rows);
        }
    }

    async unlockSites(rows) {
        try {
            for (const x of rows) {
                await db.query(`
                    UPDATE sites
                    SET site_locked = 0,
                        locked_by = NULL
                    WHERE site_id = ? AND locked_by = ?
                `, [x.site_id, script_id]);
            }
            logger.info(`Unlocked ${rows.length} sites`);
        } catch (error) {
            logger.error(`Error unlocking sites: ${error.message}`);
        }
    }
}

async function unlockAllLockedSites() {
    try {
        const result = await db.query(`
            UPDATE sites
            SET site_locked = 0,
                locked_by = NULL
            WHERE site_locked = 1 AND locked_by = ?
        `, [script_id]);
        logger.info(`Unlocked ${result.affectedRows} sites on termination`);
    } catch (error) {
        logger.error(`Error unlocking sites on termination: ${error.message}`);
    }
}

const handleExit = async (signal) => {
    logger.info(`Received ${signal}. Unlocking all sites locked by this script (${script_id})...`);
    await unlockAllLockedSites();
    process.exit();
};

process.on('SIGINT', handleExit);
process.on('SIGTERM', handleExit);
process.on('SIGHUP', handleExit);
process.on('SIGQUIT', handleExit);

schedule.scheduleJob('*/60 * * * *', function () {
    logger.info('Starting scheduled crawl...');
    const s = new Server();
    s.crawlerStart();
});

logger.info('Starting initial crawl...');
new Server().crawlerStart();
