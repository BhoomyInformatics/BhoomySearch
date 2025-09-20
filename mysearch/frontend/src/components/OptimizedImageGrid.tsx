import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import LazyImage from './LazyImage';

interface ImageResult {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  source: string;
  width?: number;
  height?: number;
  size?: string;
  alt?: string;
}

interface OptimizedImageGridProps {
  images: ImageResult[];
  loading: boolean;
  onImageClick: (image: ImageResult, index: number) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  totalImages?: number;
  className?: string;
}

const OptimizedImageGrid: React.FC<OptimizedImageGridProps> = ({
  images,
  loading,
  onImageClick,
  onLoadMore,
  hasMore = false,
  totalImages = 0,
  className = ''
}) => {
  const [visibleImages, setVisibleImages] = useState<ImageResult[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Memoized image component to prevent unnecessary re-renders
  const ImageItem = React.memo<{
    image: ImageResult;
    index: number;
    onClick: (image: ImageResult, index: number) => void;
  }>(({ image, index, onClick }) => (
    <motion.div
      key={image.id}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ 
        duration: 0.3, 
        delay: index * 0.02 // Staggered animation
      }}
      className="image-resultitem"
      style={{
        width: 'calc(20% - 6px)',
        height: '200px',
        position: 'relative',
        cursor: 'pointer',
        marginBottom: '6px'
      }}
      onClick={() => onClick(image, index)}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <LazyImage
        src={image.thumbnail}
        alt={image.alt || image.title || 'Image'}
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '8px',
          border: '1px solid #ddd'
        }}
        threshold={0.1}
        rootMargin="100px"
      />
      
      {/* Download button overlay */}
      <div
        style={{
          position: 'absolute',
          bottom: '5px',
          right: '5px',
          opacity: 0,
          transition: 'opacity 0.2s ease'
        }}
        className="image-overlay"
      >
        <a
          href={image.url}
          download="image.jpg"
          className="download-button"
          onClick={(e) => e.stopPropagation()}
          style={{
            backgroundColor: 'rgba(0,0,0,0.7)',
            color: 'white',
            padding: '5px',
            borderRadius: '3px',
            fontSize: '12px',
            textDecoration: 'none',
            display: 'block'
          }}
        >
          ⬇
        </a>
      </div>
    </motion.div>
  ));

  // Handle load more button click
  const handleLoadMore = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (onLoadMore && hasMore && !loading && !isLoadingMore) {
      console.log('🔄 OptimizedImageGrid: Load More button clicked');
      setIsLoadingMore(true);
      onLoadMore();
    }
  }, [onLoadMore, hasMore, loading, isLoadingMore]);

  // Reset loading state when images change (new images loaded)
  useEffect(() => {
    if (isLoadingMore && images.length > 0) {
      // Small delay to ensure images are rendered before hiding loading state
      const timer = setTimeout(() => {
        setIsLoadingMore(false);
        console.log('✅ OptimizedImageGrid: New images loaded, hiding loading state');
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [images.length, isLoadingMore]);

  // Update visible images when images prop changes
  useEffect(() => {
    setVisibleImages(images);
    setIsLoadingMore(false);
  }, [images]);

  // Grid styles
  const gridStyles = useMemo(() => ({
    display: 'flex',
    flexWrap: 'wrap' as const,
    justifyContent: 'space-between',
    gap: '6px',
    padding: '10px',
    minHeight: '400px'
  }), []);

  // Debug hasMore state
  console.log('🔍 OptimizedImageGrid: Render state', {
    hasMore,
    loading,
    isLoadingMore,
    imagesCount: images.length,
    onLoadMore: !!onLoadMore
  });

  return (
    <div className={`optimized-image-grid ${className}`}>
      <div
        ref={containerRef}
        className="pictureView viewchange picflex"
        style={gridStyles}
      >
        <AnimatePresence>
          {loading && images.length === 0 ? (
            <div className="loading-container" style={{ width: '100%', textAlign: 'center', padding: '40px' }}>
              <div className="animate-spin inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
              <p className="mt-4 text-gray-600">Loading images...</p>
            </div>
          ) : (
            visibleImages.map((image, index) => (
              <ImageItem
                key={image.id}
                image={image}
                index={index}
                onClick={onImageClick}
              />
            ))
          )}
        </AnimatePresence>

        {/* Load More Button - Only show when there are more images and not currently loading */}
        {hasMore && images.length > 0 && !isLoadingMore && (
          <div style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '30px 0',
            flexDirection: 'column',
            gap: '15px'
          }}>
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={loading || isLoadingMore}
              style={{
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '15px 30px',
                cursor: loading || isLoadingMore ? 'not-allowed' : 'pointer',
                fontSize: '16px',
                fontWeight: '600',
                opacity: loading || isLoadingMore ? 0.6 : 1,
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                minWidth: '200px'
              }}
              onMouseEnter={(e) => {
                if (!loading && !isLoadingMore) {
                  e.currentTarget.style.backgroundColor = '#2563eb';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
                }
              }}
              onMouseLeave={(e) => {
                if (!loading && !isLoadingMore) {
                  e.currentTarget.style.backgroundColor = '#3b82f6';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                }
              }}
            >
              Load More Images
            </button>
            
            <div style={{ 
              fontSize: '14px', 
              color: '#666',
              textAlign: 'center',
              maxWidth: '400px'
            }}>
              Click the button above to load 100 more images
            </div>
          </div>
        )}

        {/* Loading indicator - Show when loading more images */}
        {isLoadingMore && (
          <div style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '30px 0',
            flexDirection: 'column',
            gap: '15px'
          }}>
            <div className="loading-more" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '20px',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              border: '1px solid #e9ecef',
              minWidth: '200px',
              justifyContent: 'center'
            }}>
              <div className="animate-spin inline-block w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full"></div>
              <span className="text-gray-600">Loading more images...</span>
            </div>
            
            <div style={{ 
              fontSize: '14px', 
              color: '#666',
              textAlign: 'center',
              maxWidth: '400px'
            }}>
              Please wait while we load 100 more images...
            </div>
          </div>
        )}

        {/* Debug info when hasMore is false */}
        {!hasMore && images.length > 0 && (
          <div style={{
            width: '100%',
            textAlign: 'center',
            padding: '30px',
            backgroundColor: '#f8f9fa',
            border: '1px solid #e9ecef',
            borderRadius: '8px',
            margin: '20px 0',
            fontSize: '16px',
            color: '#666'
          }}>
            <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '10px' }}>
              ✅ All images loaded
            </div>
            <div style={{ fontSize: '14px' }}>
              {totalImages > 0 ? `${totalImages} images total` : `${images.length} images loaded`} • No more images available
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OptimizedImageGrid;