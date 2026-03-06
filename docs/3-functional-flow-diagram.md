# Bhoomy Search Engine - Visual Functional Flow Diagram

## Overview
This document illustrates the functional flows and data movement throughout the Bhoomy Search Engine system, from user interactions to data processing and storage.

## 1. Complete User Search Flow

```
sequenceDiagram
    participant U as User
    participant F as Frontend<br/>(React)
    participant API as API Client<br/>(api.ts)
    participant B as Backend<br/>(Express)
    participant V as Validator<br/>(Joi)
    participant C as Cache<br/>(Redis)
    participant ES as Elasticsearch
    participant DB as MySQL
    participant R as Response<br/>Formatter
    
    U->>F: Enter search query
    F->>F: Update Zustand store
    F->>F: Validate input
    F->>API: GET /api/search?q=query
    API->>B: HTTP Request
    B->>B: Middleware chain<br/>(Rate limit, CORS, etc.)
    B->>V: Validate query params
    V-->>B: Validation result
    
    alt Cache Hit
        B->>C: Check Redis cache
        C-->>B: Cached results
        B->>R: Format cached response
        R-->>B: Formatted response
        B-->>API: JSON response
        API-->>F: Search results
        F->>F: Update state
        F->>U: Display results
    else Cache Miss
        B->>ES: Build Elasticsearch query
        ES-->>B: Search results
        
        alt Elasticsearch Success
            B->>R: Process ES results
            R-->>B: Formatted results
            B->>C: Cache results
            B-->>API: JSON response
            API-->>F: Search results
            F->>F: Update state
            F->>U: Display results
        else Elasticsearch Failure
            B->>DB: MySQL fallback query
            DB-->>B: MySQL results
            B->>R: Format MySQL results
            R-->>B: Formatted results
            B-->>API: JSON response
            API-->>F: Search results
            F->>F: Update state
            F->>U: Display results
        end
    end
```

## 2. Web Crawling Flow


sequenceDiagram
    participant Script as Crawler Script<br/>(bhoomy_com.js)
    participant Main as Crawler Index<br/>(index.js)
    participant Core as Crawler Core
    participant Validator as URL Validator
    participant Checker as Duplicate Checker
    participant Fetch as HTTP Fetch
    participant Parser as Content Parser
    participant Handler as Content Handler
    participant Indexer as Content Indexer
    participant MySQL as MySQL DB
    participant ES as Elasticsearch
    
    Script->>Main: Initialize crawler
    Main->>Core: Create SearchEngineCrawler
    Core->>Core: Load configuration
    
    loop For each URL
        Script->>Core: crawlUrl(url, siteId)
        Core->>Validator: Validate URL
        Validator-->>Core: Validation result
        
        alt Valid URL
            Core->>Checker: Check if duplicate
            Checker->>MySQL: Query duplicate table
            MySQL-->>Checker: Duplicate status
            
            alt Not Duplicate
                Checker-->>Core: Proceed with crawl
                Core->>Fetch: Fetch web page
                Fetch-->>Core: HTML content
                Core->>Parser: Parse HTML
                Parser->>Parser: Extract title, description
                Parser->>Parser: Extract article content
                Parser->>Parser: Extract images
                Parser->>Parser: Extract links
                Parser-->>Core: Parsed data
                
                Core->>Handler: Handle content type
                Handler->>Handler: Process based on type<br/>(HTML/PDF/Image/etc.)
                Handler-->>Core: Processed data
                
                Core->>Indexer: indexContent(data, url, siteId)
                Indexer->>MySQL: Insert into site_data
                MySQL-->>Indexer: Insert ID
                Indexer->>ES: Index to Elasticsearch
                ES-->>Indexer: Index result
                Indexer-->>Core: Indexing success
                
                Core->>Checker: Update duplicate cache
                Core-->>Script: Crawl result
            else Duplicate Found
                Checker-->>Core: Skip (duplicate)
                Core-->>Script: Duplicate skipped
            end
        else Invalid URL
            Validator-->>Core: Invalid URL
            Core-->>Script: Validation error
        end
    end
