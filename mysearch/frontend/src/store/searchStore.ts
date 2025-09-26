/**
 * Comprehensive Search Store with Enhanced Features
 * Combines all functionality from enhancedSearchStore and slices into a single, unified store
 */

import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import { SearchResult, SearchFilters } from '../types';

// Core Search Store Interface
export interface SearchStore {
  // Core search state
  query: string;
  results: SearchResult[];
  total: number;
  currentPage: number;
  loading: boolean;
  error: string | null;
  
  // Search history and suggestions
  searchHistory: string[];
  suggestions: string[];
  recentQueries: Array<{
    query: string;
    timestamp: number;
    resultsCount: number;
  }>;
  
  // Filters
  filters: SearchFilters;
  appliedFilters: SearchFilters;
  hasActiveFilters: boolean;
  
  // Performance tracking
  renderCount: number;
  lastRenderTime: number;
  searchPerformance: {
    totalSearches: number;
    totalTime: number;
    averageTime: number;
    slowSearchCount: number;
    fastestSearch: number;
    slowestSearch: number;
  };
  stateChangeStats: {
    totalChanges: number;
    changesBySlice: Record<string, number>;
    lastChangeTime: number;
  };
  lastSearchTime: number;
  searchRequestId: string | null;
  
  // Core Actions
  setQuery: (query: string) => void;
  setResults: (results: SearchResult[], total: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setCurrentPage: (page: number) => void;
  clearResults: () => void;
  
  // Filter Actions
  setFilters: (filters: Partial<SearchFilters>) => void;
  applyFilters: () => void;
  resetFilters: () => void;
  clearAllFilters: () => void;
  
  // History Actions
  addToHistory: (query: string, resultsCount?: number) => void;
  removeFromHistory: (query: string) => void;
  clearHistory: () => void;
  setSuggestions: (suggestions: string[]) => void;
  clearSuggestions: () => void;
  
  // Performance Actions
  trackRender: () => void;
  startSearch: (requestId: string) => void;
  endSearch: () => void;
  trackStateChange: (sliceName: string) => void;
  resetPerformanceStats: () => void;
  
  // Computed Properties
  isSearchActive: boolean;
  hasResults: boolean;
  isEmpty: boolean;
  
  // Computed Functions
  getActiveFilterCount: () => number;
  getFilterSummary: () => string;
  getRecentSearches: (limit?: number) => string[];
  getPopularSearches: (limit?: number) => string[];
  getSearchFrequency: (query: string) => number;
  getPerformanceReport: () => PerformanceReport;
  isPerformanceGood: () => boolean;
  getSlowOperations: () => SlowOperation[];
  
  // Store Management
  performCompleteReset: () => void;
  getStoreSnapshot: () => StoreSnapshot;
  restoreFromSnapshot: (snapshot: StoreSnapshot) => void;
}

// Supporting Interfaces
interface PerformanceReport {
  renderCount: number;
  averageSearchTime: number;
  totalStateChanges: number;
  performanceScore: number;
  recommendations: string[];
}

interface SlowOperation {
  type: 'search' | 'render' | 'state_change';
  duration: number;
  timestamp: number;
  details?: any;
}

interface StoreSnapshot {
  query: string;
  filters: any;
  searchHistory: string[];
  timestamp: number;
}

// Default filter values
const defaultFilters: SearchFilters = {
  category: undefined,
  language: undefined,
  country: undefined,
  content_type: undefined,
  sort_by: undefined
};

// Create the comprehensive search store
export const useSearchStore = create<SearchStore>()(
  subscribeWithSelector(
    persist(
      (set, get) => {
        // Performance tracking variables
        const activeSearches = new Map<string, number>();
        const slowOperations: SlowOperation[] = [];
        
        return {
          // Initial state
          query: '',
          results: [],
          total: 0,
          currentPage: 1,
          loading: false,
          error: null,
          
          // History state
          searchHistory: [],
          suggestions: [],
          recentQueries: [],
          
          // Filter state
          filters: { ...defaultFilters },
          appliedFilters: { ...defaultFilters },
          hasActiveFilters: false,
          
          // Performance state
          renderCount: 0,
          lastRenderTime: Date.now(),
          searchPerformance: {
            totalSearches: 0,
            totalTime: 0,
            averageTime: 0,
            slowSearchCount: 0,
            fastestSearch: Infinity,
            slowestSearch: 0
          },
          stateChangeStats: {
            totalChanges: 0,
            changesBySlice: {},
            lastChangeTime: Date.now()
          },
          lastSearchTime: 0,
          searchRequestId: null,
          
          // Core Actions
          setQuery: (query) => {
            console.log('🔍 SearchStore: Setting query:', query);
            set({ query });
          },

          setResults: (results, total) => {
            const state = get();
            console.log('🔍 SearchStore: Setting results:', { 
              results_length: results.length, 
              total,
              query: state.query,
              first_result: results[0] ? {
                id: results[0].id,
                title: results[0].site_data_title
              } : 'NO FIRST RESULT'
            });
            
            set({ 
              results, 
              total, 
              error: null,
              loading: false
            });
          },

          setLoading: (loading) => {
            console.log('🔍 SearchStore: Setting loading:', loading);
            set({ loading });
          },

          setError: (error) => {
            console.log('🔍 SearchStore: Setting error:', error);
            // Do not clear results when clearing the error (error === null)
            if (error) {
              set({ 
                error, 
                loading: false,
                results: [],
                total: 0
              });
            } else {
              set({
                error: null,
                loading: false
              });
            }
          },

          setCurrentPage: (currentPage) => {
            console.log('🔍 SearchStore: Setting current page:', currentPage);
            set({ currentPage });
          },

          clearResults: () => {
            console.log('🔍 SearchStore: Clearing results');
            set({
              results: [],
              total: 0,
              currentPage: 1,
              error: null,
              loading: false
            });
          },
          
          // Filter Actions
          setFilters: (newFilters) => {
            const state = get();
            const updatedFilters = { ...state.filters, ...newFilters };
            
            console.log('🔧 SearchStore: Setting filters:', { 
              newFilters, 
              updatedFilters 
            });
            
            // Check if filters have meaningful values (not undefined, not empty, not default)
            const hasActive = Object.entries(updatedFilters).some(([, value]) => {
              // Only consider a filter active if it has a meaningful value
              return value !== undefined && value !== '' && value !== null;
            });
            
            set({ 
              filters: updatedFilters,
              hasActiveFilters: hasActive
            });
          },

          applyFilters: () => {
            const state = get();
            console.log('🔧 SearchStore: Applying filters:', state.filters);
            
            set({ 
              appliedFilters: { ...state.filters }
            });
          },

          resetFilters: () => {
            console.log('🔧 SearchStore: Resetting filters to default');
            
            set({
              filters: { ...defaultFilters },
              appliedFilters: { ...defaultFilters },
              hasActiveFilters: false
            });
          },

          clearAllFilters: () => {
            console.log('🔧 SearchStore: Clearing all filters');
            
            set({
              filters: { ...defaultFilters },
              appliedFilters: { ...defaultFilters },
              hasActiveFilters: false
            });
          },
          
          // History Actions
          addToHistory: (query, resultsCount = 0) => {
            const state = get();
            const trimmedQuery = query.trim();
            
            if (!trimmedQuery || trimmedQuery.length < 2) {
              return;
            }
            
            console.log('📚 SearchStore: Adding to history:', { query: trimmedQuery, resultsCount });
            
            // Remove query if it already exists
            const filteredHistory = state.searchHistory.filter(q => q !== trimmedQuery);
            const filteredQueries = state.recentQueries.filter(q => q.query !== trimmedQuery);
            
            // Add to the beginning and limit to 20 recent searches
            const newHistory = [trimmedQuery, ...filteredHistory].slice(0, 20);
            
            // Add to recent queries with metadata
            const newRecentQueries = [
              {
                query: trimmedQuery,
                timestamp: Date.now(),
                resultsCount
              },
              ...filteredQueries
            ].slice(0, 50); // Keep more detailed history
            
            set({ 
              searchHistory: newHistory,
              recentQueries: newRecentQueries
            });
          },

          removeFromHistory: (query) => {
            const state = get();
            console.log('📚 SearchStore: Removing from history:', query);
            
            set({
              searchHistory: state.searchHistory.filter(q => q !== query),
              recentQueries: state.recentQueries.filter(q => q.query !== query)
            });
          },

          clearHistory: () => {
            console.log('📚 SearchStore: Clearing all history');
            
            set({ 
              searchHistory: [],
              recentQueries: []
            });
          },

          setSuggestions: (suggestions) => {
            console.log('📚 SearchStore: Setting suggestions:', suggestions.length);
            
            set({ suggestions });
          },

          clearSuggestions: () => {
            console.log('📚 SearchStore: Clearing suggestions');
            
            set({ suggestions: [] });
          },
          
          // Performance Actions
          trackRender: () => {
            const now = Date.now();
            const state = get();
            
            set({
              renderCount: state.renderCount + 1,
              lastRenderTime: now
            });
            
            // Log excessive renders
            if (state.renderCount > 0 && state.renderCount % 50 === 0) {
              console.warn('⚠️ SearchStore: High render count detected:', state.renderCount);
            }
          },

          startSearch: (requestId) => {
            const now = Date.now();
            activeSearches.set(requestId, now);
            
            console.log('🔍 SearchStore: Starting search with ID:', requestId);
            set({
              loading: true,
              error: null,
              searchRequestId: requestId,
              lastSearchTime: now
            });
          },

          endSearch: () => {
            const state = get();
            const searchDuration = Date.now() - state.lastSearchTime;
            console.log('🔍 SearchStore: Search completed in:', searchDuration + 'ms');
            
            set({
              loading: false,
              searchRequestId: null
            });
          },

          trackStateChange: (sliceName) => {
            const now = Date.now();
            const state = get();
            
            const newChangesBySlice = {
              ...state.stateChangeStats.changesBySlice,
              [sliceName]: (state.stateChangeStats.changesBySlice[sliceName] || 0) + 1
            };
            
            set({
              stateChangeStats: {
                totalChanges: state.stateChangeStats.totalChanges + 1,
                changesBySlice: newChangesBySlice,
                lastChangeTime: now
              }
            });
            
            // Log frequent state changes
            const sliceChangeCount = newChangesBySlice[sliceName];
            if (sliceChangeCount > 0 && sliceChangeCount % 20 === 0) {
              console.warn('⚠️ SearchStore: Frequent state changes in slice:', {
                sliceName,
                changeCount: sliceChangeCount
              });
            }
          },

          resetPerformanceStats: () => {
            console.log('🔄 SearchStore: Resetting performance statistics');
            
            activeSearches.clear();
            slowOperations.length = 0;
            
            set({
              renderCount: 0,
              lastRenderTime: Date.now(),
              searchPerformance: {
                totalSearches: 0,
                totalTime: 0,
                averageTime: 0,
                slowSearchCount: 0,
                fastestSearch: Infinity,
                slowestSearch: 0
              },
              stateChangeStats: {
                totalChanges: 0,
                changesBySlice: {},
                lastChangeTime: Date.now()
              }
            });
          },
          
          // Computed Properties (getters)
          get isSearchActive() {
            try {
              const state = get();
              return state && (state.loading || !!state.query);
            } catch (error) {
              console.warn('Store not fully initialized yet:', error);
              return false;
            }
          },
          
          get hasResults() {
            try {
              const state = get();
              return state && state.results && state.results.length > 0;
            } catch (error) {
              console.warn('Store not fully initialized yet:', error);
              return false;
            }
          },
          
          get isEmpty() {
            try {
              const state = get();
              return !state || (!state.query && (!state.results || state.results.length === 0));
            } catch (error) {
              console.warn('Store not fully initialized yet:', error);
              return true;
            }
          },
          
          // Computed Functions
          getActiveFilterCount: () => {
            const state = get();
            return Object.entries(state.appliedFilters).filter(([, value]) => {
              // Only count filters that have meaningful values
              return value !== undefined && value !== '' && value !== null;
            }).length;
          },

          getFilterSummary: () => {
            const state = get();
            const activeFilters: string[] = [];
            
            Object.entries(state.appliedFilters).forEach(([key, value]) => {
              // Only include filters with meaningful values
              if (value !== undefined && value !== '' && value !== null) {
                const label = key.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
                activeFilters.push(`${label}: ${value}`);
              }
            });
            
            return activeFilters.length > 0 
              ? activeFilters.join(', ') 
              : 'No filters applied';
          },

          getRecentSearches: (limit = 10) => {
            const state = get();
            return state.searchHistory.slice(0, limit);
          },

          getPopularSearches: (limit = 10) => {
            const state = get();
            
            // Count frequency of searches
            const frequency: Record<string, number> = {};
            state.recentQueries.forEach(query => {
              frequency[query.query] = (frequency[query.query] || 0) + 1;
            });
            
            // Sort by frequency and return top results
            return Object.entries(frequency)
              .sort(([, a], [, b]) => b - a)
              .slice(0, limit)
              .map(([query]) => query);
          },

          getSearchFrequency: (query) => {
            const state = get();
            return state.recentQueries.filter(q => q.query === query).length;
          },

          getPerformanceReport: (): PerformanceReport => {
            const state = get();
            const { searchPerformance, stateChangeStats, renderCount } = state;
            
            // Calculate performance score (0-100)
            let score = 100;
            
            // Deduct points for slow searches
            if (searchPerformance.totalSearches > 0) {
              const slowSearchRatio = searchPerformance.slowSearchCount / searchPerformance.totalSearches;
              score -= slowSearchRatio * 30;
            }
            
            // Deduct points for excessive renders
            if (renderCount > 100) {
              score -= Math.min(20, (renderCount - 100) / 10);
            }
            
            // Deduct points for excessive state changes
            if (stateChangeStats.totalChanges > 200) {
              score -= Math.min(15, (stateChangeStats.totalChanges - 200) / 20);
            }
            
            score = Math.max(0, Math.round(score));
            
            // Generate recommendations
            const recommendations: string[] = [];
            
            if (searchPerformance.averageTime > 1500) {
              recommendations.push('Consider optimizing search API calls or implementing caching');
            }
            
            if (renderCount > 150) {
              recommendations.push('High render count detected - consider using React.memo or useMemo');
            }
            
            if (stateChangeStats.totalChanges > 300) {
              recommendations.push('Frequent state changes detected - consider batching updates');
            }
            
            const mostActiveSlice = Object.entries(stateChangeStats.changesBySlice)
              .sort(([, a], [, b]) => b - a)[0];
            
            if (mostActiveSlice && mostActiveSlice[1] > 50) {
              recommendations.push(`Consider optimizing ${mostActiveSlice[0]} slice - it has the most state changes`);
            }
            
            return {
              renderCount,
              averageSearchTime: searchPerformance.averageTime,
              totalStateChanges: stateChangeStats.totalChanges,
              performanceScore: score,
              recommendations
            };
          },

          isPerformanceGood: () => {
            const state = get();
            const report = state.getPerformanceReport();
            return report.performanceScore >= 70;
          },

          getSlowOperations: () => {
            return [...slowOperations].sort((a, b) => b.timestamp - a.timestamp);
          },
          
          // Store Management
          performCompleteReset: () => {
            console.log('🔄 SearchStore: Performing complete reset');
            
            try {
              const state = get();
              if (state.clearResults) state.clearResults();
              if (state.resetFilters) state.resetFilters();
              if (state.clearSuggestions) state.clearSuggestions();
              if (state.resetPerformanceStats) state.resetPerformanceStats();
              
              // Don't clear history unless explicitly requested
              set({ query: '' });
            } catch (error) {
              console.warn('Error during store reset:', error);
            }
          },
          
          getStoreSnapshot: (): StoreSnapshot => {
            try {
              const state = get();
              return {
                query: state?.query || '',
                filters: state?.filters || {},
                searchHistory: state?.searchHistory || [],
                timestamp: Date.now()
              };
            } catch (error) {
              console.warn('Error getting store snapshot:', error);
              return {
                query: '',
                filters: {},
                searchHistory: [],
                timestamp: Date.now()
              };
            }
          },
          
          restoreFromSnapshot: (snapshot: StoreSnapshot) => {
            console.log('📷 SearchStore: Restoring from snapshot:', snapshot.timestamp);
            
            try {
              const state = get();
              if (state?.setQuery) state.setQuery(snapshot.query);
              if (state?.setFilters) state.setFilters(snapshot.filters);
              
              set({
                searchHistory: snapshot.searchHistory
              });
            } catch (error) {
              console.warn('Error restoring from snapshot:', error);
            }
          }
        };
      },
      {
        name: 'bhoomy-search-store',
        // Only persist necessary data for performance
        partialize: (state) => ({
          searchHistory: state.searchHistory || [],
          filters: state.filters || {},
          recentQueries: state.recentQueries ? state.recentQueries.slice(0, 20) : [] // Limit persisted queries
        }),
        // Version for migration support
        version: 1,
        migrate: (persistedState: any, version: number) => {
          console.log('🔄 SearchStore: Migrating from version:', version);
          
          // Handle migration from old store format
          if (version === 0) {
            return {
              ...persistedState,
              recentQueries: persistedState.searchHistory?.map((query: string) => ({
                query,
                timestamp: Date.now(),
                resultsCount: 0
              })) || []
            };
          }
          
          return persistedState;
        }
      }
    )
  )
);

// Performance monitoring subscription
let performanceMonitoringActive = false;

export const enablePerformanceMonitoring = () => {
  if (performanceMonitoringActive) return;
  
  console.log('📊 SearchStore: Enabling performance monitoring');
  performanceMonitoringActive = true;
  
  // Subscribe to state changes for performance tracking
  useSearchStore.subscribe(
    (state) => state,
    (state, prevState) => {
      // Track state changes per slice
      if (state.query !== prevState.query || 
          state.results !== prevState.results ||
          state.loading !== prevState.loading) {
        state.trackStateChange('search');
      }
      
      if (state.filters !== prevState.filters) {
        state.trackStateChange('filters');
      }
      
      if (state.searchHistory !== prevState.searchHistory ||
          state.suggestions !== prevState.suggestions) {
        state.trackStateChange('history');
      }
    }
  );
  
  // Log performance report every 30 seconds in development
  if (process.env.NODE_ENV === 'development') {
    setInterval(() => {
      const state = useSearchStore.getState();
      const report = state.getPerformanceReport();
      
      console.log('📊 Performance Report:', {
        score: report.performanceScore,
        renders: report.renderCount,
        avgSearchTime: report.averageSearchTime.toFixed(2) + 'ms',
        stateChanges: report.totalStateChanges,
        recommendations: report.recommendations
      });
    }, 30000);
  }
};

// Disable performance monitoring
export const disablePerformanceMonitoring = () => {
  console.log('📊 SearchStore: Disabling performance monitoring');
  performanceMonitoringActive = false;
};

// Enable performance monitoring by default in development
if (process.env.NODE_ENV === 'development') {
  enablePerformanceMonitoring();
}
