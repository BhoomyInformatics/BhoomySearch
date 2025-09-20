import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AlertTriangle, 
  WifiOff, 
  Clock, 
  Server, 
  Lock, 
  RefreshCw, 
  ChevronDown,
  ChevronUp,
  Copy,
  X
} from 'lucide-react';
import { StandardError, ErrorType } from '../../utils/errorHandler';

interface ErrorDisplayProps {
  error: StandardError;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
  variant?: 'inline' | 'modal' | 'toast';
  showDetails?: boolean;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  onRetry,
  onDismiss,
  className = '',
  variant = 'inline',
  showDetails = false
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    // Auto-dismiss toast errors after 8 seconds
    if (variant === 'toast' && onDismiss) {
      const timer = setTimeout(onDismiss, 8000);
      return () => clearTimeout(timer);
    }
  }, [variant, onDismiss]);

  const getErrorIcon = (type: ErrorType) => {
    const iconClass = "w-6 h-6";
    
    switch (type) {
      case 'network':
        return <WifiOff className={`${iconClass} text-red-500`} />;
      case 'timeout':
        return <Clock className={`${iconClass} text-yellow-500`} />;
      case 'server':
        return <Server className={`${iconClass} text-orange-500`} />;
      case 'authentication':
      case 'authorization':
        return <Lock className={`${iconClass} text-purple-500`} />;
      default:
        return <AlertTriangle className={`${iconClass} text-red-500`} />;
    }
  };

  const getErrorColor = (type: ErrorType) => {
    switch (type) {
      case 'network':
        return 'red';
      case 'timeout':
        return 'yellow';
      case 'server':
        return 'orange';
      case 'authentication':
      case 'authorization':
        return 'purple';
      default:
        return 'red';
    }
  };

  const handleRetry = async () => {
    if (!onRetry || isRetrying) return;

    setIsRetrying(true);
    setRetryCount(prev => prev + 1);

    try {
      await onRetry();
    } catch (error) {
      console.error('Retry failed:', error);
    } finally {
      setIsRetrying(false);
    }
  };

  const copyErrorDetails = () => {
    const errorDetails = {
      id: error.id,
      type: error.type,
      message: error.message,
      timestamp: new Date(error.timestamp).toISOString(),
      statusCode: error.statusCode,
      context: error.context
    };

    navigator.clipboard.writeText(JSON.stringify(errorDetails, null, 2))
      .then(() => alert('Error details copied to clipboard'))
      .catch(() => console.error('Failed to copy error details'));
  };

  const renderActions = () => {
    if (!error.actions || error.actions.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-2 mt-4">
        {error.retryable && onRetry && (
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
            {isRetrying ? 'Retrying...' : `Retry${retryCount > 0 ? ` (${retryCount})` : ''}`}
          </button>
        )}
        
        {error.actions.slice(0, 2).map((action, index) => (
          <button
            key={index}
            onClick={action.action}
            className={`px-4 py-2 rounded-lg transition-colors ${
              action.variant === 'primary'
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : action.variant === 'danger'
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {action.label}
          </button>
        ))}
      </div>
    );
  };

  const renderSuggestions = () => {
    if (!error.suggestions || error.suggestions.length === 0) return null;

    return (
      <div className="mt-4">
        <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
          What you can try:
        </h4>
        <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
          {error.suggestions.map((suggestion, index) => (
            <li key={index} className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>
              {suggestion}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  const renderDetails = () => {
    if (!showDetails && !isExpanded) return null;

    return (
      <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
        <div className="space-y-2 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <span className="font-medium text-gray-700 dark:text-gray-300">Error ID:</span>
            <span className="font-mono text-gray-600 dark:text-gray-400">{error.id}</span>
            
            <span className="font-medium text-gray-700 dark:text-gray-300">Type:</span>
            <span className="text-gray-600 dark:text-gray-400">{error.type}</span>
            
            <span className="font-medium text-gray-700 dark:text-gray-300">Severity:</span>
            <span className={`text-${getErrorColor(error.type)}-600 dark:text-${getErrorColor(error.type)}-400`}>
              {error.severity}
            </span>
            
            {error.statusCode && (
              <>
                <span className="font-medium text-gray-700 dark:text-gray-300">Status:</span>
                <span className="text-gray-600 dark:text-gray-400">{error.statusCode}</span>
              </>
            )}
            
            <span className="font-medium text-gray-700 dark:text-gray-300">Time:</span>
            <span className="text-gray-600 dark:text-gray-400">
              {new Date(error.timestamp).toLocaleString()}
            </span>
          </div>
          
          {error.context && Object.keys(error.context).length > 0 && (
            <div className="mt-3">
              <span className="font-medium text-gray-700 dark:text-gray-300">Context:</span>
              <pre className="mt-1 text-xs bg-gray-100 dark:bg-gray-700 p-2 rounded overflow-x-auto">
                {JSON.stringify(error.context, null, 2)}
              </pre>
            </div>
          )}
        </div>
        
        <button
          onClick={copyErrorDetails}
          className="mt-3 flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          <Copy className="w-4 h-4" />
          Copy Error Details
        </button>
      </div>
    );
  };

  // Toast variant
  if (variant === 'toast') {
    return (
      <motion.div
        initial={{ opacity: 0, x: 300 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 300 }}
        className={`fixed top-4 right-4 max-w-md bg-white dark:bg-gray-800 border-l-4 border-${getErrorColor(error.type)}-500 rounded-lg shadow-lg p-4 z-50 ${className}`}
      >
        <div className="flex items-start gap-3">
          {getErrorIcon(error.type)}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {error.userMessage}
            </p>
            {error.statusCode && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Error {error.statusCode}
              </p>
            )}
          </div>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        
        {error.retryable && onRetry && (
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${isRetrying ? 'animate-spin' : ''}`} />
            {isRetrying ? 'Retrying...' : 'Try Again'}
          </button>
        )}
      </motion.div>
    );
  }

  // Modal variant
  if (variant === 'modal') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`max-w-lg w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 ${className}`}
        >
          <div className="flex items-start gap-3 mb-4">
            {getErrorIcon(error.type)}
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Error Occurred
              </h3>
              <p className="text-gray-700 dark:text-gray-300 mt-1">
                {error.userMessage}
              </p>
            </div>
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {renderSuggestions()}
          {renderActions()}

          {(showDetails || process.env.NODE_ENV === 'development') && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-2 mt-4 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {isExpanded ? 'Hide' : 'Show'} Technical Details
            </button>
          )}

          {renderDetails()}
        </motion.div>
      </div>
    );
  }

  // Inline variant (default)
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`border-l-4 border-${getErrorColor(error.type)}-500 bg-${getErrorColor(error.type)}-50 dark:bg-${getErrorColor(error.type)}-900/20 p-4 rounded-r-lg ${className}`}
    >
      <div className="flex items-start gap-3">
        {getErrorIcon(error.type)}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white">
            {error.userMessage}
          </h4>
          
          {error.statusCode && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Status: {error.statusCode} • ID: {error.id.slice(-8)}
            </p>
          )}

          {renderSuggestions()}
          {renderActions()}

          {(showDetails || process.env.NODE_ENV === 'development') && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-2 mt-3 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {isExpanded ? 'Hide' : 'Show'} Details
            </button>
          )}

          {renderDetails()}
        </div>
      </div>
    </motion.div>
  );
};