```

## 3. Content Parsing Flow

```
flowchart TD
    START[Receive HTML Content]
    LOAD[Load HTML into Parser]
    EXTRACT_TITLE[Extract Title<br/>- Meta title<br/>- H1 tag<br/>- Document title]
    EXTRACT_DESC[Extract Description<br/>- Meta description<br/>- First paragraph<br/>- Alt text]
    EXTRACT_ARTICLE[Extract Article Content<br/>- Main content area<br/>- Remove scripts/styles<br/>- Clean HTML]
    EXTRACT_IMAGES[Extract Images<br/>- All img tags<br/>- Background images<br/>- Figure elements]
    EXTRACT_LINKS[Extract Links<br/>- All anchor tags<br/>- Internal links<br/>- External links]
    EXTRACT_META[Extract Metadata<br/>- Meta keywords<br/>- Open Graph<br/>- Schema.org]
    VALIDATE[Validate Extracted Data]
    CLEAN[Clean & Normalize Data]
    TRUNCATE[Truncate to Limits]
    CACHE[Cache Parsed Content]
    RETURN[Return Parsed Object]
    
    START --> LOAD
    LOAD --> EXTRACT_TITLE
    LOAD --> EXTRACT_DESC
    LOAD --> EXTRACT_ARTICLE
    LOAD --> EXTRACT_IMAGES
    LOAD --> EXTRACT_LINKS
    LOAD --> EXTRACT_META
    
    EXTRACT_TITLE --> VALIDATE
    EXTRACT_DESC --> VALIDATE
    EXTRACT_ARTICLE --> VALIDATE
    EXTRACT_IMAGES --> VALIDATE
    EXTRACT_LINKS --> VALIDATE
    EXTRACT_META --> VALIDATE
    
    VALIDATE --> CLEAN
    CLEAN --> TRUNCATE
    TRUNCATE --> CACHE
    CACHE --> RETURN
```

## 4. Image Search Flow


sequenceDiagram
    participant U as User
    participant F as ImagesPage<br/>(React)
    participant API as API Client
    participant B as Backend API
    participant ES as Elasticsearch
    participant MYSQL as MySQL
    participant PROXY as Image Proxy
    participant CDN as CDN/Storage
    
    U->>F: Enter image search query
    F->>F: Update search state
    F->>API: searchImages(query, page)
    API->>B: GET /api/images?q=query
    B->>B: Validate parameters
    B->>ES: Query site_img index
    
    alt Elasticsearch Success
        ES-->>B: Image results
        B->>B: Generate thumbnail URLs
        B->>B: Format response
        B-->>API: Image data with thumbnails
        API-->>F: Image results array
        F->>F: Render image grid
        
        loop For each image
            F->>F: Lazy load image
            F->>PROXY: Request image via proxy
            PROXY->>CDN: Fetch original image
            CDN-->>PROXY: Image data
            PROXY-->>F: Stream image
            F->>U: Display image
        end
    else Elasticsearch Failure
        B->>MYSQL: Query site_img table
        MYSQL-->>B: MySQL results
        B->>B: Generate thumbnails
        B-->>API: Image data
        API-->>F: Image results
        F->>F: Render image grid
        F->>U: Display images
    end
```

## 5. Video Search Flow

```
sequenceDiagram
    participant U as User
    participant F as VideosPage<br/>(React)
    participant API as API Client
    participant B as Backend API
    participant ES as Elasticsearch
    participant YT as YouTube API
    participant MYSQL as MySQL
    
    U->>F: Enter video search query
    F->>F: Update search state
    F->>API: searchVideos(query, page)
    API->>B: GET /api/videos?q=query
    
    B->>B: Validate parameters
    B->>ES: Query site_videos index
    
    alt Elasticsearch Success
        ES-->>B: Video results from index
        B->>B: Format video metadata
        B-->>API: Video data
        API-->>F: Video results
        F->>F: Render video cards
        F->>U: Display videos
    else Elasticsearch Empty
        B->>YT: Query YouTube API
        alt YouTube Success
            YT-->>B: YouTube video results
            B->>B: Transform to format
            B-->>API: Video data
            API-->>F: Video results
            F->>F: Render video cards
            F->>U: Display videos
        else YouTube Failure
            B->>MYSQL: Query site_videos table
            MYSQL-->>B: MySQL video results
            B-->>API: Video data
            API-->>F: Video results
            F->>F: Render video cards
            F->>U: Display videos
        end
    end
```

## 6. News Search Flow


flowchart TD
    START[User Enters News Query]
    FRONTEND[Frontend: NewsPage]
    API_CLIENT[API Client: searchNews]
    BACKEND[Backend: /api/news]
    VALIDATE[Validate Query]
    ES_NEWS[Elasticsearch: News Index]
    ES_GENERAL[Elasticsearch: General Search]
    MYSQL_FB[MySQL Fallback]
    FORMAT[Format as News Cards]
    CACHE[Cache Results]
    DISPLAY[Display News Cards]
    
    START --> FRONTEND
    FRONTEND --> API_CLIENT
    API_CLIENT --> BACKEND
    BACKEND --> VALIDATE
    VALIDATE --> ES_NEWS
    
    ES_NEWS -->|Results Found| FORMAT
    ES_NEWS -->|No Results| ES_GENERAL
    
    ES_GENERAL -->|Results Found| FORMAT
    ES_GENERAL -->|No Results| MYSQL_FB
    
    MYSQL_FB --> FORMAT
    FORMAT --> CACHE
    CACHE --> DISPLAY
    DISPLAY --> START
