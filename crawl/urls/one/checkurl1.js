const fs = require('fs');
const https = require('https');
const http = require('http');
const dns = require('dns');
const readline = require('readline');
const { promisify } = require('util');
const dnsLookup = promisify(dns.lookup);



// Custom User-Agent to mimic a browser request
const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.121 Safari/537.36';
const MAX_CONCURRENT_REQUESTS = 5;


// Utility function to check if a URL is live
function checkUrl(url, retries = 2, delay = 1000) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        const options = {
            headers: {
                'User-Agent': userAgent
            },
            timeout: 5000 // Set timeout to 5 seconds
        };

        const request = protocol.get(url, options, (res) => {
            // Handle redirects (status code 3xx)
            if (res.statusCode >= 200 && res.statusCode < 400) {
                console.log(`Active: ${url}`);
                resolve({ url, status: 'active' });
            } else if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                console.log(`Redirected: ${url}`);
                checkUrl(res.headers.location, retries).then(resolve).catch(reject);
            } else {
                console.log(`Inactive (HTTP error): ${url} - Status code: ${res.statusCode}`);
                resolve({ url, status: 'inactive' });
            }
        });

        request.on('error', (err) => {
            if (retries > 0) {
                setTimeout(() => {
                    checkUrl(url, retries - 1, delay * 2).then(resolve).catch(reject);
                }, delay);
            } else {
                console.log(`Inactive (Failed after retries): ${url} - Error: ${err.message}`);
                resolve({ url, status: 'inactive' });
            }
        });

        request.on('timeout', () => {
            console.log(`Inactive (Timeout): ${url}`);
            request.abort();
            resolve({ url, status: 'inactive' });
        });
    });
}

// Function to validate the domain using DNS lookup
function validateDomain(domain) {
    return new Promise((resolve, reject) => {
        dns.lookup(domain, (err) => {
            if (err) {
                console.log(`Invalid domain: ${domain}`);
                resolve(false); // Domain does not exist
            } else {
                resolve(true); // Domain exists
            }
        });
    });
}

// Append to files immediately
function appendToFile(filename, data) {
    fs.appendFileSync(filename, data + '\n', 'utf-8');
}

// Function to process URLs from domain1.txt and categorize them
async function processUrls() {
    const fileStream = fs.createReadStream('domain1.txt');
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    // Asynchronously process each URL
    for await (let url of rl) {
        url = url.trim();

        // Add https:// if not present
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = `https://${url}`;
        }

        // Extract domain for DNS check
        const domainMatch = url.match(/^(?:https?:\/\/)?(?:www\.)?([^\/]+)/);
        const domain = domainMatch ? domainMatch[1] : null;

        if (domain && await validateDomain(domain)) {
            const result = await checkUrl(url);
            if (result.status === 'active') {
                appendToFile('activeurls1.csv', url);
            } else {
                appendToFile('inactive1.txt', url);
            }
        } else {
            appendToFile('inactive1.txt', url);
        }
    }

    console.log('Processing completed.');
    process.exit(0);  // Ensure process closes after completion
}

processUrls().catch(console.error);
