# SearchEngine Bhoomy - Project Structure Documentation

## Overview
SearchEngine Bhoomy is a comprehensive search engine system consisting of two main components: a high-performance web crawler and a modern search interface. The project is designed as a monorepo with workspace-based architecture.

## Root Directory Structure

```
SearchEngine/
├── crawl/                          # Web Crawler Module
├── mysearch/                       # Search Interface Module
├── docs/                          # Documentation
├── package.json                   # Root workspace configuration
├── package-lock.json              # Dependency lock file
├── start-crawler.js               # Crawler startup script
├── SETUP_GUIDE.md                 # Installation and setup guide
├── mytest_search_schema.sql       # Database schema
└── README.md                      # Main project documentation
```

## Crawl Module Structure

### Directory Layout
```
crawl/
├── config/                        # Configuration files
│   ├── crawlerConfig.js          # Main crawler configuration
│   ├── db.js                     # Database configuration
│   ├── elasticConfig.js          # Elasticsearch configuration
│   ├── headers.js                # HTTP headers configuration
│   ├── local-db-config.js        # Local database settings
│   ├── network-check.js          # Network connectivity checks
│   ├── proxies.js                # Proxy server configuration
│   └── user-agents.js            # User agent rotation
├── core/                         # Core crawler components
│   ├── crawler.js               # Main crawler engine
│   ├── indexer.js               # Content indexing system
│   └── parser.js                # Content parsing utilities
├── handlers/                     # Content type handlers
│   ├── contentTypeHandler.js    # Content type detection
│   ├── dataHandler.js           # Data processing
│   ├── documentHandler.js       # Document processing (PDF, DOC, etc.)
│   ├── htmlHandler.js           # HTML content processing
│   └── imageHandler.js          # Image processing
├── utils/                        # Utility functions
│   ├── duplicateChecker.js      # Duplicate content detection
│   ├── log-cleanup.js           # Log file management
│   ├── logger.js                # Logging system
│   ├── resource-monitor.js      # System resource monitoring
│   ├── system-check.js          # System health checks
│   └── urlValidator.js          # URL validation and normalization
├── urls/                         # URL management
│   ├── activeurls.csv           # Active URLs for crawling
│   ├── domain.txt               # Domain list
│   ├── inactive.txt             # Inactive URLs
│   └── [one-five]/              # Distributed URL lists
├── logs/                         # Log files
│   ├── combined.log             # Combined log output
│   ├── debug.log               # Debug information
│   ├── error.log               # Error logs
│   ├── exceptions.log          # Exception tracking
│   └── rejections.log          # Promise rejection logs
├── temp/                         # Temporary files
├── index.js                      # Main crawler entry point
├── package.json                  # Crawler dependencies
└── [various crawler scripts]     # Specialized crawlers
```

### Key Configuration Files

#### crawlerConfig.js
- **Purpose**: Main crawler configuration with production-optimized settings
- **Key Settings**:
  - `maxConcurrentRequests`: 10 (emergency conservative setting)
  - `requestTimeout`: 30000ms (30 seconds)
  - `batchSize`: 5 (reduced for system stability)
  - `memoryThreshold`: 0.3 (use 30% of available memory)
  - `emergencyMode`: Enabled for file descriptor protection

#### elasticConfig.js
- **Purpose**: Elasticsearch connection and indexing configuration
- **Features**: Bulk indexing, error recovery, timeout management

## MySearch Module Structure

