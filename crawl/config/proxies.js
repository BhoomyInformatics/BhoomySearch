// TOR SOCKS5 proxy configuration
const TOR_PROXY = "socks5h://127.0.0.1:9050";

// Backup proxy list for fallback
const BACKUP_PROXIES = [
    "socks5://127.0.0.1:1080",   // Dante SOCKS5
    "http://localhost:3128",      // Squid HTTP
    "http://localhost:8080",      // Alternative HTTP
    "socks5://localhost:1080",    // Alternative SOCKS5
    "http://127.0.0.1:3128",     // Local Squid
    "socks5://127.0.0.1:9050"    // Local TOR (fallback)
];

// Proxy configuration options
const proxyConfig = {
    // TOR specific settings
    tor: {
        url: TOR_PROXY,
        timeout: 30000,
        retries: 2,
        retryDelay: 5000
    },
    
    // Backup proxy settings
    backup: {
        urls: BACKUP_PROXIES,
        timeout: 20000,
        retries: 1,
        retryDelay: 3000
    },
    
    // Direct connection settings
    direct: {
        timeout: 15000,
        retries: 0
    },
    
    // Common settings for all proxies
    common: {
        strictSSL: false,
        rejectUnauthorized: false,
        tunnel: false
    }
};

// Export proxy configurations
module.exports = {
    TOR_PROXY,
    BACKUP_PROXIES,
    proxyConfig
};
