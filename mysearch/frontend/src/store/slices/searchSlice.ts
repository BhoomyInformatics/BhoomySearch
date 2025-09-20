import { StateCreator } from 'zustand';
import { SearchResult } from '../../types';

// Search-specific state slice
export interface SearchSlice {
  // Core search state
  query: string;
  results: SearchResult[];
  total: number;
  currentPage: number;
  loading: boolean;
  error: string | null;
  
  // Performance tracking
  lastSearchTime: number;
  searchRequestId: string | null;
  
  // Search actions
  setQuery: (query: string) => void;
  setResults: (results: SearchResult[], total: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setCurrentPage: (page: number) => void;
  clearResults: () => void;
  
  // Performance actions
  startSearch: (requestId: string) => void;
  endSearch: () => void;
}

export const createSearchSlice: StateCreator<
  SearchSlice,
  [],
  [],
  SearchSlice
> = (set, get) => ({
  // Initial state
  query: '',
  results: [],
  total: 0,
  currentPage: 1,
  loading: false,
  error: null,
  lastSearchTime: 0,
  searchRequestId: null,

  // Actions
  setQuery: (query) => {
    console.log('🔍 SearchSlice: Setting query:', query);
    set({ query });
  },

  setResults: (results, total) => {
    const state = get();
    console.log('🔍 SearchSlice: Setting results:', { 
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
    console.log('🔍 SearchSlice: Setting loading:', loading);
    set({ loading });
  },

  setError: (error) => {
    console.log('🔍 SearchSlice: Setting error:', error);
    set({ 
      error, 
      loading: false,
      results: [],
      total: 0
    });
  },

  setCurrentPage: (currentPage) => {
    console.log('🔍 SearchSlice: Setting current page:', currentPage);
    set({ currentPage });
  },

  clearResults: () => {
    console.log('🔍 SearchSlice: Clearing results');
    set({
      results: [],
      total: 0,
      currentPage: 1,
      error: null,
      loading: false
    });
  },

  startSearch: (requestId) => {
    console.log('🔍 SearchSlice: Starting search with ID:', requestId);
    set({
      loading: true,
      error: null,
      searchRequestId: requestId,
      lastSearchTime: Date.now()
    });
  },

  endSearch: () => {
    const state = get();
    const searchDuration = Date.now() - state.lastSearchTime;
    console.log('🔍 SearchSlice: Search completed in:', searchDuration + 'ms');
    
    set({
      loading: false,
      searchRequestId: null
    });
  }
});
