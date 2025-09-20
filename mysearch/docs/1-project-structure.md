# Bhoomy Search Engine - Project Structure Documentation

## Overview
The Bhoomy Search Engine is a modern, full-stack web application built with Node.js backend and React frontend. It provides comprehensive search capabilities including web search, image search, video search, and news search with advanced filtering and suggestion features.

## Directory Structure

```
mysearch/
├── app.js                          # Main application entry point
├── package.json                    # Node.js dependencies and scripts
├── package-lock.json               # Locked dependency versions
├── restart-production.sh           # Production deployment script
├── start-dev.js                    # Development startup script
├── env.example                     # Environment configuration template
├── env.example.new                 # Updated environment template
├── mysql.js                        # MySQL database connection
├── create_indices_corrected.js     # Elasticsearch index creation
├── mybhoomy_mysearch_schema.sql    # Database schema
├── ELASTICSEARCH_8_UPGRADE_SUMMARY.md
├── MODERNIZATION_COMPLETE.md
├── PRODUCTION_FIX.md
├── Server\ Settings                # Server configuration files
│
├── controllers/                    # MVC Controllers
│   ├── rootController.js          # Root route controller
│   ├── Admin/
│   │   └── dashbordController.js   # Admin dashboard controller
│   └── Apis/
│       └── SiteController.js       # Main search API controller
│
├── routes/                         # Express.js routes
│   ├── index.js                    # Main routes
│   ├── api.js                      # API routes with validation
│   ├── Apis.js                     # Modern API routes
│   └── Admin.js                    # Admin routes
│
├── models/                         # Data models
│   ├── searchModel.js              # Search model interface
│   ├── SiteModel.js                # Site data model
│   └── elastic_search/
│       ├── site.js                 # Elasticsearch search operations
│       └── Backup.js               # Backup operations
│
├── utils/                          # Utility functions
│   ├── health-check.js             # System health monitoring
│   └── logger.js                   # Winston logging configuration
│
├── logs/                           # Application logs
│   ├── combined.log                # All logs
│   └── error.log                   # Error logs only
│
├── frontend/                       # React frontend application
│   ├── package.json                # Frontend dependencies
│   ├── package-lock.json           # Frontend locked dependencies
│   ├── vite.config.ts              # Vite build configuration
│   ├── tailwind.config.js          # TailwindCSS configuration
│   ├── postcss.config.js           # PostCSS configuration
│   ├── tsconfig.json               # TypeScript configuration
│   ├── tsconfig.node.json          # TypeScript Node configuration
│   ├── index.html                  # Main HTML template
│   │
│   ├── src/                        # React source code
│   │   ├── main.tsx                # React application entry point
│   │   ├── App.tsx                 # Main React component
│   │   ├── index.css               # Global styles
│   │   │
│   │   ├── components/             # Reusable React components
│   │   │   ├── Header.tsx          # Application header
│   │   │   ├── Footer.tsx          # Application footer
│   │   │   └── SearchSuggestions.tsx # Search suggestions component
│   │   │
│   │   ├── pages/                  # Page components
│   │   │   ├── HomePage.tsx        # Landing page with search
│   │   │   ├── SearchPage.tsx      # Main search results page
│   │   │   ├── ImagesPage.tsx      # Image search page
│   │   │   ├── VideosPage.tsx      # Video search page
│   │   │   ├── NewsPage.tsx        # News search page
│   │   │   └── AdminPage.tsx       # Admin dashboard page
│   │   │
│   │   ├── store/                  # State management
│   │   │   └── searchStore.ts      # Zustand search store
│   │   │
│   │   ├── hooks/                  # Custom React hooks (empty)
│   │   │
│   │   ├── types/                  # TypeScript type definitions
│   │   │   └── index.ts            # All application types
│   │   │
│   │   └── utils/                  # Frontend utilities
│   │       └── api.ts              # API client and utilities
│   │
│   └── public/                     # Static assets
│       ├── images/                 # Application images
│       │   ├── Bhoomy.png          # Main logo
│       │   ├── Bhoomy1.png         # Alternative logo
│       │   ├── bhoomyn.png         # Logo variation
│       │   ├── icon.png            # Application icon
│       │   ├── News.jpg            # News section image
│       │   └── video.jpg           # Video section image
│       │
│       └── manifest.json           # PWA manifest
│
└── docs/                           # Documentation (this folder)
    ├── 1-project-structure.md      # This file
    ├── 2-architecture-diagram.md   # Architecture documentation
    ├── 3-component-interaction.md  # Component interaction diagrams
    ├── 4-current-state-roadmap.md  # Current state and future plans
    ├── 5-features-documentation.md # Feature documentation
    ├── 6-functional-flow.md        # Functional flow diagrams
    ├── 7-technical-stack.md        # Technical stack and improvements
    ├── 8-deployment-guide.md       # Production deployment guide
    └── 9-README.md                 # Main README file
```