```

## 7. Site Management Flow

```
sequenceDiagram
    participant A as Admin User
    participant F as AdminPage<br/>(React)
    participant API as API Client
    participant B as Backend API
    participant V as Validator<br/>(Joi)
    participant DB as MySQL
    participant CRAWLER as Crawler System
    
    A->>F: Add new site
    F->>F: Fill site form
    F->>API: POST /api/sites
    API->>B: HTTP POST request
    B->>V: Validate site data
    
    alt Valid Data
        V-->>B: Validation passed
        B->>DB: Check if site exists
        DB-->>B: Site status
        
        alt Site Not Exists
            B->>DB: INSERT INTO sites
            DB-->>B: New site_id
            B->>CRAWLER: Trigger initial crawl
            CRAWLER-->>B: Crawl started
            B-->>API: Site created response
            API-->>F: Success message
            F->>A: Display success
        else Site Exists
            B-->>API: Conflict error
            API-->>F: Error message
            F->>A: Display error
        end
    else Invalid Data
        V-->>B: Validation errors
        B-->>API: Validation error response
        API-->>F: Error message
        F->>A: Display errors
    end
```

## 8. Duplicate Detection Flow

```
flowchart TD
    START[URL to Check]
    NORMALIZE[Normalize URL<br/>- Remove fragments<br/>- Sort query params<br/>- Lowercase domain]
    CACHE_CHECK[Check Memory Cache]
    CACHE_HIT{Cache Hit?}
    DB_CHECK[Query Database<br/>Duplicate Table]
    DB_FOUND{Found in DB?}
    CACHE_UPDATE[Update Cache]
    RETURN_DUP[Return: Duplicate]
    RETURN_NEW[Return: New URL]
    STORE[Store in Database]
    
    START --> NORMALIZE
    NORMALIZE --> CACHE_CHECK
    CACHE_CHECK --> CACHE_HIT
    
    CACHE_HIT -->|Yes| RETURN_DUP
    CACHE_HIT -->|No| DB_CHECK
    
    DB_CHECK --> DB_FOUND
    DB_FOUND -->|Yes| CACHE_UPDATE
    DB_FOUND -->|No| RETURN_NEW
    
    CACHE_UPDATE --> RETURN_DUP
    
    RETURN_NEW --> STORE
    STORE --> CACHE_CHECK
```

## 9. Content Indexing Flow

```
sequenceDiagram
    participant C as Crawler Core
    participant I as Content Indexer
    participant DUP as Duplicate Checker
    participant DB as MySQL
    participant ES as Elasticsearch
    participant IMG as Image Handler
    participant LINK as Link Extractor
    
    C->>I: indexContent(parsedData, url, siteId)
    I->>DUP: Check content hash
    DUP-->>I: Duplicate status
    
    alt Not Duplicate
        I->>I: Prepare database record
        I->>DB: INSERT INTO site_data
        DB-->>I: site_data_id
        
        I->>I: Prepare Elasticsearch document
        I->>ES: Index document
        ES-->>I: Elasticsearch ID
        
        alt Has Images
            I->>IMG: Process images
            IMG->>IMG: Extract image metadata
            IMG->>DB: INSERT INTO site_img
            IMG-->>I: Image IDs
        end
        
        alt Has Videos
            I->>I: Extract video metadata
            I->>DB: INSERT INTO site_videos
            DB-->>I: Video IDs
        end
        
        I->>LINK: Extract and store links
        LINK->>DB: Store links for crawling
        LINK-->>I: Links extracted
        
        I->>DUP: Update duplicate cache
        I-->>C: Indexing success
    else Duplicate
        I-->>C: Skip (duplicate)
    end
