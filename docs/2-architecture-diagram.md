# Bhoomy Search Engine - Visual Architecture Diagram

## Overview
This document provides a comprehensive visual representation of the Bhoomy Search Engine architecture, illustrating all system components, their relationships, and data flow patterns.

## 1. Complete System Architecture

```
graph TB
    subgraph "Client Layer"
        BROWSER[Web Browser]
        MOBILE[Mobile Devices]
        PWA[Progressive Web App]
    end
    
    subgraph "Frontend Application (React + TypeScript)"
        REACT_APP[React 18 Application]
        VITE[Vite Build System]
        TAILWIND[TailwindCSS Styling]
        ROUTER[React Router]
        STATE[Zustand State Management]
        
        subgraph "Frontend Pages"
            HOME[HomePage]
            SEARCH[SearchPage]
            IMAGES[ImagesPage]
            VIDEOS[VideosPage]
            NEWS[NewsPage]
            ADMIN[AdminPage]
        end
        
        subgraph "Frontend Components"
            HEADER[Header Component]
            FOOTER[Footer Component]
            SEARCH_BAR[Search Bar]
            FILTERS[Search Filters]
            RESULTS[Search Results]
            SUGGESTIONS[Search Suggestions]
            IMAGE_GRID[Image Grid]
            VIDEO_PLAYER[Video Player]
        end
        
        subgraph "Frontend Services"
            API_CLIENT[API Client Service]
            ERROR_HANDLER[Error Handler]
            SEO_MONITOR[SEO Monitor]
        end
    end
    
    subgraph "Backend Layer (Node.js + Express)"
        EXPRESS[Express.js Server]
        
        subgraph "Middleware Stack"
            HELMET[Helmet Security]
            CORS[CORS Handler]
            RATE_LIMIT[Rate Limiting]
            COMPRESSION[Response Compression]
            BODY_PARSER[Body Parser]
            SESSION[Session Management]
            LOGGER[Winston Logger]
            PERF_MONITOR[Performance Monitor]
        end
        
        subgraph "API Routes"
            SEARCH_ROUTE[/api/search]
            IMAGES_ROUTE[/api/images]
            VIDEOS_ROUTE[/api/videos]
            NEWS_ROUTE[/api/news]
            SITES_ROUTE[/api/sites]
            ADMIN_ROUTE[/api/admin]
            HEALTH_ROUTE[/api/health]
        end
        
        subgraph "Controllers"
            ROOT_CTRL[Root Controller]
            ADMIN_CTRL[Admin Controller]
            SITE_CTRL[Site Controller]
        end
        
        subgraph "Models"
            ELASTIC_MODEL[Elasticsearch Model]
            MYSQL_MODEL[MySQL Model]
            SITE_MODEL[Site Model]
        end
        
        subgraph "Backend Utilities"
            ELASTIC_OPT[Elasticsearch Optimizer]
            REDIS_CACHE[Redis Cache]
            THUMBNAIL[Thumbnail Generator]
            BOOLEAN_PARSER[Boolean Query Parser]
        end
    end
    
    subgraph "Crawler System"
        CRAWLER_MAIN[Crawler Index]
        
        subgraph "Crawler Core"
            CRAWLER_CORE[Crawler Core Engine]
            PARSER[Content Parser]
            INDEXER[Content Indexer]
        end
        
        subgraph "Crawler Handlers"
            HTML_HANDLER[HTML Handler]
            DOC_HANDLER[Document Handler]
            IMAGE_HANDLER[Image Handler]
            DATA_HANDLER[Data Handler]
            CONTENT_HANDLER[ContentType Handler]
            ERROR_HANDLER_CRAWL[Error Handler]
        end
        
        subgraph "Crawler Utilities"
            URL_VALIDATOR[URL Validator]
            DUPLICATE_CHECKER[Duplicate Checker]
            IMAGE_DUPLICATE[Image Duplicate Checker]
            RESOURCE_MONITOR[Resource Monitor]
            BATCH_PROCESSOR[Batch Processor]
        end
        
        subgraph "Crawler Config"
            CRAWLER_CONFIG[Crawler Config]
            USER_AGENTS[User Agents]
            PROXIES[Proxy List]
            HEADERS[Stealth Headers]
            SYSTEM_LIMITS[System Limits]
        end
        
        subgraph "Crawler Scripts"
            BHOOMY_COM[bhoomy_com.js]
            BHOOMY_IN[bhoomy_in.js]
            BHOOMY_ORG[bhoomy_org.js]
            BHOOMY_STORE[bhoomy_store.js]
            NEWS_SITE[news_site.js]
            SPECIAL_SITE[specialsite.js]
        end
    end
    
    subgraph "Data Storage Layer"
        ELASTICSEARCH[(Elasticsearch 8+)]
        MYSQL[(MySQL Database)]
        REDIS[(Redis Cache)]
        
        subgraph "Elasticsearch Indices"
            ES_SITES[site_data Index]
            ES_IMAGES[site_img Index]
            ES_VIDEOS[site_videos Index]
        end
        
        subgraph "MySQL Tables"
            SITES_TABLE[sites Table]
            SITE_DATA_TABLE[site_data Table]
            SITE_IMG_TABLE[site_img Table]
            SITE_VIDEOS_TABLE[site_videos Table]
            CRAWL_STATS[crawl_statistics Table]
            SEARCH_LOGS[search_queries Table]
        end
    end
    
    subgraph "External Services"
        YOUTUBE_API[YouTube API]
        GOOGLE_API[Google APIs]
        NEWS_API[News APIs]
    end
    
    subgraph "Configuration Management"
        CONFIG_MGR[Configuration Manager]
        ENV_MGR[Environment Manager]
        CRED_ROTATION[Credential Rotation]
        ENCRYPTION[Encryption Utils]
    end
    
    %% Client to Frontend
    BROWSER --> REACT_APP
    MOBILE --> REACT_APP
    PWA --> REACT_APP
    
    %% Frontend Internal
    REACT_APP --> VITE
    REACT_APP --> TAILWIND
    REACT_APP --> ROUTER
    REACT_APP --> STATE
    ROUTER --> HOME
    ROUTER --> SEARCH
    ROUTER --> IMAGES
    ROUTER --> VIDEOS
    ROUTER --> NEWS
    ROUTER --> ADMIN
    SEARCH --> HEADER
    SEARCH --> SEARCH_BAR
    SEARCH --> FILTERS
    SEARCH --> RESULTS
    SEARCH --> SUGGESTIONS
    IMAGES --> IMAGE_GRID
    VIDEOS --> VIDEO_PLAYER
    HOME --> API_CLIENT
    SEARCH --> API_CLIENT
    IMAGES --> API_CLIENT
    VIDEOS --> API_CLIENT
    NEWS --> API_CLIENT
    ADMIN --> API_CLIENT
    API_CLIENT --> ERROR_HANDLER
    API_CLIENT --> SEO_MONITOR
    
    %% Frontend to Backend
    API_CLIENT --> EXPRESS
    
    %% Backend Internal
    EXPRESS --> HELMET
    HELMET --> CORS
    CORS --> RATE_LIMIT
    RATE_LIMIT --> COMPRESSION
    COMPRESSION --> BODY_PARSER
    BODY_PARSER --> SESSION
    SESSION --> LOGGER
    LOGGER --> PERF_MONITOR
    PERF_MONITOR --> SEARCH_ROUTE
    PERF_MONITOR --> IMAGES_ROUTE
    PERF_MONITOR --> VIDEOS_ROUTE
    PERF_MONITOR --> NEWS_ROUTE
    PERF_MONITOR --> SITES_ROUTE
    PERF_MONITOR --> ADMIN_ROUTE
    PERF_MONITOR --> HEALTH_ROUTE
    SEARCH_ROUTE --> ROOT_CTRL
    IMAGES_ROUTE --> ROOT_CTRL
    VIDEOS_ROUTE --> ROOT_CTRL
    NEWS_ROUTE --> ROOT_CTRL
    SITES_ROUTE --> SITE_CTRL
    ADMIN_ROUTE --> ADMIN_CTRL
    ROOT_CTRL --> ELASTIC_MODEL
    ROOT_CTRL --> MYSQL_MODEL
    SITE_CTRL --> SITE_MODEL
    ELASTIC_MODEL --> ELASTIC_OPT
    ELASTIC_MODEL --> REDIS_CACHE
    ELASTIC_MODEL --> BOOLEAN_PARSER
    ROOT_CTRL --> THUMBNAIL
    
    %% Backend to Data
    ELASTIC_MODEL --> ELASTICSEARCH
    MYSQL_MODEL --> MYSQL
    REDIS_CACHE --> REDIS
    ELASTICSEARCH --> ES_SITES
    ELASTICSEARCH --> ES_IMAGES
    ELASTICSEARCH --> ES_VIDEOS
    MYSQL --> SITES_TABLE
    MYSQL --> SITE_DATA_TABLE
    MYSQL --> SITE_IMG_TABLE
    MYSQL --> SITE_VIDEOS_TABLE
    MYSQL --> CRAWL_STATS
    MYSQL --> SEARCH_LOGS
    
    %% Crawler System
    CRAWLER_MAIN --> CRAWLER_CORE
    CRAWLER_CORE --> PARSER
    CRAWLER_CORE --> INDEXER
    CRAWLER_CORE --> HTML_HANDLER
    CRAWLER_CORE --> DOC_HANDLER
    CRAWLER_CORE --> IMAGE_HANDLER
    CRAWLER_CORE --> DATA_HANDLER
    CRAWLER_CORE --> CONTENT_HANDLER
    CRAWLER_CORE --> ERROR_HANDLER_CRAWL
    CRAWLER_CORE --> URL_VALIDATOR
    CRAWLER_CORE --> DUPLICATE_CHECKER
    CRAWLER_CORE --> IMAGE_DUPLICATE
    CRAWLER_CORE --> RESOURCE_MONITOR
    CRAWLER_CORE --> BATCH_PROCESSOR
    CRAWLER_CORE --> CRAWLER_CONFIG
    CRAWLER_CORE --> USER_AGENTS
    CRAWLER_CORE --> PROXIES
    CRAWLER_CORE --> HEADERS
    CRAWLER_CORE --> SYSTEM_LIMITS
    INDEXER --> MYSQL
    INDEXER --> ELASTICSEARCH
    BHOOMY_COM --> CRAWLER_MAIN
    BHOOMY_IN --> CRAWLER_MAIN
    BHOOMY_ORG --> CRAWLER_MAIN
    BHOOMY_STORE --> CRAWLER_MAIN
    NEWS_SITE --> CRAWLER_MAIN
    SPECIAL_SITE --> CRAWLER_MAIN
    
    %% External Services
    ROOT_CTRL --> YOUTUBE_API
    ROOT_CTRL --> GOOGLE_API
    ROOT_CTRL --> NEWS_API
    
    %% Configuration
    EXPRESS --> CONFIG_MGR
    CRAWLER_CORE --> CONFIG_MGR
    CONFIG_MGR --> ENV_MGR
    CONFIG_MGR --> CRED_ROTATION
    CONFIG_MGR --> ENCRYPTION
```

