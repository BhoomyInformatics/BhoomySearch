const officeParser = require('officeparser');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { logger } = require('../utils/logger');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const xlsx = require('xlsx');

/**
 * Unified Document Handler for all document types
 * Handles PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, RTF, CSV and other document formats
 * Stores documents in site_doc table in the database
 */
class DocumentHandler {
    constructor() {
        this.maxContentLength = 2096000; // 2MB limit
        this.maxPages = 100; // Limit processing to first 100 pages for PDFs
        this.tempDir = path.join(__dirname, '../temp');
        
        // Supported document types with their MIME types
        this.supportedTypes = {
            'application/pdf': 'pdf',
            'application/msword': 'doc',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
            'application/vnd.ms-excel': 'xls',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
            'application/vnd.ms-powerpoint': 'ppt',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
            'text/plain': 'txt',
            'application/rtf': 'rtf',
            'text/csv': 'csv',
            'application/vnd.oasis.opendocument.text': 'odt',
            'application/vnd.oasis.opendocument.spreadsheet': 'ods',
            'application/vnd.oasis.opendocument.presentation': 'odp'
        };
        
        // Create temp directory if it doesn't exist
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }

    /**
     * Main processing method for documents
     * @param {Buffer} documentBuffer - Document buffer data
     * @param {string} url - Document URL
     * @param {object} crawlerInstance - Crawler instance
     * @param {object} responseMetadata - Response metadata containing content type
     * @returns {Promise<object>} Processing result
     */
    async process(documentBuffer, url, crawlerInstance, responseMetadata) {
        try {
            // Extract content type from response metadata
            const contentType = responseMetadata?.contentType || responseMetadata?.headers?.['content-type'] || '';
            
            logger.info('Processing document content', { 
                url, 
                contentType,
                bufferSize: documentBuffer.length 
            });

            // Determine document type from content type or URL
            const docType = this.getDocumentType(contentType, url);
            
            if (docType === 'unknown') {
                logger.warn('Unknown document type detected', { url, contentType });
            }
            
            // Process document based on type
            const parsedData = await this.processDocumentByType(documentBuffer, url, docType);
            
            // Validate content quality
            const quality = this.validateContentQuality(parsedData);
            if (quality.score < 30) {
                logger.warn('Low quality document content detected', { 
                    url, 
                    score: quality.score,
                    issues: quality.issues 
                });
            }
            
            // Map to database row format for site_data table (for consistency)
            crawlerInstance.site_data_db_row = this.mapToSiteDataRow(parsedData, url);
            
            // Store document in site_doc table
            const storeResult = await this.storeDocumentData(parsedData, url, crawlerInstance);

            logger.info('Document processing completed', { 
                url,
                type: docType,
                title: parsedData.title?.substring(0, 50) + '...',
                contentLength: parsedData.content?.length || 0,
                insertId: storeResult.insertId,
                qualityScore: quality.score,
                isDuplicate: storeResult.isDuplicate,
                message: storeResult.message
            });

            return {
                parsedData,
                extractedLinks: [], // Documents typically don't have crawlable links
                success: true,
                insertId: storeResult.insertId,
                qualityScore: quality.score,
                isDuplicate: storeResult.isDuplicate,
                message: storeResult.message
            };
        } catch (error) {
            logger.error('Error processing document content', { 
                url, 
                contentType: responseMetadata?.contentType,
                error: error.message,
                stack: error.stack 
            });
            throw error;
        }
    }

    /**
     * Determine document type from content type or URL extension
     */
    getDocumentType(contentType, url) {
        // Check MIME type first
        if (contentType && this.supportedTypes[contentType]) {
            return this.supportedTypes[contentType];
        }

        // Fallback to URL extension
        const urlMatch = url.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
        if (urlMatch) {
            const ext = urlMatch[1].toLowerCase();
            const typeMap = {
                'pdf': 'pdf',
                'doc': 'doc', 
                'docx': 'docx',
                'xls': 'xls',
                'xlsx': 'xlsx',
                'ppt': 'ppt',
                'pptx': 'pptx',
                'txt': 'txt',
                'rtf': 'rtf',
                'csv': 'csv',
                'odt': 'odt',
                'ods': 'ods',
                'odp': 'odp'
            };
            return typeMap[ext] || 'unknown';
        }

        return 'unknown';
    }

