/**
 * Elasticsearch Performance Optimizer
 * Provides optimized mappings and indexing strategies for better search performance
 */

const { Client } = require('@elastic/elasticsearch');
const { envManager } = require('../../config/env-manager');

class ElasticsearchOptimizer {
    constructor() {
        this.client = new Client({
            node: envManager.get('ELASTICSEARCH_URL', 'https://localhost:9200'),
            auth: {
                username: envManager.get('ELASTICSEARCH_USERNAME', 'elastic'),
                password: envManager.get('ELASTICSEARCH_PASSWORD', 'bEvADDXp47tbSH32mPwB')
            },
            tls: {
                rejectUnauthorized: false
            }
        });
    }

    /**
     * Get optimized mapping for site_data index
     */
    getOptimizedSiteDataMapping() {
        return {
            mappings: {
                properties: {
                    site_data_id: { type: 'keyword' },
                    site_data_title: {
                        type: 'text',
                        analyzer: 'standard',
                        fields: {
                            keyword: { type: 'keyword', ignore_above: 256 },
                            suggest: { type: 'completion' }
                        }
                    },
                    site_data_description: {
                        type: 'text',
                        analyzer: 'standard',
                        fields: {
                            keyword: { type: 'keyword', ignore_above: 512 }
                        }
                    },
                    site_data_link: {
                        type: 'keyword',
                        fields: {
                            text: { type: 'text', analyzer: 'keyword' }
                        }
                    },
                    site_data_date: { type: 'date' },
                    site_data_last_update: { type: 'date' },
                    site_data_icon: { type: 'keyword' },
                    site_data_visit: { type: 'integer' },
                    site_title: {
                        type: 'text',
                        analyzer: 'standard',
                        fields: {
                            keyword: { type: 'keyword' }
                        }
                    },
                    site_category: {
                        type: 'keyword',
                        fields: {
                            text: { type: 'text', analyzer: 'standard' }
                        }
                    },
                    site_language: { type: 'keyword' },
                    site_data_content: {
                        type: 'text',
                        analyzer: 'standard',
                        index: false // Don't index content for better performance
                    },
                    site_data_article: {
                        type: 'text',
                        analyzer: 'standard',
                        index: false // Don't index article content for better performance
                    },
                    site_data_keywords: {
                        type: 'text',
                        analyzer: 'keyword',
                        fields: {
                            keyword: { type: 'keyword' }
                        }
                    },
                    site_data_h1: {
                        type: 'text',
                        analyzer: 'standard',
                        fields: {
                            keyword: { type: 'keyword' }
                        }
                    }
                }
            },
            settings: {
                number_of_shards: 1,
                number_of_replicas: 0, // Disable replicas for better performance
                refresh_interval: '30s', // Reduce refresh frequency
                max_result_window: 10000,
                analysis: {
                    analyzer: {
                        standard: {
                            type: 'standard',
                            stopwords: '_english_'
                        }
                    }
                }
            }
        };
    }

    /**
     * Get optimized mapping for site_img index
     */
    getOptimizedSiteImgMapping() {
        return {
            mappings: {
                properties: {
                    site_img_id: { type: 'keyword' },
                    site_img_title: {
                        type: 'text',
                        analyzer: 'standard',
                        fields: {
                            keyword: { type: 'keyword', ignore_above: 256 }
                        }
                    },
                    site_img_alt: {
                        type: 'text',
                        analyzer: 'standard',
                        fields: {
                            keyword: { type: 'keyword', ignore_above: 256 }
                        }
                    },
                    site_img_link: { type: 'keyword' },
                    site_img_width: { type: 'integer' },
                    site_img_height: { type: 'integer' },
                    site_img_size: { type: 'integer' },
                    site_img_source: { type: 'keyword' },
                    site_img_category: { type: 'keyword' }
                }
            },
            settings: {
                number_of_shards: 1,
                number_of_replicas: 0,
                refresh_interval: '30s'
            }
        };
    }

