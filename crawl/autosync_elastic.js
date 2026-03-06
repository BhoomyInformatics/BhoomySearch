const { db } = require('./config/db');
const { Client } = require('@elastic/elasticsearch');
const logger = require('./utils/logger');
require('dotenv').config();

const client = new Client({
    node: process.env.ELASTICSEARCH_HOST || 'http://localhost:9200',
    auth: process.env.ELASTICSEARCH_USER && process.env.ELASTICSEARCH_PASSWORD ? {
        username: process.env.ELASTICSEARCH_USER,
        password: process.env.ELASTICSEARCH_PASSWORD
    } : undefined
});

const pageSize = 10000;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function processAndIndexData(indexName, rows, idField) {
    const bulkData = [];

    for (const row of rows) {
        const documentId = row[idField];
        bulkData.push({ index: { _index: indexName, _id: documentId.toString() } });
        const rowCopy = { ...row };
        delete rowCopy[idField];
        bulkData.push(rowCopy);
    }

    if (bulkData.length > 0) {
        try {
            const bulkResponse = await client.bulk({
                body: bulkData,
                refresh: 'wait_for'
            });

            if (bulkResponse.errors) {
                logger.error(`Bulk indexing errors for ${indexName}:`, bulkResponse.items.filter(item => item.index?.error));
            } else {
                logger.info(`Successfully indexed ${bulkData.length / 2} documents to ${indexName}`);
            }
        } catch (error) {
            logger.error(`Error indexing data for ${indexName}: ${error.message}`);
        }
    }
}

async function indexData(indexName, countQuery, idField, tableName) {
    try {
        const rowCountResult = await db.query(countQuery);
        const rowCount = rowCountResult[0]?.c || 0;

        logger.info(`Total rows for ${indexName}: ${rowCount}`);

        for (let i = 0; i < Math.ceil(rowCount / pageSize); i++) {
            const offset = pageSize * i;
            const rows = await db.query(`SELECT * FROM ${tableName} LIMIT ? OFFSET ?`, [pageSize, offset]);
            
            logger.info(`Retrieved ${rows.length} rows for ${indexName}, offset: ${offset}`);

            if (rows.length > 0) {
                logger.info(`Indexing started: ${indexName}, ${i * pageSize}`);
                await processAndIndexData(indexName, rows, idField);
                logger.info(`Indexing completed: ${indexName}, ${i * pageSize}`);
            } else {
                logger.info(`No rows to process for ${indexName}, ${i * pageSize}`);
            }
        }

        logger.info(`Indexing done for ${indexName}`);
    } catch (error) {
        logger.error(`Error indexing data for ${indexName}: ${error.message}`);
    }
}

async function runAutoSync() {
    while (true) {
        const sitedataPromise = indexData('sitedata', 'SELECT COUNT(*) as c FROM site_data', 'site_data_id', 'site_data');
        const siteimagePromise = indexData('siteimage', 'SELECT COUNT(*) as c FROM site_img', 'site_img_id', 'site_img');
        const siteimagePromise = indexData('sitedoc', 'SELECT COUNT(*) as c FROM site_doc', 'site_doc_id', 'site_doc');
        const sitevideoPromise = indexData('sitevideo', 'SELECT COUNT(*) as c FROM site_videos', 'site_videos_id', 'site_videos');

        await Promise.all([sitedataPromise, siteimagePromise, sitevideoPromise]);

        await sleep(20000);
    }
}

runAutoSync().catch(error => {
    logger.error(`Fatal error in autosync: ${error.message}`);
    process.exit(1);
});
