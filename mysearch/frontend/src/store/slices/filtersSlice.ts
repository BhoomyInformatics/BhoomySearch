import { StateCreator } from 'zustand';
import { SearchFilters } from '../../types';

// Filters-specific state slice
export interface FiltersSlice {
  // Filter state
  filters: SearchFilters;
  appliedFilters: SearchFilters;
  hasActiveFilters: boolean;
  
  // Filter actions
  setFilters: (filters: Partial<SearchFilters>) => void;
  applyFilters: () => void;
  resetFilters: () => void;
  clearAllFilters: () => void;
  
  // Computed filter properties
  getActiveFilterCount: () => number;
  getFilterSummary: () => string;
}

const defaultFilters: SearchFilters = {
  category: undefined,
  language: undefined,
  country: undefined,
  content_type: undefined,
  sort_by: undefined
};

export const createFiltersSlice: StateCreator<
  FiltersSlice,
  [],
  [],
  FiltersSlice
> = (set, get) => ({
  // Initial state
  filters: { ...defaultFilters },
  appliedFilters: { ...defaultFilters },
  hasActiveFilters: false,

  // Actions
  setFilters: (newFilters) => {
    const state = get();
    const updatedFilters = { ...state.filters, ...newFilters };
    
    console.log('🔧 FiltersSlice: Setting filters:', { 
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
    console.log('🔧 FiltersSlice: Applying filters:', state.filters);
    
    set({ 
      appliedFilters: { ...state.filters }
    });
  },

  resetFilters: () => {
    console.log('🔧 FiltersSlice: Resetting filters to default');
    
    set({
      filters: { ...defaultFilters },
      appliedFilters: { ...defaultFilters },
      hasActiveFilters: false
    });
  },

  clearAllFilters: () => {
    console.log('🔧 FiltersSlice: Clearing all filters');
    
    set({
      filters: { ...defaultFilters },
      appliedFilters: { ...defaultFilters },
      hasActiveFilters: false
    });
  },

  // Computed functions
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
  }
});
