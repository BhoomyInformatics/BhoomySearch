const { logger } = require('../utils/logger');

/**
 * Data Handler for Database Column Length Validation
 * 
 * Prevents "Data too long for column" errors by:
 * - Validating field lengths before insertion
 * - Truncating oversized content gracefully
 * - Providing fallback values for required fields
 * - Logging data quality issues
 */
class DataHandler {
    constructor(options = {}) {
        this.options = {
            // Column length limits (adjust based on your database schema)
            columnLimits: {
                site_data_title: 255,           // VARCHAR(255)
                site_data_description: 500,     // VARCHAR(500)
                site_data_keywords: 500,        // VARCHAR(500)
                site_data_author: 100,          // VARCHAR(100) - this is the problematic one
                site_data_content: 65535,       // TEXT field (64KB)
                site_data_url: 2048,            // VARCHAR(2048)
                site_data_image_url: 2048,      // VARCHAR(2048)
                site_data_video_url: 2048,      // VARCHAR(2048)
                site_data_language: 10,         // VARCHAR(10)
                site_data_category: 100,        // VARCHAR(100)
                site_data_tags: 1000,           // VARCHAR(1000)
                ...options.columnLimits
            },
            
            // Truncation behavior
            truncateMode: options.truncateMode || 'smart', // 'smart', 'simple', 'skip'
            preserveWords: options.preserveWords !== false,
            ellipsis: options.ellipsis || '...',
            
            // Logging
            logTruncations: options.logTruncations !== false,
            logLevel: options.logLevel || 'warn'
        };
        
        this.stats = {
            totalProcessed: 0,
            truncated: 0,
            skipped: 0,
            errors: 0
        };
    }

    /**
     * Validate and clean data for database insertion
     */
    validateAndCleanData(data) {
        if (!data || typeof data !== 'object') {
            return {};
        }

        this.stats.totalProcessed++;
        const cleanData = {};
        let hasTruncations = false;

        for (const [column, value] of Object.entries(data)) {
            try {
                const limit = this.options.columnLimits[column];
                
                if (limit && value !== null && value !== undefined) {
                    const stringValue = String(value);
                    
                    if (stringValue.length > limit) {
                        cleanData[column] = this.truncateValue(stringValue, limit, column);
                        hasTruncations = true;
                        this.stats.truncated++;
                    } else {
                        cleanData[column] = stringValue;
                    }
                } else {
                    cleanData[column] = value;
                }
            } catch (error) {
                logger.error('Error processing column data', {
                    service: 'dataHandler',
                    column,
                    error: error.message
                });
                
                cleanData[column] = this.getFallbackValue(column);
                this.stats.errors++;
            }
        }

        if (hasTruncations && this.options.logTruncations) {
            // Only log truncations occasionally to prevent log spam
            if (Math.random() < 0.1) { // Log only 10% of truncations
                logger.warn('Data truncated for database insertion', {
                    service: 'dataHandler',
                    url: data.site_data_url || 'unknown',
                    truncatedFields: Object.keys(data).filter(key => 
                        data[key] && String(data[key]).length > (this.options.columnLimits[key] || Infinity)
                    )
                });
            }
        }

        return cleanData;
    }

    /**
     * Truncate value based on column limits
     */
    truncateValue(value, limit, columnName) {
        if (!value || limit <= 0) {
            return '';
        }

        switch (this.options.truncateMode) {
            case 'smart':
                return this.smartTruncate(value, limit, columnName);
            case 'simple':
                return this.simpleTruncate(value, limit);
            case 'skip':
                this.stats.skipped++;
                return null; // Skip this field entirely
            default:
                return this.simpleTruncate(value, limit);
        }
    }

