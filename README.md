## Bhoomy Search Engine (SearchEngine Monorepo)

This repository contains the full Bhoomy Search Engine stack:

- **`crawl/`**: modular web crawler that discovers, parses and indexes site content into MySQL and (optionally) Elasticsearch.
- **`mysearch/`**: production-ready search application (Node.js + Express backend and React + TypeScript frontend) that provides web, image, video and news search with advanced filtering, suggestions, analytics and admin tools.

### Project Structure

- **`crawl/`** – Node.js crawler service  
  - `config/` – crawler, database, headers, proxies and user-agent configuration  
  - `core/` – core crawling, parsing and indexing logic (`crawler.js`, `parser.js`, `indexer.js`)  
  - `handlers/` – specialized handlers for HTML, images, documents, data and content types  
  - helper scripts such as `bhoomy_com.js` (main crawler), `autosync_elastic.js` (Elasticsearch sync), `cleanup.js`, `addsite.js`, `news_site.js` and URL lists

- **`mysearch/`** – main search application  
  - `app.js` – Express server with security middleware, rate limiting, session handling, logging and health checks  
  - `routes/`, `controllers/`, `models/`, `utils/` – backend MVC, MySQL/Elasticsearch access, Redis caching, logging, performance monitoring  
  - `frontend/` – React 18 + TypeScript + Vite + Tailwind SPA (pages for home, search, images, videos, news, admin, auth)  
  - `docs/` – detailed internal docs: project structure, architecture, component interaction, functional flows, technical stack, deployment guide and main README  

### High-Level Architecture

- **Data flow**
  1. `crawl/` fetches pages, parses HTML, extracts metadata/content, stores structured data in MySQL and indexes documents into Elasticsearch.
  2. `mysearch` backend exposes REST APIs (`/api/search`, `/api/images`, `/api/videos`, `/api/news`, suggestions, health, admin) that query Elasticsearch with MySQL as a fallback and cache hot queries in Redis.
  3. `mysearch/frontend` calls these APIs and renders results with filters, suggestions, result snippets, thumbnails and analytics.

- **Core technologies**
  - Backend: Node.js, Express, MySQL, Elasticsearch 8+, Redis, Winston, Joi, Helmet, rate limiting, PM2
  - Frontend: React 18, TypeScript, Vite, TailwindCSS, Zustand, React Router, Framer Motion, React Hook Form, React Hot Toast

### Getting Started

#### Prerequisites

- Node.js **18+** (backend and frontend)
- MySQL / MariaDB (for crawler and search data)
- Elasticsearch **8+** (for search indices)
- Redis (for caching and sessions; optional but recommended)

#### 1. Setup and run the crawler (`crawl/`)

```bash
cd crawl
npm install

# configure environment (see crawl/README.md)
cp .env.example .env
# edit .env with DB and Elasticsearch settings

# run main crawler
npm start
# or
node bhoomy_com.js

# run Elasticsearch sync (optional)
npm run sync
# or
node autosync_elastic.js
```

#### 2. Setup and run the search app (`mysearch/`)

```bash
cd mysearch
npm install

# configure environment from templates in docs / env.example
cp env.example .env
# edit .env with DB, Elasticsearch, Redis, YouTube API and SESSION settings

# start backend (development)
npm run dev   # or: node app.js

# in another terminal, start frontend
cd frontend
npm install
npm run dev
```

Then open the frontend dev URL (typically `http://localhost:5173` or as shown by Vite) and access the backend on `http://localhost:3000` (or the port from `PORT` in `.env`).

### Key Features

- **Multi-vertical search**: web, images, videos (via YouTube API) and news, all sharing a common query pipeline.
- **Advanced UX**: suggestions, filters, pagination, ranking visualization, relevant topics, optimized result rendering and lazy loading.
- **Admin dashboard**: manage sites, monitor crawling, review analytics and system health.
- **Performance**: Redis caching, connection pooling, rate limiting, compression, background performance monitoring and health checks.
- **Security & reliability**: Helmet CSP, CORS configuration, robust validation, structured logging, graceful shutdown and fallbacks when Elasticsearch is unavailable.

### Documentation

For deep-dive technical details, refer to:

- `crawl/README.md` – crawler architecture, setup and usage
- `mysearch/docs/` – project structure, architecture diagrams, functional flows, technical stack, deployment guide and main README for the `mysearch` service

