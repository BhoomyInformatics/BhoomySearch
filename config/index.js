/**
 * Centralized Configuration Management System - Main Entry Point
 * Problem 24 Solution: Configuration Management Issues
 * 
 * Unified interface for configuration management across the entire application
 */

const { ConfigurationManager } = require('./configuration-manager');
const { ConfigChangeTracker } = require('./config-change-tracker');
const { ConfigurationValidator } = require('./config-validator');
const winston = require('winston');

/**
 * Unified Configuration System
 */
class UnifiedConfigurationSystem {
    constructor(options = {}) {
        this.options = {
            // Environment detection
            environment: options.environment || process.env.NODE_ENV || 'development',
            
            // Component configuration
            configManager: options.configManager || {},
            changeTracker: options.changeTracker || {},
            validator: options.validator || {},
            
            // Feature flags
            enableChangeTracking: options.enableChangeTracking !== false,
            enableValidation: options.enableValidation !== false,
            enableHotReload: options.enableHotReload !== false,
            
            // Logger
            logger: options.logger || this.createDefaultLogger(),
            
            ...options
        };

        // Initialize components
        this.configManager = null;
        this.changeTracker = null;
        this.validator = null;
        
        // State management
        this.isInitialized = false;
        this.config = {};
        this.lastValidationResult = null;
        
        // Event handling
        this.eventHandlers = new Map();
    }