// Error display wrapper with animations
export const AnimatedErrorDisplay: React.FC<ErrorDisplayProps & { show: boolean }> = ({
  show,
  ...props
}) => (
  <AnimatePresence>
    {show && <ErrorDisplay {...props} />}
  </AnimatePresence>
);

// Quick error displays for common scenarios
export const NetworkErrorDisplay: React.FC<{ onRetry?: () => void; onDismiss?: () => void }> = ({
  onRetry,
  onDismiss
}) => {
  const networkError: StandardError = {
    id: 'network-error',
    type: 'network',
    severity: 'high',
    message: 'Network connection failed',
    userMessage: 'Unable to connect to the server. Please check your internet connection.',
    timestamp: Date.now(),
    retryable: true,
    suggestions: [
      'Check your internet connection',
      'Try refreshing the page',
      'Check if other websites are accessible'
    ],
    actions: []
  };

  return <ErrorDisplay error={networkError} onRetry={onRetry} onDismiss={onDismiss} />;
};

export const ServerErrorDisplay: React.FC<{ onRetry?: () => void; onDismiss?: () => void }> = ({
  onRetry,
  onDismiss
}) => {
  const serverError: StandardError = {
    id: 'server-error',
    type: 'server',
    severity: 'high',
    message: 'Internal server error',
    userMessage: 'We\'re experiencing server issues. Please try again in a few minutes.',
    timestamp: Date.now(),
    retryable: true,
    suggestions: [
      'Try again in a few minutes',
      'Refresh the page',
      'Contact support if the problem persists'
    ],
    actions: []
  };

  return <ErrorDisplay error={serverError} onRetry={onRetry} onDismiss={onDismiss} />;
};

export default ErrorDisplay;
