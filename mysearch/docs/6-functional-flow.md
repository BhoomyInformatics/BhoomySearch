# Bhoomy Search Engine - Functional Flow Diagram

## Overview
This document provides detailed functional flow diagrams for the Bhoomy Search Engine, illustrating the complete user journey, system processes, and data flow for all major features.

## 1. Main Search Flow

```mermaid
flowchart TD
    A[User visits homepage] --> B[User enters search query]
    B --> C{Query validation}
    C -->|Valid| D[Update search store]
    C -->|Invalid| E[Show error message]
    D --> F[Navigate to search page]
    F --> G[Display loading state]
    G --> H[API call to /api/search]
    H --> I[Backend receives request]
    I --> J[Input validation with Joi]
    J -->|Valid| K[Build Elasticsearch query]
    J -->|Invalid| L[Return validation error]
    K --> M[Execute Elasticsearch search]
    M -->|Success| N[Process search results]
    M -->|Failure| O[Fallback to MySQL search]
    O --> P[Execute MySQL query]
    P --> Q[Format MySQL results]
    Q --> N
    N --> R[Apply filters and sorting]
    R --> S[Generate suggestions]
    S --> T[Cache results in Redis]
    T --> U[Return JSON response]
    U --> V[Update frontend state]
    V --> W[Display search results]
    W --> X{User interaction}
    X -->|Click result| Y[Navigate to external site]
    X -->|Apply filters| Z[Update filters and re-search]
    X -->|Change page| AA[Load next page]
    X -->|New search| B
    L --> BB[Display error message]
    E --> CC[Focus on search input]
    Z --> G
    AA --> G
```

## 2. Image Search Flow

```mermaid
flowchart TD
    A[User clicks Images tab] --> B[Load Images page]
    B --> C[User enters image search query]
    C --> D{Query validation}
    D -->|Valid| E[Update search store]
    D -->|Invalid| F[Show error message]
    E --> G[Display loading state]
    G --> H[API call to /api/images]
    H --> I[Backend receives request]
    I --> J[Input validation]
    J -->|Valid| K[Build image search query]
    J -->|Invalid| L[Return validation error]
    K --> M[Execute Elasticsearch image search]
    M -->|Success| N[Process image results]
    M -->|Failure| O[Return empty results]
    N --> P[Filter by image metadata]
    P --> Q[Apply pagination]
    Q --> R[Return JSON response]
    R --> S[Update frontend state]
    S --> T[Display image grid]
    T --> U{User interaction}
    U -->|Click image| V[Open image modal]
    U -->|Download image| W[Direct download]
    U -->|View source| X[Navigate to source page]
    U -->|Load more| Y[Load next page]
    V --> Z[Display full-size image]
    Z --> AA[Navigation arrows]
    AA --> BB[Next/Previous image]
    L --> CC[Display error message]
    F --> DD[Focus on search input]
    Y --> G
```

## 3. Video Search Flow

```mermaid
flowchart TD
    A[User clicks Videos tab] --> B[Load Videos page]
    B --> C[User enters video search query]
    C --> D{Query validation}
    D -->|Valid| E[Update search store]
    D -->|Invalid| F[Show error message]
    E --> G[Display loading state]
    G --> H[API call to /api/videos]
    H --> I[Backend receives request]
    I --> J[Input validation]
    J -->|Valid| K[Call YouTube API]
    J -->|Invalid| L[Return validation error]
    K --> M{YouTube API response}
    M -->|Success| N[Process video results]
    M -->|Failure| O[Return error response]
    N --> P[Extract video metadata]
    P --> Q[Generate thumbnails]
    Q --> R[Apply pagination]
    R --> S[Return JSON response]
    S --> T[Update frontend state]
    T --> U[Display video grid]
    U --> V{User interaction}
    V -->|Click video| W[Open video player]
    V -->|View channel| X[Navigate to channel]
    V -->|Share video| Y[Copy video link]
    V -->|Load more| Z[Load next page]
    W --> AA[Display embedded player]
    AA --> BB[Video controls]
    L --> CC[Display error message]
    F --> DD[Focus on search input]
    Z --> G
```