```

## 10. Error Handling Flow

```
flowchart TD
    START[Error Occurs]
    CAPTURE[Capture Error]
    CLASSIFY[Classify Error Type]
    
    NETWORK_ERROR{Network Error?}
    VALIDATION_ERROR{Validation Error?}
    DATABASE_ERROR{Database Error?}
    ELASTIC_ERROR{Elasticsearch Error?}
    UNKNOWN_ERROR{Unknown Error?}
    
    RETRY[Retry Logic]
    FALLBACK[Fallback Mechanism]
    LOG_ERROR[Log Error]
    USER_FRIENDLY[User-Friendly Message]
    RETURN[Return Error Response]
    
    START --> CAPTURE
    CAPTURE --> CLASSIFY
    CLASSIFY --> NETWORK_ERROR
    CLASSIFY --> VALIDATION_ERROR
    CLASSIFY --> DATABASE_ERROR
    CLASSIFY --> ELASTIC_ERROR
    CLASSIFY --> UNKNOWN_ERROR
    
    NETWORK_ERROR -->|Yes| RETRY
    RETRY -->|Success| RETURN
    RETRY -->|Failed| FALLBACK
    
    VALIDATION_ERROR -->|Yes| USER_FRIENDLY
    
    DATABASE_ERROR -->|Yes| FALLBACK
    
    ELASTIC_ERROR -->|Yes| FALLBACK
    
    UNKNOWN_ERROR -->|Yes| LOG_ERROR
    
    FALLBACK --> RETURN
    USER_FRIENDLY --> RETURN
    LOG_ERROR --> RETURN
```

## 11. Authentication & Authorization Flow

```
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant B as Backend
    participant S as Session Store<br/>(Redis/MySQL)
    participant DB as MySQL Users
    
    U->>F: Access Admin Page
    F->>F: Check authentication
    F->>B: GET /api/admin/check
    B->>S: Verify session
    S-->>B: Session status
    
    alt Not Authenticated
        B-->>F: Unauthorized
        F->>U: Redirect to login
        U->>F: Enter credentials
        F->>B: POST /api/admin/login
        B->>DB: Verify credentials
        DB-->>B: User data
        
        alt Valid Credentials
            B->>S: Create session
            S-->>B: Session ID
            B-->>F: Authentication success
            F->>U: Redirect to admin
        else Invalid Credentials
            B-->>F: Authentication failed
            F->>U: Display error
        end
    else Authenticated
        B-->>F: Authorized
        F->>U: Show admin interface
    end
```

## 12. Batch Crawling Flow

```
flowchart TD
    START[Start Batch Crawl]
    INIT[Initialize Crawler]
    LOAD_URLS[Load URL List]
    BATCH_DIVIDE[Divide into Batches]
    CONCURRENT_LIMIT[Apply Concurrency Limit]
    
    PROCESS_BATCH[Process Batch]
    PROCESS_URL[Process Each URL]
    
    FETCH[Fetch Page]
    PARSE[Parse Content]
    INDEX[Index Content]
    
    BATCH_COMPLETE{Batch Complete?}
    MORE_BATCHES{More Batches?}
    
    STATS[Update Statistics]
    CLEANUP[Cleanup Resources]
    END[End Crawl]
    
    START --> INIT
    INIT --> LOAD_URLS
    LOAD_URLS --> BATCH_DIVIDE
    BATCH_DIVIDE --> CONCURRENT_LIMIT
    CONCURRENT_LIMIT --> PROCESS_BATCH
    
    PROCESS_BATCH --> PROCESS_URL
    PROCESS_URL --> FETCH
    FETCH --> PARSE
    PARSE --> INDEX
    INDEX --> PROCESS_URL
    
    PROCESS_URL --> BATCH_COMPLETE
    BATCH_COMPLETE -->|No| PROCESS_BATCH
    BATCH_COMPLETE -->|Yes| MORE_BATCHES
    
    MORE_BATCHES -->|Yes| CONCURRENT_LIMIT
    MORE_BATCHES -->|No| STATS
    
    STATS --> CLEANUP
    CLEANUP --> END
```

## 13. Search Result Ranking Flow

```
flowchart TD
    START[Elasticsearch Results]
    EXTRACT[Extract Relevance Scores]
    
    TITLE_MATCH{Title Match?}
    DESC_MATCH{Description Match?}
    CONTENT_MATCH{Content Match?}
    
    CALCULATE[Calculate Composite Score]
    
    DATE_BOOST[Apply Date Boost<br/>Recent = Higher]
    POPULARITY_BOOST[Apply Popularity Boost<br/>More Visits = Higher]
    CATEGORY_MATCH{Category Match?}
    
    FINAL_SCORE[Final Relevance Score]
    SORT[Sort by Score]
    RANK[Assign Rank]
    RETURN[Return Ranked Results]
    
    START --> EXTRACT
    EXTRACT --> TITLE_MATCH
    TITLE_MATCH -->|Yes| CALCULATE
    TITLE_MATCH -->|No| DESC_MATCH
    
    DESC_MATCH -->|Yes| CALCULATE
    DESC_MATCH -->|No| CONTENT_MATCH
    
    CONTENT_MATCH --> CALCULATE
    
    CALCULATE --> DATE_BOOST
    DATE_BOOST --> POPULARITY_BOOST
    POPULARITY_BOOST --> CATEGORY_MATCH
    
    CATEGORY_MATCH --> FINAL_SCORE
    FINAL_SCORE --> SORT
    SORT --> RANK
    RANK --> RETURN
