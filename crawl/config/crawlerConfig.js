require('dotenv').config();

module.exports = {
    maxConnections: parseInt(process.env.CRAWLER_MAX_CONNECTIONS || '10'),
    timeout: parseInt(process.env.CRAWLER_TIMEOUT || '300000'),
    rateLimit: parseInt(process.env.CRAWLER_RATE_LIMIT || '3000'),
    retries: parseInt(process.env.CRAWLER_RETRIES || '2'),
    retryTimeout: parseInt(process.env.CRAWLER_RETRY_TIMEOUT || '10000'),
    maxDepth: parseInt(process.env.CRAWLER_MAX_DEPTH || '5'),
    maxPages: parseInt(process.env.CRAWLER_MAX_PAGES || '2000'),
    crawlDelay: parseInt(process.env.CRAWLER_DELAY || '2000'),
    strictSSL: process.env.CRAWLER_STRICT_SSL === 'true',
    rejectUnauthorized: process.env.CRAWLER_REJECT_UNAUTHORIZED === 'true',
    gzip: process.env.CRAWLER_GZIP !== 'false',
    enableProxy: process.env.CRAWLER_ENABLE_PROXY === 'true',
    proxyUrl: process.env.CRAWLER_PROXY_URL || 'http://localhost:3128'
};