    /**
     * Process document based on its type
     */
    async processDocumentByType(documentBuffer, url, docType) {
        switch (docType) {
            case 'pdf':
                return await this.processPdf(documentBuffer, url);
            case 'doc':
            case 'docx':
                return await this.processWord(documentBuffer, url, docType);
            case 'xls':
            case 'xlsx':
                return await this.processExcel(documentBuffer, url, docType);
            case 'ppt':
            case 'pptx':
                return await this.processPowerPoint(documentBuffer, url, docType);
            case 'txt':
                return await this.processText(documentBuffer, url);
            case 'rtf':
                return await this.processRtf(documentBuffer, url);
            case 'csv':
                return await this.processCsv(documentBuffer, url);
            default:
                return await this.processGeneric(documentBuffer, url, docType);
        }
    }

    /**
     * Process PDF documents
     */
    async processPdf(pdfBuffer, url) {
        try {
            const options = {
                max: this.maxPages,
                version: 'v1.10.100'
            };

            const pdfData = await pdfParse(pdfBuffer, options);
            const text = pdfData.text || '';
            const info = pdfData.info || {};
            
            const title = this.extractTitle(info.Title, text, url);
            const description = this.extractDescription(text);
            const keywords = this.extractKeywords(info.Keywords || info.Subject, text);
            const content = this.cleanAndTruncateText(text);
            
            const metadata = {
                documentType: 'pdf',
                pages: pdfData.numpages,
                version: pdfData.version || 'unknown',
                author: info.Author || '',
                creator: info.Creator || '',
                producer: info.Producer || '',
                creationDate: info.CreationDate || null,
                modificationDate: info.ModDate || null
            };

            return {
                title,
                description,
                keywords,
                content,
                metadata,
                documentType: 'pdf',
                pages: pdfData.numpages,
                fileSize: pdfBuffer.length,
                hash: this.generateHash(pdfBuffer)
            };
        } catch (error) {
            logger.error('Error processing PDF', { url, error: error.message });
            throw new Error(`PDF processing failed: ${error.message}`);
        }
    }

    /**
     * Process Word documents (DOC/DOCX)
     */
    async processWord(docBuffer, url, docType) {
        try {
            let text = '';
            let metadata = { documentType: docType };

            if (docType === 'docx') {
                const result = await mammoth.extractRawText({ buffer: docBuffer });
                text = result.value;
                metadata.conversionMessages = result.messages;
            } else {
                // For older DOC files, try basic text extraction
                text = this.extractTextFromBinary(docBuffer);
            }

            const title = this.extractTitle(null, text, url);
            const description = this.extractDescription(text);
            const keywords = this.extractKeywords(null, text);
            const content = this.cleanAndTruncateText(text);

            return {
                title,
                description,
                keywords,
                content,
                metadata,
                documentType: docType,
                fileSize: docBuffer.length,
                hash: this.generateHash(docBuffer)
            };
        } catch (error) {
            logger.error('Error processing Word document', { url, docType, error: error.message });
            throw new Error(`Word document processing failed: ${error.message}`);
        }
    }

    /**
     * Process Excel spreadsheets (XLS/XLSX)
     */
    async processExcel(excelBuffer, url, docType) {
        try {
            // Save to temporary file for processing
            const tempFilePath = path.join(this.tempDir, `excel_${crypto.randomBytes(8).toString('hex')}.${docType}`);
            fs.writeFileSync(tempFilePath, excelBuffer);
            
            const workbook = xlsx.readFile(tempFilePath);
            const sheetNames = workbook.SheetNames;
            
            let allText = '';
            const sheetsData = {};
            
            for (const sheetName of sheetNames) {
                const worksheet = workbook.Sheets[sheetName];
                const sheetJson = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
                const sheetText = sheetJson.map(row => row.join(' ')).join('\n');
                allText += sheetText + '\n\n';
                sheetsData[sheetName] = { rows: sheetJson.length };
            }
            
            // Clean up temporary file
            fs.unlinkSync(tempFilePath);
            
            const title = this.extractTitle(null, allText, url);
            const description = this.extractDescription(allText);
            const keywords = this.extractKeywords(null, allText);
            const content = this.cleanAndTruncateText(allText);
            
            const metadata = {
                documentType: docType,
                sheetNames,
                sheetCount: sheetNames.length,
                sheetsData
            };

            return {
                title,
                description,
                keywords,
                content,
                metadata,
                documentType: docType,
                fileSize: excelBuffer.length,
                hash: this.generateHash(excelBuffer)
            };
        } catch (error) {
            logger.error('Error processing Excel document', { url, docType, error: error.message });
            throw new Error(`Excel document processing failed: ${error.message}`);
        }
    }

