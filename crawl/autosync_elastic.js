//autosync_elastic.js

const { Client } = require('@elastic/elasticsearch');
const mysql = require('mysql2/promise');

// Configuration

const config = {
  es: {
    node: 'https://localhost:9200',
    auth: {
      username: 'elastic',
      password: 'bEvADDXp47tbSH32mPwB'
    },
    tls: {
      rejectUnauthorized: false
    }
  },
  db: {
    host: 'localhost',
    user: 'mybhoomy_admin',
    password: 'mhQjj.%C-_LO_U4',
    database: 'mybhoomy_mysearch'
  }
};


// Create Elasticsearch client
const esClient = new Client(config.es);

function getIdColumnName(indexName) {
    switch(indexName) {        
        case 'site_data': return 'site_data_id';
        case 'site_img': return 'site_img_id';
        case 'site_doc': return 'site_doc_id';
        case 'site_videos': return 'site_videos_id';
        default: return 'id';
    }
}

function getDocumentId(indexName, doc) {
    const idColumn = getIdColumnName(indexName);
    return doc[idColumn];
}

function formatDocumentForES(indexName, doc) {
    const formatted = {};
    const booleanFields = {        
        'site_data': [],
        'site_img': [],
        'site_doc': [],
        'site_videos': []
    };

    for (const [key, value] of Object.entries(doc)) {
        if (value !== null) {
            // Convert boolean fields
            if (booleanFields[indexName] && booleanFields[indexName].includes(key)) {
                formatted[key] = Boolean(value);
            }
            // Convert dates
            else if (value instanceof Date) {
                formatted[key] = value.toISOString();
            }
            // Handle numeric fields
            else if (typeof value === 'number') {
                formatted[key] = value;
            }
            // Handle string fields
            else {
                formatted[key] = String(value);
            }
        }
    }
    return formatted;
}

class IndexState {
    constructor(name, totalRecords) {
        this.name = name;
        this.totalRecords = totalRecords;
        this.processedRecords = 0;
        this.lastProcessedId = 0;
        this.isInitialLoadComplete = false;
    }
}

async function getTotalRecords(connection, indexName) {
    const [result] = await connection.query(`SELECT COUNT(*) as total FROM ${indexName}`);
    return result[0].total;
}

async function bulkIndexData(indexName, documents) {
    if (!documents.length) return;

    try {
        const operations = documents.flatMap(doc => [
            { index: { _index: indexName, _id: getDocumentId(indexName, doc) } },
            formatDocumentForES(indexName, doc)
        ]);

        const bulkResponse = await esClient.bulk({
            refresh: true,
            operations: operations
        });

        const successCount = bulkResponse.items.filter(item => !item.index.error).length;
        const errorCount = bulkResponse.items.filter(item => item.index.error).length;

        console.log(`[${indexName}] Bulk indexing results:
            - Successfully indexed: ${successCount}
            - Failed: ${errorCount}
            - Total processed: ${documents.length}`);

        if (errorCount > 0) {
            const errors = bulkResponse.items
                .filter(item => item.index.error)
                .slice(0, 5);
            console.error(`[${indexName}] Sample errors:`, errors);
        }

        return bulkResponse;
    } catch (error) {
        console.error(`[${indexName}] Bulk indexing failed:`, error);
        throw error;
    }
}

async function processNewRecords(connection, index, state) {
    try {
        const [records] = await connection.query(
            `SELECT * FROM ${index.name} 
             WHERE ${getIdColumnName(index.name)} > ? 
             ORDER BY ${getIdColumnName(index.name)} ASC 
             LIMIT ?`,
            [state.lastProcessedId, index.batchSize]
        );

        if (records.length > 0) {
            console.log(`[${index.name}] Processing ${records.length} records from ID ${state.lastProcessedId + 1}`);
            await bulkIndexData(index.name, records);
            state.processedRecords += records.length;
            state.lastProcessedId = records[records.length - 1][getIdColumnName(index.name)];

            if (!state.isInitialLoadComplete && state.processedRecords >= state.totalRecords) {
                state.isInitialLoadComplete = true;
                console.log(`[${index.name}] ✅ Initial load complete! Processed ${state.processedRecords} records`);
            }

            return records.length;
        }
        return 0;
    } catch (error) {
        console.error(`Error processing records for ${index.name}:`, error);
        return 0;
    }
}

