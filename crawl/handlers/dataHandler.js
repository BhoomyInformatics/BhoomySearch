const crypto = require('crypto');
const { db } = require('../config/db');
const UrlValidator = require('../utils/urlValidator');
const DuplicateChecker = require('../utils/duplicateChecker');
const logger = require('../utils/logger');

function computeContentHash(title, article) {
    const str = [title || '', article || ''].join('\n');
    return crypto.createHash('sha256').update(str).digest('hex');
}

class DataHandler {
    constructor(siteId) {
        this.siteId = siteId;
    }

    async saveOrUpdateSiteData(url, data, linkType = 'internal') {
        try {
            const normalized = UrlValidator.normalizeUrl(url);
            if (!normalized || (!normalized.startsWith('http://') && !normalized.startsWith('https://'))) {
                logger.warn(`Invalid or non-http URL skipped: ${url}`);
                return null;
            }
            const urlHash = UrlValidator.generateUrlHash(normalized);
            const existing = await DuplicateChecker.checkDataDuplicate(this.siteId, normalized);

            if (existing) {
                return await this.updateSiteData(normalized, data, linkType);
            } else {
                return await this.insertSiteData(normalized, data, urlHash, linkType);
            }
        } catch (error) {
            logger.error(`Error saving site data: ${error.message}`);
            throw error;
        }
    }

