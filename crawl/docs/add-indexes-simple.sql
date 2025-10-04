-- ============================================================================
-- Simple Database Index Script (No Special Permissions Required)
-- ============================================================================
-- For user: mybhoomy
-- Database: mybhoomy_mytest
-- ============================================================================

USE mybhoomy_mytest;

-- Add index for site_data_site_id (speeds up site-specific queries)
ALTER TABLE site_data ADD INDEX idx_site_data_site_id (site_data_site_id);

-- Add index for site_data_url_hash (speeds up duplicate detection)
ALTER TABLE site_data ADD INDEX idx_site_data_url_hash (site_data_url_hash);

-- Add composite index for site_id + url_hash (optimal for lookups)
ALTER TABLE site_data ADD INDEX idx_site_url_hash (site_data_site_id, site_data_url_hash);

-- Add index for crawl_date (speeds up date-based queries)
ALTER TABLE site_data ADD INDEX idx_crawl_date (crawl_date);

-- Show created indexes
SHOW INDEX FROM site_data;

SELECT '✓ Indexes created successfully!' AS Status;

