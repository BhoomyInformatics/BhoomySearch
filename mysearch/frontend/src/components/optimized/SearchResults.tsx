import { memo, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Bookmark, Clock, Globe, MoreVertical, Share2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SearchResult } from '../../types';
// USER LOGIN ACCESS TEMPORARILY DISABLED - All users can access all data
// import { useAuthStore } from '../../store/authStore';


interface SearchResultsProps {
  results: SearchResult[];
  loading: boolean;
  onResultClick?: (result: SearchResult) => void;
  query?: string;
  total?: number;
}

// Helper function to calculate relevance score (extracted for sorting and display)
const calculateRelevanceScore = (result: SearchResult, query?: string): number => {
  // If score is provided (0-100), use it directly as percentage
  if (result.score !== undefined && result.score !== null) {
    const normalizedScore = Math.max(0, Math.min(100, result.score));
    return Math.round(normalizedScore);
  }
  
  // If no score, calculate based on query match in title and description
  if (query && result) {
    const queryLower = query.toLowerCase();
    const titleLower = (result.site_data_title || '').toLowerCase();
    const descLower = (result.site_data_description || '').toLowerCase();
    const keywordsLower = (result.site_data_keywords || '').toLowerCase();
    
    let matchScore = 0;
    
    // Title match (40% weight)
    if (titleLower.includes(queryLower)) {
      matchScore += 40;
    } else {
      // Partial match in title
      const queryWords = queryLower.split(/\s+/);
      const matchedWords = queryWords.filter(word => titleLower.includes(word));
      matchScore += (matchedWords.length / queryWords.length) * 40;
    }
    
    // Description match (30% weight)
    if (descLower.includes(queryLower)) {
      matchScore += 30;
    } else {
      const queryWords = queryLower.split(/\s+/);
      const matchedWords = queryWords.filter(word => descLower.includes(word));
      matchScore += (matchedWords.length / queryWords.length) * 30;
    }
    
    // Keywords match (20% weight)
    if (keywordsLower.includes(queryLower)) {
      matchScore += 20;
    } else {
      const queryWords = queryLower.split(/\s+/);
      const matchedWords = queryWords.filter(word => keywordsLower.includes(word));
      matchScore += (matchedWords.length / queryWords.length) * 20;
    }
    
    // Base relevance (10% weight)
    matchScore += 10;
    
    return Math.round(Math.min(100, matchScore));
  }
  
  // Default score if no query or result
  return 75;
};

