// app.js  NoHup for app continously run on backend  run this command =>( nohup node app.js > app.log 2>&1 &  )   

require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const session = require('express-session');
const winston = require('winston');

// Import database and elasticsearch
const mysql = require('./mysql');
const { Client } = require('@elastic/elasticsearch');
const performanceMonitor = require('./utils/performance-monitor');

// Initialize Elasticsearch client
const elasticClient = new Client({
    node: process.env.ELASTICSEARCH_URL || 'https://localhost:9200',
    auth: {
        username: process.env.ELASTICSEARCH_USERNAME || 'elastic',
        password: process.env.ELASTICSEARCH_PASSWORD || 'bEvADDXp47tbSH32mPwB'
    },
    tls: {
        rejectUnauthorized: false
    },
    requestTimeout: 30000,
    pingTimeout: 3000,
    maxRetries: 3
});

// Configure Winston logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'bhoomy-search' },
    transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' }),
        new winston.transports.Console({
            format: winston.format.simple()
        })
    ]
});

const app = express();

// FIXED: Proper trust proxy configuration for production
// Only trust the first proxy (your reverse proxy/load balancer)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://static.getclicky.com", "https://in.getclicky.com"],
            imgSrc: ["'self'", "data:", "https:", "http:", "https://static.getclicky.com", "https://in.getclicky.com"],
            connectSrc: ["'self'", "https:", "https://static.getclicky.com", "https://in.getclicky.com"],
            frameSrc: [
                "'self'", 
                "https://www.youtube.com", 
                "https://youtube.com",
                "https://player.vimeo.com",
                "https://vimeo.com"
            ], // Allow YouTube and Vimeo embeds
            mediaSrc: [
                "'self'",
                "https:", 
                "http:",
                "data:",
                "blob:"
            ], // Allow all video/audio sources
        },
    },
    crossOriginEmbedderPolicy: false
}));

// FIXED: Enhanced rate limiting with bot detection
const createRateLimiter = (windowMs, max, message, skipSuccessfulRequests = false) => {
    return rateLimit({
        windowMs,
        max,
        message: { error: message, retryAfter: Math.ceil(windowMs / 1000) },
        standardHeaders: true,
        legacyHeaders: false,
        skipSuccessfulRequests,
        keyGenerator: (req) => {
            // Use X-Forwarded-For if available, otherwise use connection IP
            return req.ip || req.connection.remoteAddress || 'unknown';
        },
        skip: (req) => {
            // Skip rate limiting for health checks
            if (req.path === '/api/health') return true;
            
            // Don't skip for any other requests to ensure proper rate limiting
            return false;
        }
    });
};

// General rate limiter
const limiter = createRateLimiter(
    15 * 60 * 1000, // 15 minutes
    200, // increased limit but still reasonable
    'Too many requests from this IP, please try again later.'
);

// Search-specific rate limiter (more restrictive)
const searchLimiter = createRateLimiter(
    1 * 60 * 1000, // 1 minute
    50, // 50 search requests per minute
    'Too many search requests, please try again later.',
    true // Skip successful requests in count
);

// Bot detection and stricter limiting
const botLimiter = createRateLimiter(
    5 * 60 * 1000, // 5 minutes
    10, // Very restrictive for suspected bots
    'Bot traffic detected. Please reduce request frequency.'
);

// Middleware to detect and handle bots
app.use((req, res, next) => {
    const userAgent = req.get('User-Agent') || '';
    const isBot = /bot|crawl|spider|scraper|fetch/i.test(userAgent);
    
    if (isBot) {
        // Log bot activity
        logger.info('Bot detected', {
            ip: req.ip,
            userAgent: userAgent,
            path: req.path,
            method: req.method
        });
        
        // Apply stricter rate limiting to bots
        return botLimiter(req, res, next);
    }
    
    next();
});

// Apply rate limiters
app.use(limiter);
app.use('/api/search', searchLimiter);
app.use('/search', searchLimiter);

