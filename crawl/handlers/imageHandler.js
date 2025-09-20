const { logger } = require('../utils/logger');
const { EnhancedImageProcessor } = require('../utils/enhanced-image-processor');

class ImageHandler {
    constructor() {
        this.supportedFormats = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'tiff', 'ico'];
        this.maxFileSize = 50 * 1024 * 1024; // 50MB limit
        
        // Initialize enhanced image processor
        this.imageProcessor = new EnhancedImageProcessor({
            maxWidth: 2048,
            maxHeight: 2048,
            quality: 85,
            maxOriginalSize: this.maxFileSize,
            maxOptimizedSize: 5 * 1024 * 1024, // 5MB optimized limit
            enableWebPConversion: true,
            stripMetadata: true,
            progressive: true,
            mozjpeg: true
        });
    }

    async process(imageBuffer, url, crawlerInstance) {
        try {
            // Skip favicons and small icons which often fail metadata or are not useful
            const lowerUrl = (url || '').toLowerCase();
            if (lowerUrl.includes('favicon') || lowerUrl.endsWith('.ico')) {
                logger.debug('Skipping favicon/ico image', { url });
                return {
                    parsedData: null,
                    extractedLinks: [],
                    success: false,
                    skipped: true,
                    reason: 'favicon/ico'
                };
            }
            logger.info('Processing image content with optimization', { 
                url, 
                originalSize: imageBuffer.length 
            });

            // Basic validation
            if (imageBuffer.length > this.maxFileSize) {
                throw new Error(`Image file too large: ${imageBuffer.length} bytes`);
            }

            // Use enhanced image processor for optimization and quality assessment
            const processingResult = await this.imageProcessor.processImage(imageBuffer, url);
            
            if (!processingResult.success) {
                logger.warn('Image processing failed quality check', {
                    url,
                    reason: processingResult.reason,
                    issues: processingResult.issues
                });
                
                // For compatibility, fall back to basic processing if optimization fails
                const fallbackData = await this.extractImageData(imageBuffer, url);
                crawlerInstance.site_data_db_row = this.mapToDbRow(fallbackData, url);
                
                return {
                    parsedData: fallbackData,
                    extractedLinks: [],
                    success: true,
                    optimized: false,
                    fallback: true
                };
            }

            // Create enhanced image data combining original and optimized info
            const enhancedImageData = await this.createEnhancedImageData(
                processingResult.original,
                processingResult.optimized,
                processingResult.qualityAssessment,
                url
            );
            
            // Map to database row format with enhanced data
            crawlerInstance.site_data_db_row = this.mapToDbRow(enhancedImageData, url);

            // Store optimized image buffer for potential use in indexing
            crawlerInstance.optimizedImageBuffer = processingResult.optimized.buffer;
            crawlerInstance.processingResult = processingResult;

            logger.info('Enhanced image processing completed', { 
                url,
                originalFormat: processingResult.original.format,
                optimizedFormat: processingResult.optimized.format,
                originalSize: processingResult.original.size,
                optimizedSize: processingResult.optimized.size,
                compressionRatio: (processingResult.optimized.compressionRatio * 100).toFixed(2) + '%',
                qualityScore: processingResult.qualityAssessment.score,
                processingTime: processingResult.processingTime + 'ms'
            });

            return {
                parsedData: enhancedImageData,
                extractedLinks: [], // Images don't have crawlable links
                success: true,
                optimized: true,
                originalSize: processingResult.original.size,
                optimizedSize: processingResult.optimized.size,
                compressionRatio: processingResult.optimized.compressionRatio,
                qualityScore: processingResult.qualityAssessment.score
            };
        } catch (error) {
            logger.error('Error processing image content', { 
                url, 
                error: error.message,
                stack: error.stack 
            });
            
            // For critical errors, attempt basic fallback processing
            try {
                const fallbackData = await this.extractImageData(imageBuffer, url);
                crawlerInstance.site_data_db_row = this.mapToDbRow(fallbackData, url);
                
                return {
                    parsedData: fallbackData,
                    extractedLinks: [],
                    success: true,
                    optimized: false,
                    fallback: true,
                    error: error.message
                };
            } catch (fallbackError) {
                logger.error('Fallback image processing also failed', {
                    url,
                    originalError: error.message,
                    fallbackError: fallbackError.message
                });
                throw error;
            }
        }
    }

    /**
     * Create enhanced image data combining original and optimized information
     */
    async createEnhancedImageData(originalInfo, optimizedInfo, qualityAssessment, url) {
        try {
            const urlInfo = this.extractUrlInfo(url);
            
            // Create comprehensive metadata combining all information
            const enhancedMetadata = {
                // Original image properties
                original: {
                    format: originalInfo.format,
                    fileSize: originalInfo.size,
                    width: originalInfo.width,
                    height: originalInfo.height,
                    aspectRatio: originalInfo.aspectRatio,
                    megapixels: originalInfo.megapixels,
                    hasAlpha: originalInfo.hasAlpha,
                    isAnimated: originalInfo.isAnimated,
                    density: originalInfo.density,
                    channels: originalInfo.channels,
                    depth: originalInfo.depth
                },
                
                // Optimized image properties
                optimized: {
                    format: optimizedInfo.format,
                    fileSize: optimizedInfo.size,
                    width: optimizedInfo.width,
                    height: optimizedInfo.height,
                    quality: optimizedInfo.quality,
                    compressionRatio: optimizedInfo.compressionRatio
                },
                
                // Quality assessment
                qualityAssessment: {
                    score: qualityAssessment.score,
                    suitable: qualityAssessment.suitable,
                    issues: qualityAssessment.issues,
                    recommendations: qualityAssessment.recommendations,
                    metrics: qualityAssessment.metrics
                },
                
                // URL and processing info
                url: url,
                filename: urlInfo.filename,
                extension: urlInfo.extension,
                domain: urlInfo.domain,
                extractedAt: new Date().toISOString(),
                optimized: true,
                
                // Performance metrics
                spaceSavedBytes: originalInfo.size - optimizedInfo.size,
                spaceSavedPercentage: (optimizedInfo.compressionRatio * 100).toFixed(2),
                formatConverted: originalInfo.format !== optimizedInfo.format
            };

            // Use optimized dimensions for display
            const displayWidth = optimizedInfo.width || originalInfo.width;
            const displayHeight = optimizedInfo.height || originalInfo.height;
            const displayFormat = optimizedInfo.format || originalInfo.format;
            const displaySize = optimizedInfo.size || originalInfo.size;

            return {
                title: this.generateEnhancedTitle(urlInfo.filename, displayFormat, qualityAssessment),
                description: this.generateEnhancedDescription(enhancedMetadata),
                keywords: this.generateEnhancedKeywords(urlInfo, displayFormat, qualityAssessment),
                content: this.generateEnhancedTextContent(enhancedMetadata),
                article: this.generateEnhancedTextContent(enhancedMetadata),
                metadata: enhancedMetadata,
                documentType: 'image',
                format: displayFormat,
                fileSize: displaySize,
                width: displayWidth,
                height: displayHeight,
                links: [],
                images: [{
                    url: url,
                    alt: urlInfo.filename,
                    title: urlInfo.filename,
                    width: displayWidth,
                    height: displayHeight,
                    format: displayFormat,
                    fileSize: displaySize,
                    optimized: true,
                    originalFormat: originalInfo.format,
                    originalSize: originalInfo.size,
                    compressionRatio: optimizedInfo.compressionRatio,
                    qualityScore: qualityAssessment.score
                }],
                videos: []
            };
        } catch (error) {
            logger.error('Error creating enhanced image data', { error: error.message, url });
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

    /**
     * Enhanced title generation with optimization info
     */
    generateEnhancedTitle(filename, format, qualityAssessment) {
        try {
            // Clean up filename for title
            let title = filename.replace(/\.[^.]+$/, ''); // Remove extension
            title = title.replace(/[-_]/g, ' '); // Replace dashes and underscores with spaces
            title = title.replace(/\b\w/g, l => l.toUpperCase()); // Capitalize words
            
            if (title.length < 3) {
                title = `${format.toUpperCase()} Image`;
            }
            
            // Add quality indicators for high-quality images
            if (qualityAssessment.score >= 80) {
                // Don't append quality info to title to keep it clean
                // title += ' (High Quality)';
            }
            
            return title.substring(0, 255);
        } catch (error) {
            logger.error('Error generating enhanced title', { error: error.message });
            return 'Image';
        }
    }

    /**
     * Enhanced description generation with optimization info
     */
    generateEnhancedDescription(metadata) {
        try {
            const parts = [];
            
            // Basic image info
            parts.push(`Optimized ${metadata.optimized.format.toUpperCase()} image`);
            
            // Dimensions
            if (metadata.optimized.width && metadata.optimized.height) {
                parts.push(`${metadata.optimized.width}x${metadata.optimized.height} pixels`);
            }
            
            // Size info with optimization details
            if (metadata.optimized.fileSize) {
                const sizeKB = Math.round(metadata.optimized.fileSize / 1024);
                parts.push(`${sizeKB}KB`);
                
                if (metadata.spaceSavedBytes > 0) {
                    parts.push(`(${metadata.spaceSavedPercentage}% smaller)`);
                }
            }
            
            // Quality info
            if (metadata.qualityAssessment.score >= 80) {
                parts.push('high quality');
            } else if (metadata.qualityAssessment.score >= 60) {
                parts.push('good quality');
            }
            
            // Format conversion info
            if (metadata.formatConverted) {
                parts.push(`converted from ${metadata.original.format.toUpperCase()}`);
            }
            
            // Additional features
            if (metadata.original.hasAlpha) {
                parts.push('with transparency');
            }
            
            if (metadata.original.isAnimated) {
                parts.push('animated');
            }
            
            return parts.join(', ').substring(0, 500);
        } catch (error) {
            logger.error('Error generating enhanced description', { error: error.message });
            return 'Optimized image file';
        }
    }

    /**
     * Enhanced keywords generation with optimization info
     */
    generateEnhancedKeywords(urlInfo, format, qualityAssessment) {
        try {
            const keywords = [];
            
            // Add format keywords
            keywords.push(format);
            keywords.push('image');
            keywords.push('optimized');
            
            // Add quality keywords
            if (qualityAssessment.score >= 80) {
                keywords.push('high-quality');
            } else if (qualityAssessment.score >= 60) {
                keywords.push('good-quality');
            }
            
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
            
            // Add content type keywords based on URL patterns
            if (qualityAssessment.metrics?.url?.isContent) {
                keywords.push('content-image');
            }
            
            return [...new Set(keywords)].join(', ').substring(0, 1000);
        } catch (error) {
            logger.error('Error generating enhanced keywords', { error: error.message });
            return format + ', image, optimized';
        }
    }

    /**
     * Enhanced text content generation with optimization info
     */
    generateEnhancedTextContent(metadata) {
        try {
            const content = [];
            
            // Basic info
            content.push(`Optimized image file: ${metadata.filename || 'unknown'}`);
            
            // Original vs optimized comparison
            content.push(`Original: ${metadata.original.format.toUpperCase()}, ${Math.round(metadata.original.fileSize / 1024)}KB`);
            content.push(`Optimized: ${metadata.optimized.format.toUpperCase()}, ${Math.round(metadata.optimized.fileSize / 1024)}KB`);
            
            if (metadata.spaceSavedBytes > 0) {
                content.push(`Space saved: ${Math.round(metadata.spaceSavedBytes / 1024)}KB (${metadata.spaceSavedPercentage}%)`);
            }
            
            // Dimensions
            if (metadata.optimized.width && metadata.optimized.height) {
                content.push(`Dimensions: ${metadata.optimized.width} x ${metadata.optimized.height} pixels`);
                
                if (metadata.original.megapixels) {
                    content.push(`Resolution: ${metadata.original.megapixels.toFixed(1)} megapixels`);
                }
            }
            
            // Quality assessment
            content.push(`Quality score: ${metadata.qualityAssessment.score}/100`);
            
            if (metadata.qualityAssessment.issues.length > 0) {
                content.push(`Quality issues: ${metadata.qualityAssessment.issues.join(', ')}`);
            }
            
            // Technical details
            if (metadata.original.channels) {
                content.push(`Color channels: ${metadata.original.channels}`);
            }
            
            if (metadata.original.hasAlpha) {
                content.push('Transparency: supported');
            }
            
            if (metadata.original.isAnimated) {
                content.push('Animation: yes');
            }
            
            // Format conversion info
            if (metadata.formatConverted) {
                content.push(`Format converted from ${metadata.original.format.toUpperCase()} to ${metadata.optimized.format.toUpperCase()}`);
            }
            
            // Processing timestamp
            content.push(`Processed: ${metadata.extractedAt}`);
            
            return content.join('\n');
        } catch (error) {
            logger.error('Error generating enhanced text content', { error: error.message });
            return 'Optimized image file';
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

    /**
     * Efficiently filter out base64 and invalid image URLs
     */
    isValidImageUrl(url) {
        return this.imageProcessor.isValidImageUrl(url);
    }

    /**
     * Batch process multiple image URLs for efficient filtering
     */
    filterValidImageUrls(urls) {
        try {
            return urls.filter(url => this.isValidImageUrl(url));
        } catch (error) {
            logger.error('Error filtering image URLs', { error: error.message });
            return urls; // Return original list if filtering fails
        }
    }

    /**
     * Get image processing statistics
     */
    getProcessingStats() {
        return this.imageProcessor.getStats();
    }

    /**
     * Reset image processing statistics
     */
    resetProcessingStats() {
        this.imageProcessor.resetStats();
        logger.info('Image handler processing statistics reset');
    }

    /**
     * Configure image processor options
     */
    updateProcessorOptions(options) {
        try {
            Object.assign(this.imageProcessor.options, options);
            logger.info('Image processor options updated', { options });
        } catch (error) {
            logger.error('Error updating processor options', { error: error.message });
        }
    }

    /**
     * Process multiple images in batch for better performance
     */
    async processBatch(imageDataArray, options = {}) {
        try {
            logger.info('Starting batch image processing', {
                count: imageDataArray.length,
                options
            });

            const results = await this.imageProcessor.processImageBatch(imageDataArray, options);
            
            logger.info('Batch image processing completed', {
                total: results.length,
                successful: results.filter(r => r.success).length,
                failed: results.filter(r => !r.success).length
            });

            return results;
        } catch (error) {
            logger.error('Batch image processing failed', { error: error.message });
            throw error;
        }
    }
}

module.exports = { ImageHandler }; 