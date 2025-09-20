# Bhoomy Search Engine - Architecture Diagram

## Overview
This document provides detailed architectural diagrams for the Bhoomy Search Engine, illustrating the system's components, data flow, and interactions between different layers.

## 1. High-Level System Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        WEB[Web Browser]
        PWA[Progressive Web App]
        MOB[Mobile Devices]
    end
    
    subgraph "Frontend Layer"
        REACT[React 18 + TypeScript]
        VITE[Vite Build Tool]
        TAILWIND[TailwindCSS]
        ZUSTAND[Zustand State Management]
    end
    
    subgraph "Backend Layer"
        EXPRESS[Express.js Server]
        MIDDLEWARE[Security Middleware]
        ROUTES[API Routes]
        CONTROLLERS[Controllers]
        MODELS[Data Models]
    end
    
    subgraph "Data Layer"
        ELASTICSEARCH[Elasticsearch 8+]
        MYSQL[MySQL Database]
        REDIS[Redis Cache]
        LOGS[Winston Logs]
    end
    
    subgraph "External Services"
        YOUTUBE[YouTube API]
        GOOGLE[Google Search API]
        NEWS[News APIs]
    end
    
    WEB --> REACT
    PWA --> REACT
    MOB --> REACT
    
    REACT --> EXPRESS
    VITE --> REACT
    TAILWIND --> REACT
    ZUSTAND --> REACT
    
    EXPRESS --> MIDDLEWARE
    MIDDLEWARE --> ROUTES
    ROUTES --> CONTROLLERS
    CONTROLLERS --> MODELS
    
    MODELS --> ELASTICSEARCH
    MODELS --> MYSQL
    MODELS --> REDIS
    MODELS --> LOGS
    
    CONTROLLERS --> YOUTUBE
    CONTROLLERS --> GOOGLE
    CONTROLLERS --> NEWS
```

## 2. Backend Architecture Details

```mermaid
graph TB
    subgraph "Express.js Application"
        APP[app.js]
        MIDDLEWARE_STACK[Middleware Stack]
        ROUTING[Route Handlers]
    end
    
    subgraph "Middleware Components"
        HELMET[Helmet Security]
        CORS[CORS Handler]
        RATELIMIT[Rate Limiting]
        COMPRESSION[Response Compression]
        BODYPARSER[Body Parser]
        SESSION[Session Management]
        LOGGER[Winston Logger]
    end
    
    subgraph "Route Handlers"
        SEARCH_ROUTES[Search Routes]
        ADMIN_ROUTES[Admin Routes]
        API_ROUTES[API Routes]
        LEGACY_ROUTES[Legacy Routes]
    end
    
    subgraph "Controllers"
        SITE_CONTROLLER[Site Controller]
        ADMIN_CONTROLLER[Admin Controller]
        ROOT_CONTROLLER[Root Controller]
    end
    
    subgraph "Models"
        ELASTIC_MODEL[Elasticsearch Model]
        SITE_MODEL[Site Model]
        SEARCH_MODEL[Search Model]
    end
    
    APP --> MIDDLEWARE_STACK
    MIDDLEWARE_STACK --> ROUTING
    
    MIDDLEWARE_STACK --> HELMET
    MIDDLEWARE_STACK --> CORS
    MIDDLEWARE_STACK --> RATELIMIT
    MIDDLEWARE_STACK --> COMPRESSION
    MIDDLEWARE_STACK --> BODYPARSER
    MIDDLEWARE_STACK --> SESSION
    MIDDLEWARE_STACK --> LOGGER
    
    ROUTING --> SEARCH_ROUTES
    ROUTING --> ADMIN_ROUTES
    ROUTING --> API_ROUTES
    ROUTING --> LEGACY_ROUTES
    
    SEARCH_ROUTES --> SITE_CONTROLLER
    ADMIN_ROUTES --> ADMIN_CONTROLLER
    API_ROUTES --> ROOT_CONTROLLER
    
    SITE_CONTROLLER --> ELASTIC_MODEL
    SITE_CONTROLLER --> SITE_MODEL
    SITE_CONTROLLER --> SEARCH_MODEL
