# Bhoomy Search Engine - Component Interaction Diagram

## Overview
This document provides detailed component interaction diagrams for the Bhoomy Search Engine, illustrating how different components communicate with each other, data flow patterns, and integration points.

## 1. Frontend Component Interaction Flow

```mermaid
graph TB
    subgraph "User Interface Components"
        HOME[HomePage Component]
        SEARCH[SearchPage Component]
        IMAGES[ImagesPage Component]
        VIDEOS[VideosPage Component]
        NEWS[NewsPage Component]
        ADMIN[AdminPage Component]
    end
    
    subgraph "Shared Components"
        HEADER[Header Component]
        FOOTER[Footer Component]
        SUGGESTIONS[SearchSuggestions Component]
        PAGINATION[Pagination Component]
        FILTERS[FilterPanel Component]
    end
    
    subgraph "State Management"
        STORE[Zustand Store]
        SEARCH_STATE[Search State]
        USER_STATE[User State]
        FILTER_STATE[Filter State]
    end
    
    subgraph "API Layer"
        API_CLIENT[API Client]
        SEARCH_API[Search API]
        IMAGES_API[Images API]
        VIDEOS_API[Videos API]
        NEWS_API[News API]
    end
    
    HOME --> HEADER
    SEARCH --> HEADER
    IMAGES --> HEADER
    VIDEOS --> HEADER
    NEWS --> HEADER
    ADMIN --> HEADER
    
    HOME --> SUGGESTIONS
    SEARCH --> SUGGESTIONS
    
    SEARCH --> PAGINATION
    IMAGES --> PAGINATION
    VIDEOS --> PAGINATION
    NEWS --> PAGINATION
    
    SEARCH --> FILTERS
    IMAGES --> FILTERS
    VIDEOS --> FILTERS
    NEWS --> FILTERS
    
    STORE --> SEARCH_STATE
    STORE --> USER_STATE
    STORE --> FILTER_STATE
    
    SEARCH --> STORE
    IMAGES --> STORE
    VIDEOS --> STORE
    NEWS --> STORE
    
    API_CLIENT --> SEARCH_API
    API_CLIENT --> IMAGES_API
    API_CLIENT --> VIDEOS_API
    API_CLIENT --> NEWS_API
    
    SEARCH --> API_CLIENT
    IMAGES --> API_CLIENT
    VIDEOS --> API_CLIENT
    NEWS --> API_CLIENT
```

## 2. Backend Component Interaction Flow

```mermaid
graph TB
    subgraph "Request Processing"
        INCOMING[Incoming Request]
        MIDDLEWARE[Middleware Stack]
        ROUTES[Route Handler]
        CONTROLLER[Controller]
        RESPONSE[Response Handler]
    end
    
    subgraph "Business Logic"
        VALIDATION[Input Validation]
        PROCESSING[Data Processing]
        AGGREGATION[Result Aggregation]
        FORMATTING[Response Formatting]
    end
    
    subgraph "Data Access"
        ELASTICSEARCH[Elasticsearch Model]
        MYSQL[MySQL Model]
        REDIS[Redis Cache]
        EXTERNAL[External APIs]
    end
    
    subgraph "Utilities"
        LOGGER[Winston Logger]
        HEALTH[Health Check]
        METRICS[Metrics Collector]
        SECURITY[Security Utils]
    end
    
    INCOMING --> MIDDLEWARE
    MIDDLEWARE --> ROUTES
    ROUTES --> CONTROLLER
    CONTROLLER --> RESPONSE
    
    CONTROLLER --> VALIDATION
    VALIDATION --> PROCESSING
    PROCESSING --> AGGREGATION
    AGGREGATION --> FORMATTING
    
    PROCESSING --> ELASTICSEARCH
    PROCESSING --> MYSQL
    PROCESSING --> REDIS
    PROCESSING --> EXTERNAL
    
    MIDDLEWARE --> LOGGER
    MIDDLEWARE --> SECURITY
    CONTROLLER --> HEALTH
    CONTROLLER --> METRICS
```

## 3. Search Flow Component Interaction

