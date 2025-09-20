import { StandardError } from './errorHandler';

// Error monitoring configuration
interface MonitoringConfig {
  enabled: boolean;
  endpoint: string;
  apiKey?: string;
  environment: string;
  userId?: string;
  sessionId: string;
  batchSize: number;
  flushInterval: number;
  enableConsoleLogging: boolean;
  enablePerformanceMonitoring: boolean;
}

// Performance metrics
interface PerformanceMetrics {
  renderTime: number;
  loadTime: number;
  apiResponseTime: number;
  memoryUsage: number;
  errorRate: number;
  userInteractions: number;
}

// Error monitoring service
class ErrorMonitoringService {
  private config: MonitoringConfig;
  private errorQueue: (StandardError & { metrics?: PerformanceMetrics })[] = [];
  private flushTimer?: NodeJS.Timeout;
  private sessionStart = Date.now();
  private errorCount = 0;
  private totalInteractions = 0;

  constructor(config: Partial<MonitoringConfig> = {}) {
    this.config = {
      enabled: false, // Disabled to prevent 404 errors
      endpoint: '/api/errors/monitoring',
      environment: process.env.NODE_ENV || 'development',
      sessionId: this.generateSessionId(),
      batchSize: 10,
      flushInterval: 30000, // 30 seconds
      enableConsoleLogging: process.env.NODE_ENV === 'development',
      enablePerformanceMonitoring: true,
      ...config
    };

    if (this.config.enabled) {
      this.initializeMonitoring();
    }

    console.log('📊 Error Monitoring Service initialized:', {
      enabled: this.config.enabled,
      environment: this.config.environment,
      sessionId: this.config.sessionId
    });
  }

  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeMonitoring(): void {
    // Set up automatic flushing
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushInterval);

    // Monitor page unload to flush remaining errors
    window.addEventListener('beforeunload', () => {
      this.flush();
    });

    // Monitor performance
    if (this.config.enablePerformanceMonitoring) {
      this.setupPerformanceMonitoring();
    }

    // Global error handler
    window.addEventListener('error', (event) => {
      this.reportGlobalError(event.error || new Error(event.message), {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    });

    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      this.reportGlobalError(event.reason, {
        type: 'unhandled_promise_rejection'
      });
    });

