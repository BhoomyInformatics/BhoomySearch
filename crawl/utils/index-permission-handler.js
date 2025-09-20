/**
 * Index Permission Handler
 * Handles database index creation with graceful fallback when user lacks INDEX privileges
 */

const { logger } = require('./logger');

class IndexPermissionHandler {
    constructor(dbConnection) {
        this.dbConnection = dbConnection;
        this.indexCreationEnabled = true;
        this.permissionChecked = false;
    }

    /**
     * Check if user has INDEX privileges
     */
    async checkIndexPermissions() {
        if (this.permissionChecked) {
            return this.indexCreationEnabled;
        }

        try {
            // Try to create a test index to check permissions
            const testQuery = 'CREATE INDEX IF NOT EXISTS test_permission_check ON site_data (site_data_id)';
            await this.dbConnection.query(testQuery);
            
            // If successful, clean up the test index
            await this.dbConnection.query('DROP INDEX IF EXISTS test_permission_check ON site_data');
            
            this.indexCreationEnabled = true;
            logger.info('INDEX privileges confirmed - index creation enabled');
            
        } catch (error) {
            if (error.code === 'ER_TABLEACCESS_DENIED_ERROR' || 
                error.message.includes('INDEX command denied')) {
                this.indexCreationEnabled = false;
                logger.warn('INDEX privileges not available - disabling index creation', {
                    error: error.message,
                    code: error.code
                });
            } else {
                // Other errors - assume we can create indexes
                this.indexCreationEnabled = true;
                logger.warn('Could not verify INDEX privileges, assuming they are available', {
                    error: error.message
                });
            }
        }

        this.permissionChecked = true;
        return this.indexCreationEnabled;
    }

    /**
     * Safely create an index with permission checking
     */
    async createIndex(indexName, tableName, columns, options = {}) {
        // Check permissions first
        const hasPermissions = await this.checkIndexPermissions();
        
        if (!hasPermissions) {
            logger.debug('Skipping index creation due to insufficient privileges', {
                indexName,
                tableName,
                columns
            });
            return false;
        }

        try {
            const ifNotExists = options.ifNotExists !== false ? 'IF NOT EXISTS' : '';
            const unique = options.unique ? 'UNIQUE' : '';
            const columnsStr = Array.isArray(columns) ? columns.join(', ') : columns;
            
            const query = `CREATE ${unique} INDEX ${ifNotExists} ${indexName} ON ${tableName} (${columnsStr})`;
            
            await this.dbConnection.query(query);
            
            logger.debug('Index created successfully', {
                indexName,
                tableName,
                columns
            });
            
            return true;
            
        } catch (error) {
            if (error.code === 'ER_TABLEACCESS_DENIED_ERROR' || 
                error.message.includes('INDEX command denied')) {
                logger.warn('INDEX creation failed due to insufficient privileges', {
                    indexName,
                    tableName,
                    error: error.message
                });
                this.indexCreationEnabled = false;
                return false;
            } else {
                logger.error('Index creation failed', {
                    indexName,
                    tableName,
                    error: error.message,
                    code: error.code
                });
                return false;
            }
        }
    }

    /**
     * Create multiple indexes with permission checking
     */
    async createIndexes(indexDefinitions) {
        const results = [];
        
        for (const indexDef of indexDefinitions) {
            const result = await this.createIndex(
                indexDef.name,
                indexDef.table,
                indexDef.columns,
                indexDef.options || {}
            );
            results.push({ ...indexDef, success: result });
        }
        
        return results;
    }

    /**
     * Get status of index creation capability
     */
    getStatus() {
        return {
            permissionChecked: this.permissionChecked,
            indexCreationEnabled: this.indexCreationEnabled
        };
    }
}

module.exports = IndexPermissionHandler;
