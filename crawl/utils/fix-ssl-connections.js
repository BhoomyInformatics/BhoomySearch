#!/usr/bin/env node

/**
 * SSL and Connection Fix Script for Search Engine Crawler
 * Fixes self-signed certificate issues and connection pool problems
 */

const os = require('os');
const process = require('process');

// Fix SSL certificate issues globally
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Increase Node.js connection limits
require('http').globalAgent.maxSockets = 15;
require('https').globalAgent.maxSockets = 15;

// Set keepAlive for better connection reuse
require('http').globalAgent.keepAlive = true;
require('https').globalAgent.keepAlive = true;
require('http').globalAgent.keepAliveMsecs = 30000;
require('https').globalAgent.keepAliveMsecs = 30000;

// Increase max listeners to prevent warnings
require('events').EventEmitter.defaultMaxListeners = 50;

console.log('🔧 Applied SSL and Connection Fixes:');
console.log('   ✅ Disabled SSL certificate verification (NODE_TLS_REJECT_UNAUTHORIZED=0)');
console.log('   ✅ Set HTTP/HTTPS max sockets to 15');
console.log('   ✅ Enabled keep-alive connections (30s)');
console.log('   ✅ Increased max event listeners to 20');
console.log('   ✅ Platform:', os.platform());
console.log('   ✅ Node.js version:', process.version);

// Monitor connection usage
let connectionWarningShown = false;

const originalCreateConnection = require('net').createConnection;
require('net').createConnection = function(...args) {
    const socket = originalCreateConnection.apply(this, args);
    
    // Monitor connection count
    const httpAgent = require('http').globalAgent;
    const httpsAgent = require('https').globalAgent;
    
    const httpSockets = Object.keys(httpAgent.sockets).length;
    const httpsSockets = Object.keys(httpsAgent.sockets).length;
    const totalSockets = httpSockets + httpsSockets;
    
    if (totalSockets > 12 && !connectionWarningShown) {
        console.log(`⚠️  High socket usage detected: ${totalSockets} active connections`);
        connectionWarningShown = true;
        
        // Reset warning after 30 seconds
        setTimeout(() => {
            connectionWarningShown = false;
        }, 30000);
    }
    
    return socket;
};

// Export configuration
module.exports = {
    sslFixed: true,
    maxConnections: 20,
    keepAlive: true,
    platform: os.platform(),
    nodeVersion: process.version
};

console.log('🚀 SSL and Connection fixes applied successfully'); 