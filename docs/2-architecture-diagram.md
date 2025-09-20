# SearchEngine Bhoomy - Architecture Diagram

## System Overview Architecture

```mermaid
graph TB
    subgraph "External Sources"
        WEB[Web Pages]
        API[External APIs]
        DOC[Documents]
    end

    subgraph "Crawler Layer"
        CRAWLER[High-Performance Crawler]
        PARSER[Content Parser]
        VALIDATOR[URL Validator]
        MONITOR[Resource Monitor]
    end

    subgraph "Data Processing Layer"
        HANDLERS[Content Handlers]
        INDEXER[Content Indexer]
        DUPLICATE[Duplicate Checker]
    end

    subgraph "Storage Layer"
        MYSQL[(MySQL Database)]
        ELASTIC[(Elasticsearch)]
        REDIS[(Redis Cache)]
    end

    subgraph "Search Interface Layer"
        API_SERVER[Express.js API Server]
        REACT_APP[React Frontend]
        ADMIN[Admin Panel]
    end

    subgraph "Infrastructure"
        LB[Load Balancer]
        CDN[CDN]
        LOGS[Winston Logging]
    end

    WEB --> CRAWLER
    API --> CRAWLER
    DOC --> CRAWLER
    
    CRAWLER --> PARSER
    CRAWLER --> VALIDATOR
    CRAWLER --> MONITOR
    
    PARSER --> HANDLERS
    HANDLERS --> INDEXER
    HANDLERS --> DUPLICATE
    
    INDEXER --> MYSQL
    INDEXER --> ELASTIC
    DUPLICATE --> MYSQL
    
    API_SERVER --> MYSQL
    API_SERVER --> ELASTIC
    API_SERVER --> REDIS
    
    REACT_APP --> API_SERVER
    ADMIN --> API_SERVER
    
    LB --> API_SERVER
    CDN --> REACT_APP
    
    CRAWLER --> LOGS
    API_SERVER --> LOGS
```

## High-Level Component Architecture

```mermaid
graph LR
    subgraph "SearchEngine Bhoomy System"
        subgraph "Crawler Module (Port 3000)"
            CC[Crawler Core]
            CP[Content Parser]
            CI[Content Indexer]
            CH[Content Handlers]
        end
        
        subgraph "Search Module (Port 8080)"
            ES[Express Server]
            RA[React App]
            AR[API Routes]
            SM[Search Models]
        end
        
        subgraph "Data Layer"
            DB[(MySQL<br/>Port 3306)]
            EL[(Elasticsearch<br/>Port 9200)]
            RD[(Redis<br/>Port 6379)]
        end
        
        subgraph "External Services"
            WEB[Web Sources]
            CDN[Content Delivery]
        end
    end
    
    WEB --> CC
    CC --> CP
    CP --> CI
    CI --> CH
    CH --> DB
    CH --> EL
    
    RA --> AR
    AR --> SM
    SM --> DB
    SM --> EL
    SM --> RD
    
    CDN --> RA
```

## Data Flow Architecture

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant A as API Server
    participant C as Crawler
    participant P as Parser
    participant I as Indexer
    participant M as MySQL
    participant E as Elasticsearch
    
    Note over C,E: Content Crawling Process
    C->>+P: Parse URL Content
    P->>+I: Processed Content
    I->>+M: Store Metadata
    I->>+E: Index Content
    
    Note over U,E: Search Process
    U->>+F: Search Query
    F->>+A: API Request
    A->>+E: Search Query
    E-->>-A: Search Results
    A->>+M: Get Metadata
    M-->>-A: Content Details
    A-->>-F: Formatted Results
    F-->>-U: Display Results
```

## Deployment Architecture

```mermaid
graph TB
    subgraph "Load Balancer Layer"
        LB[Nginx Load Balancer]
        SSL[SSL Termination]
    end
    
    subgraph "Application Layer"
        subgraph "Crawler Servers"
            C1[Crawler Instance 1<br/>128GB RAM, 24 Cores]
            C2[Crawler Instance 2<br/>128GB RAM, 24 Cores]
        end
        
        subgraph "Search Servers"
            S1[Search Server 1<br/>16GB RAM, 8 Cores]
            S2[Search Server 2<br/>16GB RAM, 8 Cores]
        end
    end
    
    subgraph "Data Layer"
        subgraph "Database Cluster"
            M1[(MySQL Master)]
            M2[(MySQL Replica 1)]
            M3[(MySQL Replica 2)]
        end
        
        subgraph "Search Cluster"
            E1[(Elasticsearch Node 1)]
            E2[(Elasticsearch Node 2)]
            E3[(Elasticsearch Node 3)]
        end
        
        subgraph "Cache Layer"
            R1[(Redis Cluster)]
        end
    end
    
    subgraph "Monitoring"
        MON[System Monitoring]
        LOG[Log Aggregation]
        ALERT[Alert System]
    end
    
    LB --> S1
    LB --> S2
    SSL --> LB
    
    S1 --> M1
    S2 --> M1
    S1 --> E1
    S2 --> E2
    S1 --> R1
    S2 --> R1
    
    C1 --> M1
    C2 --> M1
    C1 --> E1
    C2 --> E2
    
    M1 --> M2
    M1 --> M3
    
    C1 --> MON
    C2 --> MON
    S1 --> MON
    S2 --> MON
    
    MON --> LOG
    MON --> ALERT