## 2. Frontend Architecture Details

```
graph TB
    subgraph "React Application Structure"
        MAIN[main.tsx - Entry Point]
        APP[App.tsx - Root Component]
        
        subgraph "Pages (Route Components)"
            HOME_PAGE[HomePage.tsx]
            SEARCH_PAGE[SearchPage.tsx]
            IMAGES_PAGE[ImagesPage.tsx]
            VIDEOS_PAGE[VideosPage.tsx]
            NEWS_PAGE[NewsPage.tsx]
            ADMIN_PAGE[AdminPage.tsx]
        end
        
        subgraph "Shared Components"
            HEADER_COMP[Header.tsx]
            FOOTER_COMP[Footer.tsx]
            ADV_SEARCH[AdvancedSearch.tsx]
            SEARCH_SUGG[SearchSuggestions.tsx]
            LAZY_IMG[LazyImage.tsx]
        end
        
        subgraph "Optimized Components"
            LAZY_RESULTS[LazySearchResults.tsx]
            OPT_FILTERS[SearchFilters.tsx]
            OPT_RESULTS[SearchResults.tsx]
            OPT_IMG_GRID[OptimizedImageGrid.tsx]
        end
        
        subgraph "State Management (Zustand)"
            SEARCH_STORE[searchStore.ts]
            SEARCH_SLICE[searchSlice]
            FILTERS_SLICE[filtersSlice]
            HISTORY_SLICE[historySlice]
            PERF_SLICE[performanceSlice]
        end
        
        subgraph "Services & Utils"
            API_SERVICE[api.ts - API Client]
            ENHANCED_API[enhancedApiClient.ts]
            ERROR_SERVICE[errorHandler.ts]
            ERROR_MONITOR[errorMonitoring.ts]
            SEO_SERVICE[seoMonitoring.ts]
        end
        
        subgraph "Custom Hooks"
            USE_ACCESS[useAccessibility.ts]
            USE_MEMORY[useComponentMemoryMonitor.ts]
            USE_ERROR[useErrorHandler.ts]
            USE_SEO[useSEO.ts]
        end
        
        subgraph "Types"
            TYPES[index.ts - TypeScript Types]
        end
    end
    
    MAIN --> APP
    APP --> HOME_PAGE
    APP --> SEARCH_PAGE
    APP --> IMAGES_PAGE
    APP --> VIDEOS_PAGE
    APP --> NEWS_PAGE
    APP --> ADMIN_PAGE
    
    HOME_PAGE --> HEADER_COMP
    SEARCH_PAGE --> HEADER_COMP
    SEARCH_PAGE --> ADV_SEARCH
    SEARCH_PAGE --> SEARCH_SUGG
    SEARCH_PAGE --> LAZY_RESULTS
    SEARCH_PAGE --> OPT_RESULTS
    IMAGES_PAGE --> OPT_IMG_GRID
    IMAGES_PAGE --> LAZY_IMG
    
    SEARCH_PAGE --> SEARCH_STORE
    IMAGES_PAGE --> SEARCH_STORE
    VIDEOS_PAGE --> SEARCH_STORE
    NEWS_PAGE --> SEARCH_STORE
    
    SEARCH_STORE --> SEARCH_SLICE
    SEARCH_STORE --> FILTERS_SLICE
    SEARCH_STORE --> HISTORY_SLICE
    SEARCH_STORE --> PERF_SLICE
    
    SEARCH_PAGE --> API_SERVICE
    IMAGES_PAGE --> API_SERVICE
    VIDEOS_PAGE --> API_SERVICE
    NEWS_PAGE --> API_SERVICE
    API_SERVICE --> ENHANCED_API
    
    SEARCH_PAGE --> USE_ACCESS
    SEARCH_PAGE --> USE_ERROR
    SEARCH_PAGE --> USE_SEO
    SEARCH_PAGE --> USE_MEMORY
    
    API_SERVICE --> ERROR_SERVICE
    ERROR_SERVICE --> ERROR_MONITOR
    API_SERVICE --> SEO_SERVICE
    
    API_SERVICE --> TYPES
    SEARCH_STORE --> TYPES
```

