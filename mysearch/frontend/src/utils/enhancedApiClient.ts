/**
 * Enhanced API Client with AbortController support and memory leak prevention
 */

import React from 'react';
import { apiClient } from './api';

interface AbortableApiOptions {
  signal?: AbortSignal;
  timeout?: number;
  retryCount?: number;
  retryDelay?: number;
}

interface SearchQuery {
  q: string;
  page?: number;
  per_page?: number;
  filters?: {
    category?: string;
    sort_by?: string;
    content_type?: string;
    language?: string;
    country?: string;
    date_range?: {
      from?: string;
      to?: string;
    };
  };
}

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: number;
}

interface SearchResponse {
  results: any[];
  total: number;
  pagination?: {
    current_page: number;
    total_pages: number;
    per_page: number;
    has_next: boolean;
    has_prev: boolean;
  };
  time_taken?: number;
  cached?: boolean;
  optimization?: any;
  suggestions?: string[];
  performance?: {
    elasticsearchTime: number;
    totalTime: number;
    optimized?: boolean;
  };
}

/**
 * Enhanced API client with abort controller support and error handling
 */
class EnhancedApiClient {
  private activeRequests = new Map<string, AbortController>();
  private requestCounter = 0;

  /**
   * Create an abortable API request with timeout and retry support
   */
  private async makeAbortableRequest<T>(
    requestFn: (signal: AbortSignal) => Promise<ApiResponse<T>>,
    options: AbortableApiOptions = {}
  ): Promise<ApiResponse<T>> {
    const {
      signal: externalSignal,
      timeout = 30000, // 30 seconds default
      retryCount = 2,
      retryDelay: initialRetryDelay = 1000
    } = options;
    
    let retryDelay = initialRetryDelay;

    const requestId = `request_${++this.requestCounter}`;
    const controller = new AbortController();
    
    // Link external signal if provided
    if (externalSignal) {
      if (externalSignal.aborted) {
        throw new Error('Request aborted before starting');
      }
      
      const abortHandler = () => {
        controller.abort();
        this.activeRequests.delete(requestId);
      };
      
      externalSignal.addEventListener('abort', abortHandler, { once: true });
    }

    this.activeRequests.set(requestId, controller);

    // Setup timeout
    const timeoutId = setTimeout(() => {
      console.warn(`⏱️ Request ${requestId} timed out after ${timeout}ms`);
      controller.abort();
    }, timeout);

    let lastError: any = null;
    let attempt = 0;

    while (attempt <= retryCount) {
      try {
        console.log(`🌐 Making API request ${requestId} (attempt ${attempt + 1}/${retryCount + 1})`);
        
        const result = await requestFn(controller.signal);
        
        // Clear timeout and cleanup
        clearTimeout(timeoutId);
        this.activeRequests.delete(requestId);
        
        console.log(`✅ API request ${requestId} completed successfully`);
        return result;
        
      } catch (error: any) {
        lastError = error;
        attempt++;

        if (error.name === 'AbortError') {
          console.log(`🛑 API request ${requestId} was aborted`);
          clearTimeout(timeoutId);
          this.activeRequests.delete(requestId);
          throw error;
        }

        if (attempt <= retryCount) {
          console.warn(`⚠️ API request ${requestId} failed (attempt ${attempt}), retrying in ${retryDelay}ms:`, error.message);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          retryDelay = retryDelay * 1.5; // Exponential backoff
        }
      }
    }

    // All retries failed
    clearTimeout(timeoutId);
    this.activeRequests.delete(requestId);
    
    console.error(`❌ API request ${requestId} failed after ${retryCount + 1} attempts:`, lastError);
    throw lastError;
  }

  /**
   * Abortable search request with enhanced error handling
   */
  async search(
    query: SearchQuery,
    options: AbortableApiOptions = {}
  ): Promise<ApiResponse<SearchResponse>> {
    return this.makeAbortableRequest(
      (signal) => this.searchWithSignal(query, signal),
      options
    );
  }

