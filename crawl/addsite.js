const mysql = require('mysql2/promise');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

// Configuration - MODIFY THESE VALUES
const config = {
  sourceFile: 'addurls.txt',
  batchSize: 2000,
  // Adjust based on your system capabilities (CPU cores - 1 is a good starting point)
  maxConcurrentBatches: Math.max(1, os.cpus().length - 1),
  
  // Database connection settings
  db: {
    host: 'localhost',
    user: 'mybhoomy_admin',
    password: 'mhQjj.%C-_LO_U4',
    database: 'mybhoomy_mysearch',
    port: 3306,
    connectionLimit: 50, // Connection pool size
    acquireTimeout: 60000,
    timeout: 60000
  },
  
  // Output settings
  logToFile: true,
  logFile: 'addsite_log.txt'
};

// Initialize logger
const logger = {
  log: function(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    
    if (config.logToFile) {
      fs.appendFileSync(config.logFile, logMessage + '\n');
    }
  },
  error: function(message, error) {
    const timestamp = new Date().toISOString();
    const errorMessage = `[${timestamp}] ERROR: ${message} - ${error.message || error}`;
    console.error(errorMessage);
    
    if (config.logToFile) {
      fs.appendFileSync(config.logFile, errorMessage + '\n');
    }
  }
};

// Create a database connection pool
const pool = mysql.createPool(config.db);

/**
 * Initialize the database tables if they don't exist
 */
