import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  enableRetry?: boolean;
  enableReporting?: boolean;
  errorBoundaryId?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
  errorId: string;
  timestamp: number;
}

export class ErrorBoundary extends Component<Props, State> {
  private retryTimeouts: NodeJS.Timeout[] = [];
  
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      errorId: this.generateErrorId(),
      timestamp: Date.now()
    };
  }

  private generateErrorId(): string {
    return `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      timestamp: Date.now()
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const errorData = {
      error,
      errorInfo,
      errorId: this.state.errorId,
      timestamp: this.state.timestamp,
      boundaryId: this.props.errorBoundaryId,
      retryCount: this.state.retryCount,
      userAgent: navigator.userAgent,
      url: window.location.href,
      stackTrace: error.stack
    };

    console.group('🚨 Error Boundary Caught Error');
    console.error('Error:', error);
    console.error('Error Info:', errorInfo);
    console.error('Error Data:', errorData);
    console.groupEnd();

    // Report error to monitoring service
    if (this.props.enableReporting !== false) {
      this.reportError(errorData);
    }

    // Call custom error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    this.setState({
      errorInfo,
      errorId: this.generateErrorId()
    });
  }

  private async reportError(errorData: any) {
    try {
      // Send error to monitoring service (could be Sentry, LogRocket, etc.)
      const errorReport = {
        ...errorData,
        level: 'error',
        tags: {
          component: 'ErrorBoundary',
          boundaryId: this.props.errorBoundaryId || 'unknown',
          retryCount: errorData.retryCount
        }
      };

      // Log to console for development
      console.log('📊 Error Report Generated:', errorReport);

      // In production, send to error monitoring service
      if (process.env.NODE_ENV === 'production') {
        // Example: Send to monitoring API
        fetch('/api/errors/report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(errorReport)
        }).catch(console.error);
      }
    } catch (reportingError) {
      console.error('Failed to report error:', reportingError);
    }
  }

  private handleRetry = () => {
    const maxRetries = 3;
    const retryDelay = Math.pow(2, this.state.retryCount) * 1000; // Exponential backoff

    if (this.state.retryCount >= maxRetries) {
      console.warn('Maximum retry attempts reached');
      return;
    }

    console.log(`🔄 Retrying... Attempt ${this.state.retryCount + 1}/${maxRetries} (delay: ${retryDelay}ms)`);

    const timeout = setTimeout(() => {
      this.setState(prevState => ({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: prevState.retryCount + 1,
        errorId: this.generateErrorId(),
        timestamp: Date.now()
      }));
    }, retryDelay);

    this.retryTimeouts.push(timeout);
  };

  private handleReset = () => {
    console.log('🔄 Resetting error boundary');
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      errorId: this.generateErrorId(),
      timestamp: Date.now()
    });
  };

  private handleReload = () => {
    console.log('🔄 Reloading page');
    window.location.reload();
  };

  private handleGoHome = () => {
    console.log('🏠 Navigating to home');
    window.location.href = '/';
  };

  private copyErrorDetails = () => {
    const errorDetails = {
      errorId: this.state.errorId,
      timestamp: new Date(this.state.timestamp).toISOString(),
      error: this.state.error?.toString(),
      stack: this.state.error?.stack,
      componentStack: this.state.errorInfo?.componentStack,
      url: window.location.href,
      userAgent: navigator.userAgent
    };

    navigator.clipboard.writeText(JSON.stringify(errorDetails, null, 2))
      .then(() => alert('Error details copied to clipboard'))
      .catch(() => console.error('Failed to copy error details'));
  };

  componentWillUnmount() {
    // Clear any pending retry timeouts
    this.retryTimeouts.forEach(timeout => clearTimeout(timeout));
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-6"
        >
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Something went wrong
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Error ID: {this.state.errorId}
                </p>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-gray-700 dark:text-gray-300 mb-2">
                We're sorry, but something unexpected happened. You can try the following:
              </p>
              
              {this.state.error && (
                <div className="bg-gray-100 dark:bg-gray-700 rounded-md p-3 mb-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                    {this.state.error.message}
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4">
                <Clock className="w-4 h-4" />
                <span>
                  Occurred: {new Date(this.state.timestamp).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              {/* Retry button */}
              {this.props.enableRetry !== false && this.state.retryCount < 3 && (
                <button
                  onClick={this.handleRetry}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Again ({this.state.retryCount}/3)
                </button>
              )}

              {/* Reset button */}
              <button
                onClick={this.handleReset}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Reset Component
              </button>

              {/* Reload page button */}
              <button
                onClick={this.handleReload}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Reload Page
              </button>

              {/* Go home button */}
              <button
                onClick={this.handleGoHome}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Home className="w-4 h-4" />
                Go to Home
              </button>

              {/* Copy error details button */}
              <button
                onClick={this.copyErrorDetails}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <Bug className="w-4 h-4" />
                Copy Error Details
              </button>
            </div>

            {/* Development mode error details */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-6 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                <summary className="cursor-pointer text-sm font-medium text-red-800 dark:text-red-400">
                  Development Error Details
                </summary>
                <div className="mt-2 text-xs text-red-700 dark:text-red-300 font-mono whitespace-pre-wrap">
                  <strong>Error:</strong> {this.state.error.toString()}
                  {this.state.error.stack && (
                    <>
                      <br /><br />
                      <strong>Stack Trace:</strong>
                      <br />{this.state.error.stack}
                    </>
                  )}
                  {this.state.errorInfo && (
                    <>
                      <br /><br />
                      <strong>Component Stack:</strong>
                      <br />{this.state.errorInfo.componentStack}
                    </>
                  )}
                </div>
              </details>
            )}
          </div>
        </motion.div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