    console.log('📊 Error monitoring initialized for', this.config.environment);
  }

  private setupPerformanceMonitoring(): void {
    // Monitor page load performance
    if ('performance' in window) {
      window.addEventListener('load', () => {
        setTimeout(() => {
          const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
          if (perfData) {
            this.reportPerformanceMetrics({
              loadTime: perfData.loadEventEnd - perfData.loadEventStart,
              renderTime: perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart,
              apiResponseTime: 0, // Will be updated by API calls
              memoryUsage: this.getMemoryUsage(),
              errorRate: this.calculateErrorRate(),
              userInteractions: this.totalInteractions
            });
          }
        }, 1000);
      });
    }

    // Monitor memory usage periodically
    setInterval(() => {
      if (this.config.enablePerformanceMonitoring) {
        this.checkMemoryUsage();
      }
    }, 60000); // Every minute
  }

  private getMemoryUsage(): number {
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize / 1024 / 1024; // MB
    }
    return 0;
  }

  private calculateErrorRate(): number {
    const sessionDuration = Date.now() - this.sessionStart;
    const minutes = sessionDuration / (1000 * 60);
    return minutes > 0 ? this.errorCount / minutes : 0;
  }

  private checkMemoryUsage(): void {
    const memoryUsage = this.getMemoryUsage();
    
    // Alert if memory usage is high (over 100MB)
    if (memoryUsage > 100) {
      console.warn('⚠️ High memory usage detected:', memoryUsage, 'MB');
      
      this.reportError({
        id: `memory-warning-${Date.now()}`,
        type: 'performance' as any,
        severity: 'medium',
        message: `High memory usage: ${memoryUsage}MB`,
        userMessage: 'The application is using more memory than expected',
        timestamp: Date.now(),
        retryable: false,
        suggestions: ['Refresh the page to free up memory'],
        actions: [],
        context: { memoryUsage, type: 'memory_warning' }
      } as any);
    }
  }

  reportError(error: StandardError, metrics?: PerformanceMetrics): void {
    this.errorCount++;
    
    const enrichedError = {
      ...error,
      sessionId: this.config.sessionId,
      environment: this.config.environment,
      userId: this.config.userId,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: error.timestamp || Date.now(),
      metrics: metrics || this.getCurrentMetrics(),
      sessionMetrics: {
        sessionDuration: Date.now() - this.sessionStart,
        totalErrors: this.errorCount,
        totalInteractions: this.totalInteractions,
        errorRate: this.calculateErrorRate()
      }
    };

    this.errorQueue.push(enrichedError);

    if (this.config.enableConsoleLogging) {
      console.group('📊 Error Monitoring Report');
      console.error('Error:', enrichedError);
      console.log('Queue size:', this.errorQueue.length);
      console.groupEnd();
    }

    // Flush immediately for critical errors
    if (error.severity === 'critical' || this.errorQueue.length >= this.config.batchSize) {
      this.flush();
    }
  }

  reportGlobalError(error: Error, context?: Record<string, any>): void {
    const standardError: StandardError = {
      id: `global-error-${Date.now()}`,
      type: 'unknown',
      severity: 'high',
      message: error.message || 'Global error occurred',
      userMessage: 'An unexpected error occurred',
      timestamp: Date.now(),
      retryable: false,
      suggestions: ['Refresh the page', 'Try again later'],
      actions: [],
      originalError: error,
      context: {
        ...context,
        stack: error.stack,
        global: true
      }
    };

    this.reportError(standardError);
  }

  reportPerformanceMetrics(metrics: Partial<PerformanceMetrics>): void {
    const performanceReport = {
      sessionId: this.config.sessionId,
      timestamp: Date.now(),
      metrics: {
        ...this.getCurrentMetrics(),
        ...metrics
      },
      environment: this.config.environment,
      url: window.location.href
    };

    if (this.config.enableConsoleLogging) {
      console.log('📊 Performance Metrics:', performanceReport);
    }

    // Send performance data
    if (this.config.enabled) {
      this.sendData('/api/errors/performance', [performanceReport]);
    }
  }

  private getCurrentMetrics(): PerformanceMetrics {
    return {
      renderTime: 0,
      loadTime: 0,
      apiResponseTime: 0,
      memoryUsage: this.getMemoryUsage(),
      errorRate: this.calculateErrorRate(),
      userInteractions: this.totalInteractions
    };
  }

  trackUserInteraction(interaction: string, data?: Record<string, any>): void {
    this.totalInteractions++;
    
    if (this.config.enableConsoleLogging) {
      console.log('👆 User interaction:', interaction, data);
    }

    // Track high-frequency interactions that might lead to errors
    if (this.totalInteractions % 50 === 0) {
      this.reportPerformanceMetrics({
        userInteractions: this.totalInteractions
      });
    }
  }

  trackAPICall(endpoint: string, duration: number, success: boolean, statusCode?: number): void {
    const metrics = this.getCurrentMetrics();
    metrics.apiResponseTime = duration;

    if (!success) {
      this.reportError({
        id: `api-error-${Date.now()}`,
        type: statusCode && statusCode >= 500 ? 'server' : 'network',
        severity: 'medium',
        message: `API call failed: ${endpoint}`,
        userMessage: 'Network request failed',
        timestamp: Date.now(),
        retryable: true,
        suggestions: ['Check your internet connection', 'Try again'],
        actions: [],
        statusCode,
        context: {
          endpoint,
          duration,
          statusCode,
          type: 'api_call'
        }
      } as StandardError, metrics);
    }

    // Track slow API calls
    if (duration > 5000) { // 5 seconds
      console.warn('🐌 Slow API call detected:', endpoint, duration + 'ms');
      
      this.reportPerformanceMetrics({
        apiResponseTime: duration
      });
    }
  }

  async flush(): Promise<void> {
    if (this.errorQueue.length === 0) return;

    const errors = [...this.errorQueue];
    this.errorQueue = [];

    console.log(`📊 Flushing ${errors.length} errors to monitoring service`);

    try {
      await this.sendData('/api/errors/batch', errors);
      console.log('✅ Errors successfully sent to monitoring service');
    } catch (error) {
      console.error('❌ Failed to send errors to monitoring service:', error);
      
      // Re-queue errors for next flush (keep last 20 to prevent memory issues)
      this.errorQueue.unshift(...errors.slice(-20));
    }
  }

  private async sendData(endpoint: string, data: any[]): Promise<void> {
    if (!this.config.enabled || data.length === 0) return;

    const payload = {
      service: 'bhoomy-frontend',
      environment: this.config.environment,
      sessionId: this.config.sessionId,
      timestamp: Date.now(),
      data
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    const response = await fetch(this.config.endpoint + endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  }

  getSessionStats(): {
    sessionId: string;
    duration: number;
    errorCount: number;
    errorRate: number;
    interactions: number;
    memoryUsage: number;
  } {
    return {
      sessionId: this.config.sessionId,
      duration: Date.now() - this.sessionStart,
      errorCount: this.errorCount,
      errorRate: this.calculateErrorRate(),
      interactions: this.totalInteractions,
      memoryUsage: this.getMemoryUsage()
    };
  }

  updateConfig(newConfig: Partial<MonitoringConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('📊 Monitoring config updated:', newConfig);
  }

  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    
    // Final flush
    this.flush();
    
    console.log('📊 Error monitoring service destroyed');
  }
}

// Create singleton instance
const errorMonitoring = new ErrorMonitoringService();

// Export convenience functions
export const reportError = (error: StandardError, metrics?: PerformanceMetrics) => {
  errorMonitoring.reportError(error, metrics);
};

export const trackUserInteraction = (interaction: string, data?: Record<string, any>) => {
  errorMonitoring.trackUserInteraction(interaction, data);
};

export const trackAPICall = (endpoint: string, duration: number, success: boolean, statusCode?: number) => {
  errorMonitoring.trackAPICall(endpoint, duration, success, statusCode);
};

export const reportPerformanceMetrics = (metrics: Partial<PerformanceMetrics>) => {
  errorMonitoring.reportPerformanceMetrics(metrics);
};

export const getSessionStats = () => {
  return errorMonitoring.getSessionStats();
};

export const flushErrors = () => {
  return errorMonitoring.flush();
};

export { errorMonitoring, ErrorMonitoringService };
export type { MonitoringConfig, PerformanceMetrics };
export default errorMonitoring;
