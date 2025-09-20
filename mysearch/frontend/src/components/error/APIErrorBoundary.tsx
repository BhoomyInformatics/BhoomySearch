import { Component, ReactNode } from 'react';
import { AlertCircle, Wifi, WifiOff, Clock, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
  children: ReactNode;
  onRetry?: () => void;
  retryable?: boolean;
}

interface State {
  hasError: boolean;
  errorType: 'network' | 'server' | 'timeout' | 'unknown';
  errorMessage: string;
  statusCode?: number;
  retryCount: number;
  isRetrying: boolean;
}

export class APIErrorBoundary extends Component<Props, State> {
  private retryTimeout?: NodeJS.Timeout;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      errorType: 'unknown',
      errorMessage: '',
      retryCount: 0,
      isRetrying: false
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Determine error type based on error message/properties
    let errorType: State['errorType'] = 'unknown';
    let statusCode: number | undefined;

    if (error.message.includes('Network Error') || error.message.includes('ERR_NETWORK')) {
      errorType = 'network';
    } else if (error.message.includes('timeout')) {
      errorType = 'timeout';
    } else if (error.message.includes('5') || error.message.includes('Server')) {
      errorType = 'server';
    }

    // Extract status code if available
    const statusMatch = error.message.match(/status (\d+)/);
    if (statusMatch) {
      statusCode = parseInt(statusMatch[1]);
    }

    return {
      hasError: true,
      errorType,
      errorMessage: error.message,
      statusCode
    };
  }

  componentDidCatch(error: Error) {
    console.error('🚨 API Error Boundary:', error);
    
    // Report API errors to monitoring
    this.reportAPIError(error);
  }

  private reportAPIError = (error: Error) => {
    const errorData = {
      type: 'api_error',
      error: error.message,
      stack: error.stack,
      errorType: this.state.errorType,
      statusCode: this.state.statusCode,
      url: window.location.href,
      timestamp: new Date().toISOString(),
      retryCount: this.state.retryCount
    };

    console.log('📊 API Error Report:', errorData);
    
    // Send to monitoring service in production
    if (process.env.NODE_ENV === 'production') {
      fetch('/api/errors/api-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorData)
      }).catch(console.error);
    }
  };

  private handleRetry = async () => {
    if (this.state.retryCount >= 3) return;

    this.setState({ isRetrying: true });

    // Exponential backoff
    const delay = Math.pow(2, this.state.retryCount) * 1000;
    console.log(`🔄 API Retry attempt ${this.state.retryCount + 1} (delay: ${delay}ms)`);

    this.retryTimeout = setTimeout(() => {
      this.setState(prevState => ({
        hasError: false,
        retryCount: prevState.retryCount + 1,
        isRetrying: false
      }));

      // Call parent retry handler if provided
      if (this.props.onRetry) {
        this.props.onRetry();
      }
    }, delay);
  };

  componentWillUnmount() {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }
  }

  private getErrorIcon() {
    switch (this.state.errorType) {
      case 'network':
        return <WifiOff className="w-8 h-8 text-red-500" />;
      case 'timeout':
        return <Clock className="w-8 h-8 text-yellow-500" />;
      case 'server':
        return <AlertCircle className="w-8 h-8 text-orange-500" />;
      default:
        return <AlertCircle className="w-8 h-8 text-red-500" />;
    }
  }

  private getErrorTitle() {
    switch (this.state.errorType) {
      case 'network':
        return 'Connection Problem';
      case 'timeout':
        return 'Request Timed Out';
      case 'server':
        return 'Server Error';
      default:
        return 'Something Went Wrong';
    }
  }

  private getErrorDescription() {
    switch (this.state.errorType) {
      case 'network':
        return 'Unable to connect to the server. Please check your internet connection.';
      case 'timeout':
        return 'The request took too long to complete. The server might be busy.';
      case 'server':
        return 'The server encountered an error. This is usually temporary.';
      default:
        return 'An unexpected error occurred while processing your request.';
    }
  }

  private getErrorSuggestions() {
    switch (this.state.errorType) {
      case 'network':
        return [
          'Check your internet connection',
          'Try refreshing the page',
          'Check if the server is accessible'
        ];
      case 'timeout':
        return [
          'Try again in a few moments',
          'Check your internet speed',
          'The server might be experiencing high load'
        ];
      case 'server':
        return [
          'Try again in a few minutes',
          'The issue should resolve automatically',
          'Contact support if the problem persists'
        ];
      default:
        return [
          'Try refreshing the page',
          'Clear your browser cache',
          'Try again later'
        ];
    }
  }

  render() {
    if (this.state.hasError) {
      const canRetry = this.props.retryable !== false && this.state.retryCount < 3;

      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 m-4"
        >
          <div className="flex items-center gap-3 mb-4">
            {this.getErrorIcon()}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {this.getErrorTitle()}
              </h3>
              {this.state.statusCode && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Status: {this.state.statusCode}
                </p>
              )}
            </div>
          </div>

          <p className="text-gray-700 dark:text-gray-300 mb-4">
            {this.getErrorDescription()}
          </p>

          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              What you can try:
            </h4>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              {this.getErrorSuggestions().map((suggestion, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">•</span>
                  {suggestion}
                </li>
              ))}
            </ul>
          </div>

          {canRetry && (
            <button
              onClick={this.handleRetry}
              disabled={this.state.isRetrying}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${this.state.isRetrying ? 'animate-spin' : ''}`} />
              {this.state.isRetrying 
                ? 'Retrying...' 
                : `Try Again (${this.state.retryCount}/3)`
              }
            </button>
          )}

          {this.state.retryCount >= 3 && (
            <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
              <p className="text-sm text-yellow-800 dark:text-yellow-400">
                Maximum retry attempts reached. Please refresh the page or try again later.
              </p>
            </div>
          )}

          {/* Network status indicator */}
          <div className="mt-4 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            {navigator.onLine ? (
              <>
                <Wifi className="w-4 h-4 text-green-500" />
                <span>Connected</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-red-500" />
                <span>Offline</span>
              </>
            )}
          </div>
        </motion.div>
      );
    }

    return this.props.children;
  }
}

export default APIErrorBoundary;