## 3. Backend API Architecture

```
graph TB
    subgraph "Express Server (app.js)"
        SERVER[Express Application]
        
        subgraph "Middleware Chain"
            TRUST_PROXY[Trust Proxy]
            HELMET_MW[Helmet Security]
            BOT_DETECT[Bot Detection]
            RATE_LIMIT_MW[Rate Limiting]
            CORS_MW[CORS Handler]
            COMPRESS_MW[Compression]
            BODY_PARSE_MW[Body Parser]
            SESSION_MW[Session Management]
            LOG_MW[Request Logger]
            PERF_MW[Performance Monitor]
        end
        
        subgraph "Static Files"
            STATIC[Static File Server]
            FRONTEND_DIST[Frontend Build]
        end
        
        subgraph "Route Handlers"
            INDEX_ROUTES[/ Routes]
            API_ROUTES[/api Routes]
            ADMIN_ROUTES[/administrator Routes]
        end
    end
    
    subgraph "API Endpoints"
        SEARCH_API[/api/search - Web Search]
        IMAGES_API[/api/images - Image Search]
        VIDEOS_API[/api/videos - Video Search]
        NEWS_API[/api/news - News Search]
        SITES_API[/api/sites - Site Management]
        CATEGORIES_API[/api/categories]
        LANGUAGES_API[/api/languages]
        SUGGESTIONS_API[/api/search/suggestions]
        HEALTH_API[/api/health]
        IMAGE_PROXY[/api/image-proxy]
    end
    
    subgraph "Controllers"
        ROOT_CTRL_DETAIL[Root Controller]
        ADMIN_CTRL_DETAIL[Admin Controller]
        SITE_CTRL_DETAIL[Site Controller]
    end
    
    subgraph "Models Layer"
        ELASTIC_MODEL_DETAIL[Elasticsearch Model]
        MYSQL_MODEL_DETAIL[MySQL Model]
    end
    
    subgraph "Search Models"
        ELASTIC_SITES[elastic_search/site.js]
        SITE_MODEL_DETAIL[Site Model]
    end
    
    SERVER --> TRUST_PROXY
    TRUST_PROXY --> HELMET_MW
    HELMET_MW --> BOT_DETECT
    BOT_DETECT --> RATE_LIMIT_MW
    RATE_LIMIT_MW --> CORS_MW
    CORS_MW --> COMPRESS_MW
    COMPRESS_MW --> BODY_PARSE_MW
    BODY_PARSE_MW --> SESSION_MW
    SESSION_MW --> LOG_MW
    LOG_MW --> PERF_MW
    PERF_MW --> STATIC
    PERF_MW --> INDEX_ROUTES
    PERF_MW --> API_ROUTES
    PERF_MW --> ADMIN_ROUTES
    
    STATIC --> FRONTEND_DIST
    
    API_ROUTES --> SEARCH_API
    API_ROUTES --> IMAGES_API
    API_ROUTES --> VIDEOS_API
    API_ROUTES --> NEWS_API
    API_ROUTES --> SITES_API
    API_ROUTES --> CATEGORIES_API
    API_ROUTES --> LANGUAGES_API
    API_ROUTES --> SUGGESTIONS_API
    API_ROUTES --> HEALTH_API
    API_ROUTES --> IMAGE_PROXY
    
    SEARCH_API --> ROOT_CTRL_DETAIL
    IMAGES_API --> ROOT_CTRL_DETAIL
    VIDEOS_API --> ROOT_CTRL_DETAIL
    NEWS_API --> ROOT_CTRL_DETAIL
    SITES_API --> SITE_CTRL_DETAIL
    ADMIN_ROUTES --> ADMIN_CTRL_DETAIL
    
    ROOT_CTRL_DETAIL --> ELASTIC_MODEL_DETAIL
    ROOT_CTRL_DETAIL --> MYSQL_MODEL_DETAIL
    SITE_CTRL_DETAIL --> SITE_MODEL_DETAIL
    
    ELASTIC_MODEL_DETAIL --> ELASTIC_SITES
```