    /**
     * Create default logger
     */
    createDefaultLogger() {
        return winston.createLogger({
            level: process.env.LOG_LEVEL || 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.File({ filename: 'logs/unified-config.log' }),
                new winston.transports.Console()
            ]
        });
    }

    /**
     * Initialize the unified configuration system
     */
    async initialize() {
        if (this.isInitialized) {
            return this.config;
        }

        try {
            this.options.logger.info('Initializing Unified Configuration System', {
                environment: this.options.environment,
                features: {
                    changeTracking: this.options.enableChangeTracking,
                    validation: this.options.enableValidation,
                    hotReload: this.options.enableHotReload
                }
            });

            // Initialize configuration manager
            await this.initializeConfigurationManager();
            
            // Initialize change tracker
            if (this.options.enableChangeTracking) {
                await this.initializeChangeTracker();
            }
            
            // Initialize validator
            if (this.options.enableValidation) {
                await this.initializeValidator();
            }
            
            // Load and validate configuration
            await this.loadConfiguration();
            
            // Set up event handlers
            this.setupEventHandlers();

            this.isInitialized = true;
            
            this.options.logger.info('Unified Configuration System initialized successfully', {
                configKeys: Object.keys(this.config).length,
                environment: this.options.environment,
                components: this.getComponentStatus()
            });

            return this.config;

        } catch (error) {
            this.options.logger.error('Failed to initialize Unified Configuration System', {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    /**
     * Initialize configuration manager
     */
    async initializeConfigurationManager() {
        this.configManager = new ConfigurationManager({
            environment: this.options.environment,
            enableHotReload: this.options.enableHotReload,
            enableChangeTracking: false, // We handle this separately
            logger: this.options.logger,
            ...this.options.configManager
        });

        await this.configManager.initialize();
    }

    /**
     * Initialize change tracker
     */
    async initializeChangeTracker() {
        this.changeTracker = new ConfigChangeTracker({
            logger: this.options.logger,
            ...this.options.changeTracker
        });

        await this.changeTracker.initialize();
    }

    /**
     * Initialize validator
     */
    async initializeValidator() {
        this.validator = new ConfigurationValidator({
            logger: this.options.logger,
            ...this.options.validator
        });

        await this.validator.initialize();
    }

    /**
     * Load and validate configuration
     */
    async loadConfiguration() {
        try {
            // Load configuration
            this.config = await this.configManager.getAll();
            
            // Validate configuration
            if (this.validator) {
                this.lastValidationResult = await this.validator.validateConfiguration(
                    this.config, 
                    this.options.environment
                );
                
                if (!this.lastValidationResult.valid) {
                    const criticalErrors = this.lastValidationResult.errors.filter(
                        e => e.severity === 'critical'
                    );
                    
                    if (criticalErrors.length > 0) {
                        throw new Error(
                            `Critical configuration errors: ${criticalErrors.map(e => e.message).join(', ')}`
                        );
                    }
                }
            }
            
            this.options.logger.info('Configuration loaded and validated', {
                valid: this.lastValidationResult?.valid || true,
                errors: this.lastValidationResult?.errors?.length || 0,
                warnings: this.lastValidationResult?.warnings?.length || 0
            });

        } catch (error) {
            this.options.logger.error('Failed to load configuration', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Set up event handlers for component integration
     */
    setupEventHandlers() {
        // Configuration manager events
        if (this.configManager) {
            this.configManager.on('configChanged', async (changeData) => {
                await this.handleConfigChange(changeData);
            });

            this.configManager.on('reloaded', async (newConfig) => {
                await this.handleConfigReload(newConfig);
            });
        }

        // Change tracker events
        if (this.changeTracker) {
            this.changeTracker.on('change', (change) => {
                this.options.logger.info('Configuration change tracked', {
                    changeId: change.id,
                    path: change.path,
                    operation: change.operation
                });
            });
        }
    }

    /**
     * Handle configuration changes
     */
    async handleConfigChange(changeData) {
        try {
            // Track change
            if (this.changeTracker) {
                await this.changeTracker.trackChange({
                    type: 'runtime',
                    source: 'config_manager',
                    path: changeData.path,
                    operation: changeData.action,
                    oldValue: changeData.oldValue,
                    newValue: changeData.value,
                    reason: 'Runtime configuration change'
                });
            }

            // Update local config
            this.config = await this.configManager.getAll();
            
            // Re-validate if enabled
            if (this.validator) {
                this.lastValidationResult = await this.validator.validateConfiguration(
                    this.config,
                    this.options.environment
                );
            }

            this.options.logger.info('Configuration change processed', {
                path: changeData.path,
                valid: this.lastValidationResult?.valid || true
            });

        } catch (error) {
            this.options.logger.error('Failed to handle configuration change', {
                changeData,
                error: error.message
            });
        }
    }

    /**
     * Handle configuration reload
     */
    async handleConfigReload(newConfig) {
        try {
            this.config = newConfig;
            
            // Create snapshot of reload
            if (this.changeTracker) {
                await this.changeTracker.createSnapshot(
                    `reload_${Date.now()}`,
                    'Configuration reloaded from file changes'
                );
            }

            // Re-validate
            if (this.validator) {
                this.lastValidationResult = await this.validator.validateConfiguration(
                    this.config,
                    this.options.environment
                );
            }

            this.options.logger.info('Configuration reloaded successfully', {
                keys: Object.keys(this.config).length,
                valid: this.lastValidationResult?.valid || true
            });

        } catch (error) {
            this.options.logger.error('Failed to handle configuration reload', {
                error: error.message
            });
        }
    }

    /**
     * Get configuration value with dot notation
     */
    get(path, defaultValue = undefined) {
        if (!this.isInitialized) {
            throw new Error('Configuration system not initialized');
        }
        
        return this.configManager.get(path, defaultValue);
    }

    /**
     * Set configuration value with change tracking
     */
    async set(path, value, options = {}) {
        if (!this.isInitialized) {
            throw new Error('Configuration system not initialized');
        }

        const oldValue = this.get(path);
        
        // Set value through config manager
        this.configManager.set(path, value);
        
        // Track change
        if (this.changeTracker) {
            await this.changeTracker.trackChange({
                type: 'manual',
                source: 'unified_system',
                path,
                operation: 'set',
                oldValue,
                newValue: value,
                reason: options.reason || 'Manual configuration change',
                user: options.user,
                metadata: options.metadata
            });
        }

        // Update local config
        this.config = await this.configManager.getAll();
        
        return true;
    }

    /**
     * Check if configuration key exists
     */
    has(path) {
        if (!this.isInitialized) {
            throw new Error('Configuration system not initialized');
        }
        
        return this.configManager.has(path);
    }

    /**
     * Get all configuration
     */
    getAll() {
        if (!this.isInitialized) {
            throw new Error('Configuration system not initialized');
        }
        
        return { ...this.config };
    }

    /**
     * Get sanitized configuration (hide sensitive values)
     */
    getSanitized() {
        if (!this.isInitialized) {
            throw new Error('Configuration system not initialized');
        }
        
        return this.configManager.getSanitized();
    }

    /**
     * Reload configuration
     */
    async reload() {
        if (!this.isInitialized) {
            throw new Error('Configuration system not initialized');
        }
        
        this.config = await this.configManager.reload();
        
        // Re-validate
        if (this.validator) {
            this.lastValidationResult = await this.validator.validateConfiguration(
                this.config,
                this.options.environment
            );
        }
        
        return this.config;
    }

    /**
     * Validate current configuration
     */
    async validate() {
        if (!this.isInitialized) {
            throw new Error('Configuration system not initialized');
        }
        
        if (!this.validator) {
            throw new Error('Validation not enabled');
        }
        
        this.lastValidationResult = await this.validator.validateConfiguration(
            this.config,
            this.options.environment
        );
        
        return this.lastValidationResult;
    }

    /**
     * Create configuration snapshot
     */
    async createSnapshot(name, description) {
        if (!this.changeTracker) {
            throw new Error('Change tracking not enabled');
        }
        
        return await this.changeTracker.createSnapshot(name, description, this.config);
    }

    /**
     * Rollback to previous configuration
     */
    async rollback(targetId, options = {}) {
        if (!this.changeTracker) {
            throw new Error('Change tracking not enabled');
        }
        
        const rollbackResult = await this.changeTracker.rollback(targetId, options);
        
        // Reload configuration after rollback
        await this.reload();
        
        return rollbackResult;
    }

    /**
     * Get change history
     */
    getChangeHistory(filters = {}) {
        if (!this.changeTracker) {
            throw new Error('Change tracking not enabled');
        }
        
        return this.changeTracker.getChangeHistory(filters);
    }

    /**
     * Get available snapshots
     */
    getSnapshots(filters = {}) {
        if (!this.changeTracker) {
            throw new Error('Change tracking not enabled');
        }
        
        return this.changeTracker.getSnapshots(filters);
    }

    /**
     * Export configuration
     */
    async exportConfiguration(filePath, options = {}) {
        if (!this.isInitialized) {
            throw new Error('Configuration system not initialized');
        }
        
        return await this.configManager.exportConfiguration(filePath, options);
    }

    /**
     * Get system health
     */
    async getHealth() {
        const health = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            environment: this.options.environment,
            components: {},
            configuration: {
                initialized: this.isInitialized,
                keysLoaded: Object.keys(this.config).length,
                lastValidation: this.lastValidationResult?.timestamp || null,
                valid: this.lastValidationResult?.valid || null
            }
        };

        try {
            // Check configuration manager health
            if (this.configManager) {
                health.components.configManager = await this.configManager.healthCheck();
            }

            // Check change tracker health
            if (this.changeTracker) {
                health.components.changeTracker = {
                    status: 'healthy',
                    statistics: this.changeTracker.getStatistics()
                };
            }

            // Check validator health
            if (this.validator) {
                health.components.validator = {
                    status: 'healthy',
                    statistics: this.validator.getValidationStatistics()
                };
            }

            // Overall status
            const componentStatuses = Object.values(health.components).map(c => c.status);
            if (componentStatuses.includes('unhealthy')) {
                health.status = 'unhealthy';
            } else if (componentStatuses.includes('warning')) {
                health.status = 'warning';
            }

        } catch (error) {
            health.status = 'unhealthy';
            health.error = error.message;
        }

        return health;
    }

    /**
     * Get component status
     */
    getComponentStatus() {
        return {
            configManager: !!this.configManager,
            changeTracker: !!this.changeTracker,
            validator: !!this.validator,
            initialized: this.isInitialized
        };
    }

    /**
     * Get performance metrics
     */
    getMetrics() {
        const metrics = {
            system: {
                initialized: this.isInitialized,
                environment: this.options.environment,
                configurationKeys: Object.keys(this.config).length,
                uptime: this.isInitialized ? Date.now() - this.initTime : 0
            }
        };

        // Add component metrics
        if (this.changeTracker) {
            metrics.changeTracking = this.changeTracker.getStatistics();
        }

        if (this.validator) {
            metrics.validation = this.validator.getValidationStatistics();
        }

        if (this.lastValidationResult) {
            metrics.lastValidation = {
                valid: this.lastValidationResult.valid,
                score: this.lastValidationResult.summary?.score,
                errors: this.lastValidationResult.errors.length,
                warnings: this.lastValidationResult.warnings.length,
                timestamp: this.lastValidationResult.timestamp
            };
        }

        return metrics;
    }

    /**
     * Clean up and close the system
     */
    async close() {
        try {
            this.options.logger.info('Closing Unified Configuration System');

            // Close components
            if (this.configManager) {
                await this.configManager.close();
            }

            if (this.changeTracker) {
                await this.changeTracker.close();
            }

            this.isInitialized = false;
            
            this.options.logger.info('Unified Configuration System closed successfully');

        } catch (error) {
            this.options.logger.error('Error closing Unified Configuration System', {
                error: error.message
            });
            throw error;
        }
    }
}

// Create singleton instance
let configSystemInstance = null;

/**
 * Get or create singleton configuration system instance
 */
function getConfigSystem(options = {}) {
    if (!configSystemInstance) {
        configSystemInstance = new UnifiedConfigurationSystem(options);
    }
    return configSystemInstance;
}

/**
 * Initialize configuration system
 */
async function initializeConfig(options = {}) {
    const configSystem = getConfigSystem(options);
    return await configSystem.initialize();
}

/**
 * Quick access functions for common operations
 */
const config = {
    // Initialization
    init: initializeConfig,
    
    // Basic operations
    get: (path, defaultValue) => {
        const system = getConfigSystem();
        return system.get(path, defaultValue);
    },
    
    set: async (path, value, options) => {
        const system = getConfigSystem();
        return await system.set(path, value, options);
    },
    
    has: (path) => {
        const system = getConfigSystem();
        return system.has(path);
    },
    
    getAll: () => {
        const system = getConfigSystem();
        return system.getAll();
    },
    
    getSanitized: () => {
        const system = getConfigSystem();
        return system.getSanitized();
    },
    
    // Advanced operations
    reload: async () => {
        const system = getConfigSystem();
        return await system.reload();
    },
    
    validate: async () => {
        const system = getConfigSystem();
        return await system.validate();
    },
    
    createSnapshot: async (name, description) => {
        const system = getConfigSystem();
        return await system.createSnapshot(name, description);
    },
    
    rollback: async (targetId, options) => {
        const system = getConfigSystem();
        return await system.rollback(targetId, options);
    },
    
    // Monitoring
    getHealth: async () => {
        const system = getConfigSystem();
        return await system.getHealth();
    },
    
    getMetrics: () => {
        const system = getConfigSystem();
        return system.getMetrics();
    },
    
    // History
    getHistory: (filters) => {
        const system = getConfigSystem();
        return system.getChangeHistory(filters);
    },
    
    getSnapshots: (filters) => {
        const system = getConfigSystem();
        return system.getSnapshots(filters);
    },
    
    // System control
    close: async () => {
        const system = getConfigSystem();
        await system.close();
        configSystemInstance = null;
    }
};

module.exports = {
    UnifiedConfigurationSystem,
    getConfigSystem,
    initializeConfig,
    config
};
