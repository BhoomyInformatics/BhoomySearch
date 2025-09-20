/**
 * Duplicate Content Reporting Dashboard
 * 
 * Provides comprehensive reporting and visualization tools for duplicate content analysis
 */

const fs = require('fs');
const path = require('path');
const { logger } = require('./logger');

class DuplicateContentDashboard {
    constructor(duplicateChecker, options = {}) {
        this.duplicateChecker = duplicateChecker;
        this.options = {
            reportFormat: 'json', // json, html, csv
            includeDetailedClusters: true,
            includeRecommendations: true,
            maxClusterDetails: 100,
            outputDirectory: './reports/duplicate-content',
            ...options
        };
        
        // Ensure output directory exists
        this.ensureOutputDirectory();
        
        logger.info('Duplicate Content Dashboard initialized', {
            service: 'DuplicateContentDashboard',
            options: this.options
        });
    }

    /**
     * Generate comprehensive duplicate content report
     */
    async generateReport(format = null) {
        const reportFormat = format || this.options.reportFormat;
        
        try {
            logger.info('Generating duplicate content report', {
                service: 'DuplicateContentDashboard',
                format: reportFormat
            });

            // Get comprehensive data
            const reportData = await this.collectReportData();
            
            // Generate report in requested format
            let reportOutput;
            switch (reportFormat.toLowerCase()) {
                case 'html':
                    reportOutput = await this.generateHtmlReport(reportData);
                    break;
                case 'csv':
                    reportOutput = await this.generateCsvReport(reportData);
                    break;
                case 'json':
                default:
                    reportOutput = await this.generateJsonReport(reportData);
                    break;
            }
            
            // Save report to file
            const fileName = this.generateReportFileName(reportFormat);
            const filePath = await this.saveReport(reportOutput, fileName, reportFormat);
            
            logger.info('Duplicate content report generated successfully', {
                service: 'DuplicateContentDashboard',
                format: reportFormat,
                filePath,
                summary: reportData.summary
            });

            return {
                success: true,
                filePath,
                format: reportFormat,
                summary: reportData.summary,
                reportData: reportFormat === 'json' ? reportData : null
            };

        } catch (error) {
            logger.error('Failed to generate duplicate content report', {
                service: 'DuplicateContentDashboard',
                error: error.message,
                format: reportFormat
            });
            throw error;
        }
    }

    /**
     * Collect comprehensive report data
     */
    async collectReportData() {
        const duplicateReport = this.duplicateChecker.getDuplicateContentReport();
        const globalStats = this.duplicateChecker.getGlobalStats();
        
        // Enhanced analysis
        const analysis = {
            duplicateEfficiency: this.calculateDuplicateEfficiency(duplicateReport),
            contentQuality: this.analyzeContentQuality(duplicateReport),
            sitePriorities: this.calculateSitePriorities(duplicateReport.siteReports),
            clusterAnalysis: this.analyzeContentClusters(duplicateReport.duplicateClusters),
            trends: this.analyzeTrends(duplicateReport)
        };

        return {
            generatedAt: new Date().toISOString(),
            summary: {
                ...duplicateReport.summary,
                reportVersion: '1.0',
                analysisDepth: 'comprehensive'
            },
            globalStats,
            siteReports: duplicateReport.siteReports,
            duplicateClusters: this.options.includeDetailedClusters ? 
                duplicateReport.duplicateClusters.slice(0, this.options.maxClusterDetails) : 
                duplicateReport.duplicateClusters.length,
            recommendations: this.options.includeRecommendations ? 
                duplicateReport.recommendations : [],
            analysis,
            performance: duplicateReport.performance
        };
    }

