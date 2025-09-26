const { logger } = require('../utils/logger');
const crypto = require('crypto');
const { ImageDuplicateChecker } = require('../utils/imageDuplicateChecker');
const { SecureDatabase } = require('../utils/secure-db');
const { BatchProcessor } = require('../utils/batch-processor');

class ContentIndexer {
    constructor(dbConnection) {
        this.dbConnection = dbConnection;
        
        // Initialize SecureDatabase for SQL injection protection
        this.secureDb = new SecureDatabase(dbConnection);
        
        // Initialize BatchProcessor for robust promise handling
        this.batchProcessor = new BatchProcessor({
            maxRetries: 3,
            retryDelay: 1000,
            timeoutMs: 30000,
            concurrencyLimit: 10,
            enableMonitoring: true
        });
        
        // Initialize ImageDuplicateChecker for image deduplication
        this.imageDuplicateChecker = new ImageDuplicateChecker(dbConnection, {
            maxCacheSize: 50000,
            batchSize: 200,
            enableUrlNormalization: true
        });
        
        logger.info('ContentIndexer initialized (Database-only mode)', { 
            service: 'ContentIndexer',
            mode: 'database_only',
            elasticsearch: 'disabled',
            sqlInjectionProtection: 'enabled',
            batchProcessing: 'enabled'
        });
    }

    async indexContent(parsedData, url, siteId) {
        try {
            logger.info('Starting content indexing (Database-only)', { 
                url, 
                siteId,
                hasTitle: !!parsedData.title,
                hasArticle: !!parsedData.article,
                articleLength: parsedData.article ? parsedData.article.length : 0
            });

            // Ensure we have a valid siteId
            if (!siteId) {
                // Try to get siteId from URL
                const [existingSite] = await this.dbConnection.query(
                    'SELECT site_id FROM sites WHERE site_url = ?',
                    [url]
                );
                
                if (existingSite && existingSite.length > 0) {
                    siteId = existingSite[0].site_id;
                    logger.info('Retrieved site ID from database', { url, siteId });
                } else {
                    // Create new site if it doesn't exist
                    const [result] = await this.dbConnection.query(
                        `INSERT INTO sites (
                            site_url, site_title, site_active, site_locked,
                            site_priority, site_crawl_frequency, site_created
                        ) VALUES (?, ?, 1, 0, 5, 'daily', NOW())`,
                        [url, new URL(url).hostname]
                    );
                    siteId = result.insertId;
                    logger.info('Created new site record', { url, siteId });
                }
            }

            // Index to database only (Elasticsearch indexing removed)
            const dbResult = await this.indexToDatabase(parsedData, url, siteId);
            
            // Handle duplicate entries
            if (dbResult.isDuplicate) {
                logger.info('Content already exists in database, skipping indexing', { 
                    url, 
                    siteId, 
                    insertId: dbResult.insertId,
                    message: dbResult.message
                });
                
                return {
                    success: true,
                    dbId: dbResult.insertId,
                    elasticId: null, // Always null since Elasticsearch is disabled
                    isDuplicate: true,
                    message: dbResult.message
                };
            }
            
            logger.info('Database indexing successful', { 
                url, 
                siteId, 
                insertId: dbResult.insertId 
            });
            
            // Elasticsearch indexing removed - autosync_elastic.js will handle this separately
            
            logger.info('Content indexed successfully (Database-only)', { 
                url, 
                siteId, 
                dbId: dbResult.insertId,
                elasticId: null // Always null since Elasticsearch is disabled
            });
            
            return {
                success: true,
                dbId: dbResult.insertId,
                elasticId: null // Always null since Elasticsearch is disabled
            };
        } catch (error) {
            logger.error('Error indexing content', { 
                url, 
                siteId, 
                error: error.message,
                stack: error.stack,
                sqlState: error.sqlState,
                errno: error.errno,
                code: error.code
            });
            throw error;
        }
    }

    /**
     * Safely convert any value to string and truncate to specified length
     * Handles objects, arrays, and other non-string types gracefully
     */
    safeStringTruncate(value, maxLength) {
        try {
            if (value === null || value === undefined) {
                return '';
            }
            
            let stringValue;
            
            // Convert to string based on type
            if (typeof value === 'string') {
                stringValue = value;
            } else if (typeof value === 'object') {
                // Handle objects/arrays by checking for common properties first
                if (value.rendered && typeof value.rendered === 'string') {
                    // WordPress API format: { rendered: "actual content" }
                    stringValue = value.rendered;
                } else if (value.raw && typeof value.raw === 'string') {
                    // WordPress API format: { raw: "actual content" }
                    stringValue = value.raw;
                } else if (Array.isArray(value)) {
                    // Join arrays with commas
                    stringValue = value.join(', ');
                } else {
                    // For other objects, stringify and then parse if needed
                    stringValue = JSON.stringify(value);
                }
            } else {
                // For numbers, booleans, etc.
                stringValue = String(value);
            }
            
            // Ensure we have a string and truncate
            stringValue = String(stringValue || '').trim();
            
            if (stringValue.length > maxLength) {
                return stringValue.substring(0, maxLength);
            }
            
            return stringValue;
            
        } catch (error) {
            logger.warn('Error in safeStringTruncate, returning empty string', { 
                value: typeof value,
                error: error.message 
            });
            return '';
        }
    }

    /**
     * Extract plain text value from various data structures
     * Handles WordPress JSON API objects, arrays, and other structured data
     * This is similar to safeStringTruncate but focuses on clean text extraction without truncation
     */
    extractTextValue(value) {
        try {
            if (value === null || value === undefined) {
                return '';
            }
            
            // If it's already a string, return it trimmed
            if (typeof value === 'string') {
                return value.trim();
            }
            
            // Handle WordPress JSON API objects and other structured data
            if (typeof value === 'object' && value !== null) {
                // Handle WordPress rendered content
                if (value.rendered && typeof value.rendered === 'string') {
                    return value.rendered.trim();
                }
                
                // Handle WordPress raw content
                if (value.raw && typeof value.raw === 'string') {
                    return value.raw.trim();
                }
                
                // Handle WordPress plain content
                if (value.plain && typeof value.plain === 'string') {
                    return value.plain.trim();
                }
                
                // Handle arrays - take first string element or join
                if (Array.isArray(value)) {
                    if (value.length === 0) return '';
                    
                    // If array of strings, join them
                    if (value.every(item => typeof item === 'string')) {
                        return value.join(', ').trim();
                    }
                    
                    // Take first item and recursively extract
                    return this.extractTextValue(value[0]);
                }
                
                // Handle objects with common text fields
                if (value.text && typeof value.text === 'string') {
                    return value.text.trim();
                }
                
                if (value.title && typeof value.title === 'string') {
                    return value.title.trim();
                }
                
                if (value.content && typeof value.content === 'string') {
                    return value.content.trim();
                }
                
                // For other objects, try to stringify (but this should be rare)
                try {
                    const stringified = JSON.stringify(value);
                    // Only return stringified if it's short (likely a simple object)
                    if (stringified.length < 500) {
                        return stringified.trim();
                    } else {
                        logger.warn('Large object detected in extractTextValue, returning empty string', { 
                            url: 'unknown',
                            objectLength: stringified.length 
                        });
                        return '';
                    }
                } catch (stringifyError) {
                    logger.warn('Failed to stringify object for text extraction', { 
                        error: stringifyError.message 
                    });
                    return '';
                }
            }
            
            // For numbers, booleans, etc., convert to string
            return String(value).trim();
            
        } catch (error) {
            logger.warn('Error in extractTextValue, returning empty string', { 
                value: typeof value,
                error: error.message 
            });
            return '';
        }
    }
    
