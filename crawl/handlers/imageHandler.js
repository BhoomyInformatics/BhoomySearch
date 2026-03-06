const { db } = require('../config/db');
const UrlValidator = require('../utils/urlValidator');
const DuplicateChecker = require('../utils/duplicateChecker');
const logger = require('../utils/logger');

class ImageHandler {
    constructor(siteId, siteDataId, url) {
        this.siteId = siteId;
        this.siteDataId = siteDataId;
        this.url = url;
    }

    async saveImage(imgUrl, title = '', alt = '', width = null, height = null) {
        try {
            const fullUrl = UrlValidator.resolveUrl(this.url, imgUrl);
            const normalized = UrlValidator.normalizeUrl(fullUrl);
            if (!normalized || (!normalized.startsWith('http://') && !normalized.startsWith('https://'))) {
                logger.warn(`Invalid or non-http image URL skipped: ${fullUrl}`);
                return false;
            }
            const domain = UrlValidator.getDomain(normalized);
            if (!domain) return false;

            const isDuplicate = await DuplicateChecker.checkImageDuplicate(this.siteId, normalized);
            if (isDuplicate) {
                await this.updateImage(normalized, title, alt, width, height);
                return true;
            }

            const cleanTitle = this.sanitizeTitle(title || alt || UrlValidator.getFilenameFromUrl(normalized));
            const format = this.getImageFormat(normalized);

            try {
                await db.query(
                    `INSERT INTO site_img (site_img_site_id, site_img_data_id, site_img_title, site_img_alt, site_img_link, site_img_width, site_img_height, site_img_format) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [this.siteId, this.siteDataId, cleanTitle, alt, normalized, width, height, format]
                );
                logger.info(`Image saved: ${normalized}`);
            } catch (error) {
                if (error.code === 'ER_DUP_ENTRY' || error.code === 1062) {
                    await this.updateImage(normalized, title, alt, width, height);
                    logger.info(`Image updated (duplicate): ${normalized}`);
                } else {
                    throw error;
                }
            }
            return true;
        } catch (error) {
            logger.error(`Error saving image: ${error.message}`);
            return false;
        }
    }

    async updateImage(imgUrl, title = '', alt = '', width = null, height = null) {
        try {
            const normalized = UrlValidator.normalizeUrl(imgUrl);
            const storedLink = await DuplicateChecker.getStoredImageLink(this.siteId, normalized);
            const whereLink = storedLink || normalized;
            const cleanTitle = this.sanitizeTitle(title || alt || UrlValidator.getFilenameFromUrl(normalized));
            const format = this.getImageFormat(normalized);

            await db.query(
                `UPDATE site_img SET 
                 site_img_site_id = ?, site_img_data_id = ?, site_img_title = ?, site_img_alt = ?, site_img_width = ?, site_img_height = ?, site_img_format = ?, site_img_link = ?
                 WHERE site_img_site_id = ? AND site_img_link = ?`,
                [this.siteId, this.siteDataId, cleanTitle, alt, width, height, format, normalized, this.siteId, whereLink]
            );

            return true;
        } catch (error) {
            logger.error(`Error updating image: ${error.message}`);
            return false;
        }
    }

    async extractAndSaveImages($, domain) {
        const images = [];
        const self = this;

        $('img[src]').each(function() {
            try {
                const src = $(this).attr('src');
                if (!src) return;

                const fullUrl = UrlValidator.resolveUrl(self.url, src);
                const domainMatch = fullUrl.match(/^(?:https?:)?(?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:\/\n]+)/);
                
                if (domainMatch && domainMatch[1] === domain) {
                    const alt = $(this).attr('alt') || '';
                    const title = $(this).attr('title') || '';
                    const width = parseInt($(this).attr('width')) || null;
                    const height = parseInt($(this).attr('height')) || null;
                    if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) return;
                    if (fullUrl.match(/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i)) {
                        images.push({ url: fullUrl, title, alt, width, height });
                    }
                }
            } catch (error) {
                // Skip invalid images
            }
        });

        for (const img of images) {
            await this.saveImage(img.url, img.title, img.alt, img.width, img.height);
        }

        return images.length;
    }

    getImageFormat(url) {
        try {
            const match = url.match(/\.(jpg|jpeg|png|gif|bmp|webp|svg|tiff|ico)$/i);
            return match ? match[1].toLowerCase() : null;
        } catch {
            return null;
        }
    }

    sanitizeTitle(title) {
        if (!title) return '';
        return title
            .replace(/[\u{1F600}-\u{1FAFF}]/gu, '')
            .replace(/[\u{2600}-\u{27BF}]/gu, '')
            .replace(/[^\x00-\x7F]/g, '')
            .substring(0, 500);
    }
}

module.exports = ImageHandler;