    /**
     * Calculate duplicate detection efficiency metrics
     */
    calculateDuplicateEfficiency(report) {
        const totalContent = report.summary.totalSites > 0 ? 
            report.siteReports.reduce((sum, site) => sum + site.totalUrls, 0) : 0;
        
        const totalDuplicates = report.siteReports.reduce((sum, site) => sum + site.duplicatesDetected, 0);
        const totalClusters = report.summary.totalClusters;
        
        return {
            overallEfficiency: totalContent > 0 ? 
                ((totalDuplicates / totalContent) * 100).toFixed(2) + '%' : '0%',
            contentSavingsRatio: totalContent > 0 ? 
                ((report.summary.contentSaved / totalContent) * 100).toFixed(2) + '%' : '0%',
            clusterUtilization: totalDuplicates > 0 ? 
                ((totalClusters / totalDuplicates) * 100).toFixed(2) + '%' : '0%',
            avgDuplicatesPerSite: report.summary.totalSites > 0 ? 
                (totalDuplicates / report.summary.totalSites).toFixed(1) : '0',
            processingEfficiency: report.performance.avgProcessingTime || 0
        };
    }

    /**
     * Analyze content quality metrics
     */
    analyzeContentQuality(report) {
        const qualityBuckets = {
            high: { count: 0, threshold: '>80%' },
            medium: { count: 0, threshold: '50-80%' },
            low: { count: 0, threshold: '<50%' }
        };

        report.siteReports.forEach(site => {
            const duplicateRate = parseFloat(site.duplicateRate.replace('%', ''));
            
            if (duplicateRate < 20) {
                qualityBuckets.high.count++;
            } else if (duplicateRate < 50) {
                qualityBuckets.medium.count++;
            } else {
                qualityBuckets.low.count++;
            }
        });

        return {
            qualityDistribution: qualityBuckets,
            avgUniqueContentRatio: report.siteReports.length > 0 ? 
                (report.siteReports.reduce((sum, site) => {
                    const rate = 100 - parseFloat(site.duplicateRate.replace('%', ''));
                    return sum + rate;
                }, 0) / report.siteReports.length).toFixed(2) + '%' : '0%',
            topPerformingSites: report.siteReports
                .filter(site => parseFloat(site.duplicateRate.replace('%', '')) < 10)
                .slice(0, 5)
                .map(site => ({
                    siteId: site.siteId,
                    duplicateRate: site.duplicateRate,
                    totalUrls: site.totalUrls
                })),
            improvementNeeded: report.siteReports
                .filter(site => parseFloat(site.duplicateRate.replace('%', '')) > 30)
                .slice(0, 5)
                .map(site => ({
                    siteId: site.siteId,
                    duplicateRate: site.duplicateRate,
                    totalUrls: site.totalUrls
                }))
        };
    }

    /**
     * Calculate site crawling priorities
     */
    calculateSitePriorities(siteReports) {
        return siteReports.map(site => {
            const duplicateRate = parseFloat(site.duplicateRate.replace('%', ''));
            let priority = 'medium';
            let reason = '';

            if (duplicateRate > 50) {
                priority = 'low';
                reason = 'High duplicate content rate - review crawling strategy';
            } else if (duplicateRate < 10 && site.totalUrls > 100) {
                priority = 'high';
                reason = 'Low duplicate rate with substantial content - good crawling target';
            } else if (site.totalUrls < 50) {
                priority = 'medium';
                reason = 'Small site - standard priority';
            } else {
                priority = 'medium';
                reason = 'Moderate duplicate rate - standard crawling';
            }

            return {
                siteId: site.siteId,
                priority,
                reason,
                score: this.calculateSiteScore(site)
            };
        }).sort((a, b) => b.score - a.score);
    }

    /**
     * Calculate site quality score
     */
    calculateSiteScore(site) {
        const duplicateRate = parseFloat(site.duplicateRate.replace('%', ''));
        const uniqueRate = 100 - duplicateRate;
        const contentVolume = Math.min(site.totalUrls / 1000, 1); // Normalized to 0-1
        
        return (uniqueRate * 0.7) + (contentVolume * 100 * 0.3);
    }

