# SearchEngine Bhoomy - Functional Flow Diagram

## System Data Flow Overview

```mermaid
graph TB
    subgraph "Input Sources"
        URL_INPUT[URL Input]
        WEB_SOURCES[Web Sources]
        ADMIN_INPUT[Admin Input]
        SEARCH_QUERY[Search Queries]
    end
    
    subgraph "Processing Pipeline"
        URL_VALIDATION[URL Validation]
        CONTENT_FETCH[Content Fetching]
        CONTENT_PARSE[Content Parsing]
        DUPLICATE_CHECK[Duplicate Detection]
        CONTENT_INDEX[Content Indexing]
        SEARCH_PROCESS[Search Processing]
    end
    
    subgraph "Storage Systems"
        MYSQL_STORAGE[(MySQL Database)]
        ELASTIC_STORAGE[(Elasticsearch)]
        REDIS_CACHE[(Redis Cache)]
    end
    
    subgraph "Output Interfaces"
        SEARCH_RESULTS[Search Results]
        ADMIN_DASHBOARD[Admin Dashboard]
        API_RESPONSES[API Responses]
        ANALYTICS[Analytics Data]
    end
    
    URL_INPUT --> URL_VALIDATION
    WEB_SOURCES --> CONTENT_FETCH
    URL_VALIDATION --> CONTENT_FETCH
    CONTENT_FETCH --> CONTENT_PARSE
    CONTENT_PARSE --> DUPLICATE_CHECK
    DUPLICATE_CHECK --> CONTENT_INDEX
    
    CONTENT_INDEX --> MYSQL_STORAGE
    CONTENT_INDEX --> ELASTIC_STORAGE
    
    SEARCH_QUERY --> SEARCH_PROCESS
    SEARCH_PROCESS --> ELASTIC_STORAGE
    SEARCH_PROCESS --> REDIS_CACHE
    SEARCH_PROCESS --> SEARCH_RESULTS
    
    ADMIN_INPUT --> ADMIN_DASHBOARD
    ADMIN_DASHBOARD --> MYSQL_STORAGE
    
    MYSQL_STORAGE --> API_RESPONSES
    ELASTIC_STORAGE --> API_RESPONSES
    
    SEARCH_PROCESS --> ANALYTICS
    CONTENT_INDEX --> ANALYTICS
```

## Detailed Crawling Process Flow

```mermaid
sequenceDiagram
    participant A as Admin/System
    participant UV as URL Validator
    participant CF as Content Fetcher
    participant RM as Resource Monitor
    participant CP as Content Parser
    participant CH as Content Handlers
    participant DC as Duplicate Checker
    participant CI as Content Indexer
    participant DB as MySQL Database
    participant ES as Elasticsearch
    participant L as Logger
    
    Note over A,L: Web Crawling Process
    
    A->>+UV: Submit URL for crawling
    UV->>UV: Validate URL format
    UV->>UV: Check robots.txt
    UV->>UV: Normalize URL
    
    alt URL Valid
        UV->>+CF: Proceed with crawling
        CF->>+RM: Check system resources
        RM-->>-CF: Resource status
        
        alt Resources Available
            CF->>CF: Fetch HTTP content
            CF->>+CP: Parse content
            
            CP->>+CH: Route to appropriate handler
            
            alt HTML Content
                CH->>CH: Extract text, links, metadata
            else Document Content
                CH->>CH: Extract text from PDF/DOC
            else Image Content
                CH->>CH: Extract metadata, generate thumbnails
            else Video Content
                CH->>CH: Extract metadata, thumbnails
            end
            
            CH-->>-CP: Processed content
            CP-->>-CF: Parsed content data
            
            CF->>+DC: Check for duplicates
            DC->>+DB: Query existing content hash
            DB-->>-DC: Duplicate status
            
            alt Content is Unique
                DC->>+CI: Index new content
                
                par Database Storage
                    CI->>+DB: Store content metadata
                    DB-->>-CI: Storage confirmation
                and Elasticsearch Indexing
                    CI->>+ES: Index searchable content
                    ES-->>-CI: Index confirmation
                end
                
                CI-->>-DC: Indexing complete
                DC-->>-CF: Success response
            else Duplicate Found
                DC->>L: Log duplicate detection
                DC-->>-CF: Duplicate skip response
            end
            
            CF-->>-UV: Crawl complete
        else Resources Limited
            CF->>RM: Apply resource throttling
            CF->>L: Log resource constraint
            CF-->>-UV: Deferred crawl
        end
        
        UV-->>-A: Crawl result
    else URL Invalid
        UV->>L: Log invalid URL
        UV-->>-A: Validation error
    end
```