    /**
     * Smart truncation that preserves words and adds ellipsis
     */
    smartTruncate(value, limit, columnName) {
        const ellipsisLength = this.options.ellipsis.length;
        const maxContentLength = limit - ellipsisLength;

        if (value.length <= limit) {
            return value;
        }

        // For author fields, use simple truncation (names don't need word preservation)
        if (columnName && columnName.includes('author')) {
            return value.substring(0, maxContentLength) + this.options.ellipsis;
        }

        // For other fields, try to preserve words
        if (this.options.preserveWords && maxContentLength > 10) {
            const truncated = value.substring(0, maxContentLength);
            const lastSpaceIndex = truncated.lastIndexOf(' ');
            
            if (lastSpaceIndex > maxContentLength * 0.7) {
                return truncated.substring(0, lastSpaceIndex) + this.options.ellipsis;
            }
        }

        return value.substring(0, maxContentLength) + this.options.ellipsis;
    }

    /**
     * Simple truncation without word preservation
     */
    simpleTruncate(value, limit) {
        const ellipsisLength = this.options.ellipsis.length;
        const maxContentLength = limit - ellipsisLength;

        if (value.length <= limit) {
            return value;
        }

        return value.substring(0, maxContentLength) + this.options.ellipsis;
    }

    /**
     * Get fallback value for a column
     */
    getFallbackValue(columnName) {
        const fallbacks = {
            site_data_title: 'Untitled',
            site_data_description: '',
            site_data_keywords: '',
            site_data_author: '',
            site_data_content: '',
            site_data_url: '',
            site_data_image_url: '',
            site_data_video_url: '',
            site_data_language: 'en',
            site_data_category: '',
            site_data_tags: ''
        };

        return fallbacks[columnName] || '';
    }

    /**
     * Validate specific field types
     */
    validateField(value, fieldType, maxLength = null) {
        if (value === null || value === undefined) {
            return '';
        }

        const stringValue = String(value).trim();

        switch (fieldType) {
            case 'url':
                return this.validateUrl(stringValue, maxLength);
            case 'author':
                return this.validateAuthor(stringValue, maxLength);
            case 'title':
                return this.validateTitle(stringValue, maxLength);
            case 'description':
                return this.validateDescription(stringValue, maxLength);
            case 'keywords':
                return this.validateKeywords(stringValue, maxLength);
            case 'language':
                return this.validateLanguage(stringValue);
            default:
                return maxLength ? this.truncateValue(stringValue, maxLength) : stringValue;
        }
    }

    /**
     * Validate URL field
     */
    validateUrl(url, maxLength = 2048) {
        if (!url) return '';
        
        // Basic URL validation
        try {
            new URL(url);
        } catch (error) {
            logger.debug('Invalid URL provided', { url, error: error.message });
            return '';
        }

        return this.truncateValue(url, maxLength, 'url');
    }

    /**
     * Validate author field (fixed to preserve Unicode characters like Hindi)
     */
    validateAuthor(author, maxLength = 100) {
        if (!author) return '';
        
        // Clean up author field - preserve Unicode characters
        let cleanAuthor = author
            .replace(/\s+/g, ' ')           // Replace multiple spaces with single space
            .replace(/[\r\n\t]+/g, ' ')     // Replace line breaks and tabs with spaces
            .replace(/[<>]/g, '')           // Remove only dangerous HTML characters
            .trim();

        // If it's still too long, try to extract just the name part
        if (cleanAuthor.length > maxLength) {
            // Try to extract the first meaningful part (often the actual name)
            const parts = cleanAuthor.split(/[,;|]/).map(part => part.trim());
            cleanAuthor = parts[0] || cleanAuthor;
            
            // If still too long, try to get first few words
            if (cleanAuthor.length > maxLength) {
                const words = cleanAuthor.split(' ').slice(0, 3); // First 3 words
                cleanAuthor = words.join(' ');
            }
        }

        return this.truncateValue(cleanAuthor, maxLength, 'author');
    }

    /**
     * Validate title field (improved for Unicode support)
     */
    validateTitle(title, maxLength = 255) {
        if (!title) return '';
        
        const cleanTitle = title
            .replace(/\s+/g, ' ')           // Replace multiple spaces with single space
            .replace(/[\r\n\t]+/g, ' ')     // Replace line breaks and tabs with spaces
            .replace(/[<>]/g, '')           // Remove only dangerous HTML characters
            .trim();

        return this.truncateValue(cleanTitle, maxLength, 'title');
    }

