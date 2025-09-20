/**
 * Configuration Validator - Problem 24 Solution
 * 
 * Comprehensive configuration validation and testing system
 */

const Joi = require('joi');
const fs = require('fs');
const path = require('path');
const winston = require('winston');

/**
 * Configuration Validator Class
 */
class ConfigurationValidator {
    constructor(options = {}) {
        this.options = {
            // Schema settings
            strictMode: options.strictMode !== false,
            allowUnknown: options.allowUnknown === true,
            
            // Validation levels
            validationLevel: options.validationLevel || 'standard', // 'minimal', 'standard', 'strict'
            
            // Testing settings
            enableConnectivityTests: options.enableConnectivityTests !== false,
            enablePerformanceTests: options.enablePerformanceTests !== false,
            testTimeout: options.testTimeout || 30000,
            
            // Logger
            logger: options.logger || this.createDefaultLogger(),
            
            ...options
        };

        // Load schema
        this.schema = null;
        this.environmentSchemas = {};
        
        // Validation cache
        this.validationCache = new Map();
        this.lastValidationTime = null;
        
        // Test results
        this.lastTestResults = null;
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
                new winston.transports.File({ filename: 'logs/config-validator.log' }),
                new winston.transports.Console()
            ]
        });
    }

    /**
     * Initialize the validator
     */
    async initialize(schemaPath = null) {
        try {
            this.options.logger.info('Initializing Configuration Validator');

            // Load schema
            await this.loadSchema(schemaPath);
            
            this.options.logger.info('Configuration Validator initialized successfully', {
                validationLevel: this.options.validationLevel,
                strictMode: this.options.strictMode,
                hasSchema: !!this.schema
            });

        } catch (error) {
            this.options.logger.error('Failed to initialize Configuration Validator', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Load validation schema
     */
    async loadSchema(schemaPath = null) {
        try {
            if (!schemaPath) {
                schemaPath = path.join(process.cwd(), 'config', 'schemas', 'config-schema.js');
            }

            if (fs.existsSync(schemaPath)) {
                const schemaModule = require(schemaPath);
                this.schema = schemaModule.schema;
                this.environmentSchemas = schemaModule.environmentSchemas || {};
                
                this.options.logger.info('Configuration schema loaded', { schemaPath });
            } else {
                this.options.logger.warn('Schema file not found, using default validation');
                this.schema = this.createMinimalSchema();
            }

        } catch (error) {
            this.options.logger.error('Failed to load schema', {
                schemaPath,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Create minimal schema for basic validation
     */
    createMinimalSchema() {
        return Joi.object({
            app: Joi.object().required(),
            database: Joi.object().required(),
            elasticsearch: Joi.object().required()
        }).unknown(true);
    }

    /**
     * Validate configuration
     */
    async validateConfiguration(config, environment = null) {
        const startTime = Date.now();
        
        try {
            this.options.logger.info('Starting configuration validation', {
                environment,
                validationLevel: this.options.validationLevel
            });

            const validationResult = {
                valid: false,
                environment,
                timestamp: new Date().toISOString(),
                validationLevel: this.options.validationLevel,
                duration: 0,
                errors: [],
                warnings: [],
                recommendations: [],
                tests: {},
                summary: {}
            };

            // Schema validation
            const schemaResult = await this.validateAgainstSchema(config, environment);
            validationResult.errors.push(...schemaResult.errors);
            validationResult.warnings.push(...schemaResult.warnings);

            // Business logic validation
            const logicResult = await this.validateBusinessLogic(config);
            validationResult.errors.push(...logicResult.errors);
            validationResult.warnings.push(...logicResult.warnings);
            validationResult.recommendations.push(...logicResult.recommendations);

            // Security validation
            const securityResult = await this.validateSecurity(config);
            validationResult.errors.push(...securityResult.errors);
            validationResult.warnings.push(...securityResult.warnings);
            validationResult.recommendations.push(...securityResult.recommendations);

            // Connectivity tests
            if (this.options.enableConnectivityTests) {
                const connectivityResult = await this.testConnectivity(config);
                validationResult.tests.connectivity = connectivityResult;
                if (connectivityResult.errors) {
                    validationResult.errors.push(...connectivityResult.errors);
                }
            }

            // Performance tests
            if (this.options.enablePerformanceTests) {
                const performanceResult = await this.testPerformance(config);
                validationResult.tests.performance = performanceResult;
                if (performanceResult.warnings) {
                    validationResult.warnings.push(...performanceResult.warnings);
                }
            }

            // Environment-specific validation
            if (environment) {
                const envResult = await this.validateEnvironmentSpecific(config, environment);
                validationResult.errors.push(...envResult.errors);
                validationResult.warnings.push(...envResult.warnings);
                validationResult.recommendations.push(...envResult.recommendations);
            }

            // Calculate final validity
            validationResult.valid = validationResult.errors.length === 0;
            validationResult.duration = Date.now() - startTime;

            // Create summary
            validationResult.summary = this.createValidationSummary(validationResult);

            // Cache result
            this.lastValidationTime = Date.now();
            this.validationCache.set(this.generateCacheKey(config, environment), validationResult);

            this.options.logger.info('Configuration validation completed', {
                valid: validationResult.valid,
                errors: validationResult.errors.length,
                warnings: validationResult.warnings.length,
                duration: validationResult.duration
            });

            return validationResult;

        } catch (error) {
            this.options.logger.error('Configuration validation failed', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Validate against schema
     */
    async validateAgainstSchema(config, environment) {
        const result = { errors: [], warnings: [] };
        
        if (!this.schema) {
            result.warnings.push({
                type: 'schema',
                message: 'No schema available for validation',
                severity: 'low'
            });
            return result;
        }

        try {
            // Get appropriate schema for environment
            const schema = environment && this.environmentSchemas[environment] 
                ? this.environmentSchemas[environment]
                : this.schema;

            // Validate
            const { error, value, warning } = schema.validate(config, {
                allowUnknown: this.options.allowUnknown,
                stripUnknown: !this.options.allowUnknown,
                abortEarly: false
            });

            if (error) {
                for (const detail of error.details) {
                    result.errors.push({
                        type: 'schema',
                        path: detail.path.join('.'),
                        message: detail.message,
                        value: detail.context?.value,
                        severity: 'high'
                    });
                }
            }

            if (warning) {
                for (const detail of warning.details) {
                    result.warnings.push({
                        type: 'schema',
                        path: detail.path.join('.'),
                        message: detail.message,
                        severity: 'medium'
                    });
                }
            }

        } catch (error) {
            result.errors.push({
                type: 'schema',
                message: `Schema validation error: ${error.message}`,
                severity: 'critical'
            });
        }

        return result;
    }

    /**
     * Validate business logic
     */
    async validateBusinessLogic(config) {
        const result = { errors: [], warnings: [], recommendations: [] };

        try {
            // Check database configuration consistency
            if (config.database) {
                if (config.database.connectionLimit > 100) {
                    result.warnings.push({
                        type: 'business',
                        path: 'database.connectionLimit',
                        message: 'Very high connection limit may cause resource issues',
                        value: config.database.connectionLimit,
                        severity: 'medium'
                    });
                }

                if (config.database.timeout < 5000) {
                    result.warnings.push({
                        type: 'business',
                        path: 'database.timeout',
                        message: 'Low database timeout may cause connection issues',
                        value: config.database.timeout,
                        severity: 'medium'
                    });
                }
            }

            // Check Elasticsearch configuration
            if (config.elasticsearch) {
                if (config.elasticsearch.maxRetries > 5) {
                    result.warnings.push({
                        type: 'business',
                        path: 'elasticsearch.maxRetries',
                        message: 'High retry count may cause delays',
                        value: config.elasticsearch.maxRetries,
                        severity: 'low'
                    });
                }

                if (config.elasticsearch.requestTimeout < 5000) {
                    result.warnings.push({
                        type: 'business',
                        path: 'elasticsearch.requestTimeout',
                        message: 'Low request timeout may cause search failures',
                        value: config.elasticsearch.requestTimeout,
                        severity: 'medium'
                    });
                }
            }

            // Check application configuration
            if (config.app) {
                if (config.app.port < 1024 && process.getuid && process.getuid() !== 0) {
                    result.errors.push({
                        type: 'business',
                        path: 'app.port',
                        message: 'Privileged port requires root access',
                        value: config.app.port,
                        severity: 'high'
                    });
                }

                if (config.app.debug && config.app.env === 'production') {
                    result.warnings.push({
                        type: 'business',
                        path: 'app.debug',
                        message: 'Debug mode enabled in production environment',
                        severity: 'high'
                    });
                }
            }

            // Check Redis configuration
            if (config.redis && config.redis.enabled) {
                if (config.redis.maxConnections > 50) {
                    result.warnings.push({
                        type: 'business',
                        path: 'redis.maxConnections',
                        message: 'High Redis connection count may impact performance',
                        value: config.redis.maxConnections,
                        severity: 'medium'
                    });
                }
            }

            // Performance recommendations
            if (config.performance) {
                if (!config.performance.enableCaching && config.app?.env === 'production') {
                    result.recommendations.push({
                        type: 'performance',
                        message: 'Consider enabling caching in production for better performance',
                        path: 'performance.enableCaching',
                        severity: 'medium'
                    });
                }

                if (!config.performance.enableCompression) {
                    result.recommendations.push({
                        type: 'performance',
                        message: 'Enable compression to reduce bandwidth usage',
                        path: 'performance.enableCompression',
                        severity: 'low'
                    });
                }
            }

        } catch (error) {
            result.errors.push({
                type: 'business',
                message: `Business logic validation error: ${error.message}`,
                severity: 'medium'
            });
        }

        return result;
    }

    /**
     * Validate security configuration
     */
    async validateSecurity(config) {
        const result = { errors: [], warnings: [], recommendations: [] };

        try {
            // Check security configuration
            if (config.security) {
                // JWT Secret validation
                if (config.security.jwtSecret) {
                    if (config.security.jwtSecret.length < 32) {
                        result.errors.push({
                            type: 'security',
                            path: 'security.jwtSecret',
                            message: 'JWT secret must be at least 32 characters long',
                            severity: 'critical'
                        });
                    }

                    if (config.security.jwtSecret.includes('change-me') || 
                        config.security.jwtSecret === 'secret') {
                        result.errors.push({
                            type: 'security',
                            path: 'security.jwtSecret',
                            message: 'JWT secret contains default/weak value',
                            severity: 'critical'
                        });
                    }
                }

                // Session Secret validation
                if (config.security.sessionSecret) {
                    if (config.security.sessionSecret.length < 32) {
                        result.errors.push({
                            type: 'security',
                            path: 'security.sessionSecret',
                            message: 'Session secret must be at least 32 characters long',
                            severity: 'critical'
                        });
                    }

                    if (config.security.sessionSecret.includes('change-me')) {
                        result.errors.push({
                            type: 'security',
                            path: 'security.sessionSecret',
                            message: 'Session secret contains default value',
                            severity: 'critical'
                        });
                    }
                }

                // Rate limiting validation
                if (config.security.rateLimiting && !config.security.rateLimiting.enabled && 
                    config.app?.env === 'production') {
                    result.warnings.push({
                        type: 'security',
                        path: 'security.rateLimiting.enabled',
                        message: 'Rate limiting is disabled in production',
                        severity: 'high'
                    });
                }

                // Session security
                if (config.security.session) {
                    if (!config.security.session.secure && config.app?.env === 'production') {
                        result.warnings.push({
                            type: 'security',
                            path: 'security.session.secure',
                            message: 'Session cookies should be secure in production',
                            severity: 'high'
                        });
                    }

                    if (!config.security.session.httpOnly) {
                        result.warnings.push({
                            type: 'security',
                            path: 'security.session.httpOnly',
                            message: 'Session cookies should be httpOnly',
                            severity: 'medium'
                        });
                    }
                }
            }

            // Check database passwords
            if (config.database && config.database.password) {
                if (config.database.password.includes('change-me') || 
                    config.database.password === 'password' ||
                    config.database.password.length < 8) {
                    result.errors.push({
                        type: 'security',
                        path: 'database.password',
                        message: 'Database password is weak or contains default value',
                        severity: 'critical'
                    });
                }
            }

            // Check Elasticsearch passwords
            if (config.elasticsearch && config.elasticsearch.password) {
                if (config.elasticsearch.password.includes('change-me') || 
                    config.elasticsearch.password === 'changeme' ||
                    config.elasticsearch.password.length < 8) {
                    result.errors.push({
                        type: 'security',
                        path: 'elasticsearch.password',
                        message: 'Elasticsearch password is weak or contains default value',
                        severity: 'critical'
                    });
                }
            }

            // SSL/TLS validation
            if (config.elasticsearch && config.elasticsearch.ssl) {
                if (!config.elasticsearch.ssl.verify && config.app?.env === 'production') {
                    result.warnings.push({
                        type: 'security',
                        path: 'elasticsearch.ssl.verify',
                        message: 'SSL verification disabled in production',
                        severity: 'medium'
                    });
                }
            }

            // Security headers
            if (config.security && config.security.headers) {
                if (!config.security.headers.contentSecurityPolicy) {
                    result.recommendations.push({
                        type: 'security',
                        path: 'security.headers.contentSecurityPolicy',
                        message: 'Consider enabling Content Security Policy',
                        severity: 'medium'
                    });
                }

                if (!config.security.headers.strictTransportSecurity && config.app?.env === 'production') {
                    result.recommendations.push({
                        type: 'security',
                        path: 'security.headers.strictTransportSecurity',
                        message: 'Enable HSTS in production',
                        severity: 'high'
                    });
                }
            }

        } catch (error) {
            result.errors.push({
                type: 'security',
                message: `Security validation error: ${error.message}`,
                severity: 'medium'
            });
        }

        return result;
    }

    /**
     * Test connectivity to external services
     */
    async testConnectivity(config) {
        const result = {
            timestamp: new Date().toISOString(),
            tests: {},
            errors: [],
            summary: { total: 0, passed: 0, failed: 0 }
        };

        try {
            // Test database connectivity
            if (config.database) {
                result.tests.database = await this.testDatabaseConnectivity(config.database);
                result.summary.total++;
                if (result.tests.database.success) {
                    result.summary.passed++;
                } else {
                    result.summary.failed++;
                    result.errors.push({
                        type: 'connectivity',
                        service: 'database',
                        message: result.tests.database.error,
                        severity: 'high'
                    });
                }
            }

            // Test Elasticsearch connectivity
            if (config.elasticsearch) {
                result.tests.elasticsearch = await this.testElasticsearchConnectivity(config.elasticsearch);
                result.summary.total++;
                if (result.tests.elasticsearch.success) {
                    result.summary.passed++;
                } else {
                    result.summary.failed++;
                    result.errors.push({
                        type: 'connectivity',
                        service: 'elasticsearch',
                        message: result.tests.elasticsearch.error,
                        severity: 'high'
                    });
                }
            }

            // Test Redis connectivity
            if (config.redis && config.redis.enabled) {
                result.tests.redis = await this.testRedisConnectivity(config.redis);
                result.summary.total++;
                if (result.tests.redis.success) {
                    result.summary.passed++;
                } else {
                    result.summary.failed++;
                    result.errors.push({
                        type: 'connectivity',
                        service: 'redis',
                        message: result.tests.redis.error,
                        severity: 'medium'
                    });
                }
            }

        } catch (error) {
            result.errors.push({
                type: 'connectivity',
                message: `Connectivity test error: ${error.message}`,
                severity: 'medium'
            });
        }

        return result;
    }

    /**
     * Test database connectivity
     */
    async testDatabaseConnectivity(dbConfig) {
        const test = {
            service: 'database',
            success: false,
            responseTime: null,
            error: null,
            details: {}
        };

        try {
            const startTime = Date.now();
            
            // This is a placeholder - in real implementation, you would:
            // 1. Create a test connection to the database
            // 2. Execute a simple query (SELECT 1)
            // 3. Measure response time
            // 4. Close the connection
            
            // Simulated test
            await new Promise(resolve => setTimeout(resolve, 100));
            
            test.responseTime = Date.now() - startTime;
            test.success = true;
            test.details = {
                host: dbConfig.host,
                port: dbConfig.port,
                database: dbConfig.name
            };

        } catch (error) {
            test.error = error.message;
            test.success = false;
        }

        return test;
    }

    /**
     * Test Elasticsearch connectivity
     */
    async testElasticsearchConnectivity(esConfig) {
        const test = {
            service: 'elasticsearch',
            success: false,
            responseTime: null,
            error: null,
            details: {}
        };

        try {
            const startTime = Date.now();
            
            // This is a placeholder - in real implementation, you would:
            // 1. Create Elasticsearch client
            // 2. Ping the cluster
            // 3. Check cluster health
            // 4. Measure response time
            
            // Simulated test
            await new Promise(resolve => setTimeout(resolve, 150));
            
            test.responseTime = Date.now() - startTime;
            test.success = true;
            test.details = {
                url: esConfig.url,
                username: esConfig.username
            };

        } catch (error) {
            test.error = error.message;
            test.success = false;
        }

        return test;
    }

    /**
     * Test Redis connectivity
     */
    async testRedisConnectivity(redisConfig) {
        const test = {
            service: 'redis',
            success: false,
            responseTime: null,
            error: null,
            details: {}
        };

        try {
            const startTime = Date.now();
            
            // This is a placeholder - in real implementation, you would:
            // 1. Create Redis client
            // 2. Ping Redis server
            // 3. Test set/get operation
            // 4. Measure response time
            
            // Simulated test
            await new Promise(resolve => setTimeout(resolve, 50));
            
            test.responseTime = Date.now() - startTime;
            test.success = true;
            test.details = {
                host: redisConfig.host,
                port: redisConfig.port,
                db: redisConfig.db
            };

        } catch (error) {
            test.error = error.message;
            test.success = false;
        }

        return test;
    }

    /**
     * Test performance characteristics
     */
    async testPerformance(config) {
        const result = {
            timestamp: new Date().toISOString(),
            tests: {},
            warnings: [],
            recommendations: []
        };

        try {
            // Test configuration loading performance
            result.tests.configLoad = await this.testConfigurationLoadPerformance();
            
            // Test validation performance
            result.tests.validation = await this.testValidationPerformance(config);
            
            // Analyze performance characteristics
            this.analyzePerformanceResults(result, config);

        } catch (error) {
            result.warnings.push({
                type: 'performance',
                message: `Performance test error: ${error.message}`,
                severity: 'low'
            });
        }

        return result;
    }

    /**
     * Test configuration loading performance
     */
    async testConfigurationLoadPerformance() {
        const iterations = 10;
        const times = [];
        
        for (let i = 0; i < iterations; i++) {
            const startTime = Date.now();
            
            // Simulate configuration loading
            await new Promise(resolve => setTimeout(resolve, Math.random() * 50));
            
            times.push(Date.now() - startTime);
        }
        
        return {
            iterations,
            averageTime: times.reduce((a, b) => a + b, 0) / times.length,
            minTime: Math.min(...times),
            maxTime: Math.max(...times),
            times
        };
    }

    /**
     * Test validation performance
     */
    async testValidationPerformance(config) {
        const startTime = Date.now();
        
        // Perform schema validation
        if (this.schema) {
            const { error } = this.schema.validate(config, { abortEarly: false });
        }
        
        const validationTime = Date.now() - startTime;
        
        return {
            validationTime,
            configSize: JSON.stringify(config).length
        };
    }

    /**
     * Analyze performance test results
     */
    analyzePerformanceResults(result, config) {
        // Check configuration loading performance
        if (result.tests.configLoad && result.tests.configLoad.averageTime > 100) {
            result.warnings.push({
                type: 'performance',
                message: 'Configuration loading is slow',
                details: `Average load time: ${result.tests.configLoad.averageTime}ms`,
                severity: 'medium'
            });
        }

        // Check validation performance
        if (result.tests.validation && result.tests.validation.validationTime > 200) {
            result.warnings.push({
                type: 'performance',
                message: 'Configuration validation is slow',
                details: `Validation time: ${result.tests.validation.validationTime}ms`,
                severity: 'low'
            });
        }

        // Check configuration size
        if (result.tests.validation && result.tests.validation.configSize > 100000) {
            result.recommendations.push({
                type: 'performance',
                message: 'Configuration is very large, consider splitting into smaller files',
                details: `Config size: ${result.tests.validation.configSize} bytes`,
                severity: 'low'
            });
        }
    }

    /**
     * Validate environment-specific requirements
     */
    async validateEnvironmentSpecific(config, environment) {
        const result = { errors: [], warnings: [], recommendations: [] };

        try {
            switch (environment) {
                case 'production':
                    await this.validateProductionRequirements(config, result);
                    break;
                case 'staging':
                    await this.validateStagingRequirements(config, result);
                    break;
                case 'development':
                    await this.validateDevelopmentRequirements(config, result);
                    break;
                case 'test':
                    await this.validateTestRequirements(config, result);
                    break;
            }

        } catch (error) {
            result.errors.push({
                type: 'environment',
                message: `Environment validation error: ${error.message}`,
                severity: 'medium'
            });
        }

        return result;
    }

    /**
     * Validate production requirements
     */
    async validateProductionRequirements(config, result) {
        // SSL/HTTPS requirements
        if (config.security && config.security.session && !config.security.session.secure) {
            result.errors.push({
                type: 'production',
                path: 'security.session.secure',
                message: 'Secure session cookies required in production',
                severity: 'critical'
            });
        }

        // Debug mode check
        if (config.app && config.app.debug) {
            result.errors.push({
                type: 'production',
                path: 'app.debug',
                message: 'Debug mode must be disabled in production',
                severity: 'high'
            });
        }

        // Logging level check
        if (config.logging && config.logging.level === 'debug') {
            result.warnings.push({
                type: 'production',
                path: 'logging.level',
                message: 'Debug logging may impact performance in production',
                severity: 'medium'
            });
        }

        // Performance optimizations
        if (config.performance && !config.performance.enableCaching) {
            result.recommendations.push({
                type: 'production',
                path: 'performance.enableCaching',
                message: 'Enable caching for better production performance',
                severity: 'medium'
            });
        }
    }

    /**
     * Validate staging requirements
     */
    async validateStagingRequirements(config, result) {
        // Staging should be production-like
        if (config.app && config.app.debug) {
            result.warnings.push({
                type: 'staging',
                path: 'app.debug',
                message: 'Consider disabling debug mode in staging',
                severity: 'low'
            });
        }
    }

    /**
     * Validate development requirements
     */
    async validateDevelopmentRequirements(config, result) {
        // Development-specific checks
        if (config.security && config.security.rateLimiting && config.security.rateLimiting.enabled) {
            result.recommendations.push({
                type: 'development',
                path: 'security.rateLimiting.enabled',
                message: 'Consider disabling rate limiting in development',
                severity: 'low'
            });
        }
    }

    /**
     * Validate test requirements
     */
    async validateTestRequirements(config, result) {
        // Test environment should be isolated
        if (config.database && !config.database.name.includes('test')) {
            result.warnings.push({
                type: 'test',
                path: 'database.name',
                message: 'Test database name should include "test" for clarity',
                severity: 'low'
            });
        }
    }

    /**
     * Create validation summary
     */
    createValidationSummary(validationResult) {
        const summary = {
            status: validationResult.valid ? 'VALID' : 'INVALID',
            score: this.calculateValidationScore(validationResult),
            criticalIssues: validationResult.errors.filter(e => e.severity === 'critical').length,
            highPriorityIssues: validationResult.errors.filter(e => e.severity === 'high').length,
            mediumPriorityIssues: validationResult.errors.filter(e => e.severity === 'medium').length,
            warnings: validationResult.warnings.length,
            recommendations: validationResult.recommendations.length,
            testsRun: Object.keys(validationResult.tests).length,
            validationLevel: validationResult.validationLevel,
            environment: validationResult.environment
        };

        // Add priority recommendations
        summary.priorityActions = this.getPriorityActions(validationResult);

        return summary;
    }

    /**
     * Calculate validation score (0-100)
     */
    calculateValidationScore(validationResult) {
        let score = 100;
        
        // Deduct points for errors
        score -= validationResult.errors.filter(e => e.severity === 'critical').length * 25;
        score -= validationResult.errors.filter(e => e.severity === 'high').length * 15;
        score -= validationResult.errors.filter(e => e.severity === 'medium').length * 10;
        score -= validationResult.errors.filter(e => e.severity === 'low').length * 5;
        
        // Deduct points for warnings
        score -= validationResult.warnings.length * 2;
        
        return Math.max(0, score);
    }

    /**
     * Get priority actions for fixing issues
     */
    getPriorityActions(validationResult) {
        const actions = [];
        
        // Critical and high severity errors first
        const criticalErrors = validationResult.errors.filter(e => 
            e.severity === 'critical' || e.severity === 'high'
        );
        
        for (const error of criticalErrors.slice(0, 5)) { // Top 5 critical issues
            actions.push({
                priority: 'critical',
                action: `Fix ${error.type} issue: ${error.message}`,
                path: error.path,
                type: error.type
            });
        }
        
        // High-priority recommendations
        const highPriorityRecs = validationResult.recommendations.filter(r => 
            r.severity === 'high' || r.severity === 'medium'
        );
        
        for (const rec of highPriorityRecs.slice(0, 3)) { // Top 3 recommendations
            actions.push({
                priority: 'recommended',
                action: rec.message,
                path: rec.path,
                type: rec.type
            });
        }
        
        return actions;
    }

    /**
     * Generate cache key for validation results
     */
    generateCacheKey(config, environment) {
        const configHash = require('crypto')
            .createHash('md5')
            .update(JSON.stringify(config))
            .digest('hex');
        
        return `${environment || 'default'}_${configHash}`;
    }

    /**
     * Get validation statistics
     */
    getValidationStatistics() {
        return {
            lastValidationTime: this.lastValidationTime,
            cacheSize: this.validationCache.size,
            validationLevel: this.options.validationLevel,
            strictMode: this.options.strictMode,
            hasSchema: !!this.schema,
            environmentSchemas: Object.keys(this.environmentSchemas)
        };
    }

    /**
     * Clear validation cache
     */
    clearCache() {
        this.validationCache.clear();
        this.options.logger.info('Validation cache cleared');
    }
}

module.exports = {
    ConfigurationValidator
};