## Search Process Flow

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant API as Search API
    participant V as Input Validator
    participant QP as Query Processor
    participant ES as Elasticsearch
    participant RC as Redis Cache
    participant DB as MySQL Database
    participant AR as Analytics Recorder
    
    Note over U,AR: Search Process Flow
    
    U->>+F: Enter search query
    F->>F: Validate input locally
    F->>+API: Submit search request
    
    API->>+V: Validate search parameters
    V-->>-API: Validation result
    
    alt Valid Query
        API->>+RC: Check cache for results
        
        alt Cache Hit
            RC-->>-API: Cached results
            API->>+AR: Record cache hit
            AR-->>-API: Analytics logged
        else Cache Miss
            RC-->>-API: No cached results
            
            API->>+QP: Process search query
            QP->>QP: Build Elasticsearch query
            QP->>QP: Apply filters and sorting
            
            QP->>+ES: Execute search query
            ES-->>-QP: Search results
            
            QP->>+DB: Fetch additional metadata
            DB-->>-QP: Content metadata
            
            QP->>QP: Format and rank results
            QP-->>-API: Processed results
            
            API->>+RC: Cache search results
            RC-->>-API: Cache stored
            
            API->>+AR: Record search metrics
            AR-->>-API: Analytics logged
        end
        
        API-->>-F: Search results
        F->>F: Render results
        F-->>-U: Display search results
    else Invalid Query
        API->>+AR: Record invalid query
        AR-->>-API: Analytics logged
        API-->>-F: Validation error
        F-->>-U: Error message
    end
```

## Content Processing Flow

```mermaid
flowchart TD
    START([Content Received]) --> DETECT{Content Type Detection}
    
    DETECT -->|HTML| HTML_PROCESS[HTML Processing]
    DETECT -->|PDF| PDF_PROCESS[PDF Processing]
    DETECT -->|DOC/DOCX| DOC_PROCESS[Document Processing]
    DETECT -->|Image| IMAGE_PROCESS[Image Processing]
    DETECT -->|Video| VIDEO_PROCESS[Video Processing]
    DETECT -->|Unknown| SKIP[Skip Processing]
    
    HTML_PROCESS --> HTML_EXTRACT[Extract HTML Elements]
    HTML_EXTRACT --> TEXT_CLEAN[Clean Text Content]
    TEXT_CLEAN --> META_EXTRACT[Extract Metadata]
    META_EXTRACT --> LINKS_EXTRACT[Extract Links]
    
    PDF_PROCESS --> PDF_TEXT[Extract PDF Text]
    PDF_TEXT --> PDF_META[Extract PDF Metadata]
    
    DOC_PROCESS --> DOC_TEXT[Extract Document Text]
    DOC_TEXT --> DOC_META[Extract Document Metadata]
    
    IMAGE_PROCESS --> IMAGE_META[Extract Image Metadata]
    IMAGE_META --> THUMBNAIL[Generate Thumbnail]
    
    VIDEO_PROCESS --> VIDEO_META[Extract Video Metadata]
    VIDEO_META --> VIDEO_THUMB[Generate Video Thumbnail]
    
    LINKS_EXTRACT --> NORMALIZE[Normalize Content]
    PDF_META --> NORMALIZE
    DOC_META --> NORMALIZE
    THUMBNAIL --> NORMALIZE
    VIDEO_THUMB --> NORMALIZE
    
    NORMALIZE --> QUALITY_CHECK{Quality Assessment}
    QUALITY_CHECK -->|Pass| HASH_CONTENT[Generate Content Hash]
    QUALITY_CHECK -->|Fail| SKIP
    
    HASH_CONTENT --> DUPLICATE_CHECK{Check Duplicates}
    DUPLICATE_CHECK -->|Unique| INDEX_CONTENT[Index Content]
    DUPLICATE_CHECK -->|Duplicate| LOG_DUPLICATE[Log Duplicate]
    
    INDEX_CONTENT --> STORE_DB[Store in MySQL]
    INDEX_CONTENT --> STORE_ES[Store in Elasticsearch]
    
    STORE_DB --> SUCCESS([Processing Complete])
    STORE_ES --> SUCCESS
    LOG_DUPLICATE --> SKIP
    SKIP --> END([Processing Skipped])
```

## Error Handling Flow

```mermaid
stateDiagram-v2
    [*] --> Normal_Operation
    
    Normal_Operation --> Error_Detected : Exception Occurs
    
    Error_Detected --> Categorize_Error : Log Error Details
    
    Categorize_Error --> Network_Error : Connection/Timeout
    Categorize_Error --> Database_Error : DB Connection/Query
    Categorize_Error --> Parse_Error : Content Parsing
    Categorize_Error --> Resource_Error : Memory/CPU/File Descriptors
    Categorize_Error --> Unknown_Error : Unhandled Exception
    
    Network_Error --> Retry_Logic : Implement Backoff
    Database_Error --> Connection_Recovery : Reconnect Database
    Parse_Error --> Skip_Content : Continue Processing
    Resource_Error --> Emergency_Mode : Throttle Operations
    Unknown_Error --> Log_Critical : Alert Admin
    
    Retry_Logic --> Success : Network Restored
    Retry_Logic --> Max_Retries : Retries Exhausted
    
    Connection_Recovery --> Success : Connection Restored
    Connection_Recovery --> Max_Retries : Cannot Reconnect
    
    Skip_Content --> Success : Continue Next Item
    
    Emergency_Mode --> Resource_Check : Monitor Resources
    Resource_Check --> Normal_Operation : Resources Available
    Resource_Check --> Emergency_Mode : Still Limited
    
    Log_Critical --> Manual_Intervention : Require Admin
    Manual_Intervention --> Normal_Operation : Issue Resolved
    
    Max_Retries --> Failure_State : Mark as Failed
    Failure_State --> Queue_Retry : Schedule Future Retry
    Queue_Retry --> Normal_Operation : Retry Later
    
    Success --> Normal_Operation : Resume Processing
