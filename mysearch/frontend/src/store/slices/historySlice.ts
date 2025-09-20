import { StateCreator } from 'zustand';

// History and suggestions slice
export interface HistorySlice {
  // History state
  searchHistory: string[];
  suggestions: string[];
  recentQueries: Array<{
    query: string;
    timestamp: number;
    resultsCount: number;
  }>;
  
  // History actions
  addToHistory: (query: string, resultsCount?: number) => void;
  removeFromHistory: (query: string) => void;
  clearHistory: () => void;
  setSuggestions: (suggestions: string[]) => void;
  clearSuggestions: () => void;
  
  // Computed history properties
  getRecentSearches: (limit?: number) => string[];
  getPopularSearches: (limit?: number) => string[];
  getSearchFrequency: (query: string) => number;
}

export const createHistorySlice: StateCreator<
  HistorySlice,
  [],
  [],
  HistorySlice
> = (set, get) => ({
  // Initial state
  searchHistory: [],
  suggestions: [],
  recentQueries: [],

  // Actions
  addToHistory: (query, resultsCount = 0) => {
    const state = get();
    const trimmedQuery = query.trim();
    
    if (!trimmedQuery || trimmedQuery.length < 2) {
      return;
    }
    
    console.log('📚 HistorySlice: Adding to history:', { query: trimmedQuery, resultsCount });
    
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
    console.log('📚 HistorySlice: Removing from history:', query);
    
    set({
      searchHistory: state.searchHistory.filter(q => q !== query),
      recentQueries: state.recentQueries.filter(q => q.query !== query)
    });
  },

  clearHistory: () => {
    console.log('📚 HistorySlice: Clearing all history');
    
    set({ 
      searchHistory: [],
      recentQueries: []
    });
  },

  setSuggestions: (suggestions) => {
    console.log('📚 HistorySlice: Setting suggestions:', suggestions.length);
    
    set({ suggestions });
  },

  clearSuggestions: () => {
    console.log('📚 HistorySlice: Clearing suggestions');
    
    set({ suggestions: [] });
  },

  // Computed functions
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
  }
});