## 4. Crawler System Architecture

```
graph TB
    subgraph "Crawler Entry Points"
        INDEX_JS[index.js - Main Entry]
        BHOOMY_COM_SCRIPT[bhoomy_com.js]
        BHOOMY_IN_SCRIPT[bhoomy_in.js]
        BHOOMY_ORG_SCRIPT[bhoomy_org.js]
        BHOOMY_STORE_SCRIPT[bhoomy_store.js]
        NEWS_SCRIPT[news_site.js]
        SPECIAL_SCRIPT[specialsite.js]
    end
    
    subgraph "Crawler Core System"
        SEARCH_ENGINE_CRAWLER[SearchEngineCrawler Class]
        
        subgraph "Core Components"
            CRAWLER_CORE_DETAIL[CrawlerCore]
            PARSER_DETAIL[ContentParser]
            INDEXER_DETAIL[ContentIndexer]
        end
        
        subgraph "Content Handlers"
            HTML_HANDLER_DETAIL[HtmlHandler]
            DOC_HANDLER_DETAIL[DocumentHandler]
            IMAGE_HANDLER_DETAIL[ImageHandler]
            DATA_HANDLER_DETAIL[DataHandler]
            CONTENT_HANDLER_DETAIL[ContentTypeHandler]
        end
        
        subgraph "Utility Services"
            URL_VAL_DETAIL[URL Validator]
            DUP_CHECK_DETAIL[Duplicate Checker]
            IMG_DUP_CHECK[Image Duplicate Checker]
            RES_MONITOR_DETAIL[Resource Monitor]
            BATCH_PROC_DETAIL[Batch Processor]
            SECURE_DB[Secure Database]
        end
    end
    
    subgraph "Crawler Configuration"
        CRAWLER_CONFIG_DETAIL[crawlerConfig.js]
        USER_AGENTS_DETAIL[user-agents.js]
        PROXIES_DETAIL[proxies.js]
        HEADERS_DETAIL[headers.js]
        SYSTEM_LIMITS_DETAIL[system-limits.js]
        DB_CONFIG[db.js]
        ELASTIC_CONFIG[elasticConfig.js]
    end
    
    subgraph "Crawler Methods"
        CRAWL_URL[crawlUrl - Single URL]
        CRAWL_BATCH[crawlBatch - Multiple URLs]
        CRAWL_WEBSITE[crawlWebsite - Full Site]
        CRAWL_SMART[crawlWebsiteSmart - Optimized]
        CRAWL_COMPLETE[crawlWebsiteComplete - Deep Crawl]
    end
    
    subgraph "Data Flow"
        FETCH_PAGE[Fetch Web Page]
        PARSE_CONTENT[Parse Content]
        EXTRACT_LINKS[Extract Links]
        CHECK_DUPLICATES[Check Duplicates]
        INDEX_DB[Index to Database]
        INDEX_ES[Index to Elasticsearch]
    end
    
    INDEX_JS --> SEARCH_ENGINE_CRAWLER
    BHOOMY_COM_SCRIPT --> SEARCH_ENGINE_CRAWLER
    BHOOMY_IN_SCRIPT --> SEARCH_ENGINE_CRAWLER
    BHOOMY_ORG_SCRIPT --> SEARCH_ENGINE_CRAWLER
    BHOOMY_STORE_SCRIPT --> SEARCH_ENGINE_CRAWLER
    NEWS_SCRIPT --> SEARCH_ENGINE_CRAWLER
    SPECIAL_SCRIPT --> SEARCH_ENGINE_CRAWLER
    
    SEARCH_ENGINE_CRAWLER --> CRAWLER_CORE_DETAIL
    SEARCH_ENGINE_CRAWLER --> PARSER_DETAIL
    SEARCH_ENGINE_CRAWLER --> INDEXER_DETAIL
    SEARCH_ENGINE_CRAWLER --> HTML_HANDLER_DETAIL
    SEARCH_ENGINE_CRAWLER --> DOC_HANDLER_DETAIL
    SEARCH_ENGINE_CRAWLER --> IMAGE_HANDLER_DETAIL
    SEARCH_ENGINE_CRAWLER --> DATA_HANDLER_DETAIL
    SEARCH_ENGINE_CRAWLER --> CONTENT_HANDLER_DETAIL
    SEARCH_ENGINE_CRAWLER --> URL_VAL_DETAIL
    SEARCH_ENGINE_CRAWLER --> DUP_CHECK_DETAIL
    SEARCH_ENGINE_CRAWLER --> IMG_DUP_CHECK
    SEARCH_ENGINE_CRAWLER --> RES_MONITOR_DETAIL
    SEARCH_ENGINE_CRAWLER --> BATCH_PROC_DETAIL
    
    SEARCH_ENGINE_CRAWLER --> CRAWL_URL
    SEARCH_ENGINE_CRAWLER --> CRAWL_BATCH
    SEARCH_ENGINE_CRAWLER --> CRAWL_WEBSITE
    SEARCH_ENGINE_CRAWLER --> CRAWL_SMART
    SEARCH_ENGINE_CRAWLER --> CRAWL_COMPLETE
    
    CRAWLER_CORE_DETAIL --> CRAWLER_CONFIG_DETAIL
    CRAWLER_CORE_DETAIL --> USER_AGENTS_DETAIL
    CRAWLER_CORE_DETAIL --> PROXIES_DETAIL
    CRAWLER_CORE_DETAIL --> HEADERS_DETAIL
    CRAWLER_CORE_DETAIL --> SYSTEM_LIMITS_DETAIL
    CRAWLER_CORE_DETAIL --> DB_CONFIG
    INDEXER_DETAIL --> ELASTIC_CONFIG
    
    CRAWL_URL --> FETCH_PAGE
    CRAWL_BATCH --> FETCH_PAGE
    CRAWL_WEBSITE --> FETCH_PAGE
    FETCH_PAGE --> PARSE_CONTENT
    PARSE_CONTENT --> EXTRACT_LINKS
    EXTRACT_LINKS --> CHECK_DUPLICATES
    CHECK_DUPLICATES --> INDEX_DB
    INDEX_DB --> INDEX_ES
    
    INDEXER_DETAIL --> SECURE_DB
    INDEXER_DETAIL --> INDEX_DB
    INDEXER_DETAIL --> INDEX_ES
```