    // All Elasticsearch-related methods have been removed
    // Database-only indexing methods continue below

    async indexToDatabase(parsedData, url, siteId) {
        try {
            if (!parsedData || !url) {
                throw new Error('Missing required parameters for indexing');
            }

            const decodedUrl = this.decodeUrl(url);
            
            // Calculate URL hash
            const urlHash = crypto.createHash('sha256').update(decodedUrl).digest('hex');

            // Ensure siteId is a valid number
            const safeSiteId = parseInt(siteId, 10);
            if (isNaN(safeSiteId)) {
                throw new Error(`Invalid site ID: ${siteId}`);
            }

            // Check for duplicate URL with better error handling
            const duplicateCheckQuery = `
                SELECT site_data_id, site_data_title, crawl_date
                FROM site_data 
                WHERE site_data_url_hash = ? 
                AND site_data_site_id = ?
                LIMIT 1
            `;
            
            let existingRecords;
            try {
                existingRecords = await this.dbConnection.query(
                    duplicateCheckQuery, 
                    [urlHash, safeSiteId], 
                    { timeout: 10000 } // Reduced timeout from 30s to 10s
                );
            } catch (dbError) {
                // Handle specific database errors
                if (dbError.code === 'PROTOCOL_CONNECTION_LOST' || 
                    dbError.code === 'ECONNRESET' ||
                    dbError.errno === 2013) {
                    logger.error('Database connection lost during duplicate check', { 
                        url: decodedUrl, 
                        error: dbError.message,
                        errno: dbError.errno
                    });
                    throw dbError; // Re-throw connection errors
                } else {
                    logger.warn('Database duplicate check failed, proceeding with insertion', { 
                        url: decodedUrl, 
                        error: dbError.message,
                        errno: dbError.errno,
                        sqlState: dbError.sqlState
                    });
                    existingRecords = []; // Proceed as if no duplicates found
                }
            }
            
            if (existingRecords && existingRecords.length > 0) {
                const existingSiteDataId = existingRecords[0].site_data_id;
                const existingTitle = existingRecords[0].site_data_title;
                const existingDate = existingRecords[0].crawl_date;
                
                logger.info('Found existing duplicate record in database', { 
                    url: decodedUrl, 
                    existingId: existingSiteDataId,
                    existingTitle: existingTitle,
                    existingDate: existingDate
                });
                
                return {
                    insertId: existingSiteDataId,
                    isDuplicate: true,
                    message: `URL already exists in database (ID: ${existingSiteDataId})`
                };
            }

            // Determine link type - improved logic
            const linkType = this.determineLinkType(decodedUrl, parsedData, safeSiteId);

            // Handle different content types appropriately
            if (linkType === 'image') {
                return await this.indexImageDirectly(parsedData, decodedUrl, safeSiteId, urlHash);
            } else if (linkType === 'video') {
                return await this.indexVideoDirectly(parsedData, decodedUrl, safeSiteId, urlHash);
            } else if (linkType === 'document') {
                return await this.indexDocumentDirectly(parsedData, decodedUrl, safeSiteId, urlHash);
            }

            // Optimize canonical URL
            const optimizedCanonicalUrl = this.optimizeCanonicalUrl(parsedData.canonicalUrl, decodedUrl);

            // Pre-calculate metrics to avoid trigger overhead
            const article = this.safeStringTruncate(parsedData.content || parsedData.article, 16777215);
            const contentLength = article.length;
            const wordCount = article ? (article.trim().split(/\s+/).length) : 0;
            const readingTime = Math.ceil(wordCount / 200);
            const contentHash = crypto.createHash('sha256')
                .update((parsedData.title || '') + article)
                .digest('hex');

            // Prepare values array for insertion with better data validation and pre-calculated metrics
            const values = [
                safeSiteId,                                                    // site_data_site_id
                this.safeStringTruncate(decodedUrl, 2047),                     // site_data_link (truncate to fit)
                this.safeStringTruncate(parsedData.title, 499),                // site_data_title
                this.safeStringTruncate(parsedData.description, 65535),        // site_data_description
                parsedData.keywords ? this.safeStringTruncate(JSON.stringify(parsedData.keywords), 65535) : null, // site_data_keywords
                parsedData.author ? this.safeStringTruncate(this.extractCleanAuthorName(parsedData.author), 254) : null, // site_data_author
                this.safeStringTruncate(parsedData.generator, 254),            // site_data_generator
                parsedData.headings?.h1 ? this.safeStringTruncate(JSON.stringify(parsedData.headings.h1), 65535) : null, // site_data_h1
                parsedData.headings?.h2 ? this.safeStringTruncate(JSON.stringify(parsedData.headings.h2), 65535) : null, // site_data_h2
                parsedData.headings?.h3 ? this.safeStringTruncate(JSON.stringify(parsedData.headings.h3), 65535) : null, // site_data_h3
                parsedData.headings?.h4 ? this.safeStringTruncate(JSON.stringify(parsedData.headings.h4), 65535) : null, // site_data_h4
                article,                                                       // site_data_article (MEDIUMTEXT limit)
                this.safeStringTruncate(parsedData.icon, 65535),               // site_data_icon
                0,                                                             // site_data_visit
                this.safeStringTruncate(JSON.stringify(parsedData.metadata || {}), 16777215), // site_data_metadata
                urlHash,                                                       // site_data_url_hash
                contentLength,                                                 // content_length - pre-calculated
                wordCount,                                                     // word_count - pre-calculated  
                readingTime,                                                   // reading_time - pre-calculated
                contentHash,                                                   // content_hash - pre-calculated
                'indexed',                                                     // status - set directly to avoid update trigger
                linkType || 'internal'                                         // link_type - set directly
            ];

            logger.debug('Attempting to insert site_data', { 
                url: decodedUrl, 
                siteId: safeSiteId,
                linkType: linkType,
                valuesCount: values.length,
                urlHash: urlHash.substring(0, 8) + '...',
                titleLength: values[2] ? values[2].length : 0,
                contentLength: values[11] ? values[11].length : 0
            });

            // Insert into site_data table with improved error handling and pre-calculated metrics
            const insertQuery = `
                INSERT INTO site_data (
                    site_data_site_id, site_data_link, site_data_title, site_data_description,
                    site_data_keywords, site_data_author, site_data_generator,
                    site_data_h1, site_data_h2, site_data_h3, site_data_h4,
                    site_data_article, site_data_icon, site_data_visit,
                    site_data_metadata, site_data_url_hash, content_length,
                    word_count, reading_time, content_hash, status, link_type
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            let result;
            try {
                // Use direct query for data insertion
                result = await this.dbConnection.query(insertQuery, values);
            } catch (insertError) {
                // Handle duplicate key errors gracefully
                if (insertError.code === 'ER_DUP_ENTRY') {
                    logger.warn('Duplicate entry detected during insertion', { 
                        url: decodedUrl, 
                        error: insertError.message 
                    });
                    
                    // Try to get the existing record ID
                    try {
                        const existingRecord = await this.dbConnection.query(
                            'SELECT site_data_id FROM site_data WHERE site_data_url_hash = ? LIMIT 1',
                            [urlHash]
                        );
                        
                        if (existingRecord && existingRecord.length > 0) {
                            return {
                                insertId: existingRecord[0].site_data_id,
                                isDuplicate: true,
                                message: 'Duplicate entry detected during insertion'
                            };
                        }
                    } catch (selectError) {
                        logger.error('Failed to retrieve existing duplicate record', { 
                            url: decodedUrl, 
                            error: selectError.message 
                        });
                    }
                }
                
                throw insertError; // Re-throw if not a duplicate error
            }

            const insertId = result.insertId;
            logger.info('Site data inserted successfully', { 
                url: decodedUrl, 
                siteId: safeSiteId,
                insertId: insertId,
                linkType: linkType
            });

            // Insert media items (images, videos, documents) if available
            if (insertId && (parsedData.images || parsedData.videos || parsedData.documents)) {
                try {
                    await this.insertMediaItems(parsedData, safeSiteId, insertId, decodedUrl);
                } catch (mediaError) {
                    logger.warn('Failed to insert media items, but main content was saved', { 
                        url: decodedUrl, 
                        insertId, 
                        error: mediaError.message 
                    });
                }
            }

            return {
                insertId: insertId,
                isDuplicate: false,
                message: 'Content indexed successfully'
            };

        } catch (error) {
            logger.error('Error in database indexing', { 
                url, 
                siteId, 
                error: error.message,
                stack: error.stack,
                sqlState: error.sqlState,
                errno: error.errno,
                code: error.code
            });
            throw error;
        }
    }

    /**
     * Decode URL to handle international characters properly
     */
    decodeUrl(url) {
        try {
            if (!url) return url;
            
            // First decode URI components
            let decodedUrl = decodeURIComponent(url);
            
            // Handle any remaining encoded characters
            while (decodedUrl !== url && decodedUrl.includes('%')) {
                url = decodedUrl;
                decodedUrl = decodeURIComponent(url);
            }
            
            return decodedUrl;
        } catch (error) {
            logger.warn('Error decoding URL, using original', { url, error: error.message });
            return url; // Return original URL if decoding fails
        }
    }

    /**
     * Index image URL directly into site_img table
     */
    async indexImageDirectly(parsedData, url, siteId, urlHash) {
        try {
            // Use ImageDuplicateChecker to check for duplicate image URL
            logger.debug('Checking image duplicate before insertion', { url, siteId });
            const duplicateResult = await this.imageDuplicateChecker.isImageDuplicate(url, siteId);
            logger.debug('Image duplicate check result', { 
                url, 
                siteId, 
                isDuplicate: duplicateResult.isDuplicate,
                reason: duplicateResult.reason,
                imageId: duplicateResult.imageId
            });
            
            if (duplicateResult.isDuplicate) {
                logger.info('Image URL already exists (ImageDuplicateChecker)', {
                    url,
                    siteId,
                    reason: duplicateResult.reason,
                    imageId: duplicateResult.imageId
                });
                return {
                    insertId: duplicateResult.imageId || null,
                    isDuplicate: true,
                    message: 'Image URL already exists (ImageDuplicateChecker)'
                };
            }

            // Insert directly into site_img table
            const insertQuery = `
                INSERT INTO site_img (
                    site_img_site_id,
                    site_img_data_id,
                    site_img_title,
                    site_img_alt,
                    site_img_link,
                    site_img_width,
                    site_img_height,
                    site_img_size,
                    site_img_format,
                    site_img_metadata
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const values = [
                siteId,
                null, // site_img_data_id - null since this is a direct image URL
                this.safeStringTruncate(parsedData.title, 499),
                this.safeStringTruncate(parsedData.alt || parsedData.title, 65535),
                this.safeStringTruncate(url, 65535),
                parsedData.width ? parseInt(parsedData.width) : null,
                parsedData.height ? parseInt(parsedData.height) : null,
                parsedData.contentLength ? parseInt(parsedData.contentLength) : null,
                this.extractImageFormat(url),
                JSON.stringify({
                    contentType: parsedData.contentType,
                    contentLength: parsedData.contentLength,
                    responseCode: parsedData.responseCode,
                    crawledAt: new Date().toISOString(),
                    isDirectImageUrl: true
                })
            ];

            const result = await this.dbConnection.query(insertQuery, values);
            // Mark as indexed in ImageDuplicateChecker cache
            this.imageDuplicateChecker.markImageAsIndexed(url, siteId, result.insertId);
            logger.info('Image URL indexed directly to site_img table', { 
                url, 
                siteId,
                insertId: result.insertId
            });
            logger.debug('Image marked as indexed in duplicate checker cache', { 
                url, 
                siteId,
                insertId: result.insertId
            });

            return {
                insertId: result.insertId,
                isDuplicate: false,
                message: 'Image URL indexed successfully to site_img table'
            };

        } catch (error) {
            logger.error('Error indexing image URL directly', { url, siteId, error: error.message });
            throw error;
        }
    }

    /**
     * Index video URL directly into site_videos table
     */
    async indexVideoDirectly(parsedData, url, siteId, urlHash) {
        try {
            // Check for duplicate video URL
            const duplicateCheckQuery = `
                SELECT site_videos_id FROM site_videos 
                WHERE site_videos_link = ? AND site_videos_site_id = ?
                LIMIT 1
            `;
            
            const existingRecords = await this.dbConnection.query(duplicateCheckQuery, [url, siteId]);
            
            if (existingRecords && existingRecords.length > 0) {
                logger.info('Video URL already exists in site_videos table', { 
                    url, 
                    existingId: existingRecords[0].site_videos_id 
                });
                return {
                    insertId: existingRecords[0].site_videos_id,
                    isDuplicate: true,
                    message: 'Video URL already exists'
                };
            }

            // Insert directly into site_videos table
            const insertQuery = `
                INSERT INTO site_videos (
                    site_videos_site_id,
                    site_videos_data_id,
                    site_videos_title,
                    site_videos_description,
                    site_videos_link,
                    site_videos_thumbnail,
                    site_videos_width,
                    site_videos_height,
                    site_videos_format,
                    site_videos_provider,
                    site_videos_metadata
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const values = [
                siteId,
                null, // site_videos_data_id - null since this is a direct video URL
                this.safeStringTruncate(parsedData.title || '', 499),
                this.safeStringTruncate(parsedData.description || '', 65535),
                this.safeStringTruncate(url || '', 65535),
                null, // site_videos_thumbnail - null for direct video URLs
                parsedData.width ? parseInt(parsedData.width) : null,
                parsedData.height ? parseInt(parsedData.height) : null,
                this.extractVideoFormat(url || ''),
                this.extractVideoProvider(url || ''),
                JSON.stringify({
                    contentType: parsedData.contentType || '',
                    contentLength: parsedData.contentLength || 0,
                    responseCode: parsedData.responseCode || 200,
                    crawledAt: new Date().toISOString(),
                    isDirectVideoUrl: true
                })
            ];

            const result = await this.dbConnection.query(insertQuery, values);
            
            logger.info('Video URL indexed directly to site_videos table', { 
                url, 
                siteId,
                insertId: result.insertId
            });

            return {
                insertId: result.insertId,
                isDuplicate: false,
                message: 'Video URL indexed successfully to site_videos table'
            };

        } catch (error) {
            logger.error('Error indexing video URL directly', { url, siteId, error: error.message });
            throw error;
        }
    }

    /**
     * Index document URL directly into site_doc table
     */
    async indexDocumentDirectly(parsedData, url, siteId, urlHash) {
        try {
            // Skip if URL is actually an image
            if (/\.((jpe?g|png|gif|bmp|webp|svg|tiff?|ico|avif|heic|jfif))(\?|$)/i.test(url)) {
                logger.debug('indexDocumentDirectly: URL is an image, skipping document insertion', { url, siteId });
                return {
                    insertId: null,
                    isDuplicate: true,
                    message: 'Skipped image URL for document insertion'
                };
            }
            // Check for duplicate document URL
            const duplicateCheckQuery = `
                SELECT site_doc_id FROM site_doc 
                WHERE site_doc_link = ? AND site_doc_site_id = ?
                LIMIT 1
            `;
            
            const existingRecords = await this.dbConnection.query(duplicateCheckQuery, [url, siteId]);
            
            if (existingRecords && existingRecords.length > 0) {
                logger.info('Document URL already exists in site_doc table', { 
                    url, 
                    existingId: existingRecords[0].site_doc_id 
                });
                return {
                    insertId: existingRecords[0].site_doc_id,
                    isDuplicate: true,
                    message: 'Document URL already exists'
                };
            }

            // Insert directly into site_doc table
            const insertQuery = `
                INSERT INTO site_doc (
                    site_doc_site_id,
                    site_doc_data_id,
                    site_doc_title,
                    site_doc_description,
                    site_doc_link,
                    site_doc_type,
                    site_doc_size,
                    site_doc_content,
                    site_doc_metadata
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const values = [
                siteId,
                null, // site_doc_data_id - null since this is a direct document URL
                this.safeStringTruncate(parsedData.title, 499),
                this.safeStringTruncate(parsedData.description, 65535),
                this.safeStringTruncate(url, 65535),
                this.extractDocumentType(url),
                parsedData.contentLength ? parseInt(parsedData.contentLength) : null,
                this.safeStringTruncate(parsedData.content, 65535), // TEXT field limit
                JSON.stringify({
                    contentType: parsedData.contentType,
                    contentLength: parsedData.contentLength,
                    responseCode: parsedData.responseCode,
                    crawledAt: new Date().toISOString(),
                    isDirectDocumentUrl: true
                })
            ];

            const result = await this.dbConnection.query(insertQuery, values);
            
            logger.info('Document URL indexed directly to site_doc table', { 
                url, 
                siteId,
                insertId: result.insertId
            });

            return {
                insertId: result.insertId,
                isDuplicate: false,
                message: 'Document URL indexed successfully to site_doc table'
            };

        } catch (error) {
            logger.error('Error indexing document URL directly', { url, siteId, error: error.message });
            throw error;
        }
    }

    /**
     * Extract clean author name from URL or text
     * Converts: "https://www.india.com/author/analiza-pathak/" -> "Analiza Pathak"
     */
    extractCleanAuthorName(authorData) {
        if (!authorData) return '';
        
        try {
            // Convert to string if it's not already a string
            const authorString = typeof authorData === 'string' ? authorData : String(authorData);
            
            // If it's a URL, extract the name from the path
            if (authorString.startsWith('http://') || authorString.startsWith('https://')) {
                const url = new URL(authorString);
                const pathParts = url.pathname.split('/').filter(Boolean);
                
                // Look for author path pattern: /author/name/
                const authorIndex = pathParts.findIndex(part => part === 'author');
                if (authorIndex !== -1 && pathParts[authorIndex + 1]) {
                    const authorSlug = pathParts[authorIndex + 1];
                    
                    // Convert slug to proper name: "analiza-pathak" -> "Analiza Pathak"
                    return authorSlug
                        .split('-')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                        .join(' ');
                }
                
                // Fallback: use the last part of the path
                const lastPart = pathParts[pathParts.length - 1];
                if (lastPart && lastPart !== 'author') {
                    return lastPart
                        .split('-')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                        .join(' ');
                }
            }
            
            // If it's already a clean name, return as is
            return authorString.trim();
            
        } catch (error) {
            // If parsing fails, return the original data as string
            const fallbackString = typeof authorData === 'string' ? authorData : String(authorData || '');
            return fallbackString.trim();
        }
    }

    /**
     * Optimize canonical URL storage - only store if different from main URL
     */
    optimizeCanonicalUrl(canonicalUrl, mainUrl) {
        try {
            if (!canonicalUrl) return null;
            
            // Normalize both URLs for comparison
            const normalizeUrl = (url) => {
                return url.toLowerCase()
                    .replace(/\/+$/, '') // Remove trailing slashes
                    .replace(/\/$/, '');  // Remove single trailing slash
            };
            
            const normalizedCanonical = normalizeUrl(canonicalUrl);
            const normalizedMain = normalizeUrl(mainUrl);
            
            // Only store canonical URL if it's different from the main URL
            return normalizedCanonical === normalizedMain ? null : canonicalUrl;
            
        } catch (error) {
            logger.debug('Error optimizing canonical URL', { canonicalUrl, mainUrl, error: error.message });
            return canonicalUrl; // Return original if error
        }
    }

    determineLinkType(url, parsedData, siteId) {
        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname.toLowerCase();
            const hostname = urlObj.hostname.toLowerCase();
            
            // Check if this is the main/homepage
            if (pathname === '/' || pathname === '' || pathname === '/index.html' || 
                pathname === '/index.php' || pathname === '/home' || pathname === '/home.html') {
                return 'main_page';
            }
            
            // Check for specific content types based on URL patterns
            if (pathname.includes('/download') || pathname.includes('/file') || 
                /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar)$/i.test(pathname)) {
                return 'document';
            }
            
            if (pathname.includes('/image') || pathname.includes('/photo') || 
                pathname.includes('/gallery') || pathname.includes('/picture') ||
                /\.(jpg|jpeg|png|gif|webp|svg|bmp|avif|ico|tiff|tif)$/i.test(pathname)) {
                return 'image';
            }
            
            if (pathname.includes('/video') || pathname.includes('/watch') || 
                pathname.includes('/movie') || pathname.includes('/film') ||
                /\.(mp4|avi|mov|wmv|flv|webm)$/i.test(pathname)) {
                return 'video';
            }
            
            // Check for email or phone links
            if (url.startsWith('mailto:')) {
                return 'email';
            }
            if (url.startsWith('tel:')) {
                return 'phone';
            }
            
            // Check for javascript links
            if (url.startsWith('javascript:')) {
                return 'javascript';
            }
            
            // Check if it's an external link
            // First, get the site's domain from database to compare
            if (this.isExternalLink(url, siteId)) {
                return 'external';
            }
            
            // Default to internal for same-domain links
            return 'internal';
            
        } catch (error) {
            logger.debug('Error determining link type, defaulting to internal', { url, error: error.message });
            return 'internal';
        }
    }
    
