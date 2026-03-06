const logger = require('../utils/logger');

class HtmlHandler {
    constructor($, url) {
        this.$ = $;
        this.url = url;
    }

    extractTitle() {
        try {
            const title = this.$('title').text().trim().replace(/'/g, '');
            if (title) return title;
            // Fallback: Open Graph / Twitter title (never use URL)
            const ogTitle = (this.$('meta[property="og:title"]').attr('content') || '').trim().replace(/'/g, '');
            if (ogTitle && !this.looksLikeUrl(ogTitle)) return ogTitle;
            const twitterTitle = (this.$('meta[name="twitter:title"]').attr('content') || '').trim().replace(/'/g, '');
            if (twitterTitle && !this.looksLikeUrl(twitterTitle)) return twitterTitle;
            return '';
        } catch (error) {
            logger.error(`Error extracting title: ${error.message}`);
            return '';
        }
    }

    looksLikeUrl(text) {
        if (!text || typeof text !== 'string') return true;
        const t = text.trim();
        return /^https?:\/\//i.test(t) || /^[a-z][a-z0-9+.-]*:\/\//i.test(t) || /^www\./i.test(t);
    }

    extractMetaTags() {
        let description = (this.$('meta[name=description]').attr('content') || '').trim();
        if (!description || this.looksLikeUrl(description)) {
            const ogDesc = (this.$('meta[property="og:description"]').attr('content') || '').trim();
            if (ogDesc && !this.looksLikeUrl(ogDesc)) description = ogDesc;
        }
        if (!description || this.looksLikeUrl(description)) {
            const twitterDesc = (this.$('meta[name="twitter:description"]').attr('content') || '').trim();
            if (twitterDesc && !this.looksLikeUrl(twitterDesc)) description = twitterDesc;
        }
        if (this.looksLikeUrl(description)) description = '';

        const meta = {
            generator: this.$('meta[name=generator]').attr('content') || '',
            description: description.replace(/'/g, ''),
            keywords: this.$('meta[name=keywords]').attr('content') || '',
            author: this.$('meta[name=author]').attr('content') || '',
            analytics: this.$('meta[name=analytics]').attr('content') || ''
        };

        Object.keys(meta).forEach(key => {
            if (meta[key]) {
                meta[key] = meta[key].replace(/'/g, '');
            }
        });

        return meta;
    }

    extractHeadings() {
        const MAX_LENGTH = 1048000;
        
        const extractHeading = (selector) => {
            let text = '';
            const self = this;
            this.$(selector).each(function() {
                const headingText = self.$(this).text().trim().replace(/'/g, '') + ' ,';
                if (text.length + headingText.length <= MAX_LENGTH) {
                    text += headingText;
                }
            });
            return text;
        };

        return {
            h1: extractHeading('H1', 'h1'),
            h2: extractHeading('H2', 'h2'),
            h3: extractHeading('H3', 'h3'),
            h4: extractHeading('H4', 'h4')
        };
    }

    extractArticle() {
        try {
            const self = this;
            if (this.$('article').length > 0) {
                let content = '';
                this.$('article').each(function() {
                    content += self.$(this).text().trim() + ' ';
                });
                if (content.length > 0) {
                    return content.replace(/"/g, '').substring(0, 2096000);
                }
            }

            const contentSelectors = ['main', '.content', '.post-content', '.entry-content', '#content'];
            for (const selector of contentSelectors) {
                if (this.$(selector).length > 0) {
                    let content = '';
                    this.$(selector).each(function() {
                        content += self.$(this).text().trim() + ' ';
                    });
                    if (content.length > 0) {
                        return content.replace(/"/g, '').substring(0, 2096000);
                    }
                }
            }

            let paragraphs = '';
            this.$('p').each(function() {
                const text = self.$(this).text().trim();
                if (text.length > 20) {
                    paragraphs += text + ' ';
                }
            });

            return paragraphs.replace(/"/g, '').substring(0, 2096000);
        } catch (error) {
            logger.error(`Error extracting article: ${error.message}`);
            return '';
        }
    }

    extractIcon() {
        try {
            return this.$('link[rel="shortcut icon"]').attr('href') || 
                   this.$('link[rel="icon"]').attr('href') || '';
        } catch (error) {
            return '';
        }
    }

    extractLinks(domain, rootDomain) {
        const links = [];
        const self = this;

        this.$('a[href]').each(function() {
            try {
                const href = self.$(this).attr('href');
                if (!href || href.includes('@')) return;

                const domainMatch = href.match(/^(?:https?:)?(?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:\/\n]+)/);
                if (domainMatch && domainMatch[1] === domain) {
                    if (!links.find(x => x === href)) {
                        links.push(href);
                    }
                }
            } catch (error) {
                // Skip invalid links
            }
        });

        return links;
    }

    extractMetadata() {
        try {
            const metadata = {
                ogTitle: this.$('meta[property="og:title"]').attr('content') || '',
                ogDescription: this.$('meta[property="og:description"]').attr('content') || '',
                ogImage: this.$('meta[property="og:image"]').attr('content') || '',
                ogUrl: this.$('meta[property="og:url"]').attr('content') || '',
                ogType: this.$('meta[property="og:type"]').attr('content') || '',
                twitterCard: this.$('meta[name="twitter:card"]').attr('content') || '',
                twitterTitle: this.$('meta[name="twitter:title"]').attr('content') || '',
                twitterDescription: this.$('meta[name="twitter:description"]').attr('content') || '',
                twitterImage: this.$('meta[name="twitter:image"]').attr('content') || '',
                canonical: this.$('link[rel="canonical"]').attr('href') || '',
                language: this.$('html').attr('lang') || this.$('meta[http-equiv="content-language"]').attr('content') || '',
                charset: this.$('meta[charset]').attr('charset') || '',
                viewport: this.$('meta[name="viewport"]').attr('content') || '',
                robots: this.$('meta[name="robots"]').attr('content') || ''
            };

            return JSON.stringify(metadata);
        } catch (error) {
            logger.error(`Error extracting metadata: ${error.message}`);
            return null;
        }
    }
}

module.exports = HtmlHandler;
