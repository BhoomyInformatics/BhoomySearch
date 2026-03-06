const { db } = require('../config/db');
const UrlValidator = require('../utils/urlValidator');
const DuplicateChecker = require('../utils/duplicateChecker');
const logger = require('../utils/logger');
const pdfParse = require('pdf-parse');

class DocumentHandler {
    constructor(siteId, siteDataId, url) {
        this.siteId = siteId;
        this.siteDataId = siteDataId;
        this.url = url;
    }

    async saveDocument(docUrl, title = '', docType = 'Document', description = '', content = '') {
        try {
            const fullUrl = UrlValidator.resolveUrl(this.url, docUrl);
            const normalized = UrlValidator.normalizeUrl(fullUrl);
            if (!normalized || (!normalized.startsWith('http://') && !normalized.startsWith('https://'))) {
                logger.warn(`Invalid or non-http document URL skipped: ${fullUrl}`);
                return false;
            }
            const isDuplicate = await DuplicateChecker.checkDocumentDuplicate(this.siteId, normalized);
            if (isDuplicate) {
                await this.updateDocument(normalized, title, docType, description, content);
                return true;
            }

            // Never store URLs in title or description — use filename/empty if value looks like URL
            const titleStr = typeof title === 'string' ? title : '';
            const descStr = typeof description === 'string' ? description : '';
            const contentStr = typeof content === 'string' ? content : '';
            const safeTitle = this.ensureNotUrl(titleStr) ? titleStr : '';
            const cleanTitle = this.sanitizeTitle(safeTitle || UrlValidator.getFilenameFromUrl(normalized));
            const cleanDescription = this.sanitizeText(this.ensureNotUrl(descStr) ? descStr : '');
            const cleanContent = this.sanitizeText(contentStr);

            try {
                const size = cleanContent ? Buffer.byteLength(cleanContent, 'utf8') : 0;
                await db.query(
                    `INSERT INTO site_doc (site_doc_site_id, site_doc_data_id, site_doc_title, site_doc_description, site_doc_link, site_doc_type, site_doc_content, site_doc_size) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [this.siteId, this.siteDataId, cleanTitle, cleanDescription, normalized, docType, cleanContent, size]
                );
                logger.info(`Document saved: ${normalized}`);
            } catch (error) {
                if (error.code === 'ER_DUP_ENTRY' || error.code === 1062) {
                    await this.updateDocument(normalized, title, docType, description, content);
                    logger.info(`Document updated (duplicate): ${normalized}`);
                } else {
                    throw error;
                }
            }
            return true;
        } catch (error) {
            logger.error(`Error saving document: ${error.message}`);
            return false;
        }
    }

    async updateDocument(docUrl, title = '', docType = 'Document', description = '', content = '') {
        try {
            const normalized = UrlValidator.normalizeUrl(docUrl);
            const storedLink = await DuplicateChecker.getStoredDocumentLink(this.siteId, normalized);
            const whereLink = storedLink || normalized;
            const titleStr = typeof title === 'string' ? title : '';
            const descStr = typeof description === 'string' ? description : '';
            const contentStr = typeof content === 'string' ? content : '';
            const safeTitle = this.ensureNotUrl(titleStr) ? titleStr : '';
            const cleanTitle = this.sanitizeTitle(safeTitle || UrlValidator.getFilenameFromUrl(normalized));
            const cleanDescription = this.sanitizeText(this.ensureNotUrl(descStr) ? descStr : '');
            const cleanContent = this.sanitizeText(contentStr);
            const size = cleanContent ? Buffer.byteLength(cleanContent, 'utf8') : 0;

            await db.query(
                `UPDATE site_doc SET site_doc_title = ?, site_doc_description = ?, site_doc_type = ?, site_doc_content = ?, site_doc_size = ?, site_doc_link = ?
                 WHERE site_doc_site_id = ? AND site_doc_link = ?`,
                [cleanTitle, cleanDescription, docType, cleanContent, size, normalized, this.siteId, whereLink]
            );

            return true;
        } catch (error) {
            logger.error(`Error updating document: ${error.message}`);
            return false;
        }
    }

    async processPdfContent(buffer, url) {
        try {
            const data = await pdfParse(buffer, {
                max: 50,
                timeout: 30000
            });

            return {
                content: data.text || '',
                pageCount: data.numpages || 0,
                title: data.info?.Title || UrlValidator.getFilenameFromUrl(url),
                author: data.info?.Author || '',
                metadata: JSON.stringify({
                    pages: data.numpages,
                    info: data.info,
                    version: data.version
                })
            };
        } catch (error) {
            logger.error(`Error processing PDF: ${error.message}`);
            return {
                content: `PDF processing failed: ${error.message}`,
                pageCount: 0,
                title: UrlValidator.getFilenameFromUrl(url),
                author: '',
                metadata: null
            };
        }
    }

    async extractAndSaveDocuments($) {
        const documents = [];
        const self = this;

        $('a[href]').each(function() {
            try {
                const href = $(this).attr('href');
                if (!href) return;

                const docExtensions = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|rtf|csv|zip|rar)$/i;
                const imageExtensions = /\.(jpg|jpeg|png|gif|bmp|webp|svg|tiff|ico)$/i;

                if (href.match(docExtensions) && !href.match(imageExtensions)) {
                    const fullUrl = UrlValidator.resolveUrl(self.url, href);
                    if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) return;
                    const linkText = $(this).text().trim();
                    const title = self.ensureNotUrl(linkText) ? linkText : UrlValidator.getFilenameFromUrl(fullUrl);
                    const rawDesc = $(this).attr('title') || $(this).attr('aria-label') || '';
                    const description = self.ensureNotUrl(rawDesc) ? rawDesc : '';
                    const docType = self.getDocumentType(fullUrl);
                    documents.push({ url: fullUrl, title, type: docType, description });
                }
            } catch (error) {
                // Skip invalid documents
            }
        });

        for (const doc of documents) {
            await this.saveDocument(doc.url, doc.title, doc.type, doc.description, '');
        }

        return documents.length;
    }

    /** Do not store URLs in site_doc_title or site_doc_description — return false if value looks like a URL. */
    ensureNotUrl(value) {
        if (!value || typeof value !== 'string') return false;
        const trimmed = value.trim();
        if (!trimmed) return false;
        if (/^https?:\/\//i.test(trimmed)) return false;
        if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return false;
        if (/^www\./i.test(trimmed) && trimmed.includes('.')) return false;
        return true;
    }

    sanitizeText(text) {
        if (text == null || typeof text !== 'string') return '';
        return text
            .replace(/[\u{1F600}-\u{1FAFF}]/gu, '')
            .replace(/[\u{2600}-\u{27BF}]/gu, '')
            .replace(/[^\x00-\x7F]/g, '');
    }

    getDocumentType(url) {
        const extension = url.split('.').pop().toLowerCase();
        const typeMap = {
            'pdf': 'PDF',
            'doc': 'Word',
            'docx': 'Word',
            'xls': 'Excel',
            'xlsx': 'Excel',
            'ppt': 'PowerPoint',
            'pptx': 'PowerPoint',
            'txt': 'Text',
            'rtf': 'Rich Text',
            'csv': 'CSV',
            'zip': 'Archive',
            'rar': 'Archive'
        };
        return typeMap[extension] || 'Document';
    }

    sanitizeTitle(title) {
        if (title == null || typeof title !== 'string') return '';
        return title
            .replace(/[\u{1F600}-\u{1FAFF}]/gu, '')
            .replace(/[\u{2600}-\u{27BF}]/gu, '')
            .replace(/[^\x00-\x7F]/g, '')
            .substring(0, 500);
    }
}

module.exports = DocumentHandler;
