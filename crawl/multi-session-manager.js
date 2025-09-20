#!/usr/bin/env node

/**
 * Multi-Session Crawler Manager
 * Coordinates multiple crawler sessions for optimal performance
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class MultiSessionManager {
    constructor() {
        this.sessions = [
            { name: 'bhoomy_com', script: 'bhoomy_com.js', description: '.com domains' },
            { name: 'bhoomy_in', script: 'bhoomy_in.js', description: '.in domains' },
            { name: 'bhoomy_org', script: 'bhoomy_org.js', description: '.org domains' },
            { name: 'bhoomy_store', script: 'bhoomy_store.js', description: 'E-commerce sites' },
            { name: 'news_site', script: 'news_site.js', description: 'News websites' },
            { name: 'specialsite', script: 'specialsite.js', description: 'Special websites' },
            // Note: bhoomy_all.js intentionally excluded to avoid conflicts
        ];
        
        this.processes = new Map();
        this.logDir = './logs/sessions';
        this.pidFile = './temp/session-manager.pid';
    }

    async initialize() {
        console.log('🚀 Multi-Session Crawler Manager');
        console.log('================================');
        
        // Create necessary directories
        this.ensureDirectories();
        
        // Save manager PID
        fs.writeFileSync(this.pidFile, process.pid.toString());
        
        // Setup graceful shutdown
        this.setupGracefulShutdown();
        
        console.log(`📊 Planning to start ${this.sessions.length} crawler sessions:`);
        this.sessions.forEach((session, index) => {
            console.log(`   ${index + 1}. ${session.name} - ${session.description}`);
        });
        
        console.log('\\n⚠️  IMPORTANT: Each session will use:');
        console.log('   • ~85 network connections');
        console.log('   • ~28 concurrent requests');
        console.log('   • ~7 database connections');
        console.log('   • 3 connections per domain max');
    }

    ensureDirectories() {
        if (!fs.existsSync('./logs')) {
            fs.mkdirSync('./logs');
        }
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
        if (!fs.existsSync('./temp')) {
            fs.mkdirSync('./temp');
        }
    }

    async startSession(session, index) {
        return new Promise((resolve, reject) => {
            console.log(`\\n🔄 Starting session: ${session.name}`);
            
            const env = {
                ...process.env,
                MULTI_SESSION_ENABLED: 'true',
                EXPECTED_SESSIONS: this.sessions.length.toString(),
                SESSION_ID: session.name,
                SESSION_INDEX: index.toString(),
                
                // Session-specific database limits
                DB_CONNECTION_LIMIT: '50',  // Shared pool
                
                // Distributed crawler limits
                CRAWLER_MAX_GLOBAL_CONNECTIONS: '85',
                CRAWLER_MAX_CONNECTIONS_PER_DOMAIN: '3',
                CRAWLER_MAX_CONCURRENCY: '28',
                CRAWLER_BATCH_SIZE: '14',
                CRAWLER_QUEUE_SIZE: '714',
                
                // Logging
                CRAWLER_LOG_LEVEL: 'info'
            };
            
            const logFile = path.join(this.logDir, `${session.name}.log`);
            const errorFile = path.join(this.logDir, `${session.name}.error.log`);
            
            const child = spawn('node', [session.script], {
                env,
                stdio: ['ignore', 'pipe', 'pipe'],
                detached: false
            });
            
            // Setup logging
            const logStream = fs.createWriteStream(logFile, { flags: 'a' });
            const errorStream = fs.createWriteStream(errorFile, { flags: 'a' });
            
            child.stdout.pipe(logStream);
            child.stderr.pipe(errorStream);
            
            // Also pipe to console with session prefix
            child.stdout.on('data', (data) => {
                console.log(`[${session.name}] ${data.toString().trim()}`);
            });
            
            child.stderr.on('data', (data) => {
                console.error(`[${session.name}] ERROR: ${data.toString().trim()}`);
            });
            
            child.on('exit', (code, signal) => {
                console.log(`\\n⚠️  Session ${session.name} exited (code: ${code}, signal: ${signal})`);
                this.processes.delete(session.name);
                
                // Auto-restart on unexpected exit
                if (code !== 0 && !signal) {
                    console.log(`🔄 Auto-restarting ${session.name} in 10 seconds...`);
                    setTimeout(() => {
                        this.startSession(session, index);
                    }, 10000);
                }
            });
            
            child.on('error', (error) => {
                console.error(`❌ Failed to start ${session.name}:`, error);
                reject(error);
            });
            
            this.processes.set(session.name, child);
            console.log(`✅ Started ${session.name} (PID: ${child.pid})`);
            resolve(child);
        });
    }

    async startAllSessions() {
        console.log('\\n🚀 Starting all crawler sessions...');
        
        // Start sessions with staggered delays to prevent startup conflicts
        for (let i = 0; i < this.sessions.length; i++) {
            const session = this.sessions[i];
            
            try {
                await this.startSession(session, i);
                
                // Wait 5 seconds between starting each session
                if (i < this.sessions.length - 1) {
                    console.log('   ⏱️  Waiting 5 seconds before starting next session...');
                    await this.delay(5000);
                }
            } catch (error) {
                console.error(`❌ Failed to start ${session.name}:`, error);
            }
        }
        
        console.log('\\n🎉 All sessions started successfully!');
        this.displayStatus();
    }

    displayStatus() {
        console.log('\\n📊 Session Status:');
        console.log('===================');
        
        this.processes.forEach((process, name) => {
            const session = this.sessions.find(s => s.name === name);
            console.log(`✅ ${name} (PID: ${process.pid}) - ${session.description}`);
        });
        
        console.log(`\\n📈 Total active sessions: ${this.processes.size}`);
        console.log('📝 Logs available in: ./logs/sessions/');
        console.log('\\n💡 Commands:');
        console.log('   • View logs: tail -f logs/sessions/{session_name}.log');
        console.log('   • Stop all: kill -TERM ' + process.pid);
        console.log('   • Monitor system: node check-system-status.js');
    }

    async stopAllSessions() {
        console.log('\\n🛑 Stopping all crawler sessions...');
        
        const stopPromises = [];
        this.processes.forEach((process, name) => {
            console.log(`   Stopping ${name}...`);
            process.kill('SIGTERM');
            
            stopPromises.push(new Promise((resolve) => {
                process.on('exit', () => {
                    console.log(`   ✅ ${name} stopped`);
                    resolve();
                });
                
                // Force kill after 30 seconds
                setTimeout(() => {
                    if (!process.killed) {
                        console.log(`   ⚠️  Force killing ${name}...`);
                        process.kill('SIGKILL');
                    }
                    resolve();
                }, 30000);
            }));
        });
        
        await Promise.all(stopPromises);
        console.log('✅ All sessions stopped');
        
        // Cleanup PID file
        if (fs.existsSync(this.pidFile)) {
            fs.unlinkSync(this.pidFile);
        }
    }

    setupGracefulShutdown() {
        const handleShutdown = async (signal) => {
            console.log(`\\n📡 Received ${signal}. Gracefully shutting down...`);
            await this.stopAllSessions();
            process.exit(0);
        };
        
        process.on('SIGINT', handleShutdown);
        process.on('SIGTERM', handleShutdown);
        process.on('SIGQUIT', handleShutdown);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// CLI Interface
async function main() {
    const manager = new MultiSessionManager();
    
    const command = process.argv[2] || 'start';
    
    switch (command) {
        case 'start':
            await manager.initialize();
            await manager.startAllSessions();
            
            // Keep the manager running
            console.log('\\n🔄 Manager running. Press Ctrl+C to stop all sessions.');
            break;
            
        case 'status':
            // Show status of running sessions
            console.log('📊 Session Status (not implemented yet)');
            break;
            
        case 'stop':
            // Stop all running sessions
            console.log('🛑 Stopping all sessions (not implemented yet)');
            break;
            
        default:
            console.log('Usage: node multi-session-manager.js [start|status|stop]');
            process.exit(1);
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = MultiSessionManager; 