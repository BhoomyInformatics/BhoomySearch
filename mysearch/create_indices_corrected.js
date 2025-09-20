// CORRECTED Elasticsearch Indices Creation Script
// This matches the mybhoomy_mysearch_schema.sql database schema exactly
// Run this in Kibana Dev Tools or via Elasticsearch API

console.log('Creating Elasticsearch indices to match MySQL schema...');

// ====================================
// 1. SITES INDEX - Matches sites table
// ====================================
PUT /sites
{
  "settings": {
    "number_of_shards": 1,
    "number_of_replicas": 0,
    "refresh_interval": "1s"
  },
  "mappings": {
    "properties": {
      "site_id": { "type": "integer" },
      "site_title": { 
        "type": "text",
        "fields": { "keyword": { "type": "keyword", "ignore_above": 500 } }
      },
      "site_url": { 
        "type": "text",
        "fields": { "keyword": { "type": "keyword", "ignore_above": 2048 } }
      },
      "site_description": { "type": "text" },
      "site_keywords": { "type": "text" },
      "site_category": { 
        "type": "text",
        "fields": { "keyword": { "type": "keyword", "ignore_above": 100 } }
      },
      "site_language": { 
        "type": "keyword"
      },
      "site_country": { 
        "type": "keyword"
      },
      "site_active": { "type": "boolean" },
      "site_locked": { "type": "boolean" },
      "locked_by": { 
        "type": "keyword"
      },
      "site_priority": { "type": "integer" },
      "site_crawl_frequency": { 
        "type": "keyword"
      },
      "site_last_crawl_date": { "type": "date" },
      "site_next_crawl_date": { "type": "date" },
      "site_created": { "type": "date" },
      "site_updated": { "type": "date" },
      "site_user_id": { "type": "integer" },
      "robots_txt_url": { 
        "type": "text",
        "fields": { "keyword": { "type": "keyword", "ignore_above": 2048 } }
      },
      "robots_txt_content": { "type": "text" },
      "crawl_delay": { "type": "integer" },
      "max_depth": { "type": "integer" },
      "max_pages": { "type": "integer" },
      "user_agent": { 
        "type": "text",
        "fields": { "keyword": { "type": "keyword", "ignore_above": 500 } }
      },
      "last_robots_check": { "type": "date" },
      "crawl_settings": { "type": "object", "enabled": false },
      "total_pages_crawled": { "type": "integer" },
      "successful_crawls": { "type": "integer" },
      "failed_crawls": { "type": "integer" },
      "last_error": { "type": "text" }
    }
  }
}

