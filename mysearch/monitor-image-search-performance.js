#!/usr/bin/env node

/**
 * Image Search Performance Monitor
 * Monitors and reports on image search performance metrics
 */

const mysql = require('./mysql');
const { Client } = require('@elastic/elasticsearch');

// Initialize Elasticsearch client
const client = new Client({
    node: process.env.ELASTICSEARCH_URL || 'https://localhost:9200',
    auth: {
        username: process.env.ELASTICSEARCH_USERNAME || 'elastic',
        password: process.env.ELASTICSEARCH_PASSWORD || 'bEvADDXp47tbSH32mPwB'
    },
    tls: { rejectUnauthorized: false }
});

class ImageSearchPerformanceMonitor {
    constructor() {
        this.metrics = {
            totalSearches: 0,
            averageResponseTime: 0,
            cacheHitRate: 0,
            errorRate: 0,
            totalImages: 0,
            elasticsearchHealth: false,
            databaseHealth: false
        };
    }

    async checkElasticsearchHealth() {
        try {
            const response = await client.ping();
            this.metrics.elasticsearchHealth = true;
            console.log('✅ Elasticsearch is healthy');
            return true;
        } catch (error) {
            this.metrics.elasticsearchHealth = false;
            console.log('❌ Elasticsearch is unhealthy:', error.message);
            return false;
        }
    }

    async checkDatabaseHealth() {
        try {
            const result = await mysql.query('SELECT 1 as health');
            this.metrics.databaseHealth = true;
            console.log('✅ Database is healthy');
            return true;
        } catch (error) {
            this.metrics.databaseHealth = false;
            console.log('❌ Database is unhealthy:', error.message);
            return false;
        }
    }

    async getImageCounts() {
        try {
            // Get total images from MySQL
            const mysqlResult = await mysql.query('SELECT COUNT(*) as count FROM site_img');
            const mysqlCount = mysqlResult[0].count;

            // Get total images from Elasticsearch
            const esResult = await client.count({ index: ['site_img'] });
            const esCount = esResult.count;

            this.metrics.totalImages = mysqlCount;
            
            console.log(`📊 Image counts:`);
            console.log(`   MySQL: ${mysqlCount.toLocaleString()}`);
            console.log(`   Elasticsearch: ${esCount.toLocaleString()}`);
            console.log(`   Difference: ${Math.abs(mysqlCount - esCount).toLocaleString()}`);
            
            return { mysql: mysqlCount, elasticsearch: esCount };
        } catch (error) {
            console.log('❌ Failed to get image counts:', error.message);
            return { mysql: 0, elasticsearch: 0 };
        }
    }

    async checkIndexes() {
        try {
            console.log('\n🔍 Checking database indexes...');
            
            const indexes = await mysql.query(`
                SELECT 
                    TABLE_NAME,
                    INDEX_NAME,
                    COLUMN_NAME,
                    CARDINALITY
                FROM information_schema.STATISTICS 
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME IN ('site_img', 'site_data', 'sites')
                ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX
            `);

            const indexGroups = {};
            indexes.forEach(index => {
                if (!indexGroups[index.TABLE_NAME]) {
                    indexGroups[index.TABLE_NAME] = {};
                }
                if (!indexGroups[index.TABLE_NAME][index.INDEX_NAME]) {
                    indexGroups[index.TABLE_NAME][index.INDEX_NAME] = [];
                }
                indexGroups[index.TABLE_NAME][index.INDEX_NAME].push(index.COLUMN_NAME);
            });

            Object.keys(indexGroups).forEach(table => {
                console.log(`\n   ${table}:`);
                Object.keys(indexGroups[table]).forEach(indexName => {
                    const columns = indexGroups[table][indexName].join(', ');
                    console.log(`     ${indexName}: ${columns}`);
                });
            });

            return indexGroups;
        } catch (error) {
            console.log('❌ Failed to check indexes:', error.message);
            return {};
        }
    }

