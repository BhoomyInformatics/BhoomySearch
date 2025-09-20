const { logger } = require('./logger');

class UrlValidator {
    constructor() {
        this.allowedProtocols = ['http:', 'https:'];
        this.blockedDomains = new Set([
            'localhost',
            '127.0.0.1',
            '0.0.0.0',
            '::1'
        ]);
        this.blockedTlds = new Set([
            'onion', // Tor hidden services
            'i2p',   // I2P network
            'bit'    // Namecoin domains
        ]);
        this.maxUrlLength = 2048;
        this.suspiciousPatterns = [
            // /[^\x00-\x7F]/,  // Removed: Non-ASCII characters (allow Unicode URLs)
            /\s/,            // Whitespace
            /<|>/,           // HTML brackets
            /javascript:/i,   // JavaScript protocol
            /data:/i,        // Data URLs
            /file:/i,        // File protocol
            /ftp:/i,         // FTP protocol
            /[(){}[\]]$/,    // Malformed URLs ending with brackets/parentheses
            /[.,;!]$/,      // URLs ending with punctuation (likely extraction errors) - Allow trailing ? for query parameters
            /\)\s*$/,        // URLs ending with parentheses and optional whitespace
            /\]\s*$/         // URLs ending with square brackets and optional whitespace
        ];
    }

    isValid(url) {
        try {
            if (!url || typeof url !== 'string') {
                logger.debug('URL validation failed: invalid input', { url });
                return false;
            }

            // Check URL length
            if (url.length > this.maxUrlLength) {
                logger.debug('URL validation failed: too long', { url: url.substring(0, 100) + '...', length: url.length });
                return false;
            }

            // Try to auto-fix URLs with spaces by encoding them
            let cleanUrl = url;
            if (/\s/.test(url)) {
                cleanUrl = this.encodeUrlSpaces(url);
                logger.debug('URL contained spaces, auto-encoded', { original: url, encoded: cleanUrl });
            }

            // Check for suspicious patterns (excluding spaces since we handle them above)
            if (this.hasSuspiciousPatterns(cleanUrl, true)) {
                logger.debug('URL validation failed: suspicious patterns', { url: cleanUrl });
                return false;
            }

            // Parse URL
            const urlObj = new URL(cleanUrl);

            // Check protocol
            if (!this.allowedProtocols.includes(urlObj.protocol)) {
                logger.debug('URL validation failed: invalid protocol', { url, protocol: urlObj.protocol });
                return false;
            }

            // Check domain
            if (this.isBlockedDomain(urlObj.hostname)) {
                logger.debug('URL validation failed: blocked domain', { url, hostname: urlObj.hostname });
                return false;
            }

            // Check TLD
            if (this.isBlockedTld(urlObj.hostname)) {
                logger.debug('URL validation failed: blocked TLD', { url, hostname: urlObj.hostname });
                return false;
            }

            // Check for valid hostname format
            if (!this.isValidHostname(urlObj.hostname)) {
                logger.debug('URL validation failed: invalid hostname format', { url, hostname: urlObj.hostname });
                return false;
            }

            return cleanUrl; // Return the cleaned URL instead of just true
        } catch (error) {
            logger.debug('URL validation failed: parsing error', { url, error: error.message });
            return false;
        }
    }

    normalize(url) {
        try {
            if (!this.isValid(url)) {
                throw new Error('Invalid URL cannot be normalized');
            }

            const urlObj = new URL(url);

            // Remove fragment
            urlObj.hash = '';

            // Remove default ports
            if ((urlObj.protocol === 'http:' && urlObj.port === '80') ||
                (urlObj.protocol === 'https:' && urlObj.port === '443')) {
                urlObj.port = '';
            }

            // Normalize hostname (lowercase)
            urlObj.hostname = urlObj.hostname.toLowerCase();

            // Remove trailing slash from pathname if it's just '/'
            if (urlObj.pathname === '/') {
                // Keep the trailing slash for root paths
            } else {
                // Remove trailing slash for other paths
                urlObj.pathname = urlObj.pathname.replace(/\/+$/, '');
            }

            // Sort query parameters for consistency
            if (urlObj.search) {
                const params = new URLSearchParams(urlObj.search);
                const sortedParams = new URLSearchParams();
                
                // Sort parameters alphabetically
                const sortedKeys = Array.from(params.keys()).sort();
                for (const key of sortedKeys) {
                    const values = params.getAll(key);
                    for (const value of values) {
                        sortedParams.append(key, value);
                    }
                }
                
                urlObj.search = sortedParams.toString();
            }

            const normalizedUrl = urlObj.toString();
            
            logger.debug('URL normalized', { original: url, normalized: normalizedUrl });
            return normalizedUrl;
        } catch (error) {
            logger.error('Error normalizing URL', { url, error: error.message });
            throw error;
        }
    }

    hasSuspiciousPatterns(url, excludeSpaces = false) {
        const patterns = excludeSpaces 
            ? this.suspiciousPatterns.filter(pattern => pattern.source !== '\\s')
            : this.suspiciousPatterns;
        return patterns.some(pattern => pattern.test(url));
    }

    /**
     * Encode spaces and other problematic characters in URLs
     */
    encodeUrlSpaces(url) {
        try {
            // First, split the URL into parts to avoid encoding the protocol and domain
            const urlParts = url.match(/^(https?:\/\/[^\/]+)(.*)$/);
            
            if (urlParts) {
                const [, baseUrl, path] = urlParts;
                // Only encode the path part, leave the base URL intact
                const encodedPath = path.replace(/\s/g, '%20');
                return baseUrl + encodedPath;
            } else {
                // Fallback: encode the entire URL
                return url.replace(/\s/g, '%20');
            }
        } catch (error) {
            logger.debug('Error encoding URL spaces', { url, error: error.message });
            return url.replace(/\s/g, '%20'); // Simple fallback
        }
    }

    isBlockedDomain(hostname) {
        if (!hostname) return true;
        
        const lowerHostname = hostname.toLowerCase();
        
        // Check exact matches
        if (this.blockedDomains.has(lowerHostname)) {
            return true;
        }

        // Check for private IP ranges
        if (this.isPrivateIp(lowerHostname)) {
            return true;
        }

        return false;
    }

    isBlockedTld(hostname) {
        if (!hostname) return true;
        
        const parts = hostname.toLowerCase().split('.');
        const tld = parts[parts.length - 1];
        
        return this.blockedTlds.has(tld);
    }

    isValidHostname(hostname) {
        if (!hostname || hostname.length === 0) {
            return false;
        }

        // Check length
        if (hostname.length > 253) {
            return false;
        }

        // Check for valid characters and format
        const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        
        if (!hostnameRegex.test(hostname)) {
            return false;
        }

        // Check that it's not all numeric (unless it's an IP)
        if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
            return this.isValidIpAddress(hostname);
        }

        return true;
    }

    isValidIpAddress(ip) {
        const parts = ip.split('.');
        if (parts.length !== 4) {
            return false;
        }

        return parts.every(part => {
            const num = parseInt(part, 10);
            return num >= 0 && num <= 255 && part === num.toString();
        });
    }

    isPrivateIp(hostname) {
        if (!this.isValidIpAddress(hostname)) {
            return false;
        }

        const parts = hostname.split('.').map(part => parseInt(part, 10));
        const [a, b, c, d] = parts;

        // Private IP ranges:
        // 10.0.0.0 - 10.255.255.255
        // 172.16.0.0 - 172.31.255.255
        // 192.168.0.0 - 192.168.255.255
        // 127.0.0.0 - 127.255.255.255 (loopback)
        
        return (
            a === 10 ||
            (a === 172 && b >= 16 && b <= 31) ||
            (a === 192 && b === 168) ||
            a === 127
        );
    }

    extractDomain(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname.toLowerCase();
        } catch (error) {
            logger.error('Error extracting domain', { url, error: error.message });
            return null;
        }
    }

    extractRootDomain(url) {
        try {
            const domain = this.extractDomain(url);
            if (!domain) return null;

            const parts = domain.split('.');
            
            // Handle special TLDs like .co.uk, .com.au
            const specialTlds = ['co.uk', 'com.au', 'co.jp', 'co.in', 'co.za'];
            const domainStr = parts.join('.');
            
            for (const tld of specialTlds) {
                if (domainStr.endsWith('.' + tld)) {
                    const beforeTld = domainStr.substring(0, domainStr.length - tld.length - 1);
                    const beforeParts = beforeTld.split('.');
                    if (beforeParts.length >= 1) {
                        return beforeParts[beforeParts.length - 1] + '.' + tld;
                    }
                }
            }

            // Standard TLD handling
            if (parts.length >= 2) {
                return parts.slice(-2).join('.');
            }

            return domain;
        } catch (error) {
            logger.error('Error extracting root domain', { url, error: error.message });
            return null;
        }
    }

    isSameDomain(url1, url2) {
        try {
            const domain1 = this.extractRootDomain(url1);
            const domain2 = this.extractRootDomain(url2);
            
            return domain1 && domain2 && domain1 === domain2;
        } catch (error) {
            logger.error('Error comparing domains', { url1, url2, error: error.message });
            return false;
        }
    }

    isSubdomain(url, parentDomain) {
        try {
            const domain = this.extractDomain(url);
            if (!domain || !parentDomain) return false;

            const cleanParentDomain = parentDomain.toLowerCase().replace(/^www\./, '');
            const cleanDomain = domain.replace(/^www\./, '');

            return cleanDomain === cleanParentDomain || cleanDomain.endsWith('.' + cleanParentDomain);
        } catch (error) {
            logger.error('Error checking subdomain', { url, parentDomain, error: error.message });
            return false;
        }
    }

    resolveRelativeUrl(relativeUrl, baseUrl) {
        try {
            if (!relativeUrl || !baseUrl) {
                throw new Error('Both relative URL and base URL are required');
            }

            // If it's already an absolute URL, validate and return
            if (relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://')) {
                return this.isValid(relativeUrl) ? relativeUrl : null;
            }

            const resolvedUrl = new URL(relativeUrl, baseUrl).toString();
            return this.isValid(resolvedUrl) ? resolvedUrl : null;
        } catch (error) {
            logger.debug('Error resolving relative URL', { relativeUrl, baseUrl, error: error.message });
            return null;
        }
    }

    getUrlDepth(url) {
        try {
            const urlObj = new URL(url);
            const pathParts = urlObj.pathname.split('/').filter(part => part.length > 0);
            return pathParts.length;
        } catch (error) {
            logger.error('Error calculating URL depth', { url, error: error.message });
            return 0;
        }
    }

    hasFileExtension(url, extensions = []) {
        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname.toLowerCase();
            
            if (extensions.length === 0) {
                // Check for any file extension
                return /\.[a-z0-9]+$/i.test(pathname);
            }
            
            // Check for specific extensions
            const regex = new RegExp(`\\.(${extensions.join('|')})$`, 'i');
            return regex.test(pathname);
        } catch (error) {
            logger.error('Error checking file extension', { url, error: error.message });
            return false;
        }
    }

    removeQueryParams(url, paramsToRemove = []) {
        try {
            const urlObj = new URL(url);
            
            if (paramsToRemove.length === 0) {
                // Remove all query parameters
                urlObj.search = '';
            } else {
                // Remove specific parameters
                const params = new URLSearchParams(urlObj.search);
                for (const param of paramsToRemove) {
                    params.delete(param);
                }
                urlObj.search = params.toString();
            }
            
            return urlObj.toString();
        } catch (error) {
            logger.error('Error removing query params', { url, error: error.message });
            return url;
        }
    }

    addBlockedDomain(domain) {
        if (domain && typeof domain === 'string') {
            this.blockedDomains.add(domain.toLowerCase());
            logger.info('Added blocked domain', { domain });
        }
    }

    removeBlockedDomain(domain) {
        if (domain && typeof domain === 'string') {
            const removed = this.blockedDomains.delete(domain.toLowerCase());
            if (removed) {
                logger.info('Removed blocked domain', { domain });
            }
            return removed;
        }
        return false;
    }

    getBlockedDomains() {
        return Array.from(this.blockedDomains);
    }
}

// Create singleton instance
const urlValidator = new UrlValidator();

module.exports = { urlValidator, UrlValidator }; 