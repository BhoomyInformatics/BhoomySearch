/**
 * Environment Variable Management System
 * Handles secure loading and validation of environment variables
 * with encryption support for sensitive data
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class EnvironmentManager {
    constructor() {
        this.config = {};
        this.encryptionKey = null;
        this.requiredVars = new Set();
        this.sensitiveVars = new Set(['ELASTICSEARCH_PASSWORD', 'DB_PASSWORD', 'JWT_SECRET', 'API_KEYS']);
    }

    /**
     * Initialize encryption key for sensitive data
     */
    initializeEncryption() {
        // Use environment-specific encryption key or generate one
        const envKey = process.env.ENCRYPTION_KEY;
        if (envKey) {
            this.encryptionKey = Buffer.from(envKey, 'hex');
        } else {
            // Generate a new key and warn about it
            this.encryptionKey = crypto.randomBytes(32);
            console.warn('⚠️  No ENCRYPTION_KEY found, generated temporary key. Set ENCRYPTION_KEY environment variable for persistent encryption.');
        }
    }

    /**
     * Encrypt sensitive data
     */
    encrypt(text) {
        if (!this.encryptionKey) {
            this.initializeEncryption();
        }
        
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipher('aes-256-gcm', this.encryptionKey);
        
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const authTag = cipher.getAuthTag();
        
        return {
            encrypted: encrypted,
            iv: iv.toString('hex'),
            authTag: authTag.toString('hex')
        };
    }

    /**
     * Decrypt sensitive data
     */
    decrypt(encryptedData) {
        if (!this.encryptionKey) {
            this.initializeEncryption();
        }

        try {
            const decipher = crypto.createDecipher('aes-256-gcm', this.encryptionKey);
            decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
            
            let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return decrypted;
        } catch (error) {
            console.error('❌ Failed to decrypt sensitive data:', error.message);
            return null;
        }
    }

    /**
     * Load environment variables from multiple sources
     */
    loadEnvironment() {
        // Load from process.env first
        this.config = { ...process.env };

        // Load from .env files in order of priority
        const envFiles = [
            '.env.local',
            '.env.production',
            '.env.development',
            '.env'
        ];

        for (const envFile of envFiles) {
            this.loadEnvFile(envFile);
        }

        // Load encrypted environment variables if they exist
        this.loadEncryptedEnv();

        // Validate required variables
        this.validateRequiredVars();

        return this.config;
    }

    /**
     * Load variables from a specific .env file
     */
    loadEnvFile(filename) {
        const filePath = path.resolve(process.cwd(), filename);
        
        if (fs.existsSync(filePath)) {
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                const lines = content.split('\n');
                
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed && !trimmed.startsWith('#')) {
                        const [key, ...valueParts] = trimmed.split('=');
                        if (key && valueParts.length > 0) {
                            const value = valueParts.join('=').replace(/^["']|["']$/g, '');
                            // Only set if not already set (priority order)
                            if (!this.config[key]) {
                                this.config[key] = value;
                            }
                        }
                    }
                }
                
                console.log(`✅ Loaded environment from ${filename}`);
            } catch (error) {
                console.warn(`⚠️  Could not load ${filename}:`, error.message);
            }
        }
    }

    /**
     * Load encrypted environment variables
     */
    loadEncryptedEnv() {
        const encryptedPath = path.resolve(process.cwd(), '.env.encrypted');
        
        if (fs.existsSync(encryptedPath)) {
            try {
                const encryptedData = JSON.parse(fs.readFileSync(encryptedPath, 'utf8'));
                
                for (const [key, encData] of Object.entries(encryptedData)) {
                    const decrypted = this.decrypt(encData);
                    if (decrypted !== null) {
                        this.config[key] = decrypted;
                    }
                }
                
                console.log('✅ Loaded encrypted environment variables');
            } catch (error) {
                console.warn('⚠️  Could not load encrypted environment:', error.message);
            }
        }
    }

    /**
     * Save encrypted environment variables
     */
    saveEncryptedEnv(variables) {
        const encryptedData = {};
        
        for (const [key, value] of Object.entries(variables)) {
            if (this.sensitiveVars.has(key)) {
                encryptedData[key] = this.encrypt(value);
            }
        }
        
        const encryptedPath = path.resolve(process.cwd(), '.env.encrypted');
        fs.writeFileSync(encryptedPath, JSON.stringify(encryptedData, null, 2));
        
        console.log('✅ Saved encrypted environment variables');
    }

    /**
     * Mark variables as required
     */
    require(variables) {
        if (Array.isArray(variables)) {
            variables.forEach(v => this.requiredVars.add(v));
        } else {
            this.requiredVars.add(variables);
        }
        return this;
    }

    /**
     * Validate that all required variables are present
     */
    validateRequiredVars() {
        const missing = [];
        
        for (const varName of this.requiredVars) {
            if (!this.config[varName]) {
                missing.push(varName);
            }
        }
        
        if (missing.length > 0) {
            console.error('❌ Missing required environment variables:', missing.join(', '));
            throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
        }
    }

    /**
     * Get environment variable with fallback
     */
    get(key, defaultValue = null) {
        return this.config[key] || defaultValue;
    }

    /**
     * Get boolean environment variable
     */
    getBoolean(key, defaultValue = false) {
        const value = this.config[key];
        if (value === undefined) return defaultValue;
        return value.toLowerCase() === 'true' || value === '1';
    }

    /**
     * Get number environment variable
     */
    getNumber(key, defaultValue = 0) {
        const value = this.config[key];
        if (value === undefined) return defaultValue;
        const num = Number(value);
        return isNaN(num) ? defaultValue : num;
    }

    /**
     * Rotate credentials - generate new password
     */
    rotateCredential(key, length = 32) {
        const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let result = '';
        
        for (let i = 0; i < length; i++) {
            result += charset.charAt(Math.floor(Math.random() * charset.length));
        }
        
        this.config[key] = result;
        console.log(`🔄 Rotated credential for ${key}`);
        
        return result;
    }

    /**
     * Health check for environment configuration
     */
    healthCheck() {
        const health = {
            status: 'healthy',
            checks: {}
        };

        // Check Elasticsearch connection
        if (this.config.ELASTICSEARCH_PASSWORD) {
            health.checks.elasticsearch = this.config.ELASTICSEARCH_PASSWORD !== 'change-me' ? 'configured' : 'default-password';
        }

        // Check database configuration
        if (this.config.DB_PASSWORD) {
            health.checks.database = this.config.DB_PASSWORD !== 'change-me' ? 'configured' : 'default-password';
        }

        // Check encryption
        health.checks.encryption = this.encryptionKey ? 'enabled' : 'disabled';

        // Overall status
        const hasDefaults = Object.values(health.checks).includes('default-password');
        if (hasDefaults) {
            health.status = 'warning';
        }

        return health;
    }
}

// Create global instance
const envManager = new EnvironmentManager();

module.exports = {
    EnvironmentManager,
    envManager
};
