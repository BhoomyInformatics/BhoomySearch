# Crawler Restructured

This is a restructured crawler application following a modular architecture.

## Folder Structure

```
crawl/
├── config/          # Configuration files
│   ├── crawlerConfig.js
│   ├── db.js
│   ├── headers.js
│   ├── proxies.js
│   └── user-agents.js
├── core/            # Core functionality
│   ├── crawler.js
│   ├── indexer.js
│   └── parser.js
├── handlers/        # Content handlers
│   ├── contentTypeHandler.js
│   ├── dataHandler.js
│   ├── documentHandler.js
│   ├── htmlHandler.js
│   └── imageHandler.js
├── logs/            # Log files (auto-generated)
├── utils/           # Utility functions
│   ├── duplicateChecker.js
│   ├── logger.js
│   ├── log-cleanup.js
│   └── urlValidator.js
├── bhoomy_com.js    # Main crawler script
├── autosync_elastic.js  # Elasticsearch sync script
└── .env             # Environment variables (create from .env.example)
```

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file from `.env.example`:
```bash
cp .env.example .env
```

3. Update `.env` with your database credentials:
```
DB_HOST=localhost
DB_USER=mybhoomy_data
DB_PASSWORD=ookfF^6CWf^!dH0
DB_NAME=mybhoomy_sitedata
```

## Database Schema

The application uses the `mybhoomy_sitedata` database with the following main tables:
- `sites` - Site configuration
- `site_data` - Crawled page data
- `site_img` - Image data
- `site_doc` - Document data
- `site_videos` - Video data

## Usage

### Start Crawler
```bash
npm start
# or
node bhoomy_com.js
```

### Start Elasticsearch Sync
```bash
npm run sync
# or
node autosync_elastic.js
```

## Requirements

- Node.js 22.0.0 or higher
- MySQL/MariaDB database
- Elasticsearch (optional, for search indexing)

## Configuration

All configuration is done through environment variables in the `.env` file. See `.env.example` for all available options.

## Logging

Logs are automatically written to the `logs/` directory:
- `combined-YYYY-MM-DD.log` - All logs
- `error-YYYY-MM-DD.log` - Error logs only
- `info-YYYY-MM-DD.log` - Info logs only
- `debug-YYYY-MM-DD.log` - Debug logs only
- `exceptions-YYYY-MM-DD.log` - Uncaught exceptions
- `rejections-YYYY-MM-DD.log` - Unhandled promise rejections

## Architecture

The application follows a modular architecture:

- **Config**: Centralized configuration management
- **Core**: Main crawler, parser, and indexer logic
- **Handlers**: Specialized handlers for different content types
- **Utils**: Reusable utility functions

This structure makes the codebase easier to understand, maintain, and extend.