async function initDatabase() {
  try {
    // Check if sites table exists with new schema, if not create it
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS sites (
        site_id int(11) NOT NULL AUTO_INCREMENT,
        site_title varchar(500) NOT NULL,
        site_url varchar(2048) NOT NULL,
        site_description text DEFAULT NULL,
        site_keywords text DEFAULT NULL,
        site_category varchar(100) DEFAULT NULL,
        site_language varchar(10) DEFAULT 'en',
        site_country varchar(10) DEFAULT NULL,
        site_active tinyint(1) DEFAULT 1,
        site_locked tinyint(1) DEFAULT 0,
        site_priority int(11) DEFAULT 5 COMMENT 'Priority level 1-10 (1=highest)',
        site_crawl_frequency enum('hourly','daily','weekly','monthly') DEFAULT 'daily',
        site_last_crawl_date timestamp NULL DEFAULT NULL,
        site_next_crawl_date timestamp NULL DEFAULT NULL,
        site_created timestamp NOT NULL DEFAULT current_timestamp(),
        site_updated timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        site_user_id int(11) DEFAULT NULL,
        robots_txt_url varchar(2048) DEFAULT NULL COMMENT 'Robots.txt URL',
        robots_txt_content text DEFAULT NULL COMMENT 'Cached robots.txt content',
        crawl_delay int(11) DEFAULT 1000 COMMENT 'Delay between requests in milliseconds',
        max_depth int(11) DEFAULT 5 COMMENT 'Maximum crawl depth',
        max_pages int(11) DEFAULT 1000 COMMENT 'Maximum pages to crawl',
        user_agent varchar(500) DEFAULT NULL COMMENT 'Custom user agent for this site',
        last_robots_check timestamp NULL DEFAULT NULL COMMENT 'Last time robots.txt was checked',
        crawl_settings json DEFAULT NULL COMMENT 'Additional crawl configuration',
        total_pages_crawled int(11) DEFAULT 0,
        successful_crawls int(11) DEFAULT 0,
        failed_crawls int(11) DEFAULT 0,
        last_error text DEFAULT NULL,
        PRIMARY KEY (site_id),
        UNIQUE KEY unique_site_url (site_url(255)),
        KEY idx_site_active (site_active),
        KEY idx_site_locked (site_locked),
        KEY idx_site_priority (site_priority),
        KEY idx_site_category (site_category),
        KEY idx_site_language (site_language),
        KEY idx_last_crawl (site_last_crawl_date),
        KEY idx_next_crawl (site_next_crawl_date),
        KEY idx_crawl_frequency (site_crawl_frequency),
        KEY idx_active_sites (site_active, site_locked),
        KEY idx_site_user (site_user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Sites registry and configuration'
    `);
    
    logger.log('Database initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize database', error);
    throw error;
  }
}

/**
 * Read URLs from file and return as array
 */
async function readUrlsFromFile(filePath) {
  try {
    logger.log(`Reading URLs from ${filePath}`);
    const data = await fs.promises.readFile(filePath, 'utf8');
    const urls = data.split('\n')
      .map(url => url.trim())
      .filter(url => url && url.includes('.'));
    
    logger.log(`Read ${urls.length} URLs from file`);
    return urls;
  } catch (error) {
    logger.error(`Failed to read URLs from ${filePath}`, error);
    throw error;
  }
}

/**
 * Split URLs into batches
 */
function splitIntoBatches(urls, batchSize) {
  const batches = [];
  for (let i = 0; i < urls.length; i += batchSize) {
    batches.push(urls.slice(i, i + batchSize));
  }
  logger.log(`Split URLs into ${batches.length} batches of up to ${batchSize} URLs each`);
  return batches;
}

/**
 * Generate site Title from URL and normalize URL
 */
function generateSiteInfo(url) {
  let domain, normalizedUrl, title;
  
  try {
    // Add protocol if missing
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    const parsedUrl = new URL(url);
    domain = parsedUrl.hostname.replace('www.', ''); // Remove 'www.' prefix if present
    normalizedUrl = parsedUrl.href;
    
    // Generate a nice title from domain
    title = domain.split('.')[0];
    title = title.charAt(0).toUpperCase() + title.slice(1);
    
  } catch (error) {
    // If URL parsing fails, assume it's a domain without a scheme
    domain = url.replace('www.', '').replace(/^https?:\/\//, '');
    normalizedUrl = 'https://' + domain;
    title = domain.split('.')[0];
    title = title.charAt(0).toUpperCase() + title.slice(1);
  }
  
  return { domain, url: normalizedUrl, title };
}

/**
 * Process a batch of URLs (check for duplicates and insert)
 */
async function processBatch(batch, batchIndex) {
  let connection;
  try {
    connection = await pool.getConnection();
    logger.log(`Processing batch #${batchIndex} with ${batch.length} URLs`);
    let insertedCount = 0;
    
    for (const url of batch) {
      const { domain, url: normalizedUrl, title } = generateSiteInfo(url);
      
      // Check for duplicate entry by URL
      const [duplicateResult] = await connection.execute(
        'SELECT COUNT(*) AS count FROM sites WHERE site_url = ?', 
        [normalizedUrl]
      );
      
      if (duplicateResult[0].count > 0) {
        logger.log(`Duplicate entry. URL not inserted: ${normalizedUrl}`);
        continue;
      }
      
      // Calculate next crawl date (24 hours from now for daily frequency)
      const nextCrawlDate = new Date();
      nextCrawlDate.setHours(nextCrawlDate.getHours() + 24);
      
      // Insert URL into the database with new schema
      const insertQuery = `
        INSERT INTO sites (
          site_title, 
          site_url, 
          site_description,
          site_category,
          site_language,
          site_active,
          site_locked,
          site_priority,
          site_crawl_frequency,
          site_next_crawl_date,
          crawl_delay,
          max_depth,
          max_pages,
          user_agent
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const values = [
        title,                                    // site_title
        normalizedUrl,                           // site_url
        `${domain}`,                    // site_description
        'general',                               // site_category
        'en',                                    // site_language
        1,                                       // site_active
        0,                                       // site_locked
        5,                                       // site_priority (medium)
        'daily',                                 // site_crawl_frequency
        nextCrawlDate,                          // site_next_crawl_date
        1000,                                   // crawl_delay (1 second)
        5,                                      // max_depth
        1000,                                   // max_pages
        'SearchEngine Bhoomy Bot 1.0'          // user_agent
      ];
      
      await connection.execute(insertQuery, values);
      insertedCount++;
      logger.log(`URL inserted successfully: ${title} (${normalizedUrl})`);
    }
    
    logger.log(`Batch #${batchIndex}: Successfully inserted ${insertedCount} URLs`);
    return insertedCount;
  } catch (error) {
    logger.error(`Failed to process batch #${batchIndex}`, error);
    // Continue with other batches even if one fails
    return 0;
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

/**
 * Process batches with concurrency control
 */
async function processBatchesInParallel(batches, maxConcurrent) {
  let completed = 0;
  let totalInserted = 0;
  let currentIndex = 0;
  
  async function runBatch() {
    const batchIndex = currentIndex++;
    if (batchIndex >= batches.length) return;
    
    const inserted = await processBatch(batches[batchIndex], batchIndex + 1);
    totalInserted += inserted;
    completed++;
    
    // Update progress
    const percentComplete = ((completed / batches.length) * 100).toFixed(2);
    logger.log(`Progress: ${completed}/${batches.length} batches (${percentComplete}%), ${totalInserted} URLs inserted so far`);
    
    // Process next batch
    return runBatch();
  }
  
  // Start multiple batches in parallel
  const concurrentPromises = [];
  for (let i = 0; i < Math.min(maxConcurrent, batches.length); i++) {
    concurrentPromises.push(runBatch());
  }
  
  // Wait for all batches to complete
  await Promise.all(concurrentPromises);
  return totalInserted;
}

/**
 * Main function
 */
async function main() {
  const startTime = Date.now();
  
  try {
    // Initialize log file
    if (config.logToFile) {
      fs.writeFileSync(config.logFile, `=== AddSite Log Started at ${new Date().toISOString()} ===\n`);
    }
    
    logger.log('Starting URL processing');
    
    // Initialize database
    await initDatabase();
    
    // Read URLs from file
    const urls = await readUrlsFromFile(config.sourceFile);
    
    if (urls.length === 0) {
      logger.log('No URLs found in file. Exiting.');
      return;
    }
    
    // Split into batches
    const batches = splitIntoBatches(urls, config.batchSize);
    
    // Process batches in parallel
    logger.log(`Starting parallel processing with max ${config.maxConcurrentBatches} concurrent batches`);
    const totalInserted = await processBatchesInParallel(batches, config.maxConcurrentBatches);
    
    // Calculate stats
    const duration = (Date.now() - startTime) / 1000;
    const rate = totalInserted / duration;
    
    logger.log(`=============== SUMMARY ===============`);
    logger.log(`Total URLs processed: ${urls.length}`);
    logger.log(`Total URLs inserted: ${totalInserted}`);
    logger.log(`Duplicates skipped: ${urls.length - totalInserted}`);
    logger.log(`Time taken: ${duration.toFixed(2)} seconds`);
    logger.log(`Average rate: ${rate.toFixed(2)} URLs/second`);
    logger.log(`=======================================`);
    
  } catch (error) {
    logger.error('Fatal error', error);
  } finally {
    // Close the connection pool
    await pool.end();
  }
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
