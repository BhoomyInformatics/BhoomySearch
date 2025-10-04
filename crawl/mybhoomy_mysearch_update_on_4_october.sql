-- phpMyAdmin SQL Dump
-- version 5.1.1
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Oct 04, 2025 at 08:19 AM
-- Server version: 10.3.39-MariaDB
-- PHP Version: 7.2.30

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `mybhoomy_mysearch`
--

-- --------------------------------------------------------

--
-- Stand-in structure for view `active_sites`
-- (See below for the actual view)
--
CREATE TABLE `active_sites` (
`site_id` int(11)
,`site_title` varchar(500)
,`site_url` text
,`site_description` text
,`site_keywords` text
,`site_category` varchar(100)
,`site_language` varchar(10)
,`site_country` varchar(10)
,`site_active` tinyint(1)
,`site_locked` tinyint(1)
,`site_priority` int(11)
,`site_crawl_frequency` enum('hourly','daily','weekly','monthly')
,`site_last_crawl_date` timestamp
,`site_next_crawl_date` timestamp
,`site_created` timestamp
,`site_updated` timestamp
,`site_user_id` int(11)
,`robots_txt_url` varchar(2048)
,`robots_txt_content` text
,`crawl_delay` int(11)
,`max_depth` int(11)
,`max_pages` int(11)
,`user_agent` varchar(500)
,`last_robots_check` timestamp
,`crawl_settings` longtext
,`total_pages_crawled` int(11)
,`successful_crawls` int(11)
,`failed_crawls` int(11)
,`last_error` text
,`total_pages` bigint(21)
,`last_page_crawled` timestamp
,`success_rate` decimal(4,4)
,`indexed_pages` decimal(22,0)
,`failed_pages` decimal(22,0)
);

-- --------------------------------------------------------

--
-- Table structure for table `groups`
--

