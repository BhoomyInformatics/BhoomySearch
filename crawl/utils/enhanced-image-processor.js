const sharp = require('sharp');
const path = require('path');
const crypto = require('crypto');
const { logger } = require('./logger');

/**
 * Enhanced Image Processor with Sharp.js integration
 * Provides compression, resizing, format conversion, and quality assessment
 */
class EnhancedImageProcessor {
    constructor(options = {}) {
        this.options = {
            // Image optimization settings
            maxWidth: options.maxWidth || 2048,
            maxHeight: options.maxHeight || 2048,
            quality: options.quality || 85,
            
            // File size limits
            maxOriginalSize: options.maxOriginalSize || 50 * 1024 * 1024, // 50MB
            maxOptimizedSize: options.maxOptimizedSize || 5 * 1024 * 1024, // 5MB
            minImageSize: options.minImageSize || 100, // Minimum 100 bytes
            
            // Format settings
            enableWebPConversion: options.enableWebPConversion !== false,
            preserveOriginalFormat: options.preserveOriginalFormat || false,
            supportedInputFormats: options.supportedInputFormats || ['jpeg', 'jpg', 'png', 'webp', 'tiff', 'bmp'],
            
            // Quality assessment thresholds
            minWidth: options.minWidth || 50,
            minHeight: options.minHeight || 50,
            maxWidth: options.maxWidth || 4000,
            maxHeight: options.maxHeight || 4000,
            
            // Compression settings
            progressive: options.progressive !== false,
            mozjpeg: options.mozjpeg !== false,
            optimizeScans: options.optimizeScans !== false,
            
            // Processing options
            stripMetadata: options.stripMetadata !== false,
            enableLosslessCompression: options.enableLosslessCompression !== false,
            ...options
        };

        this.stats = {
            processed: 0,
            optimized: 0,
            converted: 0,
            rejected: 0,
            totalOriginalSize: 0,
            totalOptimizedSize: 0,
            errors: 0
        };

        logger.info('Enhanced Image Processor initialized', {
            options: this.options,
            sharpVersion: sharp.versions
        });
    }

    /**
     * Process image buffer with optimization and quality assessment
     */
    async processImage(imageBuffer, url, options = {}) {
        const startTime = Date.now();
        
        try {
            // Validate input
            if (!Buffer.isBuffer(imageBuffer)) {
                throw new Error('Invalid image buffer provided');
            }

            if (imageBuffer.length === 0) {
                throw new Error('Empty image buffer');
            }

            if (imageBuffer.length < this.options.minImageSize) {
                throw new Error(`Image too small: ${imageBuffer.length} bytes`);
            }

            if (imageBuffer.length > this.options.maxOriginalSize) {
                throw new Error(`Image too large: ${imageBuffer.length} bytes`);
            }

            // Extract metadata and assess quality
            const imageInfo = await this.extractImageMetadata(imageBuffer);
            const qualityAssessment = this.assessImageQuality(imageInfo, url);

            // Check if image meets quality standards
            if (!qualityAssessment.suitable) {
                this.stats.rejected++;
                return {
                    success: false,
                    reason: 'Quality assessment failed',
                    issues: qualityAssessment.issues,
                    originalInfo: imageInfo
                };
            }

            // Determine optimal processing strategy
            const processingStrategy = this.determineProcessingStrategy(imageInfo, options);
            
            // Process image based on strategy
            const processedResult = await this.optimizeImage(imageBuffer, imageInfo, processingStrategy);

            // Update statistics
            this.updateStats(imageInfo, processedResult);

            const processingTime = Date.now() - startTime;

            logger.debug('Image processing completed', {
                url,
                originalSize: imageInfo.size,
                optimizedSize: processedResult.size,
                format: processedResult.format,
                compressionRatio: ((imageInfo.size - processedResult.size) / imageInfo.size * 100).toFixed(2) + '%',
                processingTime: processingTime + 'ms',
                qualityScore: qualityAssessment.score
            });

            return {
                success: true,
                original: imageInfo,
                optimized: processedResult,
                qualityAssessment,
                processingStrategy,
                processingTime
            };

        } catch (error) {
            this.stats.errors++;
            logger.error('Image processing failed', {
                url,
                error: error.message,
                bufferSize: imageBuffer?.length
            });

            return {
                success: false,
                error: error.message,
                bufferSize: imageBuffer?.length
            };
        }
    }

