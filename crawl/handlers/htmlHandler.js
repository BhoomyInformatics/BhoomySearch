const cheerio = require('cheerio');
const { ContentParser } = require('../core/parser');
const { logger } = require('../utils/logger');

class HtmlHandler {
    constructor() {
        this.parser = new ContentParser();
        this.excludedExtensions = /\.(jpg|jpeg|png|gif|bmp|webp|svg|tiff|ico|pdf|doc|docx|xls|xlsx|ppt|pptx|txt|rtf|csv|zip|rar)$/i;
    }

    async process(htmlContent, url, crawlerInstance, responseMetadata = {}) {
        try {
            // Reduced logging verbosity - only log for large content or debug mode
            if (htmlContent.length > 500000 || process.env.DEBUG_MODE === 'true') {
                logger.info('Processing HTML content', { 
                    url, 
                    contentLength: htmlContent.length 
                });
            }

            // Parse the HTML content
            const parsedData = this.parser.parseHtml(htmlContent, url);
            
            // Add HTTP response metadata to parsed data
            if (responseMetadata) {
                parsedData.responseCode = responseMetadata.statusCode;
                parsedData.loadTime = responseMetadata.loadTime;
                parsedData.redirectUrl = responseMetadata.redirectUrl;
            }
            
            // Set the cheerio instance for the crawler
            crawlerInstance.$ = cheerio.load(htmlContent);
            crawlerInstance.site_data_db_row = this.mapToDbRow(parsedData, url);

            // Media persistence is handled by the indexer AFTER page insert so that
            // a valid `site_data_id` is available. Avoid preemptive media inserts here.
            // If you intentionally want pre-insert media persistence, enable via env flag.
            try {
                const prefetchEnabled = process.env.PREFETCH_MEDIA_BEFORE_PAGE_INSERT === 'true';
                if (prefetchEnabled) {
                    const siteId = (crawlerInstance.smartStats && crawlerInstance.smartStats.siteId) || crawlerInstance.db_row?.site_id || null;
                    // Only prefetch when we already have a known site_data_id
                    const siteDataId = crawlerInstance.lastInsertedSiteDataId || null;
                    if (siteId && siteDataId && crawlerInstance.contentIndexer && typeof crawlerInstance.contentIndexer.insertMediaItems === 'function') {
                        await crawlerInstance.contentIndexer.insertMediaItems(parsedData, siteId, siteDataId, url);
                    }
                }
            } catch (mediaPrefetchErr) {
                logger.debug('Media prefetch disabled or failed (non-blocking)', { url, error: mediaPrefetchErr.message });
            }

            // Extract additional links for further crawling
            const extractedLinks = this.extractCrawlableLinks(parsedData.links, url, crawlerInstance);
            
            // Only log completion for significant pages or debug mode
            if (extractedLinks.length > 20 || (parsedData.article?.length || 0) > 10000 || process.env.DEBUG_MODE === 'true') {
                logger.info('HTML processing completed', { 
                    url,
                    title: parsedData.title?.substring(0, 50) + (parsedData.title?.length > 50 ? '...' : ''),
                    linksFound: extractedLinks.length,
                    contentLength: parsedData.article?.length || 0
                });
            }

            return {
                parsedData,
                extractedLinks,
                success: true
            };
        } catch (error) {
            logger.error('Error processing HTML content', { 
                url, 
                error: error.message,
                stack: error.stack 
            });
            throw error;
        }
    }

    mapToDbRow(parsedData, url) {
        return {
            site_url: url,
            site_data_title: parsedData.title || '',
            site_data_description: parsedData.description || '',
            site_data_keywords: parsedData.keywords || '',
            site_data_h1: parsedData.headings?.h1 || '',
            site_data_h2: parsedData.headings?.h2 || '',
            site_data_h3: parsedData.headings?.h3 || '',
            site_data_h4: parsedData.headings?.h4 || '',
            site_data_article: parsedData.article || '',            
            site_data_icon: parsedData.icon || '',
            site_data_links: JSON.stringify(parsedData.links || []),
            site_data_images: JSON.stringify(parsedData.images || []),
            site_data_videos: JSON.stringify(parsedData.videos || []),
            site_data_metadata: JSON.stringify(parsedData.metadata || {}),
            crawl_date: new Date(),
            status: 'processed'
        };
    }

