/**
 * content-type-handler.js
 * 
nt types for the crawler
 * supporting HTML, React.js, Expres * This utility handles different contes.js, PHP, PDFs, Excel, PPT, and other formats
 */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const pdfParse = require('pdf-parse');
const xlsx = require('xlsx');
const mammoth = require('mammoth');
const mimeTypes = require('mime-types');
const fileType = require('file-type');
const fetch = require('node-fetch');
const contentType = require('content-type');
const retry = require('async-retry');
const { JSDOM } = require('jsdom');
const crypto = require('crypto');
const stream = require('stream');
const { promisify } = require('util');
const pipeline = promisify(stream.pipeline);

// Temporary directory for saving files during processing
const TEMP_DIR = path.join(__dirname, '../temp');

// Create temp directory if it doesn't exist
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

class ContentTypeHandler {
    constructor(logger = console) {
        this.logger = logger;
    }

    /**
     * Detect content type from URL or response
     * @param {string} url - URL of the content
     * @param {object} response - HTTP response object (optional)
     * @returns {Promise<string>} - Detected content type
     */
    async detectContentType(url, response = null) {
        try {
            // Use response content-type header if available
            if (response && response.headers && response.headers['content-type']) {
                const contentType = response.headers['content-type'].split(';')[0].toLowerCase().trim();
                // Validate content type
                if (contentType && contentType.includes('/')) {
                    return contentType;
                }
            }

            // Try to determine by URL extension
            const extension = path.extname(url).toLowerCase();
            if (extension) {
                const mimeType = mimeTypes.lookup(extension);
                if (mimeType) return mimeType;
            }

            // Fetch the URL if no response provided
            if (!response) {
                response = await retry(async () => {
                    return await fetch(url, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                        },
                        timeout: 30000
                    });
                }, { retries: 3 });
                
                // Use response content-type header
                if (response.headers.get('content-type')) {
                    const parsedType = contentType.parse(response.headers.get('content-type'));
                    return parsedType.type.toLowerCase();
                }
            }

