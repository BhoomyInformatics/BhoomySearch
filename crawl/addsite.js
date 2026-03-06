const { db } = require('./config/db');
const logger = require('./utils/logger');
const fs = require('fs');
const os = require('os');
require('dotenv').config();

const config = {
  sourceFile: 'addurls.txt',
  batchSize: 5000,
  maxConcurrentBatches: Math.max(1, os.cpus().length - 1),
  logToFile: true,
  logFile: 'addsite_log.txt'
};

function generateSiteTitle(url) {
  let domain;
  try {
    const parsedUrl = new URL(url);
    domain = parsedUrl.hostname.replace('www.', '');
    url = parsedUrl.protocol ? url : 'https://' + domain;
  } catch (error) {
    domain = url.replace('www.', '');
    url = 'https://' + url;
  }
  return { domain, url };
}

async function processBatch(batch, batchIndex) {
  try {
    logger.info(`Processing batch #${batchIndex} with ${batch.length} URLs`);
    let insertedCount = 0;
    let duplicateCount = 0;
    
    for (const url of batch) {
      const { domain, url: modifiedUrl } = generateSiteTitle(url);
      
      try {
        const checkDuplicateQuery = 'SELECT COUNT(*) AS count FROM sites WHERE site_url = ?';
        const duplicateResult = await db.query(checkDuplicateQuery, [modifiedUrl]);
        
        if (duplicateResult[0].count > 0) {
          duplicateCount++;
          continue;
        }
        
        const insertQuery = `INSERT INTO sites (
          site_title, 
          site_url, 
          site_active, 
          site_locked, 
          site_priority,
          site_crawl_frequency,
          site_last_crawl_date
        ) VALUES (?, ?, 1, 0, 5, 'daily', NOW())`;
        
        await db.query(insertQuery, [domain, modifiedUrl]);
        insertedCount++;
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
          duplicateCount++;
        } else {
          logger.error(`Error processing URL ${modifiedUrl}: ${error.message}`);
        }
      }
    }
    
    logger.info(`Batch #${batchIndex}: Inserted ${insertedCount} URLs, ${duplicateCount} duplicates skipped`);
    return { inserted: insertedCount, duplicates: duplicateCount };
  } catch (error) {
    logger.error(`Failed to process batch #${batchIndex}`, error);
    return { inserted: 0, duplicates: 0 };
  }
}

async function readUrlsFromFile(filePath) {
  try {
    logger.info(`Reading URLs from ${filePath}`);
    const data = await fs.promises.readFile(filePath, 'utf8');
    const urls = data.split('\n')
      .map(url => url.trim())
      .filter(url => url && url.includes('.'));
    
    logger.info(`Read ${urls.length} URLs from file`);
    return urls;
  } catch (error) {
    logger.error(`Failed to read URLs from ${filePath}`, error);
    throw error;
  }
}

function splitIntoBatches(urls, batchSize) {
  const batches = [];
  for (let i = 0; i < urls.length; i += batchSize) {
    batches.push(urls.slice(i, i + batchSize));
  }
  logger.info(`Split URLs into ${batches.length} batches of up to ${batchSize} URLs each`);
  return batches;
}

async function processBatchesInParallel(batches, maxConcurrent) {
  let completed = 0;
  let totalInserted = 0;
  let totalDuplicates = 0;
  let currentIndex = 0;
  
  async function runBatch() {
    const batchIndex = currentIndex++;
    if (batchIndex >= batches.length) return;
    
    const result = await processBatch(batches[batchIndex], batchIndex + 1);
    totalInserted += result.inserted;
    totalDuplicates += result.duplicates;
    completed++;
    
    const percentComplete = ((completed / batches.length) * 100).toFixed(2);
    logger.info(`Progress: ${completed}/${batches.length} batches (${percentComplete}%), ${totalInserted} URLs inserted so far`);
    
    return runBatch();
  }
  
  const concurrentPromises = [];
  for (let i = 0; i < Math.min(maxConcurrent, batches.length); i++) {
    concurrentPromises.push(runBatch());
  }
  
  await Promise.all(concurrentPromises);
  return { inserted: totalInserted, duplicates: totalDuplicates };
}

async function main() {
  const startTime = Date.now();
  
  try {
    if (config.logToFile) {
      fs.writeFileSync(config.logFile, `=== AddSite Log Started at ${new Date().toISOString()} ===\n`);
    }
    
    logger.info('Starting URL processing');
    
    const connectionTest = await db.testConnection();
    if (!connectionTest) {
      logger.error('Database connection test failed');
      process.exit(1);
    }
    logger.info('Database initialized successfully');
    
    const urls = await readUrlsFromFile(config.sourceFile);
    
    if (urls.length === 0) {
      logger.info('No URLs found in file. Exiting.');
      return;
    }
    
    const batches = splitIntoBatches(urls, config.batchSize);
    const result = await processBatchesInParallel(batches, config.maxConcurrentBatches);
    
    const duration = (Date.now() - startTime) / 1000;
    const rate = result.inserted / duration;
    
    logger.info(`=============== SUMMARY ===============`);
    logger.info(`Total URLs processed: ${urls.length}`);
    logger.info(`Total URLs inserted: ${result.inserted}`);
    logger.info(`Duplicates skipped: ${result.duplicates}`);
    logger.info(`Time taken: ${duration.toFixed(2)} seconds`);
    logger.info(`Average rate: ${rate.toFixed(2)} URLs/second`);
    logger.info(`=======================================`);
    
  } catch (error) {
    logger.error('Fatal error', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

main().catch(error => {
  logger.error('Unhandled error:', error);
  process.exit(1);
});
