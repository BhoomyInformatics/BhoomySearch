import React, { memo, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Filter, X } from 'lucide-react';
import { SearchFilters as SearchFiltersType } from '../../types';

interface SearchFiltersProps {
  filters: SearchFiltersType;
  onFiltersChange: (filters: Partial<SearchFiltersType>) => void;
  onReset: () => void;
  showFilters: boolean;
  onToggle: () => void;
  hasActiveFilters: boolean;
  activeFilterCount: number;
}

// Individual filter control components (memoized)
const CategoryFilter = memo<{
  value: string;
  onChange: (value: string) => void;
}>(({ value, onChange }) => {
  const handleChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value);
  }, [onChange]);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Category
      </label>
      <select
        value={value || ''}
        onChange={handleChange}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
      >
        <option value="">All Categories</option>
        <option value="technology">Technology</option>
        <option value="business">Business</option>
        <option value="science">Science</option>
        <option value="health">Health</option>
        <option value="education">Education</option>
        <option value="entertainment">Entertainment</option>
        <option value="sports">Sports</option>
        <option value="travel">Travel</option>
      </select>
    </div>
  );
});

CategoryFilter.displayName = 'CategoryFilter';

const SortFilter = memo<{
  value: string;
  onChange: (value: string) => void;
}>(({ value, onChange }) => {
  const handleChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value);
  }, [onChange]);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Sort By
      </label>
      <select
        value={value || ''}
        onChange={handleChange}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
      >
        <option value="">Sort by Relevance</option>
        <option value="relevance">Relevance</option>
        <option value="date">Date</option>
        <option value="popularity">Popularity</option>
        <option value="alphabetical">Alphabetical</option>
      </select>
    </div>
  );
});

SortFilter.displayName = 'SortFilter';

const ContentTypeFilter = memo<{
  value: string;
  onChange: (value: string) => void;
}>(({ value, onChange }) => {
  const handleChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value);
  }, [onChange]);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Content Type
      </label>
      <select
        value={value || ''}
        onChange={handleChange}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
      >
        <option value="">All Content Types</option>
        <option value="all">All Content</option>
        <option value="text">Text</option>
        <option value="images">Images</option>
        <option value="videos">Videos</option>
        <option value="news">News</option>
        <option value="documents">Documents</option>
      </select>
    </div>
  );
});

ContentTypeFilter.displayName = 'ContentTypeFilter';

const LanguageFilter = memo<{
  value: string;
  onChange: (value: string) => void;
}>(({ value, onChange }) => {
  const handleChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value);
  }, [onChange]);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Language
      </label>
      <select
        value={value || ''}
        onChange={handleChange}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
      >
        <option value="">Any Language</option>
        <option value="en">English</option>
        <option value="es">Spanish</option>
        <option value="fr">French</option>
        <option value="de">German</option>
        <option value="it">Italian</option>
        <option value="pt">Portuguese</option>
        <option value="ru">Russian</option>
        <option value="ja">Japanese</option>
        <option value="ko">Korean</option>
        <option value="zh">Chinese</option>
      </select>
    </div>
  );
});

LanguageFilter.displayName = 'LanguageFilter';

const CountryFilter = memo<{
  value: string;
  onChange: (value: string) => void;
}>(({ value, onChange }) => {
  const handleChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value);
  }, [onChange]);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Country
      </label>
      <select
        value={value || ''}
        onChange={handleChange}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
      >
        <option value="">Any Country</option>
        <option value="US">United States</option>
        <option value="UK">United Kingdom</option>
        <option value="CA">Canada</option>
        <option value="AU">Australia</option>
        <option value="DE">Germany</option>
        <option value="FR">France</option>
        <option value="ES">Spain</option>
        <option value="IT">Italy</option>
        <option value="JP">Japan</option>
        <option value="IN">India</option>
      </select>
    </div>
  );
});

CountryFilter.displayName = 'CountryFilter';

// Active filters indicator (memoized)
const ActiveFiltersIndicator = memo<{
  hasActiveFilters: boolean;
  activeFilterCount: number;
  onReset: () => void;
}>(({ hasActiveFilters, activeFilterCount, onReset }) => {
  if (!hasActiveFilters) return null;

  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-sm text-gray-600 dark:text-gray-400">
        {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} applied
      </span>
      <button
        onClick={onReset}
        className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
      >
        <X className="w-3 h-3" />
        Clear all
      </button>
    </div>
  );
});

ActiveFiltersIndicator.displayName = 'ActiveFiltersIndicator';

// Main filters component (memoized)
const SearchFilters = memo<SearchFiltersProps>(({
  filters,
  onFiltersChange,
  onReset,
  showFilters,
  onToggle,
  hasActiveFilters,
  activeFilterCount
}) => {
  console.log('🔄 SearchFilters: Component rendering with filters:', filters);

  // Memoized filter change handlers
  const handleCategoryChange = useCallback((category: string) => {
    onFiltersChange({ category: category || undefined });
  }, [onFiltersChange]);

  const handleSortChange = useCallback((sort_by: string) => {
    onFiltersChange({ sort_by: sort_by as 'relevance' | 'date' | 'popularity' });
  }, [onFiltersChange]);

  const handleContentTypeChange = useCallback((content_type: string) => {
    onFiltersChange({ content_type: content_type as 'all' | 'text' | 'images' | 'videos' | 'news' });
  }, [onFiltersChange]);

  const handleLanguageChange = useCallback((language: string) => {
    onFiltersChange({ language: language || undefined });
  }, [onFiltersChange]);

  const handleCountryChange = useCallback((country: string) => {
    onFiltersChange({ country: country || undefined });
  }, [onFiltersChange]);

  // Memoized filter controls
  const filterControls = useMemo(() => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <CategoryFilter 
        value={filters.category || ''} 
        onChange={handleCategoryChange} 
      />
      <SortFilter 
        value={filters.sort_by || 'relevance'} 
        onChange={handleSortChange} 
      />
      <ContentTypeFilter 
        value={filters.content_type || 'all'} 
        onChange={handleContentTypeChange} 
      />
      <LanguageFilter 
        value={filters.language || ''} 
        onChange={handleLanguageChange} 
      />
      <CountryFilter 
        value={filters.country || ''} 
        onChange={handleCountryChange} 
      />
    </div>
  ), [
    filters.category,
    filters.sort_by,
    filters.content_type,
    filters.language,
    filters.country,
    handleCategoryChange,
    handleSortChange,
    handleContentTypeChange,
    handleLanguageChange,
    handleCountryChange
  ]);

  return (
    <div className="mb-8">
      {/* Filter Toggle Button */}
      <div className="flex items-center justify-between mb-4" style={{ paddingLeft: '25px', paddingRight: '25px' }}>
        <button
          onClick={onToggle}
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <Filter className="w-4 h-4" />
          Filters
          {hasActiveFilters && (
            <span className="ml-1 px-2 py-0.5 text-xs bg-blue-500 text-white rounded-full">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md filters-section"
          style={{ marginLeft: '25px', marginRight: '25px' }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Search Filters
            </h3>
            <ActiveFiltersIndicator
              hasActiveFilters={hasActiveFilters}
              activeFilterCount={activeFilterCount}
              onReset={onReset}
            />
          </div>
          
          {filterControls}
        </motion.div>
      )}
    </div>
  );
});

SearchFilters.displayName = 'SearchFilters';

export default SearchFilters;
