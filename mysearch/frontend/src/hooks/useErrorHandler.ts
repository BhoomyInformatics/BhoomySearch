import { useState, useCallback, useRef, useEffect } from 'react';
import { 
  StandardError, 
  errorHandler, 
  withRetry, 
  handleAPIResponse,
  RetryConfig 
} from '../utils/errorHandler';
import { ApiResponse } from '../types';

interface UseErrorHandlerOptions {
  autoRetry?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  onError?: (error: StandardError) => void;
  onRetry?: (attempt: number) => void;
  onSuccess?: () => void;
}

interface UseErrorHandlerReturn {
  // Error state
  error: StandardError | null;
  isError: boolean;
  errorType: string | null;
  
  // Loading and retry state
  isLoading: boolean;
  isRetrying: boolean;
  retryCount: number;
  canRetry: boolean;
  
  // Error actions
  clearError: () => void;
  retry: () => Promise<void>;
  handleError: (error: any, context?: Record<string, any>) => void;
  
  // Enhanced API methods
  executeWithRetry: <T>(operation: () => Promise<T>, options?: Partial<RetryConfig>) => Promise<T>;
  handleAPICall: <T>(apiCall: Promise<ApiResponse<T>>, context?: Record<string, any>) => Promise<T>;
  
  // Utility methods
  reportError: (error: StandardError) => void;
  getErrorStats: () => any;
}