## File Type Categories

### Core Application Files
- **app.js**: Main Express.js application with middleware setup, security, and routing
- **package.json**: Node.js dependencies, scripts, and project metadata
- **mysql.js**: MySQL database connection pool configuration
- **start-dev.js**: Development environment startup script with service checks
- **restart-production.sh**: Production deployment and restart script

### Configuration Files
- **env.example**: Environment variables template with database, Elasticsearch, and API configurations
- **vite.config.ts**: Vite build tool configuration for frontend
- **tailwind.config.js**: TailwindCSS utility-first CSS framework configuration
- **tsconfig.json**: TypeScript compiler configuration for strict type checking

### Backend Architecture
- **controllers/**: MVC pattern controllers handling business logic
- **routes/**: Express.js routes with validation and error handling
- **models/**: Data access layer with Elasticsearch and MySQL integration
- **utils/**: Utility functions for logging, health checks, and common operations

### Frontend Architecture
- **src/components/**: Reusable React components with TypeScript
- **src/pages/**: Page-level components for different search functionalities
- **src/store/**: Zustand state management for search state and user preferences
- **src/types/**: TypeScript interfaces and type definitions
- **src/utils/**: Frontend utilities including API client with axios

### Static Assets
- **public/images/**: Application branding and UI images
- **public/images/**: Application images and assets

### Documentation and Logs
- **docs/**: Comprehensive project documentation
- **logs/**: Application logs separated by level (combined, error)
- **MODERNIZATION_COMPLETE.md**: Documentation of recent React modernization
- **ELASTICSEARCH_8_UPGRADE_SUMMARY.md**: Elasticsearch upgrade documentation

## Key Architectural Decisions

### 1. **Modern Frontend Stack**
- **React 18**: Latest React version with concurrent features
- **TypeScript**: Type safety and better developer experience
- **Vite**: Fast build tool replacing Create React App
- **TailwindCSS**: Utility-first CSS framework for rapid UI development
- **Zustand**: Lightweight state management replacing Redux

### 2. **Backend Architecture**
- **Express.js**: Minimal and flexible Node.js framework
- **MVC Pattern**: Clear separation of concerns
- **Elasticsearch**: Advanced search capabilities with filtering and aggregations
- **MySQL**: Relational database for structured data
- **Redis**: Caching layer for improved performance

### 3. **Security and Performance**
- **Helmet**: Security headers and protection
- **Rate Limiting**: Protection against abuse
- **Input Validation**: Joi validation for all API endpoints
- **Session Management**: Secure session handling
- **Compression**: Gzip compression for responses

### 4. **Development and Deployment**
- **Environment-based Configuration**: Separate settings for development/production
- **Health Checks**: Comprehensive system monitoring
- **Logging**: Winston for structured logging
- **Process Management**: PM2 for production deployment

## Dependencies Overview

### Backend Dependencies
- **Core**: express, body-parser, cors, helmet, compression
- **Database**: mysql2, @elastic/elasticsearch, redis
- **Security**: bcrypt, jsonwebtoken, express-rate-limit
- **Utilities**: winston, joi, uuid, axios, socket.io

### Frontend Dependencies
- **Core**: react, react-dom, react-router-dom
- **UI**: @headlessui/react, @heroicons/react, lucide-react
- **State**: zustand, @reduxjs/toolkit
- **Animation**: framer-motion
- **Forms**: react-hook-form
- **Notifications**: react-hot-toast
- **HTTP**: axios, socket.io-client

### Development Dependencies
- **Build Tools**: vite, @vitejs/plugin-react
- **TypeScript**: typescript, @types/react, @types/react-dom
- **CSS**: tailwindcss, postcss, autoprefixer
- **Linting**: eslint, @typescript-eslint/eslint-plugin
- **Testing**: jest, supertest
- **Process Management**: nodemon, concurrently, pm2

This structure follows modern web development best practices with clear separation of concerns, type safety, and scalable architecture patterns. 