    extractCrawlableLinks(links, baseUrl, crawlerInstance) {
        try {
            const crawlableLinks = [];
            const baseUrlObj = new URL(baseUrl);
            const baseDomain = this.parser.getRootDomain(baseUrlObj.hostname);
            let filteredOut = {
                domain: 0,
                extension: 0,
                nonContent: 0,
                tooLong: 0,
                invalid: 0
            };

            for (const link of links) {
                try {
                    const linkUrl = link.url;
                    const linkUrlObj = new URL(linkUrl);
                    const linkDomain = this.parser.getRootDomain(linkUrlObj.hostname);

                    // Only crawl links from the same domain or related domains
                    if (!this.parser.isRelatedDomain(linkDomain, baseDomain)) {
                        filteredOut.domain++;
                        continue;
                    }

                    // Skip excluded file extensions
                    if (this.excludedExtensions.test(linkUrl)) {
                        filteredOut.extension++;
                        continue;
                    }

                    // Skip common non-content URLs
                    if (this.isNonContentUrl(linkUrl)) {
                        filteredOut.nonContent++;
                        continue;
                    }

                    // Skip URLs that are too long (likely dynamic/spam)
                    if (linkUrl.length > 500) {
                        filteredOut.tooLong++;
                        continue;
                    }

                    crawlableLinks.push({
                        url: linkUrl,
                        text: link.text,
                        title: link.title,
                        depth: (crawlerInstance.options?.depth || 0) + 1,
                        parentUrl: baseUrl
                    });

                } catch (urlError) {
                    filteredOut.invalid++;
                    logger.debug('Invalid URL in link extraction', { 
                        url: link.url, 
                        error: urlError.message 
                    });
                }
            }

            // Remove duplicates and limit the number of links
            const uniqueLinks = this.removeDuplicateLinks(crawlableLinks);
            const limitedLinks = uniqueLinks.slice(0, crawlerInstance.options?.maxLinksPerPage || 100);

            // Enhanced debugging for zero-link situations
            if (limitedLinks.length === 0 && links.length > 0) {
                logger.warn('Zero crawlable links found despite having links', { 
                    baseUrl,
                    totalLinks: links.length,
                    filteredOut,
                    sampleLinks: links.slice(0, 3).map(l => ({ url: l.url, text: l.text }))
                });
            }

            logger.debug('Crawlable links extracted', { 
                baseUrl,
                totalLinks: links.length,
                crawlableLinks: limitedLinks.length,
                filteredOut: Object.values(filteredOut).reduce((a, b) => a + b, 0) > 0 ? filteredOut : undefined
            });

            return limitedLinks;
        } catch (error) {
            logger.error('Error extracting crawlable links', { 
                baseUrl, 
                error: error.message 
            });
            return [];
        }
    }

    isNonContentUrl(url) {
        const nonContentPatterns = [
            /\/login/i,
            /\/register/i,
            /\/signup/i,
            /\/logout/i,
            /\/admin/i,
            /\/api\//i,
            /\/ajax/i,
            /\/search\?/i,
            /\/cart/i,
            /\/checkout/i,
            /\/account/i,
            /\/profile/i,
            /\/settings/i,
            /\/privacy/i,
            /\/terms/i,
            /\/contact/i,
            /\/about/i,
            /\/help/i,
            /\/support/i,
            /\/faq/i,
            /\.(css|js|json|xml|txt|pdf)$/i,
            /\/feed/i,
            /\/rss/i,
            /\/sitemap/i,
            /\/robots\.txt/i,
            /mailto:/i,
            /tel:/i,
            /javascript:/i,
            /#/
        ];

        return nonContentPatterns.some(pattern => pattern.test(url));
    }

    removeDuplicateLinks(links) {
        const seen = new Set();
        return links.filter(link => {
            // Normalize URL for comparison (remove fragments, trailing slashes)
            const normalizedUrl = this.normalizeUrl(link.url);
            if (seen.has(normalizedUrl)) {
                return false;
            }
            seen.add(normalizedUrl);
            return true;
        });
    }

    normalizeUrl(url) {
        try {
            const urlObj = new URL(url);
            // Remove fragment and normalize path
            urlObj.hash = '';
            urlObj.pathname = urlObj.pathname.replace(/\/+$/, '') || '/';
            return urlObj.toString();
        } catch (error) {
            return url;
        }
    }