## 4. News Search Flow

```mermaid
flowchart TD
    A[User clicks News tab] --> B[Load News page]
    B --> C[User enters news search query]
    C --> D{Query validation}
    D -->|Valid| E[Update search store]
    D -->|Invalid| F[Show error message]
    E --> G[Display loading state]
    G --> H[API call to /api/news]
    H --> I[Backend receives request]
    I --> J[Input validation]
    J -->|Valid| K[Build news search query]
    J -->|Invalid| L[Return validation error]
    K --> M[Execute Elasticsearch news search]
    M -->|Success| N[Process news results]
    M -->|Failure| O[Return empty results]
    N --> P[Filter by date range]
    P --> Q[Sort by relevance/date]
    Q --> R[Extract article snippets]
    R --> S[Return JSON response]
    S --> T[Update frontend state]
    T --> U[Display news articles]
    U --> V{User interaction}
    V -->|Click article| W[Navigate to full article]
    V -->|Filter by category| X[Apply category filter]
    V -->|Change date range| Y[Apply date filter]
    V -->|Load more| Z[Load next page]
    X --> AA[Update filters and re-search]
    Y --> AA
    AA --> G
    L --> BB[Display error message]
    F --> CC[Focus on search input]
    Z --> G
```

## 5. Search Suggestions Flow

```mermaid
flowchart TD
    A[User starts typing] --> B[Debounced input handler]
    B --> C{Query length > 2}
    C -->|Yes| D[API call to /api/suggestions]
    C -->|No| E[Clear suggestions]
    D --> F[Backend receives request]
    F --> G[Search suggestions in cache]
    G -->|Cache hit| H[Return cached suggestions]
    G -->|Cache miss| I[Query Elasticsearch]
    I --> J[Process suggestion results]
    J --> K[Cache suggestions]
    K --> L[Return suggestions]
    H --> M[Update frontend state]
    L --> M
    M --> N[Display suggestion dropdown]
    N --> O{User interaction}
    O -->|Click suggestion| P[Execute search with suggestion]
    O -->|Continue typing| Q[Update debounced handler]
    O -->|Press Enter| R[Execute search with current query]
    O -->|Click away| S[Hide suggestions]
    P --> T[Navigate to search results]
    Q --> B
    R --> T
    E --> U[Hide suggestions dropdown]
```

## 6. User Authentication Flow

```mermaid
flowchart TD
    A[User clicks Login] --> B[Display login form]
    B --> C[User enters credentials]
    C --> D[Form validation]
    D -->|Valid| E[API call to /api/auth/login]
    D -->|Invalid| F[Display validation errors]
    E --> G[Backend receives request]
    G --> H[Validate credentials]
    H -->|Valid| I[Generate JWT token]
    H -->|Invalid| J[Return authentication error]
    I --> K[Store token in database]
    K --> L[Return token to frontend]
    L --> M[Store token in localStorage]
    M --> N[Update user state]
    N --> O[Redirect to dashboard]
    J --> P[Display error message]
    F --> Q[Focus on error field]
    
    R[User clicks Register] --> S[Display registration form]
    S --> T[User enters registration data]
    T --> U[Form validation]
    U -->|Valid| V[API call to /api/auth/register]
    U -->|Invalid| W[Display validation errors]
    V --> X[Backend receives request]
    X --> Y[Validate registration data]
    Y -->|Valid| Z[Create user account]
    Y -->|Invalid| AA[Return validation error]
    Z --> BB[Send verification email]
    BB --> CC[Return success message]
    CC --> DD[Display verification notice]
    AA --> EE[Display error message]
    W --> FF[Focus on error field]
```

## 7. Admin Dashboard Flow