    /**
     * Process PowerPoint presentations (PPT/PPTX)
     */
    async processPowerPoint(pptBuffer, url, docType) {
        try {
            // Save to temp file for basic text extraction
            const tempFilePath = path.join(this.tempDir, `ppt_${crypto.randomBytes(8).toString('hex')}.${docType}`);
            fs.writeFileSync(tempFilePath, pptBuffer);
            
            // Extract text using simple regex patterns (basic approach)
            const content = pptBuffer.toString('binary');
            const textFragments = content.match(/<a:t>(.*?)<\/a:t>/g) || [];
            const extractedText = textFragments
                .map(fragment => fragment.replace(/<a:t>(.*?)<\/a:t>/g, '$1'))
                .join(' ')
                .replace(/[^\x20-\x7E]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            
            // Clean up temporary file
            fs.unlinkSync(tempFilePath);
            
            const title = this.extractTitle(null, extractedText, url);
            const description = this.extractDescription(extractedText);
            const keywords = this.extractKeywords(null, extractedText);
            const cleanContent = this.cleanAndTruncateText(extractedText);
            
            const metadata = {
                documentType: docType,
                estimatedSlides: Math.max(1, Math.floor(textFragments.length / 10))
            };

            return {
                title,
                description,
                keywords,
                content: cleanContent,
                metadata,
                documentType: docType,
                fileSize: pptBuffer.length,
                hash: this.generateHash(pptBuffer)
            };
        } catch (error) {
            logger.error('Error processing PowerPoint document', { url, docType, error: error.message });
            throw new Error(`PowerPoint document processing failed: ${error.message}`);
        }
    }

    /**
     * Process plain text files
     */
    async processText(textBuffer, url) {
        try {
            const text = textBuffer.toString('utf8');
            const lines = text.split('\n');
            
            const title = this.extractTitle(null, text, url);
            const description = this.extractDescription(text);
            const keywords = this.extractKeywords(null, text);
            const content = this.cleanAndTruncateText(text);
            
            const metadata = {
                documentType: 'txt',
                lineCount: lines.length,
                encoding: 'utf8'
            };

            return {
                title,
                description,
                keywords,
                content,
                metadata,
                documentType: 'txt',
                fileSize: textBuffer.length,
                hash: this.generateHash(textBuffer)
            };
        } catch (error) {
            logger.error('Error processing text document', { url, error: error.message });
            throw new Error(`Text document processing failed: ${error.message}`);
        }
    }

    /**
     * Process RTF documents
     */
    async processRtf(rtfBuffer, url) {
        try {
            // Basic RTF text extraction (remove RTF formatting codes)
            let text = rtfBuffer.toString('utf8');
            text = text.replace(/\\[a-z]+\d*\s*/g, ' ') // Remove RTF commands
                      .replace(/[{}]/g, ' ') // Remove braces
                      .replace(/\s+/g, ' ')
                      .trim();
            
            const title = this.extractTitle(null, text, url);
            const description = this.extractDescription(text);
            const keywords = this.extractKeywords(null, text);
            const content = this.cleanAndTruncateText(text);
            
            const metadata = {
                documentType: 'rtf'
            };

            return {
                title,
                description,
                keywords,
                content,
                metadata,
                documentType: 'rtf',
                fileSize: rtfBuffer.length,
                hash: this.generateHash(rtfBuffer)
            };
        } catch (error) {
            logger.error('Error processing RTF document', { url, error: error.message });
            throw new Error(`RTF document processing failed: ${error.message}`);
        }
    }

    /**
     * Process CSV files
     */
    async processCsv(csvBuffer, url) {
        try {
            const text = csvBuffer.toString('utf8');
            const lines = text.split('\n');
            const rows = lines.map(line => line.split(','));
            
            // Extract headers and sample data for content
            const headers = rows[0] || [];
            const sampleRows = rows.slice(1, 10); // First 10 rows
            const sampleText = sampleRows.map(row => row.join(' ')).join('\n');
            
            const title = this.extractTitle(null, headers.join(' '), url);
            const description = `CSV file with ${headers.length} columns and ${rows.length - 1} rows`;
            const keywords = headers.join(', ');
            const content = this.cleanAndTruncateText(`Headers: ${headers.join(', ')}\n\nSample data:\n${sampleText}`);
            
            const metadata = {
                documentType: 'csv',
                columns: headers.length,
                rows: rows.length - 1,
                headers: headers
            };

            return {
                title,
                description,
                keywords,
                content,
                metadata,
                documentType: 'csv',
                fileSize: csvBuffer.length,
                hash: this.generateHash(csvBuffer)
            };
        } catch (error) {
            logger.error('Error processing CSV document', { url, error: error.message });
            throw new Error(`CSV document processing failed: ${error.message}`);
        }
    }

    /**
     * Process generic/unknown document types
     */
    async processGeneric(docBuffer, url, docType) {
        try {
            const text = this.extractTextFromBinary(docBuffer);
            
            const title = this.extractTitle(null, text, url);
            const description = this.extractDescription(text);
            const keywords = this.extractKeywords(null, text);
            const content = this.cleanAndTruncateText(text);
            
            const metadata = {
                documentType: docType || 'unknown'
            };

            return {
                title,
                description,
                keywords,
                content,
                metadata,
                documentType: docType || 'unknown',
                fileSize: docBuffer.length,
                hash: this.generateHash(docBuffer)
            };
        } catch (error) {
            logger.error('Error processing generic document', { url, docType, error: error.message });
            throw new Error(`Generic document processing failed: ${error.message}`);
        }
    }

    /**
     * Extract title from metadata, text content, or URL
     */
    extractTitle(metaTitle, text, url) {
        try {
            // Use metadata title if available
            if (metaTitle && metaTitle.trim()) {
                return this.cleanText(metaTitle.trim()).substring(0, 255);
            }

            // Extract from first line of text
            const lines = text.split('\n').filter(line => line.trim().length > 0);
            if (lines.length > 0) {
                const firstLine = lines[0].trim();
                if (firstLine.length > 5 && firstLine.length < 200) {
                    return this.cleanText(firstLine).substring(0, 255);
                }
            }

            // Fallback to filename from URL
            try {
                const urlObj = new URL(url);
                const filename = urlObj.pathname.split('/').pop();
                if (filename) {
                    return filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
                }
            } catch (urlError) {
                // Ignore URL parsing errors
            }

            return 'Document';
        } catch (error) {
            logger.error('Error extracting document title', { error: error.message });
            return 'Document';
        }
    }

    /**
     * Extract description from text content
     */
    extractDescription(text) {
        try {
            const paragraphs = text.split('\n\n').filter(p => p.trim().length > 50);
            
            if (paragraphs.length > 0) {
                let description = paragraphs[0].trim();
                description = this.cleanText(description);
                
                if (description.length > 500) {
                    description = description.substring(0, 500) + '...';
                }
                
                return description;
            }

            if (text.length > 100) {
                return this.cleanText(text.substring(0, 500)) + '...';
            }

            return '';
        } catch (error) {
            logger.error('Error extracting document description', { error: error.message });
            return '';
        }
    }

    /**
     * Extract keywords from metadata or text content
     */
    extractKeywords(metaKeywords, text) {
        try {
            if (metaKeywords && metaKeywords.trim()) {
                return this.cleanText(metaKeywords.trim()).substring(0, 1000);
            }

            // Extract keywords from text
            const words = text.toLowerCase()
                .replace(/[^\w\s]/g, ' ')
                .split(/\s+/)
                .filter(word => word.length > 3 && word.length < 20);

            const wordCount = {};
            words.forEach(word => {
                wordCount[word] = (wordCount[word] || 0) + 1;
            });

            const topWords = Object.entries(wordCount)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 20)
                .map(([word]) => word);

            return topWords.join(', ');
        } catch (error) {
            logger.error('Error extracting document keywords', { error: error.message });
            return '';
        }
    }