    isExternalLink(url, siteId) {
        try {
            // For now, we'll consider it internal if we can't determine otherwise
            // In a full implementation, you'd query the sites table to get the site's domain
            // and compare it with the URL's domain
            const urlObj = new URL(url);
            
            // Simple heuristic: if it's a different protocol or has different subdomain structure
            // that suggests it might be external, but for now we'll be conservative
            return false;
        } catch (error) {
            return false;
        }
    }

    async insertMediaItems(parsedData, siteId, siteDataId, url) {
        try {
            // Create batch operations for robust concurrent processing
            const mediaOperations = [];

            // Create image insertion operation
            if (parsedData.images && parsedData.images.length > 0) {
                mediaOperations.push(
                    BatchProcessor.createOperation(
                        'images',
                        async (context) => {
                            logger.debug('Executing image insertion operation', { 
                                url: context.url, 
                                count: parsedData.images.length 
                            });
                            return await this.insertImages(parsedData.images, siteId, siteDataId);
                        },
                        { 
                            itemCount: parsedData.images.length,
                            mediaType: 'images',
                            url 
                        }
                    )
                );
            }

            // Create video insertion operation
            if (parsedData.videos && parsedData.videos.length > 0) {
                mediaOperations.push(
                    BatchProcessor.createOperation(
                        'videos',
                        async (context) => {
                            logger.debug('Executing video insertion operation', { 
                                url: context.url, 
                                count: parsedData.videos.length 
                            });
                            return await this.insertVideos(parsedData.videos, siteId, siteDataId);
                        },
                        { 
                            itemCount: parsedData.videos.length,
                            mediaType: 'videos',
                            url 
                        }
                    )
                );
            }

            // Create document insertion operation
            if (parsedData.documents && parsedData.documents.length > 0) {
                mediaOperations.push(
                    BatchProcessor.createOperation(
                        'documents',
                        async (context) => {
                            logger.debug('Executing document insertion operation', { 
                                url: context.url, 
                                count: parsedData.documents.length 
                            });
                            return await this.insertDocuments(parsedData.documents, siteId, siteDataId);
                        },
                        { 
                            itemCount: parsedData.documents.length,
                            mediaType: 'documents',
                            url 
                        }
                    )
                );
            }

            // Process all media operations using robust batch processor
            if (mediaOperations.length > 0) {
                const batchContext = {
                    url,
                    siteId,
                    siteDataId,
                    operation: 'insertMediaItems'
                };

                const batchResult = await this.batchProcessor.processBatch(mediaOperations, batchContext);
                
                // Log batch results with detailed statistics
                this.logMediaBatchResults(batchResult, parsedData, url, siteId, siteDataId);
                
                // Handle partial failures gracefully
                if (!batchResult.success && batchResult.errors.length > 0) {
                    logger.warn('Some media insertion operations failed', {
                        url,
                        siteId,
                        siteDataId,
                        successfulOperations: batchResult.results.length,
                        failedOperations: batchResult.errors.length,
                        errors: batchResult.errors.map(e => ({
                            type: e.operationType,
                            error: e.error
                        }))
                    });
                    
                    // Don't throw error for partial failures - allow indexing to continue
                    // Individual operations have their own error handling and logging
                }
            } else {
                logger.debug('No media items to insert', { url, siteId, siteDataId });
            }

        } catch (error) {
            logger.error('Critical error in media batch processing', { 
                url, 
                error: error.message, 
                siteId, 
                siteDataId,
                stack: error.stack
            });
            
            // Log the error but don't throw to allow main content indexing to continue
            // This ensures that media insertion failures don't block text content indexing
        }
    }

