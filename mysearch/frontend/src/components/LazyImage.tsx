import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';

// Helper function to check if URL looks like an image
const isImageUrl = (url: string): boolean => {
  if (!url) return false;
  
  // Check for common image extensions
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico'];
  const lowerUrl = url.toLowerCase();
  
  return imageExtensions.some(ext => lowerUrl.includes(ext)) || 
         lowerUrl.includes('image') || 
         lowerUrl.includes('photo') ||
         lowerUrl.includes('picture');
};

// Helper function to get image URL with proxy for external images
const getImageUrl = (url: string): string => {
  if (!url) return '';
  
  // If it's an external URL and looks like an image, use the proxy
  if (url.startsWith('http') && !url.includes(window.location.hostname) && isImageUrl(url)) {
    return `/api/image-proxy?url=${encodeURIComponent(url)}`;
  }
  
  return url;
};

// Helper function to get fallback URL (original URL if proxy fails)
const getFallbackUrl = (url: string): string => {
  if (!url) return '';
  return url;
};

// Cache for failed image URLs to avoid retrying
const failedImageCache = new Set<string>();

// Helper function to check if URL has failed before
const hasFailedBefore = (url: string): boolean => {
  return failedImageCache.has(url);
};

// Helper function to mark URL as failed
const markAsFailed = (url: string): void => {
  failedImageCache.add(url);
};

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  onLoad?: () => void;
  placeholder?: string;
  threshold?: number;
  rootMargin?: string;
}

const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  className = '',
  style = {},
  onClick,
  onLoad,
  placeholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5YTNhZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkxvYWRpbmcuLi48L3RleHQ+PC9zdmc+',
  threshold = 0.1,
  rootMargin = '50px'
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(() => {
    // Check if this URL has failed before
    if (hasFailedBefore(src)) {
      setHasError(true);
      return placeholder;
    }
    return getImageUrl(src);
  });
  const [retryCount, setRetryCount] = useState(0);
  const [loadingTimeout, setLoadingTimeout] = useState<NodeJS.Timeout | null>(null);
  const imgRef = useRef<HTMLDivElement>(null);

  // Intersection Observer callback
  const handleIntersection = useCallback((entries: IntersectionObserverEntry[]) => {
    const [entry] = entries;
    if (entry.isIntersecting) {
      setIsInView(true);
      
      // Set a timeout to show error if image doesn't load within 10 seconds
      const timeout = setTimeout(() => {
        if (!isLoaded && !hasError) {
          console.warn('⏰ LazyImage: Loading timeout for:', currentSrc);
          markAsFailed(currentSrc);
          setHasError(true);
          setIsLoaded(true);
        }
      }, 10000); // 10 second timeout
      
      setLoadingTimeout(timeout);
    }
  }, [currentSrc, isLoaded, hasError]);

  // Set up Intersection Observer
  useEffect(() => {
    const observer = new IntersectionObserver(handleIntersection, {
      threshold,
      rootMargin
    });

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => {
      if (imgRef.current) {
        observer.unobserve(imgRef.current);
      }
      // Clear timeout on cleanup
      if (loadingTimeout) {
        clearTimeout(loadingTimeout);
      }
    };
  }, [handleIntersection, threshold, rootMargin, loadingTimeout]);

  // Handle image load
  const handleLoad = useCallback(() => {
    // Clear loading timeout
    if (loadingTimeout) {
      clearTimeout(loadingTimeout);
      setLoadingTimeout(null);
    }
    
    setIsLoaded(true);
    onLoad?.();
  }, [onLoad, loadingTimeout]);

  // Handle image error with fallback
  const handleError = useCallback(() => {
    console.warn('⚠️ LazyImage: Failed to load image, trying fallback:', currentSrc);
    
    // Clear loading timeout
    if (loadingTimeout) {
      clearTimeout(loadingTimeout);
      setLoadingTimeout(null);
    }
    
    // Mark the current URL as failed
    markAsFailed(currentSrc);
    
    // If we're using proxy and it fails, try original URL
    if (currentSrc.startsWith('/api/image-proxy') && retryCount === 0) {
      const originalUrl = getFallbackUrl(src);
      
      // Check if original URL has also failed before
      if (hasFailedBefore(originalUrl)) {
        console.log('❌ LazyImage: Original URL also failed before, skipping');
        setHasError(true);
        setIsLoaded(true);
        return;
      }
      
      console.log('🔄 LazyImage: Trying fallback URL:', originalUrl);
      
      setCurrentSrc(originalUrl);
      setRetryCount(1);
      setHasError(false);
      setIsLoaded(false);
    } else {
      console.error('❌ LazyImage: All attempts failed, marking as failed');
      markAsFailed(src); // Mark the original source as failed
      setHasError(true);
      setIsLoaded(true);
    }
  }, [currentSrc, src, retryCount, loadingTimeout]);

  return (
    <div
      ref={imgRef}
      className={`lazy-image-container ${className}`}
      style={{
        position: 'relative',
        overflow: 'hidden',
        ...style
      }}
      onClick={onClick}
    >
      {/* Placeholder/loading state */}
      {!isLoaded && (
        <motion.div
          initial={{ opacity: 1 }}
          animate={{ opacity: isLoaded ? 0 : 1 }}
          transition={{ duration: 0.3 }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundImage: `url(${placeholder})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f3f4f6'
          }}
        >
          <div className="loading-spinner">
            <div className="spinner"></div>
          </div>
        </motion.div>
      )}

      {/* Actual image */}
      {isInView && (
        <motion.img
          src={hasError ? placeholder : currentSrc}
          alt={alt}
          onLoad={handleLoad}
          onError={handleError}
          initial={{ opacity: 0 }}
          animate={{ opacity: isLoaded ? 1 : 0 }}
          transition={{ duration: 0.3 }}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center',
            ...style
          }}
          loading="lazy"
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
        />
      )}

      {/* Error state */}
      {hasError && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: '#f8f9fa',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#6c757d',
            fontSize: '12px',
            textAlign: 'center',
            padding: '8px',
            cursor: 'pointer',
            border: '1px solid #dee2e6',
            borderRadius: '4px'
          }}
          onClick={() => {
            if (onClick) {
              onClick();
            } else {
              // Retry loading the image
              console.log('🔄 LazyImage: Retrying image load');
              setHasError(false);
              setIsLoaded(false);
              setRetryCount(0);
              setCurrentSrc(getImageUrl(src));
            }
          }}
          title="Click to retry loading image"
        >
          <div>
            <div style={{ fontSize: '20px', marginBottom: '4px', opacity: 0.6 }}>🖼️</div>
            <div style={{ fontWeight: '500' }}>Image unavailable</div>
            <div style={{ fontSize: '10px', marginTop: '2px', opacity: 0.6 }}>
              {retryCount > 0 ? 'Failed to load' : 'Click to retry'}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .loading-spinner {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
        }

        .spinner {
          width: 20px;
          height: 20px;
          border: 2px solid #e5e7eb;
          border-top: 2px solid #3b82f6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default LazyImage;