```

## Admin Dashboard Flow

```mermaid
graph TB
    ADMIN_LOGIN[Admin Login] --> AUTH_CHECK{Authentication}
    AUTH_CHECK -->|Valid| DASHBOARD[Admin Dashboard]
    AUTH_CHECK -->|Invalid| LOGIN_ERROR[Login Error]
    
    DASHBOARD --> SYSTEM_STATUS[System Status View]
    DASHBOARD --> CRAWL_MGMT[Crawl Management]
    DASHBOARD --> SITE_MGMT[Site Management]
    DASHBOARD --> ANALYTICS_VIEW[Analytics View]
    DASHBOARD --> CONFIG_MGMT[Configuration Management]
    
    SYSTEM_STATUS --> HEALTH_CHECK[Health Check API]
    SYSTEM_STATUS --> RESOURCE_STATS[Resource Statistics]
    SYSTEM_STATUS --> ERROR_LOGS[Error Log Viewer]
    
    CRAWL_MGMT --> START_CRAWL[Start Crawl Job]
    CRAWL_MGMT --> STOP_CRAWL[Stop Crawl Job]
    CRAWL_MGMT --> CRAWL_STATUS[View Crawl Status]
    CRAWL_MGMT --> CRAWL_LOGS[View Crawl Logs]
    
    SITE_MGMT --> ADD_SITE[Add New Site]
    SITE_MGMT --> EDIT_SITE[Edit Site Config]
    SITE_MGMT --> DELETE_SITE[Delete Site]
    SITE_MGMT --> SITE_STATS[Site Statistics]
    
    ANALYTICS_VIEW --> SEARCH_ANALYTICS[Search Analytics]
    ANALYTICS_VIEW --> CONTENT_ANALYTICS[Content Analytics]
    ANALYTICS_VIEW --> PERFORMANCE_METRICS[Performance Metrics]
    
    CONFIG_MGMT --> CRAWLER_CONFIG[Crawler Settings]
    CONFIG_MGMT --> SEARCH_CONFIG[Search Settings]
    CONFIG_MGMT --> SECURITY_CONFIG[Security Settings]
    
    HEALTH_CHECK --> DB_CHECK[(Database Health)]
    HEALTH_CHECK --> ES_CHECK[(Elasticsearch Health)]
    HEALTH_CHECK --> REDIS_CHECK[(Redis Health)]
    
    START_CRAWL --> QUEUE_CRAWL[Add to Crawl Queue]
    STOP_CRAWL --> CANCEL_CRAWL[Cancel Active Crawls]
    
    ADD_SITE --> VALIDATE_SITE[Validate Site URL]
    VALIDATE_SITE --> STORE_SITE[Store Site Config]
    
    SEARCH_ANALYTICS --> QUERY_STATS[Query Statistics]
    SEARCH_ANALYTICS --> RESULT_STATS[Result Statistics]
    
    CONTENT_ANALYTICS --> INDEX_STATS[Index Statistics]
    CONTENT_ANALYTICS --> CRAWL_STATS[Crawl Statistics]
```

## API Request Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant MW as Middleware Stack
    participant RL as Rate Limiter
    participant V as Validator
    participant AUTH as Authenticator
    participant CTRL as Controller
    participant M as Model
    participant DB as Database
    participant CACHE as Cache
    
    Note over C,CACHE: API Request Processing
    
    C->>+MW: HTTP Request
    MW->>+RL: Check rate limits
    
    alt Within Rate Limits
        RL->>+V: Validate request
        V->>V: Schema validation
        V->>V: Input sanitization
        
        alt Valid Request
            V->>+AUTH: Authenticate request
            
            alt Authenticated/Public
                AUTH->>+CTRL: Route to controller
                CTRL->>+M: Call model method
                
                M->>+CACHE: Check cache
                alt Cache Hit
                    CACHE-->>-M: Cached data
                else Cache Miss
                    CACHE-->>-M: No cache
                    M->>+DB: Query database
                    DB-->>-M: Database result
                    M->>CACHE: Update cache
                end
                
                M-->>-CTRL: Data result
                CTRL->>CTRL: Format response
                CTRL-->>-AUTH: Response data
                
                AUTH-->>-V: Success response
            else Authentication Failed
                AUTH-->>-V: Auth error
            end
            
            V-->>-RL: Response
        else Invalid Request
            V-->>-RL: Validation error
        end
        
        RL-->>-MW: Final response
    else Rate Limit Exceeded
        RL-->>-MW: Rate limit error
    end
    
    MW->>MW: Add security headers
    MW->>MW: Log request
    MW-->>-C: HTTP Response
```

This functional flow documentation provides a comprehensive view of how data moves through the SearchEngine Bhoomy system, from initial input through processing, storage, and final output, including error handling and administrative functions. 