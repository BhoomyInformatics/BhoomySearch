-- ============================================================================
-- Check Database Status and Data
-- ============================================================================
-- This will help understand what data is already in the database
-- ============================================================================

USE mybhoomy_mytest;

-- 1. Check total records in site_data table
SELECT 'Total Records in site_data:' AS Info;
SELECT COUNT(*) AS total_records FROM site_data;

-- 2. Check records for deccanchronicle.com (site_id = 22)
SELECT 'Records for Deccan Chronicle (site_id=22):' AS Info;
SELECT COUNT(*) AS deccan_records FROM site_data WHERE site_data_site_id = 22;

-- 3. Check recent records (last 10)
SELECT 'Last 10 records inserted:' AS Info;
SELECT 
    site_data_id,
    site_data_site_id,
    LEFT(site_data_title, 50) AS title,
    LEFT(site_data_link, 80) AS url,
    crawl_date
FROM site_data
ORDER BY site_data_id DESC
LIMIT 10;

-- 4. Check if indexes exist
SELECT 'Current indexes on site_data:' AS Info;
SHOW INDEX FROM site_data;

-- 5. Check duplicate URLs
SELECT 'Duplicate URL hashes (if any):' AS Info;
SELECT 
    site_data_url_hash,
    COUNT(*) AS count
FROM site_data
WHERE site_data_url_hash IS NOT NULL
GROUP BY site_data_url_hash
HAVING COUNT(*) > 1
LIMIT 10;

-- 6. Site statistics
SELECT 'Site Statistics:' AS Info;
SELECT 
    s.site_id,
    s.site_url,
    COUNT(sd.site_data_id) AS total_pages,
    MAX(sd.crawl_date) AS last_crawl
FROM sites s
LEFT JOIN site_data sd ON s.site_id = sd.site_data_site_id
WHERE s.site_url LIKE '%deccanchronicle%'
GROUP BY s.site_id, s.site_url;

