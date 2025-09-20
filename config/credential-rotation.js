/**
 * Credential Rotation System
 * Handles automatic rotation of passwords and API keys
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { envManager } = require('./env-manager');

class CredentialRotationManager {
    constructor() {
        this.rotationSchedule = {
            daily: 24 * 60 * 60 * 1000,      // 24 hours
            weekly: 7 * 24 * 60 * 60 * 1000,  // 7 days
            monthly: 30 * 24 * 60 * 60 * 1000 // 30 days
        };
        
        this.rotationHistory = new Map();
        this.rotationRules = new Map();
        
        // Load rotation history
        this.loadRotationHistory();
        
        // Set up default rotation rules
        this.setupDefaultRules();
    }

    /**
     * Set up default rotation rules for different credential types
     */
    setupDefaultRules() {
        // High-security credentials (daily rotation)
        this.setRotationRule('ELASTICSEARCH_PASSWORD', {
            frequency: 'daily',
            strength: 'high',
            notify: true,
            backup: true
        });
        
        this.setRotationRule('DB_PASSWORD', {
            frequency: 'weekly',
            strength: 'high',
            notify: true,
            backup: true
        });
        
        // Medium-security credentials (weekly rotation)
        this.setRotationRule('JWT_SECRET', {
            frequency: 'weekly',
            strength: 'medium',
            notify: true,
            backup: false
        });
        
        this.setRotationRule('SESSION_SECRET', {
            frequency: 'weekly',
            strength: 'medium',
            notify: true,
            backup: false
        });
        
        // API keys (monthly rotation)
        this.setRotationRule('YOUTUBE_API_KEY', {
            frequency: 'monthly',
            strength: 'external', // Indicates manual rotation required
            notify: true,
            backup: false
        });
    }

    /**
     * Set rotation rule for a credential
     */
    setRotationRule(credential, rule) {
        this.rotationRules.set(credential, {
            frequency: rule.frequency || 'weekly',
            strength: rule.strength || 'medium',
            notify: rule.notify !== false,
            backup: rule.backup !== false,
            lastRotated: this.rotationHistory.get(credential)?.lastRotated || null,
            nextRotation: this.calculateNextRotation(rule.frequency)
        });
    }

    /**
     * Calculate next rotation time based on frequency
     */
    calculateNextRotation(frequency) {
        const now = Date.now();
        const interval = this.rotationSchedule[frequency] || this.rotationSchedule.weekly;
        return now + interval;
    }

    /**
     * Generate secure password based on strength requirements
     */
    generatePassword(strength = 'medium') {
        let length;
        let charset;
        
        switch (strength) {
            case 'high':
                length = 64;
                charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
                break;
                
            case 'medium':
                length = 32;
                charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
                break;
                
            case 'low':
                length = 16;
                charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                break;
                
            default:
                length = 32;
                charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        }
        
        const array = new Uint8Array(length);
        crypto.getRandomValues(array);
        
        let password = '';
        for (let i = 0; i < length; i++) {
            password += charset[array[i] % charset.length];
        }
        
        return password;
    }

    /**
     * Rotate a specific credential
     */
    async rotateCredential(credentialName, options = {}) {
        console.log(`🔄 Starting rotation for ${credentialName}`);
        
        const rule = this.rotationRules.get(credentialName);
        if (!rule) {
            throw new Error(`No rotation rule found for ${credentialName}`);
        }
        
        // Skip external credentials (require manual rotation)
        if (rule.strength === 'external') {
            console.log(`⚠️  ${credentialName} requires manual rotation (external API key)`);
            this.sendNotification(credentialName, 'manual_rotation_required');
            return null;
        }
        
        // Get current value for backup
        const currentValue = envManager.get(credentialName);
        
        // Backup current credential if required
        if (rule.backup && currentValue) {
            await this.backupCredential(credentialName, currentValue);
        }
        
        // Generate new password
        const newPassword = this.generatePassword(rule.strength);
        
        // Update environment
        envManager.config[credentialName] = newPassword;
        
        // Save to encrypted storage
        if (envManager.sensitiveVars.has(credentialName)) {
            await envManager.saveEncryptedEnv({ [credentialName]: newPassword });
        }
        
        // Update rotation history
        this.updateRotationHistory(credentialName, {
            rotatedAt: Date.now(),
            oldPasswordHash: currentValue ? crypto.createHash('sha256').update(currentValue).digest('hex').substring(0, 8) : null,
            newPasswordHash: crypto.createHash('sha256').update(newPassword).digest('hex').substring(0, 8),
            reason: options.reason || 'scheduled_rotation'
        });
        
        // Update next rotation time
        rule.lastRotated = Date.now();
        rule.nextRotation = this.calculateNextRotation(rule.frequency);
        
        // Send notification
        if (rule.notify) {
            this.sendNotification(credentialName, 'rotated_successfully');
        }
        
        console.log(`✅ Successfully rotated ${credentialName}`);
        
        return {
            credential: credentialName,
            rotatedAt: Date.now(),
            newPassword: newPassword,
            nextRotation: rule.nextRotation
        };
    }

    /**
     * Backup credential to secure storage
     */
    async backupCredential(credentialName, value) {
        const backupDir = path.resolve(process.cwd(), 'backups', 'credentials');
        
        // Ensure backup directory exists
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }
        
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const backupFile = path.join(backupDir, `${credentialName}_${timestamp}.backup`);
        
        // Encrypt the backup
        const encrypted = envManager.encrypt(value);
        
        fs.writeFileSync(backupFile, JSON.stringify({
            credential: credentialName,
            encryptedValue: encrypted,
            backedUpAt: Date.now(),
            hash: crypto.createHash('sha256').update(value).digest('hex').substring(0, 8)
        }, null, 2));
        
        console.log(`💾 Backed up ${credentialName} to ${backupFile}`);
    }

    /**
     * Update rotation history
     */
    updateRotationHistory(credentialName, rotationData) {
        const history = this.rotationHistory.get(credentialName) || { rotations: [] };
        
        history.rotations.push(rotationData);
        history.lastRotated = rotationData.rotatedAt;
        
        // Keep only last 10 rotations
        if (history.rotations.length > 10) {
            history.rotations = history.rotations.slice(-10);
        }
        
        this.rotationHistory.set(credentialName, history);
        this.saveRotationHistory();
    }

    /**
     * Load rotation history from file
     */
    loadRotationHistory() {
        const historyFile = path.resolve(process.cwd(), 'config', 'rotation-history.json');
        
        if (fs.existsSync(historyFile)) {
            try {
                const data = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
                this.rotationHistory = new Map(Object.entries(data));
                console.log('✅ Loaded rotation history');
            } catch (error) {
                console.warn('⚠️  Could not load rotation history:', error.message);
            }
        }
    }

    /**
     * Save rotation history to file
     */
    saveRotationHistory() {
        const historyFile = path.resolve(process.cwd(), 'config', 'rotation-history.json');
        
        try {
            const data = Object.fromEntries(this.rotationHistory);
            fs.writeFileSync(historyFile, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('❌ Failed to save rotation history:', error.message);
        }
    }

    /**
     * Check which credentials need rotation
     */
    getCredentialsNeedingRotation() {
        const now = Date.now();
        const needRotation = [];
        
        for (const [credential, rule] of this.rotationRules) {
            if (rule.nextRotation && now >= rule.nextRotation) {
                needRotation.push({
                    credential,
                    overdue: now - rule.nextRotation,
                    frequency: rule.frequency
                });
            }
        }
        
        return needRotation;
    }

    /**
     * Rotate all credentials that are due
     */
    async rotateAllDue() {
        const needRotation = this.getCredentialsNeedingRotation();
        
        if (needRotation.length === 0) {
            console.log('✅ No credentials need rotation at this time');
            return [];
        }
        
        console.log(`🔄 Found ${needRotation.length} credentials needing rotation`);
        
        const results = [];
        
        for (const { credential } of needRotation) {
            try {
                const result = await this.rotateCredential(credential);
                if (result) {
                    results.push(result);
                }
            } catch (error) {
                console.error(`❌ Failed to rotate ${credential}:`, error.message);
                results.push({
                    credential,
                    error: error.message,
                    rotatedAt: Date.now()
                });
            }
        }
        
        return results;
    }

    /**
     * Send notification about rotation
     */
    sendNotification(credential, event) {
        // In a real implementation, this would send emails, Slack messages, etc.
        const messages = {
            rotated_successfully: `✅ Credential ${credential} has been rotated successfully`,
            manual_rotation_required: `⚠️  Manual rotation required for ${credential}`,
            rotation_failed: `❌ Failed to rotate ${credential}`,
            rotation_overdue: `🚨 Credential ${credential} rotation is overdue`
        };
        
        const message = messages[event] || `Credential rotation event: ${event}`;
        console.log(`📧 NOTIFICATION: ${message}`);
        
        // TODO: Implement actual notification system (email, Slack, etc.)
    }

    /**
     * Get rotation status report
     */
    getRotationStatus() {
        const status = {
            totalCredentials: this.rotationRules.size,
            needRotation: this.getCredentialsNeedingRotation().length,
            credentials: {}
        };
        
        for (const [credential, rule] of this.rotationRules) {
            const history = this.rotationHistory.get(credential);
            
            status.credentials[credential] = {
                frequency: rule.frequency,
                strength: rule.strength,
                lastRotated: rule.lastRotated,
                nextRotation: rule.nextRotation,
                rotationCount: history?.rotations?.length || 0,
                needsRotation: rule.nextRotation ? Date.now() >= rule.nextRotation : true
            };
        }
        
        return status;
    }

    /**
     * Emergency rotation of all credentials
     */
    async emergencyRotateAll() {
        console.log('🚨 EMERGENCY ROTATION: Rotating all credentials immediately');
        
        const results = [];
        
        for (const [credential] of this.rotationRules) {
            try {
                const result = await this.rotateCredential(credential, { reason: 'emergency_rotation' });
                if (result) {
                    results.push(result);
                }
            } catch (error) {
                console.error(`❌ Emergency rotation failed for ${credential}:`, error.message);
                results.push({
                    credential,
                    error: error.message,
                    rotatedAt: Date.now()
                });
            }
        }
        
        console.log(`🚨 Emergency rotation completed: ${results.length} credentials processed`);
        
        return results;
    }
}

// Create global instance
const credentialRotation = new CredentialRotationManager();

module.exports = {
    CredentialRotationManager,
    credentialRotation
};
