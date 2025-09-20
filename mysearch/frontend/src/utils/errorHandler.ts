import { ApiResponse } from '../types';

// Error types and classifications
export type ErrorType = 
  | 'network' 
  | 'timeout' 
  | 'server' 
  | 'client' 
  | 'validation' 
  | 'authentication' 
  | 'authorization' 
  | 'rate_limit' 
  | 'unknown';

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface StandardError {
  id: string;
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  userMessage: string;
  statusCode?: number;
  originalError?: any;
  timestamp: number;
  retryable: boolean;
  suggestions: string[];
  actions: ErrorAction[];
  context?: Record<string, any>;
}

export interface ErrorAction {
  label: string;
  action: () => void;
  variant: 'primary' | 'secondary' | 'danger';
}

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
  retryCondition?: (error: any) => boolean;
}

// Default retry configuration
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffFactor: 2,
  retryCondition: (error) => {
    // Retry on network errors, timeouts, and 5xx server errors
    if (error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT') return true;
    if (error.status >= 500 && error.status < 600) return true;
    if (error.status === 429) return true; // Rate limit
    return false;
  }
};

// Error monitoring and reporting
class ErrorReporter {
  private static instance: ErrorReporter;
  private errorQueue: StandardError[] = [];
  private isReporting = false;

  static getInstance(): ErrorReporter {
    if (!ErrorReporter.instance) {
      ErrorReporter.instance = new ErrorReporter();
    }
    return ErrorReporter.instance;
  }

  async reportError(error: StandardError): Promise<void> {
    this.errorQueue.push(error);
    
    // Log error for development
    console.group(`🚨 Error Report [${error.type.toUpperCase()}]`);
    console.error('Error:', error);
    console.groupEnd();

    // Batch report errors to avoid flooding
    if (!this.isReporting) {
      this.isReporting = true;
      setTimeout(() => {
        this.flushErrorQueue();
        this.isReporting = false;
      }, 1000);
    }
  }

  private async flushErrorQueue(): Promise<void> {
    if (this.errorQueue.length === 0) return;

    const errors = [...this.errorQueue];
    this.errorQueue = [];

    try {
      // Send to monitoring service in production
      if (process.env.NODE_ENV === 'production') {
        await fetch('/api/errors/batch-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ errors })
        });
      }
      
      console.log(`📊 Reported ${errors.length} errors to monitoring service`);
    } catch (reportingError) {
      console.error('Failed to report errors:', reportingError);
      // Re-queue errors for next attempt
      this.errorQueue.unshift(...errors);
    }
  }

  getErrorStats(): { total: number; byType: Record<ErrorType, number>; bySeverity: Record<ErrorSeverity, number> } {
    const stats = {
      total: this.errorQueue.length,
      byType: {} as Record<ErrorType, number>,
      bySeverity: {} as Record<ErrorSeverity, number>
    };

    this.errorQueue.forEach(error => {
      stats.byType[error.type] = (stats.byType[error.type] || 0) + 1;
      stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1;
    });

    return stats;
  }
}

// Enhanced error handler with retry and monitoring
export class EnhancedErrorHandler {
  private reporter = ErrorReporter.getInstance();
  // private retryAttempts = new Map<string, number>();

  /**
   * Classify error based on various factors
   */
  classifyError(error: any): { type: ErrorType; severity: ErrorSeverity; statusCode?: number } {
    let type: ErrorType = 'unknown';
    let severity: ErrorSeverity = 'medium';
    let statusCode: number | undefined;

    // Extract status code
    if (error.response?.status) {
      statusCode = error.response.status;
    } else if (error.status) {
      statusCode = error.status;
    }

    // Classify by status code
    if (statusCode) {
      if (statusCode >= 400 && statusCode < 500) {
        type = 'client';
        severity = statusCode === 401 ? 'high' : statusCode === 403 ? 'high' : 'medium';
        
        if (statusCode === 401) type = 'authentication';
        if (statusCode === 403) type = 'authorization';
        if (statusCode === 422) type = 'validation';
        if (statusCode === 429) type = 'rate_limit';
      } else if (statusCode >= 500) {
        type = 'server';
        severity = 'high';
      }
    }

    // Classify by error code/message
    if (error.code === 'NETWORK_ERROR' || error.message?.includes('Network Error')) {
      type = 'network';
      severity = 'high';
    } else if (error.code === 'TIMEOUT' || error.message?.includes('timeout')) {
      type = 'timeout';
      severity = 'medium';
    }

    return { type, severity, statusCode };
  }