```mermaid
sequenceDiagram
    participant User as User
    participant HomePage as HomePage
    participant SearchStore as Search Store
    participant APIClient as API Client
    participant SearchAPI as Search API
    participant SiteController as Site Controller
    participant ESModel as Elasticsearch Model
    participant MySQLModel as MySQL Model
    participant SearchPage as Search Page
    
    User->>HomePage: Enter search query
    HomePage->>SearchStore: Update query state
    HomePage->>APIClient: Call search API
    APIClient->>SearchAPI: HTTP GET /api/search
    SearchAPI->>SiteController: Route to search method
    SiteController->>ESModel: Execute search query
    ESModel-->>SiteController: Return search results
    alt ES fails
        SiteController->>MySQLModel: Fallback search
        MySQLModel-->>SiteController: Return MySQL results
    end
    SiteController-->>SearchAPI: Return formatted results
    SearchAPI-->>APIClient: JSON response
    APIClient-->>HomePage: Search results
    HomePage->>SearchStore: Update results state
    HomePage->>SearchPage: Navigate to results
    SearchPage->>SearchStore: Get results from state
    SearchStore-->>SearchPage: Return results
    SearchPage-->>User: Display search results
```

## 4. State Management Component Interaction

```mermaid
graph TB
    subgraph "Zustand Store"
        STORE[Search Store]
        ACTIONS[Store Actions]
        SELECTORS[Store Selectors]
        PERSISTENCE[Persistence Layer]
    end
    
    subgraph "React Components"
        HOMEPAGE[HomePage]
        SEARCHPAGE[SearchPage]
        IMAGESPAGE[ImagesPage]
        VIDEOSPAGE[VideosPage]
        NEWSPAGE[NewsPage]
        HEADER[Header]
        SUGGESTIONS[Suggestions]
        FILTERS[Filters]
    end
    
    subgraph "Store State"
        QUERY_STATE[Query State]
        RESULTS_STATE[Results State]
        FILTER_STATE[Filter State]
        LOADING_STATE[Loading State]
        ERROR_STATE[Error State]
        HISTORY_STATE[History State]
    end
    
    STORE --> ACTIONS
    STORE --> SELECTORS
    STORE --> PERSISTENCE
    
    STORE --> QUERY_STATE
    STORE --> RESULTS_STATE
    STORE --> FILTER_STATE
    STORE --> LOADING_STATE
    STORE --> ERROR_STATE
    STORE --> HISTORY_STATE
    
    HOMEPAGE --> STORE
    SEARCHPAGE --> STORE
    IMAGESPAGE --> STORE
    VIDEOSPAGE --> STORE
    NEWSPAGE --> STORE
    HEADER --> STORE
    SUGGESTIONS --> STORE
    FILTERS --> STORE
    
    ACTIONS --> QUERY_STATE
    ACTIONS --> RESULTS_STATE
    ACTIONS --> FILTER_STATE
    ACTIONS --> LOADING_STATE
    ACTIONS --> ERROR_STATE
    ACTIONS --> HISTORY_STATE
```

## 5. API Client Component Interaction

```mermaid
graph TB
    subgraph "API Client Core"
        CLIENT[APIClient Class]
        AXIOS[Axios Instance]
        INTERCEPTORS[Request/Response Interceptors]
        ERROR_HANDLER[Error Handler]
    end
    
    subgraph "API Methods"
        SEARCH_METHOD[search()]
        IMAGES_METHOD[searchImages()]
        VIDEOS_METHOD[searchVideos()]
        NEWS_METHOD[searchNews()]
        SUGGESTIONS_METHOD[getSuggestions()]
        HEALTH_METHOD[healthCheck()]
    end
    
    subgraph "Response Handling"
        RESPONSE_HANDLER[Response Handler]
        ERROR_PROCESSOR[Error Processor]
        FALLBACK_HANDLER[Fallback Handler]
        CACHE_MANAGER[Cache Manager]
    end
    
    subgraph "Backend APIs"
        SEARCH_API[/api/search]
        IMAGES_API[/api/images]
        VIDEOS_API[/api/videos]
        NEWS_API[/api/news]
        SUGGESTIONS_API[/api/suggestions]
        HEALTH_API[/api/health]
    end
    
    CLIENT --> AXIOS
    AXIOS --> INTERCEPTORS
    INTERCEPTORS --> ERROR_HANDLER
    
    CLIENT --> SEARCH_METHOD
    CLIENT --> IMAGES_METHOD
    CLIENT --> VIDEOS_METHOD
    CLIENT --> NEWS_METHOD
    CLIENT --> SUGGESTIONS_METHOD
    CLIENT --> HEALTH_METHOD
    
    SEARCH_METHOD --> RESPONSE_HANDLER
    IMAGES_METHOD --> RESPONSE_HANDLER
    VIDEOS_METHOD --> RESPONSE_HANDLER
    NEWS_METHOD --> RESPONSE_HANDLER
    SUGGESTIONS_METHOD --> RESPONSE_HANDLER
    HEALTH_METHOD --> RESPONSE_HANDLER
    
    RESPONSE_HANDLER --> ERROR_PROCESSOR
    ERROR_PROCESSOR --> FALLBACK_HANDLER
    RESPONSE_HANDLER --> CACHE_MANAGER
    
    SEARCH_METHOD --> SEARCH_API
    IMAGES_METHOD --> IMAGES_API
    VIDEOS_METHOD --> VIDEOS_API
    NEWS_METHOD --> NEWS_API
    SUGGESTIONS_METHOD --> SUGGESTIONS_API
    HEALTH_METHOD --> HEALTH_API
```

