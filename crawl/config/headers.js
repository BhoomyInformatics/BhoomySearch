// Common headers for web requests
const commonHeaders = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Cache-Control': 'max-age=0',
    'TE': 'Trailers'
};

// Headers for modern browsers
const modernBrowserHeaders = {
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Sec-GPC': '1'
};

// Headers for mobile devices
const mobileHeaders = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Cache-Control': 'max-age=0',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Sec-GPC': '1',
    'Viewport-Width': '360',
    'Width': '360'
};

// Headers for API requests
const apiHeaders = {
    'Accept': 'application/json, text/plain, */*',
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest'
};

// Enhanced stealth headers for bypassing bot detection
const enhancedStealthHeaders = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Cache-Control': 'max-age=0',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Sec-Ch-Ua': '"Google Chrome";v="123", "Not:A-Brand";v="8", "Chromium";v="123"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Ch-Ua-Platform-Version': '"15.0.0"',
    'Sec-Ch-Ua-Full-Version-List': '"Google Chrome";v="123.0.6312.122", "Not:A-Brand";v="8.0.0.0", "Chromium";v="123.0.6312.122"',
    'Sec-Ch-Ua-Arch': '"x86"',
    'Sec-Ch-Ua-Bitness': '"64"',
    'Sec-Ch-Ua-Model': '""',
    'Sec-Ch-Viewport-Width': '1920',
    'Sec-Ch-Viewport-Height': '1080',
    'Sec-Ch-Device-Memory': '8',
    'Sec-Ch-Dpr': '1',
    'DNT': '1',
    'Pragma': 'no-cache'
};

// Function to generate anti-bot detection headers for high-security sites
function getAntiDetectionHeaders() {
    return {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9,hi;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'max-age=0',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Sec-Ch-Ua': '"Google Chrome";v="123", "Not:A-Brand";v="8", "Chromium";v="123"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Ch-Ua-Platform-Version': '"15.0.0"',
        'Sec-Ch-Prefers-Color-Scheme': 'light',
        'Sec-Ch-Prefers-Reduced-Motion': 'no-preference',
        'Sec-Ch-Viewport-Width': '1920',
        'Sec-Ch-Device-Memory': '8',
        'DNT': '1',
        'Referer': 'https://www.google.com/',
        'X-Forwarded-For': generateRandomIP(),
        'X-Real-IP': generateRandomIP(),
        'CF-Connecting-IP': generateRandomIP(),
        'X-Client-IP': generateRandomIP(),
        'Forwarded': `for=${generateRandomIP()}`,
        'Via': '1.1 google',
        'X-Amzn-Trace-Id': `Root=1-${Date.now().toString(16)}-${Math.random().toString(16).substr(2)}`,
        'CloudFront-Forwarded-Proto': 'https',
        'CloudFront-Is-Desktop-Viewer': 'true',
        'CloudFront-Is-Mobile-Viewer': 'false',
        'CloudFront-Is-SmartTV-Viewer': 'false',
        'CloudFront-Is-Tablet-Viewer': 'false',
        'CloudFront-Viewer-Country': 'US',
        'CloudFront-Viewer-Country-Name': 'United States',
        'CloudFront-Viewer-Country-Region': 'CA',
        'CloudFront-Viewer-Country-Region-Name': 'California'
    };
}

// Function to generate random IP addresses
function generateRandomIP() {
    return `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
}

// Function to get appropriate headers based on URL
function getHeadersForUrl(url) {
    const domain = new URL(url).hostname.toLowerCase();
    
    // High-security government or sensitive sites
    if (domain.includes('narendramodi') || domain.includes('gov.') || domain.includes('pmo.') || 
        domain.includes('nic.') || domain.includes('bharatgov') || domain.includes('india.gov')) {
        return getAntiDetectionHeaders();
    }
    
    // Default enhanced headers for most sites
    return enhancedStealthHeaders;
}

// Random delay function to simulate human behavior
function getRandomDelay(min = 1000, max = 5000) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Combine all headers into a single object
const stealthHeaders = {
    ...commonHeaders,
    ...modernBrowserHeaders
};

// Export headers for different use cases
module.exports = {
    stealthHeaders,           // Default headers for general crawling
    enhancedStealthHeaders,   // Enhanced headers for better bot detection evasion
    getAntiDetectionHeaders,  // Function to get maximum stealth headers for high-security sites
    commonHeaders,            // Basic headers
    modernBrowserHeaders,     // Modern browser specific headers
    mobileHeaders,            // Mobile device headers
    apiHeaders,               // API specific headers
    getHeadersForUrl,         // Function to get appropriate headers
    generateRandomIP,         // Function to generate random IP
    getRandomDelay           // Function to get random delay
}; 