```

## 3. Frontend Architecture Details

```mermaid
graph TB
    subgraph "React Application"
        MAIN[main.tsx]
        APP_COMPONENT[App.tsx]
        ROUTER[React Router]
    end
    
    subgraph "Page Components"
        HOME[HomePage]
        SEARCH[SearchPage]
        IMAGES[ImagesPage]
        VIDEOS[VideosPage]
        NEWS[NewsPage]
        ADMIN[AdminPage]
    end
    
    subgraph "Shared Components"
        HEADER[Header]
        FOOTER[Footer]
        SUGGESTIONS[SearchSuggestions]
    end
    
    subgraph "State Management"
        STORE[Zustand Store]
        SEARCH_STATE[Search State]
        USER_STATE[User State]
        FILTERS[Filter State]
    end
    
    subgraph "Utilities"
        API_CLIENT[API Client]
        TYPES[TypeScript Types]
        HELPERS[Helper Functions]
    end
    
    MAIN --> APP_COMPONENT
    APP_COMPONENT --> ROUTER
    
    ROUTER --> HOME
    ROUTER --> SEARCH
    ROUTER --> IMAGES
    ROUTER --> VIDEOS
    ROUTER --> NEWS
    ROUTER --> ADMIN
    
    HOME --> HEADER
    SEARCH --> HEADER
    IMAGES --> HEADER
    VIDEOS --> HEADER
    NEWS --> HEADER
    ADMIN --> HEADER
    
    HOME --> SUGGESTIONS
    SEARCH --> SUGGESTIONS
    
    STORE --> SEARCH_STATE
    STORE --> USER_STATE
    STORE --> FILTERS
    
    SEARCH --> API_CLIENT
    IMAGES --> API_CLIENT
    VIDEOS --> API_CLIENT
    NEWS --> API_CLIENT
    
    API_CLIENT --> TYPES
    API_CLIENT --> HELPERS
```

## 4. Data Flow Architecture

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant API as Express API
    participant ES as Elasticsearch
    participant DB as MySQL
    participant C as Cache
    
    U->>F: Enter search query
    F->>F: Update Zustand store
    F->>API: HTTP request with query
    API->>API: Validate input
    API->>ES: Search query
    ES-->>API: Search results
    API->>DB: Fallback if ES fails
    DB-->>API: Backup results
    API->>C: Cache results
    API->>F: JSON response
    F->>F: Update state
    F->>U: Display results
```

## 5. Search Engine Architecture

```mermaid
graph TB
    subgraph "Search Input Processing"
        QUERY[User Query]
        VALIDATION[Input Validation]
        PREPROCESSING[Query Preprocessing]
        FILTERING[Filter Application]
    end
    
    subgraph "Search Execution"
        ES_SEARCH[Elasticsearch Search]
        MYSQL_FALLBACK[MySQL Fallback]
        EXTERNAL_APIS[External APIs]
        AGGREGATION[Result Aggregation]
    end
    
    subgraph "Result Processing"
        DEDUPLICATION[Deduplication]
        RANKING[Relevance Ranking]
        HIGHLIGHTING[Text Highlighting]
        PAGINATION[Pagination]
    end
    
    subgraph "Response Generation"
        FORMATTING[Response Formatting]
        SUGGESTIONS[Query Suggestions]
        METADATA[Response Metadata]
        CACHING[Response Caching]
    end
    
    QUERY --> VALIDATION
    VALIDATION --> PREPROCESSING
    PREPROCESSING --> FILTERING
    
    FILTERING --> ES_SEARCH
    FILTERING --> MYSQL_FALLBACK
    FILTERING --> EXTERNAL_APIS
    
    ES_SEARCH --> AGGREGATION
    MYSQL_FALLBACK --> AGGREGATION
    EXTERNAL_APIS --> AGGREGATION
    
    AGGREGATION --> DEDUPLICATION
    DEDUPLICATION --> RANKING
    RANKING --> HIGHLIGHTING
    HIGHLIGHTING --> PAGINATION
    
    PAGINATION --> FORMATTING
    FORMATTING --> SUGGESTIONS
    SUGGESTIONS --> METADATA
    METADATA --> CACHING
```

