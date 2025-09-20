/**
 * Configuration Change Tracker - Problem 24 Solution
 * 
 * Advanced change tracking and rollback system for configuration management
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const EventEmitter = require('events');
const winston = require('winston');

/**
 * Configuration Change Tracker Class
 */
class ConfigChangeTracker extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            // Storage settings
            historyDir: options.historyDir || path.join(process.cwd(), 'config', 'history'),
            backupDir: options.backupDir || path.join(process.cwd(), 'config', 'backups'),
            
            // Retention settings
            maxHistoryEntries: options.maxHistoryEntries || 1000,
            maxBackupFiles: options.maxBackupFiles || 50,
            retentionDays: options.retentionDays || 30,
            
            // Change detection
            enableFileWatching: options.enableFileWatching !== false,
            watchInterval: options.watchInterval || 5000,
            
            // Backup settings
            enableAutoBackup: options.enableAutoBackup !== false,
            backupInterval: options.backupInterval || 86400000, // 24 hours
            
            // Logger
            logger: options.logger || this.createDefaultLogger(),
            
            ...options
        };

        // Change tracking storage
        this.changeHistory = [];
        this.snapshots = new Map();
        this.fileWatchers = new Map();
        
        // State management
        this.isInitialized = false;
        this.lastSnapshotTime = null;
        
        // Backup management
        this.backupTimer = null;
        
        // Change detection
        this.fileHashes = new Map();
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
                new winston.transports.File({ filename: 'logs/config-changes.log' }),
                new winston.transports.Console()
            ]
        });
    }

    /**
     * Initialize the change tracker
     */
    async initialize() {
        if (this.isInitialized) {
            return;
        }

        try {
            this.options.logger.info('Initializing Configuration Change Tracker');

            // Create directories
            await this.ensureDirectories();
            
            // Load existing history
            await this.loadChangeHistory();
            
            // Create initial snapshot
            await this.createSnapshot('initial', 'System initialization');
            
            // Start automatic backup if enabled
            if (this.options.enableAutoBackup) {
                this.startAutoBackup();
            }

            this.isInitialized = true;
            this.options.logger.info('Configuration Change Tracker initialized successfully', {
                historyEntries: this.changeHistory.length,
                snapshots: this.snapshots.size
            });

        } catch (error) {
            this.options.logger.error('Failed to initialize Configuration Change Tracker', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Ensure required directories exist
     */
    async ensureDirectories() {
        const dirs = [
            this.options.historyDir,
            this.options.backupDir,
            path.join(this.options.historyDir, 'snapshots'),
            path.join(this.options.historyDir, 'diffs')
        ];

        for (const dir of dirs) {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                this.options.logger.debug('Created directory', { dir });
            }
        }
    }

    /**
     * Track a configuration change
     */
    async trackChange(changeData) {
        const change = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            type: changeData.type || 'manual',
            source: changeData.source || 'unknown',
            path: changeData.path,
            operation: changeData.operation, // 'set', 'delete', 'update'
            oldValue: this.sanitizeValue(changeData.oldValue),
            newValue: this.sanitizeValue(changeData.newValue),
            reason: changeData.reason || '',
            environment: process.env.NODE_ENV || 'development',
            user: changeData.user || process.env.USER || 'system',
            metadata: {
                pid: process.pid,
                hostname: require('os').hostname(),
                version: process.version,
                ...changeData.metadata
            }
        };

        try {
            // Add to history
            this.changeHistory.push(change);
            
            // Limit history size
            if (this.changeHistory.length > this.options.maxHistoryEntries) {
                this.changeHistory.shift();
            }

            // Save to file
            await this.saveChangeHistory();
            
            // Create diff if significant change
            if (this.isSignificantChange(change)) {
                await this.createDiff(change);
            }

            // Emit change event
            this.emit('change', change);
            
            this.options.logger.info('Configuration change tracked', {
                changeId: change.id,
                type: change.type,
                path: change.path,
                operation: change.operation
            });

            return change;

        } catch (error) {
            this.options.logger.error('Failed to track configuration change', {
                error: error.message,
                changeData
            });
            throw error;
        }
    }

    /**
     * Sanitize sensitive values for storage
     */
    sanitizeValue(value) {
        if (typeof value === 'string') {
            const sensitivePatterns = [
                /password/i, /secret/i, /key/i, /token/i, /credential/i
            ];
            
            // Check if the value or its context suggests it's sensitive
            const isSensitive = sensitivePatterns.some(pattern => 
                JSON.stringify({ value }).match(pattern)
            );
            
            if (isSensitive && value.length > 8) {
                return `***REDACTED:${value.length}chars***`;
            }
        }
        
        return value;
    }

    /**
     * Check if change is significant enough to create a diff
     */
    isSignificantChange(change) {
        const significantOperations = ['set', 'update', 'delete'];
        const significantPaths = [
            'database', 'elasticsearch', 'security', 'app.port', 'app.env'
        ];
        
        if (!significantOperations.includes(change.operation)) {
            return false;
        }
        
        return significantPaths.some(path => 
            change.path && change.path.startsWith(path)
        );
    }

    /**
     * Create a diff for a change
     */
    async createDiff(change) {
        try {
            const diff = {
                changeId: change.id,
                timestamp: change.timestamp,
                path: change.path,
                operation: change.operation,
                diff: this.calculateDiff(change.oldValue, change.newValue),
                impact: this.assessChangeImpact(change)
            };

            const diffPath = path.join(
                this.options.historyDir, 
                'diffs', 
                `${change.id}.json`
            );
            
            fs.writeFileSync(diffPath, JSON.stringify(diff, null, 2));
            
            this.options.logger.debug('Created diff for change', {
                changeId: change.id,
                diffPath
            });

        } catch (error) {
            this.options.logger.warn('Failed to create diff', {
                changeId: change.id,
                error: error.message
            });
        }
    }

    /**
     * Calculate diff between old and new values
     */
    calculateDiff(oldValue, newValue) {
        if (oldValue === newValue) {
            return { type: 'no-change' };
        }
        
        if (oldValue === undefined) {
            return { type: 'added', value: newValue };
        }
        
        if (newValue === undefined) {
            return { type: 'removed', value: oldValue };
        }
        
        if (typeof oldValue === 'object' && typeof newValue === 'object') {
            return { 
                type: 'object-changed',
                old: oldValue,
                new: newValue,
                changes: this.deepDiff(oldValue, newValue)
            };
        }
        
        return {
            type: 'value-changed',
            old: oldValue,
            new: newValue
        };
    }

    /**
     * Deep diff for objects
     */
    deepDiff(obj1, obj2, path = '') {
        const changes = [];
        const allKeys = new Set([...Object.keys(obj1 || {}), ...Object.keys(obj2 || {})]);
        
        for (const key of allKeys) {
            const currentPath = path ? `${path}.${key}` : key;
            const val1 = obj1 ? obj1[key] : undefined;
            const val2 = obj2 ? obj2[key] : undefined;
            
            if (val1 !== val2) {
                if (typeof val1 === 'object' && typeof val2 === 'object') {
                    changes.push(...this.deepDiff(val1, val2, currentPath));
                } else {
                    changes.push({
                        path: currentPath,
                        old: val1,
                        new: val2,
                        type: val1 === undefined ? 'added' : 
                              val2 === undefined ? 'removed' : 'changed'
                    });
                }
            }
        }
        
        return changes;
    }

    /**
     * Assess the impact of a configuration change
     */
    assessChangeImpact(change) {
        const impact = {
            level: 'low',
            requiresRestart: false,
            affectedSystems: [],
            riskLevel: 'low'
        };

        // Assess impact based on configuration path
        if (change.path) {
            if (change.path.startsWith('database')) {
                impact.level = 'high';
                impact.requiresRestart = true;
                impact.affectedSystems.push('database');
                impact.riskLevel = 'high';
            } else if (change.path.startsWith('elasticsearch')) {
                impact.level = 'high';
                impact.affectedSystems.push('search');
                impact.riskLevel = 'medium';
            } else if (change.path.startsWith('security')) {
                impact.level = 'critical';
                impact.requiresRestart = true;
                impact.affectedSystems.push('authentication', 'security');
                impact.riskLevel = 'critical';
            } else if (change.path.includes('port') || change.path.includes('host')) {
                impact.level = 'high';
                impact.requiresRestart = true;
                impact.affectedSystems.push('network');
                impact.riskLevel = 'high';
            } else if (change.path.startsWith('app.env')) {
                impact.level = 'critical';
                impact.requiresRestart = true;
                impact.affectedSystems.push('application');
                impact.riskLevel = 'critical';
            }
        }

        return impact;
    }

    /**
     * Create a configuration snapshot
     */
    async createSnapshot(name, description, config = null) {
        try {
            const snapshot = {
                id: crypto.randomUUID(),
                name: name || `snapshot_${Date.now()}`,
                description: description || 'Manual snapshot',
                timestamp: new Date().toISOString(),
                environment: process.env.NODE_ENV || 'development',
                config: config || await this.getCurrentConfig(),
                metadata: {
                    hostname: require('os').hostname(),
                    pid: process.pid,
                    version: process.version
                }
            };

            // Store snapshot
            this.snapshots.set(snapshot.id, snapshot);
            
            // Save to file
            const snapshotPath = path.join(
                this.options.historyDir,
                'snapshots',
                `${snapshot.id}.json`
            );
            
            fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
            
            // Limit snapshots
            if (this.snapshots.size > this.options.maxBackupFiles) {
                const oldestSnapshot = Array.from(this.snapshots.values())
                    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))[0];
                
                this.deleteSnapshot(oldestSnapshot.id);
            }

            this.lastSnapshotTime = Date.now();
            
            this.options.logger.info('Configuration snapshot created', {
                snapshotId: snapshot.id,
                name: snapshot.name,
                description: snapshot.description
            });

            this.emit('snapshot', snapshot);
            return snapshot;

        } catch (error) {
            this.options.logger.error('Failed to create configuration snapshot', {
                name,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Get current configuration (placeholder - should be implemented by configuration manager)
     */
    async getCurrentConfig() {
        // This would be implemented by the configuration manager
        // For now, return a placeholder
        return {
            timestamp: new Date().toISOString(),
            note: 'Configuration snapshot placeholder'
        };
    }

    /**
     * Rollback to a specific change or snapshot
     */
    async rollback(targetId, options = {}) {
        try {
            this.options.logger.info('Starting configuration rollback', {
                targetId,
                options
            });

            let rollbackData;
            let rollbackType;

            // Check if it's a snapshot ID
            if (this.snapshots.has(targetId)) {
                rollbackData = this.snapshots.get(targetId);
                rollbackType = 'snapshot';
            } else {
                // Check if it's a change ID
                const change = this.changeHistory.find(c => c.id === targetId);
                if (change) {
                    rollbackData = change;
                    rollbackType = 'change';
                } else {
                    throw new Error(`Target ID ${targetId} not found in history or snapshots`);
                }
            }

            // Create pre-rollback snapshot
            const preRollbackSnapshot = await this.createSnapshot(
                `pre_rollback_${Date.now()}`,
                `Snapshot before rollback to ${targetId}`
            );

            // Perform rollback
            let rollbackResult;
            if (rollbackType === 'snapshot') {
                rollbackResult = await this.rollbackToSnapshot(rollbackData, options);
            } else {
                rollbackResult = await this.rollbackToChange(rollbackData, options);
            }

            // Track rollback as a change
            await this.trackChange({
                type: 'rollback',
                source: 'change_tracker',
                path: 'system.rollback',
                operation: 'rollback',
                oldValue: preRollbackSnapshot.id,
                newValue: targetId,
                reason: options.reason || 'Manual rollback',
                metadata: {
                    rollbackType,
                    targetId,
                    preRollbackSnapshot: preRollbackSnapshot.id
                }
            });

            this.options.logger.info('Configuration rollback completed successfully', {
                targetId,
                rollbackType,
                preRollbackSnapshot: preRollbackSnapshot.id
            });

            this.emit('rollback', {
                targetId,
                rollbackType,
                preRollbackSnapshot: preRollbackSnapshot.id,
                result: rollbackResult
            });

            return rollbackResult;

        } catch (error) {
            this.options.logger.error('Configuration rollback failed', {
                targetId,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Rollback to a snapshot
     */
    async rollbackToSnapshot(snapshot, options) {
        // This would be implemented by the configuration manager
        // For now, return a placeholder result
        this.options.logger.info('Rolling back to snapshot', {
            snapshotId: snapshot.id,
            snapshotName: snapshot.name
        });

        return {
            success: true,
            type: 'snapshot',
            snapshot: snapshot,
            message: 'Rollback to snapshot completed (placeholder implementation)'
        };
    }

    /**
     * Rollback to a specific change
     */
    async rollbackToChange(change, options) {
        // This would be implemented by the configuration manager
        // For now, return a placeholder result
        this.options.logger.info('Rolling back to change', {
            changeId: change.id,
            changePath: change.path
        });

        return {
            success: true,
            type: 'change',
            change: change,
            message: 'Rollback to change completed (placeholder implementation)'
        };
    }

    /**
     * Get change history
     */
    getChangeHistory(filters = {}) {
        let history = [...this.changeHistory];

        // Apply filters
        if (filters.type) {
            history = history.filter(change => change.type === filters.type);
        }
        
        if (filters.path) {
            history = history.filter(change => 
                change.path && change.path.includes(filters.path)
            );
        }
        
        if (filters.user) {
            history = history.filter(change => change.user === filters.user);
        }
        
        if (filters.since) {
            const since = new Date(filters.since);
            history = history.filter(change => 
                new Date(change.timestamp) >= since
            );
        }
        
        if (filters.limit) {
            history = history.slice(-filters.limit);
        }

        return history.sort((a, b) => 
            new Date(b.timestamp) - new Date(a.timestamp)
        );
    }

    /**
     * Get available snapshots
     */
    getSnapshots(filters = {}) {
        let snapshots = Array.from(this.snapshots.values());

        // Apply filters
        if (filters.name) {
            snapshots = snapshots.filter(snapshot => 
                snapshot.name.includes(filters.name)
            );
        }
        
        if (filters.since) {
            const since = new Date(filters.since);
            snapshots = snapshots.filter(snapshot => 
                new Date(snapshot.timestamp) >= since
            );
        }
        
        if (filters.limit) {
            snapshots = snapshots.slice(-filters.limit);
        }

        return snapshots.sort((a, b) => 
            new Date(b.timestamp) - new Date(a.timestamp)
        );
    }

    /**
     * Delete a snapshot
     */
    deleteSnapshot(snapshotId) {
        try {
            if (this.snapshots.has(snapshotId)) {
                // Remove from memory
                this.snapshots.delete(snapshotId);
                
                // Remove file
                const snapshotPath = path.join(
                    this.options.historyDir,
                    'snapshots',
                    `${snapshotId}.json`
                );
                
                if (fs.existsSync(snapshotPath)) {
                    fs.unlinkSync(snapshotPath);
                }

                this.options.logger.info('Snapshot deleted', { snapshotId });
                return true;
            }
            
            return false;

        } catch (error) {
            this.options.logger.error('Failed to delete snapshot', {
                snapshotId,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Load change history from file
     */
    async loadChangeHistory() {
        const historyPath = path.join(this.options.historyDir, 'changes.json');
        
        if (fs.existsSync(historyPath)) {
            try {
                const content = fs.readFileSync(historyPath, 'utf8');
                this.changeHistory = JSON.parse(content);
                
                this.options.logger.info('Change history loaded', {
                    entries: this.changeHistory.length
                });
            } catch (error) {
                this.options.logger.warn('Failed to load change history', {
                    error: error.message
                });
                this.changeHistory = [];
            }
        }

        // Load snapshots
        const snapshotsDir = path.join(this.options.historyDir, 'snapshots');
        if (fs.existsSync(snapshotsDir)) {
            const snapshotFiles = fs.readdirSync(snapshotsDir)
                .filter(file => file.endsWith('.json'));
            
            for (const file of snapshotFiles) {
                try {
                    const snapshotPath = path.join(snapshotsDir, file);
                    const content = fs.readFileSync(snapshotPath, 'utf8');
                    const snapshot = JSON.parse(content);
                    this.snapshots.set(snapshot.id, snapshot);
                } catch (error) {
                    this.options.logger.warn('Failed to load snapshot', {
                        file,
                        error: error.message
                    });
                }
            }
            
            this.options.logger.info('Snapshots loaded', {
                count: this.snapshots.size
            });
        }
    }

    /**
     * Save change history to file
     */
    async saveChangeHistory() {
        const historyPath = path.join(this.options.historyDir, 'changes.json');
        
        try {
            fs.writeFileSync(historyPath, JSON.stringify(this.changeHistory, null, 2));
        } catch (error) {
            this.options.logger.error('Failed to save change history', {
                error: error.message
            });
        }
    }

    /**
     * Start automatic backup
     */
    startAutoBackup() {
        if (this.backupTimer) {
            clearInterval(this.backupTimer);
        }

        this.backupTimer = setInterval(async () => {
            try {
                await this.createSnapshot(
                    `auto_backup_${Date.now()}`,
                    'Automatic backup'
                );
            } catch (error) {
                this.options.logger.error('Automatic backup failed', {
                    error: error.message
                });
            }
        }, this.options.backupInterval);

        this.options.logger.info('Automatic backup started', {
            interval: this.options.backupInterval
        });
    }

    /**
     * Stop automatic backup
     */
    stopAutoBackup() {
        if (this.backupTimer) {
            clearInterval(this.backupTimer);
            this.backupTimer = null;
            this.options.logger.info('Automatic backup stopped');
        }
    }

    /**
     * Cleanup old history and snapshots
     */
    async cleanup() {
        try {
            const cutoffDate = new Date(Date.now() - (this.options.retentionDays * 24 * 60 * 60 * 1000));
            
            // Cleanup old changes
            const originalLength = this.changeHistory.length;
            this.changeHistory = this.changeHistory.filter(change => 
                new Date(change.timestamp) > cutoffDate
            );
            
            const removedChanges = originalLength - this.changeHistory.length;
            
            // Cleanup old snapshots
            const snapshotsToRemove = Array.from(this.snapshots.values())
                .filter(snapshot => new Date(snapshot.timestamp) < cutoffDate)
                .map(snapshot => snapshot.id);
            
            for (const snapshotId of snapshotsToRemove) {
                this.deleteSnapshot(snapshotId);
            }

            // Save updated history
            await this.saveChangeHistory();

            this.options.logger.info('History cleanup completed', {
                removedChanges,
                removedSnapshots: snapshotsToRemove.length,
                retentionDays: this.options.retentionDays
            });

        } catch (error) {
            this.options.logger.error('History cleanup failed', {
                error: error.message
            });
        }
    }

    /**
     * Get change tracker statistics
     */
    getStatistics() {
        const now = Date.now();
        const dayAgo = now - (24 * 60 * 60 * 1000);
        const weekAgo = now - (7 * 24 * 60 * 60 * 1000);

        const recentChanges = this.changeHistory.filter(change =>
            new Date(change.timestamp).getTime() > dayAgo
        );

        const weeklyChanges = this.changeHistory.filter(change =>
            new Date(change.timestamp).getTime() > weekAgo
        );

        return {
            totalChanges: this.changeHistory.length,
            totalSnapshots: this.snapshots.size,
            changesLast24h: recentChanges.length,
            changesLastWeek: weeklyChanges.length,
            lastSnapshot: this.lastSnapshotTime,
            autoBackupEnabled: !!this.backupTimer,
            retentionDays: this.options.retentionDays,
            changeTypes: this.getChangeTypeStats(),
            mostChangedPaths: this.getMostChangedPaths()
        };
    }

    /**
     * Get change type statistics
     */
    getChangeTypeStats() {
        const stats = {};
        
        for (const change of this.changeHistory) {
            const type = change.type || 'unknown';
            stats[type] = (stats[type] || 0) + 1;
        }
        
        return stats;
    }

    /**
     * Get most frequently changed paths
     */
    getMostChangedPaths() {
        const pathCounts = {};
        
        for (const change of this.changeHistory) {
            if (change.path) {
                pathCounts[change.path] = (pathCounts[change.path] || 0) + 1;
            }
        }
        
        return Object.entries(pathCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([path, count]) => ({ path, count }));
    }

    /**
     * Close the change tracker
     */
    async close() {
        try {
            // Stop auto backup
            this.stopAutoBackup();
            
            // Stop file watchers
            for (const [filePath, watcher] of this.fileWatchers) {
                fs.unwatchFile(filePath);
            }
            this.fileWatchers.clear();

            // Final save
            await this.saveChangeHistory();

            this.isInitialized = false;
            this.emit('closed');
            
            this.options.logger.info('Configuration Change Tracker closed successfully');

        } catch (error) {
            this.options.logger.error('Error closing Configuration Change Tracker', {
                error: error.message
            });
            throw error;
        }
    }
}

module.exports = {
    ConfigChangeTracker
};