    /**
     * Extract comprehensive image metadata using Sharp
     */
    async extractImageMetadata(imageBuffer) {
        try {
            const image = sharp(imageBuffer);
            const metadata = await image.metadata();
            
            // Calculate additional properties
            const aspectRatio = metadata.width && metadata.height ? 
                (metadata.width / metadata.height) : null;
            
            const megapixels = metadata.width && metadata.height ? 
                ((metadata.width * metadata.height) / 1000000) : null;

            return {
                width: metadata.width,
                height: metadata.height,
                format: metadata.format,
                size: imageBuffer.length,
                density: metadata.density,
                hasAlpha: metadata.hasAlpha,
                isAnimated: metadata.pages > 1,
                pages: metadata.pages || 1,
                space: metadata.space,
                channels: metadata.channels,
                depth: metadata.depth,
                aspectRatio: aspectRatio,
                megapixels: megapixels,
                orientation: metadata.orientation,
                chromaSubsampling: metadata.chromaSubsampling,
                isProgressive: metadata.isProgressive,
                compression: metadata.compression,
                resolutionUnit: metadata.resolutionUnit,
                extractedAt: new Date().toISOString()
            };
        } catch (error) {
            logger.error('Failed to extract image metadata', { error: error.message });
            throw new Error(`Metadata extraction failed: ${error.message}`);
        }
    }

    /**
     * Assess image quality and suitability for storage
     */
    assessImageQuality(imageInfo, url = '') {
        const assessment = {
            score: 0,
            suitable: false,
            issues: [],
            recommendations: [],
            metrics: {}
        };

        try {
            // Dimension assessment
            if (imageInfo.width && imageInfo.height) {
                assessment.metrics.dimensions = {
                    width: imageInfo.width,
                    height: imageInfo.height,
                    aspectRatio: imageInfo.aspectRatio,
                    megapixels: imageInfo.megapixels
                };

                if (imageInfo.width >= this.options.minWidth && imageInfo.height >= this.options.minHeight) {
                    assessment.score += 30;
                    
                    if (imageInfo.width <= this.options.maxWidth && imageInfo.height <= this.options.maxHeight) {
                        assessment.score += 20;
                    } else {
                        assessment.issues.push('Image dimensions too large');
                        assessment.recommendations.push('Consider resizing image');
                    }
                } else {
                    assessment.issues.push('Image dimensions too small');
                }
            } else {
                assessment.issues.push('Unable to determine image dimensions');
            }

            // File size assessment
            assessment.metrics.fileSize = {
                bytes: imageInfo.size,
                kb: Math.round(imageInfo.size / 1024),
                mb: (imageInfo.size / (1024 * 1024)).toFixed(2)
            };

            if (imageInfo.size >= 1024 && imageInfo.size <= this.options.maxOptimizedSize) {
                assessment.score += 25;
            } else if (imageInfo.size > this.options.maxOptimizedSize) {
                assessment.issues.push('Image file size too large');
                assessment.recommendations.push('Compress image to reduce file size');
            } else {
                assessment.issues.push('Image file size too small (likely low quality)');
            }

            // Format assessment
            assessment.metrics.format = {
                detected: imageInfo.format,
                hasTransparency: imageInfo.hasAlpha,
                isAnimated: imageInfo.isAnimated,
                isProgressive: imageInfo.isProgressive
            };

            if (this.options.supportedInputFormats.includes(imageInfo.format)) {
                assessment.score += 15;
            } else {
                assessment.issues.push(`Unsupported format: ${imageInfo.format}`);
            }

            // Quality indicators
            if (imageInfo.megapixels && imageInfo.megapixels > 0.1) {
                assessment.score += 10;
            }

            // URL-based assessment
            if (url) {
                assessment.metrics.url = this.assessUrlQuality(url);
                if (assessment.metrics.url.isContent) {
                    assessment.score += 10;
                } else {
                    assessment.issues.push('URL suggests non-content image');
                }
            }

            // Determine suitability
            assessment.suitable = assessment.score >= 50 && assessment.issues.length < 3;

            // Add final recommendations
            if (assessment.score < 50) {
                assessment.recommendations.push('Image quality below threshold');
            }

            if (imageInfo.size > 1024 * 1024) { // > 1MB
                assessment.recommendations.push('Consider WebP conversion for better compression');
            }

            logger.debug('Image quality assessment completed', {
                url,
                score: assessment.score,
                suitable: assessment.suitable,
                issueCount: assessment.issues.length
            });

            return assessment;

        } catch (error) {
            logger.error('Image quality assessment failed', { error: error.message, url });
            return {
                score: 0,
                suitable: false,
                issues: ['Quality assessment failed'],
                recommendations: [],
                metrics: {},
                error: error.message
            };
        }
    }