    async testSearchPerformance() {
        try {
            console.log('\n⚡ Testing search performance...');
            
            const testQueries = [
                'test',
                'image',
                'photo',
                'picture',
                'nature'
            ];

            const results = [];
            
            for (const query of testQueries) {
                const startTime = Date.now();
                
                try {
                    const response = await client.search({
                        index: ['site_img'],
                        size: 20,
                        query: {
                            bool: {
                                must: [
                                    {
                                        multi_match: {
                                            query: query,
                                            fields: ['site_img_title^3', 'site_img_alt^2', 'site_img_link^1'],
                                            type: 'best_fields',
                                            fuzziness: '0'
                                        }
                                    }
                                ],
                                filter: [
                                    { exists: { field: 'site_img_link' } }
                                ]
                            }
                        },
                        timeout: '5s'
                    });
                    
                    const responseTime = Date.now() - startTime;
                    const hitCount = response.hits.total.value;
                    
                    results.push({
                        query,
                        responseTime,
                        hitCount,
                        success: true
                    });
                    
                    console.log(`   "${query}": ${responseTime}ms (${hitCount} results)`);
                } catch (error) {
                    results.push({
                        query,
                        responseTime: Date.now() - startTime,
                        hitCount: 0,
                        success: false,
                        error: error.message
                    });
                    
                    console.log(`   "${query}": FAILED - ${error.message}`);
                }
            }
            
            const successfulResults = results.filter(r => r.success);
            const averageResponseTime = successfulResults.length > 0 
                ? successfulResults.reduce((sum, r) => sum + r.responseTime, 0) / successfulResults.length 
                : 0;
            
            this.metrics.averageResponseTime = averageResponseTime;
            this.metrics.errorRate = (results.length - successfulResults.length) / results.length;
            
            console.log(`\n   Average response time: ${averageResponseTime.toFixed(2)}ms`);
            console.log(`   Error rate: ${(this.metrics.errorRate * 100).toFixed(2)}%`);
            
            return results;
        } catch (error) {
            console.log('❌ Performance test failed:', error.message);
            return [];
        }
    }

    async generateReport() {
        console.log('🔍 Image Search Performance Report');
        console.log('=====================================\n');
        
        // Check system health
        await this.checkElasticsearchHealth();
        await this.checkDatabaseHealth();
        
        // Get image counts
        await this.getImageCounts();
        
        // Check indexes
        await this.checkIndexes();
        
        // Test performance
        await this.testSearchPerformance();
        
        console.log('\n📈 Performance Summary');
        console.log('======================');
        console.log(`Elasticsearch Health: ${this.metrics.elasticsearchHealth ? '✅' : '❌'}`);
        console.log(`Database Health: ${this.metrics.databaseHealth ? '✅' : '❌'}`);
        console.log(`Total Images: ${this.metrics.totalImages.toLocaleString()}`);
        console.log(`Average Response Time: ${this.metrics.averageResponseTime.toFixed(2)}ms`);
        console.log(`Error Rate: ${(this.metrics.errorRate * 100).toFixed(2)}%`);
        
        // Recommendations
        console.log('\n💡 Recommendations');
        console.log('==================');
        
        if (!this.metrics.elasticsearchHealth) {
            console.log('❌ Fix Elasticsearch connection issues');
        }
        
        if (!this.metrics.databaseHealth) {
            console.log('❌ Fix database connection issues');
        }
        
        if (this.metrics.averageResponseTime > 1000) {
            console.log('⚠️  Consider optimizing search queries (response time > 1s)');
        }
        
        if (this.metrics.errorRate > 0.1) {
            console.log('⚠️  High error rate detected - investigate search failures');
        }
        
        if (this.metrics.totalImages < 1000) {
            console.log('ℹ️  Consider adding more images to the index for better search results');
        }
        
        console.log('\n✅ Performance monitoring complete!');
    }
}

// Run the monitor
async function main() {
    const monitor = new ImageSearchPerformanceMonitor();
    await monitor.generateReport();
    process.exit(0);
}

if (require.main === module) {
    main().catch(error => {
        console.error('❌ Monitor failed:', error);
        process.exit(1);
    });
}

module.exports = ImageSearchPerformanceMonitor;