  /**
   * Generate user-friendly error message
   */
  generateUserMessage(type: ErrorType, statusCode?: number): string {
    switch (type) {
      case 'network':
        return 'Unable to connect to the server. Please check your internet connection.';
      case 'timeout':
        return 'The request took too long. The server might be busy. Please try again.';
      case 'server':
        return 'We\'re experiencing server issues. Please try again in a few minutes.';
      case 'authentication':
        return 'You need to sign in to access this feature.';
      case 'authorization':
        return 'You don\'t have permission to access this resource.';
      case 'validation':
        return 'Please check your input and try again.';
      case 'rate_limit':
        return 'Too many requests. Please wait a moment before trying again.';
      case 'client':
        return statusCode === 404 
          ? 'The requested resource was not found.' 
          : 'There was a problem with your request.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }

  /**
   * Generate actionable suggestions
   */
  generateSuggestions(type: ErrorType): string[] {
    switch (type) {
      case 'network':
        return [
          'Check your internet connection',
          'Try refreshing the page',
          'Check if you can access other websites'
        ];
      case 'timeout':
        return [
          'Try again in a few moments',
          'Check your internet speed',
          'Try refreshing the page'
        ];
      case 'server':
        return [
          'Try again in a few minutes',
          'Refresh the page',
          'Contact support if the problem persists'
        ];
      case 'authentication':
        return [
          'Sign in to your account',
          'Check if your session has expired',
          'Try clearing your browser cookies'
        ];
      case 'authorization':
        return [
          'Make sure you have the right permissions',
          'Contact an administrator',
          'Try signing in with a different account'
        ];
      case 'validation':
        return [
          'Check all required fields are filled',
          'Verify your input format is correct',
          'Make sure all data is valid'
        ];
      case 'rate_limit':
        return [
          'Wait a few minutes before trying again',
          'Reduce the frequency of your requests',
          'Try again later'
        ];
      default:
        return [
          'Refresh the page',
          'Clear your browser cache',
          'Try again later'
        ];
    }
  }

  /**
   * Generate actionable error actions
   */
  generateActions(type: ErrorType, _context?: Record<string, any>): ErrorAction[] {
    const actions: ErrorAction[] = [];

    // Common actions
    actions.push({
      label: 'Try Again',
      action: () => window.location.reload(),
      variant: 'primary'
    });

    // Type-specific actions
    switch (type) {
      case 'authentication':
        actions.push({
          label: 'Sign In',
          action: () => { window.location.href = '/login'; },
          variant: 'primary'
        });
        break;
      case 'network':
        actions.push({
          label: 'Check Connection',
          action: () => { window.open('https://www.google.com', '_blank'); },
          variant: 'secondary'
        });
        break;
      case 'server':
        actions.push({
          label: 'Contact Support',
          action: () => { window.location.href = '/contact'; },
          variant: 'secondary'
        });
        break;
    }

    actions.push({
      label: 'Go Home',
      action: () => { window.location.href = '/'; },
      variant: 'secondary'
    });

    return actions;
  }

  /**
   * Create standardized error object
   */
  createStandardError(originalError: any, context?: Record<string, any>): StandardError {
    const { type, severity, statusCode } = this.classifyError(originalError);
    const userMessage = this.generateUserMessage(type, statusCode);
    const suggestions = this.generateSuggestions(type);
    const actions = this.generateActions(type, context);

    const standardError: StandardError = {
      id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity,
      message: originalError.message || 'Unknown error',
      userMessage,
      statusCode,
      originalError,
      timestamp: Date.now(),
      retryable: this.isRetryable(type, statusCode),
      suggestions,
      actions,
      context
    };

    // Report error to monitoring
    this.reporter.reportError(standardError);

    return standardError;
  }

  /**
   * Determine if error is retryable
   */
  private isRetryable(type: ErrorType, statusCode?: number): boolean {
    // Retryable error types
    if (['network', 'timeout', 'server', 'rate_limit'].includes(type)) {
      return true;
    }

    // Retryable status codes
    if (statusCode && (statusCode >= 500 || statusCode === 429 || statusCode === 408)) {
      return true;
    }

    return false;
  }

  /**
   * Execute function with automatic retry and exponential backoff
   */
  async withRetry<T>(
    operation: () => Promise<T>,
    config: Partial<RetryConfig> = {},
    context?: Record<string, any>
  ): Promise<T> {
    const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
    const operationId = `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`🔄 Starting operation with retry: ${operationId}`, { config: retryConfig, context });

    for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
      try {
        console.log(`🔄 Attempt ${attempt}/${retryConfig.maxAttempts} for operation: ${operationId}`);
        const result = await operation();
        
        if (attempt > 1) {
          console.log(`✅ Operation succeeded on attempt ${attempt}: ${operationId}`);
        }
        
        return result;
      } catch (error) {
        console.error(`❌ Attempt ${attempt} failed for operation: ${operationId}`, error);
        
        const standardError = this.createStandardError(error, { 
          ...context, 
          operationId, 
          attempt, 
          maxAttempts: retryConfig.maxAttempts 
        });

        // Don't retry if not retryable or last attempt
        if (!standardError.retryable || attempt === retryConfig.maxAttempts) {
          console.error(`🚫 Operation failed permanently: ${operationId}`, standardError);
          throw standardError;
        }

        // Check retry condition if provided
        if (retryConfig.retryCondition && !retryConfig.retryCondition(error)) {
          console.error(`🚫 Retry condition not met: ${operationId}`, error);
          throw standardError;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          retryConfig.baseDelay * Math.pow(retryConfig.backoffFactor, attempt - 1),
          retryConfig.maxDelay
        );

        console.log(`⏳ Waiting ${delay}ms before retry ${attempt + 1} for operation: ${operationId}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error('This should never be reached');
  }

  /**
   * Handle API response and standardize errors
   */
  async handleAPIResponse<T>(response: Promise<ApiResponse<T>>, context?: Record<string, any>): Promise<T> {
    try {
      const result = await response;
      
      if (!result.success) {
        const error = new Error(result.error || 'API request failed');
        (error as any).status = result.code;
        (error as any).response = { status: result.code, data: result };
        throw error;
      }
      
      return result.data as T;
    } catch (error) {
      const standardError = this.createStandardError(error, context);
      throw standardError;
    }
  }

  /**
   * Get error statistics
   */
  getErrorStats() {
    return this.reporter.getErrorStats();
  }
}

// Create singleton instance
export const errorHandler = new EnhancedErrorHandler();

// Convenience functions
export const handleError = (error: any, context?: Record<string, any>): StandardError => {
  return errorHandler.createStandardError(error, context);
};

export const withRetry = <T>(
  operation: () => Promise<T>,
  config?: Partial<RetryConfig>,
  context?: Record<string, any>
): Promise<T> => {
  return errorHandler.withRetry(operation, config, context);
};

export const handleAPIResponse = <T>(
  response: Promise<ApiResponse<T>>,
  context?: Record<string, any>
): Promise<T> => {
  return errorHandler.handleAPIResponse(response, context);
};

// Error boundary helpers
export const isRetryableError = (error: any): boolean => {
  if (error.retryable !== undefined) return error.retryable;
  
  const { type } = errorHandler.classifyError(error);
  return ['network', 'timeout', 'server', 'rate_limit'].includes(type);
};

export const getErrorUserMessage = (error: any): string => {
  if (error.userMessage) return error.userMessage;
  
  const { type, statusCode } = errorHandler.classifyError(error);
  return errorHandler.generateUserMessage(type, statusCode);
};

export const getErrorSuggestions = (error: any): string[] => {
  if (error.suggestions) return error.suggestions;
  
  const { type } = errorHandler.classifyError(error);
  return errorHandler.generateSuggestions(type);
};

export default errorHandler;