// Individual search result component (memoized)
const SearchResultItem = memo<{
  result: SearchResult;
  index: number;
  onResultClick?: (result: SearchResult) => void;
  query?: string;
}>(({ result, index, onResultClick, query }) => {
  const navigate = useNavigate();
  // USER LOGIN ACCESS TEMPORARILY DISABLED - All users can access all data
  // const { isAuthenticated } = useAuthStore();
  const isAuthenticated = true; // Temporarily set to true so all users see full data
  
  const handleClick = useCallback(() => {
    onResultClick?.(result);
  }, [result, onResultClick]);

  const handleMoreInfoClick = useCallback(() => {
    navigate('/signup', { state: { from: { pathname: window.location.pathname + window.location.search } } });
  }, [navigate]);

  const formatDate = useCallback((dateString: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return '';
    }
  }, []);

  const relevanceScore = useMemo(() => {
    return calculateRelevanceScore(result, query);
  }, [result, query]);

  const { displayDomain, displayUrl } = useMemo(() => {
    try {
      const url = new URL(result.site_data_link);
      const domain = url.hostname.replace('www.', '');
      const urlPath = `${url.protocol}//${domain}${url.pathname}${url.search}`;
      return {
        displayDomain: domain,
        displayUrl: urlPath
      };
    } catch {
      return {
        displayDomain: result.site_url || 'Unknown source',
        displayUrl: result.site_data_link || ''
      };
    }
  }, [result.site_data_link, result.site_url]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className="bg-white dark:bg-gray-800 rounded-3xl p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow duration-300 border border-slate-100 dark:border-gray-700 w-full lg:w-[70%]"
      onClick={handleClick}
    >
      {/* Top source row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 rounded-full bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
            {result.site_data_icon ? (
              <img
                src={result.site_data_icon}
                alt=""
                className="w-6 h-6"
                loading="lazy"
                onError={(e) => {
                  // Hide broken favicon image (fallback icon is shown below via background)
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <Globe className="w-5 h-5 text-orange-500" aria-hidden="true" />
            )}
          </div>

          <div className="min-w-0">
            <div className="text-[15px] font-semibold text-slate-900 dark:text-white truncate">
              {displayDomain}
            </div>
            <div className="text-[13px] text-slate-400 dark:text-gray-400 truncate">
              {displayUrl}
            </div>
          </div>
        </div>

        <button
          type="button"
          className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
          aria-label="More options"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <MoreVertical className="w-5 h-5 text-slate-500" />
        </button>
      </div>

      {/* Title */}
      <h3 className="text-xl sm:text-2xl font-semibold text-blue-600 dark:text-blue-400 leading-snug mb-3">
        {isAuthenticated ? (
          <a
            href={result.site_data_link}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded break-words"
            onClick={(e) => e.stopPropagation()}
          >
            {result.site_data_title}
          </a>
        ) : (
          <span className="break-words">{result.site_data_title}</span>
        )}
      </h3>
      
      {/* Snippet */}
      <p className="text-slate-600 dark:text-gray-300 mb-5 line-clamp-3 text-sm sm:text-base leading-relaxed">
        {result.site_data_description || result.site_data_meta_description}
      </p>
      
      {!isAuthenticated && (
        <motion.button
          onClick={handleMoreInfoClick}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.05, y: -2 }}
          whileTap={{ scale: 0.95 }}
          className="mb-2 px-4 py-2 bg-white border-2 border-orange-200 rounded-lg hover:border-orange-400 hover:bg-orange-50 transition-all shadow-sm"
        >
          <span className="text-sm font-medium text-gray-700">Click here for more info</span>
        </motion.button>
      )}
      
      {/* Bottom meta row (mobile: date+relevance on one line; actions below) */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        {/* Mobile/desktop top line: date + relevance */}
        <div className="flex items-center justify-between gap-3 w-full sm:w-auto order-1">
          <div className="flex items-center gap-1 text-xs text-slate-400 dark:text-gray-400 min-w-0">
            {result.site_data_date && (
              <>
                <Clock className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{formatDate(result.site_data_date)}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 justify-end min-w-[200px] sm:min-w-[170px]">
            <div className="w-24 sm:w-32 h-2 rounded-full bg-slate-200 dark:bg-gray-700 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(0, Math.min(100, relevanceScore))}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full rounded-full"
                style={{ backgroundColor: '#22c55e' }}
              />
            </div>
            <div className="text-xs sm:text-sm font-semibold text-green-600 dark:text-green-400 whitespace-nowrap">
              {relevanceScore}% Relevance 
            </div>
          </div>
        </div>

        {/* Actions (smaller buttons; on mobile full width row below) */}
        <div className="flex items-center gap-3 w-full sm:w-auto order-2">
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 sm:px-4 sm:py-2 rounded-full border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors text-slate-700 dark:text-gray-200 flex-1 sm:flex-none"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            aria-label="Save result"
          >
            <Bookmark className="w-4 h-4" />
            <span className="text-sm font-medium">Save</span>
          </button>

          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 sm:px-4 sm:py-2 rounded-full border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors text-slate-700 dark:text-gray-200 flex-1 sm:flex-none"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            aria-label="Share result"
          >
            <Share2 className="w-4 h-4" />
            <span className="text-sm font-medium">Share</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
});

SearchResultItem.displayName = 'SearchResultItem';

// Main search results component (memoized)
const SearchResults = memo<SearchResultsProps>(({ results, loading, onResultClick, query }) => {
  console.log('🔄 SearchResults: Component rendering with', results.length, 'results');

  // Sort results by relevance score (highest first)
  const sortedResults = useMemo(() => {
    if (results.length === 0) return [];
    
    return [...results].sort((a, b) => {
      const scoreA = calculateRelevanceScore(a, query);
      const scoreB = calculateRelevanceScore(b, query);
      return scoreB - scoreA; // Descending order (highest first)
    });
  }, [results, query]);

  const resultItems = useMemo(() => {
    if (sortedResults.length === 0) return null;

    return sortedResults.map((result, index) => (
      <SearchResultItem
        key={result.id || `${result.site_data_id}-${index}`}
        result={result}
        index={index}
        onResultClick={onResultClick}
        query={query}
      />
    ));
  }, [sortedResults, onResultClick, query]);

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
    <div className="space-y-4 sm:space-y-6 mb-6 sm:mb-8 search-results-section px-2 sm:px-4 md:px-6 lg:px-8">
      {resultItems}
      {loading && sortedResults.length > 0 && (
        <div className="flex items-center justify-center py-4 sm:py-6" aria-live="polite">
          <div className="animate-spin w-5 h-5 sm:w-6 sm:h-6 border-4 border-blue-500 border-t-transparent rounded-full"></div>
          <span className="ml-2 sm:ml-3 text-sm sm:text-base text-gray-600 dark:text-gray-400">Loading more…</span>
        </div>
      )}
    </div>
  );
});

SearchResults.displayName = 'SearchResults';

export default SearchResults;