// ====================================
// 2. SITE_DATA INDEX - Matches site_data table  
// ====================================
PUT /site_data
{
  "settings": {
    "number_of_shards": 1,
    "number_of_replicas": 1,
    "refresh_interval": "1s",
    "max_result_window": 50000,
    "analysis": {
      "analyzer": {
        "content_analyzer": {
          "type": "custom",
          "tokenizer": "standard",
          "filter": ["lowercase", "stop", "stemmer"]
        }
      },
      "filter": {
        "stemmer": {
          "type": "stemmer",
          "language": "english"
        }
      }
    }
  },
  "mappings": {
    "properties": {
      "site_data_id": { "type": "integer" },
      "site_data_site_id": { "type": "integer" },
      "site_data_link": { 
        "type": "text",
        "fields": { 
          "keyword": { 
            "type": "keyword", 
            "ignore_above": 2048 
          } 
        }
      },
      "site_data_title": { 
        "type": "text",
        "analyzer": "content_analyzer",
        "fields": { 
          "keyword": { 
            "type": "keyword", 
            "ignore_above": 500 
          } 
        }
      },
      "site_data_description": { 
        "type": "text",
        "analyzer": "content_analyzer"
      },
      "site_data_keywords": { 
        "type": "text",
        "analyzer": "content_analyzer"
      },
      "site_data_author": { 
        "type": "text",
        "fields": { 
          "keyword": { 
            "type": "keyword", 
            "ignore_above": 255 
          } 
        }
      },
      "site_data_generator": { 
        "type": "text",
        "fields": { 
          "keyword": { 
            "type": "keyword", 
            "ignore_above": 255 
          } 
        }
      },
      "site_data_h1": { 
        "type": "text",
        "analyzer": "content_analyzer"
      },
      "site_data_h2": { 
        "type": "text",
        "analyzer": "content_analyzer"
      },
      "site_data_h3": { 
        "type": "text",
        "analyzer": "content_analyzer"
      },
      "site_data_h4": { 
        "type": "text",
        "analyzer": "content_analyzer"
      },
      "site_data_article": { 
        "type": "text",
        "analyzer": "content_analyzer"
      },
      "site_data_icon": { 
        "type": "text",
        "fields": { 
          "keyword": { 
            "type": "keyword", 
            "ignore_above": 2048 
          } 
        }
      },
      "site_data_visit": { "type": "integer" },
      "site_data_last_update": { "type": "date" },
      "site_data_metadata": { "type": "text" },
      "crawl_date": { "type": "date" },
      "status": { "type": "keyword" },
      "content_hash": { "type": "keyword" },
      "content_length": { "type": "integer" },
      "word_count": { "type": "integer" },
      "reading_time": { "type": "integer" },
      "page_type": { "type": "keyword" },
      "language_detected": { "type": "keyword" },
      "sentiment_score": { "type": "float" },
      "load_time": { "type": "integer" },
      "response_code": { "type": "integer" },
      "redirect_url": { 
        "type": "text",
        "fields": { 
          "keyword": { 
            "type": "keyword", 
            "ignore_above": 2048 
          } 
        }
      },
      "canonical_url": { 
        "type": "text",
        "fields": { 
          "keyword": { 
            "type": "keyword", 
            "ignore_above": 2048 
          } 
        }
      },
      "parent_page_id": { "type": "integer" },
      "link_type": { "type": "keyword" },
      "site_data_url_hash": { "type": "keyword" },
      "site_title": { 
        "type": "text",
        "analyzer": "content_analyzer",
        "fields": { 
          "keyword": { 
            "type": "keyword", 
            "ignore_above": 500 
          } 
        }
      },
      "site_url": { 
        "type": "text",
        "fields": { 
          "keyword": { 
            "type": "keyword", 
            "ignore_above": 2048 
          } 
        }
      },
      "site_category": { 
        "type": "text",
        "fields": { 
          "keyword": { 
            "type": "keyword", 
            "ignore_above": 100 
          } 
        }
      },
      "site_language": { "type": "keyword" },
      "site_country": { "type": "keyword" }
    }
  }
} 

// ====================================
// 3. SITE_IMG INDEX - Matches site_img table
// ====================================
PUT /site_img
{
  "mappings": {
    "properties": {
      "site_img_id": { "type": "integer" },
      "site_img_site_id": { "type": "integer" },
      "site_img_data_id": { "type": "integer" },
      "site_img_title": { 
        "type": "text",
        "fields": { "keyword": { "type": "keyword", "ignore_above": 500 } }
      },
      "site_img_alt": { "type": "text" },
      "site_img_link": { 
        "type": "text",
        "fields": { "keyword": { "type": "keyword", "ignore_above": 2048 } }
      },
      "site_img_width": { "type": "integer" },
      "site_img_height": { "type": "integer" },
      "site_img_size": { "type": "integer" },
      "site_img_format": { "type": "keyword" },
      "site_img_hash": { "type": "keyword" },
      "site_img_created": { "type": "date" },
      "site_img_metadata": { "type": "object", "enabled": false },
      "site_img_description": { "type": "text" }
    }
  }
}

// ====================================
// 4. SITE_DOC INDEX - Matches site_doc table
// ====================================
PUT /site_doc
{
  "mappings": {
    "properties": {
      "site_doc_id": { "type": "integer" },
      "site_doc_site_id": { "type": "integer" },
      "site_doc_data_id": { "type": "integer" },
      "site_doc_title": { 
        "type": "text",
        "fields": { "keyword": { "type": "keyword", "ignore_above": 500 } }
      },
      "site_doc_description": { "type": "text" },
      "site_doc_link": { 
        "type": "text",
        "fields": { "keyword": { "type": "keyword", "ignore_above": 2048 } }
      },
      "site_doc_type": { "type": "keyword" },
      "site_doc_size": { "type": "long" },
      "site_doc_pages": { "type": "integer" },
      "site_doc_author": { 
        "type": "text",
        "fields": { "keyword": { "type": "keyword", "ignore_above": 255 } }
      },
      "site_doc_created_date": { "type": "date" },
      "site_doc_modified_date": { "type": "date" },
      "site_doc_content": { "type": "text" },
      "site_doc_hash": { "type": "keyword" },
      "site_doc_crawled": { "type": "date" },
      "site_doc_metadata": { "type": "object", "enabled": false }
    }
  }
}

