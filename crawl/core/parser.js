const cheerio = require('cheerio');
const { JSDOM } = require('jsdom');
const { logger } = require('../utils/logger');

class ContentParser {
    constructor() {
        this.maxContentLength = {
            title: 255,
            description: 500,
            keywords: 1000,
            article: 2096000, // 2MB
            h1: 5000,
            h2: 10000,
            h3: 15000,
            h4: 20000
        };
        // Flag to reduce base64 URL logging
        this.base64UrlLogged = false;
    }

    /**
     * Safely decode URL with infinite loop protection and comprehensive validation
     * This should be used for all URL processing in the parser
     */
    normalizeUrl(url) {
        // Input validation
        if (!url || typeof url !== 'string') {
            return url || '';
        }

        // URL length validation to prevent memory issues
        if (url.length > 8192) { // 8KB limit for URLs
            logger.warn('URL exceeds maximum length, truncating', { 
                originalLength: url.length, 
                truncatedLength: 8192 
            });
            url = url.substring(0, 8192);
        }

        // Basic URL format validation
        if (!this.isValidUrlFormat(url)) {
            logger.warn('Invalid URL format detected, using fallback handling', { url: url.substring(0, 100) });
            return this.fallbackUrlHandler(url);
        }

        try {
            // Set up timeout protection
            const startTime = Date.now();
            const TIMEOUT_MS = 100; // 100ms timeout for URL processing
            
            let decodedUrl = url;
            let previousUrl = '';
            let iterations = 0;
            const MAX_ITERATIONS = 5; // Maximum 5 decoding attempts
            
            // First decode URI components with iteration protection
            try {
                decodedUrl = decodeURIComponent(url);
            } catch (decodeError) {
                logger.debug('Initial URL decoding failed, using original', { url: url.substring(0, 100) });
                return url.trim();
            }
            
            // Handle any remaining encoded characters with strict loop protection
            while (decodedUrl !== previousUrl && 
                   decodedUrl.includes('%') && 
                   iterations < MAX_ITERATIONS) {
                
                // Check timeout
                if (Date.now() - startTime > TIMEOUT_MS) {
                    logger.warn('URL decoding timeout, returning partial result', { 
                        url: url.substring(0, 100),
                        iterations,
                        timeSpent: Date.now() - startTime
                    });
                    break;
                }

                // Check for circular encoding patterns
                if (this.hasCircularEncoding(decodedUrl, previousUrl)) {
                    logger.warn('Circular encoding pattern detected, breaking loop', { 
                        url: url.substring(0, 100),
                        iterations
                    });
                    break;
                }

                previousUrl = decodedUrl;
                iterations++;
                
                try {
                    const nextDecoded = decodeURIComponent(decodedUrl);
                    
                    // Verify decoding made progress
                    if (nextDecoded === decodedUrl) {
                        logger.debug('URL decoding reached stable state', { iterations });
                        break;
                    }
                    
                    decodedUrl = nextDecoded;
                } catch (decodeError) {
                    logger.debug('URL decoding failed in iteration, using current result', { 
                        iteration: iterations,
                        error: decodeError.message 
                    });
                    break;
                }
            }
            
            // Log if maximum iterations reached
            if (iterations >= MAX_ITERATIONS) {
                logger.warn('URL decoding reached maximum iterations limit', { 
                    url: url.substring(0, 100),
                    finalIterations: iterations
                });
            }
            
            // Final validation and cleanup
            const result = decodedUrl.trim();
            return this.validateDecodedUrl(result, url);
            
        } catch (error) {
            logger.warn('Error normalizing URL, using fallback handler', { 
                url: url.substring(0, 100), 
                error: error.message 
            });
            return this.fallbackUrlHandler(url);
        }
    }

