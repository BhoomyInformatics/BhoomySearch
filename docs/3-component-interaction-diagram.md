# SearchEngine Bhoomy - Component Interaction Diagram

## Core Component Interactions

```mermaid
graph TB
    subgraph "Crawler Components"
        CRAWLER_CORE[CrawlerCore]
        CONTENT_PARSER[ContentParser]
        CONTENT_INDEXER[ContentIndexer]
        URL_VALIDATOR[URLValidator]
        DUPLICATE_CHECKER[DuplicateChecker]
        RESOURCE_MONITOR[ResourceMonitor]
        
        subgraph "Content Handlers"
            HTML_HANDLER[HTMLHandler]
            DOC_HANDLER[DocumentHandler]
            IMAGE_HANDLER[ImageHandler]
            DATA_HANDLER[DataHandler]
            CONTENT_TYPE_HANDLER[ContentTypeHandler]
        end
        
        subgraph "Configuration"
            CRAWLER_CONFIG[CrawlerConfig]
            ELASTIC_CONFIG[ElasticConfig]
            DB_CONFIG[DatabaseConfig]
        end
    end
    
    subgraph "Search Components"
        EXPRESS_APP[Express Application]
        API_ROUTES[API Routes]
        SEARCH_CONTROLLER[SearchController]
        SITE_CONTROLLER[SiteController]
        ADMIN_CONTROLLER[AdminController]
        
        subgraph "Models"
            SEARCH_MODEL[SearchModel]
            SITE_MODEL[SiteModel]
            ELASTIC_MODEL[ElasticSearchModel]
        end
        
        subgraph "Frontend"
            REACT_APP[React Application]
            SEARCH_PAGE[SearchPage]
            HOME_PAGE[HomePage]
            ADMIN_PAGE[AdminPage]
            SEARCH_STORE[SearchStore]
        end
    end
    
    subgraph "Data Layer"
        MYSQL_DB[(MySQL Database)]
        ELASTICSEARCH[(Elasticsearch)]
        REDIS_CACHE[(Redis Cache)]
    end
    
    %% Crawler Interactions
    CRAWLER_CORE --> URL_VALIDATOR
    CRAWLER_CORE --> CONTENT_PARSER
    CRAWLER_CORE --> RESOURCE_MONITOR
    
    CONTENT_PARSER --> HTML_HANDLER
    CONTENT_PARSER --> DOC_HANDLER
    CONTENT_PARSER --> IMAGE_HANDLER
    CONTENT_PARSER --> DATA_HANDLER
    CONTENT_PARSER --> CONTENT_TYPE_HANDLER
    
    CONTENT_INDEXER --> DUPLICATE_CHECKER
    CONTENT_INDEXER --> MYSQL_DB
    CONTENT_INDEXER --> ELASTICSEARCH
    
    CRAWLER_CONFIG --> CRAWLER_CORE
    ELASTIC_CONFIG --> CONTENT_INDEXER
    DB_CONFIG --> CONTENT_INDEXER
    
    %% Search Interactions
    EXPRESS_APP --> API_ROUTES
    API_ROUTES --> SEARCH_CONTROLLER
    API_ROUTES --> SITE_CONTROLLER
    API_ROUTES --> ADMIN_CONTROLLER
    
    SEARCH_CONTROLLER --> SEARCH_MODEL
    SITE_CONTROLLER --> SITE_MODEL
    ADMIN_CONTROLLER --> ELASTIC_MODEL
    
    SEARCH_MODEL --> MYSQL_DB
    SEARCH_MODEL --> ELASTICSEARCH
    SEARCH_MODEL --> REDIS_CACHE
    
    REACT_APP --> SEARCH_PAGE
    REACT_APP --> HOME_PAGE
    REACT_APP --> ADMIN_PAGE
    
    SEARCH_PAGE --> SEARCH_STORE
    SEARCH_STORE --> API_ROUTES
    
    %% Cross-module interactions
    HTML_HANDLER --> CONTENT_INDEXER
    DOC_HANDLER --> CONTENT_INDEXER
    IMAGE_HANDLER --> CONTENT_INDEXER
```