// ====================================
// 5. SITE_VIDEOS INDEX - Matches site_videos table
// ====================================
PUT /site_videos
{
  "mappings": {
    "properties": {
      "site_videos_id": { "type": "integer" },
      "site_videos_site_id": { "type": "integer" },
      "site_videos_data_id": { "type": "integer" },
      "site_videos_title": { 
        "type": "text",
        "fields": { "keyword": { "type": "keyword", "ignore_above": 500 } }
      },
      "site_videos_description": { "type": "text" },
      "site_videos_link": { 
        "type": "text",
        "fields": { "keyword": { "type": "keyword", "ignore_above": 2048 } }
      },
      "site_videos_thumbnail": { 
        "type": "text",
        "fields": { "keyword": { "type": "keyword", "ignore_above": 2048 } }
      },
      "site_videos_duration": { "type": "integer" },
      "site_videos_width": { "type": "integer" },
      "site_videos_height": { "type": "integer" },
      "site_videos_format": { "type": "keyword" },
      "site_videos_size": { "type": "long" },
      "site_videos_provider": { "type": "keyword" },
      "site_videos_embed_code": { "type": "text" },
      "site_videos_created": { "type": "date" },
      "site_videos_metadata": { "type": "object", "enabled": false }
    }
  }
}

// ====================================
// 6. CRAWL_STATISTICS INDEX - Matches crawl_statistics table
// ====================================
PUT /crawl_statistics
{
  "mappings": {
    "properties": {
      "id": { "type": "integer" },
      "site_id": { "type": "integer" },
      "crawl_session_id": { "type": "keyword" },
      "session_name": { 
        "type": "text",
        "fields": { "keyword": { "type": "keyword", "ignore_above": 255 } }
      },
      "total_urls": { "type": "integer" },
      "successful_crawls": { "type": "integer" },
      "failed_crawls": { "type": "integer" },
      "duplicate_urls": { "type": "integer" },
      "skipped_urls": { "type": "integer" },
      "start_time": { "type": "date" },
      "end_time": { "type": "date" },
      "duration_seconds": { "type": "integer" },
      "status": { "type": "keyword" },
      "error_message": { "type": "text" },
      "crawl_settings": { "type": "object", "enabled": false },
      "performance_metrics": { "type": "object", "enabled": false }
    }
  }
}

// ====================================
// 7. SEARCH_QUERIES INDEX - Matches search_queries table
// ====================================
PUT /search_queries
{
  "mappings": {
    "properties": {
      "id": { "type": "integer" },
      "query": { 
        "type": "text",
        "fields": { "keyword": { "type": "keyword", "ignore_above": 500 } }
      },
      "query_hash": { "type": "keyword" },
      "user_id": { "type": "integer" },
      "results_count": { "type": "integer" },
      "response_time_ms": { "type": "integer" },
      "search_type": { "type": "keyword" },
      "filters_applied": { "type": "object", "enabled": false },
      "clicked_results": { "type": "object", "enabled": false },
      "search_timestamp": { "type": "date" },
      "user_ip": { "type": "ip" },
      "user_agent": { "type": "text" }
    }
  }
}

// ====================================
// 8. SYSTEM_CONFIG INDEX - Matches system_config table
// ====================================
PUT /system_config
{
  "mappings": {
    "properties": {
      "id": { "type": "integer" },
      "config_key": { "type": "keyword" },
      "config_value": { "type": "text" },
      "config_type": { "type": "keyword" },
      "config_description": { "type": "text" },
      "config_category": { "type": "keyword" },
      "is_public": { "type": "boolean" },
      "created_at": { "type": "date" },
      "updated_at": { "type": "date" }
    }
  }
}

// ====================================
// 9. USER INDEX - Matches user table
// ====================================
PUT /user
{
  "mappings": {
    "properties": {
      "user_id": { "type": "integer" },
      "user_name": { "type": "keyword" },
      "user_email": { "type": "keyword" },
      "user_password": { "type": "keyword" },
      "user_group_id": { "type": "integer" },
      "user_created": { "type": "date" },
      "user_last_login": { "type": "date" },
      "user_active": { "type": "boolean" },
      "user_email_verified": { "type": "boolean" },
      "user_reset_token": { "type": "keyword" },
      "user_reset_expires": { "type": "date" },
      "user_preferences": { "type": "object", "enabled": false }
    }
  }
}

