/**
 * Enhanced Duplicate Content Manager
 * 
 * Advanced duplicate detection system with content-based hashing, similarity detection,
 * merging strategies, and comprehensive reporting.
 */

const crypto = require('crypto');
const { logger } = require('./logger');

class EnhancedDuplicateManager {
    constructor(dbConnection, options = {}) {
        this.dbConnection = dbConnection;
        this.options = {
            maxCacheSize: 100000,
            similarityThreshold: 0.85,    // 85% similarity threshold
            simHashBits: 64,              // SimHash fingerprint size
            contentExcerptLength: 1000,   // First 1000 chars for analysis
            enableAdvancedHashing: true,
            enableSimilarityDetection: true,
            enableContentMerging: true,
            ...options
        };

        // Enhanced caching system
        this.contentFingerprints = new Map(); // contentHash -> fingerprint data
        this.simHashIndex = new Map();        // simHash -> contentHash[]
        this.duplicateClusters = new Map();   // clusterId -> content group
        this.contentMetadata = new Map();     // contentHash -> metadata
        
        // Performance tracking
        this.stats = {
            totalContentAnalyzed: 0,
            duplicatesDetected: 0,
            similarContentFound: 0,
            clustersCreated: 0,
            contentMerged: 0,
            processingTime: 0,
            startTime: Date.now()
        };

        logger.info('Enhanced Duplicate Content Manager initialized', {
            service: 'EnhancedDuplicateManager',
            options: this.options,
            hasDbConnection: !!this.dbConnection
        });
    }

    /**
     * Analyze content for duplicate detection with multiple strategies
     */
    async analyzeContent(content, metadata = {}) {
        const analysisStart = Date.now();
        
        try {
            if (!content || typeof content !== 'string') {
                throw new Error('Invalid content provided for analysis');
            }

            // Extract content components
            const contentComponents = this.extractContentComponents(content, metadata);
            
            // Generate multiple hash types
            const hashes = this.generateContentHashes(contentComponents);
            
            // Generate similarity fingerprint (SimHash)
            const simHash = this.generateSimHash(contentComponents.fullText);
            
            // Create comprehensive fingerprint
            const fingerprint = {
                contentHashes: hashes,
                simHash: simHash,
                components: contentComponents,
                metadata: {
                    ...metadata,
                    analyzedAt: new Date().toISOString(),
                    contentLength: content.length,
                    wordsCount: this.countWords(contentComponents.fullText)
                },
                duplicateStatus: 'unique' // unique, duplicate, similar
            };

            // Check for duplicates and similar content
            const duplicateAnalysis = await this.checkForDuplicates(fingerprint);
            
            // Store fingerprint
            this.contentFingerprints.set(hashes.primary, fingerprint);
            this.indexSimHash(simHash, hashes.primary);
            
            // Update statistics
            this.stats.totalContentAnalyzed++;
            this.stats.processingTime += Date.now() - analysisStart;
            
            logger.debug('Content analysis completed', {
                service: 'EnhancedDuplicateManager',
                contentHash: hashes.primary,
                duplicateStatus: duplicateAnalysis.status,
                similarityScore: duplicateAnalysis.maxSimilarity,
                processingTime: Date.now() - analysisStart
            });

            return {
                fingerprint,
                duplicateAnalysis,
                contentHash: hashes.primary,
                processingTime: Date.now() - analysisStart
            };

        } catch (error) {
            logger.error('Content analysis failed', {
                service: 'EnhancedDuplicateManager',
                error: error.message,
                contentLength: content ? content.length : 0
            });
            throw error;
        }
    }

    /**
     * Extract key content components for analysis
     */
    extractContentComponents(content, metadata = {}) {
        // Clean and normalize content
        const cleanContent = this.cleanContent(content);
        
        // Extract title - priority order: metadata.title, h1 tag, first line
        let title = metadata.title || '';
        if (!title) {
            const h1Match = cleanContent.match(/<h1[^>]*>([^<]+)<\/h1>/i);
            if (h1Match) {
                title = this.stripHtml(h1Match[1]).trim();
            } else {
                // Use first line as title if no h1 found
                const firstLine = cleanContent.split('\n')[0];
                title = this.stripHtml(firstLine).trim().substring(0, 200);
            }
        }

        // Extract description - priority order: metadata.description, meta description, first paragraph
        let description = metadata.description || '';
        if (!description) {
            const metaDescMatch = cleanContent.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i);
            if (metaDescMatch) {
                description = metaDescMatch[1].trim();
            } else {
                // Extract first paragraph
                const paragraphMatch = cleanContent.match(/<p[^>]*>([^<]+)<\/p>/i);
                if (paragraphMatch) {
                    description = this.stripHtml(paragraphMatch[1]).trim();
                } else {
                    // Use first 300 characters
                    description = this.stripHtml(cleanContent).trim().substring(0, 300);
                }
            }
        }