## Detailed Component Flow Diagram

```mermaid
sequenceDiagram
    participant WEB as Web Source
    participant CC as CrawlerCore
    participant UV as URLValidator
    participant CP as ContentParser
    participant HH as HTMLHandler
    participant DH as DocumentHandler
    participant IH as ImageHandler
    participant DC as DuplicateChecker
    participant CI as ContentIndexer
    participant DB as MySQL
    participant ES as Elasticsearch
    participant RM as ResourceMonitor
    
    Note over WEB,RM: Crawling Process Flow
    
    WEB->>+CC: HTTP Request
    CC->>+UV: Validate URL
    UV-->>-CC: Validation Result
    
    alt Valid URL
        CC->>+RM: Check Resources
        RM-->>-CC: Resource Status
        
        alt Resources Available
            CC->>+CP: Parse Content
            CP->>+HH: Process HTML
            HH-->>-CP: Parsed HTML
            
            CP->>+DH: Process Documents
            DH-->>-CP: Parsed Documents
            
            CP->>+IH: Process Images
            IH-->>-CP: Processed Images
            
            CP-->>-CC: Parsed Content
            
            CC->>+DC: Check Duplicates
            DC->>+DB: Query Existing
            DB-->>-DC: Query Result
            DC-->>-CC: Duplicate Status
            
            alt Not Duplicate
                CC->>+CI: Index Content
                CI->>+DB: Store Metadata
                DB-->>-CI: Storage Result
                
                CI->>+ES: Index Content
                ES-->>-CI: Index Result
                CI-->>-CC: Indexing Complete
            else Duplicate Found
                CC->>CC: Skip Indexing
            end
        else Resources Limited
            CC->>CC: Apply Throttling
        end
    else Invalid URL
        CC->>CC: Skip URL
    end
```

## Frontend Component Interactions

```mermaid
graph TB
    subgraph "React Frontend Architecture"
        APP[App.tsx]
        ROUTER[React Router]
        
        subgraph "Pages"
            HOME[HomePage]
            SEARCH[SearchPage]
            IMAGES[ImagesPage]
            VIDEOS[VideosPage]
            NEWS[NewsPage]
            ADMIN[AdminPage]
        end
        
        subgraph "Components"
            HEADER[Header]
            FOOTER[Footer]
            SEARCH_SUGGESTIONS[SearchSuggestions]
        end
        
        subgraph "State Management"
            SEARCH_STORE[SearchStore]
        end
        
        subgraph "Utils"
            API_CLIENT[ApiClient]
            MOCK_API[MockApi]
        end
        
        subgraph "Backend API"
            API_ROUTES_BE[API Routes]
            SEARCH_ENDPOINT[/api/search]
            HEALTH_ENDPOINT[/api/health]
        end
    end
    
    APP --> ROUTER
    ROUTER --> HOME
    ROUTER --> SEARCH
    ROUTER --> IMAGES
    ROUTER --> VIDEOS
    ROUTER --> NEWS
    ROUTER --> ADMIN
    
    HOME --> HEADER
    SEARCH --> HEADER
    SEARCH --> SEARCH_SUGGESTIONS
    
    SEARCH --> SEARCH_STORE
    SEARCH_STORE --> API_CLIENT
    API_CLIENT --> SEARCH_ENDPOINT
    API_CLIENT --> HEALTH_ENDPOINT
    
    SEARCH_ENDPOINT --> API_ROUTES_BE
    HEALTH_ENDPOINT --> API_ROUTES_BE
    
    HEADER --> FOOTER
```

## Database Interaction Patterns