    /**
     * Log detailed results from media batch processing
     */
    logMediaBatchResults(batchResult, parsedData, url, siteId, siteDataId) {
        try {
            const totalMediaItems = (parsedData.images?.length || 0) + 
                                   (parsedData.videos?.length || 0) + 
                                   (parsedData.documents?.length || 0);

            const batchStats = {
                url,
                siteId,
                siteDataId,
                batchId: batchResult.batchId,
                summary: {
                    totalOperations: batchResult.results.length + batchResult.errors.length,
                    successfulOperations: batchResult.results.length,
                    failedOperations: batchResult.errors.length,
                    totalMediaItems,
                    successRate: batchResult.results.length > 0 ? 
                        `${((batchResult.results.length / (batchResult.results.length + batchResult.errors.length)) * 100).toFixed(1)}%` : '0%'
                },
                breakdown: {
                    images: parsedData.images?.length || 0,
                    videos: parsedData.videos?.length || 0,
                    documents: parsedData.documents?.length || 0
                },
                performance: batchResult.stats
            };

            if (batchResult.success) {
                logger.info('Media batch processing completed successfully', batchStats);
            } else {
                logger.warn('Media batch processing completed with failures', {
                    ...batchStats,
                    failureDetails: batchResult.errors.map(error => ({
                        operationType: error.operationType,
                        errorMessage: error.error,
                        operationIndex: error.index
                    }))
                });
            }

            // Log performance metrics for monitoring
            if (batchResult.stats.runtime) {
                const runtimeMs = parseInt(batchResult.stats.runtime.replace('ms', ''));
                const thresholdMs = parseInt(process.env.SLOW_MEDIA_THRESHOLD_MS || '15000');
                if (runtimeMs > thresholdMs) { // Log slow batches over threshold
                    logger.warn('Slow media batch processing detected', {
                        url,
                        runtime: batchResult.stats.runtime,
                        totalOperations: batchResult.results.length + batchResult.errors.length,
                        itemsPerSecond: batchResult.stats.itemsPerSecond
                    });
                }
            }

        } catch (error) {
            logger.error('Error logging media batch results', {
                url,
                siteId,
                siteDataId,
                error: error.message
            });
        }
    }