        // Extract first paragraph or excerpt
        const fullText = this.stripHtml(cleanContent);
        const firstParagraph = this.extractFirstParagraph(fullText);
        
        // Extract content excerpt for similarity comparison
        const contentExcerpt = fullText.substring(0, this.options.contentExcerptLength);
        
        // Extract key phrases and entities
        const keyPhrases = this.extractKeyPhrases(fullText);
        const entities = this.extractEntities(fullText);

        return {
            title: title.trim(),
            description: description.trim(),
            firstParagraph: firstParagraph.trim(),
            contentExcerpt: contentExcerpt.trim(),
            fullText: fullText.trim(),
            keyPhrases,
            entities,
            wordCount: this.countWords(fullText),
            characterCount: fullText.length
        };
    }

    /**
     * Generate multiple types of content hashes
     */
    generateContentHashes(components) {
        // Primary hash: title + description + first paragraph
        const primaryContent = [
            components.title,
            components.description,
            components.firstParagraph
        ].filter(Boolean).join(' | ').toLowerCase().trim();
        
        const primaryHash = crypto.createHash('sha256')
            .update(primaryContent)
            .digest('hex');

        // Title hash
        const titleHash = components.title ? 
            crypto.createHash('md5').update(components.title.toLowerCase()).digest('hex') : null;

        // Content excerpt hash
        const excerptHash = crypto.createHash('sha256')
            .update(components.contentExcerpt.toLowerCase())
            .digest('hex');

        // Full content hash
        const fullContentHash = crypto.createHash('sha256')
            .update(components.fullText.toLowerCase())
            .digest('hex');

        // Semantic hash based on key phrases
        const semanticContent = components.keyPhrases.join(' ').toLowerCase();
        const semanticHash = crypto.createHash('md5')
            .update(semanticContent)
            .digest('hex');

        return {
            primary: primaryHash,
            title: titleHash,
            excerpt: excerptHash,
            fullContent: fullContentHash,
            semantic: semanticHash
        };
    }

    /**
     * Generate SimHash fingerprint for similarity detection
     */
    generateSimHash(text, bits = 64) {
        if (!text || typeof text !== 'string') {
            return '0'.repeat(bits);
        }

        // Initialize bit vector
        const bitVector = new Array(bits).fill(0);
        
        // Extract features (words/n-grams)
        const features = this.extractFeatures(text);
        
        // Process each feature
        features.forEach(feature => {
            const hash = this.hashFeature(feature);
            
            // Update bit vector based on hash bits
            for (let i = 0; i < bits; i++) {
                const bit = (hash >> i) & 1;
                if (bit === 1) {
                    bitVector[i] += feature.weight;
                } else {
                    bitVector[i] -= feature.weight;
                }
            }
        });
        
        // Convert to binary fingerprint
        const fingerprint = bitVector.map(value => value > 0 ? '1' : '0').join('');
        
        return fingerprint;
    }

    /**
     * Extract features for SimHash (words, bigrams, trigrams)
     */
    extractFeatures(text) {
        const features = [];
        const words = text.toLowerCase().match(/\b\w+\b/g) || [];
        
        // Single words with weights
        const wordFreq = {};
        words.forEach(word => {
            if (word.length > 2) { // Ignore very short words
                wordFreq[word] = (wordFreq[word] || 0) + 1;
            }
        });
        
        // Add words as features
        Object.entries(wordFreq).forEach(([word, freq]) => {
            features.push({
                text: word,
                weight: Math.log(freq + 1), // Log frequency weighting
                type: 'word'
            });
        });
        
        // Add bigrams
        for (let i = 0; i < words.length - 1; i++) {
            const bigram = words[i] + ' ' + words[i + 1];
            features.push({
                text: bigram,
                weight: 2, // Bigrams get higher weight
                type: 'bigram'
            });
        }
        
        // Add trigrams for better accuracy
        for (let i = 0; i < words.length - 2; i++) {
            const trigram = words[i] + ' ' + words[i + 1] + ' ' + words[i + 2];
            features.push({
                text: trigram,
                weight: 3, // Trigrams get highest weight
                type: 'trigram'
            });
        }
        
        return features;
    }

    /**
     * Hash a feature for SimHash calculation
     */
    hashFeature(feature) {
        return crypto.createHash('md5')
            .update(feature.text)
            .digest()
            .readUInt32BE(0);
    }

    /**
     * Calculate Hamming distance between two SimHash fingerprints
     */
    calculateHammingDistance(hash1, hash2) {
        if (hash1.length !== hash2.length) {
            throw new Error('SimHash fingerprints must be the same length');
        }
        
        let distance = 0;
        for (let i = 0; i < hash1.length; i++) {
            if (hash1[i] !== hash2[i]) {
                distance++;
            }
        }
        
        return distance;
    }

    /**
     * Calculate similarity score from Hamming distance
     */
    calculateSimilarityScore(hammingDistance, totalBits) {
        return 1 - (hammingDistance / totalBits);
    }

    /**
     * Check for duplicates and similar content
     */
    async checkForDuplicates(fingerprint) {
        const results = {
            status: 'unique',
            exactDuplicates: [],
            similarContent: [],
            maxSimilarity: 0,
            clusterId: null
        };

        // Check for exact duplicates using primary hash
        const exactDuplicate = this.contentFingerprints.get(fingerprint.contentHashes.primary);
        if (exactDuplicate) {
            results.status = 'duplicate';
            results.exactDuplicates.push({
                contentHash: fingerprint.contentHashes.primary,
                similarity: 1.0,
                type: 'exact'
            });
            this.stats.duplicatesDetected++;
            return results;
        }

        // Check for similar content using SimHash
        if (this.options.enableSimilarityDetection) {
            const similarContent = this.findSimilarContent(fingerprint.simHash);
            
            if (similarContent.length > 0) {
                results.similarContent = similarContent;
                results.maxSimilarity = Math.max(...similarContent.map(s => s.similarity));
                
                if (results.maxSimilarity >= this.options.similarityThreshold) {
                    results.status = 'similar';
                    this.stats.similarContentFound++;
                }
            }
        }

        // Assign to cluster or create new cluster
        if (results.status === 'similar' && this.options.enableContentMerging) {
            results.clusterId = await this.assignToCluster(fingerprint, results.similarContent);
        }

        return results;
    }

    /**
     * Find similar content using SimHash index
     */
    findSimilarContent(targetSimHash) {
        const similarContent = [];
        const maxDistance = Math.floor(this.options.simHashBits * (1 - this.options.similarityThreshold));
        
        // Check against all indexed SimHashes
        for (const [existingSimHash, contentHashes] of this.simHashIndex) {
            const hammingDistance = this.calculateHammingDistance(targetSimHash, existingSimHash);
            
            if (hammingDistance <= maxDistance) {
                const similarity = this.calculateSimilarityScore(hammingDistance, this.options.simHashBits);
                
                contentHashes.forEach(contentHash => {
                    const existingFingerprint = this.contentFingerprints.get(contentHash);
                    if (existingFingerprint) {
                        similarContent.push({
                            contentHash,
                            simHash: existingSimHash,
                            similarity,
                            hammingDistance,
                            metadata: existingFingerprint.metadata
                        });
                    }
                });
            }
        }
        
        // Sort by similarity (highest first)
        return similarContent.sort((a, b) => b.similarity - a.similarity);
    }

    /**
     * Index SimHash for efficient similarity searches
     */
    indexSimHash(simHash, contentHash) {
        if (!this.simHashIndex.has(simHash)) {
            this.simHashIndex.set(simHash, []);
        }
        this.simHashIndex.get(simHash).push(contentHash);
    }

    /**
     * Assign content to existing cluster or create new cluster
     */
    async assignToCluster(fingerprint, similarContent) {
        // Find the best matching cluster
        let bestCluster = null;
        let bestSimilarity = 0;
        
        for (const similar of similarContent) {
            const existingFingerprint = this.contentFingerprints.get(similar.contentHash);
            if (existingFingerprint && existingFingerprint.clusterId) {
                if (similar.similarity > bestSimilarity) {
                    bestSimilarity = similar.similarity;
                    bestCluster = existingFingerprint.clusterId;
                }
            }
        }
        
        if (bestCluster && bestSimilarity >= this.options.similarityThreshold) {
            // Add to existing cluster
            await this.addToCluster(bestCluster, fingerprint);
            return bestCluster;
        } else {
            // Create new cluster
            const clusterId = this.generateClusterId();
            await this.createCluster(clusterId, fingerprint);
            return clusterId;
        }
    }

    /**
     * Create a new content cluster
     */
    async createCluster(clusterId, primaryFingerprint) {
        const cluster = {
            id: clusterId,
            createdAt: new Date().toISOString(),
            primaryContent: primaryFingerprint.contentHashes.primary,
            members: [primaryFingerprint.contentHashes.primary],
            mergedContent: null,
            stats: {
                memberCount: 1,
                avgSimilarity: 1.0,
                contentVariations: 1
            }
        };
        
        this.duplicateClusters.set(clusterId, cluster);
        primaryFingerprint.clusterId = clusterId;
        
        this.stats.clustersCreated++;
        
        logger.info('New content cluster created', {
            service: 'EnhancedDuplicateManager',
            clusterId,
            primaryContentHash: primaryFingerprint.contentHashes.primary
        });
        
        return cluster;
    }

    /**
     * Add content to existing cluster
     */
    async addToCluster(clusterId, fingerprint) {
        const cluster = this.duplicateClusters.get(clusterId);
        if (!cluster) {
            throw new Error(`Cluster ${clusterId} not found`);
        }
        
        cluster.members.push(fingerprint.contentHashes.primary);
        cluster.stats.memberCount++;
        cluster.stats.contentVariations++;
        
        fingerprint.clusterId = clusterId;
        
        // Update cluster statistics
        await this.updateClusterStats(clusterId);
        
        // Trigger content merging if enabled
        if (this.options.enableContentMerging && cluster.stats.memberCount >= 2) {
            await this.mergeClusterContent(clusterId);
        }
        
        logger.debug('Content added to cluster', {
            service: 'EnhancedDuplicateManager',
            clusterId,
            memberCount: cluster.stats.memberCount,
            contentHash: fingerprint.contentHashes.primary
        });
    }

    /**
     * Update cluster statistics
     */
    async updateClusterStats(clusterId) {
        const cluster = this.duplicateClusters.get(clusterId);
        if (!cluster) return;
        
        const similarities = [];
        const members = cluster.members;
        
        // Calculate average similarity within cluster
        for (let i = 0; i < members.length; i++) {
            for (let j = i + 1; j < members.length; j++) {
                const fp1 = this.contentFingerprints.get(members[i]);
                const fp2 = this.contentFingerprints.get(members[j]);
                
                if (fp1 && fp2) {
                    const hammingDistance = this.calculateHammingDistance(fp1.simHash, fp2.simHash);
                    const similarity = this.calculateSimilarityScore(hammingDistance, this.options.simHashBits);
                    similarities.push(similarity);
                }
            }
        }
        
        cluster.stats.avgSimilarity = similarities.length > 0 ? 
            similarities.reduce((sum, sim) => sum + sim, 0) / similarities.length : 1.0;
    }

    /**
     * Merge content within a cluster
     */
    async mergeClusterContent(clusterId) {
        const cluster = this.duplicateClusters.get(clusterId);
        if (!cluster) return;
        
        const memberFingerprints = cluster.members
            .map(hash => this.contentFingerprints.get(hash))
            .filter(Boolean);
        
        if (memberFingerprints.length < 2) return;
        
        // Find the best representative content
        const representative = this.selectRepresentativeContent(memberFingerprints);
        
        // Merge metadata and create consolidated content
        const mergedContent = this.createMergedContent(memberFingerprints, representative);
        
        cluster.mergedContent = mergedContent;
        this.stats.contentMerged++;
        
        logger.info('Content merged in cluster', {
            service: 'EnhancedDuplicateManager',
            clusterId,
            memberCount: memberFingerprints.length,
            representativeHash: representative.contentHashes.primary
        });
        
        return mergedContent;
    }

    /**
     * Select the best representative content from cluster members
     */
    selectRepresentativeContent(fingerprints) {
        // Scoring criteria: content length, metadata completeness, recency
        let bestScore = -1;
        let representative = fingerprints[0];
        
        fingerprints.forEach(fp => {
            let score = 0;
            
            // Content completeness (30%)
            score += (fp.components.wordCount / 1000) * 0.3;
            
            // Metadata completeness (25%)
            const metadataScore = [
                fp.components.title ? 1 : 0,
                fp.components.description ? 1 : 0,
                fp.metadata.url ? 1 : 0
            ].reduce((sum, val) => sum + val, 0) / 3;
            score += metadataScore * 0.25;
            
            // Content quality indicators (25%)
            const qualityScore = [
                fp.components.title.length > 10 ? 1 : 0,
                fp.components.description.length > 50 ? 1 : 0,
                fp.components.wordCount > 100 ? 1 : 0
            ].reduce((sum, val) => sum + val, 0) / 3;
            score += qualityScore * 0.25;
            
            // Recency (20%)
            const age = Date.now() - new Date(fp.metadata.analyzedAt).getTime();
            const recencyScore = Math.max(0, 1 - (age / (7 * 24 * 60 * 60 * 1000))); // 7 days max
            score += recencyScore * 0.2;
            
            if (score > bestScore) {
                bestScore = score;
                representative = fp;
            }
        });
        
        return representative;
    }

    /**
     * Create merged content from cluster members
     */
    createMergedContent(fingerprints, representative) {
        // Use representative as base
        const merged = {
            primaryContent: representative.contentHashes.primary,
            title: representative.components.title,
            description: representative.components.description,
            content: representative.components.fullText,
            
            // Aggregate metadata
            sources: fingerprints.map(fp => ({
                contentHash: fp.contentHashes.primary,
                url: fp.metadata.url,
                analyzedAt: fp.metadata.analyzedAt,
                wordCount: fp.components.wordCount
            })),
            
            // Merge statistics
            stats: {
                totalSources: fingerprints.length,
                avgWordCount: fingerprints.reduce((sum, fp) => sum + fp.components.wordCount, 0) / fingerprints.length,
                contentVariations: fingerprints.length,
                qualityScore: this.calculateContentQuality(representative)
            },
            
            // Alternative titles and descriptions
            alternatives: {
                titles: [...new Set(fingerprints.map(fp => fp.components.title).filter(Boolean))],
                descriptions: [...new Set(fingerprints.map(fp => fp.components.description).filter(Boolean))]
            },
            
            mergedAt: new Date().toISOString()
        };
        
        return merged;
    }

    /**
     * Calculate content quality score
     */
    calculateContentQuality(fingerprint) {
        let score = 0;
        const components = fingerprint.components;
        
        // Title quality (25%)
        if (components.title.length > 10 && components.title.length < 200) score += 25;
        else if (components.title.length > 0) score += 15;
        
        // Description quality (25%)
        if (components.description.length > 50 && components.description.length < 500) score += 25;
        else if (components.description.length > 0) score += 15;
        
        // Content length (25%)
        if (components.wordCount > 300) score += 25;
        else if (components.wordCount > 100) score += 15;
        else if (components.wordCount > 50) score += 10;
        
        // Content structure (25%)
        if (components.keyPhrases.length > 5) score += 25;
        else if (components.keyPhrases.length > 2) score += 15;
        
        return Math.min(100, score);
    }

    /**
     * Utility methods for content processing
     */
    cleanContent(content) {
        return content
            .replace(/<!--[\s\S]*?-->/g, '') // Remove comments
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '') // Remove styles
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();
    }

    stripHtml(content) {
        return content.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ').trim();
    }

    extractFirstParagraph(text) {
        const sentences = text.split(/[.!?]+/);
        let paragraph = '';
        let wordCount = 0;
        
        for (const sentence of sentences) {
            const words = sentence.trim().split(/\s+/);
            if (wordCount + words.length > 100) break; // Max 100 words for first paragraph
            
            paragraph += sentence.trim() + '. ';
            wordCount += words.length;
            
            if (wordCount >= 50) break; // Minimum 50 words
        }
        
        return paragraph.trim();
    }

    extractKeyPhrases(text) {
        const words = text.toLowerCase().match(/\b\w{3,}\b/g) || [];
        const stopWords = new Set([
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
            'by', 'this', 'that', 'these', 'those', 'they', 'them', 'their', 'there', 'where',
            'when', 'who', 'what', 'why', 'how', 'can', 'could', 'should', 'would', 'will',
            'have', 'has', 'had', 'been', 'being', 'are', 'was', 'were', 'is', 'am'
        ]);
        
        const filtered = words.filter(word => !stopWords.has(word));
        const frequency = {};
        
        filtered.forEach(word => {
            frequency[word] = (frequency[word] || 0) + 1;
        });
        
        return Object.entries(frequency)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20)
            .map(([word]) => word);
    }

    extractEntities(text) {
        // Simple entity extraction (in production, use NLP libraries)
        const entities = [];
        
        // Extract capitalized words (potential proper nouns)
        const capitalizedWords = text.match(/\b[A-Z][a-z]+\b/g) || [];
        const properNouns = [...new Set(capitalizedWords)].slice(0, 10);
        
        entities.push(...properNouns.map(word => ({ type: 'PERSON_OR_PLACE', value: word })));
        
        // Extract numbers and dates
        const numbers = text.match(/\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\b/g) || [];
        entities.push(...numbers.slice(0, 5).map(num => ({ type: 'NUMBER', value: num })));
        
        const dates = text.match(/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g) || [];
        entities.push(...dates.slice(0, 3).map(date => ({ type: 'DATE', value: date })));
        
        return entities;
    }

    countWords(text) {
        return (text.match(/\b\w+\b/g) || []).length;
    }

    generateClusterId() {
        return 'cluster_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Get comprehensive statistics
     */
    getStats() {
        const runtime = Date.now() - this.stats.startTime;
        
        return {
            ...this.stats,
            runtime: `${runtime}ms`,
            avgProcessingTime: this.stats.totalContentAnalyzed > 0 ? 
                Math.round(this.stats.processingTime / this.stats.totalContentAnalyzed) : 0,
            duplicateRate: this.stats.totalContentAnalyzed > 0 ? 
                ((this.stats.duplicatesDetected / this.stats.totalContentAnalyzed) * 100).toFixed(2) + '%' : '0%',
            similarityRate: this.stats.totalContentAnalyzed > 0 ? 
                ((this.stats.similarContentFound / this.stats.totalContentAnalyzed) * 100).toFixed(2) + '%' : '0%',
            cacheSize: {
                fingerprints: this.contentFingerprints.size,
                simHashIndex: this.simHashIndex.size,
                clusters: this.duplicateClusters.size
            }
        };
    }

    /**
     * Get duplicate content report
     */
    getDuplicateReport() {
        const clusters = Array.from(this.duplicateClusters.values());
        
        return {
            summary: {
                totalClusters: clusters.length,
                totalDuplicates: clusters.reduce((sum, cluster) => sum + cluster.stats.memberCount, 0),
                averageClusterSize: clusters.length > 0 ? 
                    clusters.reduce((sum, cluster) => sum + cluster.stats.memberCount, 0) / clusters.length : 0,
                contentSaved: clusters.reduce((sum, cluster) => sum + (cluster.stats.memberCount - 1), 0)
            },
            clusters: clusters.map(cluster => ({
                id: cluster.id,
                memberCount: cluster.stats.memberCount,
                avgSimilarity: cluster.stats.avgSimilarity.toFixed(3),
                createdAt: cluster.createdAt,
                hasMergedContent: !!cluster.mergedContent
            })),
            performance: this.getStats()
        };
    }

    /**
     * Clear caches and reset statistics
     */
    clear() {
        this.contentFingerprints.clear();
        this.simHashIndex.clear();
        this.duplicateClusters.clear();
        this.contentMetadata.clear();
        
        this.stats = {
            totalContentAnalyzed: 0,
            duplicatesDetected: 0,
            similarContentFound: 0,
            clustersCreated: 0,
            contentMerged: 0,
            processingTime: 0,
            startTime: Date.now()
        };
        
        logger.info('Enhanced duplicate manager cleared', {
            service: 'EnhancedDuplicateManager'
        });
    }
}

module.exports = { EnhancedDuplicateManager };
