-- ============================================================================
-- PRODUCTION DEADLOCK FIX - Run on mybhoomy_mysearch Database
-- ============================================================================
-- Database: mybhoomy_mysearch (80GB Production)
-- Issue: Lock wait timeout & Deadlocks during concurrent INSERT operations
-- ============================================================================

USE mybhoomy_mysearch;

-- ============================================================================
-- STEP 1: Check Current Indexes (Diagnostic)
-- ============================================================================

SELECT 'Current indexes on site_data table:' AS Info;
SHOW INDEX FROM site_data;

-- ============================================================================
-- STEP 2: Add Indexes if Missing (Critical for Performance)
-- ============================================================================

-- Check and add site_data_site_id index
SET @index_exists = (
    SELECT COUNT(*) 
    FROM information_schema.STATISTICS 
    WHERE table_schema = DATABASE() 
    AND table_name = 'site_data' 
    AND index_name = 'idx_site_data_site_id'
);

SET @sql_add_site_id = IF(
    @index_exists = 0,
    'ALTER TABLE site_data ADD INDEX idx_site_data_site_id (site_data_site_id)',
    'SELECT "Index idx_site_data_site_id already exists" AS Status'
);

PREPARE stmt FROM @sql_add_site_id;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add site_data_url_hash index
SET @index_exists = (
    SELECT COUNT(*) 
    FROM information_schema.STATISTICS 
    WHERE table_schema = DATABASE() 
    AND table_name = 'site_data' 
    AND index_name = 'idx_site_data_url_hash'
);

SET @sql_add_url_hash = IF(
    @index_exists = 0,
    'ALTER TABLE site_data ADD INDEX idx_site_data_url_hash (site_data_url_hash)',
    'SELECT "Index idx_site_data_url_hash already exists" AS Status'
);

PREPARE stmt FROM @sql_add_url_hash;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add composite index for site_id + url_hash (Critical!)
SET @index_exists = (
    SELECT COUNT(*) 
    FROM information_schema.STATISTICS 
    WHERE table_schema = DATABASE() 
    AND table_name = 'site_data' 
    AND index_name = 'idx_site_url_hash'
);

SET @sql_add_composite = IF(
    @index_exists = 0,
    'ALTER TABLE site_data ADD INDEX idx_site_url_hash (site_data_site_id, site_data_url_hash)',
    'SELECT "Index idx_site_url_hash already exists" AS Status'
);

PREPARE stmt FROM @sql_add_composite;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================================
-- STEP 3: Add UNIQUE Constraint to Prevent Duplicate URL Inserts (Critical!)
-- ============================================================================

-- This prevents two crawler instances from inserting the same URL
-- Check if unique constraint exists
SET @unique_exists = (
    SELECT COUNT(*) 
    FROM information_schema.STATISTICS 
    WHERE table_schema = DATABASE() 
    AND table_name = 'site_data' 
    AND index_name = 'unique_site_url_hash'
);

-- Add unique constraint if it doesn't exist
SET @sql_add_unique = IF(
    @unique_exists = 0,
    'ALTER TABLE site_data ADD UNIQUE KEY unique_site_url_hash (site_data_site_id, site_data_url_hash)',
    'SELECT "Unique constraint unique_site_url_hash already exists" AS Status'
);

PREPARE stmt FROM @sql_add_unique;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================================
-- STEP 4: Check for Existing Duplicates (Before Adding Unique Constraint)
-- ============================================================================

SELECT 'Checking for duplicate URL hashes:' AS Info;

SELECT 
    site_data_site_id,
    site_data_url_hash,
    COUNT(*) as duplicate_count,
    GROUP_CONCAT(site_data_id ORDER BY site_data_id LIMIT 5) as record_ids
FROM site_data
WHERE site_data_url_hash IS NOT NULL
GROUP BY site_data_site_id, site_data_url_hash
HAVING COUNT(*) > 1
LIMIT 20;

-- ============================================================================
-- STEP 5: Show Current InnoDB Status (Deadlock Information)
-- ============================================================================

SELECT 'Current InnoDB lock waits:' AS Info;

SHOW ENGINE INNODB STATUS\G

-- ============================================================================
-- STEP 6: Check Current Sessions and Locks
-- ============================================================================

SELECT 'Active database connections:' AS Info;

SELECT 
    COUNT(*) as total_connections,
    SUM(CASE WHEN Command != 'Sleep' THEN 1 ELSE 0 END) as active_queries
FROM information_schema.PROCESSLIST;

-- Show long-running queries that might be holding locks
SELECT 'Long-running queries (potential lock holders):' AS Info;

SELECT 
    ID,
    USER,
    HOST,
    DB,
    COMMAND,
    TIME as seconds,
    STATE,
    LEFT(INFO, 100) as query_preview
FROM information_schema.PROCESSLIST
WHERE COMMAND != 'Sleep' 
AND TIME > 10
ORDER BY TIME DESC;

-- ============================================================================
-- STEP 7: Optimize Table (Run during low-traffic period)
-- ============================================================================

-- WARNING: This can take a long time on an 80GB table!
-- Only run during maintenance window
-- OPTIMIZE TABLE site_data;

SELECT 'Optimization skipped - run manually during maintenance window' AS Note;

-- ============================================================================
-- DONE - Summary
-- ============================================================================

SELECT '✓ Deadlock fix SQL completed!' AS Status;
SELECT 'Next Steps:' AS Info;
SELECT '1. Apply code changes to use INSERT IGNORE' AS Step1;
SELECT '2. Reduce concurrent connections' AS Step2;
SELECT '3. Monitor for deadlocks' AS Step3;
SELECT '4. Consider partitioning the 80GB table' AS Step4;

