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

// Cache for failed image URLs to avoid retrying bad URLs
const failedImageCache = new Set<string>();
// Track in-flight loads so multiple instances don't stampede
const inFlightLoads = new Set<string>();
// Cooldown between retries per URL
const lastAttemptAt = new Map<string, number>();
const RETRY_COOLDOWN_MS = 15000; // 15s

// Backoff after failure for each URL to avoid IP rate limits
const lastFailureAt = new Map<string, number>();
const FAILURE_BACKOFF_MS = 20000; // 20 seconds

// Helper function to check if URL has failed before
const hasFailedBefore = (url: string): boolean => {
  return failedImageCache.has(url);
};

// Helper function to mark URL as failed
const markAsFailed = (url: string): void => {
  if (!url) return;
  failedImageCache.add(url);
};

// Helper to clear failed state (on successful load)
const unmarkFailed = (url: string): void => {
  if (!url) return;
  failedImageCache.delete(url);
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
  const [hasError, setHasError] = useState(() => hasFailedBefore(src));
  const [currentSrc, setCurrentSrc] = useState(() => (hasFailedBefore(src) ? placeholder : getImageUrl(src)));
  const [wasEverLoaded, setWasEverLoaded] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [loadingTimeout, setLoadingTimeout] = useState<NodeJS.Timeout | null>(null);
  const [backoffTimer, setBackoffTimer] = useState<NodeJS.Timeout | null>(null);
  const imgRef = useRef<HTMLDivElement>(null);

  // Intersection Observer callback
  const handleIntersection = useCallback((entries: IntersectionObserverEntry[]) => {
    const [entry] = entries;
    if (entry.isIntersecting) {
      setIsInView(true);
      // Do not auto-retry on scroll to prevent request storms and rate limits
      // Only show placeholder; user can tap to retry, and we enforce cooldown
      // Set a timeout to show placeholder if image doesn't load soon while in view
      const timeout = setTimeout(() => {
        if (!isLoaded && !hasError && !wasEverLoaded) {
          console.warn('⏰ LazyImage: In-view loading timeout for:', currentSrc);
          // Do NOT cache as failed on timeout; allow retry when back in view
          setHasError(true);
          setIsLoaded(true);
        }
      }, 6000); // 6s timeout while visible
      setLoadingTimeout(timeout);
    } else {
      // When image leaves viewport, clear any pending timeout to avoid false failures
      setIsInView(false);
      if (loadingTimeout) {
        clearTimeout(loadingTimeout);
        setLoadingTimeout(null);
      }
    }
  }, [currentSrc, isLoaded, hasError, loadingTimeout]);

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
      if (backoffTimer) {
        clearTimeout(backoffTimer);
      }
    };
  }, [handleIntersection, threshold, rootMargin, loadingTimeout, backoffTimer]);

  // Handle image load
  const handleLoad = useCallback(() => {
    // Clear loading timeout
    if (loadingTimeout) {
      clearTimeout(loadingTimeout);
      setLoadingTimeout(null);
    }
    
    setIsLoaded(true);
    setHasError(false);
    setWasEverLoaded(true);
    // Successful load: clear any previous failure flags for both original and current
    unmarkFailed(src);
    unmarkFailed(currentSrc);
    inFlightLoads.delete(currentSrc);
    onLoad?.();
  }, [onLoad, loadingTimeout]);

  // Handle image error with fallback
  const handleError = useCallback(() => {
    console.warn('⚠️ LazyImage: Failed to load image, trying fallback:', currentSrc);
    if (wasEverLoaded) {
      // If it was already shown once, don't flip to error when re-entering view
      return;
    }
    
    // Clear loading timeout
    if (loadingTimeout) {
      clearTimeout(loadingTimeout);
      setLoadingTimeout(null);
    }
    
    // Mark the current URL as failed only for real network errors
    markAsFailed(currentSrc);
    inFlightLoads.delete(currentSrc);
    // Start a 20s backoff for this URL
    lastFailureAt.set(src, Date.now());

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
      
      lastAttemptAt.set(originalUrl, Date.now());
      setCurrentSrc(originalUrl);
      setRetryCount(1);
      setHasError(false);
      setIsLoaded(false);
    } else {
      console.error('❌ LazyImage: All attempts failed, marking as failed');
      markAsFailed(src); // Mark the original source as failed
      setHasError(true);
      setIsLoaded(true);
      // Auto retry after backoff window to avoid continuous fetches
      const t = setTimeout(() => {
        setHasError(false);
        setIsLoaded(false);
        setRetryCount(0);
        setCurrentSrc(getImageUrl(src));
      }, FAILURE_BACKOFF_MS);
      setBackoffTimer(t as unknown as NodeJS.Timeout);
    }
  }, [currentSrc, src, retryCount, loadingTimeout, wasEverLoaded]);

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
      {isInView && (wasEverLoaded || !hasError) && (
        <motion.img
          src={wasEverLoaded ? currentSrc : (hasError ? placeholder : currentSrc)}
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
      {hasError && !wasEverLoaded && (
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
              const now = Date.now();
              const last = lastAttemptAt.get(src) || 0;
              if (now - last < RETRY_COOLDOWN_MS) {
                // Cooldown active; ignore rapid retries
                return;
              }
              if (inFlightLoads.has(src)) {
                return; // Deduplicate in-flight retries
              }
              lastAttemptAt.set(src, now);
              inFlightLoads.add(src);
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