## 6. Security Architecture

```mermaid
graph TB
    subgraph "Security Layers"
        HELMET_SECURITY[Helmet Security Headers]
        RATE_LIMITING[Rate Limiting]
        INPUT_VALIDATION[Input Validation]
        SESSION_MGMT[Session Management]
        AUTH[Authentication]
        CORS_POLICY[CORS Policy]
    end
    
    subgraph "Request Flow"
        INCOMING[Incoming Request]
        SECURITY_CHECK[Security Checks]
        VALIDATION_CHECK[Validation]
        PROCESSING[Request Processing]
        RESPONSE[Secure Response]
    end
    
    subgraph "Data Protection"
        ENCRYPTION[Data Encryption]
        SANITIZATION[Input Sanitization]
        SECURE_HEADERS[Secure Headers]
        HTTPS_ONLY[HTTPS Only]
    end
    
    INCOMING --> HELMET_SECURITY
    HELMET_SECURITY --> RATE_LIMITING
    RATE_LIMITING --> CORS_POLICY
    CORS_POLICY --> INPUT_VALIDATION
    INPUT_VALIDATION --> SESSION_MGMT
    SESSION_MGMT --> AUTH
    
    AUTH --> SECURITY_CHECK
    SECURITY_CHECK --> VALIDATION_CHECK
    VALIDATION_CHECK --> PROCESSING
    PROCESSING --> RESPONSE
    
    PROCESSING --> ENCRYPTION
    PROCESSING --> SANITIZATION
    PROCESSING --> SECURE_HEADERS
    PROCESSING --> HTTPS_ONLY
```

## 7. Database Architecture

```mermaid
erDiagram
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
        datetime site_created
        datetime site_updated
    }
    
    CONTENT {
        int content_id PK
        int site_id FK
        string content_title
        string content_description
        text content_article
        string content_url
        string content_image
        datetime content_date
        int content_word_count
        boolean content_active
    }
    
    SEARCH_LOGS {
        int log_id PK
        string search_query
        string search_filters
        int results_count
        string user_ip
        datetime search_timestamp
        float response_time
    }
    
    USERS {
        int user_id PK
        string user_name
        string user_email
        string user_password_hash
        string user_type
        boolean user_active
        datetime user_created
        datetime user_last_login
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
    
    SITES ||--o{ CONTENT : contains
    SITES ||--o{ CRAWL_STATISTICS : tracks
    USERS ||--o{ SEARCH_LOGS : performs
```

## 8. Caching Architecture

```mermaid
graph TB
    subgraph "Cache Layers"
        REDIS[Redis Cache]
        MEMORY[In-Memory Cache]
        BROWSER[Browser Cache]
        CDN[CDN Cache]
    end
    
    subgraph "Cache Strategies"
        SEARCH_CACHE[Search Results Cache]
        SESSION_CACHE[Session Cache]
        STATIC_CACHE[Static Assets Cache]
        API_CACHE[API Response Cache]
    end
    
    subgraph "Cache Operations"
        READ[Cache Read]
        WRITE[Cache Write]
        INVALIDATE[Cache Invalidation]
        EXPIRE[Cache Expiration]
    end
    
    REDIS --> SEARCH_CACHE
    REDIS --> SESSION_CACHE
    MEMORY --> API_CACHE
    BROWSER --> STATIC_CACHE
    CDN --> STATIC_CACHE
    
    SEARCH_CACHE --> READ
    SEARCH_CACHE --> WRITE
    SESSION_CACHE --> READ
    SESSION_CACHE --> WRITE
    
    READ --> INVALIDATE
    WRITE --> EXPIRE
```

