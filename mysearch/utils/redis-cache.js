/**
 * Enhanced Redis Cache Manager for Search Engine
 * Provides intelligent caching with TTL, compression, and cache invalidation
 */

const { createClient } = require('redis');
const { envManager } = require('../../config/env-manager');
const zlib = require('zlib');
const { promisify } = require('util');

class RedisCacheManager {
    constructor() {
        this.client = null;
        this.isConnected = false;
        this.compressionEnabled = true;
        this.defaultTTL = 300; // 5 minutes
        this.maxTTL = 3600; // 1 hour
        this.compressionThreshold = 1024; // Compress if > 1KB
        
        this.init();
    }

    async init() {
        try {
            this.client = createClient({
                host: envManager.get('REDIS_HOST', 'localhost'),
                port: envManager.get('REDIS_PORT', 6379),
                password: envManager.get('REDIS_PASSWORD'),
                db: envManager.get('REDIS_DB', 0),
                retry_strategy: (options) => {
                    if (options.error && options.error.code === 'ECONNREFUSED') {
                        console.warn('Redis server refused connection, retrying...');
                        return new Error('Redis server refused connection');
                    }
                    if (options.total_retry_time > 1000 * 60 * 60) {
                        console.error('Redis retry time exhausted');
                        return new Error('Retry time exhausted');
                    }
                    if (options.attempt > 10) {
                        console.error('Redis max retry attempts reached');
                        return undefined;
                    }
                    return Math.min(options.attempt * 100, 3000);
                }
            });

            this.client.on('error', (err) => {
                console.error('Redis Client Error:', err);
                this.isConnected = false;
            });

            this.client.on('connect', () => {
                console.log('Redis client connected');
                this.isConnected = true;
            });

            this.client.on('ready', () => {
                console.log('Redis client ready');
                this.isConnected = true;
            });

            this.client.on('end', () => {
                console.log('Redis client disconnected');
                this.isConnected = false;
            });

            await this.client.connect();
            
            // Test connection
            await this.client.ping();
            console.log('✅ Redis cache manager initialized successfully');
            
        } catch (error) {
            console.warn('❌ Redis not available, using fallback cache:', error.message);
            this.isConnected = false;
        }
    }

    /**
     * Generate cache key with namespace and version
     */
    generateCacheKey(namespace, key, version = 'v1') {
        const cleanKey = typeof key === 'string' ? key : JSON.stringify(key);
        return `bhoomy:${namespace}:${version}:${Buffer.from(cleanKey).toString('base64')}`;
    }

    /**
     * Compress data if it's large enough
     */
    async compress(data) {
        if (!this.compressionEnabled || data.length < this.compressionThreshold) {
            return data;
        }
        
        try {
            const compressed = await promisify(zlib.gzip)(data);
            return Buffer.concat([Buffer.from('gzip:'), compressed]);
        } catch (error) {
            console.warn('Compression failed, storing uncompressed:', error.message);
            return data;
        }
    }

    /**
     * Decompress data if it's compressed
     */
    async decompress(data) {
        if (!Buffer.isBuffer(data) || !data.toString('utf8', 0, 5).startsWith('gzip:')) {
            return data;
        }
        
        try {
            const compressed = data.slice(5); // Remove 'gzip:' prefix
            return await promisify(zlib.gunzip)(compressed);
        } catch (error) {
            console.warn('Decompression failed, returning raw data:', error.message);
            return data;
        }
    }

    /**
     * Set cache with intelligent TTL and compression
     */
    async set(namespace, key, value, ttl = null) {
        if (!this.isConnected || !this.client) {
            return false;
        }

        try {
            const cacheKey = this.generateCacheKey(namespace, key);
            const serializedValue = JSON.stringify({
                data: value,
                timestamp: Date.now(),
                version: '1.0'
            });
            
            const compressedValue = await this.compress(Buffer.from(serializedValue));
            const finalTTL = ttl || this.defaultTTL;
            
            await this.client.setEx(cacheKey, Math.min(finalTTL, this.maxTTL), compressedValue);
            
            console.log(`✅ Cached: ${namespace}:${key} (TTL: ${finalTTL}s, Size: ${compressedValue.length} bytes)`);
            return true;
            
        } catch (error) {
            console.error('Redis set error:', error.message);
            return false;
        }
    }

    /**
     * Get cache with decompression
     */
    async get(namespace, key) {
        if (!this.isConnected || !this.client) {
            return null;
        }

        try {
            const cacheKey = this.generateCacheKey(namespace, key);
            const compressedValue = await this.client.get(cacheKey);
            
            if (!compressedValue) {
                return null;
            }
            
            const decompressedValue = await this.decompress(compressedValue);
            const parsed = JSON.parse(decompressedValue.toString());
            
            console.log(`✅ Cache hit: ${namespace}:${key} (Age: ${Date.now() - parsed.timestamp}ms)`);
            return parsed.data;
            
        } catch (error) {
            console.error('Redis get error:', error.message);
            return null;
        }
    }

    /**
     * Delete cache entry
     */
    async del(namespace, key) {
        if (!this.isConnected || !this.client) {
            return false;
        }

        try {
            const cacheKey = this.generateCacheKey(namespace, key);
            const result = await this.client.del(cacheKey);
            console.log(`🗑️ Deleted cache: ${namespace}:${key}`);
            return result > 0;
        } catch (error) {
            console.error('Redis delete error:', error.message);
            return false;
        }
    }

    /**
     * Clear all cache entries for a namespace
     */
    async clearNamespace(namespace) {
        if (!this.isConnected || !this.client) {
            return false;
        }

        try {
            const pattern = `bhoomy:${namespace}:*`;
            const keys = await this.client.keys(pattern);
            
            if (keys.length > 0) {
                await this.client.del(keys);
                console.log(`🗑️ Cleared ${keys.length} cache entries for namespace: ${namespace}`);
            }
            
            return true;
        } catch (error) {
            console.error('Redis clear namespace error:', error.message);
            return false;
        }
    }

    /**
     * Get cache statistics
     */
    async getStats() {
        if (!this.isConnected || !this.client) {
            return { connected: false, stats: null };
        }

        try {
            const info = await this.client.info('memory');
            const keyspace = await this.client.info('keyspace');
            
            return {
                connected: true,
                stats: {
                    memory: info,
                    keyspace: keyspace,
                    timestamp: Date.now()
                }
            };
        } catch (error) {
            console.error('Redis stats error:', error.message);
            return { connected: false, error: error.message };
        }
    }

    /**
     * Health check
     */
    async healthCheck() {
        if (!this.isConnected || !this.client) {
            return { status: 'disconnected', message: 'Redis not connected' };
        }

        try {
            await this.client.ping();
            return { status: 'healthy', message: 'Redis is responding' };
        } catch (error) {
            return { status: 'unhealthy', message: error.message };
        }
    }

    /**
     * Close connection
     */
    async close() {
        if (this.client) {
            await this.client.quit();
            this.isConnected = false;
            console.log('Redis connection closed');
        }
    }
}

// Create singleton instance
const redisCache = new RedisCacheManager();

module.exports = redisCache;
