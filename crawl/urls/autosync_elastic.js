//autosync_elastic.js


const request = require('request');
const { con } = require("./mysql");
const elasticsearch = require("elasticsearch");
const client = new elasticsearch.Client({
    host: 'http://localhost:9200',
   // httpAuth: 'elastic:Y1OcTtgmnUNKEHhYwQtP',
});


const pageSize = 10000;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function processAndIndexData(indexName, rows, idField) {
    const bulkData = [];

    for (const row of rows) {
        const documentId = row[idField];
        const documentExists = await checkDocumentExists(indexName, documentId);

        if (!documentExists) {
            bulkData.push({ index: { _index: indexName, _id: documentId } });
            delete row[idField];
            bulkData.push(row);
        }
    }

    if (bulkData.length > 0) {
        try {
            const bulkResponse = await client.bulk({
                index: indexName,
                body: bulkData,
                refresh: "wait_for",
            });

            console.log(`Bulk indexing response for ${indexName}:`, bulkResponse);
        } catch (error) {
            console.error(`Error indexing data for ${indexName}:`, error);
        }
    }
}

async function checkDocumentExists(indexName, documentId) {
    try {
        const response = await client.exists({
            index: indexName,
            id: documentId,
        });

        return response.body;
    } catch (error) {
        console.error(`Error checking if document exists for ${indexName}:`, error);
        return false;
    }
}

async function indexData(indexName, query, processData, idField) {
    try {
        const rowCountResult = await con.query(query);
        const rowCount = rowCountResult[0]?.c || 0;

        console.log(`Total rows for ${indexName}: ${rowCount}`);

        const promises = [];

        for (let i = 0; i < Math.ceil(rowCount / pageSize); i++) {
            const offset = pageSize * i;
            const rows = await con.query(`SELECT * FROM ${indexName === 'sites' ? 'site' : 'site_data' : 'site_img' : 'site_videos'} LIMIT ${offset}, ${pageSize}`);
            
            console.log(`Retrieved ${rows.length} rows for ${indexName}, offset: ${offset}, pageSize: ${pageSize}`);

            if (rows.length > 0) {
                promises.push(processData(indexName, rows, idField));
                console.log(`Indexing started: ${indexName}, ${i * pageSize}`);
            } else {
                console.log(`No rows to process for ${indexName}, ${i * pageSize}`);
            }
        }

        await Promise.all(promises);

        console.log(`Indexing done for ${indexName}`);
    } catch (error) {
        console.error(`Error indexing data for ${indexName}:`, error);
    }
}

async function runAutoSync() {
    while (true) {
        const sitePromise = indexData('site', 'SELECT COUNT(*) as c FROM site', processAndIndexData, 'site_id');        
        const sitedataPromise = indexData('sitedata', 'SELECT COUNT(*) as c FROM site_data', processAndIndexData, 'site_data_id');
        const imagePromise = indexData('images', 'SELECT COUNT(*) as c FROM site_img', processAndIndexData, 'site_img_id');
        const videosPromise = indexData('videos', 'SELECT COUNT(*) as c FROM site_videos', processAndIndexData, 'site_videos_id');

        await Promise.all([sitePromise, sitedataPromise, imagePromise, videosPromise]);

        await sleep(10000);
    }
}

runAutoSync();