    /**
     * Get batch processing performance statistics
     */
    getBatchProcessingStats() {
        return this.batchProcessor.getPerformanceReport();
    }

    /**
     * Reset batch processing statistics
     */
    resetBatchProcessingStats() {
        this.batchProcessor.resetStats();
        logger.info('Batch processing statistics reset', { 
            service: 'ContentIndexer',
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Enhanced error handling for individual batch operations
     */
    async executeWithEnhancedErrorHandling(operation, operationType, context = {}) {
        try {
            const startTime = Date.now();
            const result = await operation();
            const duration = Date.now() - startTime;

            logger.debug(`${operationType} operation completed successfully`, {
                ...context,
                duration: `${duration}ms`
            });

            return { success: true, result, duration };

        } catch (error) {
            logger.error(`${operationType} operation failed`, {
                ...context,
                error: error.message,
                errorType: error.constructor.name,
                stack: error.stack
            });

            return { 
                success: false, 
                error: error.message, 
                errorType: error.constructor.name 
            };
        }
    }

    async insertImages(images, siteId, siteDataId) {
        if (!images || images.length === 0) {
            return;
        }

        try {
            const uniqueImages = [];
            for (const image of images) {
                if (!image.url) continue;

                const duplicateCheck = await this.imageDuplicateChecker.isImageDuplicate(image.url, siteId);
                if (!duplicateCheck.isDuplicate) {
                    uniqueImages.push(image);
                    // Mark as indexed in cache to prevent race conditions within the same batch
                    this.imageDuplicateChecker.markImageAsIndexed(image.url, siteId, null); // No ID yet
                }
            }

            if (uniqueImages.length === 0) {
                logger.debug('All images were duplicates, nothing to insert.', { siteId, siteDataId });
                return;
            }

            // Prepare records for secure batch insert with enhanced metadata
            const records = uniqueImages.map(image => [
                this.secureDb.sanitizeInput(siteId, 'integer'),
                this.secureDb.sanitizeInput(siteDataId, 'integer'),
                (this.secureDb.sanitizeInput(image.url, 'url') || '').substring(0, 1024),
                (this.secureDb.sanitizeInput(image.alt || '', 'general') || '').substring(0, 255),
                (this.secureDb.sanitizeInput(image.title || '', 'general') || '').substring(0, 255),
                image.width ? this.secureDb.sanitizeInput(image.width, 'integer') : null,
                image.height ? this.secureDb.sanitizeInput(image.height, 'integer') : null,
                image.fileSize ? this.secureDb.sanitizeInput(image.fileSize, 'integer') : null,
                (this.secureDb.sanitizeInput(image.format || this.extractImageFormat(image.url), 'filename') || '').substring(0, 50),
                JSON.stringify({ 
                    originalData: image, 
                    insertedAt: new Date().toISOString(),
                    // Include optimization metadata if available
                    optimized: image.optimized || false,
                    originalFormat: image.originalFormat || image.format,
                    originalSize: image.originalSize || image.fileSize,
                    compressionRatio: image.compressionRatio || 0,
                    qualityScore: image.qualityScore || null
                })
            ]);

            // Define table fields
            const fields = [
                'site_img_site_id', 'site_img_data_id', 'site_img_link', 'site_img_alt', 
                'site_img_title', 'site_img_width', 'site_img_height', 'site_img_size', 
                'site_img_format', 'site_img_metadata'
            ];

            // Execute secure batch insert with duplicate handling
            await this.secureDb.executeBatchInsert('site_img', fields, records, {
                timeout: 30000,
                duplicateKeyUpdate: {
                    site_img_alt: 'VALUES(site_img_alt)',
                    site_img_title: 'VALUES(site_img_title)',
                    site_img_metadata: 'VALUES(site_img_metadata)'
                }
            });
            logger.debug(`Successfully inserted ${uniqueImages.length} unique images.`, { siteId, siteDataId });

        } catch (error) {
            logger.warn('Bulk image insert failed, attempting individual inserts.', { siteId, error: error.message });
            await this.insertImagesIndividually(images, siteId, siteDataId);
        }
    }

    async insertImagesIndividually(images, siteId, siteDataId) {
        const safeSiteId = siteId !== undefined ? siteId : null;
        const safeSiteDataId = siteDataId !== undefined ? siteDataId : null;
        
        for (const image of images) {
            try {
                if (!image.url) continue;

                const duplicateCheck = await this.imageDuplicateChecker.isImageDuplicate(image.url, siteId);
                if (duplicateCheck.isDuplicate) {
                    logger.debug('Skipping duplicate image in individual insert.', { imageUrl: image.url, siteId });
                    continue;
                }

                const insertQuery = `
                    INSERT INTO site_img (
                        site_img_site_id,
                        site_img_data_id,
                        site_img_title,
                        site_img_alt,
                        site_img_link,
                        site_img_width,
                        site_img_height,
                        site_img_size,
                        site_img_format,
                        site_img_metadata
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;

                const values = [
                    safeSiteId,
                    safeSiteDataId,
                    this.safeStringTruncate(image.title || image.alt, 255),
                    this.safeStringTruncate(image.alt, 255),
                    this.safeStringTruncate(image.url || image.src, 2000),
                    image.width ? parseInt(image.width) : null,
                    image.height ? parseInt(image.height) : null,
                    image.fileSize || null,
                    this.extractImageFormat(image.url || image.src || ''),
                    JSON.stringify({
                        originalData: image,
                        extractedAt: new Date().toISOString(),
                        // Include optimization metadata if available
                        optimized: image.optimized || false,
                        originalFormat: image.originalFormat || image.format,
                        originalSize: image.originalSize || image.fileSize,
                        compressionRatio: image.compressionRatio || 0,
                        qualityScore: image.qualityScore || null
                    })
                ];

                await this.executeQuery(insertQuery, values);
                
                // Mark as indexed in cache after successful insert
                this.imageDuplicateChecker.markImageAsIndexed(image.url, siteId, null); // We don't have the new ID here, but can still cache the URL

            } catch (error) {
                logger.warn('Failed to insert individual image', { error: error.message, imageUrl: image.url });
            }
        }
    }

    async insertVideos(videos, siteId, siteDataId) {
        try {
            if (!videos || videos.length === 0) return;
            
            // Ensure parameters are not undefined
            const safeSiteId = siteId !== undefined ? siteId : null;
            const safeSiteDataId = siteDataId !== undefined ? siteDataId : null;
            
            // Prepare records for secure batch insert
            const records = videos.map(video => [
                this.secureDb.sanitizeInput(safeSiteId, 'integer'),
                this.secureDb.sanitizeInput(safeSiteDataId, 'integer'),
                (this.secureDb.sanitizeInput(video.title, 'general') || '').substring(0, 255),
                (this.secureDb.sanitizeInput(video.description, 'general') || '').substring(0, 1000),
                (this.secureDb.sanitizeInput(video.url || video.src, 'url') || '').substring(0, 2000),
                (this.secureDb.sanitizeInput(video.thumbnail || video.poster, 'url') || '').substring(0, 2000),
                video.width ? this.secureDb.sanitizeInput(video.width, 'integer') : null,
                video.height ? this.secureDb.sanitizeInput(video.height, 'integer') : null,
                this.secureDb.sanitizeInput(this.extractVideoFormat(video.url || video.src || ''), 'filename'),
                this.secureDb.sanitizeInput(this.extractVideoProvider(video.url || video.src || ''), 'general'),
                JSON.stringify({
                    originalData: video,
                    extractedAt: new Date().toISOString()
                })
            ]);

            // Define table fields
            const fields = [
                'site_videos_site_id', 'site_videos_data_id', 'site_videos_title', 
                'site_videos_description', 'site_videos_link', 'site_videos_thumbnail',
                'site_videos_width', 'site_videos_height', 'site_videos_format',
                'site_videos_provider', 'site_videos_metadata'
            ];

            // Execute secure batch insert
            await this.secureDb.executeBatchInsert('site_videos', fields, records, {
                timeout: 30000
            });
            
            logger.debug('Videos batch inserted', { count: videos.length, siteId: safeSiteId, siteDataId: safeSiteDataId });
        } catch (error) {
            logger.error('Error batch inserting videos', { error: error.message, siteId, siteDataId });
            // Fallback to individual inserts if batch fails
            await this.insertVideosIndividually(videos, siteId, siteDataId);
        }
    }

    async insertVideosIndividually(videos, siteId, siteDataId) {
        const safeSiteId = siteId !== undefined ? siteId : null;
        const safeSiteDataId = siteDataId !== undefined ? siteDataId : null;
        
        for (const video of videos) {
            try {
                const insertQuery = `
                    INSERT INTO site_videos (
                        site_videos_site_id,
                        site_videos_data_id,
                        site_videos_title,
                        site_videos_description,
                        site_videos_link,
                        site_videos_thumbnail,
                        site_videos_width,
                        site_videos_height,
                        site_videos_format,
                        site_videos_provider,
                        site_videos_metadata
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;

                const values = [
                    safeSiteId,
                    safeSiteDataId,
                    this.safeStringTruncate(video.title || '', 255),
                    this.safeStringTruncate(video.description || '', 1000),
                    this.safeStringTruncate(video.url || video.src || '', 2000),
                    this.safeStringTruncate(video.thumbnail || video.poster || '', 2000),
                    video.width ? parseInt(video.width) : null,
                    video.height ? parseInt(video.height) : null,
                    this.extractVideoFormat(video.url || video.src || ''),
                    this.extractVideoProvider(video.url || video.src || ''),
                    JSON.stringify({
                        originalData: video,
                        extractedAt: new Date().toISOString()
                    })
                ];

                await this.executeQuery(insertQuery, values);
            } catch (error) {
                logger.warn('Failed to insert individual video', { error: error.message, videoUrl: video.url });
            }
        }
    }

    async insertDocuments(documents, siteId, siteDataId) {
        try {
            if (!documents || documents.length === 0) return;
            
            // Ensure parameters are not undefined
            const safeSiteId = siteId !== undefined ? siteId : null;
            const safeSiteDataId = siteDataId !== undefined ? siteDataId : null;
            
            // Filter out duplicates before insertion
            const uniqueDocuments = [];
            for (const doc of documents) {
                const documentUrl = doc.url || doc.href || '';
                if (!documentUrl) continue;
                
                try {
                    // Check for duplicate document URL
                    const duplicateCheckQuery = `
                        SELECT site_doc_id FROM site_doc 
                        WHERE site_doc_link = ? AND site_doc_site_id = ?
                        LIMIT 1
                    `;
                    
                    const existingRecords = await this.dbConnection.query(duplicateCheckQuery, [documentUrl, safeSiteId]);
                    
                    if (existingRecords && existingRecords.length > 0) {
                        logger.debug('Skipping duplicate document', { 
                            url: documentUrl, 
                            existingId: existingRecords[0].site_doc_id,
                            siteId: safeSiteId
                        });
                        continue; // Skip this document
                    }
                    
                    uniqueDocuments.push(doc);
                } catch (duplicateCheckError) {
                    logger.warn('Error checking document duplicate, including in batch', { 
                        url: documentUrl, 
                        error: duplicateCheckError.message 
                    });
                    uniqueDocuments.push(doc); // Include if duplicate check fails
                }
            }
            
            if (uniqueDocuments.length === 0) {
                logger.debug('All documents were duplicates, nothing to insert', { siteId: safeSiteId });
                return;
            }
            
            // Prepare records for secure batch insert
            const records = uniqueDocuments.map(doc => [
                this.secureDb.sanitizeInput(safeSiteId, 'integer'),
                this.secureDb.sanitizeInput(safeSiteDataId, 'integer'),
                (this.secureDb.sanitizeInput(doc.title, 'general') || '').substring(0, 255),
                (this.secureDb.sanitizeInput(doc.description, 'general') || '').substring(0, 1000),
                (this.secureDb.sanitizeInput(doc.url || doc.href, 'url') || '').substring(0, 2000),
                this.secureDb.sanitizeInput(this.extractDocumentType(doc.url || doc.href || ''), 'filename'),
                doc.size ? this.secureDb.sanitizeInput(doc.size, 'integer') : null,
                (this.secureDb.sanitizeInput(doc.content, 'general') || '').substring(0, 65535), // TEXT field limit
                JSON.stringify({
                    originalData: doc,
                    extractedAt: new Date().toISOString()
                })
            ]);

            // Define table fields
            const fields = [
                'site_doc_site_id', 'site_doc_data_id', 'site_doc_title',
                'site_doc_description', 'site_doc_link', 'site_doc_type',
                'site_doc_size', 'site_doc_content', 'site_doc_metadata'
            ];

            // Execute secure batch insert
            await this.secureDb.executeBatchInsert('site_doc', fields, records, {
                timeout: 30000
            });
            
            logger.debug('Documents batch inserted', { 
                totalDocuments: documents.length,
                uniqueInserted: uniqueDocuments.length,
                duplicatesSkipped: documents.length - uniqueDocuments.length,
                siteId: safeSiteId, 
                siteDataId: safeSiteDataId 
            });
        } catch (error) {
            logger.error('Error batch inserting documents', { error: error.message, siteId, siteDataId });
            // Fallback to individual inserts if batch fails
            await this.insertDocumentsIndividually(documents, siteId, siteDataId);
        }
    }

    async insertDocumentsIndividually(documents, siteId, siteDataId) {
        const safeSiteId = siteId !== undefined ? siteId : null;
        const safeSiteDataId = siteDataId !== undefined ? siteDataId : null;
        
        let insertedCount = 0;
        let duplicateCount = 0;
        
        for (const doc of documents) {
            try {
                const documentUrl = doc.url || doc.href || '';
                if (!documentUrl) continue;
                
                // Skip image URLs mistakenly classified as documents
                if (/\.((jpe?g|png|gif|bmp|webp|svg|tiff?|ico|avif|heic|jfif))(\?|$)/i.test(documentUrl)) {
                    logger.debug('Skipping image URL in document insertion', { url: documentUrl });
                    continue;
                }
                
                // Check for duplicate document URL before inserting
                const duplicateCheckQuery = `
                    SELECT site_doc_id FROM site_doc 
                    WHERE site_doc_link = ? AND site_doc_site_id = ?
                    LIMIT 1
                `;
                
                const existingRecords = await this.dbConnection.query(duplicateCheckQuery, [documentUrl, safeSiteId]);
                
                if (existingRecords && existingRecords.length > 0) {
                    logger.debug('Skipping duplicate document', { 
                        url: documentUrl, 
                        existingId: existingRecords[0].site_doc_id,
                        siteId: safeSiteId
                    });
                    duplicateCount++;
                    continue; // Skip this document
                }
                
                const insertQuery = `
                    INSERT INTO site_doc (
                        site_doc_site_id,
                        site_doc_data_id,
                        site_doc_title,
                        site_doc_description,
                        site_doc_link,
                        site_doc_type,
                        site_doc_size,
                        site_doc_content,
                        site_doc_metadata
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;

                const values = [
                    safeSiteId,
                    safeSiteDataId,
                    this.safeStringTruncate(doc.title, 255),
                    this.safeStringTruncate(doc.description, 1000),
                    this.safeStringTruncate(doc.url || doc.href, 2000),
                    this.extractDocumentType(doc.url || doc.href || ''),
                    doc.size ? parseInt(doc.size) : null,
                    this.safeStringTruncate(doc.content, 65535),
                    JSON.stringify({
                        originalData: doc,
                        extractedAt: new Date().toISOString()
                    })
                ];

                await this.executeQuery(insertQuery, values);
                insertedCount++;
            } catch (error) {
                logger.warn('Failed to insert individual document', { error: error.message, docUrl: doc.url });
            }
        }
        
        logger.debug('Documents individually processed', { 
            totalDocuments: documents.length,
            inserted: insertedCount,
            duplicatesSkipped: duplicateCount,
            siteId: safeSiteId, 
            siteDataId: safeSiteDataId 
        });
    }

    extractImageFormat(url) {
        if (!url) return null;
        const match = url.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
        return match ? match[1].toLowerCase() : null;
    }

    extractVideoFormat(url) {
        if (!url) return null;
        const match = url.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
        return match ? match[1].toLowerCase() : null;
    }

    extractVideoProvider(url) {
        if (!url) return null;
        if (url.includes('youtube.com') || url.includes('youtu.be')) return 'YouTube';
        if (url.includes('vimeo.com')) return 'Vimeo';
        if (url.includes('dailymotion.com')) return 'Dailymotion';
        if (url.includes('twitch.tv')) return 'Twitch';
        return 'Direct';
    }

    extractDocumentType(url) {
        if (!url) return null;
        const match = url.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
        if (!match) return null;
        
        const ext = match[1].toLowerCase();
        const docTypes = {
            'pdf': 'PDF',
            'doc': 'DOC',
            'docx': 'DOCX',
            'xls': 'XLS',
            'xlsx': 'XLSX',
            'ppt': 'PPT',
            'pptx': 'PPTX',
            'txt': 'TXT',
            'rtf': 'RTF'
        };
        
        return docTypes[ext] || ext.toUpperCase();
    }

    async executeQuery(query, values = []) {
        try {
            // Use secure database for all queries
            return await this.secureDb.executeSecureQuery(query, values, {
                timeout: 15000,
                sanitize: false // Values should already be sanitized by callers
            });
        } catch (error) {
            // Handle duplicate key errors gracefully
            if (error.errno === 1062 || error.code === 'ER_DUP_ENTRY') {
                logger.debug('Duplicate entry detected in executeQuery', { 
                    query: query.substring(0, 100) + '...',
                    error: error.sqlMessage || error.message
                });
                
                return {
                    isDuplicate: true,
                    insertId: null,
                    error: error.sqlMessage || error.message,
                    errno: error.errno,
                    code: error.code
                };
            }
            
            // Handle timeout errors gracefully
            if (error.message.includes('timeout') || error.code === 'PROTOCOL_SEQUENCE_TIMEOUT') {
                logger.warn('Database query timeout, continuing with graceful degradation', {
                    query: query.substring(0, 100) + '...',
                    timeout: 15000,
                    error: error.message
                });
                
                return {
                    isTimeout: true,
                    insertId: null,
                    error: 'Query timeout - operation may have succeeded'
                };
            }
            
            // Log potential SQL injection attempts
            if (this.secureDb.isSqlInjectionAttempt(error)) {
                logger.warn('Potential SQL injection attempt blocked', {
                    query: query.substring(0, 100) + '...',
                    error: error.message
                });
            }
            
            throw error;
        }
    }

    /**
     * ULTRA-FAST single record insertion with minimal overhead
     */
    async fastInsertSiteData(parsedData, url, siteId, urlHash) {
        try {
            const article = this.safeStringTruncate(parsedData.content || parsedData.article, 16777215);
            const contentLength = article.length;
            const wordCount = article ? (article.trim().split(/\s+/).length) : 0;

            // Ultra-minimal insert query for maximum speed
            const query = `
                INSERT IGNORE INTO site_data (
                    site_data_site_id, site_data_link, site_data_title, 
                    site_data_article, site_data_url_hash, content_length,
                    word_count, status, link_type
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'indexed', 'internal')
            `;

            const values = [
                siteId,
                this.safeStringTruncate(url, 2047),
                this.safeStringTruncate(parsedData.title, 499),
                article,
                urlHash,
                contentLength,
                wordCount
            ];

            const result = await this.dbConnection.query(query, values, { timeout: 3000 });
            
            return {
                insertId: result.insertId,
                isDuplicate: result.affectedRows === 0,
                message: result.affectedRows > 0 ? 'Fast insert successful' : 'Duplicate detected'
            };

        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                return {
                    insertId: null,
                    isDuplicate: true,
                    message: 'Duplicate entry'
                };
            }
            throw error;
        }
    }

    async close() {
        try {
            // Database-only mode - no Elasticsearch cleanup needed
            
            logger.info('ContentIndexer closed successfully (Database-only mode)', {
                service: 'ContentIndexer',
                mode: 'database_only'
            });
        } catch (error) {
            logger.error('Error closing ContentIndexer', { error: error.message });
        }
    }


}

module.exports = { ContentIndexer }; 