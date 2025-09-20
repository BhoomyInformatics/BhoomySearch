/**
 * SEO Monitoring and Optimization Tools
 */

// import { generateStructuredData, seoAnalytics } from '../hooks/useSEO';

interface SEOMetrics {
  pageLoadTime: number;
  timeToFirstByte: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  cumulativeLayoutShift: number;
  firstInputDelay: number;
  metaTagsScore: number;
  accessibilityScore: number;
  mobileResponsiveness: number;
  structuredDataPresent: boolean;
  canonicalUrl: string;
  robotsMetaTag: string;
  httpStatusCode: number;
  redirectChain: string[];
  socialMetaTags: number;
  imageOptimization: number;
  internalLinks: number;
  externalLinks: number;
  headingStructure: Array<{level: number, text: string}>;
  wordCount: number;
  readabilityScore: number;
}

interface SEORecommendation {
  type: 'critical' | 'important' | 'suggestion';
  category: 'performance' | 'content' | 'technical' | 'accessibility' | 'mobile';
  issue: string;
  recommendation: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'low' | 'medium' | 'high';
  resources?: string[];
}

interface SEOAuditResult {
  url: string;
  timestamp: string;
  score: number;
  metrics: SEOMetrics;
  recommendations: SEORecommendation[];
  competitorComparison?: CompetitorMetrics[];
  historicalData?: HistoricalSEOData[];
}

interface CompetitorMetrics {
  domain: string;
  score: number;
  strengths: string[];
  weaknesses: string[];
}

interface HistoricalSEOData {
  date: string;
  score: number;
  metrics: Partial<SEOMetrics>;
}

/**
 * Comprehensive SEO monitoring and optimization system
 */
export class SEOMonitor {
  private performanceObserver: PerformanceObserver | null = null;
  private metricsHistory: HistoricalSEOData[] = [];
  private config = {
    trackingEnabled: true,
    detailedAnalytics: true,
    competitorTracking: false,
    automaticReporting: true,
    alertThresholds: {
      pageSpeed: 3000, // 3 seconds
      metaScore: 80,
      accessibilityScore: 90,
      overallScore: 85
    }
  };

  constructor(config?: Partial<typeof SEOMonitor.prototype.config>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    this.initializeMonitoring();
  }

  /**
   * Initialize performance monitoring
   */
  private initializeMonitoring() {
    if (!this.config.trackingEnabled) return;

    // Monitor Core Web Vitals
    this.setupWebVitalsMonitoring();
    
    // Monitor page changes for SPA
    this.setupPageChangeMonitoring();
    
    // Setup automatic audits
    if (this.config.automaticReporting) {
      this.setupAutomaticAudits();
    }

    console.log('🔍 SEO monitoring initialized');
  }

