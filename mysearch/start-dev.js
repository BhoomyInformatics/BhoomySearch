#!/usr/bin/env node

/**
 * Development startup script for Bhoomy Search Engine
 * Handles graceful startup when Elasticsearch and MySQL may not be available
 */

require('dotenv').config();
const { spawn } = require('child_process');
const { Client } = require('@elastic/elasticsearch');
const mysql = require('./mysql');

console.log('🚀 Bhoomy Search Engine - Development Setup');
console.log('==========================================');

// Check service availability
async function checkServices() {
    const services = {
        elasticsearch: false,
        mysql: false
    };

    // Check Elasticsearch
    try {
        const client = new Client({
            node: process.env.ELASTICSEARCH_URL || 'https://localhost:9200',
    auth: {
        username: process.env.ELASTICSEARCH_USERNAME || 'elastic',
        password: process.env.ELASTICSEARCH_PASSWORD || 'MtuWUQonC5bUkcGyfPwh'
    },
    tls: {
        rejectUnauthorized: false
    },
            requestTimeout: 5000,
            pingTimeout: 3000
        });
        await client.ping();
        services.elasticsearch = true;
        console.log('✅ Elasticsearch is available');
    } catch (error) {
        console.log('⚠️  Elasticsearch is not available - will use fallback data');
    }

    // Check MySQL
    try {
        await mysql.ping();
        services.mysql = true;
        console.log('✅ MySQL is available');
    } catch (error) {
        console.log('⚠️  MySQL is not available - will use fallback data');
    }

    return services;
}

async function startDevelopment() {
    console.log('\n📋 Checking service availability...');
    
    const services = await checkServices();
    
    console.log('\n🔧 Starting development servers...');
    
    if (!services.elasticsearch && !services.mysql) {
        console.log('\n⚠️  Warning: Both Elasticsearch and MySQL are unavailable.');
        console.log('The application will run with mock data only.');
        console.log('\nTo set up the full environment:');
        console.log('1. Install and start Elasticsearch on port 9200');
        console.log('2. Install and start MySQL on port 3306');
        console.log('3. Update the .env file with your database credentials');
    }

    // Build frontend first
    console.log('\n🏗️  Building frontend...');
    const buildProcess = spawn('npm', ['run', 'frontend:build'], {
        stdio: 'inherit',
        shell: true
    });

    buildProcess.on('close', (code) => {
        if (code === 0) {
            console.log('\n✅ Frontend build completed');
            console.log('\n🚀 Starting backend server...');
            
            // Start the backend server
            const serverProcess = spawn('npm', ['run', 'dev'], {
                stdio: 'inherit',
                shell: true
            });

            console.log('\n📱 Application URLs:');
            console.log('   Main App: http://localhost:3000');
            console.log('   Health Check: http://localhost:3000/api/health');
            console.log('   Search API: http://localhost:3000/api/search');
            console.log('\n📝 Notes:');
            console.log('   - Press Ctrl+C to stop the server');
            console.log('   - Changes to backend files will auto-restart the server');
            console.log('   - For frontend development, use: npm run dev:full');
            
            process.on('SIGINT', () => {
                console.log('\n\n👋 Shutting down gracefully...');
                serverProcess.kill('SIGINT');
                process.exit(0);
            });
            
        } else {
            console.error('❌ Frontend build failed');
            process.exit(1);
        }
    });
}

// Handle startup
startDevelopment().catch(error => {
    console.error('❌ Startup failed:', error.message);
    process.exit(1);
}); 