## 9. Monitoring and Logging Architecture

```mermaid
graph TB
    subgraph "Logging Components"
        WINSTON[Winston Logger]
        CONSOLE[Console Transport]
        FILE[File Transport]
        ERROR_LOG[Error Log]
        COMBINED_LOG[Combined Log]
    end
    
    subgraph "Monitoring Components"
        HEALTH_CHECK[Health Check]
        METRICS[Performance Metrics]
        ALERTS[Alert System]
        DASHBOARD[Monitoring Dashboard]
    end
    
    subgraph "Log Sources"
        API_LOGS[API Requests]
        SEARCH_LOGS[Search Queries]
        ERROR_LOGS[Application Errors]
        SECURITY_LOGS[Security Events]
        PERFORMANCE_LOGS[Performance Metrics]
    end
    
    WINSTON --> CONSOLE
    WINSTON --> FILE
    FILE --> ERROR_LOG
    FILE --> COMBINED_LOG
    
    API_LOGS --> WINSTON
    SEARCH_LOGS --> WINSTON
    ERROR_LOGS --> WINSTON
    SECURITY_LOGS --> WINSTON
    PERFORMANCE_LOGS --> WINSTON
    
    WINSTON --> HEALTH_CHECK
    HEALTH_CHECK --> METRICS
    METRICS --> ALERTS
    ALERTS --> DASHBOARD
```

## 10. Deployment Architecture

```mermaid
graph TB
    subgraph "Production Environment"
        NGINX[Nginx Reverse Proxy]
        PM2[PM2 Process Manager]
        NODE_CLUSTER[Node.js Cluster]
        HTTPS[HTTPS/SSL]
    end
    
    subgraph "Services"
        ELASTICSEARCH_CLUSTER[Elasticsearch Cluster]
        MYSQL_MASTER[MySQL Master]
        MYSQL_REPLICA[MySQL Replica]
        REDIS_CLUSTER[Redis Cluster]
    end
    
    subgraph "Monitoring"
        HEALTH_MONITORS[Health Monitors]
        LOG_AGGREGATION[Log Aggregation]
        BACKUP_SYSTEM[Backup System]
        ALERTING[Alerting System]
    end
    
    NGINX --> PM2
    PM2 --> NODE_CLUSTER
    HTTPS --> NGINX
    
    NODE_CLUSTER --> ELASTICSEARCH_CLUSTER
    NODE_CLUSTER --> MYSQL_MASTER
    NODE_CLUSTER --> MYSQL_REPLICA
    NODE_CLUSTER --> REDIS_CLUSTER
    
    NODE_CLUSTER --> HEALTH_MONITORS
    HEALTH_MONITORS --> LOG_AGGREGATION
    LOG_AGGREGATION --> BACKUP_SYSTEM
    BACKUP_SYSTEM --> ALERTING
```

## Technology Stack Summary

### Frontend Technologies
- **React 18** - Modern React with concurrent features
- **TypeScript** - Type safety and better developer experience
- **Vite** - Fast build tool and development server
- **TailwindCSS** - Utility-first CSS framework
- **Zustand** - Lightweight state management
- **Framer Motion** - Animation library

### Backend Technologies
- **Node.js 18+** - JavaScript runtime
- **Express.js** - Web framework
- **Winston** - Logging library
- **Joi** - Input validation
- **Helmet** - Security headers
- **PM2** - Process manager

### Database Technologies
- **Elasticsearch 8+** - Search engine
- **MySQL** - Relational database
- **Redis** - In-memory cache
- **Connection Pooling** - Database optimization

### DevOps & Security
- **Docker** - Containerization
- **Nginx** - Reverse proxy
- **SSL/TLS** - Encryption
- **Rate Limiting** - API protection
- **Health Checks** - System monitoring

This architecture provides a scalable, secure, and maintainable foundation for the Bhoomy search engine, supporting high availability and performance requirements. 