const { con } = require('./mysql');
const { logger } = require('./utils/logger');

/**
 * Real-time duplicate monitoring for crawler
 */
class DuplicateMonitor {
    constructor() {
        this.startTime = Date.now();
        this.stats = {
            totalAttempts: 0,
            duplicatesBlocked: 0,
            newDocuments: 0,
            lastCheckTime: Date.now()
        };
    }

    async startMonitoring() {
        console.log('🔍 Starting real-time duplicate monitoring...');
        console.log('Press Ctrl+C to stop monitoring\n');

        // Initial baseline
        await this.getBaseline();
        
        // Monitor every 30 seconds
        setInterval(async () => {
            await this.checkDuplicateStats();
        }, 30000);

        // Detailed report every 5 minutes
        setInterval(async () => {
            await this.generateDetailedReport();
        }, 300000);
    }

    async getBaseline() {
        try {
            const result = await con.query('SELECT COUNT(*) as total FROM site_doc');
            this.stats.baselineDocuments = result[0].total;
            console.log(`📊 Baseline: ${this.stats.baselineDocuments.toLocaleString()} documents in database`);
        } catch (error) {
            console.error('❌ Error getting baseline:', error.message);
        }
    }

    async checkDuplicateStats() {
        try {
            const currentTime = Date.now();
            const timeSinceStart = (currentTime - this.startTime) / 1000 / 60; // minutes

            // Get current document count
            const totalResult = await con.query('SELECT COUNT(*) as total FROM site_doc');
            const currentTotal = totalResult[0].total;
            
            // Get unique URLs
            const uniqueResult = await con.query('SELECT COUNT(DISTINCT site_doc_link) as unique FROM site_doc');
            const uniqueUrls = uniqueResult[0].unique;
            
            // Calculate stats
            const newDocuments = currentTotal - this.stats.baselineDocuments;
            const currentDuplicates = currentTotal - uniqueUrls;
            const duplicateRate = currentDuplicates / currentTotal * 100;

            // Update stats
            this.stats.newDocuments = newDocuments;
            this.stats.lastCheckTime = currentTime;

            // Display current status
            const status = duplicateRate < 5 ? '🟢 EXCELLENT' : 
                          duplicateRate < 15 ? '🟡 GOOD' : '🔴 NEEDS ATTENTION';
            
            console.log(`${status} | Documents: ${currentTotal.toLocaleString()} | New: +${newDocuments} | Duplicates: ${currentDuplicates.toLocaleString()} (${duplicateRate.toFixed(1)}%) | Runtime: ${timeSinceStart.toFixed(1)}m`);

        } catch (error) {
            console.error('❌ Error checking stats:', error.message);
        }
    }

    async generateDetailedReport() {
        try {
            console.log('\n' + '='.repeat(80));
            console.log('📊 DETAILED DUPLICATE PREVENTION REPORT');
            console.log('='.repeat(80));

            // Get recent document insertions (last 5 minutes)
            const recentDocs = await con.query(`
                SELECT 
                    site_doc_type,
                    COUNT(*) as count,
                    COUNT(DISTINCT site_doc_link) as unique_urls
                FROM site_doc 
                WHERE site_doc_id > (
                    SELECT MAX(site_doc_id) - 1000 FROM site_doc
                )
                AND site_doc_type IS NOT NULL
                GROUP BY site_doc_type
                ORDER BY count DESC
            `);

            console.log('📈 Recent activity by document type:');
            console.log('Type     | Count | Unique | Duplicates');
            console.log('---------|-------|--------|----------');
            
            let totalRecent = 0;
            let totalUniqueRecent = 0;
            
            recentDocs.forEach(row => {
                const duplicates = row.count - row.unique_urls;
                const dupRate = duplicates > 0 ? ` (${(duplicates/row.count*100).toFixed(1)}%)` : '';
                console.log(`${row.site_doc_type.padEnd(8)} | ${row.count.toString().padStart(5)} | ${row.unique_urls.toString().padStart(6)} | ${duplicates.toString().padStart(5)}${dupRate}`);
                totalRecent += row.count;
                totalUniqueRecent += row.unique_urls;
            });

            const recentDuplicateRate = totalRecent > 0 ? ((totalRecent - totalUniqueRecent) / totalRecent * 100).toFixed(1) : 0;
            console.log('---------|-------|--------|----------');
            console.log(`TOTAL    | ${totalRecent.toString().padStart(5)} | ${totalUniqueRecent.toString().padStart(6)} | ${(totalRecent - totalUniqueRecent).toString().padStart(5)} (${recentDuplicateRate}%)`);

            // Performance assessment
            console.log('\n🎯 DUPLICATE PREVENTION PERFORMANCE:');
            if (recentDuplicateRate < 5) {
                console.log('   ✅ EXCELLENT: Less than 5% duplicates in recent crawling');
                console.log('   ✅ Duplicate prevention is working effectively');
            } else if (recentDuplicateRate < 15) {
                console.log('   🟡 GOOD: Some duplicates detected but within acceptable range');
                console.log('   💡 Monitor for improvement');
            } else {
                console.log('   🔴 ATTENTION NEEDED: High duplicate rate detected');
                console.log('   ⚠️  Check crawler configuration and duplicate prevention logic');
            }

            console.log('='.repeat(80) + '\n');

        } catch (error) {
            console.error('❌ Error generating detailed report:', error.message);
        }
    }
}

// Main execution
async function main() {
    const monitor = new DuplicateMonitor();
    
    try {
        await con.waitForConnection();
        await monitor.startMonitoring();
    } catch (error) {
        console.error('❌ Monitor failed to start:', error.message);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Stopping duplicate monitor...');
    process.exit(0);
});

// Run if this file is executed directly
if (require.main === module) {
    main();
}

module.exports = { DuplicateMonitor }; 