```

## 14. Real-time Search Suggestions Flow

```
sequenceDiagram
    participant U as User
    participant F as SearchPage<br/>(React)
    participant SUGG as SearchSuggestions<br/>Component
    participant API as API Client
    participant B as Backend
    participant DB as MySQL
    participant CACHE as Cache
    
    U->>F: Type in search box
    F->>SUGG: Query changes
    SUGG->>SUGG: Debounce input (300ms)
    
    alt Query Length >= 2
        SUGG->>CACHE: Check local cache
        CACHE-->>SUGG: Cached suggestions
        
        alt Cache Miss
            SUGG->>API: GET /api/search/suggestions?q=query
            API->>B: HTTP Request
            B->>DB: Query search_queries table
            DB-->>B: Matching queries
            B->>B: Format suggestions
            B-->>API: Suggestions array
            API-->>SUGG: Suggestions data
            SUGG->>CACHE: Cache suggestions
        end
        
        SUGG->>F: Display suggestions
        F->>U: Show dropdown
    end
    
    U->>SUGG: Click suggestion
    SUGG->>F: Trigger search
    F->>F: Perform search
```

## 15. Multi-Session Crawling Flow

```
sequenceDiagram
    participant M as Multi-Session Manager
    participant S1 as Session 1<br/>(bhoomy_com)
    participant S2 as Session 2<br/>(bhoomy_in)
    participant S3 as Session 3<br/>(bhoomy_org)
    participant DB as MySQL
    participant ES as Elasticsearch
    
    M->>M: Initialize session manager
    M->>S1: Start session 1
    M->>S2: Start session 2
    M->>S3: Start session 3
    
    par Parallel Crawling
        S1->>S1: Crawl bhoomy.com sites
        S1->>DB: Store site_data
        S1->>ES: Index content
    and
        S2->>S2: Crawl bhoomy.in sites
        S2->>DB: Store site_data
        S2->>ES: Index content
    and
        S3->>S3: Crawl bhoomy.org sites
        S3->>DB: Store site_data
        S3->>ES: Index content
    end
    
    M->>M: Aggregate statistics
    M->>DB: Store crawl statistics
    M->>M: Monitor resource usage
```

## 16. Performance Monitoring Flow

```
flowchart TD
    START[Request Received]
    START_TIME[Record Start Time]
    
    PROCESS[Process Request]
    
    DB_TIME[Record DB Query Time]
    ES_TIME[Record ES Query Time]
    CACHE_TIME[Record Cache Time]
    
    CALCULATE[Calculate Total Time]
    
    THRESHOLD{Time > Threshold?}
    
    LOG_SLOW[Log Slow Request]
    UPDATE_METRICS[Update Metrics]
    
    RESPONSE_TIME[Record Response Time]
    RETURN[Return Response]
    
    START --> START_TIME
    START_TIME --> PROCESS
    
    PROCESS --> DB_TIME
    PROCESS --> ES_TIME
    PROCESS --> CACHE_TIME
    
    DB_TIME --> CALCULATE
    ES_TIME --> CALCULATE
    CACHE_TIME --> CALCULATE
    
    CALCULATE --> THRESHOLD
    
    THRESHOLD -->|Yes| LOG_SLOW
    THRESHOLD -->|No| UPDATE_METRICS
    
    LOG_SLOW --> UPDATE_METRICS
    UPDATE_METRICS --> RESPONSE_TIME
    RESPONSE_TIME --> RETURN
```

## Key Functional Patterns

### 1. Search Pattern
- **Input Validation** → **Caching** → **Elasticsearch Query** → **Result Processing** → **Response Formatting**

### 2. Crawling Pattern
- **URL Validation** → **Duplicate Check** → **Content Fetch** → **Parsing** → **Indexing** → **Statistics Update**

### 3. Error Recovery Pattern
- **Primary Method** → **Retry Logic** → **Fallback Method** → **Error Logging** → **User Notification**

### 4. Caching Pattern
- **Check Cache** → **Cache Hit** → **Return Cached** OR **Cache Miss** → **Fetch Fresh** → **Update Cache**

### 5. Batch Processing Pattern
- **Batch Division** → **Concurrent Processing** → **Resource Monitoring** → **Result Aggregation** → **Statistics**

These functional flows demonstrate the complete lifecycle of operations in the Bhoomy Search Engine, from user interactions through data processing to result delivery.