## 6. Database Component Interaction

```mermaid
graph TB
    subgraph "Database Models"
        ELASTIC_MODEL[Elasticsearch Model]
        MYSQL_MODEL[MySQL Model]
        REDIS_MODEL[Redis Model]
        SITE_MODEL[Site Model]
    end
    
    subgraph "Database Connections"
        ES_CLIENT[Elasticsearch Client]
        MYSQL_POOL[MySQL Connection Pool]
        REDIS_CLIENT[Redis Client]
        CONNECTION_MANAGER[Connection Manager]
    end
    
    subgraph "Database Operations"
        SEARCH_OPS[Search Operations]
        CRUD_OPS[CRUD Operations]
        CACHE_OPS[Cache Operations]
        BACKUP_OPS[Backup Operations]
    end
    
    subgraph "Data Processing"
        QUERY_BUILDER[Query Builder]
        RESULT_PROCESSOR[Result Processor]
        DATA_VALIDATOR[Data Validator]
        AGGREGATOR[Data Aggregator]
    end
    
    ELASTIC_MODEL --> ES_CLIENT
    MYSQL_MODEL --> MYSQL_POOL
    REDIS_MODEL --> REDIS_CLIENT
    SITE_MODEL --> CONNECTION_MANAGER
    
    CONNECTION_MANAGER --> ES_CLIENT
    CONNECTION_MANAGER --> MYSQL_POOL
    CONNECTION_MANAGER --> REDIS_CLIENT
    
    ELASTIC_MODEL --> SEARCH_OPS
    MYSQL_MODEL --> CRUD_OPS
    REDIS_MODEL --> CACHE_OPS
    SITE_MODEL --> BACKUP_OPS
    
    SEARCH_OPS --> QUERY_BUILDER
    CRUD_OPS --> RESULT_PROCESSOR
    CACHE_OPS --> DATA_VALIDATOR
    BACKUP_OPS --> AGGREGATOR
    
    QUERY_BUILDER --> RESULT_PROCESSOR
    RESULT_PROCESSOR --> DATA_VALIDATOR
    DATA_VALIDATOR --> AGGREGATOR
```

## 7. Security Component Interaction

```mermaid
graph TB
    subgraph "Security Middleware"
        HELMET[Helmet Security]
        RATE_LIMITER[Rate Limiter]
        CORS_HANDLER[CORS Handler]
        SESSION_MANAGER[Session Manager]
        AUTH_HANDLER[Auth Handler]
    end
    
    subgraph "Validation Layer"
        INPUT_VALIDATOR[Input Validator]
        SCHEMA_VALIDATOR[Schema Validator]
        SANITIZER[Data Sanitizer]
        ESCAPE_HANDLER[Escape Handler]
    end
    
    subgraph "Security Utils"
        CRYPTO[Crypto Utils]
        JWT_HANDLER[JWT Handler]
        BCRYPT[BCrypt Hash]
        SECURE_HEADERS[Secure Headers]
    end
    
    subgraph "Request Flow"
        INCOMING_REQUEST[Incoming Request]
        SECURITY_CHECK[Security Check]
        VALIDATED_REQUEST[Validated Request]
        PROCESSED_REQUEST[Processed Request]
    end
    
    INCOMING_REQUEST --> HELMET
    HELMET --> RATE_LIMITER
    RATE_LIMITER --> CORS_HANDLER
    CORS_HANDLER --> SESSION_MANAGER
    SESSION_MANAGER --> AUTH_HANDLER
    
    AUTH_HANDLER --> INPUT_VALIDATOR
    INPUT_VALIDATOR --> SCHEMA_VALIDATOR
    SCHEMA_VALIDATOR --> SANITIZER
    SANITIZER --> ESCAPE_HANDLER
    
    AUTH_HANDLER --> JWT_HANDLER
    SESSION_MANAGER --> CRYPTO
    INPUT_VALIDATOR --> BCRYPT
    HELMET --> SECURE_HEADERS
    
    ESCAPE_HANDLER --> SECURITY_CHECK
    SECURITY_CHECK --> VALIDATED_REQUEST
    VALIDATED_REQUEST --> PROCESSED_REQUEST
```

