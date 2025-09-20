#!/usr/bin/env node

const mysql = require('mysql2/promise');
const { Client } = require('@elastic/elasticsearch');
const fs = require('fs');
const path = require('path');
const http = require('http');
require('dotenv').config();

// Configuration
const config = {
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'mybhoomy_admin',
    password: process.env.DB_PASSWORD || 'mhQjj.%C-_LO_U4',
    database: process.env.DB_NAME || 'mybhoomy_mysearch'
  },
  elasticsearch: {
    node: process.env.ELASTICSEARCH_URL || 'https://localhost:9200',
    auth: {
        username: process.env.ELASTICSEARCH_USERNAME || 'elastic',
        password: process.env.ELASTICSEARCH_PASSWORD || 'bEvADDXp47tbSH32mPwB
    },
    tls: {
        rejectUnauthorized: false
    },
    requestTimeout: 30000,
    pingTimeout: 3000
  },
  server: {
    port: process.env.PORT || 8181,
    host: process.env.HOST || 'localhost'
  }
};

class SearchHealthChecker {
  constructor() {
    this.results = {
      overall: 'unknown',
      timestamp: new Date().toISOString(),
      checks: {}
    };
  }

  async checkDatabase() {
    try {
      console.log('🔍 Checking database connection...');
      
      const connection = await mysql.createConnection(config.database);
      
      // Test basic connection
      await connection.execute('SELECT 1 as test');
      
      // Check if required tables exist
      const [tables] = await connection.execute(`
        SELECT TABLE_NAME 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME IN ('sites', 'links', 'content', 'search_logs')
      `, [config.database.database]);
      
      const expectedTables = ['sites', 'links', 'content'];
      const existingTables = tables.map(row => row.TABLE_NAME);
      const missingTables = expectedTables.filter(table => !existingTables.includes(table));
      
      // Test data access
      const [siteCount] = await connection.execute('SELECT COUNT(*) as count FROM sites LIMIT 1');
      const [contentCount] = await connection.execute('SELECT COUNT(*) as count FROM content LIMIT 1');
      
      await connection.end();
      
      if (missingTables.length > 0) {
        this.results.checks.database = {
          status: 'error',
          message: `Database connected but missing required tables: ${missingTables.join(', ')}`,
          details: { missingTables, existingTables }
        };
        console.log('❌ Database: ERROR - Missing required tables');
      } else {
        this.results.checks.database = {
          status: 'healthy',
          message: 'Database connection successful, all required tables found',
          details: { 
            existingTables,
            siteCount: siteCount[0].count,
            contentCount: contentCount[0].count
          }
        };
        console.log('✅ Database: HEALTHY');
      }
    } catch (error) {
      this.results.checks.database = {
        status: 'error',
        message: `Database connection failed: ${error.message}`,
        details: { error: error.code || error.message }
      };
      console.log('❌ Database: ERROR -', error.message);
    }
  }

  async checkElasticsearch() {
    try {
      console.log('🔍 Checking Elasticsearch connection...');
      
      const client = new Client(config.elasticsearch);
      
      // Check cluster health
      const health = await client.cluster.health();
      
      // Check if index exists and get document count
      const indexName = process.env.ELASTICSEARCH_INDEX || 'bhoomy_search';
      const indexExists = await client.indices.exists({ index: indexName });
      
      let docCount = 0;
      if (indexExists) {
        const stats = await client.indices.stats({ index: indexName });
        docCount = stats.indices[indexName]?.total?.docs?.count || 0;
      }
      
      await client.close();
      
      this.results.checks.elasticsearch = {
        status: health.status === 'red' ? 'error' : (indexExists ? 'healthy' : 'warning'),
        message: `Elasticsearch cluster status: ${health.status}${indexExists ? `, ${docCount} documents indexed` : ', search index not found'}`,
        details: { 
          clusterStatus: health.status,
          indexExists: indexExists,
          indexName: indexName,
          documentCount: docCount
        }
      };
      
      if (health.status === 'red') {
        console.log('❌ Elasticsearch: ERROR - Cluster status is red');
      } else if (!indexExists) {
        console.log('⚠️  Elasticsearch: WARNING - Search index not found');
      } else {
        console.log('✅ Elasticsearch: HEALTHY');
      }
    } catch (error) {
      this.results.checks.elasticsearch = {
        status: 'error',
        message: `Elasticsearch connection failed: ${error.message}`,
        details: { error: error.message }
      };
      console.log('❌ Elasticsearch: ERROR -', error.message);
    }
  }