    async insertSiteData(url, data, urlHash, linkType = 'internal') {
        try {
            const normalized = UrlValidator.normalizeUrl(url);            
            const rawTitle = data && data.title ? String(data.title).trim() : '';
            const titleSource = this.isValidTitleOrDescription(rawTitle) ? rawTitle : '';
            const rawDescription = data && data.description ? String(data.description).trim() : '';
            const descriptionSource = this.isValidTitleOrDescription(rawDescription) ? rawDescription : '';
            await db.query(
                `INSERT INTO site_data (
                    site_data_site_id, site_data_link, site_data_title, site_data_description,
                    site_data_keywords, site_data_author, site_data_generator, site_data_h1,
                    site_data_h2, site_data_h3, site_data_h4, site_data_article, site_data_icon,
                    site_data_url_hash, status, crawl_date, link_type, site_data_metadata
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), ?, ?)`,
                [
                    this.siteId, normalized,
                    this.truncate(titleSource, 500),
                    this.truncate(descriptionSource, 1048000),
                    this.truncate(data.keywords, 1048000),
                    this.truncate(data.author, 255),
                    this.truncate(data.generator, 255),
                    this.truncate(data.h1, 1048000),
                    this.truncate(data.h2, 1048000),
                    this.truncate(data.h3, 1048000),
                    this.truncate(data.h4, 1048000),
                    this.truncate(data.article, 2096000),
                    this.truncate(data.icon, 2048),
                    urlHash,
                    linkType,
                    data.metadata || null
                ]
            );

            const result = await db.query(
                'SELECT * FROM site_data WHERE site_data_site_id = ? AND site_data_url_hash = ?',
                [this.siteId, urlHash]
            );

            logger.info(`Site data inserted: ${url} (link_type: ${linkType})`);
            return result[0];
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                logger.warn(`Duplicate entry detected for ${url}, fetching existing record`);
                const result = await db.query(
                    'SELECT * FROM site_data WHERE site_data_site_id = ? AND site_data_url_hash = ?',
                    [this.siteId, urlHash]
                );
                return result[0];
            }
            logger.error(`Error inserting site data: ${error.message}`);
            throw error;
        }
    }

    async updateSiteData(url, data, linkType = 'internal') {
        try {
            const normalized = UrlValidator.normalizeUrl(url);
            const urlHash = UrlValidator.generateUrlHash(normalized);
            // Only store actual title/description — never use URL in these columns.
            const rawTitle = data && data.title ? String(data.title).trim() : '';
            const titleSource = this.isValidTitleOrDescription(rawTitle) ? rawTitle : '';
            const rawDescription = data && data.description ? String(data.description).trim() : '';
            const descriptionSource = this.isValidTitleOrDescription(rawDescription) ? rawDescription : '';
            const contentHash = computeContentHash(data.title, data.article);
            await db.query(
                `UPDATE site_data SET
                    site_data_title = ?, site_data_description = ?, site_data_keywords = ?,
                    site_data_author = ?, site_data_generator = ?, site_data_h1 = ?,
                    site_data_h2 = ?, site_data_h3 = ?, site_data_h4 = ?,
                    site_data_article = ?, site_data_icon = ?, site_data_last_update = NOW(),
                    link_type = ?, site_data_metadata = ?, content_hash = ?
                WHERE site_data_site_id = ? AND site_data_url_hash = ?`,
                [
                    this.truncate(titleSource, 500),
                    this.truncate(descriptionSource, 1048000),
                    this.truncate(data.keywords, 1048000),
                    this.truncate(data.author, 255),
                    this.truncate(data.generator, 255),
                    this.truncate(data.h1, 1048000),
                    this.truncate(data.h2, 1048000),
                    this.truncate(data.h3, 1048000),
                    this.truncate(data.h4, 1048000),
                    this.truncate(data.article, 2096000),
                    this.truncate(data.icon, 2048),
                    linkType,
                    data.metadata || null,
                    contentHash,
                    this.siteId, urlHash
                ]
            );

            const result = await db.query(
                'SELECT * FROM site_data WHERE site_data_site_id = ? AND site_data_url_hash = ?',
                [this.siteId, urlHash]
            );

            logger.info(`Site data updated: ${normalized} (link_type: ${linkType})`);
            return result[0];
        } catch (error) {
            logger.error(`Error updating site data: ${error.message}`);
            throw error;
        }
    }

    async updateStatus(url, status) {
        try {
            const normalized = UrlValidator.normalizeUrl(url);
            const urlHash = UrlValidator.generateUrlHash(normalized);
            await db.query(
                'UPDATE site_data SET status = ? WHERE site_data_site_id = ? AND site_data_url_hash = ?',
                [status, this.siteId, urlHash]
            );
        } catch (error) {
            logger.error(`Error updating status: ${error.message}`);
        }
    }

    /**     
     * Returns Map<urlHash, { status, content_hash }>.
     */
    static async getExistingPagesMap(siteId) {
        const rows = await db.query(
            'SELECT site_data_url_hash, status, content_hash FROM site_data WHERE site_data_site_id = ?',
            [siteId]
        );
        const map = new Map();
        for (const r of rows || []) {
            map.set(r.site_data_url_hash, { status: r.status, content_hash: r.content_hash || null });
        }
        return map;
    }

    /**
     * Count of crawled (indexed) pages for this site.
     */
    static async getCrawledCount(siteId) {
        const rows = await db.query(
            'SELECT COUNT(*) AS c FROM site_data WHERE site_data_site_id = ? AND status IN (\'indexed\', \'pending\')',
            [siteId]
        );
        return (rows && rows[0]) ? (rows[0].c || 0) : 0;
    }

    /**
     * Returns false if the value is a URL/link — title and description must never store URLs.
     */
    isValidTitleOrDescription(value) {
        if (!value || typeof value !== 'string') return false;
        const trimmed = value.trim();
        if (!trimmed) return false;
        // Reject strings that look like URLs (http/https or common URL patterns)
        if (/^https?:\/\//i.test(trimmed)) return false;
        if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return false;
        if (/^www\./i.test(trimmed) && trimmed.includes('.')) return false;
        return true;
    }

    truncate(str, len) {
        if (!str) return '';
        
        let strValue = String(str)
            .replace(/[\u{1F600}-\u{1FAFF}]/gu, '')
            .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
            .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
            .replace(/[\u{2600}-\u{27BF}]/gu, '')
            .replace(/[^\x00-\x7F]/g, '');

        return strValue.length > len ? strValue.slice(0, len) : strValue;
    }
}

module.exports = DataHandler;