    // Method to validate HTML content quality
    validateContentQuality(parsedData) {
        const quality = {
            score: 0,
            issues: [],
            recommendations: []
        };

        // Check title
        if (!parsedData.title || parsedData.title.length < 10) {
            quality.issues.push('Title is missing or too short');
        } else if (parsedData.title.length > 60) {
            quality.issues.push('Title is too long for SEO');
        } else {
            quality.score += 20;
        }

        // Check description
        if (!parsedData.description || parsedData.description.length < 50) {
            quality.issues.push('Meta description is missing or too short');
        } else if (parsedData.description.length > 160) {
            quality.issues.push('Meta description is too long');
        } else {
            quality.score += 20;
        }

        // Check content length
        if (!parsedData.article || parsedData.article.length < 300) {
            quality.issues.push('Content is too short');
        } else {
            quality.score += 30;
        }

        // Check headings structure
        if (!parsedData.headings?.h1) {
            quality.issues.push('Missing H1 heading');
        } else {
            quality.score += 15;
        }

        // Check images
        if (parsedData.images && parsedData.images.length > 0) {
            const imagesWithoutAlt = parsedData.images.filter(img => !img.alt);
            if (imagesWithoutAlt.length > 0) {
                quality.issues.push(`${imagesWithoutAlt.length} images missing alt text`);
            } else {
                quality.score += 15;
            }
        }

        // Generate recommendations
        if (quality.score < 50) {
            quality.recommendations.push('Improve content structure and SEO elements');
        }
        if (quality.score < 30) {
            quality.recommendations.push('Content needs significant improvement');
        }

        return quality;
    }

    // Method to extract structured data (JSON-LD, microdata)
    extractStructuredData($) {
        const structuredData = [];

        try {
            // Extract JSON-LD
            $('script[type="application/ld+json"]').each((index, element) => {
                try {
                    const jsonData = JSON.parse($(element).html());
                    structuredData.push({
                        type: 'json-ld',
                        data: jsonData
                    });
                } catch (parseError) {
                    logger.debug('Invalid JSON-LD found', { parseError: parseError.message });
                }
            });

            // Extract microdata
            $('[itemscope]').each((index, element) => {
                const itemType = $(element).attr('itemtype');
                const itemProps = {};
                
                $(element).find('[itemprop]').each((propIndex, propElement) => {
                    const propName = $(propElement).attr('itemprop');
                    const propValue = $(propElement).attr('content') || $(propElement).text().trim();
                    itemProps[propName] = propValue;
                });

                if (Object.keys(itemProps).length > 0) {
                    structuredData.push({
                        type: 'microdata',
                        itemType: itemType,
                        data: itemProps
                    });
                }
            });

            logger.debug('Structured data extracted', { 
                count: structuredData.length 
            });

            return structuredData;
        } catch (error) {
            logger.error('Error extracting structured data', { error: error.message });
            return [];
        }
    }

    // Method to detect page type
    detectPageType(parsedData, url) {
        const urlPath = url.toLowerCase();
        const title = (parsedData.title || '').toLowerCase();
        const content = (parsedData.article || '').toLowerCase();

        // Blog post detection
        if (urlPath.includes('/blog/') || urlPath.includes('/post/') || 
            urlPath.includes('/article/') || title.includes('blog')) {
            return 'blog_post';
        }

        // Product page detection
        if (urlPath.includes('/product/') || urlPath.includes('/item/') ||
            content.includes('price') || content.includes('buy now') ||
            content.includes('add to cart')) {
            return 'product';
        }

        // News article detection
        if (urlPath.includes('/news/') || title.includes('news') ||
            content.includes('published') || content.includes('reporter')) {
            return 'news_article';
        }

        // Homepage detection
        if (urlPath === '/' || urlPath.endsWith('/') && urlPath.split('/').length <= 3) {
            return 'homepage';
        }

        // Category/listing page detection
        if (urlPath.includes('/category/') || urlPath.includes('/tag/') ||
            parsedData.links && parsedData.links.length > 20) {
            return 'category';
        }

        return 'general';
    }
}

module.exports = { HtmlHandler }; 