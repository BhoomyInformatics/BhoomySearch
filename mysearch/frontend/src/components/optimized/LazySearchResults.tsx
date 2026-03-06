/**
 * Lazy Loading Search Results Component
 * Implements virtual scrolling and lazy loading for better performance
 */

import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SearchResult } from '../../types';

interface LazySearchResultsProps {
  results: SearchResult[];
  loading: boolean;
  onResultClick: (result: SearchResult) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  itemsPerPage?: number;
}

interface VirtualizedItem {
  index: number;
  result: SearchResult;
  height: number;
  top: number;
}

const ITEM_HEIGHT = 120; // Estimated height of each result item
const BUFFER_SIZE = 5; // Extra items to render outside viewport

const LazySearchResults: React.FC<LazySearchResultsProps> = memo(({
  results,
  loading,
  onResultClick,
  onLoadMore,
  hasMore = false,
  itemsPerPage = 20
}) => {
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: itemsPerPage });
  const [containerHeight, setContainerHeight] = useState(600);
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);

  // Calculate visible items based on scroll position
  const calculateVisibleRange = useCallback((scrollTop: number, containerHeight: number, totalItems: number) => {
    const start = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - BUFFER_SIZE);
    const end = Math.min(totalItems, Math.ceil((scrollTop + containerHeight) / ITEM_HEIGHT) + BUFFER_SIZE);
    return { start, end };
  }, []);

  // Handle scroll events
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const newScrollTop = target.scrollTop;
    const newContainerHeight = target.clientHeight;
    
    setScrollTop(newScrollTop);
    setContainerHeight(newContainerHeight);
    
    const newRange = calculateVisibleRange(newScrollTop, newContainerHeight, results.length);
    setVisibleRange(newRange);
  }, [results.length, calculateVisibleRange]);

  // Set up intersection observer for load more
  useEffect(() => {
    if (!loadMoreTriggerRef.current || !onLoadMore || !hasMore) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading) {
          onLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    observerRef.current.observe(loadMoreTriggerRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [onLoadMore, hasMore, loading]);

  // Update visible range when results change
  useEffect(() => {
    const newRange = calculateVisibleRange(scrollTop, containerHeight, results.length);
    setVisibleRange(newRange);
  }, [results.length, scrollTop, containerHeight, calculateVisibleRange]);

  // Generate virtualized items
  const virtualizedItems: VirtualizedItem[] = results
    .slice(visibleRange.start, visibleRange.end)
    .map((result, index) => ({
      index: visibleRange.start + index,
      result,
      height: ITEM_HEIGHT,
      top: (visibleRange.start + index) * ITEM_HEIGHT
    }));

  // Calculate total height for virtual scrolling
  const totalHeight = results.length * ITEM_HEIGHT;

  // Render individual result item
  const renderResultItem = useCallback((item: VirtualizedItem) => {
    const { result, top } = item;
    
    return (
      <motion.div
        key={result.id || item.index}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.2 }}
        style={{
          position: 'absolute',
          top,
          left: 0,
          right: 0,
          height: ITEM_HEIGHT
        }}
        className="px-4 py-3"
      >
        <div
          className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow cursor-pointer h-full"
          onClick={() => onResultClick(result)}
        >
          <div className="flex items-start space-x-3">
            {/* Result Icon */}
            <div className="flex-shrink-0 mt-1">
              {result.site_data_icon ? (
                <img
                  src={result.site_data_icon}
                  alt=""
                  className="w-4 h-4 rounded"
                  loading="lazy"
                />
              ) : (
                <div className="w-4 h-4 bg-gray-300 dark:bg-gray-600 rounded"></div>
              )}
            </div>
            
            {/* Result Content */}
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-medium text-blue-600 dark:text-blue-400 hover:underline line-clamp-2">
                {result.site_data_title || 'Untitled'}
              </h3>
              
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                {result.site_data_description || 'No description available'}
              </p>
              
              <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500 dark:text-gray-500">
                <span className="truncate max-w-xs">
                  {result.site_data_link || '#'}
                </span>
                {result.site_data_date && (() => {
                  try {
                    const date = new Date(result.site_data_date);
                    return isNaN(date.getTime()) ? null : (
                      <span>{date.toLocaleDateString()}</span>
                    );
                  } catch {
                    return null;
                  }
                })()}
                {result.site_title && (
                  <span className="text-gray-400">
                    {result.site_title}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }, [onResultClick]);

  if (results.length === 0 && !loading) {
    return (
      <div className="text-center py-16">
        <div className="text-gray-400 text-lg">No results found</div>
        <p className="text-gray-500 mt-2">Try adjusting your search terms or filters</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Virtual scrolling container */}
      <div
        ref={containerRef}
        className="overflow-auto"
        style={{ height: '600px' }}
        onScroll={handleScroll}
      >
        <div style={{ height: totalHeight, position: 'relative' }}>
          <AnimatePresence>
            {virtualizedItems.map(renderResultItem)}
          </AnimatePresence>
        </div>
        
        {/* Load more trigger */}
        {hasMore && (
          <div
            ref={loadMoreTriggerRef}
            className="flex justify-center py-4"
            style={{ height: '60px' }}
          >
            {loading && (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-sm text-gray-500">Loading more results...</span>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Performance info (development only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-4 text-xs text-gray-400">
          Rendering {virtualizedItems.length} of {results.length} items
          (Range: {visibleRange.start}-{visibleRange.end})
        </div>
      )}
    </div>
  );
});

LazySearchResults.displayName = 'LazySearchResults';

export default LazySearchResults;