    /**
     * Analyze content clusters
     */
    analyzeContentClusters(clusters) {
        if (!Array.isArray(clusters)) {
            return { error: 'Cluster data not available' };
        }

        const clusterSizes = clusters.map(c => c.memberCount);
        const avgSimilarities = clusters.map(c => parseFloat(c.avgSimilarity)).filter(s => !isNaN(s));

        return {
            totalClusters: clusters.length,
            avgClusterSize: clusterSizes.length > 0 ? 
                (clusterSizes.reduce((sum, size) => sum + size, 0) / clusterSizes.length).toFixed(1) : 0,
            largestCluster: Math.max(...clusterSizes, 0),
            avgSimilarity: avgSimilarities.length > 0 ? 
                (avgSimilarities.reduce((sum, sim) => sum + sim, 0) / avgSimilarities.length).toFixed(3) : 0,
            clusterSizeDistribution: {
                small: clusterSizes.filter(s => s <= 3).length,
                medium: clusterSizes.filter(s => s > 3 && s <= 10).length,
                large: clusterSizes.filter(s => s > 10).length
            },
            mergeCandidates: clusters.filter(c => c.memberCount > 5 && !c.hasMergedContent).length
        };
    }

    /**
     * Analyze trends (simplified version)
     */
    analyzeTrends(report) {
        // Note: In a real implementation, this would analyze historical data
        // For now, we'll provide current state analysis
        
        return {
            duplicateDetectionTrend: 'stable',
            contentVolumeTrend: 'increasing',
            efficiencyTrend: 'improving',
            recommendations: [
                'Continue monitoring sites with high duplicate rates',
                'Consider implementing automatic content merging for large clusters',
                'Review crawling frequency for sites with low unique content'
            ]
        };
    }