```mermaid
graph LR
    subgraph "Application Layer"
        CRAWLER[Crawler]
        SEARCH_API[Search API]
        ADMIN_API[Admin API]
    end
    
    subgraph "Data Access Layer"
        INDEXER[ContentIndexer]
        SEARCH_MODEL[SearchModel]
        SITE_MODEL[SiteModel]
    end
    
    subgraph "Database Layer"
        subgraph "MySQL Tables"
            SITES[sites]
            SITE_DATA[site_data]
            SITE_IMAGES[site_images]
            SITE_VIDEOS[site_videos]
            SITE_DOCUMENTS[site_documents]
        end
        
        subgraph "Elasticsearch Indices"
            BHOOMY_INDEX[bhoomy_search]
        end
    end
    
    CRAWLER --> INDEXER
    SEARCH_API --> SEARCH_MODEL
    ADMIN_API --> SITE_MODEL
    
    INDEXER --> SITES
    INDEXER --> SITE_DATA
    INDEXER --> SITE_IMAGES
    INDEXER --> SITE_VIDEOS
    INDEXER --> SITE_DOCUMENTS
    INDEXER --> BHOOMY_INDEX
    
    SEARCH_MODEL --> SITE_DATA
    SEARCH_MODEL --> BHOOMY_INDEX
    
    SITE_MODEL --> SITES
```

## Error Handling Component Flow

```mermaid
stateDiagram-v2
    [*] --> Normal_Operation
    
    Normal_Operation --> Error_Detected : Exception/Error
    Error_Detected --> Log_Error : Log Error Details
    Log_Error --> Check_Error_Type : Categorize Error
    
    Check_Error_Type --> Database_Error : DB Connection/Query Error
    Check_Error_Type --> Network_Error : HTTP/Network Error
    Check_Error_Type --> Memory_Error : Memory/Resource Error
    Check_Error_Type --> Parse_Error : Content Parse Error
    
    Database_Error --> Retry_Connection : Attempt Reconnection
    Network_Error --> Retry_Request : Retry with Backoff
    Memory_Error --> Cleanup_Memory : Garbage Collection
    Parse_Error --> Skip_Content : Skip & Continue
    
    Retry_Connection --> Success : Connection Restored
    Retry_Connection --> Emergency_Mode : Max Retries Exceeded
    
    Retry_Request --> Success : Request Successful
    Retry_Request --> Emergency_Mode : Max Retries Exceeded
    
    Cleanup_Memory --> Success : Memory Freed
    Cleanup_Memory --> Emergency_Mode : Cannot Free Memory
    
    Skip_Content --> Success : Continue Processing
    
    Success --> Normal_Operation : Resume Operations
    Emergency_Mode --> Manual_Intervention : Require Admin Action
    Manual_Intervention --> Normal_Operation : Issue Resolved
```

## Configuration Component Dependencies

```mermaid
graph TB
    subgraph "Configuration Hierarchy"
        ROOT_CONFIG[package.json<br/>Root Configuration]
        
        subgraph "Crawler Configuration"
            CRAWLER_CONFIG[crawlerConfig.js]
            ELASTIC_CONFIG[elasticConfig.js]
            DB_CONFIG[db.js]
            HEADERS_CONFIG[headers.js]
            PROXIES_CONFIG[proxies.js]
            USER_AGENTS_CONFIG[user-agents.js]
        end
        
        subgraph "Search Configuration"
            APP_CONFIG[app.js Configuration]
            FRONTEND_CONFIG[vite.config.ts]
            TAILWIND_CONFIG[tailwind.config.js]
        end
        
        subgraph "Environment Configuration"
            ENV_EXAMPLE[env.example]
            ENV_LOCAL[.env]
        end
    end
    
    ROOT_CONFIG --> CRAWLER_CONFIG
    ROOT_CONFIG --> APP_CONFIG
    
    CRAWLER_CONFIG --> ELASTIC_CONFIG
    CRAWLER_CONFIG --> DB_CONFIG
    CRAWLER_CONFIG --> HEADERS_CONFIG
    CRAWLER_CONFIG --> PROXIES_CONFIG
    CRAWLER_CONFIG --> USER_AGENTS_CONFIG
    
    APP_CONFIG --> FRONTEND_CONFIG
    FRONTEND_CONFIG --> TAILWIND_CONFIG
    
    ENV_EXAMPLE --> ENV_LOCAL
    ENV_LOCAL --> CRAWLER_CONFIG
    ENV_LOCAL --> APP_CONFIG
```