    /**
     * Assess URL quality to determine if image is likely content
     */
    assessUrlQuality(url) {
        const assessment = {
            isContent: true,
            flags: []
        };

        try {
            const urlLower = url.toLowerCase();
            const filename = path.basename(urlLower);
            
            // Non-content patterns
            const nonContentPatterns = [
                /logo/i, /icon/i, /favicon/i, /banner/i, /ad[_-]/i,
                /advertisement/i, /tracking/i, /pixel/i, /spacer/i,
                /separator/i, /button/i, /arrow/i, /bullet/i,
                /bg[_-]/i, /background/i, /border/i, /frame/i,
                /ui[_-]/i, /interface/i, /chrome/i, /nav/i,
                /header/i, /footer/i, /sidebar/i, /menu/i
            ];

            const isNonContent = nonContentPatterns.some(pattern => 
                pattern.test(filename) || pattern.test(urlLower)
            );

            if (isNonContent) {
                assessment.isContent = false;
                assessment.flags.push('matches non-content pattern');
            }

            // Check for meaningful filename
            const baseFilename = filename.replace(/\.[^.]+$/, '');
            if (baseFilename.length < 3) {
                assessment.flags.push('short filename');
            }

            // Check for common content indicators
            const contentPatterns = [
                /photo/i, /image/i, /picture/i, /gallery/i, /content/i,
                /article/i, /blog/i, /news/i, /product/i, /thumb/i
            ];

            const hasContentIndicator = contentPatterns.some(pattern => 
                pattern.test(filename) || pattern.test(urlLower)
            );

            if (hasContentIndicator) {
                assessment.flags.push('has content indicator');
            }

            return assessment;

        } catch (error) {
            logger.error('URL quality assessment failed', { error: error.message, url });
            return { isContent: true, flags: ['assessment failed'] };
        }
    }

    /**
     * Determine optimal processing strategy based on image characteristics
     */
    determineProcessingStrategy(imageInfo, options = {}) {
        const strategy = {
            shouldResize: false,
            shouldCompress: false,
            shouldConvertToWebP: false,
            targetFormat: imageInfo.format,
            targetWidth: imageInfo.width,
            targetHeight: imageInfo.height,
            quality: this.options.quality,
            preserveAspectRatio: true
        };

        try {
            // Determine if resizing is needed
            if (imageInfo.width > this.options.maxWidth || imageInfo.height > this.options.maxHeight) {
                strategy.shouldResize = true;
                
                const widthRatio = this.options.maxWidth / imageInfo.width;
                const heightRatio = this.options.maxHeight / imageInfo.height;
                const resizeRatio = Math.min(widthRatio, heightRatio);
                
                strategy.targetWidth = Math.round(imageInfo.width * resizeRatio);
                strategy.targetHeight = Math.round(imageInfo.height * resizeRatio);
                
                logger.debug('Resize strategy determined', {
                    original: `${imageInfo.width}x${imageInfo.height}`,
                    target: `${strategy.targetWidth}x${strategy.targetHeight}`,
                    ratio: resizeRatio
                });
            }

            // Determine if compression is needed
            if (imageInfo.size > this.options.maxOptimizedSize) {
                strategy.shouldCompress = true;
                
                // Calculate target quality based on file size
                const sizeRatio = imageInfo.size / this.options.maxOptimizedSize;
                if (sizeRatio > 2) {
                    strategy.quality = Math.max(60, this.options.quality - 20);
                } else if (sizeRatio > 1.5) {
                    strategy.quality = Math.max(70, this.options.quality - 10);
                }
            }

            // Determine WebP conversion
            if (this.options.enableWebPConversion && 
                !this.options.preserveOriginalFormat &&
                ['jpeg', 'jpg', 'png'].includes(imageInfo.format) &&
                !imageInfo.isAnimated) {
                
                strategy.shouldConvertToWebP = true;
                strategy.targetFormat = 'webp';
                
                // WebP can use slightly higher quality
                strategy.quality = Math.min(strategy.quality + 5, 95);
            }

            // Override with user options
            if (options.forceWebP) strategy.shouldConvertToWebP = true;
            if (options.quality) strategy.quality = options.quality;
            if (options.maxWidth && options.maxHeight) {
                strategy.targetWidth = Math.min(strategy.targetWidth, options.maxWidth);
                strategy.targetHeight = Math.min(strategy.targetHeight, options.maxHeight);
                strategy.shouldResize = true;
            }

            logger.debug('Processing strategy determined', strategy);
            return strategy;

        } catch (error) {
            logger.error('Failed to determine processing strategy', { error: error.message });
            return strategy; // Return default strategy
        }
    }

