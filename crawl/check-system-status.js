#!/usr/bin/env node

/**
 * High-Capacity Server System Status Checker
 * Verifies that crawler optimizations are properly configured
 */

const os = require('os');
const { crawlerConfig } = require('./config/crawlerConfig');

console.log('🔍 HIGH-CAPACITY SERVER STATUS CHECK');
console.log('=====================================');

// System Information
const totalMemoryGB = Math.round(os.totalmem() / 1024 / 1024 / 1024);
const freeMemoryGB = Math.round(os.freemem() / 1024 / 1024 / 1024);
const cpuCores = os.cpus().length;
const platform = os.platform();
const arch = os.arch();

console.log('\n📊 Server Hardware:');
console.log(`   Platform: ${platform} (${arch})`);
console.log(`   Total Memory: ${totalMemoryGB}GB`);
console.log(`   Free Memory: ${freeMemoryGB}GB (${Math.round((freeMemoryGB/totalMemoryGB)*100)}% free)`);
console.log(`   CPU Cores: ${cpuCores}`);

// Server Category Detection
let serverCategory = 'UNKNOWN';
if (totalMemoryGB >= 120 && cpuCores >= 24) {
    serverCategory = '🔥 MONSTER SERVER (Optimal for massive-scale crawling)';
} else if (totalMemoryGB >= 64 && cpuCores >= 16) {
    serverCategory = '🚀 HIGH-CAPACITY (Excellent for large-scale crawling)';
} else if (totalMemoryGB >= 32 && cpuCores >= 8) {
    serverCategory = '⚡ MEDIUM-CAPACITY (Very good for crawling)';
} else if (totalMemoryGB >= 16 && cpuCores >= 4) {
    serverCategory = '📈 STANDARD (Good for moderate crawling)';
} else {
    serverCategory = '💻 BASIC (Limited crawling capacity)';
}

console.log(`   Server Category: ${serverCategory}`);

// Environment Detection
console.log('\n🌍 Environment Configuration:');
console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'NOT SET'}`);
console.log(`   OPTIMIZE_FOR_CAPACITY: ${process.env.OPTIMIZE_FOR_CAPACITY || 'NOT SET'}`);

// Crawler Configuration Status
console.log('\n⚙️ Crawler Configuration:');
console.log(`   Max Global Connections: ${crawlerConfig.maxGlobalConnections}`);
console.log(`   Max Connections Per Domain: ${crawlerConfig.maxConnectionsPerDomain}`);
console.log(`   Max Concurrent Requests: ${crawlerConfig.maxConcurrentRequests}`);
console.log(`   Concurrent Limit: ${crawlerConfig.concurrentLimit}`);
console.log(`   Batch Size: ${crawlerConfig.batchSize}`);
console.log(`   Queue Size: ${crawlerConfig.maxQueueSize}`);
console.log(`   Min Delay: ${crawlerConfig.minDelay}ms`);
console.log(`   Max Delay: ${crawlerConfig.maxDelay}ms`);

// Performance Analysis
console.log('\n📈 Performance Analysis:');

const connectionEfficiency = (crawlerConfig.maxGlobalConnections / totalMemoryGB).toFixed(2);
const coreUtilization = (crawlerConfig.maxConcurrentRequests / cpuCores).toFixed(2);

console.log(`   Connections per GB RAM: ${connectionEfficiency}`);
console.log(`   Concurrent requests per CPU core: ${coreUtilization}`);

// Recommendations
console.log('\n💡 Status & Recommendations:');

if (totalMemoryGB >= 120 && cpuCores >= 24) {
    if (crawlerConfig.maxGlobalConnections >= 500) {
        console.log('   ✅ EXCELLENT: Monster server optimizations properly configured');
        console.log('   ✅ Your beast of a server resources will be well-utilized');
        console.log(`   🔥 With ${cpuCores} cores and ${totalMemoryGB}GB RAM, you can handle massive crawling loads!`);
    } else if (crawlerConfig.maxGlobalConnections >= 300) {
        console.log('   ⚠️  GOOD: Decent optimization, but you can push this monster server much harder');
        console.log('   💡 Consider running: npm run high-performance');
        console.log(`   🚀 Your ${cpuCores}-core monster can handle 500-800 connections easily!`);
    } else {
        console.log('   ❌ SEVERE UNDER-UTILIZATION: Your monster server is being wasted!');
        console.log('   🚨 Run: NODE_ENV=production npm start or npm run high-performance');
        console.log(`   💰 You're only using a fraction of your ${totalMemoryGB}GB/${cpuCores}-core capacity!`);
    }
} else if (totalMemoryGB >= 64 && cpuCores >= 24) {
    if (crawlerConfig.maxGlobalConnections >= 300) {
        console.log('   ✅ EXCELLENT: High-end server optimizations properly configured');
        console.log('   ✅ Server resources will be well-utilized');
    } else if (crawlerConfig.maxGlobalConnections >= 200) {
        console.log('   ⚠️  GOOD: Decent optimization, but could be higher for your server');
        console.log('   💡 Consider running: npm run high-performance');
    } else {
        console.log('   ❌ POOR: Severe under-utilization of your high-end server');
        console.log('   🚨 Run: NODE_ENV=production npm start');
    }
} else if (totalMemoryGB >= 32) {
    if (crawlerConfig.maxGlobalConnections >= 150) {
        console.log('   ✅ GOOD: Configuration appropriate for your server capacity');
    } else {
        console.log('   ⚠️  MODERATE: Could be optimized further for your hardware');
    }
} else {
    if (crawlerConfig.maxGlobalConnections <= 100) {
        console.log('   ✅ APPROPRIATE: Conservative settings suitable for your hardware');
    } else {
        console.log('   ⚠️  Consider reducing limits for stability on this hardware');
    }
}

// Connection Health Check for monster servers
const maxRecommended = Math.floor(totalMemoryGB * (totalMemoryGB >= 100 ? 6 : 3)); // Higher ratio for monster servers
if (crawlerConfig.maxGlobalConnections > maxRecommended) {
    console.log(`   ⚠️  Warning: Connection limit (${crawlerConfig.maxGlobalConnections}) exceeds recommended maximum (${maxRecommended})`);
} else if (totalMemoryGB >= 120 && crawlerConfig.maxGlobalConnections < Math.floor(totalMemoryGB * 3)) {
    console.log(`   💡 Tip: Your monster server could easily handle ${Math.floor(totalMemoryGB * 4)}-${Math.floor(totalMemoryGB * 6)} connections`);
}

// System Load Check
const memoryUsagePercent = ((totalMemoryGB - freeMemoryGB) / totalMemoryGB) * 100;
console.log('\n🔄 Current System Load:');
console.log(`   Memory Usage: ${memoryUsagePercent.toFixed(1)}%`);

if (memoryUsagePercent > 90) {
    console.log('   🚨 HIGH MEMORY USAGE - Consider monitoring crawler performance');
} else if (memoryUsagePercent > 70) {
    console.log('   ⚠️  Moderate memory usage - Normal for active crawling');
} else {
    console.log('   ✅ Memory usage is healthy');
}

console.log('\n🚀 To start crawler with optimized settings:');
console.log('   For maximum performance: npm run high-performance');
console.log('   For production mode: npm run production');
console.log('   For development: npm run dev');

console.log('\n=====================================');
console.log('Status check completed! 🎯'); 