## 5. Data Storage Architecture

```
erDiagram
    SITES ||--o{ SITE_DATA : contains
    SITES ||--o{ SITE_IMG : contains
    SITES ||--o{ SITE_VIDEOS : contains
    SITES ||--o{ CRAWL_STATISTICS : tracks
    SITES ||--o{ SEARCH_QUERIES : has
    
    SITES {
        int site_id PK
        string site_title
        string site_url
        string site_description
        string site_keywords
        string site_category
        string site_language
        string site_country
        boolean site_active
        int site_priority
        string site_crawl_frequency
        datetime site_created
        datetime site_updated
    }
    
    SITE_DATA {
        int site_data_id PK
        int site_data_site_id FK
        string site_data_link
        string site_data_title
        text site_data_description
        text site_data_article
        string site_data_image
        datetime site_data_date
        datetime site_data_last_update
        int word_count
        int content_length
        string site_data_status
    }
    
    SITE_IMG {
        int site_img_id PK
        int site_img_site_id FK
        string site_img_link
        string site_img_title
        string site_img_alt
        int site_img_width
        int site_img_height
        string site_img_size
        datetime site_img_created
    }
    
    SITE_VIDEOS {
        int site_videos_id PK
        int site_videos_site_id FK
        string site_videos_url
        string site_videos_title
        text site_videos_description
        string site_videos_thumbnail
        string site_videos_channel
        string site_videos_duration
        datetime site_videos_created
    }
    
    CRAWL_STATISTICS {
        int crawl_id PK
        int site_id FK
        string session_id
        int total_urls
        int successful_crawls
        int failed_crawls
        datetime start_time
        datetime end_time
        string status
    }
    
    SEARCH_QUERIES {
        int query_id PK
        int site_id FK
        string query
        int results_count
        datetime query_timestamp
    }
```

