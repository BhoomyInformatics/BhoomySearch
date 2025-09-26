/**
 * Enhanced SearchPage with comprehensive error handling, performance optimizations, and improved UI
 */

import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ErrorBoundary from '../components/error/ErrorBoundary';
import APIErrorBoundary from '../components/error/APIErrorBoundary';
import ErrorDisplay from '../components/error/ErrorDisplay';
import SearchFilters from '../components/optimized/SearchFilters';
import SearchResults from '../components/optimized/SearchResults';
import Analytics from '../components/Analytics';
import { useSearchStore } from '../store/searchStore';
import { useErrorHandler } from '../hooks/useErrorHandler';
import { enhancedApiClient } from '../utils/enhancedApiClient';
import { useComponentMemoryMonitor } from '../hooks/useComponentMemoryMonitor';
import { trackUserInteraction, trackAPICall } from '../utils/errorMonitoring';
import { handleError } from '../utils/errorHandler';
import { SearchResult, SearchFilters as SearchFiltersType } from '../types';

// Search info component (memoized)
const SearchInfo = memo<{
  query: string;
  total: number;
  loading: boolean;
  searchStartTime: number | null;
  onToggleFilters: () => void;
  activeFilterCount: number;
}>(({ query, total, loading, searchStartTime, onToggleFilters, activeFilterCount }) => {
  const getSeconds = useCallback(() => {
    if (!searchStartTime) return '0.000';
    return ((Date.now() - searchStartTime) / 1000).toFixed(3);
  }, [searchStartTime]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8 search-info-section"
      style={{ paddingLeft: '25px', paddingRight: '25px' }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Search className="w-6 h-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Search Results for "{query}"
          </h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onToggleFilters}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-300"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filters
            {activeFilterCount > 0 && (
              <span className="bg-blue-600 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>
      
      <>
        <p className="text-gray-600 dark:text-gray-400">
          Found {total.toLocaleString()} results
        </p>
        <div className="small" style={{ fontSize: '12px', color: '#666', marginTop: '5px', minHeight: '18px' }}>
          {loading ? 'Loading more results…' : `Request time (Page generated in ${getSeconds()} seconds.)`}
        </div>
      </>
    </motion.div>
  );
});

SearchInfo.displayName = 'SearchInfo';

// Empty state component (memoized)
const EmptyState = memo<{
  query: string;
  onRetry: () => void;
}>(({ onRetry }) => (
  <div className="text-center py-16">
    <Search className="w-16 h-16 text-gray-400 mx-auto mb-4" />
    <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-400 mb-2">
      No results found
    </h3>
    <p className="text-gray-500 dark:text-gray-500 mb-4">
      Try searching with different keywords or adjust your filters
    </p>
    <button
      onClick={onRetry}
      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
    >
      Try Again
    </button>
  </div>
));

EmptyState.displayName = 'EmptyState';

// Load more button component (memoized)
const LoadMoreButton = memo<{
  onLoadMore: () => void;
  loading: boolean;
  hasMore: boolean;
}>(({ onLoadMore, loading, hasMore }) => {
  if (!hasMore || loading) return null;

  return (
    <div className="text-center">
      <button
        onClick={onLoadMore}
        className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        Load More Results
      </button>
    </div>
  );
});

LoadMoreButton.displayName = 'LoadMoreButton';

const SearchPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const [searchStartTime, setSearchStartTime] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [localError, setLocalError] = useState<any>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  
  // Memory monitoring and lifecycle management
  const {
    isMounted,
    safeSetTimeout,
    addCleanupFunction,
    getMemoryReport,
    registerEffect,
    unregisterEffect
  } = useComponentMemoryMonitor(
    {
      componentName: 'SearchPage',
      enableMemoryTracking: true,
      enableLeakDetection: true,
      maxEffects: 10,
      alertThreshold: 50 // 50MB threshold
    },
    {
      onMount: () => {
        console.log('🚀 SearchPage mounted with memory monitoring');
        trackUserInteraction('page_mount', { page: 'search' });
      },
      onUnmount: () => {
        console.log('🧹 SearchPage unmounting, cleaning up resources');
        enhancedApiClient.cancelAllRequests();
        trackUserInteraction('page_unmount', { 
          page: 'search',
          memoryReport: getMemoryReport()
        });
      },
      onMemoryAlert: (usage) => {
        console.warn(`🧠 SearchPage memory usage high: ${usage}MB`);
        trackUserInteraction('memory_alert', { 
          page: 'search', 
          memoryUsage: usage 
        });
      },
      onLeakDetected: (leakInfo) => {
        console.error('🚨 Memory leak detected in SearchPage:', leakInfo);
        trackUserInteraction('memory_leak_detected', { 
          page: 'search', 
          leakInfo 
        });
      }
    }
  );

  // Enhanced error handling
  const {
    error: enhancedError,
    clearError: clearEnhancedError,
    handleError: handleEnhancedError
  } = useErrorHandler({
    onError: (error) => {
      console.log('🚨 Enhanced error handling activated:', error.type);
      trackUserInteraction('error_occurred', { 
        errorType: error.type, 
        page: 'search' 
      });
    }
  });
  
  const {
    results,
    total,
    currentPage,
    loading,
    error: storeError,
    filters,
    setQuery,
    setResults,
    setLoading,
    setError,
    setCurrentPage,
    setFilters,
    addToHistory
  } = useSearchStore();
  
  // Add abort controller ref for current search
  const currentSearchController = useRef<AbortController | null>(null);
  const prefetchCacheRef = useRef<{ page: number; results: SearchResult[]; total: number } | null>(null);
  const prefetchingPageRef = useRef<number | null>(null);
  const loadMoreTriggerRef = useRef<HTMLDivElement | null>(null);
  const lastScrollYRef = useRef<number>(0);

  // Memoized computed values
  const hasResults = useMemo(() => results.length > 0, [results.length]);
  const hasMore = useMemo(() => hasResults && results.length < total, [hasResults, results.length, total]);
  const shouldShowEmptyState = useMemo(() => 
    !loading && results.length === 0 && query && !storeError && !localError, 
    [loading, results.length, query, storeError, localError]
  );

  // Memoized error display
  const errorDisplay = useMemo(() => {
    const displayError = localError || storeError || enhancedError;
    if (!displayError) return null;

    return (
      <ErrorDisplay
        error={displayError}
        onRetry={() => performSearch(query, 1)}
        onDismiss={() => {
          setLocalError(null);
          clearEnhancedError();
        }}
        variant="inline"
        showDetails={process.env.NODE_ENV === 'development'}
      />
    );
  }, [localError, storeError, enhancedError, query, clearEnhancedError]);

  // Enhanced useEffect with proper cleanup for query changes
  useEffect(() => {
    if (!query) {
      return;
    }

    console.log('🔍 SearchPage useEffect: Query changed to:', query);
    const effectName = `query-search-${query}`;
    registerEffect(effectName);

    // Cancel any existing search
    if (currentSearchController.current) {
      console.log('🛑 Cancelling previous search for new query');
      currentSearchController.current.abort();
    }

    // Create new abort controller for this search
    currentSearchController.current = new AbortController();

    // Only proceed if component is still mounted
    if (isMounted()) {
      setQuery(query);
      addToHistory(query);
      
      // Use safe async search with the new controller
      performSearchWithController(query, 1, currentSearchController.current)
        .catch(error => {
          if (error.name !== 'AbortError' && isMounted()) {
            console.error('🔍 Search failed in useEffect:', error);
          }
        });
    }

    // Cleanup function
    return () => {
      console.log('🧹 Cleaning up search effect for query:', query);
      unregisterEffect(effectName);
      
      if (currentSearchController.current) {
        currentSearchController.current.abort();
        currentSearchController.current = null;
      }
    };
  }, [query, isMounted, registerEffect, unregisterEffect]);


  // Execute with retry logic
  const executeWithRetry = useCallback(async (
    operation: () => Promise<any>,
    options: { maxAttempts?: number; baseDelay?: number } = {}
  ) => {
    const { maxAttempts = 3, baseDelay = 1000 } = options;
    let attempt = 0;
    let delay = baseDelay;

    while (attempt < maxAttempts) {
      try {
        return await operation();
      } catch (error: any) {
        attempt++;
        if (attempt >= maxAttempts) {
          throw error;
        }
        
        console.warn(`Attempt ${attempt} failed, retrying in ${delay}ms:`, error.message);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 1.5; // Exponential backoff
      }
    }
  }, []);

  // Enhanced performSearch with abort controller support and retry logic
  const performSearchWithController = useCallback(async (
    searchQuery: string, 
    page = 1, 
    controller?: AbortController,
    customFilters?: Partial<SearchFiltersType>
  ) => {
    if (!searchQuery.trim()) {
      setError('Please enter a search query');
      return;
    }

    // Check if component is still mounted
    if (!isMounted()) {
      console.log('🚫 Search cancelled: component unmounted');
      return;
    }

    console.log('🔍 SearchPage: Starting enhanced search with abort controller:', { 
      searchQuery, 
      page,
      hasController: !!controller 
    });
    
    const currentSearchStartTime = Date.now();
    setSearchStartTime(currentSearchStartTime); // Reset timer for new search
    const effectName = `search-${searchQuery}-${page}-${Date.now()}`;
    
    registerEffect(effectName);
    
    try {
      if (page === 1) {
        setLoading(true);
      }
      setError(null);
      setLocalError(null);
      clearEnhancedError();
      
      // Track search initiation
      trackUserInteraction('search_started', { 
        query: searchQuery.substring(0, 50), 
        page,
        enhanced: true
      });

      // Use retry logic for search
      const response = await executeWithRetry(async () => {
        // Use custom filters if provided, otherwise use component filters
        const searchFilters = customFilters || filters;
        
        console.log('🔍 SearchPage: Using filters for search:', {
          customFilters,
          componentFilters: filters,
          finalFilters: searchFilters
        });
        
        // Build filters object, only including meaningful values
        const apiFilters: any = {};
        
        // Only add filters that have meaningful values
        if (searchFilters.category && searchFilters.category !== '') {
          apiFilters.category = searchFilters.category;
        }
        if (searchFilters.language && searchFilters.language !== '') {
          apiFilters.language = searchFilters.language;
        }
        if (searchFilters.country && searchFilters.country !== '') {
          apiFilters.country = searchFilters.country;
        }
        if (searchFilters.content_type) {
          apiFilters.content_type = searchFilters.content_type;
        }
        if (searchFilters.sort_by) {
          apiFilters.sort_by = searchFilters.sort_by;
        }
        
        // Add date range if present
        if (searchFilters.date_range) {
          apiFilters.date_range = searchFilters.date_range;
        }
        
        console.log('🔍 SearchPage: Final API filters:', apiFilters);
        
        return await enhancedApiClient.search({
        q: searchQuery,
        page,
        per_page: 20,
        filters: apiFilters
      }, {
        signal: controller?.signal,
        timeout: 30000,
          retryCount: 0, // We handle retries ourselves
        retryDelay: 1000
      });
      }, { maxAttempts: 2, baseDelay: 1000 });

      const searchDuration = Date.now() - currentSearchStartTime;

      // Check if component is still mounted before processing response
      if (!isMounted()) {
        console.log('🚫 Search response ignored: component unmounted');
        return;
      }

      console.log('🔍 SearchPage: Received enhanced response:', {
        success: response.success,
        data_exists: !!response.data,
        data_keys: response.data ? Object.keys(response.data) : 'NO DATA',
        results_length: response.data?.results?.length,
        total: response.data?.total,
        duration: searchDuration + 'ms',
        error: response.error,
        enhanced: true
      });

      if (response.success) {
        const newResults = response.data?.results || [];
        const resultTotal = response.data?.total || 0;
        
        // Track successful API call
        trackAPICall('/api/search', searchDuration, true);
        
        console.log('🔍 SearchPage: Processing enhanced results:', {
          newResults_length: newResults.length,
          resultTotal,
          first_result: newResults[0] ? {
            id: newResults[0].id,
            title: newResults[0].site_data_title,
            link: newResults[0].site_data_link
          } : 'NO FIRST RESULT'
        });
        
        // Only update state if component is still mounted
        if (isMounted()) {
          if (page === 1) {
            setResults(newResults, resultTotal);
            console.log('🔍 SearchPage: Set enhanced results for page 1:', { 
              results_count: newResults.length, 
              total: resultTotal 
            });
          } else {
            // For pagination/load more
            const combinedResults = [...results, ...newResults];
            setResults(combinedResults, resultTotal);
            console.log('🔍 SearchPage: Added enhanced results for page', page, { 
              new_results: newResults.length,
              combined_total: combinedResults.length 
            });
          }
          setCurrentPage(page);
        }

        // Prefetch next page in background if more results exist
        const totalSoFar = (page === 1 ? newResults.length : results.length + newResults.length);
        const hasNext = totalSoFar < resultTotal;
        if (hasNext && isMounted()) {
          try {
            const nextPage = page + 1;
            if (prefetchingPageRef.current === nextPage) {
              // already prefetching
            } else {
              prefetchingPageRef.current = nextPage;
              const bgController = new AbortController();
              enhancedApiClient.search({
              q: searchQuery,
              page: nextPage,
              per_page: 20,
              filters: customFilters || filters
            }, { signal: bgController.signal, timeout: 20000, retryCount: 0 })
            .then((prefetchResp) => {
              if (prefetchResp.success) {
                prefetchCacheRef.current = {
                  page: nextPage,
                  results: prefetchResp.data?.results || [],
                  total: prefetchResp.data?.total || resultTotal
                };
                console.log('⚡ Prefetched page', nextPage, 'count:', prefetchCacheRef.current.results.length);
              }
            })
            .catch(() => {/* ignore prefetch errors */});
            }
          } catch {/* ignore */}
        }

        // Track successful search
        trackUserInteraction('search_success', {
          query: searchQuery.substring(0, 50),
          resultsCount: newResults.length,
          totalResults: resultTotal,
          duration: searchDuration,
          page,
          enhanced: true
        });

      } else {
        console.error('🔍 SearchPage: Enhanced search failed:', response.error);
        
        // Track failed API call
        trackAPICall('/api/search', searchDuration, false, response.code);
        
        const errorMessage = response.error || 'Search failed';
        
        // Only update state if component is still mounted
        if (isMounted()) {
          setError(errorMessage);
        }

        // Handle with enhanced error system
        try {
          const enhancedErrorObj = handleError(new Error(errorMessage), {
            searchQuery: searchQuery.substring(0, 50),
            page,
            responseCode: response.code,
            apiResponse: response,
            enhanced: true
          });
          if (isMounted()) {
            handleEnhancedError(enhancedErrorObj);
          }
        } catch (enhancedHandlingError) {
          console.warn('Enhanced error handling failed, using fallback:', enhancedHandlingError);
        }
      }
    } catch (error: any) {
      const searchDuration = Date.now() - currentSearchStartTime;
      
      // Handle abort errors gracefully
      if (error.name === 'AbortError') {
        console.log('🛑 Search was cancelled:', searchQuery);
        trackUserInteraction('search_cancelled', {
          query: searchQuery.substring(0, 50),
          page,
          duration: searchDuration
        });
        return;
      }
      
      console.error('🔍 SearchPage: Enhanced search error:', error);
      
      // Track failed API call
      trackAPICall('/api/search', searchDuration, false, error.response?.status);
      
      // Only update state if component is still mounted
      if (isMounted()) {
        setLocalError(error);
      }

      // Handle with enhanced error system
      try {
        const enhancedErrorObj = handleError(error, {
          searchQuery: searchQuery.substring(0, 50),
          page,
          networkError: true,
          duration: searchDuration,
          enhanced: true
        });
        if (isMounted()) {
          handleEnhancedError(enhancedErrorObj);
        }
      } catch (enhancedHandlingError) {
        console.warn('Enhanced error handling failed, using fallback:', enhancedHandlingError);
      }
    } finally {
      unregisterEffect(effectName);
      
      // Only update loading state if component is still mounted
      if (isMounted() && page === 1) {
        setLoading(false);
        console.log('🔍 SearchPage: Enhanced search completed, loading set to false');
      }
    }
  }, [isMounted, registerEffect, unregisterEffect, filters, results, setLoading, setError, setResults, setCurrentPage, clearEnhancedError, handleEnhancedError, executeWithRetry]);

  // Legacy performSearch for backward compatibility (without abort controller)
  const performSearch = useCallback(async (searchQuery: string, page = 1) => {
    console.log('🔍 Using legacy performSearch (backward compatibility)');
    return performSearchWithController(searchQuery, page);
  }, [performSearchWithController]);

  // Enhanced filter change with abort controller support and retry logic
  const handleFilterChange = useCallback((newFilters: Partial<SearchFiltersType>) => {
    if (!isMounted()) {
      console.log('🚫 Filter change ignored: component unmounted');
      return;
    }

    console.log('🔧 Filter change triggered:', newFilters);
    console.log('🔧 Current filters before change:', filters);
    
    trackUserInteraction('filters_changed', { 
      newFilters: Object.keys(newFilters),
      query: query.substring(0, 50)
    });
    
    // Merge new filters with existing filters and remove undefined values
    const updatedFilters = { ...filters };
    Object.keys(newFilters).forEach(key => {
      const value = newFilters[key as keyof typeof newFilters];
      if (value === undefined || value === '' || value === null) {
        delete updatedFilters[key as keyof typeof updatedFilters];
      } else {
        (updatedFilters as any)[key] = value;
      }
    });
    console.log('🔧 Updated filters after merge and cleanup:', updatedFilters);
    
    setFilters(updatedFilters);
    
    if (query) {
      // Cancel any existing search before applying new filters
      if (currentSearchController.current) {
        console.log('🛑 Cancelling current search for filter change');
        currentSearchController.current.abort();
      }

      // Create new abort controller for filtered search
      currentSearchController.current = new AbortController();
      
      // Perform search with new filters using retry logic
      executeWithRetry(
        () => performSearchWithController(query, 1, currentSearchController.current || undefined),
        { maxAttempts: 2, baseDelay: 1000 }
      ).catch((error: any) => {
          if (error.name !== 'AbortError' && isMounted()) {
            console.error('🔧 Filter search failed:', error);
          }
        });
    }
  }, [isMounted, query, filters, setFilters, performSearchWithController, executeWithRetry]);

  // Enhanced load more with abort controller support and retry logic
  const loadMore = useCallback(() => {
    if (!isMounted()) {
      console.log('🚫 Load more ignored: component unmounted');
      return;
    }

    if (!loading && query && hasResults) {
      console.log('📄 Loading more results for page:', currentPage + 1);
      
      trackUserInteraction('load_more_requested', { 
        currentPage, 
        resultsCount: results.length 
      });
      
      // If we have prefetch cache for next page, append instantly
      if (prefetchCacheRef.current && prefetchCacheRef.current.page === currentPage + 1) {
        const cached = prefetchCacheRef.current;
        prefetchCacheRef.current = null;
        const combinedResults = [...results, ...cached.results];
        setResults(combinedResults, cached.total);
        setCurrentPage(currentPage + 1);
        // Trigger prefetch for the next page after instant append
        setTimeout(() => {
          if (isMounted()) {
            const bgController = new AbortController();
            performSearchWithController(query, currentPage + 2, bgController);
          }
        }, 0);
        return;
      }

      // Create new abort controller for load more
      const loadMoreController = new AbortController();
      // Preserve current scroll position to prevent jump to top
      lastScrollYRef.current = window.scrollY || window.pageYOffset || 0;
      setLoadingMore(true);
      
      executeWithRetry(
        () => performSearchWithController(query, currentPage + 1, loadMoreController),
        { maxAttempts: 2 }
      ).then(() => {
          // Restore previous scroll position so user stays at the same place
          if (isMounted()) {
            try {
              window.scrollTo({ top: lastScrollYRef.current, behavior: 'auto' });
            } catch {
              window.scrollTo(0, lastScrollYRef.current);
            }
          }
        })
        .catch((error: any) => {
          if (error.name !== 'AbortError' && isMounted()) {
            console.error('📄 Load more failed:', error);
          }
        })
        .finally(() => {
          if (isMounted()) setLoadingMore(false);
        });
    }
  }, [isMounted, loading, query, hasResults, currentPage, results.length, performSearchWithController, executeWithRetry]);

  // Toggle filters with tracking
  const toggleFilters = useCallback(() => {
    const newShowFilters = !showFilters;
    setShowFilters(newShowFilters);
    trackUserInteraction('filters_toggled', { visible: newShowFilters });
  }, [showFilters]);


  // Handle result clicks with tracking
  const handleResultClick = useCallback((result: SearchResult) => {
    trackUserInteraction('result_clicked', {
      resultId: result.id,
      resultTitle: result.site_data_title?.substring(0, 50),
      position: results.findIndex(r => r.id === result.id) + 1
    });
  }, [results]);


  // Memory monitoring effect for development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const memoryCheckInterval = safeSetTimeout(() => {
        const report = getMemoryReport();
        console.log('🧠 SearchPage Memory Report:', report);
        
        // Log warning if too many active effects
        if (report.activeEffects.length > 5) {
          console.warn('⚠️ High number of active effects:', report.activeEffects);
        }
        
        // Log warning if too many pending controllers
        if (report.pendingControllers > 3) {
          console.warn('⚠️ High number of pending controllers:', report.pendingControllers);
        }
      }, 10000); // Check every 10 seconds

      // Cleanup
      return () => {
        clearTimeout(memoryCheckInterval);
      };
    }
  }, [safeSetTimeout, getMemoryReport]);

  // Global cleanup effect for any remaining resources
  useEffect(() => {
    // Register cleanup for abort controller
    addCleanupFunction(() => {
      if (currentSearchController.current) {
        console.log('🧹 Final cleanup: aborting search controller');
        currentSearchController.current.abort();
        currentSearchController.current = null;
      }
    });

    // Register cleanup for enhanced API client
    addCleanupFunction(() => {
      console.log('🧹 Final cleanup: cancelling all API requests');
      enhancedApiClient.cancelAllRequests();
    });

    return () => {
      console.log('🧹 SearchPage: Component cleanup effect triggered');
    };
  }, [addCleanupFunction]);

  // Prefetch-on-viewport using IntersectionObserver
  useEffect(() => {
    if (!hasMore) return;
    const el = loadMoreTriggerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          // Start prefetch for the next page if not already available
          if (!prefetchCacheRef.current || prefetchCacheRef.current.page !== currentPage + 1) {
            const controller = new AbortController();
            performSearchWithController(query, currentPage + 1, controller)
              .catch(() => {/* ignore */});
          }
        }
      });
    }, { root: null, rootMargin: '600px 0px 600px 0px', threshold: 0 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, currentPage, query, performSearchWithController]);

  return (
    <ErrorBoundary
      enableRetry={true}
      enableReporting={true}
      errorBoundaryId="search-page-enhanced"
      onError={(error, errorInfo) => {
        console.error('🚨 SearchPage error boundary triggered:', error, errorInfo);
        trackUserInteraction('error_boundary_triggered', {
          error: error.message,
          page: 'search',
          enhanced: true
        });
      }}
    >
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
      
        <APIErrorBoundary
          onRetry={() => {
            console.log('🔄 API Error Boundary retry triggered');
            if (query) {
              performSearch(query, 1);
            }
          }}
        >
          <main className="container mx-auto px-6 py-8" style={{ maxWidth: '1400px' }}>
            {/* Search Info */}
            <SearchInfo
              query={query}
              total={total}
              loading={loading}
              searchStartTime={searchStartTime}
              onToggleFilters={toggleFilters}
              activeFilterCount={Object.keys(filters).filter(key => filters[key as keyof typeof filters]).length}
            />


            {/* Filters */}
            {showFilters && (
              <SearchFilters
                filters={filters}
                onFiltersChange={handleFilterChange}
                onReset={() => {
                  console.log('🔧 Resetting all filters');
                  console.log('🔧 Current filters before reset:', filters);
                  
                  // Cancel any existing search before resetting filters
                  if (currentSearchController.current) {
                    console.log('🛑 Cancelling current search for filter reset');
                    currentSearchController.current.abort();
                  }

                  // Clear filters first
                  setFilters({});
                  console.log('🔧 Filters cleared, performing search with empty filters');
                  
                  if (query) {
                    // Create new abort controller for reset search
                    currentSearchController.current = new AbortController();
                    
                    // Perform search with completely empty filters
                    const emptyFilters = {
                      category: undefined,
                      sort_by: undefined,
                      content_type: undefined,
                      language: undefined,
                      country: undefined,
                      date_range: undefined
                    };
                    
                    console.log('🔧 Using empty filters for search:', emptyFilters);
                    
                    executeWithRetry(
                      () => performSearchWithController(query, 1, currentSearchController.current || undefined, emptyFilters),
                      { maxAttempts: 2, baseDelay: 1000 }
                    ).catch((error: any) => {
                        if (error.name !== 'AbortError' && isMounted()) {
                          console.error('🔧 Filter reset search failed:', error);
                        }
                      });
                  }
                }}
                showFilters={showFilters}
                onToggle={toggleFilters}
                hasActiveFilters={Object.keys(filters).some(key => filters[key as keyof typeof filters])}
                activeFilterCount={Object.keys(filters).filter(key => filters[key as keyof typeof filters]).length}
              />
            )}

            {/* Error Display */}
            {errorDisplay && (
              <div className="mb-6">
                {errorDisplay}
          </div>
        )}

        {/* Search Results */}
            <SearchResults
              results={results}
              loading={loading || loadingMore}
              onResultClick={handleResultClick}
            />

        {/* Load More Button */}
            {hasMore && (
              <div className="text-center" style={{ minHeight: '60px' }}>
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); if (!loading) loadMore(); }}
                  disabled={loading || loadingMore}
                  aria-busy={loading || loadingMore}
                  className="px-8 py-3 bg-blue-600 text-white rounded-lg transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ opacity: (loading || loadingMore) ? 0.7 : 1, cursor: (loading || loadingMore) ? 'not-allowed' : 'pointer' }}
                >
                  {(loading || loadingMore) ? 'Loading…' : 'Load More Results'}
                </button>
                {/* Invisible trigger for prefetch-on-viewport */}
                <div ref={loadMoreTriggerRef} style={{ height: 1, width: 1, margin: 0, padding: 0, opacity: 0 }} />
              </div>
            )}

            {/* Empty State */}
            {shouldShowEmptyState && (
              <EmptyState
                query={query}
                onRetry={() => performSearch(query, 1)}
              />
        )}
      </main>
        </APIErrorBoundary>

        <Footer />

        {/* Analytics */}
        <Analytics siteId="101276548" />
        
        {/* Mobile responsive styles for search results */}
        <style>{`
          @media (max-width: 768px) {
            .container.mx-auto {
              padding-left: 10px !important;
              padding-right: 10px !important;
            }
            
            .search-info-section {
              padding-left: 15px !important;
              padding-right: 15px !important;
            }
            
            .search-results-section {
              padding-left: 15px !important;
              padding-right: 15px !important;
            }
            
            .filters-section {
              margin-left: 15px !important;
              margin-right: 15px !important;
            }
            
          }
          
          @media (max-width: 480px) {
            .container.mx-auto {
              padding-left: 5px !important;
              padding-right: 5px !important;
            }
            
            .search-info-section {
              padding-left: 10px !important;
              padding-right: 10px !important;
            }
            
            .search-results-section {
              padding-left: 10px !important;
              padding-right: 10px !important;
            }
            
            .filters-section {
              margin-left: 10px !important;
              margin-right: 10px !important;
            }
            
          }
        `}</style>
      </div>
    </ErrorBoundary>
  );      
};

export default SearchPage;