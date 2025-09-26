import { memo, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Clock, ExternalLink } from 'lucide-react';
import { SearchResult } from '../../types';

interface SearchResultsProps {
  results: SearchResult[];
  loading: boolean;
  onResultClick?: (result: SearchResult) => void;
}

// Individual search result component (memoized)
const SearchResultItem = memo<{
  result: SearchResult;
  index: number;
  onResultClick?: (result: SearchResult) => void;
}>(({ result, index, onResultClick }) => {
  const handleClick = useCallback(() => {
    onResultClick?.(result);
  }, [result, onResultClick]);

  const formatDate = useCallback((dateString: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }, []);

  const { sourceName, wordCount } = useMemo(() => {
    // Extract domain name as source if site_title is not available
    const getSourceName = (url: string, siteTitle?: string) => {
      if (siteTitle) return siteTitle;
      try {
        const domain = new URL(url).hostname;
        return domain.replace('www.', '').split('.')[0];
      } catch {
        return 'Unknown Source';
      }
    };
    
    // Calculate word count if not available
    const getWordCount = (wordCount?: number, description?: string, article?: string) => {
      if (wordCount) return wordCount;
      const text = (description || '') + ' ' + (article || '');
      const words = text.trim().split(/\s+/).filter(word => word.length > 0);
      return words.length;
    };
    
    return {
      sourceName: getSourceName(result.site_data_link, result.site_title),
      wordCount: getWordCount(result.word_count, result.site_data_description, result.site_data_article)
    };
  }, [result.site_data_link, result.site_title, result.word_count, result.site_data_description, result.site_data_article]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md hover:shadow-lg transition-shadow duration-300"
      onClick={handleClick}
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-xl font-semibold text-blue-600 dark:text-blue-400 hover:underline">
          <a 
            href={result.site_data_link} 
            target="_blank" 
            rel="noopener noreferrer"
            className="focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
          >
            {result.site_data_title}
          </a>
        </h3>
        <a
          href={result.site_data_link}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-gray-500 hover:text-blue-600 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded p-1"
          aria-label="Open in new tab"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
      
      <p className="text-green-600 dark:text-green-400 text-sm mb-2 break-all">
        {result.site_data_link}
      </p>
      
      <p className="text-gray-700 dark:text-gray-300 mb-3 line-clamp-3">
        {result.site_data_description || result.site_data_meta_description}
      </p>
      
      <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
        {result.site_data_date && (
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            <span>{formatDate(result.site_data_date)}</span>
          </div>
        )}
        <span>Source: {sourceName}</span>
        <span>{wordCount} words</span>
      </div>
    </motion.div>
  );
});

SearchResultItem.displayName = 'SearchResultItem';

// Main search results component (memoized)
const SearchResults = memo<SearchResultsProps>(({ results, loading, onResultClick }) => {
  console.log('🔄 SearchResults: Component rendering with', results.length, 'results');

  const resultItems = useMemo(() => {
    if (results.length === 0) return null;

    return results.map((result, index) => (
      <SearchResultItem
        key={result.id || `${result.site_data_id}-${index}`}
        result={result}
        index={index}
        onResultClick={onResultClick}
      />
    ));
  }, [results, onResultClick]);

  // Only show full-page loader when there are no results yet (initial load)
  if (loading && results.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
        <span className="ml-3 text-gray-600 dark:text-gray-400">Searching...</span>
      </div>
    );
  }

  if (results.length === 0) {
    return null; // Let parent handle empty state
  }

  return (
    <div className="space-y-6 mb-8 search-results-section" style={{ paddingLeft: '25px', paddingRight: '25px' }}>
      {resultItems}
      {loading && results.length > 0 && (
        <div className="flex items-center justify-center py-6" aria-live="polite">
          <div className="animate-spin w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-400">Loading more…</span>
        </div>
      )}
    </div>
  );
});

SearchResults.displayName = 'SearchResults';

export default SearchResults;
