const { con } = require('./mysql');

async function checkDatabaseStats() {
    console.log('=== Database Performance Analysis ===\n');
    
    try {
        // Wait for database connection
        await con.waitForConnection();
        
        if (!con.isConnected()) {
            console.log('❌ Database connection failed');
            return;
        }
        
        console.log('✅ Database connected successfully\n');
        
        // Check table record counts
        console.log('📊 Table Record Counts:');
        
        const tables = [
            { name: 'site_data', description: 'Main content pages' },
            { name: 'site_img', description: 'Images extracted' },
            { name: 'site_doc', description: 'Documents processed' },
            { name: 'sites', description: 'Registered sites' }
        ];
        
        const stats = {};
        
        for (const table of tables) {
            try {
                const result = await con.query(`SELECT COUNT(*) as total FROM ${table.name}`);
                const count = result[0]?.total || 0;
                stats[table.name] = count;
                console.log(`   ${table.name}: ${count.toLocaleString()} records (${table.description})`);
            } catch (error) {
                console.log(`   ${table.name}: Error - ${error.message}`);
                stats[table.name] = 0;
            }
        }
        
        // Check recent insertion performance
        console.log('\n⏱️  Recent Insertion Performance:');
        
        try {
            const recentData = await con.query(`
                SELECT 
                    DATE(crawl_date) as date,
                    COUNT(*) as records_inserted,
                    AVG(CHAR_LENGTH(site_data_article)) as avg_content_length
                FROM site_data 
                WHERE crawl_date >= DATE(NOW() - INTERVAL 7 DAYS)
                GROUP BY DATE(crawl_date)
                ORDER BY date DESC
                LIMIT 7
            `);
            
            if (recentData.length > 0) {
                recentData.forEach(row => {
                    console.log(`   ${row.date}: ${row.records_inserted} records, avg content: ${Math.round(row.avg_content_length || 0)} chars`);
                });
            } else {
                console.log('   No recent data found');
            }
        } catch (error) {
            console.log('   Error getting recent performance:', error.message);
        }
        
        // Check document processing stats
        console.log('\n📄 Document Processing Stats:');
        
        try {
            const docStats = await con.query(`
                SELECT 
                    site_doc_type as doc_type,
                    COUNT(*) as count,
                    AVG(site_doc_size) as avg_size,
                    SUM(site_doc_size) as total_size
                FROM site_doc 
                GROUP BY site_doc_type
                ORDER BY count DESC
            `);
            
            if (docStats.length > 0) {
                docStats.forEach(row => {
                    const avgSize = Math.round(row.avg_size || 0);
                    const totalSize = Math.round((row.total_size || 0) / 1024); // KB
                    console.log(`   ${row.doc_type}: ${row.count} docs, avg: ${avgSize} bytes, total: ${totalSize} KB`);
                });
            } else {
                console.log('   No documents processed yet');
            }
        } catch (error) {
            console.log('   Error getting document stats:', error.message);
        }
        
        // Check for performance bottlenecks
        console.log('\n🔍 Performance Analysis:');
        
        // Check for duplicate detection performance
        try {
            const duplicateStats = await con.query(`
                SELECT 
                    COUNT(*) as total_pages,
                    COUNT(DISTINCT site_data_hash) as unique_content,
                    (COUNT(*) - COUNT(DISTINCT site_data_hash)) as potential_duplicates
                FROM site_data
                WHERE site_data_hash IS NOT NULL
            `);
            
            if (duplicateStats.length > 0) {
                const row = duplicateStats[0];
                const duplicateRate = ((row.potential_duplicates / row.total_pages) * 100).toFixed(1);
                console.log(`   Duplicate detection: ${row.unique_content}/${row.total_pages} unique (${duplicateRate}% duplicates)`);
            }
        } catch (error) {
            console.log('   Error checking duplicates:', error.message);
        }
        
        // Check database size
        try {
            const sizeStats = await con.query(`
                SELECT 
                    table_name,
                    ROUND(((data_length + index_length) / 1024 / 1024), 2) AS size_mb
                FROM information_schema.tables 
                WHERE table_schema = DATABASE()
                AND table_name IN ('site_data', 'site_img', 'site_doc', 'sites')
                ORDER BY (data_length + index_length) DESC
            `);
            
            if (sizeStats.length > 0) {
                console.log('\n💾 Database Storage:');
                let totalSize = 0;
                sizeStats.forEach(row => {
                    console.log(`   ${row.table_name}: ${row.size_mb} MB`);
                    totalSize += parseFloat(row.size_mb);
                });
                console.log(`   Total database size: ${totalSize.toFixed(2)} MB`);
            }
        } catch (error) {
            console.log('   Error getting database size:', error.message);
        }
        
        // Performance recommendations
        console.log('\n🚀 Performance Recommendations:');
        
        const recommendations = [];
        
        if (stats.site_data > 10000) {
            recommendations.push('Consider implementing database partitioning for site_data table');
        }
        
        if (stats.site_img > 50000) {
            recommendations.push('Consider archiving old image records or implementing cleanup');
        }
        
        if (stats.site_doc < 100) {
            recommendations.push('Document processing is working but low volume - check document detection');
        }
        
        if (recommendations.length > 0) {
            recommendations.forEach(rec => console.log(`   • ${rec}`));
        } else {
            console.log('   Database performance looks good!');
        }
        
        console.log('\n=== Analysis Complete ===');
        
    } catch (error) {
        console.error('Error during database analysis:', error.message);
    } finally {
        await con.close();
    }
}

// Run the analysis
checkDatabaseStats().catch(console.error); 