```mermaid
flowchart TD
    A[Admin login] --> B[Authentication check]
    B -->|Valid| C[Load admin dashboard]
    B -->|Invalid| D[Redirect to login]
    C --> E[Display dashboard menu]
    E --> F{Admin action}
    F -->|Site Management| G[Load sites list]
    F -->|User Management| H[Load users list]
    F -->|Analytics| I[Load analytics dashboard]
    F -->|System Settings| J[Load settings page]
    
    G --> K[Display sites table]
    K --> L{Site action}
    L -->|Add Site| M[Display add site form]
    L -->|Edit Site| N[Display edit site form]
    L -->|Delete Site| O[Confirm deletion]
    L -->|Crawl Site| P[Start crawling process]
    
    M --> Q[Submit site data]
    Q --> R[Validate site data]
    R -->|Valid| S[Add site to database]
    R -->|Invalid| T[Display validation errors]
    S --> U[Update sites list]
    
    N --> V[Submit updated data]
    V --> W[Validate updated data]
    W -->|Valid| X[Update site in database]
    W -->|Invalid| Y[Display validation errors]
    X --> Z[Update sites list]
    
    O --> AA[Delete site from database]
    AA --> BB[Update sites list]
    
    P --> CC[Queue crawling job]
    CC --> DD[Display crawling status]
```

## 8. Content Crawling Flow

```mermaid
flowchart TD
    A[Crawling job starts] --> B[Load site configuration]
    B --> C[Initialize crawling session]
    C --> D[Get site URL]
    D --> E[Fetch page content]
    E -->|Success| F[Parse HTML content]
    E -->|Failure| G[Log crawling error]
    F --> H[Extract metadata]
    H --> I[Extract text content]
    I --> J[Extract images]
    J --> K[Extract links]
    K --> L[Validate extracted data]
    L -->|Valid| M[Store in database]
    L -->|Invalid| N[Log validation error]
    M --> O[Index in Elasticsearch]
    O -->|Success| P[Update crawling statistics]
    O -->|Failure| Q[Log indexing error]
    P --> R{More URLs to crawl?}
    R -->|Yes| S[Get next URL]
    R -->|No| T[Complete crawling session]
    S --> E
    T --> U[Update crawling status]
    U --> V[Send completion notification]
    G --> W[Update error statistics]
    N --> W
    Q --> W
    W --> R
```

## 9. Search Result Processing Flow

```mermaid
flowchart TD
    A[Search query received] --> B[Parse query parameters]
    B --> C[Build Elasticsearch query]
    C --> D[Execute search]
    D --> E[Process raw results]
    E --> F[Apply result filtering]
    F --> G[Remove duplicates]
    G --> H[Calculate relevance scores]
    H --> I[Apply pagination]
    I --> J[Generate result snippets]
    J --> K[Add highlighting]
    K --> L[Extract metadata]
    L --> M[Format for frontend]
    M --> N[Generate suggestions]
    N --> O[Calculate aggregations]
    O --> P[Prepare final response]
    P --> Q[Cache results]
    Q --> R[Return to frontend]
    
    S[Frontend receives results] --> T[Update search store]
    T --> U[Update URL parameters]
    U --> V[Render results list]
    V --> W[Display pagination]
    W --> X[Display filters]
    X --> Y[Display suggestions]
    Y --> Z[Track user interactions]
```

## 10. Error Handling Flow

```mermaid
flowchart TD
    A[Error occurs] --> B[Error detection]
    B --> C{Error type}
    C -->|Validation Error| D[Log validation details]
    C -->|Database Error| E[Log database error]
    C -->|Network Error| F[Log network error]
    C -->|System Error| G[Log system error]
    
    D --> H[Return 400 Bad Request]
    E --> I[Return 500 Internal Server Error]
    F --> J[Return 503 Service Unavailable]
    G --> K[Return 500 Internal Server Error]
    
    H --> L[Display user-friendly message]
    I --> M[Display fallback content]
    J --> N[Display retry option]
    K --> O[Display error page]
    
    L --> P[Log to analytics]
    M --> Q[Activate fallback systems]
    N --> R[Enable retry mechanism]
    O --> S[Send error notification]
    
    P --> T[Update error metrics]
    Q --> U[MySQL fallback activated]
    R --> V[Exponential backoff retry]
    S --> W[Alert admin dashboard]
    
    T --> X[Continue operation]
    U --> Y[Serve fallback results]
    V --> Z[Retry original request]
    W --> AA[Log incident]
```