## 8. Logging and Monitoring Component Interaction

```mermaid
graph TB
    subgraph "Logging System"
        WINSTON[Winston Logger]
        CONSOLE_TRANSPORT[Console Transport]
        FILE_TRANSPORT[File Transport]
        LOG_FORMATTER[Log Formatter]
    end
    
    subgraph "Monitoring System"
        HEALTH_CHECKER[Health Checker]
        METRICS_COLLECTOR[Metrics Collector]
        PERFORMANCE_MONITOR[Performance Monitor]
        ALERT_MANAGER[Alert Manager]
    end
    
    subgraph "Log Sources"
        API_LOGS[API Logs]
        ERROR_LOGS[Error Logs]
        SECURITY_LOGS[Security Logs]
        SEARCH_LOGS[Search Logs]
        PERFORMANCE_LOGS[Performance Logs]
    end
    
    subgraph "Log Outputs"
        COMBINED_LOG[Combined Log File]
        ERROR_LOG[Error Log File]
        CONSOLE_OUTPUT[Console Output]
        MONITORING_DASHBOARD[Monitoring Dashboard]
    end
    
    WINSTON --> CONSOLE_TRANSPORT
    WINSTON --> FILE_TRANSPORT
    WINSTON --> LOG_FORMATTER
    
    API_LOGS --> WINSTON
    ERROR_LOGS --> WINSTON
    SECURITY_LOGS --> WINSTON
    SEARCH_LOGS --> WINSTON
    PERFORMANCE_LOGS --> WINSTON
    
    CONSOLE_TRANSPORT --> CONSOLE_OUTPUT
    FILE_TRANSPORT --> COMBINED_LOG
    FILE_TRANSPORT --> ERROR_LOG
    
    HEALTH_CHECKER --> METRICS_COLLECTOR
    METRICS_COLLECTOR --> PERFORMANCE_MONITOR
    PERFORMANCE_MONITOR --> ALERT_MANAGER
    
    ALERT_MANAGER --> MONITORING_DASHBOARD
    WINSTON --> MONITORING_DASHBOARD
```

## 9. Error Handling Component Interaction

```mermaid
graph TB
    subgraph "Error Detection"
        TRY_CATCH[Try-Catch Blocks]
        ERROR_BOUNDARIES[React Error Boundaries]
        PROMISE_REJECTION[Promise Rejection Handler]
        UNCAUGHT_EXCEPTION[Uncaught Exception Handler]
    end
    
    subgraph "Error Processing"
        ERROR_CLASSIFIER[Error Classifier]
        ERROR_FORMATTER[Error Formatter]
        ERROR_LOGGER[Error Logger]
        ERROR_RECOVERY[Error Recovery]
    end
    
    subgraph "Error Response"
        USER_NOTIFICATION[User Notification]
        FALLBACK_DATA[Fallback Data]
        RETRY_MECHANISM[Retry Mechanism]
        GRACEFUL_DEGRADATION[Graceful Degradation]
    end
    
    subgraph "Error Storage"
        ERROR_LOGS[Error Logs]
        METRICS_STORE[Metrics Store]
        MONITORING_SYSTEM[Monitoring System]
        ALERT_SYSTEM[Alert System]
    end
    
    TRY_CATCH --> ERROR_CLASSIFIER
    ERROR_BOUNDARIES --> ERROR_CLASSIFIER
    PROMISE_REJECTION --> ERROR_CLASSIFIER
    UNCAUGHT_EXCEPTION --> ERROR_CLASSIFIER
    
    ERROR_CLASSIFIER --> ERROR_FORMATTER
    ERROR_FORMATTER --> ERROR_LOGGER
    ERROR_LOGGER --> ERROR_RECOVERY
    
    ERROR_RECOVERY --> USER_NOTIFICATION
    ERROR_RECOVERY --> FALLBACK_DATA
    ERROR_RECOVERY --> RETRY_MECHANISM
    ERROR_RECOVERY --> GRACEFUL_DEGRADATION
    
    ERROR_LOGGER --> ERROR_LOGS
    ERROR_LOGGER --> METRICS_STORE
    ERROR_LOGGER --> MONITORING_SYSTEM
    ERROR_LOGGER --> ALERT_SYSTEM
```