    /**
     * Clean and truncate text content
     */
    cleanAndTruncateText(text) {
        let content = this.cleanText(text);
        if (content.length > this.maxContentLength) {
            content = content.substring(0, this.maxContentLength);
        }
        return content;
    }

    /**
     * Clean text by removing unwanted characters
     */
    cleanText(text) {
        if (!text) return '';
        
        return text
            .replace(/[\r\n\t]+/g, ' ')
            .replace(/\s+/g, ' ')
            .replace(/['"]/g, '')
            .trim();
    }

    /**
     * Extract text from binary content (basic approach)
     */
    extractTextFromBinary(buffer) {
        return buffer.toString('utf8')
            .replace(/[^\x20-\x7E]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Generate hash for document content
     */
    generateHash(buffer) {
        return crypto.createHash('md5').update(buffer).digest('hex');
    }

    /**
     * Map parsed data to site_data table format (for consistency)
     */
    mapToSiteDataRow(parsedData, url) {
        return {
            site_url: url,
            site_data_link: url,
            site_data_title: parsedData.title || '',
            site_data_description: parsedData.description || '',
            site_data_keywords: parsedData.keywords || '',
            site_data_h1: '',
            site_data_h2: '',
            site_data_h3: '',
            site_data_h4: '',
            site_data_article: parsedData.content || '',
            site_data_icon: '',
            site_data_links: JSON.stringify([]),
            site_data_images: JSON.stringify([]),
            site_data_videos: JSON.stringify([]),
            site_data_metadata: JSON.stringify(parsedData.metadata || {}),
            crawl_date: new Date(),
            status: 'processed',
            content_type: `application/${parsedData.documentType}`
        };
    }

    /**
     * Store document data in site_doc table
     */
    async storeDocumentData(parsedData, url, crawlerInstance) {
        try {
            // Get database connection - try multiple sources
            let dbConnection = null;
            if (crawlerInstance.indexer && crawlerInstance.indexer.dbConnection) {
                dbConnection = crawlerInstance.indexer.dbConnection;
            } else if (crawlerInstance.con) {
                dbConnection = crawlerInstance.con;
            } else {
                // Use shared database connection as fallback
                const { con } = require('../mysql');
                dbConnection = con;
            }

            // Check for duplicate document URL first
            const siteId = crawlerInstance.db_row?.site_id || 1;
            const duplicateCheckQuery = `
                SELECT site_doc_id FROM site_doc 
                WHERE site_doc_link = ? AND site_doc_site_id = ?
                LIMIT 1
            `;
            
            const existingRecords = await dbConnection.query(duplicateCheckQuery, [url, siteId]);
            
            if (existingRecords && existingRecords.length > 0) {
                logger.info('Document URL already exists in site_doc table', { 
                    url, 
                    existingId: existingRecords[0].site_doc_id,
                    siteId: siteId
                });
                return {
                    insertId: existingRecords[0].site_doc_id,
                    isDuplicate: true,
                    message: 'Document URL already exists'
                };
            }

            const query = `
                INSERT INTO site_doc (
                    site_doc_site_id,
                    site_doc_title,
                    site_doc_description,
                    site_doc_link,
                    site_doc_type,
                    site_doc_size,
                    site_doc_pages,
                    site_doc_author,
                    site_doc_content,
                    site_doc_hash,
                    site_doc_metadata
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const values = [
                siteId,
                parsedData.title || 'Untitled Document',
                parsedData.description || '',
                url,
                parsedData.documentType.toUpperCase(),
                parsedData.fileSize || 0,
                parsedData.pages || null,
                parsedData.metadata?.author || '',
                parsedData.content || '',
                parsedData.hash,
                JSON.stringify(parsedData.metadata || {})
            ];

            const result = await dbConnection.query(query, values);
            const insertId = result.insertId || result[0]?.insertId;
            
            logger.info('Document stored in site_doc table', { 
                url, 
                type: parsedData.documentType,
                insertId,
                title: parsedData.title?.substring(0, 50) + '...',
                siteId: siteId
            });
            
            return {
                insertId: insertId,
                isDuplicate: false,
                message: 'Document stored successfully'
            };
        } catch (error) {
            logger.error('Error storing document in site_doc table', { 
                url, 
                type: parsedData.documentType,
                error: error.message,
                stack: error.stack
            });
            // Don't throw error to prevent crawling failure
            return {
                insertId: null,
                isDuplicate: false,
                error: error.message
            };
        }
    }

    /**
     * Validate document content quality
     */
    validateContentQuality(parsedData) {
        const quality = {
            score: 0,
            issues: [],
            recommendations: []
        };

        if (!parsedData.content || parsedData.content.length < 100) {
            quality.issues.push('Document content could not be extracted or is too short');
            return quality;
        } else {
            quality.score += 40;
        }

        if (!parsedData.title || parsedData.title === 'Document') {
            quality.issues.push('Document title is missing or generic');
        } else {
            quality.score += 20;
        }

        if (parsedData.content.length < 500) {
            quality.issues.push('Document content is very short');
        } else if (parsedData.content.length > 10000) {
            quality.score += 20;
        }

        if (parsedData.metadata && Object.keys(parsedData.metadata).length > 3) {
            quality.score += 20;
        } else {
            quality.issues.push('Document metadata is limited');
        }

        if (quality.score < 50) {
            quality.recommendations.push('Document may have limited searchable content');
        }
        if (quality.score < 30) {
            quality.recommendations.push('Consider improving document metadata and content structure');
        }

        return quality;
    }
}

module.exports = { DocumentHandler }; 