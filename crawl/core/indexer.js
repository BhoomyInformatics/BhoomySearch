const { db } = require('../config/db');
const logger = require('../utils/logger');
const DuplicateChecker = require('../utils/duplicateChecker');
const UrlValidator = require('../utils/urlValidator');

class Indexer {
    constructor(siteId) {
        this.siteId = siteId;
    }

    async indexVideo(videoUrl, title, siteDataId, description = '', thumbnail = '') {
        try {
            const normalized = UrlValidator.normalizeUrl(videoUrl);
            if (!normalized || (!normalized.startsWith('http://') && !normalized.startsWith('https://'))) {
                logger.warn(`Invalid or non-http video URL skipped: ${videoUrl}`);
                return false;
            }
            const isDuplicate = await DuplicateChecker.checkVideoDuplicate(this.siteId, normalized);
            if (isDuplicate) {
                await this.updateVideo(normalized, title, siteDataId, description, thumbnail);
                return true;
            }

            const cleanTitle = this.sanitizeTitle(this.ensureNotUrl(title, 'title'));
            const cleanDescription = this.sanitizeText(this.ensureNotUrl(description, 'description'));

            try {
                await db.query(
                    `INSERT INTO site_videos (site_videos_site_id, site_videos_data_id, site_videos_link, site_videos_title, site_videos_description, site_videos_thumbnail) 
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [this.siteId, siteDataId, normalized, cleanTitle, cleanDescription, thumbnail]
                );
                logger.info(`Video indexed: ${normalized}`);
            } catch (error) {
                if (error.code === 'ER_DUP_ENTRY' || error.code === 1062) {
                    await this.updateVideo(normalized, title, siteDataId, description, thumbnail);
                    logger.info(`Video updated (duplicate): ${normalized}`);
                } else {
                    throw error;
                }
            }
            return true;
        } catch (error) {
            logger.error(`Error indexing video: ${error.message}`);
            return false;
        }
    }

    async updateVideo(videoUrl, title, siteDataId, description = '', thumbnail = '') {
        try {
            const normalized = UrlValidator.normalizeUrl(videoUrl);
            const storedLink = await DuplicateChecker.getStoredVideoLink(this.siteId, normalized);
            const whereLink = storedLink || normalized;
            const cleanTitle = this.sanitizeTitle(this.ensureNotUrl(title, 'title'));
            const cleanDescription = this.sanitizeText(this.ensureNotUrl(description, 'description'));

            await db.query(
                `UPDATE site_videos SET 
                 site_videos_site_id = ?, site_videos_data_id = ?, site_videos_title = ?, site_videos_description = ?, site_videos_thumbnail = ?, site_videos_link = ?
                 WHERE site_videos_site_id = ? AND site_videos_link = ?`,
                [this.siteId, siteDataId, cleanTitle, cleanDescription, thumbnail, normalized, this.siteId, whereLink]
            );

            return true;
        } catch (error) {
            logger.error(`Error updating video: ${error.message}`);
            return false;
        }
    }

    async indexVideos(videos, siteDataId) {
        let count = 0;
        for (const video of videos) {
            const success = await this.indexVideo(video.video, video.title, siteDataId);
            if (success) count++;
        }
        return count;
    }

    /** Do not store URLs in title/description — return empty string if value looks like a URL. */
    ensureNotUrl(value, field) {
        if (!value || typeof value !== 'string') return '';
        const trimmed = value.trim();
        if (!trimmed) return '';
        if (/^https?:\/\//i.test(trimmed)) return '';
        if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return '';
        if (/^www\./i.test(trimmed) && trimmed.includes('.')) return '';
        return value;
    }

    sanitizeTitle(title) {
        if (!title) return '';
        return title
            .replace(/[\u{1F600}-\u{1FAFF}]/gu, '')
            .replace(/[\u{2600}-\u{27BF}]/gu, '')
            .replace(/[^\x00-\x7F]/g, '')
            .substring(0, 500);
    }

    sanitizeText(text) {
        if (!text) return '';
        return text
            .replace(/[\u{1F600}-\u{1FAFF}]/gu, '')
            .replace(/[\u{2600}-\u{27BF}]/gu, '')
            .replace(/[^\x00-\x7F]/g, '');
    }
}

module.exports = Indexer;