    /**
     * Validate description field (improved for Unicode support)
     */
    validateDescription(description, maxLength = 500) {
        if (!description) return '';
        
        const cleanDescription = description
            .replace(/\s+/g, ' ')           // Replace multiple spaces with single space
            .replace(/[\r\n\t]+/g, ' ')     // Replace line breaks and tabs with spaces
            .replace(/[<>]/g, '')           // Remove only dangerous HTML characters
            .trim();

        return this.truncateValue(cleanDescription, maxLength, 'description');
    }

    /**
     * Validate keywords field
     */
    validateKeywords(keywords, maxLength = 500) {
        if (!keywords) return '';
        
        // Handle comma-separated keywords
        const keywordArray = keywords.split(',').map(k => k.trim()).filter(k => k);
        let result = keywordArray.join(', ');

        return this.truncateValue(result, maxLength, 'keywords');
    }

    /**
     * Validate language field
     */
    validateLanguage(language) {
        if (!language) return 'en';
        
        const cleanLang = language.toLowerCase().trim();
        
        // Common language codes
        const validLanguages = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko', 'ar', 'hi'];
        
        if (validLanguages.includes(cleanLang.substring(0, 2))) {
            return cleanLang.substring(0, 2);
        }
        
        return 'en'; // Default fallback
    }

    /**
     * Process crawler result for database insertion
     */
    processForDatabase(crawlerResult, siteData = {}) {
        if (!crawlerResult) {
            return this.validateAndCleanData(siteData);
        }

        const processedData = {
            site_data_title: this.validateField(crawlerResult.title, 'title', 500),
            site_data_description: this.validateField(crawlerResult.description, 'description', 1000),
            site_data_keywords: this.validateField(crawlerResult.keywords, 'keywords', 1000),
            site_data_author: this.validateField(
                crawlerResult.author || crawlerResult.metadata?.author || '', 
                'author', 
                255
            ),
            site_data_generator: this.validateField(
                crawlerResult.generator || crawlerResult.metadata?.generator || '', 
                'default', 
                255
            ),
            site_data_content: this.validateField(crawlerResult.article || crawlerResult.content, 'content', 16777215),
            site_data_article: this.validateField(crawlerResult.article || crawlerResult.content, 'content', 16777215),
            site_data_url: this.validateField(siteData.url || crawlerResult.url, 'url', 2048),
            site_data_language: this.validateField(crawlerResult.language, 'language'),
            
            // Additional fields
            site_data_image_url: this.validateField(crawlerResult.image_url, 'url', 2048),
            site_data_video_url: this.validateField(crawlerResult.video_url, 'url', 2048),
            site_data_category: this.validateField(crawlerResult.category, 'default', 100),
            site_data_tags: this.validateField(crawlerResult.tags, 'keywords', 1000),
            
            // Handle headings
            site_data_h1: this.validateField(crawlerResult.headings?.h1, 'default', 1000),
            site_data_h2: this.validateField(crawlerResult.headings?.h2, 'default', 1000),
            site_data_h3: this.validateField(crawlerResult.headings?.h3, 'default', 1000),
            site_data_h4: this.validateField(crawlerResult.headings?.h4, 'default', 1000),
            
            // Preserve existing site data
            ...siteData
        };

        return this.validateAndCleanData(processedData);
    }

    /**
     * Get handler statistics
     */
    getStats() {
        return {
            ...this.stats,
            truncationRate: this.stats.totalProcessed > 0 
                ? (this.stats.truncated / this.stats.totalProcessed * 100).toFixed(2) + '%'
                : '0%'
        };
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            totalProcessed: 0,
            truncated: 0,
            skipped: 0,
            errors: 0
        };
    }
}

module.exports = { DataHandler }; 