### Directory Layout
```
mysearch/
├── frontend/                     # React frontend application
│   ├── src/
│   │   ├── components/          # Reusable UI components
│   │   │   ├── Footer.tsx
│   │   │   ├── Header.tsx
│   │   │   └── SearchSuggestions.tsx
│   │   ├── pages/              # Page components
│   │   │   ├── AdminPage.tsx
│   │   │   ├── HomePage.tsx
│   │   │   ├── ImagesPage.tsx
│   │   │   ├── NewsPage.tsx
│   │   │   ├── SearchPage.tsx
│   │   │   └── VideosPage.tsx
│   │   ├── store/              # State management
│   │   │   └── searchStore.ts
│   │   ├── types/              # TypeScript type definitions
│   │   │   └── index.ts
│   │   ├── utils/              # Utility functions
│   │   │   ├── api.ts
│   │   │   └── mockApi.ts
│   │   ├── App.tsx             # Main application component
│   │   └── main.tsx            # Application entry point
│   ├── public/                 # Static assets
│   │   ├── css1/              # Legacy CSS files
│   │   ├── images/            # Images and icons
│   │   ├── js/                # Legacy JavaScript files
│   │   └── manifest.json      # PWA manifest
│   ├── package.json           # Frontend dependencies
│   ├── tailwind.config.js     # Tailwind CSS configuration
│   ├── tsconfig.json          # TypeScript configuration
│   └── vite.config.ts         # Vite build configuration
├── controllers/               # API controllers
│   ├── Admin/
│   │   └── dashbordController.js
│   ├── Apis/
│   │   └── SiteController.js
│   └── rootController.js
├── models/                    # Database models
│   ├── elastic_search/
│   │   ├── Backup.js
│   │   └── site.js
│   ├── searchModel.js
│   └── SiteModel.js
├── routes/                    # Express routes
│   ├── Admin.js              # Admin panel routes
│   ├── api.js                # Modern API routes
│   ├── Apis.js               # Legacy API routes
│   ├── common.js             # Common route utilities
│   └── index.js              # Main route definitions
├── utils/                     # Utility functions
│   └── health-check.js       # Health check utilities
├── logs/                      # Application logs
│   ├── combined.log          # Combined log output
│   └── error.log             # Error logs
├── app.js                     # Main application server
├── mysql.js                   # MySQL database connection
└── package.json              # Backend dependencies
```

## Core Technologies by Module

### Crawler Module
- **Runtime**: Node.js 18+
- **Database**: MySQL 8.0+ (with MySQL2 driver)
- **Search Engine**: Elasticsearch 8.x
- **HTTP Client**: Axios with custom agents
- **HTML Parsing**: Cheerio, JSDOM
- **Content Processing**: Sharp (images), PDF-parse, Mammoth (documents)
- **Logging**: Winston
- **Scheduling**: Node-cron, Node-schedule

### Search Interface Module
- **Backend**: Express.js with security middleware
- **Frontend**: React 18+ with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **UI Components**: Framer Motion, Lucide React
- **Database**: MySQL with connection pooling
- **Search**: Elasticsearch client
- **Caching**: Redis (optional)

## Environment Configuration

### Required Environment Variables
```bash
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=mybhoomy_bhoomy
DB_PASSWORD=.p1Tb.M*4RMSPwM
DB_NAME=mybhoomy_test

# Elasticsearch Configuration
ELASTICSEARCH_URL=http://localhost:9200
ELASTICSEARCH_INDEX=bhoomy_search

# Application Configuration
NODE_ENV=production
PORT=3000
FRONTEND_URL=http://localhost:3001
SESSION_SECRET=Bhoomy-Search-Engine-Secret
```

## Database Schema

### Key Tables
- **sites**: Website information and crawl settings
- **site_data**: Crawled content and metadata
- **site_images**: Image content and metadata
- **site_videos**: Video content and metadata
- **site_documents**: Document content and metadata

## Deployment Architecture

### Production Setup
1. **Crawler Service**: Runs on dedicated server with high memory (128GB recommended)
2. **Search Service**: Web server with load balancing
3. **Database**: MySQL cluster with replication
4. **Search Index**: Elasticsearch cluster
5. **Frontend**: Static assets served via CDN

### Performance Characteristics
- **Crawler**: Optimized for 24-core CPU, 128GB RAM
- **Concurrency**: Emergency-limited to 10 concurrent requests
- **Indexing**: Bulk operations with 500-document batches
- **Search**: Sub-second response times with caching
- **Resource Management**: Automatic memory cleanup and monitoring

## Security Features

### Crawler Security
- User agent rotation
- Proxy support
- Rate limiting
- Robots.txt compliance
- Connection throttling

### Search Interface Security
- Helmet.js security headers
- CORS configuration
- Rate limiting per IP
- Input validation with Joi
- Session management
- XSS protection

## Monitoring and Maintenance

### Health Checks
- Database connectivity
- Elasticsearch cluster health
- Memory usage monitoring
- File descriptor tracking
- Connection pool status

### Automatic Recovery
- Database timeout recovery
- Parser error handling
- Memory management
- Automatic restarts
- Emergency mode activation

This project structure provides a scalable, maintainable architecture for a production-ready search engine system with comprehensive crawling capabilities and modern search interface. 