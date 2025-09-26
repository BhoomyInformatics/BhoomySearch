/**
 * Secure Database Query Utilities
 * Provides SQL injection protection and query auditing
 */

const { logger } = require('./logger');
const crypto = require('crypto');

class SecureDatabase {
    constructor(dbConnection) {
        this.dbConnection = dbConnection;
        this.queryAuditLog = [];
        this.maxAuditEntries = 1000;
        
        // Initialize input sanitization patterns
        this.initializeSanitization();
    }

    /**
     * Initialize input sanitization patterns
     */
    initializeSanitization() {
        // Dangerous SQL patterns to detect
        this.dangerousPatterns = [
            /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/gi,
            /(\b(OR|AND)\s+\d+\s*=\s*\d+)/gi,
            /(--|\#|\/\*|\*\/)/gi,
            /(\bUNION\b.*\bSELECT\b)/gi,
            /(\b(INFORMATION_SCHEMA|MYSQL\.USER|PG_USER)\b)/gi,
            /((\%27)|(\')|(\')|(\%2D\%2D)|(\-\-))/gi,
            /((\%3B)|(\;))/gi,
            /((\%22)|(\"))/gi
        ];

        // Simple rate limiter for warnings to avoid log spam
        this.warningCounters = new Map();
        this.warningWindowMs = 60000; // 1 minute window
        this.maxWarningsPerKey = 5; // per minute per key

        // Safe character whitelist for different contexts
        this.whitelists = {
            alphanumeric: /^[a-zA-Z0-9_-]+$/,
            url: /^[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]+$/,
            email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
            filename: /^[a-zA-Z0-9._-]+$/,
            integer: /^-?\d+$/,
            float: /^-?\d+\.?\d*$/
        };
    }

    /**
     * Sanitize input to prevent SQL injection
     */
    sanitizeInput(input, context = 'general') {
        try {
            if (input === null || input === undefined) {
                // Return appropriate default values based on context
                switch (context) {
                    case 'integer':
                    case 'float':
                        return 0;
                    case 'url':
                        return '';
                    case 'filename':
                        return '';
                    default:
                        return '';
                }
            }

            // Convert to string for processing
            let sanitized = String(input);

            // Check for dangerous patterns with rate-limited warnings
            for (const pattern of this.dangerousPatterns) {
                if (pattern.test(sanitized)) {
                    const key = `${pattern.source}:${context}`;
                    const now = Date.now();
                    const bucket = this.warningCounters.get(key) || { count: 0, start: now };
                    if (now - bucket.start > this.warningWindowMs) {
                        bucket.count = 0;
                        bucket.start = now;
                    }
                    bucket.count++;
                    this.warningCounters.set(key, bucket);

                    if (bucket.count <= this.maxWarningsPerKey) {
                        logger.warn('Potentially dangerous SQL pattern detected', {
                            input: sanitized.substring(0, 100),
                            pattern: pattern.source,
                            context,
                            warningsInWindow: bucket.count
                        });
                    } else if (bucket.count === this.maxWarningsPerKey + 1) {
                        logger.warn('Further similar SQL warnings will be suppressed temporarily', {
                            pattern: pattern.source,
                            context,
                            windowMs: this.warningWindowMs
                        });
                    }

                    // Remove or escape dangerous patterns
                    sanitized = sanitized.replace(pattern, '');
                }
            }

            // Context-specific validation
            switch (context) {
                case 'integer':
                    // Extract numeric value from strings like "32px", "100%"
                    const numericMatch = sanitized.match(/-?\d+/);
                    if (numericMatch) {
                        const numericValue = parseInt(numericMatch[0], 10);
                        if (isNaN(numericValue)) {
                            logger.warn('Invalid integer value, using 0', { 
                                input: sanitized, 
                                context 
                            });
                            return 0;
                        }
                        return numericValue;
                    }
                    if (!this.whitelists.integer.test(sanitized)) {
                        logger.warn('Invalid integer value, using 0', { 
                            input: sanitized, 
                            context 
                        });
                        return 0;
                    }
                    return parseInt(sanitized, 10);

                case 'float':
                    // Extract numeric value from strings like "27.238267148014437"
                    const floatMatch = sanitized.match(/-?\d+\.?\d*/);
                    if (floatMatch) {
                        const floatValue = parseFloat(floatMatch[0]);
                        if (isNaN(floatValue)) {
                            logger.warn('Invalid float value, using 0', { 
                                input: sanitized, 
                                context 
                            });
                            return 0;
                        }
                        return floatValue;
                    }
                    if (!this.whitelists.float.test(sanitized)) {
                        logger.warn('Invalid float value, using 0', { 
                            input: sanitized, 
                            context 
                        });
                        return 0;
                    }
                    return parseFloat(sanitized);

                case 'url':
                    // URL encoding for safety
                    return sanitized.replace(/[<>"']/g, '');

                case 'filename':
                    // Remove path traversal attempts
                    return sanitized.replace(/[<>:"/\\|?*]/g, '').replace(/\.\./g, '');

                default:
                    // General sanitization
                    return sanitized.replace(/[<>'"]/g, '');
            }
        } catch (error) {
            logger.error('Input sanitization failed', { 
                input: String(input).substring(0, 100), 
                context, 
                error: error.message 
            });
            // Return safe defaults instead of throwing
            switch (context) {
                case 'integer':
                case 'float':
                    return 0;
                case 'url':
                case 'filename':
                default:
                    return '';
            }
        }
    }

    /**
     * Generate secure placeholders for batch queries
     */
    generateSecurePlaceholders(count, fieldsPerRecord) {
        if (!Number.isInteger(count) || !Number.isInteger(fieldsPerRecord) || 
            count <= 0 || fieldsPerRecord <= 0 || count > 1000 || fieldsPerRecord > 50) {
            throw new Error('Invalid placeholder parameters');
        }

        const singleRecord = '(' + '?'.repeat(fieldsPerRecord).split('').join(', ') + ')';
        return Array(count).fill(singleRecord).join(', ');
    }

    /**
     * Execute secure query with audit logging
     */
    async executeSecureQuery(query, values = [], options = {}) {
        const queryId = crypto.randomBytes(8).toString('hex');
        const startTime = Date.now();

        try {
            // Validate query
            this.validateQuery(query);

            // Sanitize values if required
            const sanitizedValues = options.sanitize ? 
                values.map((value, index) => this.sanitizeInput(value, options.contexts?.[index] || 'general')) :
                values;

            // Log query for audit
            this.auditQuery(queryId, query, sanitizedValues.length, options);

            // Execute query with timeout
            const queryOptions = {
                timeout: options.timeout || 30000,
                ...options
            };

            const result = await this.dbConnection.query(query, sanitizedValues, queryOptions);
            
            const duration = Date.now() - startTime;
            
            // Log successful execution
            logger.debug('Database query executed successfully', {
                queryId,
                duration: `${duration}ms`,
                affectedRows: result.affectedRows || 0,
                insertId: result.insertId || null
            });

            return result;

        } catch (error) {
            const duration = Date.now() - startTime;
            
            // Log failed execution
            logger.error('Database query failed', {
                queryId,
                duration: `${duration}ms`,
                error: error.message,
                sqlState: error.sqlState,
                errno: error.errno,
                query: query.substring(0, 200) + '...'
            });

            // Check for SQL injection attempts
            if (this.isSqlInjectionAttempt(error)) {
                logger.warn('Potential SQL injection attempt detected', {
                    queryId,
                    error: error.message,
                    query: query.substring(0, 100)
                });
            }

            throw error;
        }
    }

    /**
     * Validate query structure for security
     */
    validateQuery(query) {
        if (!query || typeof query !== 'string') {
            throw new Error('Invalid query: must be a non-empty string');
        }

        // Check query length
        if (query.length > 50000) {
            throw new Error('Query too long: potential security risk');
        }

        // Check for suspicious nested queries
        const nestedQueryCount = (query.match(/\bSELECT\b/gi) || []).length;
        if (nestedQueryCount > 5) {
            throw new Error('Too many nested queries: potential security risk');
        }

        // Check for dangerous SQL functions
        const dangerousFunctions = [
            'LOAD_FILE', 'INTO OUTFILE', 'INTO DUMPFILE',
            'SYSTEM', 'EXEC', 'xp_cmdshell'
        ];

        for (const func of dangerousFunctions) {
            if (query.toUpperCase().includes(func)) {
                throw new Error(`Dangerous SQL function detected: ${func}`);
            }
        }
    }

    /**
     * Detect SQL injection attempts from error patterns
     */
    isSqlInjectionAttempt(error) {
        const injectionErrorPatterns = [
            /syntax error/i,
            /unterminated quoted string/i,
            /unexpected token/i,
            /you have an error in your sql syntax/i,
            /quoted string not properly terminated/i
        ];

        return injectionErrorPatterns.some(pattern => pattern.test(error.message));
    }

    /**
     * Audit query execution
     */
    auditQuery(queryId, query, paramCount, options) {
        const auditEntry = {
            queryId,
            timestamp: new Date().toISOString(),
            queryHash: crypto.createHash('sha256').update(query).digest('hex').substring(0, 16),
            queryType: this.extractQueryType(query),
            paramCount,
            options: {
                timeout: options.timeout,
                sanitize: options.sanitize
            }
        };

        // Add to audit log
        this.queryAuditLog.push(auditEntry);

        // Trim audit log if too large
        if (this.queryAuditLog.length > this.maxAuditEntries) {
            this.queryAuditLog.shift();
        }

        // Log security-relevant queries
        if (this.isSecurityRelevantQuery(query)) {
            logger.info('Security-relevant database query executed', {
                queryId,
                queryType: auditEntry.queryType,
                queryHash: auditEntry.queryHash
            });
        }
    }

    /**
     * Extract query type from SQL
     */
    extractQueryType(query) {
        const typeMatch = query.trim().match(/^(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)\b/i);
        return typeMatch ? typeMatch[1].toUpperCase() : 'UNKNOWN';
    }

    /**
     * Check if query is security-relevant
     */
    isSecurityRelevantQuery(query) {
        const securityPatterns = [
            /\bUSERS?\b/i,
            /\bPASSWORD\b/i,
            /\bAUTH\b/i,
            /\bPERMISSIONS?\b/i,
            /\bROLES?\b/i,
            /\bADMIN\b/i
        ];

        return securityPatterns.some(pattern => pattern.test(query));
    }

    /**
     * Execute batch insert with secure placeholders
     */
    async executeBatchInsert(tableName, fields, records, options = {}) {
        try {
            // Validate inputs
            if (!tableName || !Array.isArray(fields) || !Array.isArray(records) || records.length === 0) {
                throw new Error('Invalid batch insert parameters');
            }

            // Security limits
            if (records.length > 1000) {
                throw new Error('Batch size too large: maximum 1000 records');
            }

            if (fields.length > 50) {
                throw new Error('Too many fields: maximum 50 fields');
            }

            // Sanitize table and field names
            const sanitizedTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '');
            const sanitizedFields = fields.map(field => field.replace(/[^a-zA-Z0-9_]/g, ''));

            // Generate secure placeholders
            const placeholders = this.generateSecurePlaceholders(records.length, fields.length);

            // Build secure query with optional duplicate key handling
            let query = `INSERT INTO ${sanitizedTableName} (${sanitizedFields.join(', ')}) VALUES ${placeholders}`;
            
            // Add ON DUPLICATE KEY UPDATE if specified
            if (options.duplicateKeyUpdate) {
                const updateClauses = Object.entries(options.duplicateKeyUpdate)
                    .map(([field, value]) => {
                        const sanitizedField = field.replace(/[^a-zA-Z0-9_]/g, '');
                        return `${sanitizedField} = ${value}`;
                    })
                    .join(', ');
                query += ` ON DUPLICATE KEY UPDATE ${updateClauses}`;
            }

            // Flatten values array
            const values = records.flat();

            // Execute with security options
            return await this.executeSecureQuery(query, values, {
                ...options,
                sanitize: false // Values are already sanitized by caller
            });

        } catch (error) {
            logger.error('Batch insert failed', {
                tableName,
                recordCount: records.length,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Get audit log summary
     */
    getAuditSummary() {
        const summary = {
            totalQueries: this.queryAuditLog.length,
            queryTypes: {},
            recentQueries: this.queryAuditLog.slice(-10),
            securityEvents: 0
        };

        this.queryAuditLog.forEach(entry => {
            summary.queryTypes[entry.queryType] = (summary.queryTypes[entry.queryType] || 0) + 1;
            if (entry.securityRelevant) {
                summary.securityEvents++;
            }
        });

        return summary;
    }

    /**
     * Clear audit log
     */
    clearAuditLog() {
        const clearedCount = this.queryAuditLog.length;
        this.queryAuditLog = [];
        
        logger.info('Database audit log cleared', { clearedEntries: clearedCount });
        return clearedCount;
    }
}

module.exports = { SecureDatabase };
