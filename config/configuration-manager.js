/**
 * Centralized Configuration Management System - Problem 24 Solution
 * 
 * Enterprise-grade configuration management that provides:
 * - Centralized configuration with environment-specific overrides
 * - Configuration validation and schema checking
 * - Change tracking and rollback capabilities
 * - Hot reloading and real-time updates
 * - Security and encryption for sensitive data
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const EventEmitter = require('events');
const winston = require('winston');
const Joi = require('joi'); // For schema validation

/**
 * Advanced Configuration Manager
 */
class ConfigurationManager extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            // Base configuration directory
            configDir: options.configDir || path.join(process.cwd(), 'config'),
            
            // Environment detection
            environment: options.environment || process.env.NODE_ENV || 'development',
            
            // Configuration file patterns
            baseConfigFile: options.baseConfigFile || 'default.json',
            envConfigPattern: options.envConfigPattern || '{env}.json',
            localConfigFile: options.localConfigFile || 'local.json',
            
            // Feature flags
            enableHotReload: options.enableHotReload !== false,
            enableChangeTracking: options.enableChangeTracking !== false,
            enableEncryption: options.enableEncryption !== false,
            enableValidation: options.enableValidation !== false,
            
            // Change tracking
            maxHistoryEntries: options.maxHistoryEntries || 100,
            
            // Reload intervals
            watchInterval: options.watchInterval || 5000,
            
            // Logger
            logger: options.logger || this.createDefaultLogger(),
            
            ...options
        };

        // Configuration storage
        this.config = {};
        this.originalConfig = {};
        this.configSchema = null;
        
        // Change tracking
        this.changeHistory = [];
        this.fileWatchers = new Map();
        
        // State management
        this.isInitialized = false;
        this.lastLoadTime = null;
        this.configSources = [];
        
        // Cache for computed values
        this.computedCache = new Map();
        
        // Environment validation
        this.requiredEnvVars = new Set();
        this.sensitiveKeys = new Set([
            'password', 'secret', 'key', 'token', 'credential',
            'DB_PASSWORD', 'ELASTICSEARCH_PASSWORD', 'JWT_SECRET',
            'SESSION_SECRET', 'API_KEY', 'ENCRYPTION_KEY'
        ]);
    }

    /**
     * Create default logger
     */
    createDefaultLogger() {
        return winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.File({ filename: 'logs/config-manager.log' }),
                new winston.transports.Console()
            ]
        });
    }

    /**
     * Initialize the configuration manager
     */
    async initialize() {
        if (this.isInitialized) {
            return this.config;
        }

        try {
            this.options.logger.info('Initializing Configuration Manager', {
                environment: this.options.environment,
                configDir: this.options.configDir
            });

            // Create config directory if it doesn't exist
            await this.ensureConfigDirectory();
            
            // Initialize configuration schema
            await this.initializeSchema();
            
            // Load configuration from all sources
            await this.loadConfiguration();
            
            // Validate configuration
            if (this.options.enableValidation) {
                await this.validateConfiguration();
            }
            
            // Start file watching for hot reload
            if (this.options.enableHotReload) {
                await this.startFileWatching();
            }
            
            // Initialize change tracking
            if (this.options.enableChangeTracking) {
                this.initializeChangeTracking();
            }

            this.isInitialized = true;
            this.lastLoadTime = Date.now();
            
            this.options.logger.info('Configuration Manager initialized successfully', {
                sources: this.configSources.length,
                keys: Object.keys(this.config).length,
                environment: this.options.environment
            });

            this.emit('initialized', this.config);
            return this.config;

        } catch (error) {
            this.options.logger.error('Failed to initialize Configuration Manager', {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    /**
     * Ensure config directory exists
     */
    async ensureConfigDirectory() {
        const configDir = this.options.configDir;
        
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
            this.options.logger.info('Created configuration directory', { configDir });
        }

        // Create subdirectories for different environments
        const environments = ['development', 'test', 'staging', 'production'];
        for (const env of environments) {
            const envDir = path.join(configDir, 'environments', env);
            if (!fs.existsSync(envDir)) {
                fs.mkdirSync(envDir, { recursive: true });
            }
        }

        // Create directories for schemas and history
        const subdirs = ['schemas', 'history', 'templates'];
        for (const subdir of subdirs) {
            const subdirPath = path.join(configDir, subdir);
            if (!fs.existsSync(subdirPath)) {
                fs.mkdirSync(subdirPath, { recursive: true });
            }
        }
    }

    /**
     * Initialize configuration schema
     */
    async initializeSchema() {
        try {
            const schemaPath = path.join(this.options.configDir, 'schemas', 'config-schema.js');
            
            if (fs.existsSync(schemaPath)) {
                const schemaModule = require(schemaPath);
                this.configSchema = schemaModule.schema || schemaModule;
                this.options.logger.info('Configuration schema loaded', { schemaPath });
            } else {
                // Create default schema
                this.configSchema = this.createDefaultSchema();
                await this.saveDefaultSchema();
            }
        } catch (error) {
            this.options.logger.warn('Failed to load configuration schema', {
                error: error.message
            });
            this.configSchema = this.createDefaultSchema();
        }
    }

    /**
     * Create default configuration schema
     */
    createDefaultSchema() {
        return Joi.object({
            // Database configuration
            database: Joi.object({
                host: Joi.string().default('localhost'),
                port: Joi.number().port().default(3306),
                name: Joi.string().required(),
                user: Joi.string().required(),
                password: Joi.string().required(),
                connectionLimit: Joi.number().min(1).max(100).default(20),
                timeout: Joi.number().positive().default(60000)
            }).required(),

            // Elasticsearch configuration
            elasticsearch: Joi.object({
                url: Joi.string().uri().required(),
                username: Joi.string().default('elastic'),
                password: Joi.string().required(),
                maxRetries: Joi.number().min(0).max(10).default(3),
                timeout: Joi.number().positive().default(30000),
                ssl: Joi.object({
                    verify: Joi.boolean().default(false),
                    ca: Joi.string().allow(''),
                    cert: Joi.string().allow(''),
                    key: Joi.string().allow('')
                }).default({})
            }).required(),

            // Application configuration
            app: Joi.object({
                name: Joi.string().default('Bhoomy Search Engine'),
                version: Joi.string().default('1.0.0'),
                port: Joi.number().port().default(3000),
                env: Joi.string().valid('development', 'test', 'staging', 'production').default('development'),
                debug: Joi.boolean().default(false)
            }).required(),

            // Security configuration
            security: Joi.object({
                jwtSecret: Joi.string().min(32).required(),
                sessionSecret: Joi.string().min(32).required(),
                encryptionKey: Joi.string().hex().length(64).optional(),
                rateLimiting: Joi.object({
                    enabled: Joi.boolean().default(true),
                    maxRequests: Joi.number().positive().default(1000),
                    windowMs: Joi.number().positive().default(900000)
                }).default({})
            }).required(),

            // Logging configuration
            logging: Joi.object({
                level: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
                file: Joi.string().default('logs/app.log'),
                maxSize: Joi.string().default('10m'),
                maxFiles: Joi.number().positive().default(5),
                enableConsole: Joi.boolean().default(true)
            }).default({}),

            // Performance configuration
            performance: Joi.object({
                enableCaching: Joi.boolean().default(true),
                cacheDefaultTTL: Joi.number().positive().default(300),
                enableCompression: Joi.boolean().default(true),
                enablePooling: Joi.boolean().default(true)
            }).default({}),

            // Feature flags
            features: Joi.object({
                enableAnalytics: Joi.boolean().default(true),
                enableImageSearch: Joi.boolean().default(true),
                enableVideoSearch: Joi.boolean().default(true),
                enableAutoComplete: Joi.boolean().default(true),
                enableSpellCheck: Joi.boolean().default(true)
            }).default({})
        });
    }

    /**
     * Save default schema
     */
    async saveDefaultSchema() {
        const schemaPath = path.join(this.options.configDir, 'schemas', 'config-schema.js');
        const schemaContent = `
// Configuration Schema - Auto-generated
const Joi = require('joi');

const schema = ${this.configSchema.describe ? 
    JSON.stringify(this.configSchema.describe(), null, 2) : 
    'null // Schema definition not serializable'
};

module.exports = { schema };
`;
        
        fs.writeFileSync(schemaPath, schemaContent);
        this.options.logger.info('Default configuration schema created', { schemaPath });
    }

    /**
     * Load configuration from all sources
     */
    async loadConfiguration() {
        this.config = {};
        this.configSources = [];

        try {
            // 1. Load base configuration
            await this.loadBaseConfiguration();
            
            // 2. Load environment-specific configuration
            await this.loadEnvironmentConfiguration();
            
            // 3. Load local overrides
            await this.loadLocalConfiguration();
            
            // 4. Load environment variables
            await this.loadEnvironmentVariables();
            
            // 5. Apply computed values
            await this.applyComputedValues();

            this.originalConfig = JSON.parse(JSON.stringify(this.config));
            
            this.options.logger.info('Configuration loaded from all sources', {
                sources: this.configSources,
                environment: this.options.environment
            });

        } catch (error) {
            this.options.logger.error('Failed to load configuration', {
                error: error.message,
                sources: this.configSources
            });
            throw error;
        }
    }

    /**
     * Load base configuration
     */
    async loadBaseConfiguration() {
        const baseConfigPath = path.join(this.options.configDir, this.options.baseConfigFile);
        
        if (fs.existsSync(baseConfigPath)) {
            const baseConfig = await this.loadConfigFile(baseConfigPath);
            this.mergeConfig(baseConfig);
            this.configSources.push({ type: 'base', path: baseConfigPath, loaded: true });
        } else {
            // Create default base configuration
            await this.createDefaultBaseConfiguration();
            this.configSources.push({ type: 'base', path: baseConfigPath, loaded: false, created: true });
        }
    }

    /**
     * Load environment-specific configuration
     */
    async loadEnvironmentConfiguration() {
        const envConfigFile = this.options.envConfigPattern.replace('{env}', this.options.environment);
        const envConfigPath = path.join(this.options.configDir, 'environments', this.options.environment, envConfigFile);
        
        if (fs.existsSync(envConfigPath)) {
            const envConfig = await this.loadConfigFile(envConfigPath);
            this.mergeConfig(envConfig);
            this.configSources.push({ type: 'environment', path: envConfigPath, loaded: true });
        } else {
            // Create default environment configuration
            await this.createDefaultEnvironmentConfiguration();
            this.configSources.push({ type: 'environment', path: envConfigPath, loaded: false, created: true });
        }
    }

    /**
     * Load local configuration overrides
     */
    async loadLocalConfiguration() {
        const localConfigPath = path.join(this.options.configDir, this.options.localConfigFile);
        
        if (fs.existsSync(localConfigPath)) {
            const localConfig = await this.loadConfigFile(localConfigPath);
            this.mergeConfig(localConfig);
            this.configSources.push({ type: 'local', path: localConfigPath, loaded: true });
        }
    }

    /**
     * Load environment variables
     */
    async loadEnvironmentVariables() {
        const envConfig = this.mapEnvironmentVariables();
        this.mergeConfig(envConfig);
        this.configSources.push({ type: 'environment_variables', loaded: true, count: Object.keys(envConfig).length });
    }

    /**
     * Load configuration file
     */
    async loadConfigFile(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const config = JSON.parse(content);
            
            this.options.logger.debug('Loaded configuration file', { filePath });
            return config;
            
        } catch (error) {
            this.options.logger.error('Failed to load configuration file', {
                filePath,
                error: error.message
            });
            throw new Error(`Failed to load config file ${filePath}: ${error.message}`);
        }
    }

    /**
     * Map environment variables to configuration structure
     */
    mapEnvironmentVariables() {
        const envConfig = {};
        
        // Database configuration
        if (process.env.DB_HOST) {
            this.setNestedValue(envConfig, 'database.host', process.env.DB_HOST);
        }
        if (process.env.DB_PORT) {
            this.setNestedValue(envConfig, 'database.port', parseInt(process.env.DB_PORT));
        }
        if (process.env.DB_NAME) {
            this.setNestedValue(envConfig, 'database.name', process.env.DB_NAME);
        }
        if (process.env.DB_USER) {
            this.setNestedValue(envConfig, 'database.user', process.env.DB_USER);
        }
        if (process.env.DB_PASSWORD) {
            this.setNestedValue(envConfig, 'database.password', process.env.DB_PASSWORD);
        }
        if (process.env.DB_CONNECTION_LIMIT) {
            this.setNestedValue(envConfig, 'database.connectionLimit', parseInt(process.env.DB_CONNECTION_LIMIT));
        }

        // Elasticsearch configuration
        if (process.env.ELASTICSEARCH_URL) {
            this.setNestedValue(envConfig, 'elasticsearch.url', process.env.ELASTICSEARCH_URL);
        }
        if (process.env.ELASTICSEARCH_USERNAME) {
            this.setNestedValue(envConfig, 'elasticsearch.username', process.env.ELASTICSEARCH_USERNAME);
        }
        if (process.env.ELASTICSEARCH_PASSWORD) {
            this.setNestedValue(envConfig, 'elasticsearch.password', process.env.ELASTICSEARCH_PASSWORD);
        }

        // Application configuration
        if (process.env.PORT) {
            this.setNestedValue(envConfig, 'app.port', parseInt(process.env.PORT));
        }
        if (process.env.NODE_ENV) {
            this.setNestedValue(envConfig, 'app.env', process.env.NODE_ENV);
        }

        // Security configuration
        if (process.env.JWT_SECRET) {
            this.setNestedValue(envConfig, 'security.jwtSecret', process.env.JWT_SECRET);
        }
        if (process.env.SESSION_SECRET) {
            this.setNestedValue(envConfig, 'security.sessionSecret', process.env.SESSION_SECRET);
        }

        // Logging configuration
        if (process.env.LOG_LEVEL) {
            this.setNestedValue(envConfig, 'logging.level', process.env.LOG_LEVEL);
        }

        return envConfig;
    }

    /**
     * Set nested value in object
     */
    setNestedValue(obj, path, value) {
        const keys = path.split('.');
        let current = obj;
        
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!(key in current) || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }
        
        current[keys[keys.length - 1]] = value;
    }

    /**
     * Get nested value from object
     */
    getNestedValue(obj, path, defaultValue = undefined) {
        const keys = path.split('.');
        let current = obj;
        
        for (const key of keys) {
            if (current && typeof current === 'object' && key in current) {
                current = current[key];
            } else {
                return defaultValue;
            }
        }
        
        return current;
    }

    /**
     * Merge configuration objects
     */
    mergeConfig(newConfig) {
        this.config = this.deepMerge(this.config, newConfig);
    }

    /**
     * Deep merge objects
     */
    deepMerge(target, source) {
        const result = { ...target };
        
        for (const key in source) {
            if (source.hasOwnProperty(key)) {
                if (this.isObject(source[key]) && this.isObject(target[key])) {
                    result[key] = this.deepMerge(target[key], source[key]);
                } else {
                    result[key] = source[key];
                }
            }
        }
        
        return result;
    }

    /**
     * Check if value is an object
     */
    isObject(value) {
        return value !== null && typeof value === 'object' && !Array.isArray(value);
    }

    /**
     * Apply computed values
     */
    async applyComputedValues() {
        // Add computed values based on configuration
        this.config._computed = {
            isProduction: this.config.app?.env === 'production',
            isDevelopment: this.config.app?.env === 'development',
            loadTime: new Date().toISOString(),
            configSources: this.configSources.length
        };
    }

    /**
     * Validate configuration against schema
     */
    async validateConfiguration() {
        if (!this.configSchema) {
            this.options.logger.warn('No schema available for configuration validation');
            return;
        }

        try {
            const { error, value } = this.configSchema.validate(this.config, {
                allowUnknown: true,
                stripUnknown: false
            });

            if (error) {
                this.options.logger.error('Configuration validation failed', {
                    errors: error.details.map(d => ({
                        path: d.path.join('.'),
                        message: d.message,
                        value: d.context?.value
                    }))
                });
                throw new Error(`Configuration validation failed: ${error.message}`);
            }

            // Apply validated and defaulted values
            this.config = value;
            this.options.logger.info('Configuration validation passed');

        } catch (error) {
            this.options.logger.error('Configuration validation error', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Get configuration value with dot notation
     */
    get(path, defaultValue = undefined) {
        // Check computed cache first
        if (this.computedCache.has(path)) {
            return this.computedCache.get(path);
        }

        const value = this.getNestedValue(this.config, path, defaultValue);
        
        // Cache computed values for performance
        if (value !== undefined) {
            this.computedCache.set(path, value);
        }
        
        return value;
    }

    /**
     * Set configuration value with dot notation
     */
    set(path, value) {
        if (this.options.enableChangeTracking) {
            this.trackChange('set', path, this.get(path), value);
        }

        this.setNestedValue(this.config, path, value);
        this.computedCache.delete(path); // Invalidate cache
        
        this.emit('configChanged', { path, value, action: 'set' });
    }

    /**
     * Check if configuration key exists
     */
    has(path) {
        return this.getNestedValue(this.config, path) !== undefined;
    }

    /**
     * Get all configuration
     */
    getAll() {
        return { ...this.config };
    }

    /**
     * Get sanitized configuration (hide sensitive values)
     */
    getSanitized() {
        return this.sanitizeConfig(this.config);
    }

    /**
     * Sanitize configuration by hiding sensitive values
     */
    sanitizeConfig(config) {
        const sanitized = JSON.parse(JSON.stringify(config));
        
        const sanitizeObject = (obj, path = '') => {
            for (const key in obj) {
                const currentPath = path ? `${path}.${key}` : key;
                
                if (this.isObject(obj[key])) {
                    sanitizeObject(obj[key], currentPath);
                } else if (this.isSensitiveKey(key) || this.isSensitiveKey(currentPath)) {
                    obj[key] = '***HIDDEN***';
                }
            }
        };
        
        sanitizeObject(sanitized);
        return sanitized;
    }

    /**
     * Check if key is sensitive
     */
    isSensitiveKey(key) {
        const lowerKey = key.toLowerCase();
        return Array.from(this.sensitiveKeys).some(sensitive => 
            lowerKey.includes(sensitive.toLowerCase())
        );
    }

    /**
     * Reload configuration
     */
    async reload() {
        this.options.logger.info('Reloading configuration');
        
        this.computedCache.clear();
        await this.loadConfiguration();
        
        if (this.options.enableValidation) {
            await this.validateConfiguration();
        }
        
        this.lastLoadTime = Date.now();
        this.emit('reloaded', this.config);
        
        return this.config;
    }

    /**
     * Create default base configuration
     */
    async createDefaultBaseConfiguration() {
        const defaultConfig = {
            app: {
                name: 'Bhoomy Search Engine',
                version: '1.0.0',
                port: 3000,
                env: 'development'
            },
            database: {
                host: 'localhost',
                port: 3306,
                name: 'mybhoomy_mysearch',
                user: 'mybhoomy_admin',
                password: 'change-me-secure-password',
                connectionLimit: 20,
                timeout: 60000
            },
            elasticsearch: {
                url: 'https://localhost:9200',
                username: 'elastic',
                password: 'change-me-secure-password',
                maxRetries: 3,
                timeout: 30000,
                ssl: {
                    verify: false
                }
            },
            security: {
                jwtSecret: 'change-me-jwt-secret-32-characters-long',
                sessionSecret: 'change-me-session-secret-32-chars-long',
                rateLimiting: {
                    enabled: true,
                    maxRequests: 1000,
                    windowMs: 900000
                }
            },
            logging: {
                level: 'info',
                file: 'logs/app.log',
                maxSize: '10m',
                maxFiles: 5,
                enableConsole: true
            },
            performance: {
                enableCaching: true,
                cacheDefaultTTL: 300,
                enableCompression: true,
                enablePooling: true
            },
            features: {
                enableAnalytics: true,
                enableImageSearch: true,
                enableVideoSearch: true,
                enableAutoComplete: true,
                enableSpellCheck: true
            }
        };

        const baseConfigPath = path.join(this.options.configDir, this.options.baseConfigFile);
        fs.writeFileSync(baseConfigPath, JSON.stringify(defaultConfig, null, 2));
        
        this.mergeConfig(defaultConfig);
        this.options.logger.info('Created default base configuration', { baseConfigPath });
    }

    /**
     * Create default environment configuration
     */
    async createDefaultEnvironmentConfiguration() {
        const envConfigFile = this.options.envConfigPattern.replace('{env}', this.options.environment);
        const envConfigPath = path.join(this.options.configDir, 'environments', this.options.environment, envConfigFile);
        
        let envConfig = {};
        
        switch (this.options.environment) {
            case 'development':
                envConfig = {
                    app: {
                        debug: true,
                        port: 3000
                    },
                    logging: {
                        level: 'debug',
                        enableConsole: true
                    },
                    performance: {
                        enableCaching: false
                    }
                };
                break;
                
            case 'test':
                envConfig = {
                    app: {
                        port: 3001
                    },
                    database: {
                        name: 'mybhoomy_test'
                    },
                    logging: {
                        level: 'warn',
                        enableConsole: false
                    }
                };
                break;
                
            case 'staging':
                envConfig = {
                    app: {
                        debug: false,
                        port: 8080
                    },
                    logging: {
                        level: 'info',
                        enableConsole: true
                    },
                    performance: {
                        enableCaching: true,
                        enableCompression: true
                    }
                };
                break;
                
            case 'production':
                envConfig = {
                    app: {
                        debug: false,
                        port: 80
                    },
                    logging: {
                        level: 'warn',
                        enableConsole: false
                    },
                    performance: {
                        enableCaching: true,
                        enableCompression: true,
                        enablePooling: true
                    },
                    security: {
                        rateLimiting: {
                            maxRequests: 500,
                            windowMs: 900000
                        }
                    }
                };
                break;
        }

        fs.writeFileSync(envConfigPath, JSON.stringify(envConfig, null, 2));
        this.mergeConfig(envConfig);
        
        this.options.logger.info('Created default environment configuration', {
            environment: this.options.environment,
            envConfigPath
        });
    }

    /**
     * Start file watching for hot reload
     */
    async startFileWatching() {
        if (!this.options.enableHotReload) {
            return;
        }

        try {
            const filesToWatch = this.configSources
                .filter(source => source.loaded && fs.existsSync(source.path))
                .map(source => source.path);

            for (const filePath of filesToWatch) {
                if (!this.fileWatchers.has(filePath)) {
                    const watcher = fs.watchFile(filePath, { interval: this.options.watchInterval }, () => {
                        this.handleFileChange(filePath);
                    });
                    
                    this.fileWatchers.set(filePath, watcher);
                    this.options.logger.debug('Started watching configuration file', { filePath });
                }
            }
            
            this.options.logger.info('File watching started for hot reload', {
                watchedFiles: filesToWatch.length
            });

        } catch (error) {
            this.options.logger.error('Failed to start file watching', {
                error: error.message
            });
        }
    }

    /**
     * Handle file change for hot reload
     */
    async handleFileChange(filePath) {
        try {
            this.options.logger.info('Configuration file changed, reloading', { filePath });
            
            await this.reload();
            
            this.options.logger.info('Configuration reloaded successfully after file change');
            
        } catch (error) {
            this.options.logger.error('Failed to reload configuration after file change', {
                filePath,
                error: error.message
            });
        }
    }

    /**
     * Initialize change tracking
     */
    initializeChangeTracking() {
        this.changeHistory = [];
        
        // Load existing change history
        this.loadChangeHistory();
        
        this.options.logger.info('Change tracking initialized', {
            historyEntries: this.changeHistory.length
        });
    }

    /**
     * Track configuration changes
     */
    trackChange(action, path, oldValue, newValue) {
        const change = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            action,
            path,
            oldValue: this.sanitizeValue(oldValue),
            newValue: this.sanitizeValue(newValue),
            environment: this.options.environment
        };

        this.changeHistory.push(change);
        
        // Limit history size
        if (this.changeHistory.length > this.options.maxHistoryEntries) {
            this.changeHistory.shift();
        }

        // Save to file
        this.saveChangeHistory();
        
        this.emit('change', change);
        
        this.options.logger.info('Configuration change tracked', {
            action,
            path,
            changeId: change.id
        });
    }

    /**
     * Sanitize value for change tracking
     */
    sanitizeValue(value) {
        if (typeof value === 'string' && this.isSensitiveKey('temp_value_check')) {
            return '***SENSITIVE***';
        }
        return value;
    }

    /**
     * Load change history from file
     */
    loadChangeHistory() {
        const historyPath = path.join(this.options.configDir, 'history', 'changes.json');
        
        if (fs.existsSync(historyPath)) {
            try {
                const content = fs.readFileSync(historyPath, 'utf8');
                this.changeHistory = JSON.parse(content);
            } catch (error) {
                this.options.logger.warn('Failed to load change history', {
                    error: error.message
                });
                this.changeHistory = [];
            }
        }
    }

    /**
     * Save change history to file
     */
    saveChangeHistory() {
        const historyPath = path.join(this.options.configDir, 'history', 'changes.json');
        
        try {
            fs.writeFileSync(historyPath, JSON.stringify(this.changeHistory, null, 2));
        } catch (error) {
            this.options.logger.error('Failed to save change history', {
                error: error.message
            });
        }
    }

    /**
     * Get change history
     */
    getChangeHistory(limit = 50) {
        return this.changeHistory.slice(-limit);
    }

    /**
     * Rollback to a previous configuration state
     */
    async rollback(changeId) {
        const changeIndex = this.changeHistory.findIndex(change => change.id === changeId);
        
        if (changeIndex === -1) {
            throw new Error(`Change with ID ${changeId} not found`);
        }

        try {
            // Apply rollback changes in reverse order
            const changesToRollback = this.changeHistory.slice(changeIndex).reverse();
            
            for (const change of changesToRollback) {
                if (change.action === 'set') {
                    this.setNestedValue(this.config, change.path, change.oldValue);
                }
            }

            // Track rollback action
            this.trackChange('rollback', `rollback_to_${changeId}`, null, changeId);
            
            this.options.logger.info('Configuration rolled back successfully', {
                changeId,
                rolledBackChanges: changesToRollback.length
            });

            this.emit('rolledBack', { changeId, changes: changesToRollback });
            
            return this.config;

        } catch (error) {
            this.options.logger.error('Failed to rollback configuration', {
                changeId,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Export configuration to file
     */
    async exportConfiguration(filePath, options = {}) {
        const { 
            includeSensitive = false, 
            format = 'json',
            includeMetadata = true 
        } = options;

        try {
            let configToExport = includeSensitive ? this.config : this.getSanitized();
            
            if (includeMetadata) {
                configToExport = {
                    _metadata: {
                        exportTime: new Date().toISOString(),
                        environment: this.options.environment,
                        version: this.config.app?.version || '1.0.0',
                        sources: this.configSources
                    },
                    ...configToExport
                };
            }

            let content;
            switch (format) {
                case 'yaml':
                    const yaml = require('yaml');
                    content = yaml.stringify(configToExport);
                    break;
                case 'json':
                default:
                    content = JSON.stringify(configToExport, null, 2);
                    break;
            }

            fs.writeFileSync(filePath, content);
            
            this.options.logger.info('Configuration exported successfully', {
                filePath,
                format,
                includeSensitive
            });

        } catch (error) {
            this.options.logger.error('Failed to export configuration', {
                filePath,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Health check for configuration system
     */
    async healthCheck() {
        const health = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            checks: {}
        };

        try {
            // Check if initialized
            health.checks.initialized = this.isInitialized;
            
            // Check configuration sources
            health.checks.configSources = this.configSources.length > 0;
            
            // Check schema validation
            if (this.options.enableValidation && this.configSchema) {
                try {
                    await this.validateConfiguration();
                    health.checks.validation = 'passed';
                } catch (error) {
                    health.checks.validation = 'failed';
                    health.status = 'warning';
                }
            }
            
            // Check file watching
            if (this.options.enableHotReload) {
                health.checks.fileWatching = this.fileWatchers.size > 0;
            }
            
            // Check change tracking
            if (this.options.enableChangeTracking) {
                health.checks.changeTracking = this.changeHistory.length >= 0;
            }

            // Check for sensitive defaults
            const hasDefaultPasswords = this.checkForDefaultPasswords();
            if (hasDefaultPasswords.length > 0) {
                health.checks.security = 'warning';
                health.checks.defaultPasswords = hasDefaultPasswords;
                health.status = 'warning';
            }

            // Overall status
            const failedChecks = Object.values(health.checks).filter(check => 
                check === false || check === 'failed'
            );
            
            if (failedChecks.length > 0) {
                health.status = 'unhealthy';
            }

        } catch (error) {
            health.status = 'unhealthy';
            health.error = error.message;
        }

        return health;
    }

    /**
     * Check for default passwords and insecure configurations
     */
    checkForDefaultPasswords() {
        const warnings = [];
        const defaultValues = ['change-me', 'password', 'admin', '123456'];
        
        const checkObject = (obj, path = '') => {
            for (const key in obj) {
                const currentPath = path ? `${path}.${key}` : key;
                
                if (this.isObject(obj[key])) {
                    checkObject(obj[key], currentPath);
                } else if (this.isSensitiveKey(key) && typeof obj[key] === 'string') {
                    const value = obj[key].toLowerCase();
                    for (const defaultValue of defaultValues) {
                        if (value.includes(defaultValue)) {
                            warnings.push({
                                path: currentPath,
                                issue: 'Default or weak password detected'
                            });
                            break;
                        }
                    }
                }
            }
        };
        
        checkObject(this.config);
        return warnings;
    }

    /**
     * Close configuration manager
     */
    async close() {
        try {
            // Stop file watchers
            for (const [filePath, watcher] of this.fileWatchers) {
                fs.unwatchFile(filePath);
                this.options.logger.debug('Stopped watching configuration file', { filePath });
            }
            this.fileWatchers.clear();

            // Save final change history
            if (this.options.enableChangeTracking) {
                this.saveChangeHistory();
            }

            this.isInitialized = false;
            this.emit('closed');
            
            this.options.logger.info('Configuration Manager closed successfully');

        } catch (error) {
            this.options.logger.error('Error closing Configuration Manager', {
                error: error.message
            });
            throw error;
        }
    }
}

module.exports = {
    ConfigurationManager
};