    /**
     * Optimize image according to strategy
     */
    async optimizeImage(imageBuffer, imageInfo, strategy) {
        try {
            let pipeline = sharp(imageBuffer);

            // Remove metadata if requested
            if (this.options.stripMetadata) {
                pipeline = pipeline.removeAlpha();
            }

            // Apply resizing if needed
            if (strategy.shouldResize) {
                pipeline = pipeline.resize(strategy.targetWidth, strategy.targetHeight, {
                    fit: 'inside',
                    withoutEnlargement: true
                });
                
                logger.debug('Applied resizing', {
                    target: `${strategy.targetWidth}x${strategy.targetHeight}`
                });
            }

            // Apply format-specific optimizations
            switch (strategy.targetFormat) {
                case 'webp':
                    pipeline = pipeline.webp({
                        quality: strategy.quality,
                        effort: 6, // Higher effort for better compression
                        lossless: this.options.enableLosslessCompression && strategy.quality >= 90
                    });
                    break;

                case 'jpeg':
                case 'jpg':
                    pipeline = pipeline.jpeg({
                        quality: strategy.quality,
                        progressive: this.options.progressive,
                        mozjpeg: this.options.mozjpeg,
                        optimiseScans: this.options.optimizeScans
                    });
                    break;

                case 'png':
                    pipeline = pipeline.png({
                        quality: strategy.quality,
                        compressionLevel: 9,
                        progressive: this.options.progressive
                    });
                    break;

                default:
                    // Keep original format with basic optimization
                    break;
            }

            // Process the image
            const optimizedBuffer = await pipeline.toBuffer();
            const optimizedMetadata = await sharp(optimizedBuffer).metadata();

            const result = {
                buffer: optimizedBuffer,
                size: optimizedBuffer.length,
                format: strategy.targetFormat,
                width: optimizedMetadata.width,
                height: optimizedMetadata.height,
                quality: strategy.quality,
                compressionRatio: ((imageInfo.size - optimizedBuffer.length) / imageInfo.size),
                metadata: optimizedMetadata,
                optimizedAt: new Date().toISOString()
            };

            logger.debug('Image optimization completed', {
                originalSize: imageInfo.size,
                optimizedSize: result.size,
                compressionRatio: (result.compressionRatio * 100).toFixed(2) + '%',
                format: result.format
            });

            return result;

        } catch (error) {
            logger.error('Image optimization failed', { error: error.message });
            throw new Error(`Optimization failed: ${error.message}`);
        }
    }

