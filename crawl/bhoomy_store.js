const { Crawler } = require('./core/crawler');
const { db } = require('./config/db');
const schedule = require('node-schedule');
const crypto = require('crypto');
const logger = require('./utils/logger');

const script_id = crypto.randomBytes(8).toString('hex');

// Production-friendly: fetch only 500 unlocked sites per round, process in 10 batches of 50
const FETCH_SIZE = 500;
const BATCH_SIZE = 50;
const NUM_BATCHES = 10;

function formatDate(date) {
    const d = new Date(date);
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${year}-${month}-${day}`;
}

class Server {
    constructor() {
        this.sites = null;
        this.page = 0;
        this.parPage = BATCH_SIZE;
        this.pageNo = 0;
        this.crawlList = [];
    }

    async fetchUnlockedSites() {
        const rows = await db.query(`
            SELECT * FROM sites
            WHERE (sites.site_url LIKE '%.store%' OR sites.site_url LIKE '%.online%' OR sites.site_url LIKE '%.news%')
                AND sites.site_active = 1
                AND sites.site_locked = 0
            ORDER BY sites.site_last_crawl_date ASC
            LIMIT ${FETCH_SIZE};
        `);
        return rows || [];
    }

    async tryActivateInactiveSites() {
        const activated = await db.query(`
            UPDATE sites SET site_active = 1
            WHERE (site_url LIKE '%.store%' OR site_url LIKE '%.online%' OR site_url LIKE '%.news%')
                AND site_active = 0
        `);
        const affected = (activated && typeof activated.affectedRows === 'number') ? activated.affectedRows : 0;
        if (affected > 0) {
            console.log(`Activated ${affected} .store/.news/.online sites (were inactive). Will retry fetch.`);
            return true;
        }
        return false;
    }

    async crawlerStart() {
        try {
            console.log('Starting crawler for .store, .news, .online domains...');
            const connected = await db.testConnection();
            if (!connected) {
                console.error('Database not connected, cannot start crawler');
                return;
            }

            let round = 0;
            while (true) {
                round++;
                let rows = await this.fetchUnlockedSites();
                if (!rows.length) {
                    const didActivate = await this.tryActivateInactiveSites();
                    if (!didActivate) {
                        console.log('No sites to crawl at this time');
                        return;
                    }
                    rows = await this.fetchUnlockedSites();
                    if (!rows.length) {
                        console.log('No sites to crawl at this time');
                        return;
                    }
                }

                console.log(`Fetched ${rows.length} sites (round ${round}), processing in up to ${NUM_BATCHES} batches of ${BATCH_SIZE}`);
                for (let b = 0; b < NUM_BATCHES; b++) {
                    const batch = rows.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);
                    if (!batch.length) break;
                    console.log(`Processing batch ${b + 1} of ${NUM_BATCHES} (${batch.length} sites)`);
                    await this.promissAll(batch);
                }
            }
        } catch (error) {
            console.error('Error in crawlerStart:', error.message);
        }
    }

    async promissAll(rows) {
        const list = [];

        for (const x of rows) {
            try {
                await db.query(`
                    UPDATE sites
                    SET site_last_crawl_date = NOW(),
                        site_locked = true,
                        locked_by = ?
                    WHERE site_id = ?
                `, [script_id, x.site_id]);

                const crawler = new Crawler(x);
                list.push(crawler.readyPage(x.site_url));
            } catch (error) {
                logger.error(`Error in promissAll: ${error.message}`);
            }
        }

        try {
            await Promise.all(list);
            await this.unlockSites(rows);
        } catch (error) {
            logger.error(`Error in Promise.all: ${error.message}`);
            await this.unlockSites(rows);
        }
    }

    async unlockSites(rows) {
        try {
            for (const x of rows) {
                await db.query(`
                    UPDATE sites
                    SET site_locked = false,
                        locked_by = NULL
                    WHERE site_id = ? AND locked_by = ?
                `, [x.site_id, script_id]);
            }
        } catch (error) {
            logger.error(`Error unlocking sites: ${error.message}`);
        }
    }
}

async function unlockAllLockedSites() {
    try {
        await db.query(`
            UPDATE sites
            SET site_locked = false,
                locked_by = NULL
            WHERE site_locked = true AND locked_by = ?
        `, [script_id]);
        logger.info(`All sites locked by script ${script_id} are now unlocked.`);
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

schedule.scheduleJob({ hour: 0, minute: 10 }, function () {
    const s = new Server();
    s.crawlerStart();
});

new Server().crawlerStart();
