// network-check.js - Utility to test network connectivity

const http = require('http');
const https = require('https');
const dns = require('dns');

// Function to log with timestamp
function log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    console.log(`${timestamp} - ${level}: ${message}`);
}

// Test DNS resolution for a domain
function testDns(domain) {
    return new Promise((resolve) => {
        const startTime = Date.now();
        dns.lookup(domain, (err, address) => {
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            if (err) {
                log(`DNS lookup failed for ${domain}: ${err.message}`, 'ERROR');
                resolve({
                    success: false,
                    duration,
                    error: err.message
                });
            } else {
                log(`DNS lookup succeeded for ${domain}: ${address} (${duration}ms)`);
                resolve({
                    success: true,
                    duration,
                    address
                });
            }
        });
    });
}

// Test HTTP connectivity to a URL
function testHttp(url, useProxy = false, timeout = 10000) {
    return new Promise((resolve) => {
        const startTime = Date.now();
        const options = {
            timeout,
            headers: {
                'User-Agent': 'Mozilla/5.0 NetworkCheck/1.0'
            }
        };
        
        // Add proxy if needed
        if (useProxy) {
            options.host = 'localhost';
            options.port = 3128;
            options.path = url;
            options.headers.Host = new URL(url).hostname;
        }
        
        const client = url.startsWith('https:') ? https : http;
        const req = client.get(useProxy ? options : url, options, (res) => {
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            log(`HTTP ${res.statusCode} from ${url} (${duration}ms)`);
            resolve({
                success: res.statusCode >= 200 && res.statusCode < 400,
                statusCode: res.statusCode,
                duration,
                headers: res.headers
            });
            
            // Consume response data to free up memory
            res.resume();
        });
        
        req.on('error', (err) => {
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            log(`HTTP request failed for ${url}: ${err.message}`, 'ERROR');
            resolve({
                success: false,
                duration,
                error: err.message
            });
        });
        
        req.on('timeout', () => {
            req.destroy();
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            log(`HTTP request timed out for ${url} (${duration}ms)`, 'ERROR');
            resolve({
                success: false,
                duration,
                error: 'timeout'
            });
        });
    });
}

// Test proxy connectivity
async function testProxy(proxyUrl = 'http://localhost:3128', timeout = 5000) {
    try {
        const testUrl = 'http://www.google.com';
        log(`Testing proxy at ${proxyUrl} with ${testUrl}`);
        
        const result = await testHttp(testUrl, true, timeout);
        
        if (result.success) {
            log(`Proxy test successful (${result.duration}ms)`);
            return {
                success: true,
                duration: result.duration
            };
        } else {
            log(`Proxy test failed: ${result.error || result.statusCode}`, 'ERROR');
            return {
                success: false,
                error: result.error || `Status code: ${result.statusCode}`
            };
        }
    } catch (error) {
        log(`Proxy test error: ${error.message}`, 'ERROR');
        return {
            success: false,
            error: error.message
        };
    }
}

// Comprehensive network check
async function runNetworkCheck() {
    log('Starting network connectivity tests...');
    
    // Test sites to check
    const testSites = [
        'google.com',
        'example.com',
        'indianexpress.com',
        'timesofindia.indiatimes.com'
    ];
    
    // DNS tests
    log('Testing DNS resolution...');
    const dnsResults = {};
    for (const site of testSites) {
        dnsResults[site] = await testDns(site);
    }
    
    // HTTP direct tests
    log('Testing direct HTTP connectivity...');
    const httpResults = {};
    for (const site of testSites) {
        httpResults[site] = await testHttp(`http://${site}`);
    }
    
    // Proxy test
    log('Testing proxy connectivity...');
    const proxyResult = await testProxy();
    
    // HTTP via proxy tests
    log('Testing HTTP connectivity via proxy...');
    const httpProxyResults = {};
    if (proxyResult.success) {
        for (const site of testSites) {
            httpProxyResults[site] = await testHttp(`http://${site}`, true);
        }
    }
    
    return {
        timestamp: new Date().toISOString(),
        dns: dnsResults,
        http: httpResults,
        proxy: proxyResult,
        httpViaProxy: httpProxyResults
    };
}

// Export functions for use in other modules
module.exports = {
    testDns,
    testHttp,
    testProxy,
    runNetworkCheck
};

// Run the test if this script is executed directly
if (require.main === module) {
    runNetworkCheck()
        .then(results => {
            console.log(JSON.stringify(results, null, 2));
        })
        .catch(error => {
            console.error('Error running network check:', error);
        });
} 