## 6. Search Flow Architecture

```
graph LR
    subgraph "Search Request Flow"
        USER_QUERY[User Query Input]
        FRONTEND_API[Frontend API Client]
        BACKEND_API[Backend API Route]
        VALIDATION[Input Validation]
        QUERY_BUILDER[Query Builder]
        ELASTIC_CLIENT[Elasticsearch Client]
        MYSQL_FALLBACK[MySQL Fallback]
        REDIS_CACHE[Redis Cache]
        RESULT_PROCESSOR[Result Processor]
        RESPONSE_FORMAT[Response Formatter]
        USER_RESULTS[Results Display]
    end
    
    USER_QUERY --> FRONTEND_API
    FRONTEND_API --> BACKEND_API
    BACKEND_API --> VALIDATION
    VALIDATION --> REDIS_CACHE
    REDIS_CACHE -->|Cache Miss| QUERY_BUILDER
    QUERY_BUILDER --> ELASTIC_CLIENT
    ELASTIC_CLIENT -->|Success| RESULT_PROCESSOR
    ELASTIC_CLIENT -->|Failure| MYSQL_FALLBACK
    MYSQL_FALLBACK --> RESULT_PROCESSOR
    RESULT_PROCESSOR --> RESPONSE_FORMAT
    RESPONSE_FORMAT --> REDIS_CACHE
    RESPONSE_FORMAT --> FRONTEND_API
    FRONTEND_API --> USER_RESULTS
```