    /**
     * Validate URL format before processing
     */
    isValidUrlFormat(url) {
        try {
            // Basic format checks
            if (url.length === 0) return false;
            if (url.length > 8192) return false; // URL too long
            
            // Check for suspicious patterns that might cause infinite loops
            const suspiciousPatterns = [
                /%25/g,      // Double-encoded percent signs
                /%2525/g,    // Triple-encoded percent signs  
                /%252525/g,  // Quadruple-encoded percent signs
                /(%[0-9A-Fa-f]{2}){20,}/g, // Excessive encoding chains
            ];
            
            for (const pattern of suspiciousPatterns) {
                if (pattern.test(url)) {
                    logger.debug('Suspicious encoding pattern detected in URL', { 
                        pattern: pattern.source,
                        url: url.substring(0, 100)
                    });
                    return false;
                }
            }
            
            // Try to create a URL object to validate the format properly
            try {
                new URL(url);
                return true; // Valid URL format
            } catch (urlError) {
                // If URL constructor fails, try with a base URL for relative URLs
                try {
                    new URL(url, 'https://example.com');
                    return true; // Valid relative URL
                } catch (relativeError) {
                    // Check for basic URL structure (more permissive for Unicode)
                    const basicUrlPattern = /^(?:https?:\/\/)?[^\s<>"'{}|\\^`\[\]]+$/u; // Added 'u' flag for Unicode support
                    return basicUrlPattern.test(url);
                }
            }
            
        } catch (error) {
            logger.debug('URL format validation failed', { error: error.message });
            return false;
        }
    }

    /**
     * Detect circular encoding patterns
     */
    hasCircularEncoding(current, previous) {
        try {
            // Check if we're seeing the same encoded pattern repeat
            if (current === previous) return true;
            
            // Check for alternating patterns (A->B->A->B)
            if (current.length === previous.length && 
                current.includes('%') && previous.includes('%')) {
                
                // Count encoded sequences
                const currentEncoded = (current.match(/%[0-9A-Fa-f]{2}/g) || []).length;
                const previousEncoded = (previous.match(/%[0-9A-Fa-f]{2}/g) || []).length;
                
                // If encoded count is not decreasing, we might have circular encoding
                return currentEncoded >= previousEncoded;
            }
            
            return false;
        } catch (error) {
            logger.debug('Error checking circular encoding', { error: error.message });
            return true; // Err on the side of caution
        }
    }

    /**
     * Fallback URL handler for problematic URLs
     */
    fallbackUrlHandler(url) {
        try {
            // Remove obviously problematic parts
            let cleaned = url.replace(/(%[0-9A-Fa-f]{2}){10,}/g, '') // Remove long encoding chains
                           .replace(/[<>"'{}|\\^`\[\]]/g, '') // Remove dangerous characters
                           .replace(/\s+/g, '%20') // Encode spaces properly
                           .trim();
            
            // If cleaning made the URL too short or empty, return a safe default
            if (cleaned.length < 3) {
                logger.warn('URL became too short after fallback cleaning', { 
                    original: url.substring(0, 100),
                    cleaned
                });
                return url.substring(0, Math.min(url.length, 500)); // Return truncated original
            }
            
            return cleaned;
        } catch (error) {
            logger.warn('Fallback URL handler failed, returning truncated original', { 
                error: error.message 
            });
            return url.substring(0, Math.min(url.length, 500));
        }
    }

    /**
     * Validate the final decoded URL
     */
    validateDecodedUrl(decodedUrl, originalUrl) {
        try {
            // Check if result is reasonable
            if (!decodedUrl || decodedUrl.length === 0) {
                return originalUrl;
            }
            
            // Check if decoding produced a much longer result (possible decompression bomb)
            if (decodedUrl.length > originalUrl.length * 3) {
                logger.warn('URL decoding produced suspiciously large result', { 
                    originalLength: originalUrl.length,
                    decodedLength: decodedUrl.length
                });
                return originalUrl.substring(0, Math.min(originalUrl.length, 2000));
            }
            
            // Check for remaining problematic patterns
            if (decodedUrl.includes('\x00') || decodedUrl.includes('\n') || decodedUrl.includes('\r')) {
                logger.warn('URL contains null bytes or newlines after decoding', { 
                    decodedUrl: decodedUrl.substring(0, 100) 
                });
                return this.fallbackUrlHandler(originalUrl);
            }
            
            return decodedUrl;
        } catch (error) {
            logger.warn('URL validation failed, using original', { error: error.message });
            return originalUrl;
        }
    }

    parseHtml(html, url) {
        try {
            // Reset logging flags for each page
            this.base64UrlLogged = false;
            
            // Normalize the input URL
            const normalizedUrl = this.normalizeUrl(url);
            const $ = cheerio.load(html);
            const parsedData = {
                title: this.extractTitle($),
                description: this.extractDescription($),
                keywords: this.extractKeywords($),
                author: this.extractAuthor($),
                generator: this.extractGenerator($),
                language: this.extractLanguage($),
                canonicalUrl: this.extractCanonicalUrl($),
                headings: this.extractHeadings($),
                links: this.extractLinks($, normalizedUrl),
                images: this.extractImages($, normalizedUrl),
                videos: this.extractVideos($, normalizedUrl),
                documents: this.extractDocuments($, normalizedUrl),
                article: this.extractArticleContent($),                
                icon: this.extractIcon($),
                metadata: this.extractMetadata($),
                pageType: this.extractPageType($)
            };

            // Only log parsing summary, not detailed debug info
            logger.info('HTML parsed successfully', { 
                url: normalizedUrl, 
                titleLength: parsedData.title?.length || 0,
                linksCount: parsedData.links?.length || 0,
                imagesCount: parsedData.images?.length || 0,
                hasAuthor: !!parsedData.author,
                language: parsedData.language
                // Removed detailed headings info to reduce log size
            });

            return parsedData;
        } catch (error) {
            logger.error('Error parsing HTML', { url, error: error.message });
            throw error;
        }
    }

    extractTitle($) {
        try {
            let title = '';
            
            // Try different title sources in order of preference
            const titleSources = [
                'title',
                'meta[property="og:title"]',
                'meta[name="twitter:title"]',
                'h1',
                'h2', // Add more fallbacks
                '.title',
                '.page-title',
                '.post-title',
                '.article-title'
            ];

            for (const selector of titleSources) {
                const element = $(selector).first();
                if (element.length > 0) {
                    title = (selector === 'title' || selector.startsWith('h') || selector.startsWith('.'))
                        ? element.text().trim()
                        : element.attr('content')?.trim() || '';
                    
                    if (title && title.length > 0) {
                        break;
                    }
                }
            }

            // If still no title, try to construct from URL
            if (!title) {
                logger.debug('No title found, attempting URL-based fallback');
                // This will be handled at the indexer level if needed
            }

            // Clean and truncate title
            title = this.sanitizeText(title);
            if (title.length > this.maxContentLength.title) {
                title = title.substring(0, this.maxContentLength.title);
                logger.warn('Title truncated', { originalLength: title.length });
            }

            return title;
        } catch (error) {
            logger.error('Error extracting title', error);
            return '';
        }
    }

    extractDescription($) {
        try {
            let description = '';
            
            // Try different description sources
            const descriptionSources = [
                'meta[name="description"]',
                'meta[property="og:description"]',
                'meta[name="twitter:description"]'
            ];

            for (const selector of descriptionSources) {
                const content = $(selector).attr('content');
                if (content && content.trim().length > 0) {
                    description = content.trim();
                    break;
                }
            }

            // If no meta description, check if this is an archive page and generate appropriate description
            if (!description) {
                const title = $('title').text().trim();
                if (this.isArchivePage(title)) {
                    description = this.generateArchiveDescription(title, $);
                }
            }

            // If still no description, try to extract from first paragraph
            if (!description) {
                const firstParagraph = $('p').first().text().trim();
                if (firstParagraph.length > 50) {
                    description = firstParagraph;
                }
            }

            description = this.sanitizeText(description);
            if (description.length > this.maxContentLength.description) {
                description = description.substring(0, this.maxContentLength.description);
            }

            return description;
        } catch (error) {
            logger.error('Error extracting description', error);
            return '';
        }
    }

    extractKeywords($) {
        try {
            let keywords = '';
            
            // Extract from meta keywords
            const metaKeywords = $('meta[name="keywords"]').attr('content');
            if (metaKeywords) {
                keywords = metaKeywords.trim();
            }

            // If no meta keywords, extract from headings and strong text
            if (!keywords) {
                const headingText = $('h1, h2, h3').map((i, el) => $(el).text().trim()).get().join(' ');
                const strongText = $('strong, b').map((i, el) => $(el).text().trim()).get().join(' ');
                keywords = `${headingText} ${strongText}`.trim();
            }

            keywords = this.sanitizeText(keywords);
            if (keywords.length > this.maxContentLength.keywords) {
                keywords = keywords.substring(0, this.maxContentLength.keywords);
            }

            return keywords;
        } catch (error) {
            logger.error('Error extracting keywords', error);
            return '';
        }
    }

    extractAuthor($) {
        try {
            // Try different author meta tags
            const authorSelectors = [
                'meta[name="author"]',
                'meta[property="article:author"]',
                'meta[name="article:author"]',
                'meta[name="twitter:creator"]',
                '.author',
                '.byline',
                '.post-author'
            ];

            for (const selector of authorSelectors) {
                const element = $(selector);
                if (element.length > 0) {
                    const content = element.attr('content') || element.text().trim();
                    if (content && content.length > 0) {
                        // Clean the author name if it's a URL
                        const cleanAuthor = this.extractCleanAuthorName(content);
                        return this.sanitizeText(cleanAuthor);
                    }
                }
            }

            return '';
        } catch (error) {
            logger.error('Error extracting author', error);
            return '';
        }
    }

    /**
     * Extract clean author name from URL or text
     * Converts: "https://www.india.com/author/analiza-pathak/" -> "Analiza Pathak"
     */
    extractCleanAuthorName(authorData) {
        if (!authorData) return '';
        
        try {
            // If it's a URL, extract the name from the path
            if (authorData.startsWith('http://') || authorData.startsWith('https://')) {
                const url = new URL(authorData);
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
            return authorData.trim();
            
        } catch (error) {
            // If parsing fails, return the original data
            return authorData.trim();
        }
    }

    extractGenerator($) {
        try {
            const generator = $('meta[name="generator"]').attr('content');
            return generator ? this.sanitizeText(generator) : '';
        } catch (error) {
            logger.error('Error extracting generator', error);
            return '';
        }
    }

    extractLanguage($) {
        try {
            // Try different language sources
            let language = '';
            
            // Check html lang attribute
            language = $('html').attr('lang');
            
            // Check meta tag
            if (!language) {
                language = $('meta[http-equiv="content-language"]').attr('content');
            }
            
            // Check og:locale
            if (!language) {
                language = $('meta[property="og:locale"]').attr('content');
            }

            if (language) {
                // Extract just the language code (e.g., 'en' from 'en-US')
                return language.split('-')[0].toLowerCase();
            }

            return null;
        } catch (error) {
            logger.error('Error extracting language', error);
            return null;
        }
    }

    extractCanonicalUrl($) {
        try {
            const canonical = $('link[rel="canonical"]').attr('href');
            return canonical ? canonical.trim() : null;
        } catch (error) {
            logger.error('Error extracting canonical URL', error);
            return null;
        }
    }

    extractPageType($) {
        try {
            // Check for page type indicators
            const ogType = $('meta[property="og:type"]').attr('content');
            if (ogType) {
                return ogType.toLowerCase();
            }

            // Check for schema.org type
            const schemaType = $('[itemtype]').attr('itemtype');
            if (schemaType) {
                const type = schemaType.split('/').pop().toLowerCase();
                return type;
            }

            // Check content structure for type detection
            if ($('article').length > 0) return 'article';
            if ($('.product, [itemtype*="Product"]').length > 0) return 'product';
            if ($('.blog-post, .post').length > 0) return 'blog';
            if ($('form[action*="contact"]').length > 0) return 'contact';
            if ($('nav, .navigation').length > 3) return 'directory';

            return 'webpage';
        } catch (error) {
            logger.error('Error extracting page type', error);
            return 'webpage';
        }
    }

    extractHeadings($) {
        try {
            const headings = {
                h1: '',
                h2: '',
                h3: '',
                h4: ''
            };

            // Extract each heading level
            for (const level of ['h1', 'h2', 'h3', 'h4']) {
                let headingText = '';
                const maxLength = this.maxContentLength[level];
                
                $(level).each((index, element) => {
                    if (headingText.length < maxLength) {
                        const text = $(element).text().trim();
                        if (text) {
                            const cleanText = text.replace(/'/g, '').replace(/\s+/g, ' ');
                            const addition = cleanText + ', ';
                            
                            if (headingText.length + addition.length <= maxLength) {
                                headingText += addition;
                            }
                        }
                    }
                });
                
                // Remove trailing comma and space
                headings[level] = headingText.replace(/, $/, '');
            }

            logger.debug('Headings extracted', {
                h1Count: $('h1').length,
                h1Length: headings.h1.length,
                h2Count: $('h2').length,
                h2Length: headings.h2.length,
                h3Count: $('h3').length,
                h3Length: headings.h3.length,
                h4Count: $('h4').length,
                h4Length: headings.h4.length
            });

            return headings;
        } catch (error) {
            logger.error('Error extracting headings', error);
            return { h1: '', h2: '', h3: '', h4: '' };
        }
    }

    extractLinks($, baseUrl) {
        try {
            const links = [];
            const linkSet = new Set(); // Prevent duplicate links
            const normalizedBaseUrl = this.normalizeUrl(baseUrl);
            
            logger.debug('Starting link extraction', { baseUrl: normalizedBaseUrl });

            // Extract all links from various sources
            const linkSelectors = [
                'a[href]',              // Standard links
                'link[href]',           // Link tags
                'area[href]',           // Image map areas
                '*[data-href]',         // Custom data attributes
                '*[data-url]',          // Custom data attributes
                'button[onclick*="location"]', // JavaScript redirects
                '*[onclick*="window.open"]'   // Popup links
            ];

            linkSelectors.forEach(selector => {
                $(selector).each((index, element) => {
                    try {
                        let href = null;
                        const $el = $(element);
                        
                        // Extract href based on element type
                        if (element.name === 'a' || element.name === 'link' || element.name === 'area') {
                            href = $el.attr('href');
                        } else if ($el.attr('data-href')) {
                            href = $el.attr('data-href');
                        } else if ($el.attr('data-url')) {
                            href = $el.attr('data-url');
                        } else if ($el.attr('onclick')) {
                            // Extract URL from onclick handlers
                            const onclick = $el.attr('onclick');
                            const locationMatch = onclick.match(/location\s*=\s*['"]([^'"]+)['"]/);
                            const windowOpenMatch = onclick.match(/window\.open\s*\(\s*['"]([^'"]+)['"]/);
                            
                            if (locationMatch) {
                                href = locationMatch[1];
                            } else if (windowOpenMatch) {
                                href = windowOpenMatch[1];
                            }
                        }

                        if (!href || href.trim() === '') {
                            return; // Skip empty hrefs
                        }

                        href = href.trim();

                        // Skip unwanted link types
                        if (this.shouldSkipLink(href)) {
                            return;
                        }

                        // Convert relative URLs to absolute
                        let absoluteUrl;
                        try {
                            if (href.startsWith('http://') || href.startsWith('https://')) {
                                absoluteUrl = href;
                            } else if (href.startsWith('//')) {
                                absoluteUrl = new URL(normalizedBaseUrl).protocol + href;
                            } else if (href.startsWith('/')) {
                                const baseUrlObj = new URL(normalizedBaseUrl);
                                absoluteUrl = `${baseUrlObj.protocol}//${baseUrlObj.host}${href}`;
                            } else {
                                absoluteUrl = new URL(href, normalizedBaseUrl).href;
                            }
                        } catch (urlError) {
                            logger.debug('Failed to resolve relative URL', { href, baseUrl: normalizedBaseUrl, error: urlError.message });
                            return;
                        }

                        // Normalize the final URL
                        absoluteUrl = this.normalizeUrl(absoluteUrl);

                        // Skip if we've already processed this URL
                        if (linkSet.has(absoluteUrl)) {
                            return;
                        }
                        linkSet.add(absoluteUrl);

                        // Extract link metadata
                        const linkText = $el.text().trim();
                        const title = $el.attr('title') || '';
                        const rel = $el.attr('rel') || '';
                        const target = $el.attr('target') || '';
                        
                        // Determine link type and priority
                        const linkType = this.determineLinkType(absoluteUrl, normalizedBaseUrl, linkText, rel);
                        const priority = this.calculateLinkPriority(linkText, absoluteUrl, linkType, title);

                        // Create link object
                        const linkObj = {
                            url: absoluteUrl,
                            text: linkText.substring(0, 255), // Limit text length
                            title: title.substring(0, 255),
                            type: linkType,
                            priority: priority,
                            rel: rel,
                            target: target,
                            isInternal: this.isInternalLink(absoluteUrl, normalizedBaseUrl),
                            isExternal: this.isExternalLink(absoluteUrl, normalizedBaseUrl),
                            elementType: element.name || 'unknown'
                        };

                        links.push(linkObj);

                    } catch (linkError) {
                        logger.debug('Error processing individual link', { error: linkError.message, selector });
                    }
                });
            });

            // Sort links by priority (higher priority first)
            links.sort((a, b) => b.priority - a.priority);

            // Categorize links
            const categorizedLinks = {
                internal: links.filter(l => l.isInternal),
                external: links.filter(l => l.isExternal),
                total: links.length,
                byType: {}
            };

            // Count by type
            links.forEach(link => {
                if (!categorizedLinks.byType[link.type]) {
                    categorizedLinks.byType[link.type] = 0;
                }
                categorizedLinks.byType[link.type]++;
            });

            logger.debug('Links extracted and categorized', { 
                total: categorizedLinks.total,
                internal: categorizedLinks.internal.length,
                external: categorizedLinks.external.length,
                byType: categorizedLinks.byType
            });

            return links;

        } catch (error) {
            logger.error('Error extracting links', { baseUrl, error: error.message });
            return [];
        }
    }

    shouldSkipLink(href) {
        // Skip common non-crawlable links
        const skipPatterns = [
            /^javascript:/i,
            /^mailto:/i,
            /^tel:/i,
            /^ftp:/i,
            /^#/,
            /^void\(0\)/i,
            /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|7z|tar|gz|mp3|mp4|avi|mov|wmv|jpg|jpeg|png|gif|webp|svg|css|js|json|xml)$/i
        ];

        return skipPatterns.some(pattern => pattern.test(href));
    }

    determineLinkType(url, baseUrl, linkText, rel) {
        try {
            const urlObj = new URL(url);
            const baseUrlObj = new URL(baseUrl);
            
            // Check rel attribute first
            if (rel) {
                if (rel.includes('canonical')) return 'canonical';
                if (rel.includes('alternate')) return 'alternate';
                if (rel.includes('next')) return 'pagination';
                if (rel.includes('prev')) return 'pagination';
                if (rel.includes('nofollow')) return 'nofollow';
            }
            
            // Check if it's the same domain
            if (urlObj.hostname === baseUrlObj.hostname) {
                // Check for common page types based on URL patterns
                if (urlObj.pathname.includes('/category/') || urlObj.pathname.includes('/tag/')) {
                    return 'category';
                } else if (urlObj.pathname.includes('/archive/') || urlObj.pathname.includes('/page/')) {
                    return 'archive';
                } else if (urlObj.pathname.includes('/search/')) {
                    return 'search';
                } else if (urlObj.pathname === '/' || urlObj.pathname === '') {
                    return 'homepage';
                } else {
                    return 'internal';
                }
            } else {
                return 'external';
            }
        } catch (error) {
            return 'unknown';
        }
    }

    isInternalLink(url, baseUrl) {
        try {
            const urlObj = new URL(url);
            const baseUrlObj = new URL(baseUrl);
            return urlObj.hostname === baseUrlObj.hostname;
        } catch (error) {
            return false;
        }
    }

    isExternalLink(url, baseUrl) {
        return !this.isInternalLink(url, baseUrl);
    }

    calculateLinkPriority(text, href, linkType, title) {
        let priority = 5; // Base priority
        
        // Boost internal links
        if (linkType === 'internal') {
            priority += 10;
        }
        
        // Boost main navigation links (common patterns)
        const navPatterns = [
            /about/i, /services/i, /products/i, /contact/i, /blog/i,
            /news/i, /article/i, /category/i, /section/i, /page/i
        ];
        
        const textLower = text.toLowerCase();
        const hrefLower = href.toLowerCase();
        
        for (const pattern of navPatterns) {
            if (pattern.test(textLower) || pattern.test(hrefLower)) {
                priority += 5;
                break;
            }
        }
        
        // Boost links with meaningful text (not just "click here", "read more")
        if (text.length > 10 && !/(click here|read more|more|view|see)/i.test(textLower)) {
            priority += 3;
        }
        
        // Boost links with titles
        if (title && title.length > 5) {
            priority += 2;
        }
        
        // Reduce priority for likely non-content links
        const skipPatterns = [
            /login/i, /register/i, /signup/i, /logout/i, /admin/i,
            /search/i, /cart/i, /checkout/i, /payment/i, /privacy/i,
            /terms/i, /sitemap/i, /rss/i, /feed/i, /print/i
        ];
        
        for (const pattern of skipPatterns) {
            if (pattern.test(textLower) || pattern.test(hrefLower)) {
                priority -= 5;
                break;
            }
        }
        
        return Math.max(1, priority); // Minimum priority of 1
    }

    extractImages($, baseUrl) {
        try {
            const images = [];
            const seenUrls = new Set();

            $('img[src]').each((index, element) => {
                let src; // Declare src at the beginning so it's available in catch block
                try {
                    src = $(element).attr('src');
                    const alt = $(element).attr('alt') || '';
                    const title = $(element).attr('title') || '';
                    
                    if (!src) return;

                    // Skip base64 data URLs, blob URLs, and other invalid image URLs efficiently
                    if (src.startsWith('data:') || src.startsWith('blob:') || 
                        src.startsWith('javascript:') || src.startsWith('mailto:') ||
                        src.startsWith('tel:')) {
                        // Reduced logging: only log first occurrence per page
                if (!this.base64UrlLogged) {
                    logger.debug('Skipping invalid image URLs (data:, blob:, etc.) - further occurrences not logged', { count: 1 });
                    this.base64UrlLogged = true;
                }
                        return;
                    }

                    // Resolve relative URLs
                    const absoluteUrl = new URL(src, baseUrl).toString();
                    
                    // Avoid duplicates
                    if (seenUrls.has(absoluteUrl)) {
                        return;
                    }
                    seenUrls.add(absoluteUrl);

                    images.push({
                        url: absoluteUrl,
                        alt: alt.substring(0, 255),
                        title: title.substring(0, 255),
                        width: $(element).attr('width') || '',
                        height: $(element).attr('height') || ''
                    });
                } catch (urlError) {
                    logger.debug('Invalid image URL found', { src: src || 'undefined' });
                }
            });

            return images;
        } catch (error) {
            logger.error('Error extracting images', error);
            return [];
        }
    }

    extractVideos($, baseUrl) {
        try {
            const videos = [];
            const seenUrls = new Set();

            // Extract from video tags
            $('video[src], video source[src]').each((index, element) => {
                let src; // Declare src at the beginning so it's available in catch block
                try {
                    src = $(element).attr('src');
                    if (!src) return;

                    const absoluteUrl = new URL(src, baseUrl).toString();
                    if (seenUrls.has(absoluteUrl)) return;
                    seenUrls.add(absoluteUrl);

                    videos.push({
                        url: absoluteUrl,
                        type: 'video',
                        title: $(element).closest('video').attr('title') || '',
                        poster: $(element).closest('video').attr('poster') || ''
                    });
                } catch (urlError) {
                    logger.debug('Invalid video URL found', { src: src || 'undefined' });
                }
            });

            // Extract embedded videos (YouTube, Vimeo, etc.)
            $('iframe[src*="youtube"], iframe[src*="vimeo"], iframe[src*="dailymotion"]').each((index, element) => {
                let src; // Declare src at the beginning so it's available in catch block
                try {
                    src = $(element).attr('src');
                    if (!src) return;

                    const absoluteUrl = new URL(src, baseUrl).toString();
                    if (seenUrls.has(absoluteUrl)) return;
                    seenUrls.add(absoluteUrl);

                    videos.push({
                        url: absoluteUrl,
                        type: 'embedded',
                        title: $(element).attr('title') || '',
                        width: $(element).attr('width') || '',
                        height: $(element).attr('height') || ''
                    });
                } catch (urlError) {
                    logger.debug('Invalid embedded video URL found', { src: src || 'undefined' });
                }
            });

            return videos;
        } catch (error) {
            logger.error('Error extracting videos', error);
            return [];
        }
    }

    extractDocuments($, baseUrl) {
        try {
            const documents = [];
            const seenUrls = new Set();
            
            // Document file extensions to look for
            const documentExtensions = [
                'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
                'txt', 'rtf', 'odt', 'ods', 'odp', 'csv'
            ];
            
            // Create regex pattern for document extensions
            const docPattern = new RegExp(`\\.(${documentExtensions.join('|')})(?:\\?|$)`, 'i');

            $('a[href]').each((index, element) => {
                let href; // Declare href at the beginning so it's available in catch block
                try {
                    href = $(element).attr('href');
                    const text = $(element).text().trim();
                    
                    if (!href) return;

                    // Check if the link points to a document
                    if (docPattern.test(href)) {
                        // Resolve relative URLs
                        const absoluteUrl = new URL(href, baseUrl).toString();
                        
                        // Avoid duplicates
                        if (seenUrls.has(absoluteUrl)) {
                            return;
                        }
                        seenUrls.add(absoluteUrl);

                        // Extract file extension
                        const match = href.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
                        const fileType = match ? match[1].toLowerCase() : 'unknown';

                        documents.push({
                            url: absoluteUrl,
                            title: text.substring(0, 255) || '',
                            description: $(element).attr('title') || text.substring(0, 255) || '',
                            type: fileType.toUpperCase(),
                            href: href // Keep original href for reference
                        });
                    }
                } catch (urlError) {
                    logger.debug('Invalid document URL found', { href: href || 'undefined' });
                }
            });

            // Also check for embedded documents (like PDF viewers)
            $('iframe[src], embed[src], object[data]').each((index, element) => {
                let src; // Declare src at the beginning so it's available in catch block
                try {
                    src = $(element).attr('src') || $(element).attr('data');
                    if (!src) return;

                    if (docPattern.test(src)) {
                        const absoluteUrl = new URL(src, baseUrl).toString();
                        
                        if (seenUrls.has(absoluteUrl)) return;
                        seenUrls.add(absoluteUrl);

                        const match = src.match(/\\.([a-zA-Z0-9]+)(?:\\?|$)/);
                        const fileType = match ? match[1].toLowerCase() : 'unknown';

                        documents.push({
                            url: absoluteUrl,
                            title: $(element).attr('title') || 'Embedded Document',
                            description: 'Embedded document found on page',
                            type: fileType.toUpperCase(),
                            embedded: true
                        });
                    }
                } catch (urlError) {
                    logger.debug('Invalid embedded document URL found', { src: src || 'undefined' });
                }
            });

            logger.debug('Documents extracted', { 
                count: documents.length,
                types: [...new Set(documents.map(doc => doc.type))]
            });

            return documents;
        } catch (error) {
            logger.error('Error extracting documents', error);
            return [];
        }
    }

    extractArticleContent($) {
        try {
            let articleContent = '';
            let bestContentLength = 0;
            let bestSelector = '';

            // Try different article content selectors in order of preference
            const contentSelectors = [
                'article',
                'main',
                '.content',
                '.post-content',
                '.entry-content',
                '#content',
                '.main-content',
                '.article-content',
                '.post',
                '.entry',
                '.story-content',
                '.article-body',
                '.news-content',
                '.blog-content',
                '.page-content',
                '.text-content',
                'section',
                '.container',
                '#main',
                '.wrapper'
            ];

            // Track which selectors found content for debugging
            const selectorResults = [];

            for (const selector of contentSelectors) {
                const elements = $(selector);
                if (elements.length > 0) {
                    elements.each((index, element) => {
                        const text = this.extractTextContent($(element));
                        selectorResults.push({
                            selector: selector,
                            elementIndex: index,
                            contentLength: text.length
                        });
                        
                        if (text.length > bestContentLength) {
                            bestContentLength = text.length;
                            articleContent = text;
                            bestSelector = selector;
                        }
                    });
                    
                    // Continue trying all selectors to find the best one
                }
            }

            // Enhanced fallback strategies
            if (!articleContent || articleContent.length < 100) {
                // Strategy 1: Try to get all paragraph content
                let paragraphContent = '';
                $('p').each((index, element) => {
                    const text = $(element).text().trim();
                    if (text.length > 20) {
                        paragraphContent += text + '\n\n';
                    }
                });
                
                if (paragraphContent.length > bestContentLength) {
                    bestContentLength = paragraphContent.length;
                    articleContent = paragraphContent;
                    bestSelector = 'paragraphs';
                }

                // Strategy 2: Try div elements with substantial text
                if (articleContent.length < 100) {
                    $('div').each((index, element) => {
                        const $div = $(element);
                        const text = this.extractTextContent($div);
                        if (text.length > 200 && text.length > bestContentLength) {
                            bestContentLength = text.length;
                            articleContent = text;
                            bestSelector = 'div';
                        }
                    });
                }

                // Strategy 3: Last resort - get all body text
                if (articleContent.length < 50) {
                    const bodyText = this.extractTextContent($('body'));
                    if (bodyText.length > bestContentLength) {
                        bestContentLength = bodyText.length;
                        articleContent = bodyText;
                        bestSelector = 'body';
                    }
                }
            }

            // Enhanced debugging for content extraction
            if (articleContent.length === 0) {
                const pageStructure = this.analyzePageStructure($);
                logger.warn('No content extracted from page', {
                    selectorResults: selectorResults.slice(0, 5), // Show first 5 results
                    totalSelectors: contentSelectors.length,
                    bodyLength: $('body').text().length,
                    paragraphCount: $('p').length,
                    pageStructure: pageStructure
                });
            } else if (articleContent.length < 100) {
                logger.debug('Low content extracted from page', {
                    contentLength: articleContent.length,
                    bestSelector: bestSelector,
                    preview: articleContent.substring(0, 100)
                });
            } else {
                logger.debug('Content extracted successfully', {
                    contentLength: articleContent.length,
                    bestSelector: bestSelector
                });
            }

            // Clean and truncate
            articleContent = this.sanitizeText(articleContent);
            if (articleContent.length > this.maxContentLength.article) {
                articleContent = articleContent.substring(0, this.maxContentLength.article);
                logger.warn('Article content truncated to 2MB limit');
            }

            return articleContent;
        } catch (error) {
            logger.error('Error extracting article content', error);
            return '';
        }
    }

    extractTextContent($element) {
        try {
            // Clone the element to avoid modifying the original
            const $clonedElement = $element.clone();
            
            // Remove script and style elements and other unwanted content
            $clonedElement.find('script, style, nav, header, footer, aside, .nav, .navigation, .menu, .sidebar, .advertisement, .ads, .social-share').remove();
            
            // Remove all img tags to prevent malformed attribute extraction
            $clonedElement.find('img').remove();
            
            // Remove other self-closing tags that might have malformed attributes
            $clonedElement.find('input, meta, link, br, hr').remove();
            
            // Get text content more efficiently
            let text = $clonedElement.text().trim();
            
            // Clean up whitespace and normalize
            text = text
                .replace(/\s+/g, ' ')           // Replace multiple whitespace with single space
                .replace(/\n\s*\n/g, '\n\n')   // Normalize line breaks
                .trim();

            return text;
        } catch (error) {
            logger.error('Error extracting text content', error);
            return '';
        }
    }

    
    extractIcon($) {
        try {
            const iconSelectors = [
                'link[rel="shortcut icon"]',
                'link[rel="icon"]',
                'link[rel="apple-touch-icon"]'
            ];

            for (const selector of iconSelectors) {
                const href = $(selector).attr('href');
                if (href) {
                    return href;
                }
            }

            return '';
        } catch (error) {
            logger.error('Error extracting icon', error);
            return '';
        }
    }

    extractMetadata($) {
        try {
            const metadata = {};

            // Extract Open Graph metadata
            $('meta[property^="og:"]').each((index, element) => {
                const property = $(element).attr('property');
                const content = $(element).attr('content');
                if (property && content) {
                    metadata[property] = content;
                }
            });

            // Extract Twitter Card metadata
            $('meta[name^="twitter:"]').each((index, element) => {
                const name = $(element).attr('name');
                const content = $(element).attr('content');
                if (name && content) {
                    metadata[name] = content;
                }
            });

            // Extract other useful metadata
            const metaSelectors = [
                'meta[name="author"]',
                'meta[name="robots"]',
                'meta[name="viewport"]',
                'meta[charset]'
            ];

            metaSelectors.forEach(selector => {
                const element = $(selector);
                if (element.length > 0) {
                    const name = element.attr('name') || 'charset';
                    const content = element.attr('content') || element.attr('charset');
                    if (content) {
                        metadata[name] = content;
                    }
                }
            });

            return metadata;
        } catch (error) {
            logger.error('Error extracting metadata', error);
            return {};
        }
    }

    sanitizeText(text) {
        if (!text) return '';
        
        // Enhanced sanitization to remove CSS style patterns and HTML attributes
        return text
            // Remove CSS style patterns that got extracted as text
            .replace(/style=position:absolute[^>]*>/gi, '')
            .replace(/style=[^>]*position:absolute[^>]*>/gi, '')
            .replace(/decoding=async[^>]*>/gi, '')
            .replace(/data-nimg=intrinsic[^>]*>/gi, '')
            .replace(/loading=lazy[^>]*>/gi, '')
            
            // Remove common CSS properties that appear as text
            .replace(/position:absolute;?/gi, '')
            .replace(/top:\d+;?/gi, '')
            .replace(/left:\d+;?/gi, '')
            .replace(/bottom:\d+;?/gi, '')
            .replace(/right:\d+;?/gi, '')
            .replace(/box-sizing:border-box;?/gi, '')
            .replace(/padding:\d+;?/gi, '')
            .replace(/border:none;?/gi, '')
            .replace(/margin:auto;?/gi, '')
            .replace(/display:block;?/gi, '')
            .replace(/width:\d+%;?/gi, '')
            .replace(/height:\d+%;?/gi, '')
            .replace(/min-width:\d+%;?/gi, '')
            .replace(/max-width:\d+%;?/gi, '')
            .replace(/min-height:\d+%;?/gi, '')
            .replace(/max-height:\d+%;?/gi, '')
            
            // Remove HTML attribute patterns that got extracted as text
            .replace(/\balt=[^>\s]*\b/gi, '')
            .replace(/\bsrc=[^>\s]*\b/gi, '')
            .replace(/\bdecoding=[^>\s]*\b/gi, '')
            .replace(/\bdata-nimg=[^>\s]*\b/gi, '')
            .replace(/\bloading=[^>\s]*\b/gi, '')
            .replace(/\bstyle=[^>]*>/gi, '')
            
            // Remove URLs that appear as text (from src attributes)
            .replace(/https?:\/\/[^\s<>"]+\.(?:jpg|jpeg|png|gif|webp|svg|bmp|tiff|ico)/gi, '')
            
            // General cleanup
            .replace(/[\r\n\t]+/g, ' ')   // Replace line breaks and tabs with spaces
            .replace(/\s+/g, ' ')         // Replace multiple spaces with single space
            .replace(/['"]/g, '')         // Remove quotes to prevent SQL issues
            .replace(/;\s*;+/g, ';')      // Remove multiple semicolons
            .replace(/[;:]+\s*$/, '')     // Remove trailing semicolons/colons
            .trim();                      // Remove leading/trailing whitespace
    }

    // Utility method to check if domain is related to main domain
    isRelatedDomain(urlDomain, mainDomain) {
        if (!urlDomain || !mainDomain) return false;
        
        const cleanUrlDomain = urlDomain.replace(/^www\./, '');
        const cleanMainDomain = mainDomain.replace(/^www\./, '');
        
        return cleanUrlDomain === cleanMainDomain || 
               cleanUrlDomain.endsWith('.' + cleanMainDomain) || 
               cleanMainDomain.endsWith('.' + cleanUrlDomain);
    }

    // Extract root domain from any domain
    getRootDomain(domain) {
        if (!domain) return '';
        
        let cleanDomain = domain.replace(/^www\./, '');
        const parts = cleanDomain.split('.');
        
        if (parts.length >= 2) {
            const commonTLDs = ['com', 'org', 'net', 'edu', 'gov', 'co', 'ac'];
            
            if (parts.length > 2 && commonTLDs.includes(parts[parts.length - 2])) {
                return parts.slice(parts.length - 3).join('.');
            } else {
                return parts.slice(parts.length - 2).join('.');
            }
        }
        
        return cleanDomain;
    }

    // Archive page detection helper method
    isArchivePage(title) {
        const archivePatterns = [
            /\bArchives?\b/i,
            /\bकाटेगरी\b/i,      // Category in Marathi
            /\bसंग्रह\b/i,       // Archive in Marathi
            /\bयादी\b/i,        // List in Marathi
            /\bCategory\b/i,
            /\bTag\b/i,
            /\bIndex\b/i,
            /\bListing\b/i
        ];
        
        return archivePatterns.some(pattern => pattern.test(title));
    }

    // Generate unique description for archive pages
    generateArchiveDescription(title, $) {
        try {
            // Extract the category/archive name from title
            let categoryName = title.replace(/\s*(Archives?|काटेगरी|संग्रह|यादी|Category|Tag|Index|Listing)\s*-?\s*/gi, '').trim();
            
            // Remove site name if present
            categoryName = categoryName.replace(/\s*-\s*[^-]+$/, '').trim();
            
            if (!categoryName) {
                categoryName = 'या विभागातील';
            }
            
            // Count articles/links on the page
            const articleLinks = $('h2 a, h3 a, .entry-title a, .post-title a').length;
            const totalLinks = $('a[href]').length;
            
            // Generate contextual description
            let description = '';
            if (articleLinks > 0) {
                description = `${categoryName} मध्ये ${articleLinks} लेख उपलब्ध आहेत. या विभागातील सर्व लेख पाहण्यासाठी येथे क्लिक करा.`;
            } else if (totalLinks > 5) {
                description = `${categoryName} संबंधी माहिती आणि संदर्भ लिंक्स या पानावर उपलब्ध आहेत.`;
            } else {
                description = `${categoryName} संबंधी अधिक माहितीसाठी या पानाचा आढावा घ्या.`;
            }
            
            return description.substring(0, 200); // Limit length
            
        } catch (error) {
            logger.error('Error generating archive description', error);
            return 'या संग्रह पानावर संबंधित लेख आणि माहिती उपलब्ध आहे.';
        }
    }

    /**
     * Analyze page structure to help debug content extraction issues
     */
    analyzePageStructure($) {
        try {
            const structure = {
                totalElements: $('*').length,
                divCount: $('div').length,
                sectionCount: $('section').length,
                articleCount: $('article').length,
                mainCount: $('main').length,
                paragraphCount: $('p').length,
                headingCount: $('h1, h2, h3, h4, h5, h6').length,
                commonContentClasses: [],
                commonContentIds: []
            };

            // Find common content-related classes
            const classesToCheck = ['content', 'main', 'article', 'post', 'entry', 'story', 'news', 'blog', 'text'];
            classesToCheck.forEach(className => {
                const elements = $(`.${className}`);
                if (elements.length > 0) {
                    structure.commonContentClasses.push({
                        className: className,
                        count: elements.length,
                        textLength: elements.text().length
                    });
                }
            });

            // Find common content-related IDs
            const idsToCheck = ['content', 'main', 'article', 'post', 'entry'];
            idsToCheck.forEach(id => {
                const element = $(`#${id}`);
                if (element.length > 0) {
                    structure.commonContentIds.push({
                        id: id,
                        textLength: element.text().length
                    });
                }
            });

            return structure;
        } catch (error) {
            logger.error('Error analyzing page structure', error);
            return {};
        }
    }
}

module.exports = { ContentParser }; 