  async checkFrontend() {
    try {
      console.log('🔍 Checking frontend build...');
      
      const frontendPath = path.join(__dirname, '..', 'frontend');
      const distPath = path.join(frontendPath, 'dist');
      const buildPath = path.join(frontendPath, 'build');
      const publicPath = path.join(__dirname, '..', 'public');
      
      const checkResults = {};
      
      // Check if frontend directory exists
      try {
        await fs.promises.access(frontendPath);
        checkResults.frontendDir = 'exists';
      } catch {
        checkResults.frontendDir = 'missing';
      }
      
      // Check for built assets
      const buildPaths = [distPath, buildPath, publicPath];
      for (const buildPath of buildPaths) {
        const pathName = path.basename(buildPath);
        try {
          await fs.promises.access(buildPath);
          const files = await fs.promises.readdir(buildPath);
          checkResults[pathName] = files.length > 0 ? 'built' : 'empty';
        } catch {
          checkResults[pathName] = 'missing';
        }
      }
      
      // Check package.json for frontend
      try {
        const packagePath = path.join(frontendPath, 'package.json');
        await fs.promises.access(packagePath);
        checkResults.frontendPackage = 'exists';
      } catch {
        checkResults.frontendPackage = 'missing';
      }
      
      const hasBuiltAssets = Object.values(checkResults).includes('built');
      
      if (checkResults.frontendDir === 'missing') {
        this.results.checks.frontend = {
          status: 'warning',
          message: 'Frontend directory not found, using server-side rendering only',
          details: checkResults
        };
        console.log('⚠️  Frontend: WARNING - No frontend directory found');
      } else if (!hasBuiltAssets && checkResults.frontendPackage === 'exists') {
        this.results.checks.frontend = {
          status: 'warning',
          message: 'Frontend directory exists but no built assets found. Run npm run build.',
          details: checkResults
        };
        console.log('⚠️  Frontend: WARNING - No built assets found');
      } else {
        this.results.checks.frontend = {
          status: 'healthy',
          message: hasBuiltAssets ? 'Frontend assets are built and ready' : 'Server-side rendering ready',
          details: checkResults
        };
        console.log('✅ Frontend: HEALTHY');
      }
    } catch (error) {
      this.results.checks.frontend = {
        status: 'error',
        message: `Frontend check failed: ${error.message}`,
        details: { error: error.message }
      };
      console.log('❌ Frontend: ERROR -', error.message);
    }
  }

  async checkDependencies() {
    try {
      console.log('🔍 Checking critical dependencies...');
      
      const criticalDeps = ['mysql2', '@elastic/elasticsearch', 'express'];
      const depResults = {};
      
      for (const dep of criticalDeps) {
        try {
          require.resolve(dep);
          depResults[dep] = 'available';
        } catch (error) {
          depResults[dep] = 'missing';
        }
      }
      
      const missingDeps = Object.entries(depResults)
        .filter(([dep, status]) => status === 'missing')
        .map(([dep]) => dep);
      
      if (missingDeps.length > 0) {
        this.results.checks.dependencies = {
          status: 'error',
          message: `Missing critical dependencies: ${missingDeps.join(', ')}`,
          details: depResults
        };
        console.log('❌ Dependencies: ERROR - Missing critical modules');
      } else {
        this.results.checks.dependencies = {
          status: 'healthy',
          message: 'All critical dependencies are available',
          details: depResults
        };
        console.log('✅ Dependencies: HEALTHY');
      }
    } catch (error) {
      this.results.checks.dependencies = {
        status: 'error',
        message: `Dependency check failed: ${error.message}`,
        details: { error: error.message }
      };
      console.log('❌ Dependencies: ERROR -', error.message);
    }
  }

  async checkServerPorts() {
    try {
      console.log('🔍 Checking server configuration...');
      
      const checkPort = (port) => {
        return new Promise((resolve) => {
          const server = http.createServer();
          server.listen(port, 'localhost', () => {
            server.close(() => resolve({ port, status: 'available' }));
          });
          server.on('error', () => resolve({ port, status: 'in_use' }));
        });
      };
      
      const portCheck = await checkPort(config.server.port);
      
      this.results.checks.serverPorts = {
        status: 'healthy',
        message: `Server port ${config.server.port} is ${portCheck.status}`,
        details: { 
          configuredPort: config.server.port,
          portStatus: portCheck.status
        }
      };
      
      if (portCheck.status === 'in_use') {
        console.log(`⚠️  Server Ports: Port ${config.server.port} is in use (might be this application)`);
      } else {
        console.log('✅ Server Ports: HEALTHY');
      }
    } catch (error) {
      this.results.checks.serverPorts = {
        status: 'error',
        message: `Server port check failed: ${error.message}`,
        details: { error: error.message }
      };
      console.log('❌ Server Ports: ERROR -', error.message);
    }
  }

  determineOverallHealth() {
    const statuses = Object.values(this.results.checks).map(check => check.status);
    
    if (statuses.includes('error')) {
      this.results.overall = 'unhealthy';
    } else if (statuses.includes('warning')) {
      this.results.overall = 'degraded';
    } else {
      this.results.overall = 'healthy';
    }
  }

  async run() {
    console.log('🔍 Starting Bhoomy Search Interface Health Check...\n');
    
    await this.checkDependencies();
    await this.checkDatabase();
    await this.checkElasticsearch();
    await this.checkFrontend();
    await this.checkServerPorts();
    
    this.determineOverallHealth();
    
    console.log('\n📊 Health Check Summary:');
    console.log('========================');
    console.log(`Overall Status: ${this.results.overall.toUpperCase()}`);
    console.log(`Timestamp: ${this.results.timestamp}`);
    
    // Exit with appropriate code
    if (this.results.overall === 'unhealthy') {
      console.log('\n❌ System is unhealthy. Please address the errors above.');
      process.exit(1);
    } else if (this.results.overall === 'degraded') {
      console.log('\n⚠️  System is degraded. Some warnings need attention.');
      process.exit(0);
    } else {
      console.log('\n✅ System is healthy and ready to operate.');
      process.exit(0);
    }
  }
}

// Run health check if called directly
if (require.main === module) {
  const healthChecker = new SearchHealthChecker();
  healthChecker.run().catch(error => {
    console.error('❌ Health check failed:', error);
    process.exit(1);
  });
}

module.exports = SearchHealthChecker; 