## Technology Stack Summary

### Frontend Stack
- **React 18** - Modern React with hooks and concurrent features
- **TypeScript** - Type-safe JavaScript
- **Vite** - Fast build tool and dev server
- **TailwindCSS** - Utility-first CSS framework
- **Zustand** - Lightweight state management
- **React Router** - Client-side routing
- **Framer Motion** - Animation library
- **Axios** - HTTP client

### Backend Stack
- **Node.js 18+** - JavaScript runtime
- **Express.js 4** - Web framework
- **Winston** - Logging library
- **Joi** - Input validation
- **Helmet** - Security headers
- **express-rate-limit** - Rate limiting
- **compression** - Response compression
- **express-session** - Session management

### Data Layer
- **Elasticsearch 8+** - Search engine
- **MySQL** - Relational database
- **Redis** - In-memory cache
- **Connection Pooling** - Database optimization

### Crawler Stack
- **cheerio** - HTML parsing
- **jsdom** - DOM manipulation
- **axios** - HTTP requests
- **robots-parser** - Robots.txt parsing
- **user-agents** - User agent rotation
- **sharp** - Image processing
- **pdf-parse** - PDF parsing

### DevOps & Infrastructure
- **PM2** - Process manager
- **Nginx** - Reverse proxy
- **SSL/TLS** - Encryption
- **Docker** - Containerization (optional)
- **Health Checks** - System monitoring

