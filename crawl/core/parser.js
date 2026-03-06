const HtmlHandler = require('../handlers/htmlHandler');
const ImageHandler = require('../handlers/imageHandler');
const DocumentHandler = require('../handlers/documentHandler');
const UrlValidator = require('../utils/urlValidator');
const logger = require('../utils/logger');

class Parser {
    constructor(siteId, siteDataId, url, $) {
        this.siteId = siteId;
        this.siteDataId = siteDataId;
        this.url = url;
        this.$ = $;
        this.domain = UrlValidator.getDomain(url);
        this.rootDomain = UrlValidator.getRootDomain(this.domain);
    }

    async parse() {
        try {
            const htmlHandler = new HtmlHandler(this.$, this.url);

            const title = htmlHandler.extractTitle();
            const meta = htmlHandler.extractMetaTags();
            const headings = htmlHandler.extractHeadings();
            const article = htmlHandler.extractArticle();
            const icon = htmlHandler.extractIcon();
            const links = htmlHandler.extractLinks(this.domain, this.rootDomain);
            const metadata = htmlHandler.extractMetadata();

            return {
                title,
                description: meta.description,
                keywords: meta.keywords,
                author: meta.author,
                generator: meta.generator,
                analytics: meta.analytics,
                h1: headings.h1,
                h2: headings.h2,
                h3: headings.h3,
                h4: headings.h4,
                article,
                icon,
                links,
                metadata: metadata
            };
        } catch (error) {
            logger.error(`Error parsing HTML: ${error.message}`);
            throw error;
        }
    }

    extractVideos() {
        const videos = [];
        const self = this;

        this.$('video[src]').each(function() {
            try {
                const src = self.$(this).attr('src');
                if (!src) return;

                let videoUrl = src;
                if (src.startsWith('/')) {
                    videoUrl = `https://${self.domain}${src}`;
                }

                if (!videos.find(v => v.video === videoUrl)) {
                    const title = self.$(this).attr('title') || self.$(this).closest('[title]').attr('title') || '';
                    const description = self.$(this).attr('aria-label') || '';
                    const poster = self.$(this).attr('poster') || '';
                    videos.push({ video: videoUrl, title, description, thumbnail: poster });
                }
            } catch (error) {
                // Skip invalid videos
            }
        });

        this.$('iframe[src]').each(function() {
            try {
                const src = self.$(this).attr('src');
                if (!src) return;

                let thumbnail = '';
                let description = '';
                
                if (src.includes('youtube.com/embed/')) {
                    const videoId = src.match(/embed\/([^?]+)/)?.[1];
                    if (videoId) {
                        thumbnail = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
                    }
                    description = 'YouTube video';
                } else if (src.includes('player.vimeo.com/video/')) {
                    const videoId = src.match(/video\/(\d+)/)?.[1];
                    if (videoId) {
                        thumbnail = `https://vumbnail.com/${videoId}.jpg`;
                    }
                    description = 'Vimeo video';
                } else if (src.includes('dailymotion.com/embed/')) {
                    description = 'Dailymotion video';
                }

                if (src.includes('youtube.com/embed/') || 
                    src.includes('player.vimeo.com/video/') || 
                    src.includes('dailymotion.com/embed/')) {
                    
                    if (!videos.find(v => v.video === src)) {
                        const title = self.$(this).attr('title') || self.$(this).closest('[title]').attr('title') || '';
                        videos.push({ video: src, title, description, thumbnail });
                    }
                }
            } catch (error) {
                // Skip invalid videos
            }
        });

        return videos;
    }
}

module.exports = Parser;