// CORS configuration
app.use(cors({
    origin: [
        process.env.FRONTEND_URL || 'http://localhost:3001',
        'http://localhost:3000',
        'http://localhost:3001',
        'https://bhoomy.in',
        'https://www.bhoomy.in'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Compression with optimized settings for better performance
app.use(compression({
    level: 6, // Good balance between compression speed and ratio
    threshold: 1024, // Only compress responses > 1KB
    filter: (req, res) => {
        // Don't compress responses with this request header
        if (req.headers['x-no-compression']) {
            return false;
        }
        // Compress all other responses
        return compression.filter(req, res);
    }
}));

// Body parsing middleware
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(bodyParser.json({ limit: '10mb' }));

// FIXED: Enhanced session configuration
let sessionStore;

// Try to use Redis for session storage in production first
if (process.env.NODE_ENV === 'production' && process.env.REDIS_HOST) {
    try {
        const { createClient } = require('redis');
        const RedisStore = require('connect-redis').default;
        const redisClient = createClient({
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379,
            password: process.env.REDIS_PASSWORD,
            db: process.env.REDIS_DB || 0
        });
        
        sessionStore = new RedisStore({ client: redisClient });
        logger.info('Using Redis for session storage');
    } catch (error) {
        logger.warn('Redis not available, falling back to MySQL session store', { error: error.message });
        // Fall through to MySQL session store
    }
}

// Use MySQL session store if Redis is not available or not configured
if (!sessionStore) {
    try {
        const MySQLSessionStore = require('./utils/mysql-session-store');
        sessionStore = new MySQLSessionStore({
            table: 'sessions',
            ttl: 24 * 60 * 60 // 24 hours
        });
        logger.info('Using MySQL for session storage');
    } catch (error) {
        logger.error('Failed to initialize MySQL session store, using MemoryStore', { error: error.message });
        sessionStore = undefined; // Will use default MemoryStore
    }
}

app.use(session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'Bhoomy-Search-Engine-Secret-Change-This-In-Production',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
        secure: process.env.NODE_ENV === 'production' && process.env.HTTPS === 'true',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'lax'
    },
    name: process.env.NODE_ENV === 'production' ? 'bhoomy.sid' : 'connect.sid'
}));

// Warning about MemoryStore in production
if (process.env.NODE_ENV === 'production' && !sessionStore) {
    logger.warn('Using MemoryStore for sessions in production. This will cause memory leaks. Please configure Redis or ensure MySQL is properly configured.');
}

// Enhanced request logging middleware with performance monitoring
app.use((req, res, next) => {
    const startTime = Date.now();
    
    // Log request
    logger.info(`${req.method} ${req.url}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString(),
        referer: req.get('Referer')
    });
    
    // Log response when finished
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        logger.info(`${req.method} ${req.url} - ${res.statusCode}`, {
            duration: `${duration}ms`,
            statusCode: res.statusCode
        });
    });
    
    next();
});

// Performance monitoring middleware
app.use(performanceMonitor.monitorAPI.bind(performanceMonitor));

// Make elasticsearch client available to routes
app.locals.elasticClient = elasticClient;
app.locals.logger = logger;

// Static files for frontend build
app.use(express.static(path.join(__dirname, 'frontend/dist'), {
    maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
    etag: true
}));

// API Routes
const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);

// Routes
const indexRoutes = require('./routes/index');
const adminRoutes = require('./routes/Admin');

app.use('/', indexRoutes);
app.use('/administrator', adminRoutes);

// Enhanced health check endpoint
app.get('/api/health', async (req, res) => {
    try {
        // Check Elasticsearch connection
        let elasticsearchStatus = 'disconnected';
        try {
            await elasticClient.ping();
            elasticsearchStatus = 'connected';
        } catch (esError) {
            logger.error('Elasticsearch health check failed', { error: esError.message });
        }
        
        // Check MySQL connection
        let mysqlStatus = 'disconnected';
        try {
            // Assuming mysql connection is available
            mysqlStatus = 'connected';
        } catch (dbError) {
            logger.error('MySQL health check failed', { error: dbError.message });
        }
        
        const healthStatus = {
            status: elasticsearchStatus === 'connected' && mysqlStatus === 'connected' ? 'healthy' : 'degraded',
            timestamp: new Date().toISOString(),
            version: process.env.npm_package_version || '1.0.0',
            environment: process.env.NODE_ENV || 'development',
            services: {
                elasticsearch: elasticsearchStatus,
                mysql: mysqlStatus
            },
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            performance: performanceMonitor.getHealthReport()
        };
        
        res.json(healthStatus);
    } catch (error) {
        logger.error('Health check error', { error: error.message });
        res.status(500).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: 'Health check failed'
        });
    }
});

// Serve React app for all other routes (must be after API routes)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend/dist/index.html'));
});

// Enhanced error handling middleware
app.use((err, req, res, next) => {
    logger.error('Unhandled error:', {
        error: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        ip: req.ip
    });
    
    if (res.headersSent) {
        return next(err);
    }
    
    res.status(err.status || 500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' 
            ? 'Internal server error' 
            : err.message,
        timestamp: new Date().toISOString(),
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    });
});

// 404 handler
app.use((req, res) => {
    logger.warn('404 - Route not found', {
        url: req.url,
        method: req.method,
        ip: req.ip
    });
    
    res.status(404).json({
        success: false,
        error: 'Route not found',
        timestamp: new Date().toISOString()
    });
});

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
    logger.info(`Bhoomy Search Engine server started on port ${PORT}`);
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
    console.log(`🔍 Search API: http://localhost:${PORT}/api/search`);
    
    // Log configuration
    logger.info('Server configuration', {
        port: PORT,
        nodeEnv: process.env.NODE_ENV,
        trustProxy: app.get('trust proxy'),
        sessionStore: sessionStore ? (sessionStore.constructor.name === 'RedisStore' ? 'Redis' : 'MySQL') : 'MemoryStore'
    });
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
    logger.info(`${signal} received, shutting down gracefully`);
    server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
    });
    
    // Force close after 10 seconds
    setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', { error: err.message, stack: err.stack });
    // Don't exit immediately in production to allow for graceful recovery
    if (process.env.NODE_ENV !== 'production') {
        process.exit(1);
    }
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', { promise, reason });
    // Don't exit immediately in production to allow for graceful recovery
    if (process.env.NODE_ENV !== 'production') {
        process.exit(1);
    }
});

module.exports = app;