## Component Interactions

### Search Request Path
1. **User** enters query in React frontend
2. **Frontend API Client** sends HTTP request to Express backend
3. **Backend Middleware** validates and processes request
4. **Elasticsearch Model** builds query and searches index
5. **Results** are cached in Redis and returned to frontend
6. **Frontend** displays results with pagination and filters

### Crawling Process Flow
1. **Crawler Script** initiates crawl for a website
2. **CrawlerCore** fetches URLs with rate limiting and retries
3. **ContentParser** extracts text, images, and metadata
4. **DuplicateChecker** prevents duplicate content
5. **ContentIndexer** stores data in MySQL and Elasticsearch
6. **Statistics** are logged for monitoring

### Image Search Flow
1. **User** searches for images
2. **Backend** queries Elasticsearch image index
3. **Thumbnail Generator** creates optimized thumbnails
4. **Image Proxy** handles CORS and image delivery
5. **Frontend** displays image grid with lazy loading

### Video Search Flow
1. **User** searches for videos
2. **Backend** queries Elasticsearch video index or YouTube API
3. **Video Metadata** is extracted and formatted
4. **Thumbnails** are generated or retrieved
5. **Frontend** displays video cards with embedded players

## Security Architecture

- **Helmet** - Sets secure HTTP headers
- **Rate Limiting** - Prevents abuse and DoS attacks
- **CORS** - Controls cross-origin requests
- **Input Validation** - Joi schemas validate all inputs
- **SQL Injection Protection** - Parameterized queries
- **Session Security** - Secure cookies and session management
- **Bot Detection** - Identifies and limits bot traffic
- **HTTPS Only** - Enforces secure connections in production

## Performance Optimizations

- **Response Compression** - Gzip compression for API responses
- **Redis Caching** - Caches frequent search queries
- **Connection Pooling** - Reuses database connections
- **Lazy Loading** - Frontend lazy loads images and components
- **Batch Processing** - Crawler processes URLs in batches
- **Resource Monitoring** - Tracks memory and CPU usage
- **Adaptive Rate Limiting** - Adjusts based on system load

This architecture supports a scalable, secure, and high-performance search engine capable of handling large volumes of web content and user queries.







+--------------+           +------------------------+         +-------------------------+
|  Client      |  <------> |  Frontend React App    | <-----> |  Backend Node/Express   |
|  (Browser,   |           |  (UI + Services)       |         |  (API + Controllers +   |
|  PWA, Mobile)|           |                        |         |  Middleware + Models)   |
+--------------+           +------------------------+         +-------------------------+
                                            |                        |
                                            |                        |
                  ------------------------------------------------------------------
                  |                        |                        |              |
          +-------v-------+       +--------v--------+        +------v--------+     |
          |  Crawler      | <---- | Data Storage    | <----> | External      |     |
          |  System       |       | (Elasticsearch, |        | Services/API  |     |
          |  (Scripts +   |       |  MySQL, Redis)  |        | (News, YT,    |     |
          |   Core +      |       +-----------------+        |  Google)      |     |
          |   Handlers)   |                                       |              |
          +---------------+                                       |              |
                |   |     |                                       |              |
                |   |     |   +-------------------+               |              |
                |   |         |  Config Mgmt      | <--------------+              |
                |   |         +-------------------+                              |
           Data (HTML, media, site, stats)                                       |
                |_______________________________________________________________|