export const useErrorHandler = (options: UseErrorHandlerOptions = {}): UseErrorHandlerReturn => {
  const {
    autoRetry = false,
    maxRetries = 3,
    retryDelay = 1000,
    onError,
    onRetry,
    onSuccess
  } = options;

  // State
  const [error, setError] = useState<StandardError | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Refs for stable callbacks
  const lastOperationRef = useRef<(() => Promise<any>) | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  // Handle error method
  const handleErrorCallback = useCallback((errorInput: any, context?: Record<string, any>) => {
    console.error('🚨 useErrorHandler: Handling error', errorInput, context);
    
    const standardError = errorHandler.createStandardError(errorInput, {
      ...context,
      component: 'useErrorHandler',
      timestamp: Date.now()
    });

    setError(standardError);
    setIsLoading(false);
    setIsRetrying(false);

    // Call custom error handler
    if (onError) {
      onError(standardError);
    }

    // Auto-retry if enabled and error is retryable
    if (autoRetry && standardError.retryable && retryCount < maxRetries && lastOperationRef.current) {
      console.log(`🔄 useErrorHandler: Auto-retry enabled, attempting retry ${retryCount + 1}/${maxRetries}`);
      
      retryTimeoutRef.current = setTimeout(() => {
        retryOperation();
      }, retryDelay * Math.pow(2, retryCount)); // Exponential backoff
    }
  }, [autoRetry, maxRetries, retryDelay, retryCount, onError]);

  // Clear error method
  const clearError = useCallback(() => {
    console.log('🧹 useErrorHandler: Clearing error');
    setError(null);
    setRetryCount(0);
    setIsRetrying(false);
    
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);

  // Retry operation method
  const retryOperation = useCallback(async () => {
    if (!lastOperationRef.current || !error?.retryable) {
      console.warn('🚫 useErrorHandler: Cannot retry - no operation or error not retryable');
      return;
    }

    console.log(`🔄 useErrorHandler: Retrying operation (attempt ${retryCount + 1})`);
    
    setIsRetrying(true);
    setRetryCount(prev => prev + 1);

    if (onRetry) {
      onRetry(retryCount + 1);
    }

    try {
      const result = await lastOperationRef.current();
      
      console.log('✅ useErrorHandler: Retry successful');
      clearError();
      setIsLoading(false);
      
      if (onSuccess) {
        onSuccess();
      }
      
      return result;
    } catch (retryError) {
      console.error('❌ useErrorHandler: Retry failed', retryError);
      handleErrorCallback(retryError, { isRetry: true, retryAttempt: retryCount + 1 });
    }
  }, [error?.retryable, retryCount, onRetry, onSuccess, clearError, handleErrorCallback]);

  // Manual retry method
  const retry = useCallback(async () => {
    await retryOperation();
  }, [retryOperation]);

  // Execute operation with retry
  const executeWithRetry = useCallback(async <T>(
    operation: () => Promise<T>, 
    retryConfig?: Partial<RetryConfig>
  ): Promise<T> => {
    console.log('🔄 useErrorHandler: Executing operation with retry');
    
    setIsLoading(true);
    clearError();
    lastOperationRef.current = operation;

    try {
      const result = await withRetry(operation, retryConfig, { 
        component: 'useErrorHandler',
        operationName: operation.name || 'anonymous'
      });
      
      console.log('✅ useErrorHandler: Operation completed successfully');
      setIsLoading(false);
      
      if (onSuccess) {
        onSuccess();
      }
      
      return result;
    } catch (error) {
      console.error('❌ useErrorHandler: Operation failed', error);
      handleErrorCallback(error, { 
        operationName: operation.name || 'anonymous',
        withRetry: true 
      });
      throw error;
    }
  }, [clearError, handleErrorCallback, onSuccess]);

  // Handle API call with error processing
  const handleAPICall = useCallback(async <T>(
    apiCall: Promise<ApiResponse<T>>,
    context?: Record<string, any>
  ): Promise<T> => {
    console.log('🌐 useErrorHandler: Handling API call');
    
    setIsLoading(true);
    clearError();

    try {
      const result = await handleAPIResponse(apiCall, {
        ...context,
        component: 'useErrorHandler'
      });
      
      console.log('✅ useErrorHandler: API call successful');
      setIsLoading(false);
      
      if (onSuccess) {
        onSuccess();
      }
      
      return result;
    } catch (error) {
      console.error('❌ useErrorHandler: API call failed', error);
      handleErrorCallback(error, { 
        ...context,
        apiCall: true 
      });
      throw error;
    }
  }, [clearError, handleErrorCallback, onSuccess]);

  // Report error method
  const reportError = useCallback((standardError: StandardError) => {
    errorHandler.createStandardError(standardError, {
      component: 'useErrorHandler',
      userReported: true
    });
  }, []);

  // Get error statistics
  const getErrorStats = useCallback(() => {
    return errorHandler.getErrorStats();
  }, []);

  // Computed values
  const isError = error !== null;
  const errorType = error?.type || null;
  const canRetry = error?.retryable === true && retryCount < maxRetries;

  return {
    // Error state
    error,
    isError,
    errorType,
    
    // Loading and retry state
    isLoading,
    isRetrying,
    retryCount,
    canRetry,
    
    // Error actions
    clearError,
    retry,
    handleError: handleErrorCallback,
    
    // Enhanced API methods
    executeWithRetry,
    handleAPICall,
    
    // Utility methods
    reportError,
    getErrorStats
  };
};

// Specialized hooks for common use cases
export const useAPIErrorHandler = (options?: UseErrorHandlerOptions) => {
  return useErrorHandler({
    autoRetry: true,
    maxRetries: 3,
    retryDelay: 1000,
    ...options
  });
};

export const useNetworkErrorHandler = (options?: UseErrorHandlerOptions) => {
  return useErrorHandler({
    autoRetry: true,
    maxRetries: 5,
    retryDelay: 2000,
    ...options
  });
};

export const useSearchErrorHandler = (options?: UseErrorHandlerOptions) => {
  return useErrorHandler({
    autoRetry: true,
    maxRetries: 2,
    retryDelay: 1500,
    ...options,
    onError: (error) => {
      console.log('🔍 Search error occurred:', error);
      if (options?.onError) {
        options.onError(error);
      }
    }
  });
};

// Error context hook
export const useErrorContext = () => {
  const [globalErrors, setGlobalErrors] = useState<StandardError[]>([]);

  const addGlobalError = useCallback((error: StandardError) => {
    setGlobalErrors(prev => [...prev, error]);
  }, []);

  const removeGlobalError = useCallback((errorId: string) => {
    setGlobalErrors(prev => prev.filter(e => e.id !== errorId));
  }, []);

  const clearAllErrors = useCallback(() => {
    setGlobalErrors([]);
  }, []);

  return {
    globalErrors,
    addGlobalError,
    removeGlobalError,
    clearAllErrors,
    hasErrors: globalErrors.length > 0,
    errorCount: globalErrors.length
  };
};

export default useErrorHandler;
