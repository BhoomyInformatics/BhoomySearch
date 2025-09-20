# Bhoomy Search Engine

![Bhoomy Logo](/public/images/Bhoomy1.png)

## 🌟 Overview

**Bhoomy Search Engine** is a modern, full-stack web application that provides comprehensive search capabilities including web search, image search, video search, and news search. Built with cutting-edge technologies, it delivers fast, relevant, and secure search results with advanced filtering and suggestion features.

### 🎯 Key Features

- **🔍 Multi-Modal Search**: Web, images, videos, and news search
- **⚡ Real-time Suggestions**: Instant search suggestions as you type
- **🎨 Modern UI**: Beautiful, responsive design with dark mode support
- **🔧 Advanced Filters**: Category, language, date, and content type filtering
- **📱 Progressive Web App**: Installable PWA with offline capabilities
- **🛡️ Security First**: Comprehensive security measures and data protection
- **📊 Analytics**: Built-in search analytics and performance monitoring
- **🚀 High Performance**: Optimized for speed and scalability

## 🏗️ Architecture

### Technology Stack

#### Frontend
- **React 18** + **TypeScript** - Modern UI framework with type safety
- **Vite** - Lightning-fast build tool and development server
- **TailwindCSS** - Utility-first CSS framework for rapid styling
- **Zustand** - Lightweight state management
- **Framer Motion** - Smooth animations and transitions

#### Backend
- **Node.js 18+** - JavaScript runtime environment
- **Express.js** - Fast, minimalist web framework
- **Elasticsearch 8+** - Advanced search engine capabilities
- **MySQL** - Reliable relational database
- **Redis** - High-performance caching layer

#### Infrastructure
- **PM2** - Production process management
- **Nginx** - Reverse proxy and load balancer
- **Winston** - Comprehensive logging system
- **Docker** - Containerization (planned)

## 🚀 Quick Start

### Prerequisites