## 11. Performance Optimization Flow

```mermaid
flowchart TD
    A[Request received] --> B[Check cache]
    B -->|Cache hit| C[Return cached result]
    B -->|Cache miss| D[Process request]
    C --> E[Update cache TTL]
    D --> F[Execute database query]
    F --> G[Process results]
    G --> H[Cache results]
    H --> I[Return response]
    
    J[Background process] --> K[Monitor performance]
    K --> L{Performance threshold}
    L -->|Good| M[Continue monitoring]
    L -->|Poor| N[Trigger optimization]
    N --> O[Analyze bottlenecks]
    O --> P[Apply optimizations]
    P --> Q[Update configurations]
    Q --> R[Test improvements]
    R --> S[Deploy optimizations]
    S --> T[Monitor results]
    T --> K
    
    U[Cache management] --> V[Monitor cache hit rate]
    V --> W{Hit rate acceptable?}
    W -->|Yes| X[Continue monitoring]
    W -->|No| Y[Adjust cache strategy]
    Y --> Z[Update cache keys]
    Z --> AA[Increase cache TTL]
    AA --> BB[Optimize cache size]
    BB --> V
```

## 12. Security Validation Flow

```mermaid
flowchart TD
    A[Request received] --> B[Security middleware]
    B --> C[Check rate limits]
    C -->|Exceeded| D[Return 429 Too Many Requests]
    C -->|OK| E[Validate CORS]
    E -->|Invalid| F[Return 403 Forbidden]
    E -->|Valid| G[Check authentication]
    G -->|Required & missing| H[Return 401 Unauthorized]
    G -->|Valid| I[Input validation]
    I -->|Invalid| J[Return 400 Bad Request]
    I -->|Valid| K[Sanitize inputs]
    K --> L[Check permissions]
    L -->|Denied| M[Return 403 Forbidden]
    L -->|Allowed| N[Process request]
    N --> O[Apply security headers]
    O --> P[Return secure response]
    
    D --> Q[Log security event]
    F --> Q
    H --> Q
    J --> Q
    M --> Q
    Q --> R[Update security metrics]
    R --> S[Check for patterns]
    S --> T{Suspicious activity?}
    T -->|Yes| U[Alert security team]
    T -->|No| V[Continue monitoring]
    U --> W[Block suspicious IP]
    W --> X[Log security incident]
```

## Process Flow Summary

### Key Flow Patterns

1. **Request-Response Pattern**: All API interactions follow validation → processing → response
2. **Error-First Pattern**: Comprehensive error handling at each step
3. **Caching Pattern**: Check cache → process if needed → cache results
4. **Fallback Pattern**: Primary service → fallback service → error state
5. **Security Pattern**: Authentication → authorization → validation → processing

### Performance Considerations

- **Debouncing**: Search suggestions use debounced input to reduce API calls
- **Caching**: Multiple cache layers for optimal performance
- **Pagination**: Large result sets are paginated to improve load times
- **Lazy Loading**: Images and components loaded on demand
- **Connection Pooling**: Database connections optimized for concurrent requests

### Error Recovery Mechanisms

- **Circuit Breaker**: Prevents cascading failures
- **Retry Logic**: Exponential backoff for temporary failures
- **Fallback Systems**: MySQL fallback when Elasticsearch fails
- **Graceful Degradation**: Reduced functionality instead of complete failure

### Security Flow Integration

- **Input Validation**: All user inputs validated before processing
- **Rate Limiting**: Prevents abuse and ensures fair usage
- **Authentication**: Secure token-based authentication
- **Authorization**: Role-based access control
- **Audit Logging**: All security events logged for monitoring

This functional flow design ensures robust, secure, and performant operation of the Bhoomy Search Engine while providing excellent user experience and system reliability. 