    /**
     * Generate HTML report
     */
    async generateHtmlReport(data) {
        const htmlTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Duplicate Content Analysis Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; color: #333; border-bottom: 2px solid #007bff; padding-bottom: 20px; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .stat-card { background: #f8f9fa; padding: 20px; border-radius: 6px; text-align: center; border-left: 4px solid #007bff; }
        .stat-value { font-size: 2em; font-weight: bold; color: #007bff; }
        .stat-label { color: #666; margin-top: 5px; }
        .section { margin-bottom: 30px; }
        .section h2 { color: #333; border-bottom: 1px solid #ddd; padding-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f8f9fa; font-weight: bold; }
        .recommendation { background: #e3f2fd; padding: 15px; border-radius: 4px; margin: 10px 0; border-left: 4px solid #2196f3; }
        .priority-high { background-color: #ffebee; border-left-color: #f44336; }
        .priority-medium { background-color: #fff3e0; border-left-color: #ff9800; }
        .priority-low { background-color: #e8f5e8; border-left-color: #4caf50; }
        .chart-placeholder { background: #f0f0f0; height: 200px; display: flex; align-items: center; justify-content: center; border-radius: 4px; margin: 15px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔍 Duplicate Content Analysis Report</h1>
            <p>Generated on ${new Date(data.generatedAt).toLocaleString()}</p>
        </div>

        <div class="summary">
            <div class="stat-card">
                <div class="stat-value">${data.summary.totalSites || 0}</div>
                <div class="stat-label">Total Sites</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${data.summary.totalClusters || 0}</div>
                <div class="stat-label">Content Clusters</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${data.summary.contentSaved || 0}</div>
                <div class="stat-label">Duplicates Avoided</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${data.analysis.duplicateEfficiency.overallEfficiency}</div>
                <div class="stat-label">Duplicate Rate</div>
            </div>
        </div>

        <div class="section">
            <h2>📊 Performance Metrics</h2>
            <div class="summary">
                <div class="stat-card">
                    <div class="stat-value">${data.performance.avgProcessingTime || 0}ms</div>
                    <div class="stat-label">Avg Processing Time</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${data.performance.duplicateRate || '0%'}</div>
                    <div class="stat-label">Duplicate Detection Rate</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${data.performance.similarityRate || '0%'}</div>
                    <div class="stat-label">Similarity Detection Rate</div>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>🏆 Top Performing Sites</h2>
            <table>
                <thead>
                    <tr>
                        <th>Site ID</th>
                        <th>Total URLs</th>
                        <th>Duplicate Rate</th>
                        <th>Unique Content</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.analysis.contentQuality.topPerformingSites.map(site => `
                        <tr>
                            <td>${site.siteId}</td>
                            <td>${site.totalUrls}</td>
                            <td>${site.duplicateRate}</td>
                            <td>${(100 - parseFloat(site.duplicateRate.replace('%', ''))).toFixed(1)}%</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <div class="section">
            <h2>⚠️ Sites Needing Improvement</h2>
            <table>
                <thead>
                    <tr>
                        <th>Site ID</th>
                        <th>Total URLs</th>
                        <th>Duplicate Rate</th>
                        <th>Action Needed</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.analysis.contentQuality.improvementNeeded.map(site => `
                        <tr>
                            <td>${site.siteId}</td>
                            <td>${site.totalUrls}</td>
                            <td style="color: #f44336; font-weight: bold;">${site.duplicateRate}</td>
                            <td>Review crawling strategy</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <div class="section">
            <h2>🎯 Recommendations</h2>
            ${data.recommendations.map(rec => `
                <div class="recommendation priority-${rec.priority}">
                    <strong>${rec.type.replace(/_/g, ' ')}</strong>: ${rec.description}
                    <br><small><strong>Action:</strong> ${rec.action}</small>
                </div>
            `).join('')}
        </div>

        <div class="section">
            <h2>📈 Cluster Analysis</h2>
            <div class="summary">
                <div class="stat-card">
                    <div class="stat-value">${data.analysis.clusterAnalysis.totalClusters}</div>
                    <div class="stat-label">Total Clusters</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${data.analysis.clusterAnalysis.avgClusterSize}</div>
                    <div class="stat-label">Avg Cluster Size</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${data.analysis.clusterAnalysis.avgSimilarity}</div>
                    <div class="stat-label">Avg Similarity</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${data.analysis.clusterAnalysis.mergeCandidates}</div>
                    <div class="stat-label">Merge Candidates</div>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>📋 Site Priority Rankings</h2>
            <table>
                <thead>
                    <tr>
                        <th>Site ID</th>
                        <th>Priority</th>
                        <th>Score</th>
                        <th>Reason</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.analysis.sitePriorities.slice(0, 10).map(site => `
                        <tr>
                            <td>${site.siteId}</td>
                            <td><span class="priority-${site.priority}" style="padding: 4px 8px; border-radius: 4px; color: white; background: ${site.priority === 'high' ? '#4caf50' : site.priority === 'medium' ? '#ff9800' : '#f44336'};">${site.priority.toUpperCase()}</span></td>
                            <td>${site.score.toFixed(1)}</td>
                            <td>${site.reason}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    </div>
</body>
</html>`;

        return htmlTemplate;
    }

    /**
     * Generate CSV report
     */
    async generateCsvReport(data) {
        const csvRows = [];
        
        // Header
        csvRows.push([
            'Report Generated',
            new Date(data.generatedAt).toISOString()
        ]);
        csvRows.push([]); // Empty row
        
        // Summary
        csvRows.push(['SUMMARY']);
        csvRows.push(['Total Sites', data.summary.totalSites || 0]);
        csvRows.push(['Total Clusters', data.summary.totalClusters || 0]);
        csvRows.push(['Content Saved', data.summary.contentSaved || 0]);
        csvRows.push(['Overall Efficiency', data.analysis.duplicateEfficiency.overallEfficiency]);
        csvRows.push([]); // Empty row
        
        // Site Reports
        csvRows.push(['SITE REPORTS']);
        csvRows.push(['Site ID', 'Total URLs', 'Duplicates Detected', 'Duplicate Rate', 'Priority', 'Score']);
        
        data.siteReports.forEach((site, index) => {
            const priority = data.analysis.sitePriorities[index];
            csvRows.push([
                site.siteId,
                site.totalUrls,
                site.duplicatesDetected,
                site.duplicateRate,
                priority ? priority.priority : 'N/A',
                priority ? priority.score.toFixed(1) : 'N/A'
            ]);
        });
        
        return csvRows.map(row => row.join(',')).join('\n');
    }

    /**
     * Generate JSON report
     */
    async generateJsonReport(data) {
        return JSON.stringify(data, null, 2);
    }

    /**
     * Generate report file name
     */
    generateReportFileName(format) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
        return `duplicate-content-report-${timestamp}.${format.toLowerCase()}`;
    }

    /**
     * Save report to file
     */
    async saveReport(content, fileName, format) {
        const filePath = path.join(this.options.outputDirectory, fileName);
        
        try {
            await fs.promises.writeFile(filePath, content, 'utf8');
            return filePath;
        } catch (error) {
            logger.error('Failed to save report file', {
                service: 'DuplicateContentDashboard',
                filePath,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Ensure output directory exists
     */
    ensureOutputDirectory() {
        try {
            if (!fs.existsSync(this.options.outputDirectory)) {
                fs.mkdirSync(this.options.outputDirectory, { recursive: true });
            }
        } catch (error) {
            logger.warn('Could not create output directory', {
                service: 'DuplicateContentDashboard',
                directory: this.options.outputDirectory,
                error: error.message
            });
        }
    }

    /**
     * Get real-time duplicate statistics
     */
    getRealTimeStats() {
        return {
            timestamp: new Date().toISOString(),
            globalStats: this.duplicateChecker.getGlobalStats(),
            currentActivity: {
                activeSites: this.duplicateChecker.siteCaches.size,
                processingEnabled: this.duplicateChecker.options.enableAdvancedDuplication
            }
        };
    }

    /**
     * Export specific cluster data
     */
    async exportClusterData(clusterId, format = 'json') {
        const clusterDetails = this.duplicateChecker.getContentClusterDetails(clusterId);
        
        if (!clusterDetails) {
            throw new Error(`Cluster ${clusterId} not found`);
        }

        const exportData = {
            clusterId,
            exportedAt: new Date().toISOString(),
            clusterDetails,
            memberDetails: []
        };

        // Get details for each cluster member
        for (const memberHash of clusterDetails.members) {
            const fingerprint = this.duplicateChecker.enhancedDuplicateManager.contentFingerprints.get(memberHash);
            if (fingerprint) {
                exportData.memberDetails.push({
                    contentHash: memberHash,
                    metadata: fingerprint.metadata,
                    components: {
                        title: fingerprint.components.title,
                        description: fingerprint.components.description,
                        wordCount: fingerprint.components.wordCount
                    }
                });
            }
        }

        const fileName = `cluster-${clusterId}-${Date.now()}.${format}`;
        let content;

        switch (format.toLowerCase()) {
            case 'csv':
                const csvRows = [
                    ['Content Hash', 'Title', 'Description', 'Word Count', 'URL'],
                    ...exportData.memberDetails.map(member => [
                        member.contentHash,
                        member.components.title || '',
                        member.components.description || '',
                        member.components.wordCount || 0,
                        member.metadata.url || ''
                    ])
                ];
                content = csvRows.map(row => row.join(',')).join('\n');
                break;
            case 'json':
            default:
                content = JSON.stringify(exportData, null, 2);
                break;
        }

        const filePath = await this.saveReport(content, fileName, format);
        return { filePath, exportData };
    }
}

module.exports = { DuplicateContentDashboard };