  /**
   * Setup Core Web Vitals monitoring
   */
  private setupWebVitalsMonitoring() {
    try {
      // First Contentful Paint
      const fcpObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            this.recordMetric('firstContentfulPaint', entry.startTime);
          }
        }
      });
      fcpObserver.observe({ entryTypes: ['paint'] });

      // Largest Contentful Paint
      const lcpObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.recordMetric('largestContentfulPaint', (entry as any).startTime);
        }
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

      // First Input Delay
      const fidObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.recordMetric('firstInputDelay', (entry as any).processingStart - entry.startTime);
        }
      });
      fidObserver.observe({ entryTypes: ['first-input'] });

      // Cumulative Layout Shift
      const clsObserver = new PerformanceObserver((list) => {
        let clsValue = 0;
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
          }
        }
        this.recordMetric('cumulativeLayoutShift', clsValue);
      });
      clsObserver.observe({ entryTypes: ['layout-shift'] });

      this.performanceObserver = lcpObserver; // Keep reference for cleanup
    } catch (error) {
      console.warn('⚠️ Performance monitoring not supported:', error);
    }
  }

  /**
   * Setup page change monitoring for SPA
   */
  private setupPageChangeMonitoring() {
    let currentUrl = window.location.href;
    
    const checkUrlChange = () => {
      if (window.location.href !== currentUrl) {
        currentUrl = window.location.href;
        this.onPageChange();
      }
    };

    // Monitor URL changes
    setInterval(checkUrlChange, 1000);
    
    // Monitor history changes
    window.addEventListener('popstate', this.onPageChange);
    
    // Override pushState and replaceState
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = function(...args) {
      originalPushState.apply(history, args);
      setTimeout(() => checkUrlChange(), 0);
    };
    
    history.replaceState = function(...args) {
      originalReplaceState.apply(history, args);
      setTimeout(() => checkUrlChange(), 0);
    };
  }

  /**
   * Handle page changes
   */
  private onPageChange = () => {
    console.log('📄 Page changed, triggering SEO audit');
    setTimeout(() => {
      this.auditCurrentPage();
    }, 1000); // Allow page to render
  };

  /**
   * Setup automatic audits
   */
  private setupAutomaticAudits() {
    // Audit on page load
    window.addEventListener('load', () => {
      setTimeout(() => this.auditCurrentPage(), 2000);
    });

    // Periodic audits
    setInterval(() => {
      if (this.config.detailedAnalytics) {
        this.auditCurrentPage();
      }
    }, 300000); // Every 5 minutes
  }

  /**
   * Record performance metric
   */
  private recordMetric(name: keyof SEOMetrics, value: number) {
    const entry = {
      name,
      value,
      timestamp: Date.now(),
      url: window.location.href
    };

    console.log(`📊 SEO Metric recorded: ${name} = ${value.toFixed(2)}ms`);
    
    // Store in local storage for persistence
    const stored = localStorage.getItem('seo-metrics') || '[]';
    const metrics = JSON.parse(stored);
    metrics.push(entry);
    
    // Keep only last 100 entries
    if (metrics.length > 100) {
      metrics.splice(0, metrics.length - 100);
    }
    
    localStorage.setItem('seo-metrics', JSON.stringify(metrics));
  }

  /**
   * Comprehensive SEO audit of current page
   */
  async auditCurrentPage(): Promise<SEOAuditResult> {
    const startTime = performance.now();
    console.log('🔍 Starting comprehensive SEO audit...');

    const metrics = await this.gatherMetrics();
    const recommendations = this.generateRecommendations(metrics);
    const score = this.calculateOverallScore(metrics);

    const result: SEOAuditResult = {
      url: window.location.href,
      timestamp: new Date().toISOString(),
      score,
      metrics,
      recommendations
    };

    // Store in history
    this.metricsHistory.push({
      date: new Date().toISOString(),
      score,
      metrics
    });

    // Check alert thresholds
    this.checkAlerts(result);

    const auditTime = performance.now() - startTime;
    console.log(`✅ SEO audit completed in ${auditTime.toFixed(2)}ms. Score: ${score}/100`);

    // Send to analytics if configured
    if (this.config.detailedAnalytics) {
      this.sendAnalytics(result);
    }

    return result;
  }

  /**
   * Gather comprehensive SEO metrics
   */
  private async gatherMetrics(): Promise<SEOMetrics> {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    
    return {
      // Performance metrics
      pageLoadTime: navigation ? navigation.loadEventEnd - navigation.fetchStart : 0,
      timeToFirstByte: navigation ? navigation.responseStart - navigation.fetchStart : 0,
      firstContentfulPaint: this.getMetricFromStorage('firstContentfulPaint') || 0,
      largestContentfulPaint: this.getMetricFromStorage('largestContentfulPaint') || 0,
      cumulativeLayoutShift: this.getMetricFromStorage('cumulativeLayoutShift') || 0,
      firstInputDelay: this.getMetricFromStorage('firstInputDelay') || 0,

      // SEO metrics
      metaTagsScore: this.auditMetaTags(),
      accessibilityScore: this.auditAccessibility(),
      mobileResponsiveness: this.auditMobileResponsiveness(),
      structuredDataPresent: this.checkStructuredData(),
      canonicalUrl: this.getCanonicalUrl(),
      robotsMetaTag: this.getRobotsMetaTag(),
      httpStatusCode: this.getHttpStatusCode(),
      redirectChain: await this.getRedirectChain(),
      socialMetaTags: this.auditSocialMetaTags(),
      imageOptimization: this.auditImageOptimization(),

      // Content metrics
      internalLinks: this.countInternalLinks(),
      externalLinks: this.countExternalLinks(),
      headingStructure: this.analyzeHeadingStructure(),
      wordCount: this.countWords(),
      readabilityScore: this.calculateReadabilityScore()
    };
  }

  /**
   * Get metric from storage
   */
  private getMetricFromStorage(name: string): number {
    const stored = localStorage.getItem('seo-metrics') || '[]';
    const metrics = JSON.parse(stored);
    const recent = metrics
      .filter((m: any) => m.name === name && m.url === window.location.href)
      .sort((a: any, b: any) => b.timestamp - a.timestamp)[0];
    
    return recent ? recent.value : 0;
  }

  /**
   * Audit meta tags
   */
  private auditMetaTags(): number {
    const requiredTags = [
      { selector: 'title', weight: 20 },
      { selector: 'meta[name="description"]', weight: 20 },
      { selector: 'meta[name="keywords"]', weight: 10 },
      { selector: 'link[rel="canonical"]', weight: 15 },
      { selector: 'meta[property="og:title"]', weight: 10 },
      { selector: 'meta[property="og:description"]', weight: 10 },
      { selector: 'meta[property="og:image"]', weight: 10 },
      { selector: 'meta[name="twitter:card"]', weight: 5 }
    ];

    let score = 0;
    requiredTags.forEach(tag => {
      const element = document.querySelector(tag.selector);
      if (element && element.getAttribute('content')?.trim()) {
        score += tag.weight;
      }
    });

    return Math.min(100, score);
  }

  /**
   * Audit accessibility
   */
  private auditAccessibility(): number {
    let score = 100;
    
    // Check images without alt text
    const imagesWithoutAlt = document.querySelectorAll('img:not([alt])').length;
    score -= imagesWithoutAlt * 5;

    // Check headings structure
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    if (headings.length === 0) score -= 20;

    // Check for skip links
    if (!document.querySelector('#skip-link, [href="#main-content"]')) {
      score -= 10;
    }

    // Check for ARIA labels
    const elementsWithAria = document.querySelectorAll('[aria-label], [aria-labelledby], [aria-describedby]').length;
    if (elementsWithAria === 0) score -= 15;

    // Check color contrast (simplified)
    const elementsWithLowContrast = this.checkColorContrast();
    score -= elementsWithLowContrast * 2;

    return Math.max(0, score);
  }

  /**
   * Check color contrast (simplified implementation)
   */
  private checkColorContrast(): number {
    // Simplified contrast check
    // In production, use a proper color contrast library
    let lowContrastElements = 0;
    
    const textElements = document.querySelectorAll('p, span, div, a, button');
    textElements.forEach(element => {
      const style = window.getComputedStyle(element);
      const backgroundColor = style.backgroundColor;
      const color = style.color;
      
      // Very basic check - in practice, use proper contrast calculation
      if (backgroundColor === color || 
          (backgroundColor === 'rgba(0, 0, 0, 0)' && color === 'rgb(255, 255, 255)')) {
        lowContrastElements++;
      }
    });

    return Math.min(lowContrastElements, 20); // Cap at 20
  }

  /**
   * Audit mobile responsiveness
   */
  private auditMobileResponsiveness(): number {
    let score = 100;

    // Check viewport meta tag
    const viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) score -= 30;

    // Check for responsive design indicators
    const hasMediaQueries = Array.from(document.styleSheets).some(sheet => {
      try {
        return Array.from(sheet.cssRules || []).some(rule => 
          rule.type === CSSRule.MEDIA_RULE
        );
      } catch {
        return false;
      }
    });
    
    if (!hasMediaQueries) score -= 20;

    // Check for touch-friendly elements
    const smallClickTargets = Array.from(document.querySelectorAll('button, a, input')).filter(el => {
      const rect = el.getBoundingClientRect();
      return rect.width < 44 || rect.height < 44;
    }).length;

    score -= Math.min(smallClickTargets * 5, 30);

    // Check for horizontal scrolling
    if (document.body.scrollWidth > window.innerWidth) {
      score -= 20;
    }

    return Math.max(0, score);
  }

  /**
   * Check for structured data
   */
  private checkStructuredData(): boolean {
    const jsonLd = document.querySelector('script[type="application/ld+json"]');
    const microdata = document.querySelector('[itemscope]');
    const rdfa = document.querySelector('[typeof]');
    
    return !!(jsonLd || microdata || rdfa);
  }

  /**
   * Get canonical URL
   */
  private getCanonicalUrl(): string {
    const canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    return canonical ? canonical.href : window.location.href;
  }

  /**
   * Get robots meta tag
   */
  private getRobotsMetaTag(): string {
    const robots = document.querySelector('meta[name="robots"]') as HTMLMetaElement;
    return robots ? robots.content : 'index, follow';
  }

  /**
   * Get HTTP status code (simplified)
   */
  private getHttpStatusCode(): number {
    // In a real implementation, this would check the actual HTTP response
    return 200; // Assume 200 if page loaded successfully
  }

  /**
   * Get redirect chain (simplified)
   */
  private async getRedirectChain(): Promise<string[]> {
    // Simplified implementation
    // In practice, this would trace the full redirect chain
    return [window.location.href];
  }

  /**
   * Audit social meta tags
   */
  private auditSocialMetaTags(): number {
    const socialTags = [
      'meta[property="og:title"]',
      'meta[property="og:description"]',
      'meta[property="og:image"]',
      'meta[property="og:url"]',
      'meta[name="twitter:card"]',
      'meta[name="twitter:title"]',
      'meta[name="twitter:description"]',
      'meta[name="twitter:image"]'
    ];

    return socialTags.filter(selector => 
      document.querySelector(selector)?.getAttribute('content')?.trim()
    ).length;
  }

  /**
   * Audit image optimization
   */
  private auditImageOptimization(): number {
    const images = Array.from(document.querySelectorAll('img'));
    if (images.length === 0) return 100;

    let optimizedImages = 0;
    images.forEach(img => {
      // Check for modern formats
      if (img.src.includes('.webp') || img.src.includes('.avif')) {
        optimizedImages++;
      }
      // Check for lazy loading
      else if (img.hasAttribute('loading') && img.getAttribute('loading') === 'lazy') {
        optimizedImages++;
      }
      // Check for responsive images
      else if (img.hasAttribute('srcset') || img.hasAttribute('sizes')) {
        optimizedImages++;
      }
    });

    return Math.round((optimizedImages / images.length) * 100);
  }

  /**
   * Count internal links
   */
  private countInternalLinks(): number {
    const links = Array.from(document.querySelectorAll('a[href]'));
    return links.filter(link => {
      const href = (link as HTMLAnchorElement).href;
      return href.includes(window.location.hostname) && 
             !href.startsWith('mailto:') && 
             !href.startsWith('tel:');
    }).length;
  }

  /**
   * Count external links
   */
  private countExternalLinks(): number {
    const links = Array.from(document.querySelectorAll('a[href]'));
    return links.filter(link => {
      const href = (link as HTMLAnchorElement).href;
      return !href.includes(window.location.hostname) && 
             !href.startsWith('mailto:') && 
             !href.startsWith('tel:') &&
             !href.startsWith('#');
    }).length;
  }

  /**
   * Analyze heading structure
   */
  private analyzeHeadingStructure(): Array<{level: number, text: string}> {
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    return headings.map(h => ({
      level: parseInt(h.tagName.charAt(1)),
      text: h.textContent?.substring(0, 100) || ''
    }));
  }

  /**
   * Count words in main content
   */
  private countWords(): number {
    const mainContent = document.querySelector('main, [role="main"], .content, .post-content') ||
                       document.body;
    
    const text = mainContent.textContent || '';
    const words = text.trim().split(/\s+/).filter(word => word.length > 0);
    return words.length;
  }

  /**
   * Calculate readability score (simplified Flesch Reading Ease)
   */
  private calculateReadabilityScore(): number {
    const mainContent = document.querySelector('main, [role="main"], .content, .post-content') ||
                       document.body;
    
    const text = mainContent.textContent || '';
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = text.trim().split(/\s+/).filter(word => word.length > 0);
    const syllables = words.reduce((count, word) => count + this.countSyllables(word), 0);

    if (sentences.length === 0 || words.length === 0) return 0;

    // Simplified Flesch Reading Ease formula
    const avgWordsPerSentence = words.length / sentences.length;
    const avgSyllablesPerWord = syllables / words.length;
    
    const score = 206.835 - (1.015 * avgWordsPerSentence) - (84.6 * avgSyllablesPerWord);
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Count syllables in a word (simplified)
   */
  private countSyllables(word: string): number {
    const cleanWord = word.toLowerCase().replace(/[^a-z]/g, '');
    if (cleanWord.length <= 3) return 1;
    
    const vowels = cleanWord.match(/[aeiouy]+/g);
    let syllableCount = vowels ? vowels.length : 1;
    
    // Adjust for silent e
    if (cleanWord.endsWith('e')) syllableCount--;
    
    return Math.max(1, syllableCount);
  }

  /**
   * Generate recommendations based on metrics
   */
  private generateRecommendations(metrics: SEOMetrics): SEORecommendation[] {
    const recommendations: SEORecommendation[] = [];

    // Performance recommendations
    if (metrics.pageLoadTime > 3000) {
      recommendations.push({
        type: 'critical',
        category: 'performance',
        issue: 'Slow page load time',
        recommendation: 'Optimize images, minify CSS/JS, use CDN, enable compression',
        impact: 'high',
        effort: 'medium',
        resources: ['Google PageSpeed Insights', 'GTmetrix', 'WebP conversion tools']
      });
    }

    if (metrics.largestContentfulPaint > 2500) {
      recommendations.push({
        type: 'important',
        category: 'performance',
        issue: 'Poor Largest Contentful Paint',
        recommendation: 'Optimize largest content element, preload critical resources',
        impact: 'high',
        effort: 'medium'
      });
    }

    if (metrics.cumulativeLayoutShift > 0.1) {
      recommendations.push({
        type: 'important',
        category: 'performance',
        issue: 'Layout shift issues',
        recommendation: 'Set dimensions for images and ads, use CSS transform',
        impact: 'medium',
        effort: 'low'
      });
    }

    // Meta tags recommendations
    if (metrics.metaTagsScore < 80) {
      recommendations.push({
        type: 'critical',
        category: 'technical',
        issue: 'Incomplete meta tags',
        recommendation: 'Add missing meta tags: title, description, Open Graph tags',
        impact: 'high',
        effort: 'low'
      });
    }

    // Accessibility recommendations
    if (metrics.accessibilityScore < 90) {
      recommendations.push({
        type: 'important',
        category: 'accessibility',
        issue: 'Accessibility issues found',
        recommendation: 'Add alt text to images, improve heading structure, add ARIA labels',
        impact: 'high',
        effort: 'medium',
        resources: ['WAVE accessibility checker', 'axe-core extension']
      });
    }

    // Mobile responsiveness
    if (metrics.mobileResponsiveness < 80) {
      recommendations.push({
        type: 'critical',
        category: 'mobile',
        issue: 'Poor mobile responsiveness',
        recommendation: 'Add viewport meta tag, implement responsive design, increase touch targets',
        impact: 'high',
        effort: 'medium'
      });
    }

    // Structured data
    if (!metrics.structuredDataPresent) {
      recommendations.push({
        type: 'suggestion',
        category: 'technical',
        issue: 'No structured data found',
        recommendation: 'Add JSON-LD structured data for better search visibility',
        impact: 'medium',
        effort: 'low',
        resources: ['Schema.org', 'Google Structured Data Testing Tool']
      });
    }

    // Content recommendations
    if (metrics.wordCount < 300) {
      recommendations.push({
        type: 'suggestion',
        category: 'content',
        issue: 'Low word count',
        recommendation: 'Add more comprehensive content to improve search rankings',
        impact: 'medium',
        effort: 'high'
      });
    }

    if (metrics.readabilityScore < 60) {
      recommendations.push({
        type: 'suggestion',
        category: 'content',
        issue: 'Poor readability',
        recommendation: 'Use shorter sentences and simpler words to improve readability',
        impact: 'medium',
        effort: 'medium'
      });
    }

    // Image optimization
    if (metrics.imageOptimization < 70) {
      recommendations.push({
        type: 'important',
        category: 'performance',
        issue: 'Poor image optimization',
        recommendation: 'Use modern image formats (WebP), add lazy loading, optimize image sizes',
        impact: 'medium',
        effort: 'medium'
      });
    }

    return recommendations;
  }

  /**
   * Calculate overall SEO score
   */
  private calculateOverallScore(metrics: SEOMetrics): number {
    const weights = {
      performance: 0.3,
      technical: 0.25,
      content: 0.2,
      accessibility: 0.15,
      mobile: 0.1
    };

    // Performance score (0-100)
    const performanceScore = Math.min(100, 
      100 - (metrics.pageLoadTime - 1000) / 50 // Penalize after 1s
    );

    // Technical score (0-100)
    const technicalScore = (
      metrics.metaTagsScore * 0.4 +
      (metrics.structuredDataPresent ? 20 : 0) +
      Math.min(20, metrics.socialMetaTags * 2.5) +
      (metrics.canonicalUrl ? 20 : 0)
    );

    // Content score (0-100)
    const contentScore = (
      Math.min(50, metrics.wordCount / 10) +
      Math.min(30, metrics.internalLinks * 2) +
      Math.min(20, metrics.readabilityScore / 5)
    );

    const overallScore = 
      performanceScore * weights.performance +
      technicalScore * weights.technical +
      contentScore * weights.content +
      metrics.accessibilityScore * weights.accessibility +
      metrics.mobileResponsiveness * weights.mobile;

    return Math.round(Math.max(0, Math.min(100, overallScore)));
  }

  /**
   * Check alert thresholds
   */
  private checkAlerts(result: SEOAuditResult) {
    const alerts = [];

    if (result.metrics.pageLoadTime > this.config.alertThresholds.pageSpeed) {
      alerts.push(`Page load time (${result.metrics.pageLoadTime}ms) exceeds threshold`);
    }

    if (result.metrics.metaTagsScore < this.config.alertThresholds.metaScore) {
      alerts.push(`Meta tags score (${result.metrics.metaTagsScore}) below threshold`);
    }

    if (result.metrics.accessibilityScore < this.config.alertThresholds.accessibilityScore) {
      alerts.push(`Accessibility score (${result.metrics.accessibilityScore}) below threshold`);
    }

    if (result.score < this.config.alertThresholds.overallScore) {
      alerts.push(`Overall SEO score (${result.score}) below threshold`);
    }

    if (alerts.length > 0) {
      console.warn('🚨 SEO Alerts:', alerts);
      
      // Send alerts to monitoring system
      this.sendAlerts(alerts, result);
    }
  }

  /**
   * Send analytics data
   */
  private sendAnalytics(result: SEOAuditResult) {
    // In a real implementation, send to your analytics service
    console.log('📊 Sending SEO analytics:', {
      url: result.url,
      score: result.score,
      timestamp: result.timestamp,
      criticalIssues: result.recommendations.filter(r => r.type === 'critical').length
    });

    // Store locally for development
    const stored = localStorage.getItem('seo-analytics') || '[]';
    const analytics = JSON.parse(stored);
    analytics.push({
      timestamp: result.timestamp,
      url: result.url,
      score: result.score,
      recommendations: result.recommendations.length
    });

    // Keep only last 50 entries
    if (analytics.length > 50) {
      analytics.splice(0, analytics.length - 50);
    }

    localStorage.setItem('seo-analytics', JSON.stringify(analytics));
  }

  /**
   * Send alerts to monitoring system
   */
  private sendAlerts(alerts: string[], result: SEOAuditResult) {
    // In a real implementation, send to monitoring service (email, Slack, etc.)
    console.warn('🚨 SEO Alerts triggered:', {
      alerts,
      url: result.url,
      score: result.score,
      timestamp: result.timestamp
    });
  }

  /**
   * Get historical data
   */
  getHistoricalData(): HistoricalSEOData[] {
    return this.metricsHistory;
  }

  /**
   * Get performance trends
   */
  getPerformanceTrends(days: number = 7): any {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const recentData = this.metricsHistory.filter(
      entry => new Date(entry.date) >= cutoff
    );

    return {
      scoresTrend: recentData.map(entry => ({
        date: entry.date,
        score: entry.score
      })),
      averageScore: recentData.reduce((sum, entry) => sum + entry.score, 0) / recentData.length || 0,
      improvement: recentData.length > 1 
        ? recentData[recentData.length - 1].score - recentData[0].score 
        : 0
    };
  }

  /**
   * Export audit data
   */
  exportData(): string {
    return JSON.stringify({
      config: this.config,
      history: this.metricsHistory,
      timestamp: new Date().toISOString()
    }, null, 2);
  }

  /**
   * Cleanup monitoring
   */
  destroy() {
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }
    
    window.removeEventListener('popstate', this.onPageChange);
    
    console.log('🔍 SEO monitoring destroyed');
  }
}

// Export singleton instance
export const seoMonitor = new SEOMonitor();

// Export types
export type { SEOMetrics, SEORecommendation, SEOAuditResult };