            // Default to HTML if unable to determine
            return 'text/html';
        } catch (error) {
            this.logger.error(`Error detecting content type: ${error.message}`);
            return 'text/html'; // Default to HTML
        }
    }

    /**
     * Process the content based on its type
     * @param {string} url - URL of the content
     * @param {Buffer|string} data - Raw content data
     * @param {string} contentType - Content type
     * @returns {Promise<object>} - Processed content with metadata
     */
    async processContent(url, data, contentType) {
        try {
            // Determine method based on content type
            if (contentType.includes('text/html') || contentType.includes('application/xhtml+xml')) {
                return await this.processHtml(data, url);
            } else if (contentType.includes('application/json')) {
                return await this.processJson(data, url);
            } else if (contentType.includes('application/javascript')) {
                return await this.processJavascript(data, url);
            } else if (contentType.includes('application/pdf')) {
                return await this.processPdf(data, url);
            } else if (contentType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') ||
                       contentType.includes('application/vnd.ms-excel')) {
                return await this.processExcel(data, url);
            } else if (contentType.includes('application/vnd.openxmlformats-officedocument.presentationml.presentation') ||
                       contentType.includes('application/vnd.ms-powerpoint')) {
                return await this.processPowerPoint(data, url);
            } else if (contentType.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document') ||
                       contentType.includes('application/msword')) {
                return await this.processWord(data, url);
            } else if (contentType.includes('text/plain')) {
                return await this.processText(data, url);
            } else if (contentType.includes('application/php')) {
                return await this.processPhp(data, url);
            } else {
                // Default fallback
                return {
                    type: 'unknown',
                    content: typeof data === 'string' ? data : data.toString('utf8'),
                    metadata: {
                        url,
                        contentType,
                        title: url,
                        description: '',
                        keywords: []
                    }
                };
            }
        } catch (error) {
            this.logger.error(`Error processing content: ${error.message}`);
            return {
                type: 'error',
                content: '',
                metadata: {
                    url,
                    contentType,
                    error: error.message
                }
            };
        }
    }

    /**
     * Process HTML content
     * @param {Buffer|string} data - Raw HTML content
     * @param {string} url - URL of the content
     * @returns {Promise<object>} - Processed HTML content with metadata
     */
    async processHtml(data, url) {
        try {
            // Parse HTML with cheerio
            const htmlContent = typeof data === 'string' ? data : data.toString('utf8');
            const $ = cheerio.load(htmlContent);
            
            // Check if it's a React application
            const isReact = $('script').text().includes('React') || 
                           $('script').attr('src')?.includes('react') ||
                           htmlContent.includes('ReactDOM');
            
            // Check if it's Express.js (harder to detect directly)
            const isExpress = $('meta[name="generator"]').attr('content')?.includes('Express') ||
                             htmlContent.includes('Express');
            
            // Extract metadata
            const title = $('title').text() || '';
            let description = $('meta[name="description"]').attr('content') || '';
            const keywords = $('meta[name="keywords"]').attr('content') || '';
            const author = $('meta[name="author"]').attr('content') || '';
            const generator = $('meta[name="generator"]').attr('content') || '';
            
            // Detect if this is an archive/category page and generate appropriate description
            if (!description && this.isArchivePage(title, url)) {
                description = this.generateArchiveDescription(title, url, $);
            }
            
            // Extract headings
            const h1 = $('h1').map((i, el) => $(el).text().trim()).get().join(' | ');
            const h2 = $('h2').map((i, el) => $(el).text().trim()).get().join(' | ');
            const h3 = $('h3').map((i, el) => $(el).text().trim()).get().join(' | ');
            const h4 = $('h4').map((i, el) => $(el).text().trim()).get().join(' | ');
            
            // Extract article content
            const articleContent = $('article').text() || $('main').text() || $('body').text() || '';
            
            // Extract all visible text
            const visibleText = $('body').text().replace(/\s+/g, ' ').trim();
            
            // Extract links
            const links = $('a[href]').map((i, el) => {
                return {
                    text: $(el).text().trim(),
                    href: $(el).attr('href')
                };
            }).get();
            
            // Extract images
            const images = $('img[src]').map((i, el) => {
                return {
                    src: $(el).attr('src'),
                    alt: $(el).attr('alt') || '',
                    title: $(el).attr('title') || ''
                };
            }).get();
            
            return {
                type: isReact ? 'react' : (isExpress ? 'express' : 'html'),
                content: visibleText,
                metadata: {
                    url,
                    title,
                    description,
                    keywords: keywords.split(',').map(k => k.trim()).filter(k => k),
                    author,
                    generator,
                    headings: { h1, h2, h3, h4 },
                    links,
                    images,
                    articleContent,
                    fullHtml: htmlContent
                }
            };
        } catch (error) {
            this.logger.error(`Error processing HTML: ${error.message}`);
            throw error;
        }
    }

    /**
     * Process PHP content (treat similar to HTML)
     * @param {Buffer|string} data - Raw PHP content
     * @param {string} url - URL of the content
     * @returns {Promise<object>} - Processed PHP content with metadata
     */
    async processPhp(data, url) {
        // PHP pages typically render as HTML, so we'll process them the same way
        return this.processHtml(data, url);
    }

    /**
     * Process JSON content
     * @param {Buffer|string} data - Raw JSON content
     * @param {string} url - URL of the content
     * @returns {Promise<object>} - Processed JSON content with metadata
     */
    async processJson(data, url) {
        try {
            const jsonContent = typeof data === 'string' ? data : data.toString('utf8');
            const parsed = JSON.parse(jsonContent);
            
            // Extract common fields that might be present in JSON API responses
            const title = parsed.title || parsed.name || '';
            const description = parsed.description || parsed.summary || '';
            const keywords = parsed.keywords || parsed.tags || [];
            const content = JSON.stringify(parsed);
            
            return {
                type: 'json',
                content: typeof parsed === 'object' ? JSON.stringify(parsed, null, 2) : jsonContent,
                metadata: {
                    url,
                    title,
                    description,
                    keywords: Array.isArray(keywords) ? keywords : [keywords],
                    fullJson: jsonContent
                }
            };
        } catch (error) {
            this.logger.error(`Error processing JSON: ${error.message}`);
            throw error;
        }
    }

    /**
     * Process JavaScript content
     * @param {Buffer|string} data - Raw JavaScript content
     * @param {string} url - URL of the content
     * @returns {Promise<object>} - Processed JavaScript content with metadata
     */
    async processJavascript(data, url) {
        try {
            const jsContent = typeof data === 'string' ? data : data.toString('utf8');
            
            // Check for common libraries/frameworks
            const isReact = jsContent.includes('React') || jsContent.includes('ReactDOM');
            const isExpress = jsContent.includes('express') || jsContent.includes('app.get(') || jsContent.includes('app.use(');
            
            // Extract comments for documentation
            const commentRegex = /\/\*\*([\s\S]*?)\*\//g;
            const comments = [];
            let match;
            
            while ((match = commentRegex.exec(jsContent)) !== null) {
                comments.push(match[1].trim());
            }
            
            return {
                type: isReact ? 'react' : (isExpress ? 'express' : 'javascript'),
                content: jsContent,
                metadata: {
                    url,
                    title: path.basename(url),
                    description: comments.join(' | '),
                    keywords: [],
                    isReact,
                    isExpress,
                    comments
                }
            };
        } catch (error) {
            this.logger.error(`Error processing JavaScript: ${error.message}`);
            throw error;
        }
    }

    /**
     * Process Plain Text content
     * @param {Buffer|string} data - Raw text content
     * @param {string} url - URL of the content
     * @returns {Promise<object>} - Processed text content with metadata
     */
    async processText(data, url) {
        try {
            const textContent = typeof data === 'string' ? data : data.toString('utf8');
            
            // Extract first line as potential title
            const lines = textContent.split('\n');
            const title = lines[0] || path.basename(url);
            
            return {
                type: 'text',
                content: textContent,
                metadata: {
                    url,
                    title,
                    description: lines.slice(1, 5).join(' ').substring(0, 200),
                    keywords: []
                }
            };
        } catch (error) {
            this.logger.error(`Error processing Text: ${error.message}`);
            throw error;
        }
    }

    /**
     * Process PDF content
     * @param {Buffer|string} data - Raw PDF content
     * @param {string} url - URL of the content
     * @returns {Promise<object>} - Processed PDF content with metadata
     */
    async processPdf(data, url) {
        try {
            // Ensure we have Buffer for PDF processing
            const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
            
            // Parse PDF content
            const result = await pdfParse(buffer);
            
            // Extract text, metadata
            const { text, info, metadata, version } = result;
            
            return {
                type: 'pdf',
                content: text,
                metadata: {
                    url,
                    title: info?.Title || metadata?._metadata?.title || path.basename(url),
                    author: info?.Author || metadata?._metadata?.author || '',
                    description: info?.Subject || metadata?._metadata?.subject || '',
                    keywords: info?.Keywords ? info.Keywords.split(',').map(k => k.trim()) : [],
                    pdfVersion: version,
                    pageCount: info?.Pages || 0,
                    creationDate: info?.CreationDate,
                    modificationDate: info?.ModDate
                }
            };
        } catch (error) {
            this.logger.error(`Error processing PDF: ${error.message}`);
            throw error;
        }
    }

    /**
     * Process Excel spreadsheet content
     * @param {Buffer|string} data - Raw Excel content
     * @param {string} url - URL of the content
     * @returns {Promise<object>} - Processed Excel content with metadata
     */
    async processExcel(data, url) {
        try {
            // Ensure we have Buffer for Excel processing
            const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
            
            // Save to temporary file for processing
            const tempFilePath = path.join(TEMP_DIR, `excel_${crypto.randomBytes(8).toString('hex')}.xlsx`);
            fs.writeFileSync(tempFilePath, buffer);
            
            // Parse Excel file
            const workbook = xlsx.readFile(tempFilePath);
            
            // Extract sheet names
            const sheetNames = workbook.SheetNames;
            
            // Extract text content from all sheets
            let allText = '';
            const sheets = {};
            
            for (const sheetName of sheetNames) {
                const worksheet = workbook.Sheets[sheetName];
                const sheetJson = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
                
                // Convert to text
                const sheetText = sheetJson.map(row => row.join(' ')).join('\n');
                allText += sheetText + '\n\n';
                
                // Store sheet data
                sheets[sheetName] = {
                    rows: sheetJson.length,
                    data: sheetJson
                };
            }
            
            // Extract some properties if available
            const props = workbook.Props || {};
            
            // Clean up temporary file
            fs.unlinkSync(tempFilePath);
            
            return {
                type: 'excel',
                content: allText,
                metadata: {
                    url,
                    title: props.Title || path.basename(url),
                    author: props.Author || '',
                    description: props.Subject || '',
                    keywords: props.Keywords ? props.Keywords.split(',').map(k => k.trim()) : [],
                    sheetNames,
                    sheetCount: sheetNames.length,
                    created: props.CreatedDate,
                    modified: props.ModifiedDate
                }
            };
        } catch (error) {
            this.logger.error(`Error processing Excel: ${error.message}`);
            throw error;
        }
    }

    /**
     * Process PowerPoint presentation content
     * @param {Buffer|string} data - Raw PowerPoint content
     * @param {string} url - URL of the content
     * @returns {Promise<object>} - Processed PowerPoint content with metadata
     */
    async processPowerPoint(data, url) {
        try {
            // PowerPoint processing is complex and may require external tools
            // This implementation provides basic text extraction
            // For more advanced features, consider using specialized libraries

            // Ensure we have Buffer
            const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
            
            // For PowerPoint, we'll extract basic text (simplified approach)
            // Save to temp file and extract content using string matching
            const tempFilePath = path.join(TEMP_DIR, `ppt_${crypto.randomBytes(8).toString('hex')}.pptx`);
            fs.writeFileSync(tempFilePath, buffer);
            
            // Read as binary and extract text fragments
            const content = buffer.toString('binary');
            
            // Simple regex to extract text (not comprehensive)
            const textFragments = content.match(/<a:t>(.*?)<\/a:t>/g) || [];
            const extractedText = textFragments
                .map(fragment => fragment.replace(/<a:t>(.*?)<\/a:t>/g, '$1'))
                .join(' ')
                .replace(/[^\x20-\x7E]/g, ' ') // Remove non-ASCII characters
                .replace(/\s+/g, ' ')
                .trim();
            
            // Clean up temporary file
            fs.unlinkSync(tempFilePath);
            
            return {
                type: 'powerpoint',
                content: extractedText,
                metadata: {
                    url,
                    title: path.basename(url),
                    description: extractedText.substring(0, 200),
                    keywords: [],
                    slideCount: textFragments.length / 10 // Rough estimate
                }
            };
        } catch (error) {
            this.logger.error(`Error processing PowerPoint: ${error.message}`);
            throw error;
        }
    }

    /**
     * Process Word document content
     * @param {Buffer|string} data - Raw Word document content
     * @param {string} url - URL of the content
     * @returns {Promise<object>} - Processed Word content with metadata
     */
    async processWord(data, url) {
        try {
            // Ensure we have Buffer for Word processing
            const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
            
            // Use mammoth to extract text and metadata
            const result = await mammoth.extractRawText({ buffer });
            const { value: text, messages } = result;
            
            // Extract headings (simplistic approach)
            const headings = [];
            const lines = text.split('\n');
            for (const line of lines) {
                if (line.trim() && line.length < 100) {
                    headings.push(line.trim());
                    if (headings.length >= 5) break;
                }
            }
            
            return {
                type: 'word',
                content: text,
                metadata: {
                    url,
                    title: headings[0] || path.basename(url),
                    description: text.substring(0, 200),
                    keywords: [],
                    headings
                }
            };
        } catch (error) {
            this.logger.error(`Error processing Word: ${error.message}`);
            throw error;
        }
    }

    /**
     * Process React.js content
     * @param {Buffer|string} content - Content to process
     * @returns {Promise<object>} - Processed content and metadata
     */
    async processReactContent(content) {
        try {
            // Use cheerio and JSDOM to extract React content
            const $ = cheerio.load(content);
            const dom = new JSDOM(content.toString());
            const window = dom.window;
            
            // Look for React-specific structures
            const reactRoots = $('[data-reactroot]').length > 0 || 
                              $('[data-reactid]').length > 0 || 
                              $('#root').length > 0 || 
                              $('#app').length > 0;
            
            // Look for common React libraries in script tags
            const hasReactScripts = $('script').filter(function() {
                const src = $(this).attr('src') || '';
                const content = $(this).html() || '';
                return src.includes('react') || 
                       content.includes('React.') || 
                       content.includes('ReactDOM');
            }).length > 0;
            
            // Extract text content
            const textContent = $('body').text().trim();
            
            // Extract meta tags
            const metadata = this.extractMetaTags($);
            
            // Extract document info
            const documentInfo = {
                title: $('title').text() || window.document.title || '',
                lang: $('html').attr('lang') || window.document.documentElement.lang || 'en',
                hasReactElements: reactRoots || hasReactScripts,
                isStatic: !hasReactScripts && textContent.length > 0,
                scriptCount: $('script').length
            };
            
            return {
                type: 'react',
                text: textContent,
                metadata: metadata,
                documentInfo: documentInfo
            };
        } catch (error) {
            this.logger.error(`Error processing React content: ${error.message}`);
            throw error;
        }
    }

    /**
     * Download content from URL for processing
     * @param {string} url - URL to download
     * @returns {Promise<object>} - Downloaded content with metadata
     */
    async downloadContent(url) {
        try {
            const response = await retry(async () => {
                return await fetch(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                    },
                    timeout: 30000
                });
            }, { retries: 3 });
            
            if (!response.ok) {
                throw new Error(`Failed to download content: ${response.statusText}`);
            }
            
            // Detect content type
            const contentType = this.detectContentType(url, response);
            
            // Download the content as Buffer
            const buffer = await response.buffer();
            
            // Process based on content type
            return {
                url,
                contentType,
                buffer,
                response
            };
        } catch (error) {
            this.logger.error(`Error downloading content: ${error.message}`);
            throw error;
        }
    }

    /**
     * Extract meta tags from HTML using cheerio
     * @param {object} $ - Cheerio instance
     * @returns {object} - Extracted metadata
     */
    extractMetaTags($) {
        const metadata = {};
        
        // Extract title
        metadata.title = $('title').text() || '';
        
        // Extract meta tags
        $('meta').each((i, el) => {
            const name = $(el).attr('name') || $(el).attr('property');
            const content = $(el).attr('content');
            
            if (name && content) {
                metadata[name] = content;
            }
        });
        
        return metadata;
    }

    /**
     * Detect if this is an archive/category page
     */
    isArchivePage(title, url) {
        const archiveKeywords = ['archives', 'archive', 'category', 'tag', 'category:', 'archives -'];
        const titleLower = title.toLowerCase();
        const urlLower = url.toLowerCase();
        
        return archiveKeywords.some(keyword => 
            titleLower.includes(keyword) || 
            urlLower.includes('/' + keyword + '/') ||
            urlLower.includes('category=') ||
            urlLower.includes('tag=')
        );
    }
    
    /**
     * Generate appropriate description for archive pages
     */
    generateArchiveDescription(title, url, $) {
        try {
            // Extract the category/archive name from title
            const titleParts = title.split(' Archives ');
            const categoryName = titleParts[0] || title.replace(/\s*Archives.*$/i, '');
            
            // Get domain name for context
            const domain = new URL(url).hostname.replace('www.', '');
            
            // Count how many articles are listed
            const articleCount = $('article, .post, .entry, h2 a, .item').length;
            
            // Generate a meaningful description
            if (categoryName && categoryName.toLowerCase() !== 'untitled') {
                if (articleCount > 0) {
                    return `Browse ${articleCount} articles about ${categoryName} on ${domain}. Latest news, updates and stories in the ${categoryName} category.`;
                } else {
                    return `${categoryName} category page on ${domain}. Find the latest articles, news and updates about ${categoryName}.`;
                }
            } else {
                // Fallback description
                return `Archive page on ${domain} containing categorized articles and posts. Browse through our content organized by topics and categories.`;
            }
        } catch (error) {
            this.logger.error('Error generating archive description', { error: error.message });
            return 'Archive page containing categorized articles and posts.';
        }
    }

    /**
     * Clean up temporary files
     */
    cleanup() {
        try {
            const files = fs.readdirSync(TEMP_DIR);
            for (const file of files) {
                fs.unlinkSync(path.join(TEMP_DIR, file));
            }
        } catch (error) {
            this.logger.error(`Error cleaning up temporary files: ${error.message}`);
        }
    }
}

module.exports = { ContentTypeHandler };
