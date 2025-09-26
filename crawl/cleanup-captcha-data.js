#!/usr/bin/env node

/**
 * Utility script to identify and clean up CAPTCHA-polluted data in the database
 * This script helps identify entries that contain CAPTCHA challenges instead of real content
 */

const mysql = require('mysql2/promise');
const { logger } = require('./utils/logger');

// Database configuration
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'mybhoomy_mytest',
    charset: 'utf8mb4'
};

class CaptchaDataCleanup {
    constructor() {
        this.connection = null;
    }

    async connect() {
        try {
            this.connection = await mysql.createConnection(dbConfig);
            logger.info('Connected to database for CAPTCHA cleanup');
        } catch (error) {
            logger.error('Database connection failed', { error: error.message });
            throw error;
        }
    }

    async disconnect() {
        if (this.connection) {
            await this.connection.end();
            logger.info('Database connection closed');
        }
    }

    /**
     * Find CAPTCHA-polluted entries in the database
     */
    async findCaptchaEntries() {
        try {
            const captchaPatterns = [
                'What code is in the image',
                'support ID',
                'data:;base64,iVBORw0KGgo=',
                'automated spam submission',
                'testing whether you are a human visitor'
            ];

            const conditions = captchaPatterns.map(pattern => 
                `(site_data_title LIKE '%${pattern}%' OR site_data_description LIKE '%${pattern}%' OR site_data_article LIKE '%${pattern}%')`
            ).join(' OR ');

            const query = `
                SELECT 
                    site_data_id,
                    site_data_site_id,
                    site_data_link,
                    site_data_title,
                    site_data_description,
                    site_data_article,
                    crawl_date
                FROM site_data 
                WHERE ${conditions}
                ORDER BY site_data_id
            `;

            const [rows] = await this.connection.execute(query);
            
            logger.info('Found CAPTCHA-polluted entries', { count: rows.length });
            
            return rows;
        } catch (error) {
            logger.error('Error finding CAPTCHA entries', { error: error.message });
            throw error;
        }
    }

    /**
     * Clean up CAPTCHA entries by marking them as blocked or deleting them
     */
    async cleanupCaptchaEntries(entries, action = 'mark_blocked') {
        try {
            if (entries.length === 0) {
                logger.info('No CAPTCHA entries to clean up');
                return;
            }

            const entryIds = entries.map(entry => entry.site_data_id);
            
            if (action === 'mark_blocked') {
                // Mark entries as blocked instead of deleting them
                const updateQuery = `
                    UPDATE site_data 
                    SET status = 'blocked_captcha', 
                        site_data_title = 'CAPTCHA Challenge Detected',
                        site_data_description = 'This page was blocked due to CAPTCHA protection',
                        site_data_article = 'CAPTCHA challenge detected during crawling. Original content not accessible.',
                        site_data_metadata = JSON_SET(COALESCE(site_data_metadata, '{}'), '$.captcha_detected', true, '$.cleanup_date', NOW())
                    WHERE site_data_id IN (${entryIds.map(() => '?').join(',')})
                `;
                
                await this.connection.execute(updateQuery, entryIds);
                logger.info('Marked CAPTCHA entries as blocked', { count: entryIds.length });
                
            } else if (action === 'delete') {
                // Delete the entries completely
                const deleteQuery = `DELETE FROM site_data WHERE site_data_id IN (${entryIds.map(() => '?').join(',')})`;
                await this.connection.execute(deleteQuery, entryIds);
                logger.info('Deleted CAPTCHA entries', { count: entryIds.length });
            }
            
        } catch (error) {
            logger.error('Error cleaning up CAPTCHA entries', { error: error.message });
            throw error;
        }
    }

    /**
     * Generate a report of CAPTCHA entries by site
     */
    async generateReport(entries) {
        try {
            const report = {};
            
            for (const entry of entries) {
                const siteId = entry.site_data_site_id;
                if (!report[siteId]) {
                    report[siteId] = {
                        siteId: siteId,
                        count: 0,
                        urls: []
                    };
                }
                
                report[siteId].count++;
                report[siteId].urls.push({
                    id: entry.site_data_id,
                    url: entry.site_data_link,
                    title: entry.site_data_title,
                    crawlDate: entry.crawl_date
                });
            }
            
            logger.info('CAPTCHA entries report by site', { report });
            return report;
        } catch (error) {
            logger.error('Error generating report', { error: error.message });
            throw error;
        }
    }
}

// Main execution
async function main() {
    const cleanup = new CaptchaDataCleanup();
    
    try {
        await cleanup.connect();
        
        // Find CAPTCHA entries
        const captchaEntries = await cleanup.findCaptchaEntries();
        
        if (captchaEntries.length > 0) {
            // Generate report
            const report = await cleanup.generateReport(captchaEntries);
            
            // Clean up entries (mark as blocked by default)
            await cleanup.cleanupCaptchaEntries(captchaEntries, 'mark_blocked');
            
            console.log('\n=== CAPTCHA Cleanup Summary ===');
            console.log(`Total CAPTCHA entries found: ${captchaEntries.length}`);
            console.log('\nSites affected:');
            Object.values(report).forEach(siteReport => {
                console.log(`- Site ID ${siteReport.siteId}: ${siteReport.count} entries`);
            });
            console.log('\nAll CAPTCHA entries have been marked as blocked.');
            
        } else {
            console.log('No CAPTCHA entries found in the database.');
        }
        
    } catch (error) {
        logger.error('CAPTCHA cleanup failed', { error: error.message });
        process.exit(1);
    } finally {
        await cleanup.disconnect();
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { CaptchaDataCleanup };