CREATE TABLE `groups` (
  `group_id` int(11) NOT NULL,
  `group_name` varchar(100) NOT NULL,
  `group_description` text DEFAULT NULL,
  `group_permissions` text DEFAULT NULL,
  `group_created` timestamp NOT NULL DEFAULT current_timestamp(),
  `group_active` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `login_attempts`
--

CREATE TABLE `login_attempts` (
  `id` int(11) NOT NULL,
  `identifier` varchar(255) NOT NULL,
  `ip_address` varchar(45) NOT NULL,
  `user_agent` text DEFAULT NULL,
  `success` tinyint(1) NOT NULL,
  `reason` varchar(100) DEFAULT NULL,
  `attempt_time` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `rate_limit_config`
--

CREATE TABLE `rate_limit_config` (
  `id` int(11) NOT NULL,
  `config_name` varchar(100) NOT NULL,
  `strategy_type` enum('ip','session','user','api_key','composite') NOT NULL,
  `window_ms` int(11) NOT NULL DEFAULT 60000,
  `max_requests` int(11) NOT NULL DEFAULT 100,
  `enabled` tinyint(1) DEFAULT 1,
  `endpoints` text DEFAULT NULL,
  `exclusions` text DEFAULT NULL,
  `priority` int(11) DEFAULT 100,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `block_duration_ms` int(11) DEFAULT 300000 COMMENT 'Block duration in milliseconds (default: 5 minutes)',
  `warning_threshold` int(11) DEFAULT 80 COMMENT 'Warning threshold percentage before blocking'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `rate_limit_violations`
--

CREATE TABLE `rate_limit_violations` (
  `id` int(11) NOT NULL,
  `type` enum('ip','session','user','api_key','fingerprint','composite') NOT NULL,
  `ip` varchar(45) NOT NULL,
  `fingerprint` varchar(32) DEFAULT NULL,
  `confidence` decimal(3,2) DEFAULT NULL,
  `is_suspicious` tinyint(1) DEFAULT 0,
  `user_id` int(11) DEFAULT NULL,
  `api_key_hash` varchar(64) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `path` varchar(500) NOT NULL,
  `method` varchar(10) NOT NULL,
  `violation_time` timestamp NOT NULL DEFAULT current_timestamp(),
  `window_ms` int(11) DEFAULT NULL,
  `rate_limit` int(11) DEFAULT NULL,
  `blocked_duration` int(11) DEFAULT NULL,
  `geo_country` varchar(2) DEFAULT NULL,
  `geo_city` varchar(100) DEFAULT NULL,
  `threat_score` decimal(3,2) DEFAULT NULL,
  `resolution_status` enum('pending','investigated','false_positive','confirmed_threat','auto_resolved') DEFAULT 'pending',
  `notes` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Stand-in structure for view `recent_crawl_activity`
-- (See below for the actual view)
--
CREATE TABLE `recent_crawl_activity` (
`site_data_id` int(11)
,`site_data_site_id` int(11)
,`site_title` varchar(500)
,`site_data_link` text
,`site_data_title` varchar(500)
,`status` varchar(50)
,`crawl_date` timestamp
,`content_length` int(11)
,`word_count` int(11)
,`response_code` int(11)
);

-- --------------------------------------------------------

--
-- Table structure for table `search_queries`
--

CREATE TABLE `search_queries` (
  `id` int(11) NOT NULL,
  `query` varchar(500) NOT NULL,
  `query_hash` varchar(64) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `results_count` int(11) DEFAULT 0,
  `response_time_ms` int(11) DEFAULT NULL,
  `search_type` enum('fulltext','semantic','hybrid') DEFAULT 'fulltext',
  `filters_applied` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`filters_applied`)),
  `clicked_results` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`clicked_results`)),
  `search_timestamp` timestamp NOT NULL DEFAULT current_timestamp(),
  `user_ip` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `sessions`
--

CREATE TABLE `sessions` (
  `session_id` varchar(128) NOT NULL,
  `data` text DEFAULT NULL,
  `expires` bigint(20) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `session_analytics`
--

CREATE TABLE `session_analytics` (
  `id` int(11) NOT NULL,
  `date_hour` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `total_sessions` int(11) DEFAULT 0,
  `new_sessions` int(11) DEFAULT 0,
  `expired_sessions` int(11) DEFAULT 0,
  `security_violations` int(11) DEFAULT 0,
  `high_anomaly_sessions` int(11) DEFAULT 0,
  `unique_users` int(11) DEFAULT 0,
  `unique_ips` int(11) DEFAULT 0,
  `avg_session_duration` int(11) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `session_security_violations`
--

CREATE TABLE `session_security_violations` (
  `id` int(11) NOT NULL,
  `session_id` varchar(128) DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `violation_type` varchar(100) NOT NULL,
  `severity` enum('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL,
  `ip_address` varchar(45) NOT NULL,
  `user_agent` text DEFAULT NULL,
  `path` varchar(500) DEFAULT NULL,
  `method` varchar(10) DEFAULT 'GET',
  `violation_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`violation_data`)),
  `violation_time` timestamp NOT NULL DEFAULT current_timestamp(),
  `action_taken` varchar(100) DEFAULT NULL,
  `resolved` tinyint(1) DEFAULT 0,
  `resolution_time` timestamp NULL DEFAULT NULL,
  `resolution_notes` text DEFAULT NULL,
  `threat_level` enum('low','medium','high','critical') DEFAULT 'medium',
  `fingerprint` varchar(64) DEFAULT NULL,
  `geo_country` varchar(2) DEFAULT NULL,
  `geo_city` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `sites`
--

CREATE TABLE `sites` (
  `site_id` int(11) NOT NULL,
  `site_title` varchar(500) NOT NULL,
  `site_url` text NOT NULL,
  `site_description` text DEFAULT NULL,
  `site_keywords` text DEFAULT NULL,
  `site_category` varchar(100) DEFAULT NULL,
  `site_language` varchar(10) DEFAULT 'en',
  `site_country` varchar(10) DEFAULT NULL,
  `site_active` tinyint(1) DEFAULT 1,
  `site_locked` tinyint(1) DEFAULT 0,
  `locked_by` varchar(50) DEFAULT NULL,
  `site_priority` int(11) DEFAULT 5,
  `site_crawl_frequency` enum('hourly','daily','weekly','monthly') DEFAULT 'daily',
  `site_last_crawl_date` timestamp NULL DEFAULT NULL,
  `site_next_crawl_date` timestamp NULL DEFAULT NULL,
  `site_created` timestamp NOT NULL DEFAULT current_timestamp(),
  `site_updated` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `site_user_id` int(11) DEFAULT NULL,
  `robots_txt_url` varchar(2048) DEFAULT NULL,
  `robots_txt_content` text DEFAULT NULL,
  `crawl_delay` int(11) DEFAULT 1000,
  `max_depth` int(11) DEFAULT 5,
  `max_pages` int(11) DEFAULT 1000,
  `user_agent` varchar(500) DEFAULT NULL,
  `last_robots_check` timestamp NULL DEFAULT NULL,
  `crawl_settings` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`crawl_settings`)),
  `total_pages_crawled` int(11) DEFAULT 0,
  `successful_crawls` int(11) DEFAULT 0,
  `failed_crawls` int(11) DEFAULT 0,
  `last_error` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `site_data`
--

CREATE TABLE `site_data` (
  `site_data_id` int(11) NOT NULL,
  `site_data_site_id` int(11) NOT NULL,
  `site_data_link` text NOT NULL,
  `site_data_title` varchar(500) DEFAULT NULL,
  `site_data_description` text DEFAULT NULL,
  `site_data_keywords` text DEFAULT NULL,
  `site_data_author` varchar(255) DEFAULT NULL,
  `site_data_generator` varchar(255) DEFAULT NULL,
  `site_data_h1` text DEFAULT NULL,
  `site_data_h2` text DEFAULT NULL,
  `site_data_h3` text DEFAULT NULL,
  `site_data_h4` text DEFAULT NULL,
  `site_data_article` mediumtext DEFAULT NULL,
  `site_data_icon` text DEFAULT NULL,
  `site_data_visit` int(11) DEFAULT 0,
  `site_data_last_update` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `site_data_metadata` mediumtext DEFAULT NULL,
  `crawl_date` timestamp NOT NULL DEFAULT current_timestamp(),
  `status` varchar(50) DEFAULT 'pending',
  `content_hash` varchar(64) DEFAULT NULL,
  `content_length` int(11) DEFAULT 0,
  `word_count` int(11) DEFAULT 0,
  `reading_time` int(11) DEFAULT 0,
  `page_type` varchar(50) DEFAULT 'webpage',
  `language_detected` varchar(10) DEFAULT NULL,
  `sentiment_score` decimal(3,2) DEFAULT NULL,
  `load_time` int(11) DEFAULT NULL,
  `response_code` int(11) DEFAULT NULL,
  `redirect_url` varchar(2048) DEFAULT NULL,
  `canonical_url` varchar(2048) DEFAULT NULL,
  `parent_page_id` int(11) DEFAULT NULL,
  `link_type` enum('main_page','internal','external','document','image','video','email','phone','javascript','unknown') DEFAULT 'main_page',
  `site_data_url_hash` varchar(64) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Triggers `site_data`
--
DELIMITER $$
CREATE TRIGGER `calculate_content_metrics` BEFORE INSERT ON `site_data` FOR EACH ROW BEGIN
    -- Calculate content length
    SET NEW.content_length = CHAR_LENGTH(COALESCE(NEW.site_data_article, ''));
    
    -- Calculate word count (approximate)
    SET NEW.word_count = (
        CHAR_LENGTH(TRIM(COALESCE(NEW.site_data_article, ''))) - 
        CHAR_LENGTH(REPLACE(TRIM(COALESCE(NEW.site_data_article, '')), ' ', '')) + 1
    );
    
    -- Calculate reading time (average 200 words per minute)
    SET NEW.reading_time = CEILING(NEW.word_count / 200);
    
    -- Generate content hash
    SET NEW.content_hash = SHA2(CONCAT(
        COALESCE(NEW.site_data_title, ''),
        COALESCE(NEW.site_data_article, '')
    ), 256);
END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `update_crawl_stats_on_status_change` AFTER UPDATE ON `site_data` FOR EACH ROW BEGIN
    IF OLD.status != NEW.status THEN
        UPDATE sites 
        SET successful_crawls = CASE 
                WHEN NEW.status = 'indexed' AND OLD.status != 'indexed' THEN successful_crawls + 1
                WHEN OLD.status = 'indexed' AND NEW.status != 'indexed' THEN successful_crawls - 1
                ELSE successful_crawls 
            END,
            failed_crawls = CASE 
                WHEN NEW.status = 'failed' AND OLD.status != 'failed' THEN failed_crawls + 1
                WHEN OLD.status = 'failed' AND NEW.status != 'failed' THEN failed_crawls - 1
                ELSE failed_crawls 
            END
        WHERE site_id = NEW.site_data_site_id;
    END IF;
END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `update_site_last_crawl` AFTER INSERT ON `site_data` FOR EACH ROW BEGIN
    UPDATE sites 
    SET site_last_crawl_date = NEW.crawl_date,
        total_pages_crawled = total_pages_crawled + 1,
        successful_crawls = CASE WHEN NEW.status = 'indexed' THEN successful_crawls + 1 ELSE successful_crawls END,
        failed_crawls = CASE WHEN NEW.status = 'failed' THEN failed_crawls + 1 ELSE failed_crawls END
    WHERE site_id = NEW.site_data_site_id;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `site_doc`
--

CREATE TABLE `site_doc` (
  `site_doc_id` int(11) NOT NULL,
  `site_doc_site_id` int(11) NOT NULL,
  `site_doc_data_id` int(11) DEFAULT NULL,
  `site_doc_title` varchar(500) DEFAULT NULL,
  `site_doc_description` text DEFAULT NULL,
  `site_doc_link` text NOT NULL,
  `site_doc_content` longtext DEFAULT NULL,
  `site_doc_type` varchar(100) DEFAULT NULL,
  `site_doc_size` bigint(20) DEFAULT NULL,
  `site_doc_pages` int(11) DEFAULT NULL,
  `site_doc_author` varchar(255) DEFAULT NULL,
  `site_doc_created_date` timestamp NULL DEFAULT NULL,
  `site_doc_modified_date` timestamp NULL DEFAULT NULL,
  `site_doc_hash` varchar(64) DEFAULT NULL,
  `site_doc_crawled` timestamp NOT NULL DEFAULT current_timestamp(),
  `site_doc_metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`site_doc_metadata`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `site_img`
--

CREATE TABLE `site_img` (
  `site_img_id` int(11) NOT NULL,
  `site_img_site_id` int(11) NOT NULL,
  `site_img_data_id` int(11) DEFAULT NULL,
  `site_img_title` varchar(500) DEFAULT NULL,
  `site_img_alt` text DEFAULT NULL,
  `site_img_link` text NOT NULL,
  `site_img_width` int(11) DEFAULT NULL,
  `site_img_height` int(11) DEFAULT NULL,
  `site_img_size` int(11) DEFAULT NULL,
  `site_img_format` varchar(20) DEFAULT NULL,
  `site_img_hash` varchar(64) DEFAULT NULL,
  `site_img_created` timestamp NOT NULL DEFAULT current_timestamp(),
  `site_img_metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`site_img_metadata`)),
  `site_img_description` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `site_videos`
--

CREATE TABLE `site_videos` (
  `site_videos_id` int(11) NOT NULL,
  `site_videos_site_id` int(11) NOT NULL,
  `site_videos_data_id` int(11) DEFAULT NULL,
  `site_videos_title` varchar(500) DEFAULT NULL,
  `site_videos_description` text DEFAULT NULL,
  `site_videos_link` text NOT NULL,
  `site_videos_thumbnail` text DEFAULT NULL,
  `site_videos_duration` int(11) DEFAULT NULL,
  `site_videos_width` int(11) DEFAULT NULL,
  `site_videos_height` int(11) DEFAULT NULL,
  `site_videos_format` varchar(20) DEFAULT NULL,
  `site_videos_size` bigint(20) DEFAULT NULL,
  `site_videos_provider` varchar(100) DEFAULT NULL,
  `site_videos_embed_code` text DEFAULT NULL,
  `site_videos_created` timestamp NOT NULL DEFAULT current_timestamp(),
  `site_videos_metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`site_videos_metadata`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `system_config`
--

CREATE TABLE `system_config` (
  `id` int(11) NOT NULL,
  `config_key` varchar(100) NOT NULL,
  `config_value` text DEFAULT NULL,
  `config_type` enum('string','number','boolean','json') DEFAULT 'string',
  `config_description` text DEFAULT NULL,
  `config_category` varchar(50) DEFAULT 'general',
  `is_public` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `trusted_devices`
--

CREATE TABLE `trusted_devices` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `device_fingerprint` varchar(64) NOT NULL,
  `device_name` varchar(255) DEFAULT NULL,
  `ip_address` varchar(45) NOT NULL,
  `user_agent` text DEFAULT NULL,
  `browser_name` varchar(100) DEFAULT NULL,
  `os_name` varchar(100) DEFAULT NULL,
  `first_seen` timestamp NOT NULL DEFAULT current_timestamp(),
  `last_seen` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `is_trusted` tinyint(1) DEFAULT 0,
  `geo_country` varchar(2) DEFAULT NULL,
  `geo_city` varchar(100) DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `user`
--

CREATE TABLE `user` (
  `user_id` int(11) NOT NULL,
  `user_name` varchar(100) NOT NULL,
  `user_email` varchar(255) NOT NULL,
  `user_password` varchar(255) NOT NULL,
  `user_group_id` int(11) DEFAULT NULL,
  `user_created` timestamp NOT NULL DEFAULT current_timestamp(),
  `user_last_login` timestamp NULL DEFAULT NULL,
  `user_active` tinyint(1) DEFAULT 1,
  `user_api_key` varchar(64) DEFAULT NULL,
  `user_preferences` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`user_preferences`)),
  `last_login_ip` varchar(45) DEFAULT NULL,
  `last_login_user_agent` text DEFAULT NULL,
  `account_locked` tinyint(1) DEFAULT 0,
  `two_factor_enabled` tinyint(1) DEFAULT 0,
  `failed_login_attempts` int(11) DEFAULT 0,
  `locked_until` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `user_sessions`
--

CREATE TABLE `user_sessions` (
  `session_id` varchar(255) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `ip_address` varchar(45) NOT NULL,
  `user_agent` text DEFAULT NULL,
  `fingerprint` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `last_activity` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `expires_at` timestamp NULL DEFAULT NULL,
  `anomaly_score` decimal(3,2) DEFAULT 0.00,
  `is_active` tinyint(1) DEFAULT 1,
  `geo_country` varchar(2) DEFAULT NULL,
  `geo_city` varchar(100) DEFAULT NULL,
  `device_type` varchar(50) DEFAULT NULL,
  `browser` varchar(100) DEFAULT NULL,
  `os` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure for view `active_sites`
--
DROP TABLE IF EXISTS `active_sites`;

CREATE ALGORITHM=UNDEFINED DEFINER=`mybhoomy`@`localhost` SQL SECURITY DEFINER VIEW `active_sites`  AS SELECT `s`.`site_id` AS `site_id`, `s`.`site_title` AS `site_title`, `s`.`site_url` AS `site_url`, `s`.`site_description` AS `site_description`, `s`.`site_keywords` AS `site_keywords`, `s`.`site_category` AS `site_category`, `s`.`site_language` AS `site_language`, `s`.`site_country` AS `site_country`, `s`.`site_active` AS `site_active`, `s`.`site_locked` AS `site_locked`, `s`.`site_priority` AS `site_priority`, `s`.`site_crawl_frequency` AS `site_crawl_frequency`, `s`.`site_last_crawl_date` AS `site_last_crawl_date`, `s`.`site_next_crawl_date` AS `site_next_crawl_date`, `s`.`site_created` AS `site_created`, `s`.`site_updated` AS `site_updated`, `s`.`site_user_id` AS `site_user_id`, `s`.`robots_txt_url` AS `robots_txt_url`, `s`.`robots_txt_content` AS `robots_txt_content`, `s`.`crawl_delay` AS `crawl_delay`, `s`.`max_depth` AS `max_depth`, `s`.`max_pages` AS `max_pages`, `s`.`user_agent` AS `user_agent`, `s`.`last_robots_check` AS `last_robots_check`, `s`.`crawl_settings` AS `crawl_settings`, `s`.`total_pages_crawled` AS `total_pages_crawled`, `s`.`successful_crawls` AS `successful_crawls`, `s`.`failed_crawls` AS `failed_crawls`, `s`.`last_error` AS `last_error`, count(`sd`.`site_data_id`) AS `total_pages`, max(`sd`.`crawl_date`) AS `last_page_crawled`, avg(case when `sd`.`status` = 'indexed' then 1 else 0 end) AS `success_rate`, sum(case when `sd`.`status` = 'indexed' then 1 else 0 end) AS `indexed_pages`, sum(case when `sd`.`status` = 'failed' then 1 else 0 end) AS `failed_pages` FROM (`sites` `s` left join `site_data` `sd` on(`s`.`site_id` = `sd`.`site_data_site_id`)) WHERE `s`.`site_active` = 1 AND (`s`.`site_locked` = 0 OR `s`.`site_locked` is null) GROUP BY `s`.`site_id` ;

-- --------------------------------------------------------

--
-- Structure for view `recent_crawl_activity`
--
DROP TABLE IF EXISTS `recent_crawl_activity`;

CREATE ALGORITHM=UNDEFINED DEFINER=`mybhoomy`@`localhost` SQL SECURITY DEFINER VIEW `recent_crawl_activity`  AS SELECT `sd`.`site_data_id` AS `site_data_id`, `sd`.`site_data_site_id` AS `site_data_site_id`, `s`.`site_title` AS `site_title`, `sd`.`site_data_link` AS `site_data_link`, `sd`.`site_data_title` AS `site_data_title`, `sd`.`status` AS `status`, `sd`.`crawl_date` AS `crawl_date`, `sd`.`content_length` AS `content_length`, `sd`.`word_count` AS `word_count`, `sd`.`response_code` AS `response_code` FROM (`site_data` `sd` join `sites` `s` on(`sd`.`site_data_site_id` = `s`.`site_id`)) WHERE `sd`.`crawl_date` >= current_timestamp() - interval 24 hour ORDER BY `sd`.`crawl_date` DESC ;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `groups`
--
ALTER TABLE `groups`
  ADD PRIMARY KEY (`group_id`),
  ADD UNIQUE KEY `unique_group_name` (`group_name`),
  ADD KEY `idx_group_active` (`group_active`);

--
-- Indexes for table `login_attempts`
--
ALTER TABLE `login_attempts`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_login_att_identifier` (`identifier`),
  ADD KEY `idx_login_att_ip_address` (`ip_address`),
  ADD KEY `idx_login_att_attempt_time` (`attempt_time`),
  ADD KEY `idx_login_att_success` (`success`);

--
-- Indexes for table `rate_limit_config`
--
ALTER TABLE `rate_limit_config`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `config_name` (`config_name`),
  ADD UNIQUE KEY `unique_config_name` (`config_name`),
  ADD KEY `idx_strategy_type` (`strategy_type`),
  ADD KEY `idx_enabled` (`enabled`),
  ADD KEY `idx_priority` (`priority`),
  ADD KEY `idx_rate_limit_enabled_priority` (`enabled`,`priority`),
  ADD KEY `idx_rate_limit_strategy` (`strategy_type`,`enabled`);

--
-- Indexes for table `rate_limit_violations`
--
ALTER TABLE `rate_limit_violations`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_violation_ip` (`ip`),
  ADD KEY `idx_violation_time` (`violation_time`),
  ADD KEY `idx_violation_type` (`type`),
  ADD KEY `idx_suspicious` (`is_suspicious`),
  ADD KEY `idx_user_violations` (`user_id`),
  ADD KEY `idx_fingerprint` (`fingerprint`),
  ADD KEY `idx_threat_score` (`threat_score`),
  ADD KEY `idx_resolution_status` (`resolution_status`),
  ADD KEY `idx_ip_time_composite` (`ip`,`violation_time`),
  ADD KEY `idx_type_suspicious` (`type`,`is_suspicious`);

--
-- Indexes for table `search_queries`
--
ALTER TABLE `search_queries`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_query_hash` (`query_hash`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_search_timestamp` (`search_timestamp`),
  ADD KEY `idx_search_type` (`search_type`),
  ADD KEY `idx_query_text` (`query`(255));

--
-- Indexes for table `sessions`
--
ALTER TABLE `sessions`
  ADD PRIMARY KEY (`session_id`),
  ADD KEY `idx_expires` (`expires`);

--
-- Indexes for table `session_analytics`
--
ALTER TABLE `session_analytics`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_date_hour` (`date_hour`),
  ADD KEY `idx_date_hour` (`date_hour`);

--
-- Indexes for table `session_security_violations`
--
ALTER TABLE `session_security_violations`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_sess_viol_session_id` (`session_id`),
  ADD KEY `idx_sess_viol_user_id` (`user_id`),
  ADD KEY `idx_sess_viol_violation_type` (`violation_type`),
  ADD KEY `idx_sess_viol_severity` (`severity`),
  ADD KEY `idx_sess_viol_violation_time` (`violation_time`),
  ADD KEY `idx_sess_viol_ip_address` (`ip_address`),
  ADD KEY `idx_sess_viol_resolved` (`resolved`),
  ADD KEY `idx_sess_viol_threat_level` (`threat_level`),
  ADD KEY `idx_sess_viol_time_severity` (`violation_time`,`severity`);

--
-- Indexes for table `sites`
--
ALTER TABLE `sites`
  ADD PRIMARY KEY (`site_id`),
  ADD UNIQUE KEY `unique_site_url` (`site_url`(500)),
  ADD KEY `idx_site_active` (`site_active`),
  ADD KEY `idx_site_locked` (`site_locked`),
  ADD KEY `idx_site_priority` (`site_priority`),
  ADD KEY `idx_site_category` (`site_category`),
  ADD KEY `idx_site_language` (`site_language`),
  ADD KEY `idx_last_crawl` (`site_last_crawl_date`),
  ADD KEY `idx_next_crawl` (`site_next_crawl_date`),
  ADD KEY `idx_crawl_frequency` (`site_crawl_frequency`),
  ADD KEY `idx_active_sites` (`site_active`,`site_locked`),
  ADD KEY `idx_site_user` (`site_user_id`),
  ADD KEY `idx_active_locked_priority` (`site_active`,`site_locked`,`site_priority`),
  ADD KEY `idx_crawl_frequency_next` (`site_crawl_frequency`,`site_next_crawl_date`),
  ADD KEY `idx_last_robots_check` (`last_robots_check`),
  ADD KEY `idx_sites_active_priority_new` (`site_active`,`site_priority`,`site_id`),
  ADD KEY `idx_sites_crawl_schedule` (`site_active`,`site_next_crawl_date`,`site_crawl_frequency`),
  ADD KEY `idx_sites_category_language` (`site_category`,`site_language`,`site_active`);

--
-- Indexes for table `site_data`
--
ALTER TABLE `site_data`
  ADD PRIMARY KEY (`site_data_id`),
  ADD UNIQUE KEY `unique_url_hash` (`site_data_url_hash`),
  ADD KEY `idx_site_data_site_id` (`site_data_site_id`),
  ADD KEY `idx_site_data_title` (`site_data_title`(255)),
  ADD KEY `idx_site_data_status` (`status`),
  ADD KEY `idx_site_data_crawl_date` (`crawl_date`),
  ADD KEY `idx_site_data_last_update` (`site_data_last_update`),
  ADD KEY `idx_content_hash` (`content_hash`),
  ADD KEY `idx_page_type` (`page_type`),
  ADD KEY `idx_language` (`language_detected`),
  ADD KEY `idx_response_code` (`response_code`),
  ADD KEY `idx_site_url_composite` (`site_data_site_id`,`site_data_link`(255)),
  ADD KEY `idx_url_status` (`site_data_link`(255),`status`),
  ADD KEY `idx_site_status_crawl` (`site_data_site_id`,`status`,`crawl_date`),
  ADD KEY `idx_content_hash_status` (`content_hash`,`status`),
  ADD KEY `idx_crawl_date_status` (`crawl_date`,`status`),
  ADD KEY `idx_language_detected` (`language_detected`),
  ADD KEY `idx_site_data_url` (`site_data_link`(500)),
  ADD KEY `idx_parent_page_id` (`parent_page_id`),
  ADD KEY `idx_link_type` (`link_type`),
  ADD KEY `idx_site_link_type` (`site_data_site_id`,`link_type`),
  ADD KEY `idx_parent_link_type` (`parent_page_id`,`link_type`),
  ADD KEY `idx_url_hash` (`site_data_url_hash`),
  ADD KEY `idx_site_id_link_type` (`site_data_site_id`,`link_type`),
  ADD KEY `idx_site_url_status_date` (`site_data_site_id`,`status`,`crawl_date`),
  ADD KEY `idx_url_hash_site` (`site_data_url_hash`,`site_data_site_id`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_site_data_search_fields` (`site_data_title`(255),`site_data_description`(255)),
  ADD KEY `idx_site_data_content_popularity` (`site_data_visit`,`site_data_last_update`,`site_data_id`),
  ADD KEY `idx_site_data_keywords` (`site_data_keywords`(255)),
  ADD KEY `idx_site_data_author` (`site_data_author`),
  ADD KEY `idx_site_data_date_range` (`crawl_date`,`site_data_last_update`);
ALTER TABLE `site_data` ADD FULLTEXT KEY `ft_content_search` (`site_data_title`,`site_data_description`,`site_data_article`);
ALTER TABLE `site_data` ADD FULLTEXT KEY `ft_headings_search` (`site_data_h1`,`site_data_h2`,`site_data_h3`,`site_data_h4`);

--
-- Indexes for table `site_doc`
--
ALTER TABLE `site_doc`
  ADD PRIMARY KEY (`site_doc_id`),
  ADD KEY `idx_site_doc_site_id` (`site_doc_site_id`),
  ADD KEY `idx_site_doc_data_id` (`site_doc_data_id`),
  ADD KEY `idx_site_doc_type` (`site_doc_type`),
  ADD KEY `idx_site_doc_hash` (`site_doc_hash`),
  ADD KEY `idx_site_doc_author` (`site_doc_author`),
  ADD KEY `idx_site_doc_link` (`site_doc_link`(500));
ALTER TABLE `site_doc` ADD FULLTEXT KEY `ft_doc_content` (`site_doc_title`,`site_doc_description`,`site_doc_content`);

--
-- Indexes for table `site_img`
--
ALTER TABLE `site_img`
  ADD PRIMARY KEY (`site_img_id`),
  ADD KEY `idx_site_img_site_id` (`site_img_site_id`),
  ADD KEY `idx_site_img_data_id` (`site_img_data_id`),
  ADD KEY `idx_site_img_hash` (`site_img_hash`),
  ADD KEY `idx_site_img_format` (`site_img_format`),
  ADD KEY `idx_site_img_size` (`site_img_width`,`site_img_height`),
  ADD KEY `idx_site_img_link` (`site_img_link`(500)),
  ADD KEY `idx_img_site_data_composite` (`site_img_site_id`,`site_img_data_id`),
  ADD KEY `idx_site_img_title` (`site_img_title`);

--
-- Indexes for table `site_videos`
--
ALTER TABLE `site_videos`
  ADD PRIMARY KEY (`site_videos_id`),
  ADD KEY `idx_site_videos_site_id` (`site_videos_site_id`),
  ADD KEY `idx_site_videos_data_id` (`site_videos_data_id`),
  ADD KEY `idx_site_videos_provider` (`site_videos_provider`),
  ADD KEY `idx_site_videos_format` (`site_videos_format`),
  ADD KEY `idx_site_videos_duration` (`site_videos_duration`),
  ADD KEY `idx_site_videos_link` (`site_videos_link`(500));

--
-- Indexes for table `system_config`
--
ALTER TABLE `system_config`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_config_key` (`config_key`),
  ADD KEY `idx_config_category` (`config_category`),
  ADD KEY `idx_is_public` (`is_public`);

--
-- Indexes for table `trusted_devices`
--
ALTER TABLE `trusted_devices`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_user_fingerprint` (`user_id`,`device_fingerprint`),
  ADD KEY `idx_device_fingerprint` (`device_fingerprint`),
  ADD KEY `idx_user_trusted` (`user_id`,`is_trusted`),
  ADD KEY `idx_last_seen` (`last_seen`),
  ADD KEY `idx_expires_at` (`expires_at`);

--
-- Indexes for table `user`
--
ALTER TABLE `user`
  ADD PRIMARY KEY (`user_id`),
  ADD UNIQUE KEY `unique_user_email` (`user_email`),
  ADD UNIQUE KEY `unique_user_name` (`user_name`),
  ADD UNIQUE KEY `unique_api_key` (`user_api_key`),
  ADD KEY `idx_user_group` (`user_group_id`),
  ADD KEY `idx_user_active` (`user_active`),
  ADD KEY `idx_user_email` (`user_email`),
  ADD KEY `idx_user_auth` (`user_name`,`user_password`);

--
-- Indexes for table `user_sessions`
--
ALTER TABLE `user_sessions`
  ADD PRIMARY KEY (`session_id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_ip_address` (`ip_address`),
  ADD KEY `idx_created_at` (`created_at`),
  ADD KEY `idx_last_activity` (`last_activity`),
  ADD KEY `idx_is_active` (`is_active`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `groups`
--
ALTER TABLE `groups`
  MODIFY `group_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `login_attempts`
--
ALTER TABLE `login_attempts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `rate_limit_config`
--
ALTER TABLE `rate_limit_config`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `rate_limit_violations`
--
ALTER TABLE `rate_limit_violations`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `search_queries`
--
ALTER TABLE `search_queries`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `session_analytics`
--
ALTER TABLE `session_analytics`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `session_security_violations`
--
ALTER TABLE `session_security_violations`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `sites`
--
ALTER TABLE `sites`
  MODIFY `site_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `site_data`
--
ALTER TABLE `site_data`
  MODIFY `site_data_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `site_doc`
--
ALTER TABLE `site_doc`
  MODIFY `site_doc_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `site_img`
--
ALTER TABLE `site_img`
  MODIFY `site_img_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `site_videos`
--
ALTER TABLE `site_videos`
  MODIFY `site_videos_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `system_config`
--
ALTER TABLE `system_config`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `trusted_devices`
--
ALTER TABLE `trusted_devices`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `user`
--
ALTER TABLE `user`
  MODIFY `user_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `rate_limit_violations`
--
ALTER TABLE `rate_limit_violations`
  ADD CONSTRAINT `fk_violation_user_rl` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE SET NULL;

--
-- Constraints for table `search_queries`
--
ALTER TABLE `search_queries`
  ADD CONSTRAINT `fk_search_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE SET NULL;

--
-- Constraints for table `session_security_violations`
--
ALTER TABLE `session_security_violations`
  ADD CONSTRAINT `fk_sess_viol_user_secure` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE SET NULL;

--
-- Constraints for table `sites`
--
ALTER TABLE `sites`
  ADD CONSTRAINT `fk_site_user` FOREIGN KEY (`site_user_id`) REFERENCES `user` (`user_id`) ON DELETE SET NULL;

--
-- Constraints for table `site_data`
--
ALTER TABLE `site_data`
  ADD CONSTRAINT `fk_site_data_parent` FOREIGN KEY (`parent_page_id`) REFERENCES `site_data` (`site_data_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_site_data_site` FOREIGN KEY (`site_data_site_id`) REFERENCES `sites` (`site_id`) ON DELETE CASCADE;

--
-- Constraints for table `site_doc`
--
ALTER TABLE `site_doc`
  ADD CONSTRAINT `fk_site_doc_data` FOREIGN KEY (`site_doc_data_id`) REFERENCES `site_data` (`site_data_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_site_doc_site` FOREIGN KEY (`site_doc_site_id`) REFERENCES `sites` (`site_id`) ON DELETE CASCADE;

--
-- Constraints for table `site_img`
--
ALTER TABLE `site_img`
  ADD CONSTRAINT `fk_site_img_data` FOREIGN KEY (`site_img_data_id`) REFERENCES `site_data` (`site_data_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_site_img_site` FOREIGN KEY (`site_img_site_id`) REFERENCES `sites` (`site_id`) ON DELETE CASCADE;

--
-- Constraints for table `site_videos`
--
ALTER TABLE `site_videos`
  ADD CONSTRAINT `fk_site_videos_data` FOREIGN KEY (`site_videos_data_id`) REFERENCES `site_data` (`site_data_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_site_videos_site` FOREIGN KEY (`site_videos_site_id`) REFERENCES `sites` (`site_id`) ON DELETE CASCADE;

--
-- Constraints for table `trusted_devices`
--
ALTER TABLE `trusted_devices`
  ADD CONSTRAINT `fk_trusted_device_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE CASCADE;

--
-- Constraints for table `user`
--
ALTER TABLE `user`
  ADD CONSTRAINT `fk_user_group` FOREIGN KEY (`user_group_id`) REFERENCES `groups` (`group_id`) ON DELETE SET NULL;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