```

## Security Architecture

```mermaid
graph TB
    subgraph "Security Layers"
        subgraph "Network Security"
            FW[Firewall]
            DDoS[DDoS Protection]
            WAF[Web Application Firewall]
        end
        
        subgraph "Application Security"
            HELMET[Helmet.js Headers]
            CORS[CORS Policy]
            RATE[Rate Limiting]
            VALID[Input Validation]
        end
        
        subgraph "Authentication"
            SESSION[Session Management]
            JWT[JWT Tokens]
            RBAC[Role-Based Access]
        end
        
        subgraph "Data Security"
            ENCRYPT[Data Encryption]
            BACKUP[Encrypted Backups]
            AUDIT[Audit Logging]
        end
    end
    
    subgraph "External Traffic"
        USERS[Users]
        BOTS[Web Crawlers]
        ATTACK[Malicious Requests]
    end
    
    USERS --> FW
    BOTS --> FW
    ATTACK --> DDoS
    
    FW --> WAF
    DDoS --> WAF
    WAF --> HELMET
    
    HELMET --> CORS
    CORS --> RATE
    RATE --> VALID
    
    VALID --> SESSION
    SESSION --> JWT
    JWT --> RBAC
    
    RBAC --> ENCRYPT
    ENCRYPT --> BACKUP
    BACKUP --> AUDIT
```

## Performance Architecture

```mermaid
graph LR
    subgraph "Performance Optimization"
        subgraph "Frontend Optimization"
            CDN[CDN Distribution]
            CACHE[Browser Caching]
            COMP[Gzip Compression]
            LAZY[Lazy Loading]
        end
        
        subgraph "Backend Optimization"
            POOL[Connection Pooling]
            REDIS[Redis Caching]
            BULK[Bulk Operations]
            INDEX[Database Indexes]
        end
        
        subgraph "Crawler Optimization"
            CONC[Concurrent Processing]
            LIMIT[Rate Limiting]
            BATCH[Batch Processing]
            MEMORY[Memory Management]
        end
        
        subgraph "Search Optimization"
            ELASTIC[Elasticsearch Tuning]
            HIGHLIGHT[Result Highlighting]
            FACET[Faceted Search]
            SUGGEST[Auto-Complete]
        end
    end
    
    CDN --> CACHE
    CACHE --> COMP
    COMP --> LAZY
    
    POOL --> REDIS
    REDIS --> BULK
    BULK --> INDEX
    
    CONC --> LIMIT
    LIMIT --> BATCH
    BATCH --> MEMORY
    
    ELASTIC --> HIGHLIGHT
    HIGHLIGHT --> FACET
    FACET --> SUGGEST
```

## Error Handling & Recovery Architecture

```mermaid
graph TB
    subgraph "Error Detection"
        HEALTH[Health Checks]
        MONITOR[Resource Monitoring]
        ALERTS[Alert System]
    end
    
    subgraph "Recovery Mechanisms"
        RETRY[Automatic Retry]
        CIRCUIT[Circuit Breakers]
        FALLBACK[Fallback Systems]
        RESTART[Auto Restart]
    end
    
    subgraph "Error Categories"
        DB_ERR[Database Errors]
        NET_ERR[Network Errors]
        MEM_ERR[Memory Errors]
        PARSE_ERR[Parse Errors]
    end
    
    subgraph "Recovery Actions"
        DB_RECOVERY[Connection Recovery]
        NET_RECOVERY[Network Retry]
        MEM_RECOVERY[Memory Cleanup]
        PARSE_RECOVERY[Skip & Continue]
    end
    
    HEALTH --> MONITOR
    MONITOR --> ALERTS
    ALERTS --> RETRY
    
    RETRY --> CIRCUIT
    CIRCUIT --> FALLBACK
    FALLBACK --> RESTART
    
    DB_ERR --> DB_RECOVERY
    NET_ERR --> NET_RECOVERY
    MEM_ERR --> MEM_RECOVERY
    PARSE_ERR --> PARSE_RECOVERY
```

## Technology Stack Architecture

```mermaid
graph TB
    subgraph "Frontend Stack"
        REACT[React 18+ TypeScript]
        VITE[Vite Build Tool]
        TAILWIND[Tailwind CSS]
        FRAMER[Framer Motion]
        ZUSTAND[Zustand State]
    end
    
    subgraph "Backend Stack"
        NODE[Node.js 18+]
        EXPRESS[Express.js]
        HELMET_SEC[Helmet Security]
        WINSTON[Winston Logging]
        JOI[Joi Validation]
    end
    
    subgraph "Crawler Stack"
        CHEERIO[Cheerio HTML Parser]
        JSDOM[JSDOM]
        SHARP[Sharp Image Processing]
        PDF[PDF Parse]
        MAMMOTH[Mammoth DOC Parser]
    end
    
    subgraph "Database Stack"
        MYSQL_DB[MySQL 8.0+]
        MYSQL2[MySQL2 Driver]
        ELASTIC_DB[Elasticsearch 8.x]
        REDIS_DB[Redis Cache]
    end
    
    REACT --> VITE
    VITE --> TAILWIND
    TAILWIND --> FRAMER
    FRAMER --> ZUSTAND
    
    NODE --> EXPRESS
    EXPRESS --> HELMET_SEC
    HELMET_SEC --> WINSTON
    WINSTON --> JOI
    
    CHEERIO --> JSDOM
    JSDOM --> SHARP
    SHARP --> PDF
    PDF --> MAMMOTH
    
    MYSQL_DB --> MYSQL2
    MYSQL2 --> ELASTIC_DB
    ELASTIC_DB --> REDIS_DB
```

This architecture ensures scalability, reliability, and performance for the SearchEngine Bhoomy system with proper separation of concerns and robust error handling mechanisms. 