    /**
     * Filter out base64 and blob URLs efficiently
     */
    isValidImageUrl(url) {
        if (!url || typeof url !== 'string') {
            return false;
        }

        // Quick checks for invalid URL types
        const urlLower = url.toLowerCase();
        
        // Check for data URLs, blob URLs, and other non-HTTP protocols
        if (urlLower.startsWith('data:') || 
            urlLower.startsWith('blob:') || 
            urlLower.startsWith('javascript:') ||
            urlLower.startsWith('mailto:') ||
            urlLower.startsWith('tel:')) {
            return false;
        }

        // Must be HTTP or HTTPS
        if (!urlLower.startsWith('http://') && !urlLower.startsWith('https://')) {
            return false;
        }

        // Check for valid image file extensions
        const imageExtensions = /\.(jpg|jpeg|png|gif|webp|bmp|tiff|svg|ico)(\?|$)/i;
        if (!imageExtensions.test(url)) {
            // Allow URLs without extensions but with image-related paths
            const imagePaths = /\/(image|img|photo|picture|gallery|media)\//i;
            if (!imagePaths.test(url)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Batch process multiple images efficiently
     */
    async processImageBatch(images, options = {}) {
        const results = [];
        const batchSize = options.batchSize || 5;
        const timeout = options.timeout || 30000;

        try {
            logger.info('Starting batch image processing', {
                totalImages: images.length,
                batchSize
            });

            for (let i = 0; i < images.length; i += batchSize) {
                const batch = images.slice(i, i + batchSize);
                
                const batchPromises = batch.map(async (imageData, index) => {
                    try {
                        const result = await Promise.race([
                            this.processImage(imageData.buffer, imageData.url, options),
                            new Promise((_, reject) => 
                                setTimeout(() => reject(new Error('Processing timeout')), timeout)
                            )
                        ]);
                        
                        return { index: i + index, success: true, result };
                    } catch (error) {
                        return { 
                            index: i + index, 
                            success: false, 
                            error: error.message,
                            url: imageData.url 
                        };
                    }
                });

                const batchResults = await Promise.allSettled(batchPromises);
                results.push(...batchResults.map(r => r.value || r.reason));

                logger.debug('Batch processed', {
                    batchNumber: Math.floor(i / batchSize) + 1,
                    totalBatches: Math.ceil(images.length / batchSize),
                    processed: i + batch.length
                });
            }

            const successCount = results.filter(r => r.success).length;
            
            logger.info('Batch image processing completed', {
                total: images.length,
                successful: successCount,
                failed: images.length - successCount,
                successRate: ((successCount / images.length) * 100).toFixed(2) + '%'
            });

            return results;

        } catch (error) {
            logger.error('Batch image processing failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Update processing statistics
     */
    updateStats(originalInfo, processedResult) {
        this.stats.processed++;
        this.stats.totalOriginalSize += originalInfo.size;
        
        if (processedResult.size < originalInfo.size) {
            this.stats.optimized++;
            this.stats.totalOptimizedSize += processedResult.size;
        }
        
        if (processedResult.format !== originalInfo.format) {
            this.stats.converted++;
        }
    }

    /**
     * Get processing statistics
     */
    getStats() {
        const totalSaved = this.stats.totalOriginalSize - this.stats.totalOptimizedSize;
        const avgCompressionRatio = this.stats.optimized > 0 ? 
            ((totalSaved / this.stats.totalOriginalSize) * 100) : 0;

        return {
            ...this.stats,
            totalSavedBytes: totalSaved,
            totalSavedMB: (totalSaved / (1024 * 1024)).toFixed(2),
            averageCompressionRatio: avgCompressionRatio.toFixed(2) + '%',
            optimizationRate: this.stats.processed > 0 ? 
                ((this.stats.optimized / this.stats.processed) * 100).toFixed(2) + '%' : '0%',
            conversionRate: this.stats.processed > 0 ? 
                ((this.stats.converted / this.stats.processed) * 100).toFixed(2) + '%' : '0%',
            errorRate: this.stats.processed > 0 ? 
                ((this.stats.errors / this.stats.processed) * 100).toFixed(2) + '%' : '0%'
        };
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            processed: 0,
            optimized: 0,
            converted: 0,
            rejected: 0,
            totalOriginalSize: 0,
            totalOptimizedSize: 0,
            errors: 0
        };
        
        logger.info('Image processor statistics reset');
    }
}

module.exports = { EnhancedImageProcessor };