Ensure you have the following installed:
- **Node.js 18+** ([Download](https://nodejs.org/))
- **MySQL 8.0+** ([Download](https://dev.mysql.com/downloads/))
- **Elasticsearch 8+** ([Download](https://www.elastic.co/downloads/elasticsearch)) (Optional - has fallback)
- **Redis** ([Download](https://redis.io/download)) (Optional - for caching)
- **Git** ([Download](https://git-scm.com/downloads))

### Installation

1. **Clone the Repository**
   ```bash
   git clone https://github.com/your-username/mysearch.git
   cd mysearch
   ```

2. **Install Dependencies**
   ```bash
   # Install backend dependencies
   npm install
   
   # Install frontend dependencies
   cd frontend
   npm install
   cd ..
   ```

3. **Environment Setup**
   ```bash
   # Copy environment template
   cp env.example .env
   
   # Edit environment variables
   nano .env
   ```

4. **Database Setup**
   ```bash
   # Create MySQL database
   mysql -u root -p
   CREATE DATABASE mybhoomy_mysearch;
   
   # Import schema
   mysql -u root -p mybhoomy_mysearch < mybhoomy_mysearch_schema.sql
   ```

5. **Build and Start**
   ```bash
   # Development mode (recommended for first run)
   npm run dev:setup
   
   # Or manual build and start
   npm run frontend:build
   npm start
   ```

6. **Access the Application**
   - Open [http://localhost:3000](http://localhost:3000)
   - API documentation: [http://localhost:3000/api/health](http://localhost:3000/api/health)

## 📖 Configuration

### Environment Variables

Essential environment variables for `.env` file:

```bash
# Application
NODE_ENV=development
PORT=3000

# Database
DB_HOST=localhost
DB_PORT=3306
DB_NAME=mybhoomy_mysearch
DB_USER=your_db_user
DB_PASSWORD=your_db_password

# Elasticsearch (Optional)
ELASTICSEARCH_URL=https://localhost:9200
ELASTICSEARCH_USERNAME=elastic
ELASTICSEARCH_PASSWORD=your_elasticsearch_password

# Security
JWT_SECRET=your_super_secret_jwt_key
SESSION_SECRET=your_super_secret_session_key

# External APIs
YOUTUBE_API_KEY=your_youtube_api_key

# Redis (Optional)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
```

### Development Scripts

```bash
# Development
npm run dev              # Start backend in development mode
npm run frontend:dev     # Start frontend development server
npm run dev:full         # Start both backend and frontend

# Production
npm start               # Start production server
npm run build          # Build frontend for production
npm run frontend:build # Build frontend only

# Utilities
npm run health-check   # Check system health
npm run lint          # Run ESLint
npm test             # Run tests
```

## 🌟 Features Deep Dive

### 1. Web Search
- **Full-text search** across indexed web content
- **Relevance ranking** with intelligent scoring
- **Fuzzy search** for typo tolerance
- **Boolean operators** (AND, OR, NOT)
- **Field boosting** (title > description > content)

### 2. Image Search
- **Grid layout** with responsive design
- **Modal viewer** for full-screen preview
- **Image metadata** with source attribution
- **Lazy loading** for performance
- **Download functionality**

### 3. Video Search
- **YouTube integration** for comprehensive video content
- **Thumbnail previews** with play buttons
- **Video metadata** (duration, views, channel)
- **Embedded player** support
- **Direct link sharing**

### 4. News Search
- **Category filtering** (Technology, Sports, Politics, etc.)
- **Date-based relevance** for current events
- **Article previews** with snippets
- **Source attribution** and crediting
- **Real-time content updates**

### 5. Advanced Features
- **Real-time suggestions** with debounced API calls
- **Advanced filtering** (category, language, country, date)
- **Search history** with persistence
- **Progressive Web App** capabilities
- **Responsive design** for all devices

## 🔧 API Documentation

### Search Endpoints

#### Web Search
```http
GET /api/search?q=query&page=1&per_page=20
POST /api/search
```

**Parameters:**
- `q` (string, required): Search query
- `page` (number): Page number (default: 1)
- `per_page` (number): Results per page (default: 20)
- `category` (string): Filter by category
- `language` (string): Filter by language
- `sort_by` (string): Sort order (relevance, date, popularity)

#### Image Search
```http
GET /api/images?q=query&page=1&per_page=50
```

#### Video Search
```http
GET /api/videos?q=query&page=1&per_page=20
```

#### News Search
```http
GET /api/news?q=query&category=technology&page=1
```

#### Search Suggestions
```http
GET /api/suggestions?q=partial_query
```

### Response Format

```json
{
  "success": true,
  "data": {
    "results": [...],
    "total": 1500,
    "page": 1,
    "per_page": 20,
    "total_pages": 75,
    "query": "search term",
    "time_taken": 0.125
  },
  "message": "Search completed successfully"
}
```

## 🚀 Deployment

### Development Deployment

```bash
# Quick development setup
npm run dev:setup

# Manual development setup
npm install
cd frontend && npm install && npm run build && cd ..
npm start
```

### Production Deployment

#### Using PM2 (Recommended)
```bash
# Install PM2 globally
npm install -g pm2

# Use the production restart script
chmod +x restart-production.sh
./restart-production.sh

# Or manual PM2 setup
pm2 start app.js --name "bhoomy-search" --instances max
pm2 save
pm2 startup
```

#### Using Docker (Coming Soon)
```bash
# Build Docker image
docker build -t bhoomy-search .

# Run container
docker run -d -p 3000:3000 --name bhoomy-search-app bhoomy-search
```

### Production Environment

For detailed production deployment instructions, see [docs/8-deployment-guide.md](docs/8-deployment-guide.md).

## 📊 Performance

### Benchmarks

- **Bundle Size**: 364KB (117KB gzipped)
- **First Contentful Paint**: < 1.5s
- **Time to Interactive**: < 3s
- **Search Response Time**: < 200ms (cached), < 500ms (fresh)
- **Lighthouse Score**: 85-95/100

### Optimization Features

- **Code Splitting**: Automatic route-based code splitting
- **Lazy Loading**: Components and images loaded on demand
- **Caching**: Multi-layer caching (Redis, browser, CDN)
- **Compression**: Gzip compression for all responses
- **Database Optimization**: Connection pooling and query optimization

## 🛡️ Security

### Security Features

- **Input Validation**: Joi schema validation for all inputs
- **Rate Limiting**: Protection against abuse and DDoS
- **Security Headers**: Helmet.js for comprehensive security headers
- **Authentication**: JWT-based secure authentication
- **Session Management**: Secure session handling
- **Data Sanitization**: XSS and injection protection

### Security Best Practices

- All sensitive data stored in environment variables
- HTTPS enforcement in production
- Regular security audits and dependency updates
- Comprehensive logging for security monitoring
- Bot detection and filtering

## 📈 Monitoring

### Health Checks

```bash
# Application health
curl http://localhost:3000/api/health

# System monitoring
npm run health-check
```

### Logs

- **Application Logs**: `logs/combined.log`
- **Error Logs**: `logs/error.log`
- **PM2 Logs**: `pm2 logs`

### Monitoring Endpoints

- `/api/health` - System health status
- `/api/stats` - Performance statistics
- `/api/metrics` - Application metrics

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suite
npm run test:unit
npm run test:integration
```

### Test Structure

```
tests/
├── unit/           # Unit tests
├── integration/    # Integration tests
├── e2e/           # End-to-end tests
└── fixtures/      # Test data
```

## 📚 Documentation

### Available Documentation

1. **[Project Structure](docs/1-project-structure.md)** - Detailed project organization
2. **[Architecture Diagram](docs/2-architecture-diagram.md)** - System architecture with diagrams
3. **[Component Interaction](docs/3-component-interaction.md)** - Component relationships
4. **[Current State & Roadmap](docs/4-current-state-roadmap.md)** - Project status and future plans
5. **[Features Documentation](docs/5-features-documentation.md)** - Comprehensive feature guide
6. **[Functional Flow](docs/6-functional-flow.md)** - System flow diagrams
7. **[Technical Stack](docs/7-technical-stack.md)** - Technology implementation details
8. **[Deployment Guide](docs/8-deployment-guide.md)** - Production deployment instructions

## 🤝 Contributing

### Development Workflow

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes**
4. **Run tests**: `npm test`
5. **Commit changes**: `git commit -m 'Add amazing feature'`
6. **Push to branch**: `git push origin feature/amazing-feature`
7. **Open a Pull Request**

### Code Standards

- **TypeScript**: Use TypeScript for all new code
- **ESLint**: Follow ESLint configuration
- **Prettier**: Use Prettier for code formatting
- **Testing**: Write tests for new features
- **Documentation**: Update documentation for changes

### Development Guidelines

- Follow existing code patterns and conventions
- Write meaningful commit messages
- Include tests for new functionality
- Update documentation as needed
- Ensure all tests pass before submitting PR

## 🔄 Version History

### Current Version: 5.2.0

#### Latest Updates
- ✅ Complete React 18 + TypeScript migration
- ✅ Elasticsearch 8+ integration
- ✅ Modern build system with Vite
- ✅ Progressive Web App capabilities
- ✅ Comprehensive security implementation
- ✅ Performance optimizations

#### Previous Versions
- **v5.1.0**: Frontend modernization
- **v5.0.0**: Complete architecture overhaul
- **v4.x**: Legacy EJS-based system

### Roadmap

#### Coming Soon
- 🚧 Enhanced AI-powered search features
- 🚧 Advanced analytics dashboard
- 🚧 Docker containerization
- 🚧 GraphQL API implementation
- 🚧 Mobile application

#### Future Plans
- 📋 Microservices architecture
- 📋 Multi-language support
- 📋 Advanced machine learning integration
- 📋 Enterprise features

## 🐛 Troubleshooting

### Common Issues

#### Application Won't Start
```bash
# Check Node.js version
node --version  # Should be 18+

# Check port availability
sudo netstat -tlnp | grep :3000

# Check environment variables
cat .env

# Check logs
npm run health-check
```

#### Database Connection Issues
```bash
# Test MySQL connection
mysql -u [username] -p -h localhost [database_name]

# Check Elasticsearch
curl -X GET "localhost:9200/_cluster/health"
```

#### Performance Issues
```bash
# Check system resources
top
free -h

# Check application logs
tail -f logs/combined.log

# Monitor PM2 processes
pm2 monit
```

### Getting Help

- **Issues**: [GitHub Issues](https://github.com/your-username/mysearch/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-username/mysearch/discussions)
- **Documentation**: Check the `docs/` folder
- **Email**: support@yourdomain.com

## 📄 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Elasticsearch** for powerful search capabilities
- **React Team** for the amazing frontend framework
- **Node.js Community** for the robust backend platform
- **Contributors** who have helped improve this project

## 📞 Contact

- **Author**: Vijay R Dalvi
- **Email**: your-email@example.com
- **Website**: [https://bhoomy.in](https://bhoomy.in)
- **GitHub**: [@your-username](https://github.com/your-username)

---

⭐ **Star this repository** if you find it helpful!

🐛 **Found a bug?** [Open an issue](https://github.com/your-username/mysearch/issues/new)

💡 **Have a suggestion?** [Start a discussion](https://github.com/your-username/mysearch/discussions/new)

---

*Built with ❤️ by [Vijay R Dalvi](https://github.com/your-username)* 