// ====================================
// 10. GROUPS INDEX - Matches groups table
// ====================================
PUT /groups
{
  "mappings": {
    "properties": {
      "group_id": { "type": "integer" },
      "group_name": { "type": "keyword" },
      "group_description": { "type": "text" },
      "group_permissions": { "type": "text" },
      "group_created": { "type": "date" },
      "group_active": { "type": "boolean" }
    }
  }
}

// ====================================
// 11. SEARCH_ENGINE_CONTENT INDEX - Primary search index (consolidated)
// ====================================
PUT /search_engine_content
{
  "settings": {
    "number_of_shards": 1,
    "number_of_replicas": 0,
    "refresh_interval": "1s",
    "max_result_window": 50000,
    "analysis": {
      "analyzer": {
        "content_analyzer": {
          "type": "custom",
          "tokenizer": "standard",
          "filter": ["lowercase", "stop", "stemmer"]
        },
        "search_analyzer": {
          "type": "custom",
          "tokenizer": "standard",
          "filter": ["lowercase", "stop", "stemmer"]
        }
      },
      "filter": {
        "stemmer": {
          "type": "stemmer",
          "language": "english"
        }
      }
    }
  },
  "mappings": {
    "properties": {
      "db_id": { "type": "integer" },
      "site_id": { "type": "integer" },
      "site_url": { "type": "keyword" },
      "title": { 
        "type": "text",
        "analyzer": "content_analyzer",
        "search_analyzer": "search_analyzer",
        "fields": { "keyword": { "type": "keyword", "ignore_above": 500 } }
      },
      "description": { 
        "type": "text",
        "analyzer": "content_analyzer",
        "search_analyzer": "search_analyzer"
      },
      "keywords": { 
        "type": "text",
        "analyzer": "content_analyzer",
        "search_analyzer": "search_analyzer"
      },
      "content": { 
        "type": "text",
        "analyzer": "content_analyzer",
        "search_analyzer": "search_analyzer"
      },
      "headings": {
        "properties": {
          "h1": { "type": "text", "analyzer": "content_analyzer", "boost": 2.0 },
          "h2": { "type": "text", "analyzer": "content_analyzer", "boost": 1.5 },
          "h3": { "type": "text", "analyzer": "content_analyzer" },
          "h4": { "type": "text", "analyzer": "content_analyzer" }
        }
      },
      "links": {
        "type": "nested",
        "properties": {
          "url": { "type": "keyword" },
          "text": { "type": "text", "analyzer": "content_analyzer" },
          "title": { "type": "text", "analyzer": "content_analyzer" }
        }
      },
      "images": {
        "type": "nested",
        "properties": {
          "url": { "type": "keyword" },
          "alt": { "type": "text", "analyzer": "content_analyzer" },
          "title": { "type": "text", "analyzer": "content_analyzer" },
          "width": { "type": "integer" },
          "height": { "type": "integer" }
        }
      },
      "videos": {
        "type": "nested",
        "properties": {
          "url": { "type": "keyword" },
          "title": { "type": "text", "analyzer": "content_analyzer" },
          "description": { "type": "text", "analyzer": "content_analyzer" },
          "thumbnail": { "type": "keyword" },
          "duration": { "type": "integer" }
        }
      },
      "metadata": {
        "properties": {
          "author": { "type": "keyword" },
          "publish_date": { "type": "date" },
          "content_type": { "type": "keyword" },
          "language": { "type": "keyword" },
          "category": { "type": "keyword" },
          "word_count": { "type": "integer" },
          "reading_time": { "type": "integer" }
        }
      },
      "crawl_info": {
        "properties": {
          "crawl_date": { "type": "date" },
          "last_modified": { "type": "date" },
          "status_code": { "type": "integer" },
          "response_time": { "type": "integer" },
          "content_hash": { "type": "keyword" }
        }
      }
    }
  }
}

console.log('✅ All Elasticsearch indices created successfully!');
console.log('🔧 Indices now match the mybhoomy_mysearch_schema.sql database structure');
console.log('📊 Ready for data indexing from crawler and search operations'); 