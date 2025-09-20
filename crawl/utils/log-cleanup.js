const fs = require('fs');
const path = require('path');
const { logger } = require('./logger');

class LogCleanup {
    constructor() {
        this.logDir = path.join(__dirname, '../logs');
        this.maxLogSize = 10 * 1024 * 1024; // 10MB
        this.maxLogAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    }

    async cleanupLogs() {
        try {
            logger.info('Starting log cleanup process');
            
            if (!fs.existsSync(this.logDir)) {
                logger.warn('Log directory does not exist, creating it');
                fs.mkdirSync(this.logDir, { recursive: true });
                return;
            }

            const files = fs.readdirSync(this.logDir);
            let cleanedFiles = 0;
            let totalSizeFreed = 0;

            for (const file of files) {
                const filePath = path.join(this.logDir, file);
                const stats = fs.statSync(filePath);
                
                // Check if file is too old
                const isOld = (Date.now() - stats.mtime.getTime()) > this.maxLogAge;
                
                // Check if file is too large
                const isLarge = stats.size > this.maxLogSize;
                
                if (isOld) {
                    logger.info(`Removing old log file: ${file} (${(stats.size / 1024 / 1024).toFixed(2)}MB)`);
                    fs.unlinkSync(filePath);
                    cleanedFiles++;
                    totalSizeFreed += stats.size;
                } else if (isLarge) {
                    logger.info(`Truncating large log file: ${file} (${(stats.size / 1024 / 1024).toFixed(2)}MB)`);
                    await this.truncateLogFile(filePath);
                    cleanedFiles++;
                    totalSizeFreed += stats.size / 2; // Assume we freed half the size
                }
            }

            logger.info(`Log cleanup completed`, {
                filesProcessed: cleanedFiles,
                sizeFreed: `${(totalSizeFreed / 1024 / 1024).toFixed(2)}MB`
            });

        } catch (error) {
            logger.error('Error during log cleanup', { error: error.message });
        }
    }

    async truncateLogFile(filePath) {
        try {
            const data = fs.readFileSync(filePath, 'utf8');
            const lines = data.split('\n');
            
            // Keep only the last 1000 lines
            const truncatedLines = lines.slice(-1000);
            const truncatedData = truncatedLines.join('\n');
            
            fs.writeFileSync(filePath, truncatedData);
            logger.info(`Truncated log file: ${path.basename(filePath)} to last 1000 lines`);
        } catch (error) {
            logger.error(`Error truncating log file: ${filePath}`, { error: error.message });
        }
    }

    async emergencyCleanup() {
        try {
            logger.warn('Performing emergency log cleanup due to excessive log size');
            
            const files = fs.readdirSync(this.logDir);
            
            for (const file of files) {
                const filePath = path.join(this.logDir, file);
                const stats = fs.statSync(filePath);
                
                if (file.includes('debug') && stats.size > 5 * 1024 * 1024) { // 5MB
                    logger.warn(`Emergency cleanup: removing large debug file ${file}`);
                    fs.unlinkSync(filePath);
                }
            }
        } catch (error) {
            logger.error('Error during emergency cleanup', { error: error.message });
        }
    }

    getLogStats() {
        try {
            const files = fs.readdirSync(this.logDir);
            const stats = {};
            let totalSize = 0;

            for (const file of files) {
                const filePath = path.join(this.logDir, file);
                const fileStat = fs.statSync(filePath);
                
                stats[file] = {
                    size: fileStat.size,
                    sizeMB: (fileStat.size / 1024 / 1024).toFixed(2),
                    modified: fileStat.mtime
                };
                
                totalSize += fileStat.size;
            }

            return {
                files: stats,
                totalSize,
                totalSizeMB: (totalSize / 1024 / 1024).toFixed(2)
            };
        } catch (error) {
            logger.error('Error getting log stats', { error: error.message });
            return null;
        }
    }
}

// Auto-cleanup function that can be called periodically
async function autoCleanup() {
    const cleanup = new LogCleanup();
    const stats = cleanup.getLogStats();
    
    if (stats && stats.totalSize > 50 * 1024 * 1024) { // 50MB total
        logger.warn('Log files exceed 50MB, performing cleanup');
        await cleanup.cleanupLogs();
    }
}

module.exports = {
    LogCleanup,
    autoCleanup
}; 