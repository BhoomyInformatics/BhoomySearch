// Test script to debug special sites crawling issue
const { SearchEngineCrawler } = require("./index");
const { con } = require("./mysql");
const fs = require('fs').promises;

async function testSpecialSites() {
    try {
        console.log('=== Testing Special Sites Crawling ===');
        
        // Test the same URLs that work in news_site.js
        const testUrls = [
            'https://www.ragalahari.com/',
            'https://indianexpress.com/',
            'https://www.hindustantimes.com/',
            'https://www.deccanchronicle.com/'
        ];
        
        // Initialize crawler
        const crawler = new SearchEngineCrawler(con, {
            maxDepth: 3,
            maxPagesPerDomain: 500,
            batchSize: 10,
            maxPages: 500,
            batchDelay: 2000,
            depthDelay: 3000,
            respectRobots: true,
            timeout: 30000
        });
        
        await crawler.initialize();
        console.log('Crawler initialized successfully');
        
        // Test each URL individually
        for (const url of testUrls) {
            console.log(`\n=== Testing URL: ${url} ===`);
            
            try {
                // Get site ID from database
                const siteResult = await con.query(
                    'SELECT site_id FROM sites WHERE site_url = ?',
                    [url]
                );
                
                if (siteResult.length === 0) {
                    console.log(`❌ Site not found in database: ${url}`);
                    continue;
                }
                
                const siteId = siteResult[0].site_id;
                console.log(`✅ Found site ID: ${siteId} for URL: ${url}`);
                
                // Test smart crawling
                const result = await crawler.crawlWebsiteSmart(url, siteId, {
                    maxDepth: 3,
                    maxPagesPerDomain: 500,
                    forceCrawl: true,
                    skipRecentCheck: true,
                    crawlInterval: 'daily'
                });
                
                console.log('Crawl result:', result);
                
                if (result.success) {
                    console.log(`✅ Crawl successful for ${url}`);
                    console.log(`   📄 New pages indexed: ${result.uniquePages}`);
                    console.log(`   🔄 Duplicates skipped: ${result.duplicatesSkipped}`);
                    console.log(`   💾 HTTP requests saved: ${result.httpRequestsSaved}`);
                    console.log(`   📊 Efficiency: ${result.crawlEfficiency}%`);
                } else {
                    console.log(`❌ Crawl failed for ${url}: ${result.error}`);
                }
                
            } catch (error) {
                console.error(`❌ Error testing ${url}:`, error.message);
            }
        }
        
        await crawler.cleanup();
        console.log('\n=== Test completed ===');
        
    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        process.exit();
    }
}

testSpecialSites(); 