## 10. Real-time Component Interaction

```mermaid
graph TB
    subgraph "Real-time Features"
        SUGGESTIONS[Real-time Suggestions]
        LIVE_SEARCH[Live Search]
        NOTIFICATIONS[Push Notifications]
        ANALYTICS[Real-time Analytics]
    end
    
    subgraph "WebSocket Communication"
        SOCKET_CLIENT[Socket.IO Client]
        SOCKET_SERVER[Socket.IO Server]
        CONNECTION_MANAGER[Connection Manager]
        EVENT_HANDLERS[Event Handlers]
    end
    
    subgraph "Event Processing"
        SEARCH_EVENTS[Search Events]
        USER_EVENTS[User Events]
        SYSTEM_EVENTS[System Events]
        ANALYTICS_EVENTS[Analytics Events]
    end
    
    subgraph "Data Streaming"
        SEARCH_STREAM[Search Stream]
        SUGGESTION_STREAM[Suggestion Stream]
        METRICS_STREAM[Metrics Stream]
        NOTIFICATION_STREAM[Notification Stream]
    end
    
    SUGGESTIONS --> SOCKET_CLIENT
    LIVE_SEARCH --> SOCKET_CLIENT
    NOTIFICATIONS --> SOCKET_CLIENT
    ANALYTICS --> SOCKET_CLIENT
    
    SOCKET_CLIENT --> SOCKET_SERVER
    SOCKET_SERVER --> CONNECTION_MANAGER
    CONNECTION_MANAGER --> EVENT_HANDLERS
    
    EVENT_HANDLERS --> SEARCH_EVENTS
    EVENT_HANDLERS --> USER_EVENTS
    EVENT_HANDLERS --> SYSTEM_EVENTS
    EVENT_HANDLERS --> ANALYTICS_EVENTS
    
    SEARCH_EVENTS --> SEARCH_STREAM
    USER_EVENTS --> SUGGESTION_STREAM
    SYSTEM_EVENTS --> METRICS_STREAM
    ANALYTICS_EVENTS --> NOTIFICATION_STREAM
    
    SEARCH_STREAM --> SUGGESTIONS
    SUGGESTION_STREAM --> LIVE_SEARCH
    METRICS_STREAM --> ANALYTICS
    NOTIFICATION_STREAM --> NOTIFICATIONS
```

## Component Interaction Summary

### Key Interaction Patterns

1. **Request-Response Pattern**: Traditional HTTP API interactions
2. **Event-Driven Pattern**: Real-time features using WebSockets
3. **State Management Pattern**: Centralized state using Zustand
4. **Middleware Pattern**: Request processing pipeline
5. **Observer Pattern**: Component updates based on state changes
6. **Fallback Pattern**: Graceful degradation when services fail

### Communication Protocols

- **HTTP/HTTPS**: REST API communication
- **WebSocket**: Real-time bidirectional communication
- **JSON**: Data exchange format
- **EventEmitter**: Node.js internal event handling

### Error Handling Strategies

- **Circuit Breaker**: Prevent cascading failures
- **Retry Logic**: Automatic retry with exponential backoff
- **Fallback Mechanisms**: Alternative data sources
- **Graceful Degradation**: Reduced functionality instead of complete failure

### Performance Optimizations

- **Caching Layers**: Multiple levels of caching
- **Connection Pooling**: Efficient database connections
- **Lazy Loading**: Load components on demand
- **Debouncing**: Reduce API calls for search suggestions

This component interaction design ensures a robust, scalable, and maintainable architecture with clear separation of concerns and well-defined communication patterns. 