## Performance Monitoring Component Flow

```mermaid
graph TB
    subgraph "Monitoring Components"
        RESOURCE_MONITOR[ResourceMonitor]
        HEALTH_CHECK[HealthCheck]
        WINSTON_LOGGER[Winston Logger]
        PERFORMANCE_METRICS[Performance Metrics]
    end
    
    subgraph "System Resources"
        CPU[CPU Usage]
        MEMORY[Memory Usage]
        DISK[Disk I/O]
        NETWORK[Network I/O]
        FILE_DESCRIPTORS[File Descriptors]
    end
    
    subgraph "Application Metrics"
        CRAWL_RATE[Crawl Rate]
        INDEX_RATE[Index Rate]
        ERROR_RATE[Error Rate]
        RESPONSE_TIME[Response Time]
    end
    
    subgraph "Alert System"
        THRESHOLD_CHECK[Threshold Check]
        ALERT_MANAGER[Alert Manager]
        EMERGENCY_MODE[Emergency Mode]
    end
    
    RESOURCE_MONITOR --> CPU
    RESOURCE_MONITOR --> MEMORY
    RESOURCE_MONITOR --> DISK
    RESOURCE_MONITOR --> NETWORK
    RESOURCE_MONITOR --> FILE_DESCRIPTORS
    
    HEALTH_CHECK --> CRAWL_RATE
    HEALTH_CHECK --> INDEX_RATE
    HEALTH_CHECK --> ERROR_RATE
    HEALTH_CHECK --> RESPONSE_TIME
    
    RESOURCE_MONITOR --> THRESHOLD_CHECK
    HEALTH_CHECK --> THRESHOLD_CHECK
    
    THRESHOLD_CHECK --> ALERT_MANAGER
    ALERT_MANAGER --> EMERGENCY_MODE
    ALERT_MANAGER --> WINSTON_LOGGER
    
    WINSTON_LOGGER --> PERFORMANCE_METRICS
```

## Inter-Service Communication

```mermaid
graph LR
    subgraph "Crawler Service"
        CRAWLER_API[Crawler API]
        CRAWLER_WORKER[Crawler Worker]
    end
    
    subgraph "Search Service"
        SEARCH_API[Search API]
        FRONTEND[Frontend App]
    end
    
    subgraph "Admin Service"
        ADMIN_API[Admin API]
        ADMIN_PANEL[Admin Panel]
    end
    
    subgraph "Shared Resources"
        MYSQL_SHARED[(MySQL)]
        ELASTIC_SHARED[(Elasticsearch)]
        REDIS_SHARED[(Redis)]
    end
    
    CRAWLER_API <--> CRAWLER_WORKER
    CRAWLER_WORKER --> MYSQL_SHARED
    CRAWLER_WORKER --> ELASTIC_SHARED
    
    FRONTEND --> SEARCH_API
    SEARCH_API --> MYSQL_SHARED
    SEARCH_API --> ELASTIC_SHARED
    SEARCH_API --> REDIS_SHARED
    
    ADMIN_PANEL --> ADMIN_API
    ADMIN_API --> MYSQL_SHARED
    ADMIN_API --> ELASTIC_SHARED
    ADMIN_API --> CRAWLER_API
```

This component interaction diagram provides a comprehensive view of how all components in the SearchEngine Bhoomy system interact with each other, from the high-level architecture down to individual component communications and data flows. 