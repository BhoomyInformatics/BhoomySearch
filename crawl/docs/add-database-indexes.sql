-- ==============================================================
-- Database Index Optimization for Search Engine Crawler
-- ==============================================================
-- Purpose: Fix database query timeouts and improve crawler performance
-- Created: 2025-10-04
-- Issue: Database queries timing out when checking for duplicate URLs
-- Solution: Add proper indexes to speed up queries
-- ==============================================================

USE mybhoomy_mytest;

-- Check if indexes exist before creating them
-- This prevents errors if indexes already exist

-- ==============================================================
-- 1. Index for site_data_site_id (Most Critical)
-- ==============================================================
-- This index speeds up queries that filter by site ID
-- Used by: duplicateChecker.js, indexer.js
-- Impact: Reduces query time from 15+ seconds to <1 second

SELECT 'Checking for idx_site_data_site_id index...' AS Info;

SET @index_exists = (
    SELECT COUNT(*) 
    FROM information_schema.STATISTICS 
    WHERE table_schema = DATABASE() 
    AND table_name = 'site_data' 
    AND index_name = 'idx_site_data_site_id'
);

SET @sql_create_site_id_index = IF(
    @index_exists = 0,
    'CREATE INDEX idx_site_data_site_id ON site_data(site_data_site_id)',
    'SELECT "Index idx_site_data_site_id already exists" AS Info'
);

PREPARE stmt FROM @sql_create_site_id_index;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ==============================================================
-- 2. Index for site_data_url_hash (Critical for Duplicate Detection)
-- ==============================================================
-- This index speeds up duplicate URL checking
-- Used by: duplicateChecker.js checkUrlInDatabase()
-- Impact: Instant duplicate detection

SELECT 'Checking for idx_site_data_url_hash index...' AS Info;

SET @index_exists = (
    SELECT COUNT(*) 
    FROM information_schema.STATISTICS 
    WHERE table_schema = DATABASE() 
    AND table_name = 'site_data' 
    AND index_name = 'idx_site_data_url_hash'
);

SET @sql_create_url_hash_index = IF(
    @index_exists = 0,
    'CREATE INDEX idx_site_data_url_hash ON site_data(site_data_url_hash)',
    'SELECT "Index idx_site_data_url_hash already exists" AS Info'
);

PREPARE stmt FROM @sql_create_url_hash_index;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ==============================================================
-- 3. Composite Index for site_id + url_hash (Optimal for Lookups)
-- ==============================================================
-- This composite index is perfect for site-specific duplicate checks
-- Used by: duplicateChecker.js with both siteId and urlHash
-- Impact: Fastest possible duplicate detection per site

SELECT 'Checking for idx_site_url_hash composite index...' AS Info;

SET @index_exists = (
    SELECT COUNT(*) 
    FROM information_schema.STATISTICS 
    WHERE table_schema = DATABASE() 
    AND table_name = 'site_data' 
    AND index_name = 'idx_site_url_hash'
);

SET @sql_create_composite_index = IF(
    @index_exists = 0,
    'CREATE INDEX idx_site_url_hash ON site_data(site_data_site_id, site_data_url_hash)',
    'SELECT "Index idx_site_url_hash already exists" AS Info'
);

PREPARE stmt FROM @sql_create_composite_index;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ==============================================================
-- 4. Index for crawl_date (Optional but Recommended)
-- ==============================================================
-- This index speeds up queries that filter by date
-- Used by: Statistics queries and date-range filters
-- Impact: Faster date-based queries (currently disabled but useful)

SELECT 'Checking for idx_crawl_date index...' AS Info;

SET @index_exists = (
    SELECT COUNT(*) 
    FROM information_schema.STATISTICS 
    WHERE table_schema = DATABASE() 
    AND table_name = 'site_data' 
    AND index_name = 'idx_crawl_date'
);

SET @sql_create_date_index = IF(
    @index_exists = 0,
    'CREATE INDEX idx_crawl_date ON site_data(crawl_date)',
    'SELECT "Index idx_crawl_date already exists" AS Info'
);

PREPARE stmt FROM @sql_create_date_index;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ==============================================================
-- 5. Show all indexes on site_data table
-- ==============================================================

SELECT 'Current indexes on site_data table:' AS Info;

SELECT 
    INDEX_NAME,
    COLUMN_NAME,
    SEQ_IN_INDEX,
    CARDINALITY,
    INDEX_TYPE
FROM information_schema.STATISTICS
WHERE table_schema = DATABASE()
AND table_name = 'site_data'
ORDER BY INDEX_NAME, SEQ_IN_INDEX;

-- ==============================================================
-- 6. Analyze table to update statistics (Important!)
-- ==============================================================
-- This updates MySQL's query optimizer statistics
-- Should be run after creating indexes

SELECT 'Analyzing site_data table to update query optimizer statistics...' AS Info;
ANALYZE TABLE site_data;

-- ==============================================================
-- 7. Show table statistics
-- ==============================================================

SELECT 'Table statistics:' AS Info;

SELECT 
    table_name,
    table_rows,
    data_length,
    index_length,
    ROUND(data_length / 1024 / 1024, 2) AS data_mb,
    ROUND(index_length / 1024 / 1024, 2) AS index_mb
FROM information_schema.TABLES
WHERE table_schema = DATABASE()
AND table_name = 'site_data';

-- ==============================================================
-- DONE!
-- ==============================================================

SELECT '✓ Database index optimization complete!' AS Success;
SELECT 'Next steps:' AS Info;
SELECT '1. Restart your crawler' AS Step1;
SELECT '2. Monitor logs/debug.log for improved performance' AS Step2;
SELECT '3. Queries should now complete in <1 second instead of timing out' AS Step3;

