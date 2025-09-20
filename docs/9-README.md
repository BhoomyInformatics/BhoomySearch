# SearchEngine Bhoomy

A comprehensive, high-performance web search engine system built with Node.js, featuring an intelligent web crawler and modern React-based search interface.

![SearchEngine Bhoomy](https://img.shields.io/badge/version-5.2.0-blue.svg)
![Node.js](https://img.shields.io/badge/node.js-18%2B-green.svg)
![License](https://img.shields.io/badge/license-ISC-lightgrey.svg)

## 🚀 Features

### High-Performance Web Crawler
- **Multi-threaded crawling** optimized for high-memory systems (128GB+ RAM)
- **Intelligent content parsing** for HTML, PDF, DOC, images, and videos
- **Duplicate detection** with SHA-256 content fingerprinting
- **Robots.txt compliance** and respectful crawling practices
- **Emergency resource management** with automatic throttling

### Modern Search Interface
- **React 18+ frontend** with TypeScript and Tailwind CSS
- **Real-time search** with auto-complete and suggestions
- **Advanced filtering** by content type, date, language, and category
- **Responsive design** with dark/light theme support
- **Progressive Web App** features for offline capabilities

### Robust Data Storage
- **MySQL database** for structured data and metadata
- **Elasticsearch integration** for full-text search and indexing
- **Redis caching** for improved search performance
- **Automatic backups** and database optimization

### Enterprise-Grade Features
- **Admin dashboard** for system monitoring and management
- **RESTful API** with comprehensive documentation
- **Security hardening** with rate limiting and input validation
- **Comprehensive logging** and error tracking
- **Production deployment** guides and configurations

## 📋 Table of Contents

- [Quick Start](#-quick-start)
- [System Requirements](#-system-requirements)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Usage](#-usage)
- [API Documentation](#-api-documentation)
- [Architecture](#-architecture)
- [Contributing](#-contributing)
- [License](#-license)

## ⚡ Quick Start

### Prerequisites
- Node.js 18+ and npm 8+
- MySQL 8.0+
- Elasticsearch 8.x
- Redis (optional, for caching)

### Installation
```bash
# Clone the repository
git clone https://github.com/your-username/searchengine-bhoomy.git
cd searchengine-bhoomy

# Install all dependencies
npm run install-all

# Setup environment files
cp crawl/env.example crawl/.env
cp mysearch/env.example mysearch/.env

# Configure your environment variables (see Configuration section)
# ...

# Initialize database
npm run setup-db

# Start the system
npm start
```

The search interface will be available at `http://localhost:3000` and the crawler will start processing URLs automatically.

## 💻 System Requirements

### Development Environment
- **OS**: Windows 10+, macOS 10.15+, or Ubuntu 18.04+
- **Node.js**: Version 18.0.0 or higher
- **RAM**: 8GB minimum, 16GB recommended
- **Storage**: 10GB free space

### Production Environment
- **OS**: Ubuntu 20.04 LTS or CentOS 8+ (recommended)
- **CPU**: 8 cores minimum, 24 cores recommended for crawler
- **RAM**: 32GB minimum, 128GB recommended for high-performance crawling
- **Storage**: 1TB SSD minimum, 2TB NVMe SSD recommended
- **Network**: 1Gbps connection

## 📦 Installation

### Automated Installation
```bash
# Run the setup script
./scripts/setup.sh

# Or use the manual installation steps below
```

### Manual Installation

#### 1. Install Dependencies
```bash
# Install Node.js dependencies
npm run install-all

# This runs:
# - npm install (root dependencies)
# - cd crawl && npm install (crawler dependencies)
# - cd mysearch && npm install (search engine dependencies)
```

#### 2. Database Setup

##### MySQL
```sql
-- Create database
CREATE DATABASE mybhoomy_test;

-- Create user
CREATE USER 'mybhoomy_bhoomy'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON mybhoomy_test.* TO 'mybhoomy_bhoomy'@'localhost';
FLUSH PRIVILEGES;
```

##### Elasticsearch
```bash
# Start Elasticsearch (default: localhost:9200)
# No additional setup required for basic usage
```

##### Redis (Optional)
```bash
# Start Redis (default: localhost:6379)
# Configure password in production
```

#### 3. Initialize Database Schema
```bash
# Import the database schema
npm run setup-db

# Or manually:
mysql -u mybhoomy_bhoomy -p mybhoomy_test < mytest_search_schema.sql
```

## ⚙️ Configuration

### Environment Variables

#### Crawler Configuration (`crawl/.env`)
```bash
# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=mybhoomy_bhoomy
DB_PASSWORD=your_password
DB_NAME=mybhoomy_test

# Elasticsearch
ELASTICSEARCH_URL=http://localhost:9200
ELASTICSEARCH_INDEX=bhoomy_search

# Performance
NODE_ENV=development
MAX_CONCURRENT_REQUESTS=10
REQUEST_TIMEOUT=30000
BATCH_SIZE=5
```

#### Search Engine Configuration (`mysearch/.env`)
```bash
# Server
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:3001

# Database (same as crawler)
DB_HOST=localhost
DB_PORT=3306
DB_USER=mybhoomy_bhoomy
DB_PASSWORD=your_password
DB_NAME=mybhoomy_test

# Elasticsearch
ELASTICSEARCH_URL=http://localhost:9200
ELASTICSEARCH_INDEX=bhoomy_search

# Security
SESSION_SECRET=your_session_secret
CORS_ORIGIN=http://localhost:3001

# Redis (optional)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
```

### Advanced Configuration

#### Crawler Settings
Modify `crawl/config/crawlerConfig.js` for advanced crawler settings:
- Concurrency limits
- Request timeouts
- Content processing options
- Resource monitoring thresholds

#### Search Settings
Modify search behavior in `mysearch/app.js`:
- Results per page
- Cache settings
- Security headers
- Rate limiting

## 🎯 Usage

### Starting the System

#### Development Mode
```bash
# Start both crawler and search interface
npm run dev

# Or start individually
npm run dev-crawler   # Crawler with auto-restart
npm run dev-search    # Search interface with auto-restart
```

#### Production Mode
```bash
# Start both services
npm start

# Or start individually
npm run start-crawler  # Crawler service
npm run start-search   # Search interface
```

### Using the Crawler

#### Adding URLs to Crawl
```bash
# Add URLs via the admin interface at http://localhost:3000/admin
# Or add URLs directly to the database
```

#### Monitoring Crawl Progress
```bash
# View crawler logs
tail -f crawl/logs/combined.log

# Check system resources
npm run health-check
```

### Using the Search Interface

#### Basic Search
1. Open `http://localhost:3000` in your browser
2. Enter your search query
3. Use filters to refine results
4. Explore different content types (web, images, videos, news)

#### Advanced Search Features
- **Boolean operators**: Use AND, OR, NOT
- **Phrase search**: Use quotes for exact phrases
- **Field search**: Search within specific fields
- **Date filters**: Filter by date ranges
- **Content type filters**: Filter by media type

### API Usage

#### Search API
```javascript
// Basic search
fetch('/api/search?q=your+query&page=1&per_page=20')
  .then(response => response.json())
  .then(data => console.log(data));

// Advanced search with filters
fetch('/api/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    q: 'your query',
    filters: {
      content_type: 'web',
      language: 'en',
      date_range: '2024-01-01,2024-12-31'
    }
  })
});
```

#### Admin API
```javascript
// Get system status
fetch('/api/admin/status')
  .then(response => response.json())
  .then(status => console.log(status));

// Add new site
fetch('/api/admin/sites', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    site_url: 'https://example.com',
    site_title: 'Example Site',
    site_priority: 5
  })
});
```

## 📖 API Documentation

### Search Endpoints

#### GET /api/search
Search for content across all indexed pages.

**Parameters:**
- `q` (required): Search query
- `page` (optional): Page number (default: 1)
- `per_page` (optional): Results per page (default: 20, max: 100)
- `content_type` (optional): Filter by content type (web, images, videos, news)
- `language` (optional): Filter by language code
- `sort_by` (optional): Sort order (relevance, date, popularity)

**Response:**
```json
{
  "success": true,
  "data": {
    "results": [...],
    "total": 1000,
    "page": 1,
    "per_page": 20,
    "total_pages": 50,
    "time_taken": 150
  }
}
```

#### GET /api/health
Get system health status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "services": {
    "database": "connected",
    "elasticsearch": "connected",
    "redis": "connected"
  }
}
```

### Admin Endpoints

#### GET /api/admin/stats
Get system statistics and metrics.

#### POST /api/admin/sites
Add a new site for crawling.

#### DELETE /api/admin/sites/:id
Remove a site from crawling.

For complete API documentation, see [API Documentation](docs/api-documentation.md).

## 🏗️ Architecture

### System Overview
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Web Crawler   │────│    MySQL DB      │────│  Search Interface│
│   (Port 3001)   │    │   (Port 3306)    │    │   (Port 3000)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌──────────────────┐
                    │  Elasticsearch   │
                    │   (Port 9200)    │
                    └──────────────────┘
```

### Core Components

#### Crawler Module (`/crawl`)
- **CrawlerCore**: Main crawling engine
- **ContentParser**: Content extraction and processing
- **ContentIndexer**: Database and Elasticsearch indexing
- **Content Handlers**: Specialized processors for different content types
- **Resource Monitor**: System resource tracking and management

#### Search Module (`/mysearch`)
- **Express.js API**: RESTful API server
- **React Frontend**: Modern search interface
- **Search Models**: Database interaction layer
- **Admin Dashboard**: System management interface

### Data Flow
1. **URL Input** → URL Validation → Content Fetching
2. **Content Processing** → Parsing → Duplicate Detection
3. **Content Indexing** → MySQL Storage → Elasticsearch Indexing
4. **Search Query** → Query Processing → Results Retrieval → Response Formatting

For detailed architecture documentation, see [Architecture Diagram](docs/2-architecture-diagram.md).

## 🔧 Development

### Project Structure
```
SearchEngine/
├── crawl/                    # Web crawler module
│   ├── config/              # Configuration files
│   ├── core/                # Core crawler components
│   ├── handlers/            # Content type handlers
│   ├── utils/               # Utility functions
│   └── package.json
├── mysearch/                # Search interface module
│   ├── frontend/            # React frontend
│   ├── routes/              # API routes
│   ├── models/              # Database models
│   └── package.json
├── docs/                    # Documentation
└── package.json            # Root configuration
```

### Development Scripts
```bash
# Development
npm run dev                  # Start both services in development mode
npm run dev-crawler         # Start crawler with auto-restart
npm run dev-search          # Start search interface with auto-restart

# Testing
npm test                    # Run all tests
npm run test-crawler        # Test crawler functionality
npm run test-search         # Test search functionality

# Linting and Formatting
npm run lint                # Lint all code
npm run format              # Format all code
npm run build               # Build production assets

# Maintenance
npm run cleanup             # Clean duplicate data
npm run health-check        # Check system health
npm run backup-db           # Backup database
```

### Adding New Features

#### Adding a Content Handler
1. Create new handler in `crawl/handlers/`
2. Implement the required interface
3. Register handler in `crawl/core/parser.js`
4. Add tests and documentation

#### Adding API Endpoints
1. Create route in `mysearch/routes/`
2. Add input validation with Joi
3. Implement controller logic
4. Add error handling
5. Update API documentation

For detailed development guides, see [Contributing Guidelines](CONTRIBUTING.md).

## 🚀 Deployment

### Quick Deployment
```bash
# Build production assets
npm run build

# Start in production mode
NODE_ENV=production npm start
```

### Production Deployment
For production deployment with load balancing, SSL, and monitoring:

1. See [Production Deployment Guide](docs/8-deployment-production.md)
2. Configure environment variables for production
3. Set up database clustering and replication
4. Configure Nginx load balancer
5. Set up monitoring and alerting
6. Configure automated backups

### Docker Deployment
```bash
# Build Docker images
docker-compose build

# Start services
docker-compose up -d

# Scale services
docker-compose up -d --scale search=3 --scale crawler=2
```

## 📊 Performance

### Benchmarks
- **Crawling Speed**: 1000+ pages/hour per crawler instance
- **Search Response Time**: <200ms average, <500ms 95th percentile
- **Throughput**: 100+ concurrent searches
- **Memory Usage**: <4GB per service under normal load
- **Storage**: ~1GB per 100,000 indexed pages

### Optimization Tips
1. **Increase concurrency** for the crawler (adjust `MAX_CONCURRENT_REQUESTS`)
2. **Enable Redis caching** for frequently searched queries
3. **Optimize database indexes** for better query performance
4. **Use SSD storage** for better I/O performance
5. **Scale horizontally** with multiple instances

## 🔒 Security

### Security Features
- **Input validation** with Joi schema validation
- **SQL injection prevention** with parameterized queries
- **XSS protection** with output encoding
- **CSRF protection** with tokens
- **Rate limiting** to prevent abuse
- **Security headers** with Helmet.js
- **Authentication** with JWT tokens

### Security Best Practices
1. Change default passwords and secrets
2. Use HTTPS in production
3. Keep dependencies updated
4. Regular security audits
5. Monitor for suspicious activity
6. Implement proper logging and alerting

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Quick Start for Contributors
```bash
# Fork the repository
git clone https://github.com/your-username/searchengine-bhoomy.git

# Create a feature branch
git checkout -b feature/your-feature-name

# Make your changes and test them
npm test

# Submit a pull request
```

### Reporting Issues
Please use the [GitHub Issues](https://github.com/your-username/searchengine-bhoomy/issues) page to report bugs or request features.

## 📚 Documentation

- [Project Structure](docs/1-project-structure.md)
- [Architecture Diagram](docs/2-architecture-diagram.md)
- [Component Interactions](docs/3-component-interaction-diagram.md)
- [Current State & Roadmap](docs/4-current-state-roadmap.md)
- [Features Documentation](docs/5-features-documentation.md)
- [Functional Flow Diagram](docs/6-functional-flow-diagram.md)
- [Technical Stack](docs/7-technical-stack-implementation.md)
- [Production Deployment](docs/8-deployment-production.md)

## 📄 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 👥 Authors

- **Vijay R Dalvi** - *Initial work and development*

## 🙏 Acknowledgments

- Thanks to all contributors who have helped improve this project
- Special thanks to the open-source community for the excellent tools and libraries
- Inspired by modern search engines and web crawling technologies

## 📞 Support

For support and questions:
- Create an issue on [GitHub Issues](https://github.com/your-username/searchengine-bhoomy/issues)
- Check the [Documentation](docs/) for detailed guides
- Run `npm run health-check` for system diagnostics

---

**SearchEngine Bhoomy** - Building the future of web search, one crawl at a time. 🚀 