  /**
   * Internal search method that accepts AbortSignal
   */
  private async searchWithSignal(
    query: SearchQuery,
    signal: AbortSignal
  ): Promise<ApiResponse<SearchResponse>> {
    // Check if already aborted
    if (signal.aborted) {
      throw new Error('Search request aborted before starting');
    }

    try {
      // Use the existing apiClient but wrap with signal monitoring
      const searchPromise = apiClient.search(query as any);
      
      // Create a promise that rejects if signal is aborted
      const abortPromise = new Promise<never>((_, reject) => {
        if (signal.aborted) {
          reject(new Error('AbortError'));
          return;
        }
        
        signal.addEventListener('abort', () => {
          reject(new Error('AbortError'));
        }, { once: true });
      });

      // Race between the actual search and abort signal
      const result = await Promise.race([
        searchPromise,
        abortPromise
      ]);

      return result as ApiResponse<SearchResponse>;
      
    } catch (error: any) {
      if (signal.aborted) {
        const abortError = new Error('Search request was cancelled');
        abortError.name = 'AbortError';
        throw abortError;
      }
      
      throw error;
    }
  }

  /**
   * Abortable suggestions request
   */
  async getSuggestions(
    query: string,
    options: AbortableApiOptions = {}
  ): Promise<string[]> {
    const result = await this.makeAbortableRequest(
      (signal) => this.getSuggestionsWithSignal(query, signal),
      options
    );
    
    return result.data || [];
  }

  /**
   * Internal suggestions method with AbortSignal
   */
  private async getSuggestionsWithSignal(
    query: string,
    signal: AbortSignal
  ): Promise<ApiResponse<string[]>> {
    if (signal.aborted) {
      throw new Error('Suggestions request aborted before starting');
    }

    try {
      // For now, return mock suggestions since apiClient doesn't have this method
      // In a real implementation, this would call the actual API
      await new Promise(resolve => setTimeout(resolve, 100)); // Simulate API delay
      
      if (signal.aborted) {
        throw new Error('AbortError');
      }

      const suggestions = [
        `${query} tutorial`,
        `${query} guide`,
        `how to ${query}`,
        `best ${query}`,
        `${query} examples`
      ].filter(s => s.length > query.length);

      return {
        success: true,
        data: suggestions
      };
      
    } catch (error: any) {
      if (signal.aborted) {
        const abortError = new Error('Suggestions request was cancelled');
        abortError.name = 'AbortError';
        throw abortError;
      }
      
      throw error;
    }
  }

  /**
   * Cancel all active requests
   */
  cancelAllRequests(): void {
    console.log(`🛑 Cancelling ${this.activeRequests.size} active API requests`);
    
    this.activeRequests.forEach((controller, requestId) => {
      console.log(`🛑 Cancelling request: ${requestId}`);
      controller.abort();
    });
    
    this.activeRequests.clear();
  }

  /**
   * Cancel specific request by ID
   */
  cancelRequest(requestId: string): boolean {
    const controller = this.activeRequests.get(requestId);
    if (controller) {
      console.log(`🛑 Cancelling specific request: ${requestId}`);
      controller.abort();
      this.activeRequests.delete(requestId);
      return true;
    }
    return false;
  }

  /**
   * Get active requests count
   */
  getActiveRequestsCount(): number {
    return this.activeRequests.size;
  }

  /**
   * Get active request IDs
   */
  getActiveRequestIds(): string[] {
    return Array.from(this.activeRequests.keys());
  }

  /**
   * Create an abort controller that's managed by this client
   */
  createManagedAbortController(requestId?: string): AbortController {
    const id = requestId || `manual_${++this.requestCounter}`;
    const controller = new AbortController();
    
    this.activeRequests.set(id, controller);
    
    // Auto-cleanup when aborted
    controller.signal.addEventListener('abort', () => {
      this.activeRequests.delete(id);
    }, { once: true });
    
    return controller;
  }
}

// Create singleton instance
export const enhancedApiClient = new EnhancedApiClient();

/**
 * React hook for managed API requests with automatic cleanup
 */
export const useApiRequest = () => {
  const abortController = new AbortController();

  // Auto-cleanup on unmount
  React.useEffect(() => {
    return () => {
      console.log('🧹 Cleaning up API requests on component unmount');
      abortController.abort();
    };
  }, []);

  const makeRequest = React.useCallback(<T>(
    requestFn: (signal: AbortSignal) => Promise<ApiResponse<T>>,
    options: Omit<AbortableApiOptions, 'signal'> = {}
  ) => {
    return enhancedApiClient['makeAbortableRequest'](requestFn, {
      ...options,
      signal: abortController.signal
    });
  }, []);

  return {
    makeRequest,
    abort: () => abortController.abort(),
    isAborted: abortController.signal.aborted
  };
};

export default enhancedApiClient;

// For backward compatibility
export { enhancedApiClient as abortableApiClient };