    /**
     * Get optimized mapping for site_videos index
     */
    getOptimizedSiteVideosMapping() {
        return {
            mappings: {
                properties: {
                    site_videos_id: { type: 'keyword' },
                    site_videos_title: {
                        type: 'text',
                        analyzer: 'standard',
                        fields: {
                            keyword: { type: 'keyword', ignore_above: 256 }
                        }
                    },
                    site_videos_description: {
                        type: 'text',
                        analyzer: 'standard',
                        fields: {
                            keyword: { type: 'keyword', ignore_above: 512 }
                        }
                    },
                    site_videos_link: { type: 'keyword' },
                    site_videos_thumbnail: { type: 'keyword' },
                    site_videos_duration: { type: 'integer' },
                    site_videos_width: { type: 'integer' },
                    site_videos_height: { type: 'integer' },
                    site_videos_provider: { type: 'keyword' },
                    site_videos_created: { type: 'date' },
                    site_videos_category: { type: 'keyword' },
                    site_videos_tags: {
                        type: 'text',
                        analyzer: 'keyword',
                        fields: {
                            keyword: { type: 'keyword' }
                        }
                    },
                    site_videos_keywords: {
                        type: 'text',
                        analyzer: 'keyword',
                        fields: {
                            keyword: { type: 'keyword' }
                        }
                    },
                    site_videos_metadata: { type: 'object', enabled: false }
                }
            },
            settings: {
                number_of_shards: 1,
                number_of_replicas: 0,
                refresh_interval: '30s'
            }
        };
    }

    /**
     * Apply optimized settings to an existing index
     */
    async optimizeIndex(indexName) {
        try {
            console.log(`Optimizing index: ${indexName}`);
            
            // Close index for optimization
            await this.client.indices.close({ index: indexName });
            
            // Apply optimized settings
            const settings = {
                index: {
                    number_of_replicas: 0,
                    refresh_interval: '30s',
                    max_result_window: 10000
                }
            };
            
            await this.client.indices.putSettings({
                index: indexName,
                body: settings
            });
            
            // Reopen index
            await this.client.indices.open({ index: indexName });
            
            console.log(`✅ Index ${indexName} optimized successfully`);
            return true;
            
        } catch (error) {
            console.error(`❌ Failed to optimize index ${indexName}:`, error.message);
            return false;
        }
    }

    /**
     * Create optimized index with proper mapping
     */
    async createOptimizedIndex(indexName, mappingType = 'site_data') {
        try {
            console.log(`Creating optimized index: ${indexName}`);
            
            let mapping;
            switch (mappingType) {
                case 'site_data':
                    mapping = this.getOptimizedSiteDataMapping();
                    break;
                case 'site_img':
                    mapping = this.getOptimizedSiteImgMapping();
                    break;
                case 'site_videos':
                    mapping = this.getOptimizedSiteVideosMapping();
                    break;
                default:
                    throw new Error(`Unknown mapping type: ${mappingType}`);
            }
            
            await this.client.indices.create({
                index: indexName,
                body: mapping
            });
            
            console.log(`✅ Optimized index ${indexName} created successfully`);
            return true;
            
        } catch (error) {
            console.error(`❌ Failed to create optimized index ${indexName}:`, error.message);
            return false;
        }
    }

    /**
     * Force merge index for better performance
     */
    async forceMergeIndex(indexName) {
        try {
            console.log(`Force merging index: ${indexName}`);
            
            await this.client.indices.forcemerge({
                index: indexName,
                max_num_segments: 1,
                wait_for_completion: false
            });
            
            console.log(`✅ Index ${indexName} force merge initiated`);
            return true;
            
        } catch (error) {
            console.error(`❌ Failed to force merge index ${indexName}:`, error.message);
            return false;
        }
    }

    /**
     * Get index statistics
     */
    async getIndexStats(indexName) {
        try {
            const stats = await this.client.indices.stats({ index: indexName });
            return stats.indices[indexName];
        } catch (error) {
            console.error(`Failed to get stats for index ${indexName}:`, error.message);
            return null;
        }
    }

    /**
     * Optimize all search-related indices
     */
    async optimizeAllIndices() {
        const indices = ['site_data', 'site_img', 'site_videos'];
        const results = [];
        
        for (const index of indices) {
            try {
                const exists = await this.client.indices.exists({ index });
                if (exists) {
                    const result = await this.optimizeIndex(index);
                    results.push({ index, success: result });
                } else {
                    console.log(`Index ${index} does not exist, skipping`);
                    results.push({ index, success: false, reason: 'not_exists' });
                }
            } catch (error) {
                console.error(`Error optimizing index ${index}:`, error.message);
                results.push({ index, success: false, error: error.message });
            }
        }
        
        return results;
    }
}

module.exports = ElasticsearchOptimizer;
