import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Analytics from '../components/Analytics';
import OptimizedImageGrid from '../components/OptimizedImageGrid';
import { apiClient } from '../utils/api';

interface ImageResult {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  source: string;
  width?: number;
  height?: number;
  size?: string;
}

const ImagesPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const [images, setImages] = useState<ImageResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [selectedImage, setSelectedImage] = useState<ImageResult | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [searchStartTime, setSearchStartTime] = useState<number | null>(null);
  const [currentPageLoadTime, setCurrentPageLoadTime] = useState<number | null>(null);
  const [lastApiResponseTime, setLastApiResponseTime] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastLoadMoreTime, setLastLoadMoreTime] = useState(0); // Rate limiting for load more
  const [currentPage, setCurrentPage] = useState(1); // Track current page number

  // Zoom and pan state
  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [lastTapTime, setLastTapTime] = useState(0);
  const [initialDistance, setInitialDistance] = useState(0);
  const [touchStartX, setTouchStartX] = useState(0);
  const [touchStartY, setTouchStartY] = useState(0);
  const [touchStartTime, setTouchStartTime] = useState(0);

  const popupImageRef = useRef<HTMLImageElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const performSearch = useCallback(async (searchQuery: string, pageNum: number = 1, append: boolean = false) => {
    if (!searchQuery.trim()) {
      return;
    }

    const currentSearchStartTime = Date.now();
    
    // Update current page tracking
    setCurrentPage(pageNum);
    
    if (!append) {
      setSearchStartTime(currentSearchStartTime);
      setCurrentPageLoadTime(currentSearchStartTime);
      setLoading(true);
    } else {
      setCurrentPageLoadTime(currentSearchStartTime);
      setLoadingMore(true);
    }

    try {
      console.log('🔍 ImagesPage: API call starting', { 
        searchQuery, 
        pageNum, 
        append, 
        currentPage,
        imagesLoaded: images.length 
      });
      
      const response = await apiClient.searchImages(searchQuery, pageNum, 100); // Increased to 100 images per page
      
      // Calculate actual API response time
      const apiResponseTime = Date.now() - currentSearchStartTime;
      setLastApiResponseTime(apiResponseTime);

      console.log('🔍 ImagesPage: API Response received', {
        success: response.success,
        data: response.data ? {
          resultsCount: response.data.results?.length || 0,
          total: response.data.total,
          page: response.data.page,
          per_page: response.data.per_page,
          total_pages: response.data.total_pages
        } : 'No data',
        error: response.error,
        pageNum,
        append
      });

      if (response.success) {
        const newImages = response.data.results || [];
        if (append) {
          setImages(prev => [...prev, ...newImages]);
        } else {
          setImages(newImages);
        }
        setTotal(response.data.total || 0);
        
        console.log('📊 ImagesPage: API Response received', { 
          newImagesCount: newImages.length, 
          pageNum, 
          total: response.data.total, 
          currentImagesBefore: images.length,
          append,
          fullResponse: response.data
        });
      } else {
        console.error('❌ ImagesPage: API request failed', response.error);
        setHasMore(false);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    console.log('🔄 ImagesPage: useEffect triggered', { query, hasQuery: !!query });
    if (query) {
      // Reset selected image when changing pages or query
      setSelectedImage(null);
      setCurrentImageIndex(0);
      setImages([]);
      setHasMore(true);
      setCurrentPage(1); // Reset to page 1 for new search
      console.log('🔄 ImagesPage: Starting search for query:', query);
      performSearch(query, 1, false);
    }
  }, [query, performSearch]);

  // Keyboard navigation effect
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (selectedImage) {
        switch (e.key) {
          case 'ArrowLeft':
            e.preventDefault();
            navigateImage('prev');
            break;
          case 'ArrowRight':
            e.preventDefault();
            navigateImage('next');
            break;
          case 'Escape':
            e.preventDefault();
            closeImageModal();
            break;
        }
      }
    };

    if (selectedImage) {
      document.addEventListener('keydown', handleKeydown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeydown);
    };
  }, [selectedImage, currentImageIndex, images]);


  // Load more images with improved rate limiting
  const handleLoadMore = useCallback(() => {
    console.log('🔄 ImagesPage: handleLoadMore called', { 
      loading, 
      loadingMore, 
      hasMore, 
      query, 
      currentImages: images.length,
      currentPage
    });
    
    const now = Date.now();
    const timeSinceLastLoad = now - lastLoadMoreTime;
    
    // Rate limiting: prevent calls within 1000ms
    if (timeSinceLastLoad < 1000) {
      console.log('⏳ ImagesPage: Rate limiting load more call', { timeSinceLastLoad });
      return;
    }
    
    if (!loading && !loadingMore && hasMore && query) {
      console.log('🔄 ImagesPage: Load more triggered', { 
        loading, 
        loadingMore, 
        hasMore, 
        query, 
        currentImages: images.length,
        currentPage
      });
      setLastLoadMoreTime(now);
      const nextPage = currentPage + 1; // Simply increment the current page
      console.log('🔄 ImagesPage: Calling performSearch for page:', nextPage, 'from current page:', currentPage);
      performSearch(query, nextPage, true);
    } else {
      console.log('❌ ImagesPage: Load more blocked', { 
        loading, 
        loadingMore, 
        hasMore, 
        query 
      });
    }
  }, [loading, loadingMore, hasMore, query, images.length, currentPage, performSearch, lastLoadMoreTime]);

  // Update hasMore based on current images and total
  useEffect(() => {
    console.log('📊 ImagesPage: hasMore calculation', {
      imagesCount: images.length,
      total,
      hasMoreImages: total > 0 ? images.length < total : false
    });
    
    if (total > 0) {
      const hasMoreImages = images.length < total;
      setHasMore(hasMoreImages);
      console.log('📊 ImagesPage: hasMore updated', {
        imagesCount: images.length,
        total,
        hasMoreImages
      });
    } else {
      console.log('📊 ImagesPage: No total available, setting hasMore to false');
      setHasMore(false);
    }
  }, [images.length, total]);

  // Memory optimization: Limit number of images to prevent memory issues
  useEffect(() => {
    if (images.length > 200) {
      console.warn('🧠 ImagesPage: Too many images loaded, limiting to 200 for memory optimization');
      setImages(prev => prev.slice(-200)); // Keep only last 200 images
    }
  }, [images.length]);

  const resetZoom = () => {
    setScale(1);
    setTranslateX(0);
    setTranslateY(0);
    if (popupImageRef.current) {
      popupImageRef.current.style.transform = `scale(1) translate(0px, 0px)`;
    }
  };

  const openImageModal = (image: ImageResult, index: number) => {
    setSelectedImage(image);
    setCurrentImageIndex(index);
    resetZoom();
    document.body.style.overflow = 'hidden'; // Disable scrolling
  };

  const closeImageModal = () => {
    setSelectedImage(null);
    resetZoom();
    document.body.style.overflow = 'unset'; // Re-enable scrolling
  };

  const navigateImage = (direction: 'prev' | 'next') => {
    let newIndex = currentImageIndex;
    if (direction === 'prev' && currentImageIndex > 0) {
      newIndex = currentImageIndex - 1;
    } else if (direction === 'next' && currentImageIndex < images.length - 1) {
      newIndex = currentImageIndex + 1;
    }
    
    if (newIndex !== currentImageIndex && newIndex >= 0 && newIndex < images.length) {
      setCurrentImageIndex(newIndex);
      setSelectedImage(images[newIndex]);
      resetZoom();
    }
  };

  // Zoom functionality
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = 0.1;
    let newScale = scale;

    if (e.deltaY < 0) {
      newScale = Math.min(scale * (1 + zoomFactor), 4);
    } else {
      newScale = Math.max(scale / (1 + zoomFactor), 1);
    }

    setScale(newScale);
    if (popupImageRef.current) {
      popupImageRef.current.style.transform = `scale(${newScale}) translate(${translateX}px, ${translateY}px)`;
    }
  };

  // Drag to pan functionality
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setStartX(e.clientX - translateX);
      setStartY(e.clientY - translateY);
      if (popupImageRef.current) {
        popupImageRef.current.style.cursor = 'grabbing';
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      e.preventDefault();
      const newTranslateX = e.clientX - startX;
      const newTranslateY = e.clientY - startY;
      setTranslateX(newTranslateX);
      setTranslateY(newTranslateY);
      if (popupImageRef.current) {
        popupImageRef.current.style.transform = `scale(${scale}) translate(${newTranslateX}px, ${newTranslateY}px)`;
      }
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    if (popupImageRef.current) {
      popupImageRef.current.style.cursor = scale === 1 ? 'default' : 'grab';
    }
  };

  // Touch gestures
  const getDistance = (touch1: React.Touch, touch2: React.Touch) => {
    const dx = touch2.clientX - touch1.clientX;
    const dy = touch2.clientY - touch1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      setInitialDistance(getDistance(e.touches[0], e.touches[1]));
    } else if (e.touches.length === 1) {
      setTouchStartX(e.touches[0].clientX);
      setTouchStartY(e.touches[0].clientY);
      setTouchStartTime(new Date().getTime());
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const currentDistance = getDistance(e.touches[0], e.touches[1]);
      const touchScale = Math.max(1, Math.min((scale * currentDistance) / initialDistance, 4));
      setScale(touchScale);
      setInitialDistance(currentDistance);
      if (popupImageRef.current) {
        popupImageRef.current.style.transform = `scale(${touchScale}) translate(${translateX}px, ${translateY}px)`;
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.changedTouches.length === 1) {
      const currentTime = new Date().getTime();
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      const diffX = touchStartX - touchEndX;
      const diffY = touchStartY - touchEndY;
      const tapDuration = currentTime - touchStartTime;
      const timeSinceLastTap = currentTime - lastTapTime;

      // Check if this is a quick tap (not a long press or drag)
      const isQuickTap = tapDuration < 200 && Math.abs(diffX) < 20 && Math.abs(diffY) < 20;
      
      if (isQuickTap) {
        // Check for double tap
        if (timeSinceLastTap < 400 && timeSinceLastTap > 50) {
          // Double tap detected - reset zoom if zoomed in
          if (scale > 1) {
            resetZoom();
          } else {
            // If not zoomed, zoom in to 2x at tap location
            setScale(2);
            if (popupImageRef.current) {
              popupImageRef.current.style.transform = `scale(2) translate(${translateX}px, ${translateY}px)`;
            }
          }
        }
        setLastTapTime(currentTime);
      } else if (Math.abs(diffX) > 80 && Math.abs(diffY) < 150 && tapDuration < 500) {
        // Horizontal swipe navigation - increased sensitivity and added duration check
        // Only navigate if not zoomed in significantly to avoid accidental navigation while panning
        if (scale <= 1.5) {
          if (diffX > 0) {
            navigateImage('next');
          } else {
            navigateImage('prev');
          }
        }
      }
    }
  };

  // Manual zoom controls
  const zoomIn = () => {
    const newScale = Math.min(scale * 1.2, 4);
    setScale(newScale);
    if (popupImageRef.current) {
      popupImageRef.current.style.transform = `scale(${newScale}) translate(${translateX}px, ${translateY}px)`;
    }
  };

  const zoomOut = () => {
    const newScale = Math.max(scale / 1.2, 1);
    setScale(newScale);
    if (popupImageRef.current) {
      popupImageRef.current.style.transform = `scale(${newScale}) translate(${translateX}px, ${translateY}px)`;
    }
  };

  const getSeconds = () => {
    // Show the actual API response time instead of live timer
    if (lastApiResponseTime !== null) {
      return (lastApiResponseTime / 1000).toFixed(3);
    }
    
    // Fallback to live timer only if no API response time available
    const startTime = currentPageLoadTime || searchStartTime;
    if (!startTime) return '0.000';
    return ((Date.now() - startTime) / 1000).toFixed(3);
  };


  if (!query) {
    return (
      <>
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Images Search</h2>
            <p className="text-gray-600">Enter a search query to find images</p>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      
      <div className="container" style={{ maxWidth: '1400px', margin: '0 auto', padding: '20px 20px' }}>
        <div className="panel-body">
          <h3 className="results-heading" style={{ 
            fontSize: '18px', 
            marginBottom: '10px',
            color: '#333'
          }}>
            <span className="text-navy" style={{ color: '#1f4e79', fontWeight: 'bold' }}>
              {total.toLocaleString()}
            </span> results found for: 
            <span className="text-navy" style={{ color: '#1f4e79', fontWeight: 'bold' }}>
              "{query}"
            </span>.
          </h3>
          <div className="small" style={{ fontSize: '12px', color: '#666', marginBottom: '20px' }}>
            Request time (Page generated in {getSeconds()} seconds.)
            {loadingMore && (
              <span style={{ marginLeft: '10px', color: '#3b82f6', fontSize: '12px' }}>
                🔄 Loading more images...
              </span>
            )}
          </div>
          <div className="hr-line-dashed" style={{ 
            borderBottom: '2px dashed #e7eaec', 
            marginBottom: '20px' 
          }}></div>

          <div className="tab-content">
            <div className="tab-pane fade in active" id="tab1default">
              <div className="inqbox-image">
                <OptimizedImageGrid
                  images={images}
                  loading={loading}
                  onImageClick={openImageModal}
                  onLoadMore={handleLoadMore}
                  hasMore={hasMore}
                  totalImages={total}
                  className="optimized-image-grid"
                />

                {/* Fullscreen Image Popup */}
                {selectedImage && (
                  <div 
                    ref={popupRef}
                    className="fullscreen-popup"
                    style={{
                      position: 'fixed',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      backgroundColor: 'rgba(0,0,0,0.95)',
                      zIndex: 1000,
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center'
                    }}
                    onClick={(e) => {
                      if (e.target === popupRef.current) {
                        closeImageModal();
                      }
                    }}
                  >
                    {/* Control Panel */}
                    <div 
                      style={{
                        position: 'absolute',
                        top: '20px',
                        right: '20px',
                        display: 'flex',
                        gap: '10px',
                        zIndex: 1001
                      }}
                    >
                      <button 
                        onClick={zoomOut}
                        disabled={scale <= 1}
                        style={{
                          backgroundColor: 'rgba(255,255,255,0.9)',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '10px',
                          cursor: scale <= 1 ? 'not-allowed' : 'pointer',
                          opacity: scale <= 1 ? 0.5 : 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title="Zoom Out"
                      >
                        <ZoomOut style={{ width: '20px', height: '20px', color: '#333' }} />
                      </button>
                      
                      <button 
                        onClick={zoomIn}
                        disabled={scale >= 4}
                        style={{
                          backgroundColor: 'rgba(255,255,255,0.9)',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '10px',
                          cursor: scale >= 4 ? 'not-allowed' : 'pointer',
                          opacity: scale >= 4 ? 0.5 : 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title="Zoom In"
                      >
                        <ZoomIn style={{ width: '20px', height: '20px', color: '#333' }} />
                      </button>
                      
                      <button 
                        onClick={resetZoom}
                        disabled={scale === 1}
                        style={{
                          backgroundColor: 'rgba(255,255,255,0.9)',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '10px',
                          cursor: scale === 1 ? 'not-allowed' : 'pointer',
                          opacity: scale === 1 ? 0.5 : 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title="Reset Zoom"
                      >
                        <RotateCcw style={{ width: '20px', height: '20px', color: '#333' }} />
                      </button>
                      
                      <button 
                        onClick={closeImageModal}
                        style={{
                          backgroundColor: 'rgba(255,255,255,0.9)',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '10px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title="Close"
                      >
                        <span style={{ fontSize: '20px', color: '#333', fontWeight: 'bold' }}>×</span>
                      </button>
                    </div>

                    {/* Zoom Level Indicator */}
                    {scale > 1 && (
                      <div 
                        style={{
                          position: 'absolute',
                          top: '20px',
                          left: '20px',
                          backgroundColor: 'rgba(0,0,0,0.7)',
                          color: 'white',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          fontSize: '14px',
                          fontWeight: 'bold',
                          zIndex: 1001
                        }}
                      >
                        {Math.round(scale * 100)}%
                      </div>
                    )}

                    {/* Image Info */}
                    <div 
                      style={{
                        position: 'absolute',
                        bottom: '20px',
                        left: '20px',
                        backgroundColor: 'rgba(0,0,0,0.7)',
                        color: 'white',
                        padding: '12px 16px',
                        borderRadius: '8px',
                        fontSize: '14px',
                        maxWidth: '300px',
                        zIndex: 1001
                      }}
                    >
                      <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                        {selectedImage.title}
                      </div>
                      <div style={{ fontSize: '12px', opacity: 0.8 }}>
                        {currentImageIndex + 1} of {images.length}
                      </div>
                    </div>

                    {/* Instructions */}
                    <div 
                      style={{
                        position: 'absolute',
                        bottom: '20px',
                        right: '20px',
                        backgroundColor: 'rgba(0,0,0,0.7)',
                        color: 'white',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        textAlign: 'right',
                        zIndex: 1001,
                        opacity: 0.8
                      }}
                    >
                      <div>Scroll: Zoom • Drag: Pan • ← →: Navigate</div>
                      <div>Double-tap: {scale > 1 ? 'Reset' : 'Zoom 2x'} • Swipe: Navigate • ESC: Close</div>
                    </div>
                    
                    <div 
                      className="popup-content"
                      style={{
                        position: 'relative',
                        width: '90%',
                        height: '90%',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        overflow: 'hidden'
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <img 
                        src={selectedImage.url} 
                        className="popup-image" 
                        alt={selectedImage.title}
                        style={{
                          maxWidth: scale === 1 ? '100%' : 'none',
                          maxHeight: scale === 1 ? '100%' : 'none',
                          width: scale === 1 ? 'auto' : selectedImage.width || 'auto',
                          height: scale === 1 ? 'auto' : selectedImage.height || 'auto',
                          objectFit: 'contain',
                          cursor: scale === 1 ? 'default' : 'grab',
                          transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                          userSelect: 'none'
                        }}
                        ref={popupImageRef}
                        onWheel={handleWheel}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                        draggable={false}
                      />
                      
                      {/* Navigation arrows */}
                      {currentImageIndex > 0 && (
                        <div 
                          className="nav-arrow left"
                          style={{
                            position: 'absolute',
                            left: '-60px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            backgroundColor: 'rgba(255,255,255,0.9)',
                            color: '#333',
                            width: '50px',
                            height: '50px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            fontSize: '24px',
                            fontWeight: 'bold',
                            boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
                            transition: 'all 0.2s ease'
                          }}
                          onClick={() => navigateImage('prev')}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,1)';
                            e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.9)';
                            e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
                          }}
                        >
                          ‹
                        </div>
                      )}
                      {currentImageIndex < images.length - 1 && (
                        <div 
                          className="nav-arrow right"
                          style={{
                            position: 'absolute',
                            right: '-60px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            backgroundColor: 'rgba(255,255,255,0.9)',
                            color: '#333',
                            width: '50px',
                            height: '50px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            fontSize: '24px',
                            fontWeight: 'bold',
                            boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
                            transition: 'all 0.2s ease'
                          }}
                          onClick={() => navigateImage('next')}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,1)';
                            e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.9)';
                            e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
                          }}
                        >
                          ›
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Infinite scroll info */}
                {!loading && images.length > 0 && (
                  <div className="text-center" style={{ marginTop: '20px', color: '#666', fontSize: '14px' }}>
                    {hasMore ? (
                      <p>Scroll down to load more images • {images.length} of {total.toLocaleString()} images loaded</p>
                    ) : (
                      <p>All {total.toLocaleString()} images loaded</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />

      {/* Analytics */}
      <Analytics siteId="101276548" />

      {/* Responsive Styles for Images Grid */}
      <style>{`
        @media (min-width: 1200px) {
          .image-resultitem {
            width: calc(20% - 6px) !important;
            height: 200px !important;
          }
        }
        
        @media (max-width: 1199px) and (min-width: 1000px) {
          .image-resultitem {
            width: calc(25% - 6px) !important;
            min-width: 120px !important;
            height: 180px !important;
          }
        }
        
        @media (max-width: 999px) and (min-width: 768px) {
          .image-resultitem {
            width: calc(33.33% - 6px) !important;
            min-width: 120px !important;
            height: 160px !important;
          }
        }
        
        @media (max-width: 767px) and (min-width: 480px) {
          .image-resultitem {
            width: calc(50% - 6px) !important;
            min-width: 140px !important;
            height: 180px !important;
          }
        }
        
        @media (max-width: 479px) {
          .image-resultitem {
            width: calc(50% - 4px) !important;
            min-width: 120px !important;
            height: 160px !important;
            margin: 1px !important;
          }
          
          .pictureView {
            gap: 4px !important;
          }
        }
        
        @media (max-width: 320px) {
          .image-resultitem {
            width: 100% !important;
            min-width: auto !important;
            height: 200px !important;
          }
        }
      `}</style>

      {/* Analytics Script Placeholder */}
      <script async data-id="101276548" src="//static.getclicky.com/js"></script>
<noscript><p><img alt="Clicky" width="1" height="1" src="//in.getclicky.com/101276548ns.gif" /></p></noscript>
        {/* End Analytics Script Placeholder */}
    </>
  );
};

export default ImagesPage; 