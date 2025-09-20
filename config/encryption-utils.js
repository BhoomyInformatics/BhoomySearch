/**
 * Encryption Utilities for Sensitive Configuration Data
 * Provides secure encryption/decryption for credentials and sensitive data
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class ConfigEncryption {
    constructor() {
        this.algorithm = 'aes-256-gcm';
        this.keyLength = 32; // 256 bits
        this.ivLength = 16;  // 128 bits
        this.tagLength = 16; // 128 bits
        this.saltLength = 32; // 256 bits
        
        this.masterKey = null;
        this.keyDerivationIterations = 100000; // PBKDF2 iterations
        
        this.initializeMasterKey();
    }

    /**
     * Initialize or load master encryption key
     */
    initializeMasterKey() {
        const keyFile = path.resolve(process.cwd(), 'config', '.master.key');
        
        if (fs.existsSync(keyFile)) {
            try {
                const keyData = JSON.parse(fs.readFileSync(keyFile, 'utf8'));
                
                // Derive key from stored salt and environment variable
                const envKey = process.env.ENCRYPTION_KEY;
                if (!envKey) {
                    console.warn('⚠️  ENCRYPTION_KEY environment variable not set');
                    console.warn('   Using temporary key - data will not persist across restarts');
                    this.masterKey = crypto.randomBytes(this.keyLength);
                } else {
                    this.masterKey = this.deriveKey(envKey, Buffer.from(keyData.salt, 'hex'));
                }
                
                console.log('✅ Master encryption key loaded');
            } catch (error) {
                console.error('❌ Failed to load master key:', error.message);
                this.generateNewMasterKey();
            }
        } else {
            this.generateNewMasterKey();
        }
    }

    /**
     * Generate new master encryption key
     */
    generateNewMasterKey() {
        const salt = crypto.randomBytes(this.saltLength);
        
        // Try to use environment key, otherwise generate warning
        const envKey = process.env.ENCRYPTION_KEY;
        if (!envKey) {
            console.warn('⚠️  No ENCRYPTION_KEY environment variable found');
            console.warn('   Generating temporary master key');
            console.warn('   Set ENCRYPTION_KEY to persist encryption across restarts');
            
            // Generate temporary key
            this.masterKey = crypto.randomBytes(this.keyLength);
        } else {
            this.masterKey = this.deriveKey(envKey, salt);
            
            // Save salt for future key derivation
            const keyFile = path.resolve(process.cwd(), 'config', '.master.key');
            const keyDir = path.dirname(keyFile);
            
            if (!fs.existsSync(keyDir)) {
                fs.mkdirSync(keyDir, { recursive: true });
            }
            
            fs.writeFileSync(keyFile, JSON.stringify({
                salt: salt.toString('hex'),
                created: Date.now(),
                algorithm: this.algorithm
            }, null, 2));
            
            console.log('✅ New master encryption key generated and saved');
        }
    }

    /**
     * Derive encryption key from password and salt using PBKDF2
     */
    deriveKey(password, salt) {
        return crypto.pbkdf2Sync(password, salt, this.keyDerivationIterations, this.keyLength, 'sha256');
    }

    /**
     * Encrypt sensitive data
     */
    encrypt(plaintext) {
        if (!this.masterKey) {
            throw new Error('Master key not initialized');
        }

        const iv = crypto.randomBytes(this.ivLength);
        const cipher = crypto.createCipher(this.algorithm, this.masterKey);
        cipher.setAAD(Buffer.from('SearchEngine-Bhoomy')); // Additional authenticated data
        
        let encrypted = cipher.update(plaintext, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const authTag = cipher.getAuthTag();
        
        return {
            encrypted: encrypted,
            iv: iv.toString('hex'),
            authTag: authTag.toString('hex'),
            algorithm: this.algorithm,
            timestamp: Date.now()
        };
    }

    /**
     * Decrypt sensitive data
     */
    decrypt(encryptedData) {
        if (!this.masterKey) {
            throw new Error('Master key not initialized');
        }

        try {
            const decipher = crypto.createDecipher(this.algorithm, this.masterKey);
            decipher.setAAD(Buffer.from('SearchEngine-Bhoomy')); // Additional authenticated data
            decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
            
            let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return decrypted;
        } catch (error) {
            console.error('❌ Decryption failed:', error.message);
            throw new Error('Failed to decrypt data - key mismatch or corrupted data');
        }
    }

    /**
     * Encrypt configuration file
     */
    encryptConfigFile(filePath, outputPath = null) {
        if (!fs.existsSync(filePath)) {
            throw new Error(`Configuration file not found: ${filePath}`);
        }

        const content = fs.readFileSync(filePath, 'utf8');
        const encrypted = this.encrypt(content);
        
        const output = outputPath || filePath + '.encrypted';
        fs.writeFileSync(output, JSON.stringify(encrypted, null, 2));
        
        console.log(`✅ Configuration file encrypted: ${output}`);
        return output;
    }

    /**
     * Decrypt configuration file
     */
    decryptConfigFile(filePath, outputPath = null) {
        if (!fs.existsSync(filePath)) {
            throw new Error(`Encrypted file not found: ${filePath}`);
        }

        const encryptedData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const decrypted = this.decrypt(encryptedData);
        
        if (outputPath) {
            fs.writeFileSync(outputPath, decrypted);
            console.log(`✅ Configuration file decrypted: ${outputPath}`);
        }
        
        return decrypted;
    }

    /**
     * Encrypt environment variables object
     */
    encryptEnvironmentVars(envVars) {
        const encryptedVars = {};
        
        for (const [key, value] of Object.entries(envVars)) {
            if (this.isSensitiveVariable(key)) {
                encryptedVars[key] = this.encrypt(value);
            } else {
                encryptedVars[key] = value; // Store non-sensitive vars as plain text
            }
        }
        
        return encryptedVars;
    }

    /**
     * Decrypt environment variables object
     */
    decryptEnvironmentVars(encryptedVars) {
        const decryptedVars = {};
        
        for (const [key, value] of Object.entries(encryptedVars)) {
            if (typeof value === 'object' && value.encrypted) {
                // This is an encrypted value
                try {
                    decryptedVars[key] = this.decrypt(value);
                } catch (error) {
                    console.error(`❌ Failed to decrypt ${key}:`, error.message);
                    decryptedVars[key] = null;
                }
            } else {
                // Plain text value
                decryptedVars[key] = value;
            }
        }
        
        return decryptedVars;
    }

    /**
     * Check if a variable should be encrypted
     */
    isSensitiveVariable(varName) {
        const sensitivePatterns = [
            /password/i,
            /secret/i,
            /key/i,
            /token/i,
            /credential/i,
            /auth/i
        ];
        
        return sensitivePatterns.some(pattern => pattern.test(varName));
    }

    /**
     * Create secure backup of encrypted configuration
     */
    createSecureBackup(data, backupName = null) {
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const backupFile = backupName || `config-backup-${timestamp}.encrypted`;
        const backupPath = path.resolve(process.cwd(), 'backups', 'config', backupFile);
        
        // Ensure backup directory exists
        const backupDir = path.dirname(backupPath);
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }
        
        const encrypted = this.encrypt(JSON.stringify(data, null, 2));
        
        // Add metadata
        const backupData = {
            metadata: {
                created: Date.now(),
                version: '1.0',
                type: 'configuration_backup',
                checksum: crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex')
            },
            data: encrypted
        };
        
        fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
        
        console.log(`✅ Secure backup created: ${backupPath}`);
        return backupPath;
    }

    /**
     * Restore from secure backup
     */
    restoreSecureBackup(backupPath) {
        if (!fs.existsSync(backupPath)) {
            throw new Error(`Backup file not found: ${backupPath}`);
        }

        const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
        
        if (!backupData.data || !backupData.metadata) {
            throw new Error('Invalid backup file format');
        }
        
        const decryptedData = this.decrypt(backupData.data);
        const restoredConfig = JSON.parse(decryptedData);
        
        // Verify checksum
        const checksum = crypto.createHash('sha256').update(JSON.stringify(restoredConfig)).digest('hex');
        if (checksum !== backupData.metadata.checksum) {
            throw new Error('Backup verification failed - data may be corrupted');
        }
        
        console.log('✅ Configuration restored from secure backup');
        return restoredConfig;
    }

    /**
     * Rotate encryption keys (re-encrypt all data with new key)
     */
    rotateEncryptionKey(newPassword) {
        console.log('🔄 Starting encryption key rotation');
        
        // Store old master key for re-encryption
        const oldMasterKey = this.masterKey;
        
        // Generate new salt and derive new key
        const newSalt = crypto.randomBytes(this.saltLength);
        this.masterKey = this.deriveKey(newPassword, newSalt);
        
        // Update master key file
        const keyFile = path.resolve(process.cwd(), 'config', '.master.key');
        fs.writeFileSync(keyFile, JSON.stringify({
            salt: newSalt.toString('hex'),
            created: Date.now(),
            algorithm: this.algorithm,
            rotatedFrom: oldMasterKey ? 'previous_key' : 'initial_key'
        }, null, 2));
        
        console.log('✅ Encryption key rotated successfully');
        console.log('⚠️  All encrypted data will need to be re-encrypted with the new key');
        
        return {
            rotated: true,
            timestamp: Date.now(),
            requiresReEncryption: true
        };
    }

    /**
     * Verify data integrity
     */
    verifyIntegrity(encryptedData) {
        try {
            const decrypted = this.decrypt(encryptedData);
            return {
                valid: true,
                size: decrypted.length,
                timestamp: encryptedData.timestamp
            };
        } catch (error) {
            return {
                valid: false,
                error: error.message
            };
        }
    }

    /**
     * Get encryption status and health
     */
    getEncryptionHealth() {
        return {
            masterKeyInitialized: !!this.masterKey,
            algorithm: this.algorithm,
            keyLength: this.keyLength,
            environmentKeySet: !!process.env.ENCRYPTION_KEY,
            status: this.masterKey ? 'healthy' : 'degraded'
        };
    }
}

// Create global instance
const configEncryption = new ConfigEncryption();

module.exports = {
    ConfigEncryption,
    configEncryption
};
