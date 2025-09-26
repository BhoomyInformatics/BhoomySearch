const { logger } = require('../utils/logger');

class ImageHandler {
    constructor() {
        this.supportedFormats = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'tiff', 'ico'];
        this.maxFileSize = 50 * 1024 * 1024; // 50MB limit
    }

    async process(imageBuffer, url, crawlerInstance) {
        try {
            logger.info('Processing image content', { 
                url, 
                bufferSize: imageBuffer.length 
            });

            // Check file size
            if (imageBuffer.length > this.maxFileSize) {
                throw new Error(`Image file too large: ${imageBuffer.length} bytes`);
            }

            // Extract image metadata
            const imageData = await this.extractImageData(imageBuffer, url);
            
            // Map to database row format
            crawlerInstance.site_data_db_row = this.mapToDbRow(imageData, url);

            logger.info('Image processing completed', { 
                url,
                format: imageData.format,
                dimensions: `${imageData.width}x${imageData.height}`,
                fileSize: imageData.fileSize
            });

            return {
                parsedData: imageData,
                extractedLinks: [], // Images don't have crawlable links
                success: true
            };
        } catch (error) {
            logger.error('Error processing image content', { 
                url, 
                error: error.message,
                stack: error.stack 
            });
            throw error;
        }
    }

    async extractImageData(imageBuffer, url) {
        try {
            // Extract basic information from URL
            const urlInfo = this.extractUrlInfo(url);
            
            // Detect image format from buffer
            const format = this.detectImageFormat(imageBuffer);
            
            // Extract basic metadata
            const metadata = {
                format: format,
                fileSize: imageBuffer.length,
                url: url,
                filename: urlInfo.filename,
                extension: urlInfo.extension,
                width: 'unknown', // Would need image processing library for actual dimensions
                height: 'unknown',
                colorDepth: 'unknown',
                hasTransparency: format === 'png' || format === 'gif',
                isAnimated: format === 'gif', // Basic assumption
                extractedAt: new Date().toISOString()
            };

            // Try to extract more detailed metadata if possible
            const detailedMetadata = await this.extractDetailedMetadata(imageBuffer, format);
            
            return {
                title: this.generateTitle(urlInfo.filename, format),
                description: this.generateDescription(metadata),
                keywords: this.generateKeywords(urlInfo, format),
                content: this.generateTextContent(metadata),
                article: this.generateTextContent(metadata),
                metadata: { ...metadata, ...detailedMetadata },
                documentType: 'image',
                format: format,
                fileSize: imageBuffer.length,
                links: [],
                images: [{
                    url: url,
                    alt: urlInfo.filename,
                    title: urlInfo.filename,
                    width: metadata.width,
                    height: metadata.height,
                    format: format,
                    fileSize: imageBuffer.length
                }],
                videos: []
            };
        } catch (error) {
            logger.error('Error extracting image data', { error: error.message });
            throw error;
        }
    }

    extractUrlInfo(url) {
        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname;
            const filename = pathname.split('/').pop() || 'image';
            const extension = filename.split('.').pop()?.toLowerCase() || '';
            
            return {
                filename: filename,
                extension: extension,
                path: pathname,
                domain: urlObj.hostname
            };
        } catch (error) {
            logger.error('Error extracting URL info', { url, error: error.message });
            return {
                filename: 'image',
                extension: '',
                path: '',
                domain: ''
            };
        }
    }

    detectImageFormat(buffer) {
        try {
            // Check magic bytes to detect format
            if (buffer.length < 4) {
                return 'unknown';
            }

            const header = buffer.slice(0, 12);
            
            // JPEG
            if (header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF) {
                return 'jpeg';
            }
            
            // PNG
            if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47) {
                return 'png';
            }
            
            // GIF
            if (header.slice(0, 3).toString() === 'GIF') {
                return 'gif';
            }
            
            // BMP
            if (header[0] === 0x42 && header[1] === 0x4D) {
                return 'bmp';
            }
            
            // WebP
            if (header.slice(0, 4).toString() === 'RIFF' && header.slice(8, 12).toString() === 'WEBP') {
                return 'webp';
            }
            
            // TIFF
            if ((header[0] === 0x49 && header[1] === 0x49 && header[2] === 0x2A && header[3] === 0x00) ||
                (header[0] === 0x4D && header[1] === 0x4D && header[2] === 0x00 && header[3] === 0x2A)) {
                return 'tiff';
            }
            
            // SVG (text-based, check for XML declaration or SVG tag)
            const textStart = buffer.slice(0, 100).toString('utf8').toLowerCase();
            if (textStart.includes('<svg') || textStart.includes('<?xml')) {
                return 'svg';
            }
            
            // ICO
            if (header[0] === 0x00 && header[1] === 0x00 && header[2] === 0x01 && header[3] === 0x00) {
                return 'ico';
            }
            
            return 'unknown';
        } catch (error) {
            logger.error('Error detecting image format', { error: error.message });
            return 'unknown';
        }
    }

    async extractDetailedMetadata(buffer, format) {
        try {
            const metadata = {};
            
            // For SVG files, we can extract more information
            if (format === 'svg') {
                const svgContent = buffer.toString('utf8');
                const svgMetadata = this.extractSvgMetadata(svgContent);
                Object.assign(metadata, svgMetadata);
            }
            
            // For other formats, we would need specialized libraries
            // This is a placeholder for future enhancement
            
            return metadata;
        } catch (error) {
            logger.error('Error extracting detailed metadata', { error: error.message });
            return {};
        }
    }

    extractSvgMetadata(svgContent) {
        try {
            const metadata = {};
            
            // Extract dimensions from SVG
            const widthMatch = svgContent.match(/width\s*=\s*["']?(\d+(?:\.\d+)?)/i);
            const heightMatch = svgContent.match(/height\s*=\s*["']?(\d+(?:\.\d+)?)/i);
            const viewBoxMatch = svgContent.match(/viewBox\s*=\s*["']?([^"']+)/i);
            
            if (widthMatch) metadata.width = parseFloat(widthMatch[1]);
            if (heightMatch) metadata.height = parseFloat(heightMatch[1]);
            if (viewBoxMatch) {
                const viewBox = viewBoxMatch[1].split(/\s+/);
                if (viewBox.length === 4) {
                    metadata.viewBox = {
                        x: parseFloat(viewBox[0]),
                        y: parseFloat(viewBox[1]),
                        width: parseFloat(viewBox[2]),
                        height: parseFloat(viewBox[3])
                    };
                }
            }
            
            // Extract title and description from SVG
            const titleMatch = svgContent.match(/<title[^>]*>([^<]+)<\/title>/i);
            const descMatch = svgContent.match(/<desc[^>]*>([^<]+)<\/desc>/i);
            
            if (titleMatch) metadata.svgTitle = titleMatch[1].trim();
            if (descMatch) metadata.svgDescription = descMatch[1].trim();
            
            // Count elements
            const pathCount = (svgContent.match(/<path/gi) || []).length;
            const circleCount = (svgContent.match(/<circle/gi) || []).length;
            const rectCount = (svgContent.match(/<rect/gi) || []).length;
            const textCount = (svgContent.match(/<text/gi) || []).length;
            
            metadata.elementCounts = {
                paths: pathCount,
                circles: circleCount,
                rectangles: rectCount,
                texts: textCount,
                total: pathCount + circleCount + rectCount + textCount
            };
            
            return metadata;
        } catch (error) {
            logger.error('Error extracting SVG metadata', { error: error.message });
            return {};
        }
    }

    generateTitle(filename, format) {
        try {
            // Clean up filename for title
            let title = filename.replace(/\.[^.]+$/, ''); // Remove extension
            title = title.replace(/[-_]/g, ' '); // Replace dashes and underscores with spaces
            title = title.replace(/\b\w/g, l => l.toUpperCase()); // Capitalize words
            
            if (title.length < 3) {
                title = `${format.toUpperCase()} Image`;
            }
            
            return title.substring(0, 255);
        } catch (error) {
            logger.error('Error generating title', { error: error.message });
            return 'Image';
        }
    }

    generateDescription(metadata) {
        try {
            const parts = [];
            
            parts.push(`${metadata.format.toUpperCase()} image`);
            
            if (metadata.width !== 'unknown' && metadata.height !== 'unknown') {
                parts.push(`${metadata.width}x${metadata.height} pixels`);
            }
            
            if (metadata.fileSize) {
                const sizeKB = Math.round(metadata.fileSize / 1024);
                parts.push(`${sizeKB}KB`);
            }
            
            if (metadata.hasTransparency) {
                parts.push('with transparency');
            }
            
            if (metadata.isAnimated) {
                parts.push('animated');
            }
            
            return parts.join(', ').substring(0, 500);
        } catch (error) {
            logger.error('Error generating description', { error: error.message });
            return 'Image file';
        }
    }

    generateKeywords(urlInfo, format) {
        try {
            const keywords = [];
            
            // Add format
            keywords.push(format);
            keywords.push('image');
            
            // Add filename-based keywords
            if (urlInfo.filename) {
                const filenameParts = urlInfo.filename
                    .replace(/\.[^.]+$/, '') // Remove extension
                    .split(/[-_\s]+/) // Split on common separators
                    .filter(part => part.length > 2); // Filter short parts
                
                keywords.push(...filenameParts);
            }
            
            // Add domain-based keywords
            if (urlInfo.domain) {
                const domainParts = urlInfo.domain.split('.').filter(part => part !== 'www');
                keywords.push(...domainParts);
            }
            
            return [...new Set(keywords)].join(', ').substring(0, 1000);
        } catch (error) {
            logger.error('Error generating keywords', { error: error.message });
            return format;
        }
    }

    generateTextContent(metadata) {
        try {
            const content = [];
            
            content.push(`Image file: ${metadata.filename || 'unknown'}`);
            content.push(`Format: ${metadata.format}`);
            content.push(`File size: ${Math.round(metadata.fileSize / 1024)}KB`);
            
            if (metadata.width !== 'unknown' && metadata.height !== 'unknown') {
                content.push(`Dimensions: ${metadata.width} x ${metadata.height} pixels`);
            }
            
            if (metadata.svgTitle) {
                content.push(`Title: ${metadata.svgTitle}`);
            }
            
            if (metadata.svgDescription) {
                content.push(`Description: ${metadata.svgDescription}`);
            }
            
            if (metadata.elementCounts) {
                content.push(`SVG elements: ${metadata.elementCounts.total} total`);
            }
            
            return content.join('\n');
        } catch (error) {
            logger.error('Error generating text content', { error: error.message });
            return 'Image file';
        }
    }

    mapToDbRow(imageData, url) {
        return {
            site_url: url,
            site_data_title: imageData.title || '',
            site_data_description: imageData.description || '',
            site_data_keywords: imageData.keywords || '',
            site_data_h1: '', // Images don't have HTML headings
            site_data_h2: '',
            site_data_h3: '',
            site_data_h4: '',
            site_data_article: imageData.content || '',            
            site_data_icon: '',
            site_data_links: JSON.stringify([]),
            site_data_images: JSON.stringify(imageData.images || []),
            site_data_videos: JSON.stringify([]),
            site_data_metadata: JSON.stringify(imageData.metadata || {}),
            crawl_date: new Date(),
            status: 'processed',
            content_type: `image/${imageData.format}`
        };
    }

    // Method to validate image quality and usefulness
    validateContentQuality(imageData) {
        const quality = {
            score: 0,
            issues: [],
            recommendations: []
        };

        // Check if image format is supported
        if (this.supportedFormats.includes(imageData.format)) {
            quality.score += 20;
        } else {
            quality.issues.push('Unsupported or unknown image format');
        }

        // Check file size (not too small, not too large)
        if (imageData.fileSize < 1024) {
            quality.issues.push('Image file is very small (likely low quality)');
        } else if (imageData.fileSize > 5 * 1024 * 1024) {
            quality.issues.push('Image file is very large (may slow down loading)');
        } else {
            quality.score += 20;
        }

        // Check dimensions if available
        if (imageData.metadata.width !== 'unknown' && imageData.metadata.height !== 'unknown') {
            quality.score += 20;
            
            const width = parseInt(imageData.metadata.width);
            const height = parseInt(imageData.metadata.height);
            
            if (width < 100 || height < 100) {
                quality.issues.push('Image dimensions are very small');
            } else if (width > 4000 || height > 4000) {
                quality.issues.push('Image dimensions are very large');
            } else {
                quality.score += 20;
            }
        }

        // Check filename quality
        if (imageData.metadata.filename && imageData.metadata.filename.length > 5) {
            quality.score += 20;
        } else {
            quality.issues.push('Image filename is not descriptive');
        }

        // Generate recommendations
        if (quality.score < 50) {
            quality.recommendations.push('Consider optimizing image size and format');
        }
        if (quality.score < 30) {
            quality.recommendations.push('Image may not be suitable for search indexing');
        }

        return quality;
    }

    // Method to check if image is likely to be useful content
    isContentImage(imageData) {
        try {
            const filename = imageData.metadata.filename?.toLowerCase() || '';
            const url = imageData.metadata.url?.toLowerCase() || '';
            
            // Skip common non-content images
            const skipPatterns = [
                /logo/i,
                /icon/i,
                /favicon/i,
                /banner/i,
                /ad[_-]/i,
                /advertisement/i,
                /tracking/i,
                /pixel/i,
                /spacer/i,
                /separator/i,
                /button/i,
                /arrow/i,
                /bullet/i,
                /bg[_-]/i,
                /background/i
            ];
            
            const isSkippable = skipPatterns.some(pattern => 
                pattern.test(filename) || pattern.test(url)
            );
            
            if (isSkippable) {
                return false;
            }
            
            // Check file size (very small images are likely decorative)
            if (imageData.fileSize < 2048) { // Less than 2KB
                return false;
            }
            
            // Check dimensions if available
            if (imageData.metadata.width !== 'unknown' && imageData.metadata.height !== 'unknown') {
                const width = parseInt(imageData.metadata.width);
                const height = parseInt(imageData.metadata.height);
                
                // Very small images are likely decorative
                if (width < 50 || height < 50) {
                    return false;
                }
            }
            
            return true;
        } catch (error) {
            logger.error('Error checking if image is content', { error: error.message });
            return true; // Default to including the image
        }
    }
}

module.exports = { ImageHandler }; 