async function continuousSync(connection, index, state) {
    try {
        console.log(`[${index.name}] Starting sync. Total records to process: ${state.totalRecords}`);

        while (true) {
            try {
                if (state.isInitialLoadComplete) {
                    // Check for new records less frequently when initial load is complete
                    const currentTotal = await getTotalRecords(connection, index.name);
                    if (currentTotal > state.totalRecords) {
                        console.log(`[${index.name}] Found ${currentTotal - state.totalRecords} new records to process`);
                        state.totalRecords = currentTotal;
                        state.isInitialLoadComplete = false;
                    } else {
                        // Wait longer between checks when caught up
                        await new Promise(resolve => setTimeout(resolve, index.completedCheckInterval));
                        continue;
                    }
                }

                // Process records
                const processedCount = await processNewRecords(connection, index, state);
                
                if (processedCount === 0) {
                    if (!state.isInitialLoadComplete) {
                        // Double check total records before marking as complete
                        const currentTotal = await getTotalRecords(connection, index.name);
                        if (state.processedRecords >= currentTotal) {
                            state.isInitialLoadComplete = true;
                            state.totalRecords = currentTotal;
                            console.log(`[${index.name}] ✅ Initial load complete! Processed ${state.processedRecords} records`);
                        }
                    }
                    // Wait before next check
                    await new Promise(resolve => setTimeout(resolve, 
                        state.isInitialLoadComplete ? index.completedCheckInterval : index.checkInterval
                    ));
                }

            } catch (error) {
                console.error(`Error in sync loop for ${index.name}:`, error);
                await new Promise(resolve => setTimeout(resolve, 10000));
            }
        }
    } catch (error) {
        console.error(`Fatal error in continuous sync for ${index.name}:`, error);
        throw error;
    }
}

async function initialLoad() {
    const connection = await mysql.createConnection({
        ...config.db,
        connectTimeout: 60000,
        multipleStatements: true
    });
    
    const indices = [
        { 
            name: 'site_data', 
            batchSize: 2000,
            checkInterval: 5000,            // Check every 5 seconds during initial load
            completedCheckInterval: 60000  // Check every minute when caught up
        },
        { 
            name: 'site_img', 
            batchSize: 2000,
            checkInterval: 5000,
            completedCheckInterval: 60000
        },
        { 
            name: 'site_doc', 
            batchSize: 2000,
            checkInterval: 5000,
            completedCheckInterval: 60000
        },
        { 
            name: 'site_videos', 
            batchSize: 2000,
            checkInterval: 5000,
            completedCheckInterval: 60000
        }
    ];

    try {
        console.log('Initializing sync process for all indices...');
        
        // Initialize states for all indices
        const states = {};
        for (const index of indices) {
            const totalRecords = await getTotalRecords(connection, index.name);
            states[index.name] = new IndexState(index.name, totalRecords);
            console.log(`[${index.name}] Total records to process: ${totalRecords}`);
        }

        // Start continuous sync for each index
        const syncPromises = indices.map(index => 
            continuousSync(connection, index, states[index.name])
        );
        
        // Wait for all sync processes
        await Promise.all(syncPromises);

    } catch (error) {
        console.error('Error during sync:', error);
        throw error;
    } finally {
        await connection.end();
    }
}

async function main() {
    try {
        await initialLoad();
        console.log('Initial load completed successfully');
    } catch (error) {
        console.error('Error in main execution:', error);
        process.exit(1);
    }
}

// Run the script
main().catch(console.error);
