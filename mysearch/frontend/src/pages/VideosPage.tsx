import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Play, X } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Analytics from '../components/Analytics';
import { apiClient } from '../utils/api';

interface VideoResult {
  id: string | { videoId: string };
  title: string;
  description?: string;
  thumbnail: string;
  url?: string; // Video URL for direct playback
  duration?: string;
  views?: number;
  publishedAt?: string;
  channel: string;
  channelUrl?: string;
  // YouTube API format (for backward compatibility)
  snippet?: {
    title: string;
    description: string;
    channelTitle: string;
    channelId: string;
    publishedAt: string;
    thumbnails: {
      high: { url: string };
      medium?: { url: string };
      default: { url: string };
    };
  };
}

const VideosPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const [videos, setVideos] = useState<VideoResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [searchStartTime, setSearchStartTime] = useState<number | null>(null);

  // Touch navigation state
  const [touchStartX, setTouchStartX] = useState(0);
  const [touchStartY, setTouchStartY] = useState(0);
  const [touchStartTime, setTouchStartTime] = useState(0);

  // Reset on query change
  useEffect(() => {
    setVideos([]);
    setTotal(0);
    setPage(1);
  }, [query]);

  // Fetch on query or page
  useEffect(() => {
    if (query) {
      performSearch(query, page);
    }
  }, [query, page]);

  // Keyboard navigation effect
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (selectedVideo) {
        switch (e.key) {
          case 'ArrowLeft':
            e.preventDefault();
            navigateVideo('prev');
            break;
          case 'ArrowRight':
            e.preventDefault();
            navigateVideo('next');
            break;
          case 'Escape':
            e.preventDefault();
            closeVideoPopup();
            break;
        }
      }
    };

    if (selectedVideo) {
      document.addEventListener('keydown', handleKeydown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeydown);
    };
  }, [selectedVideo, currentVideoIndex, videos]);

  const performSearch = async (searchQuery: string, page = 1) => {
    if (!searchQuery.trim()) {
      setError('Please enter a search query');
      return;
    }

    const currentSearchStartTime = Date.now();
    setSearchStartTime(currentSearchStartTime); // Reset timer for new search

    if (page === 1) {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await apiClient.searchVideos(searchQuery, page, 20); // Limit to 20 videos per page

      if (response.success) {
        const rawResults = response.data.results || [];
        // Map backend field names to frontend expected field names
        const newVideos = rawResults.map((item: any) => ({
          id: item.id || item.site_videos_id || item.site_data_id,
          title: item.site_videos_title || item.site_data_title || item.title,
          description: item.site_videos_description || item.site_data_description || item.site_data_meta_description || item.description,
          thumbnail: item.site_videos_thumbnail || item.site_data_icon || item.thumbnail || '/images/video.jpg',
          url: item.url || item.site_videos_link || item.site_data_link, // Added video URL mapping
          duration: item.site_videos_duration || item.duration,
          views: item.site_data_visit || item.views || 0,
          publishedAt: item.site_videos_created || item.site_data_date || item.publishedAt,
          channel: item.site_videos_provider || item.site_title || item.channel || 'Unknown Channel',
          channelUrl: item.site_videos_link || item.site_data_link || item.channelUrl,
          // Also support YouTube API format if available
          snippet: item.snippet
        }));
        
        console.log('🎬 VideosPage: Raw backend data:', { 
          first_raw_item_keys: rawResults[0] ? Object.keys(rawResults[0]) : 'NO ITEMS',
          first_raw_item: rawResults[0] || 'NO ITEMS'
        });
        
        console.log('🎬 VideosPage: Mapped videos:', { 
          results_length: newVideos.length, 
          total: response.data.total,
          first_video: newVideos[0] ? {
            id: newVideos[0].id,
            title: newVideos[0].title,
            thumbnail: newVideos[0].thumbnail,
            channel: newVideos[0].channel
          } : 'NO FIRST VIDEO'
        });
        
        setVideos(prev => (page === 1 ? newVideos : [...prev, ...newVideos]));
        setTotal(response.data.total || 0);
      } else {
        console.error('🎬 VideosPage: Search failed:', response.error);
        setError(response.error || 'Search failed');
      }
    } catch (error) {
      console.error('Search error:', error);
      setError('Network error occurred');
    } finally {
      if (page === 1) {
        setLoading(false);
      } else {
        setLoadingMore(false);
      }
    }
  };

  // Helper functions to handle both API formats
  const getVideoId = (video: VideoResult): string => {
    if (typeof video.id === 'string') {
      return video.id;
    } else if (video.id && typeof video.id === 'object' && 'videoId' in video.id) {
      return video.id.videoId;
    }
    return String(video.id);
  };

  const getVideoTitle = (video: VideoResult): string => {
    return video.snippet?.title || video.title || 'Untitled Video';
  };

  const getVideoThumbnail = (video: VideoResult): string => {
    return video.snippet?.thumbnails?.high?.url || video.thumbnail || '';
  };

  const getVideoChannel = (video: VideoResult): string => {
    return video.snippet?.channelTitle || video.channel || 'Unknown Channel';
  };

  const getVideoChannelId = (video: VideoResult): string => {
    return video.snippet?.channelId || getVideoId(video);
  };

  const openVideoPopup = (video: VideoResult, videoIndex: number) => {
    const videoId = getVideoId(video);
    setSelectedVideo(videoId);
    setCurrentVideoIndex(videoIndex);
    document.body.style.overflow = 'hidden'; // Disable scrolling
  };

  const getVideoType = (video: VideoResult): 'youtube' | 'vimeo' | 'direct' | 'other' => {
    const url = video.url || '';
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      return 'youtube';
    } else if (url.includes('vimeo.com')) {
      return 'vimeo';
    } else if (url.includes('.mp4') || url.includes('.webm') || url.includes('.ogg')) {
      return 'direct';
    }
    return 'other';
  };

  const renderVideoPlayer = () => {
    const currentVideo = videos[currentVideoIndex];
    if (!currentVideo) return null;

    const videoType = getVideoType(currentVideo);
    const videoId = selectedVideo;

    switch (videoType) {
      case 'youtube':
        return (
          <iframe 
            id="videoPlayer"
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%'
            }}
            frameBorder="0"
            allowFullScreen
            allow="autoplay; encrypted-media"
            title="YouTube Video Player"
          />
        );

      case 'vimeo':
        return (
          <iframe 
            id="videoPlayer"
            src={`https://player.vimeo.com/video/${videoId}?autoplay=1`}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%'
            }}
            frameBorder="0"
            allowFullScreen
            allow="autoplay; encrypted-media"
            title="Vimeo Video Player"
          />
        );

      case 'direct':
        return (
          <video
            id="videoPlayer"
            controls
            autoPlay
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'contain'
            }}
            title="Video Player"
          >
            <source src={currentVideo.url} type="video/mp4" />
            <source src={currentVideo.url} type="video/webm" />
            <source src={currentVideo.url} type="video/ogg" />
            Your browser does not support the video tag.
          </video>
        );

      default:
        return (
          <iframe 
            id="videoPlayer"
            src={currentVideo.url}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%'
            }}
            frameBorder="0"
            allowFullScreen
            allow="autoplay; encrypted-media"
            title="Video Player"
          />
        );
    }
  };

  const closeVideoPopup = () => {
    setSelectedVideo(null);
    document.body.style.overflow = 'unset'; // Re-enable scrolling
  };

  const navigateVideo = (direction: 'prev' | 'next') => {
    let newIndex = currentVideoIndex;
    if (direction === 'prev' && currentVideoIndex > 0) {
      newIndex = currentVideoIndex - 1;
    } else if (direction === 'next' && currentVideoIndex < videos.length - 1) {
      newIndex = currentVideoIndex + 1;
    }
    
    if (newIndex !== currentVideoIndex) {
      setCurrentVideoIndex(newIndex);
      const newVideoId = getVideoId(videos[newIndex]);
      setSelectedVideo(newVideoId);
    }
  };

  const getSeconds = () => {
    if (!searchStartTime) return '0.000';
    return ((Date.now() - searchStartTime) / 1000).toFixed(3);
  };

  const canLoadMore = videos.length < total;
  const handleLoadMore = () => {
    if (!loading && !loadingMore && canLoadMore) {
      setLoadingMore(true);
      setPage(prev => prev + 1);
    }
  };

  // Touch gesture handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setTouchStartX(e.touches[0].clientX);
      setTouchStartY(e.touches[0].clientY);
      setTouchStartTime(new Date().getTime());
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
      // Check for horizontal swipe navigation
      if (Math.abs(diffX) > 80 && Math.abs(diffY) < 150 && tapDuration < 500) {
        // Horizontal swipe navigation - increased sensitivity and added duration check
        if (diffX > 0) {
          navigateVideo('next');
        } else {
          navigateVideo('prev');
        }
      }
    }
  };

  if (!query) {
    return (
      <>
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Videos Search</h2>
            <p className="text-gray-600">Enter a search query to find videos</p>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <style>
        {`
          @media (min-width: 1200px) and (max-width: 1600px) {
            .inqbox-videos {
              grid-template-columns: repeat(4, 1fr) !important;
            }
          }
          @media (min-width: 1000px) and (max-width: 1199px) {
            .inqbox-videos {
              grid-template-columns: repeat(4, 1fr) !important;
            }
          }
        `}
      </style>
      <Header />
      
      <div className="container" style={{ 
        maxWidth: '1400px', 
        margin: '0 auto', 
        padding: '20px 40px'
      }}>
        <div className="panel-body">
          {/* Search Info */}
          <h3 className="results-heading" style={{ 
            fontSize: '18px', 
            marginBottom: '10px',
            color: '#333'
          }}>
            <span className="text-navy" style={{ color: '#1f4e79', fontWeight: 'bold' }}>
              {total.toLocaleString()}
            </span> video results found for: 
            <span className="text-navy" style={{ color: '#1f4e79', fontWeight: 'bold' }}>
              "{query}"
            </span>.
          </h3>
          <div className="small" style={{ fontSize: '12px', color: '#666', marginBottom: '20px' }}>
            Request time (Page generated in {getSeconds()} seconds.)
          </div>
          <div className="hr-line-dashed" style={{ 
            borderBottom: '2px dashed #e7eaec', 
            marginBottom: '20px' 
          }}></div>

          {/* Error State */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
              <p className="text-red-700">{error}</p>
            </div>
          )}
          
          <div className="tab-content">
            <div className="tab-pane fade in active" id="tab1default">
              <div className="col-lg-12">
                <div className="inqbox-videos videosViews" style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '20px',
                  justifyContent: 'flex-start'
                }}>
                  {loading ? (
                    <div className="text-center w-full">
                      <div className="animate-spin inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
                      <p className="mt-4 text-gray-600">Loading videos...</p>
                    </div>
                  ) : videos.length > 0 ? (
                    videos.map((video, index) => (
                      <motion.div
                        key={getVideoId(video)}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: index * 0.05 }}
                        className="video-resultitem"
                        style={{
                          width: '100%',
                          marginBottom: '20px',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ position: 'relative', marginBottom: '10px' }}>
                          <img 
                            src={getVideoThumbnail(video)} 
                            alt={getVideoTitle(video)}
                            style={{
                              width: '100%',
                              height: '180px',
                              objectFit: 'cover',
                              borderRadius: '8px',
                              border: '1px solid #ddd'
                            }}
                            onClick={() => openVideoPopup(video, index)}
                            onError={(e) => {
                              e.currentTarget.src = '/images/video.jpg';
                            }}
                          />
                          
                          {/* Play Button Overlay */}
                          <div 
                            style={{
                              position: 'absolute',
                              top: '50%',
                              left: '50%',
                              transform: 'translate(-50%, -50%)',
                              backgroundColor: 'rgba(0,0,0,0.8)',
                              borderRadius: '50%',
                              padding: '15px',
                              cursor: 'pointer'
                            }}
                            onClick={() => openVideoPopup(video, index)}
                          >
                            <Play style={{ 
                              width: '30px', 
                              height: '30px', 
                              color: 'white',
                              fill: 'white' 
                            }} />
                          </div>

                          {/* Duration overlay */}
                          {video.duration && (
                            <div style={{
                              position: 'absolute',
                              bottom: '8px',
                              right: '8px',
                              backgroundColor: 'rgba(0,0,0,0.8)',
                              color: 'white',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}>
                              {video.duration}
                            </div>
                          )}
                        </div>
                        
                        <h3 
                          className="video-title"
                          style={{
                            fontSize: '16px',
                            fontWeight: 'bold',
                            marginBottom: '8px',
                            lineHeight: '1.3',
                            cursor: 'pointer',
                            color: '#1a0dab'
                          }}
                          onClick={() => openVideoPopup(video, index)}
                        >
                          {getVideoTitle(video)}
                        </h3>
                        
                        <a 
                          href={video.channelUrl || `https://www.youtube.com/channel/${getVideoChannelId(video)}`}
                          className="video-channel"
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            textDecoration: 'none',
                            color: '#666',
                            fontSize: '14px'
                          }}
                        >
                          <h5 style={{ margin: '0', fontWeight: 'normal' }}>
                            {getVideoChannel(video)}
                          </h5>
                        </a>

                        {/* Video stats */}
                        {video.views && (
                          <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                            {video.views.toLocaleString()} views
                          </div>
                        )}
                      </motion.div>
                    ))
                  ) : !loading && (
                    <div className="text-center w-full py-16">
                      <Play className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-xl font-semibold text-gray-600 mb-2">
                        No videos found
                      </h3>
                      <p className="text-gray-500">
                        Try searching with different keywords
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Load More Videos */}
        {!loading && videos.length > 0 && canLoadMore && (
          <div className="text-center" style={{ marginTop: '10px', marginBottom: '20px' }}>
            <button
              className="btn btn-white"
              type="button"
              onClick={(e) => { e.preventDefault(); handleLoadMore(); }}
              disabled={loadingMore}
              style={{
                padding: '10px 18px',
                border: '1px solid #f37021',
                backgroundColor: '#f37021',
                color: '#fff',
                cursor: loadingMore ? 'not-allowed' : 'pointer',
                borderRadius: '4px'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#e25d0f';
                e.currentTarget.style.borderColor = '#e25d0f';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = '#f37021';
                e.currentTarget.style.borderColor = '#f37021';
              }}
            >
              {loadingMore ? 'Loading…' : 'Load More Videos'}
            </button>
          </div>
        )}
      </div>

      {/* Video Popup Modal */}
      {selectedVideo && (
        <div 
          id="videoPopup" 
          className="video-popup"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0,0,0,0.9)',
            zIndex: 1000,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}
          onClick={closeVideoPopup}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Video Info */}
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
              {videos[currentVideoIndex] && getVideoTitle(videos[currentVideoIndex])}
            </div>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>
              {currentVideoIndex + 1} of {videos.length}
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
            <div>← →: Navigate • Swipe: Navigate • ESC: Close</div>
          </div>

          <div 
            className="video-popup-content"
            style={{
              position: 'relative',
              width: '90%',
              maxWidth: '800px',
              backgroundColor: '#000',
              borderRadius: '8px',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <span 
              className="video-popup-close"
              style={{
                position: 'absolute',
                top: '-40px',
                right: '0',
                color: 'white',
                fontSize: '30px',
                cursor: 'pointer',
                zIndex: 1001
              }}
              onClick={closeVideoPopup}
            >
              <X style={{ width: '30px', height: '30px' }} />
            </span>

            {/* Video player wrapper */}
            <div className="video-wrapper" style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
              {renderVideoPlayer()}
            </div>

            {/* Navigation arrows */}
            {currentVideoIndex > 0 && (
              <div 
                className="nav-arrowVideo left"
                style={{
                  position: 'absolute',
                  left: '-50px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'white',
                  fontSize: '30px',
                  cursor: 'pointer',
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  borderRadius: '50%',
                  padding: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onClick={() => navigateVideo('prev')}
              >
                <i className="fas fa-angle-left">‹</i>
              </div>
            )}
            
            {currentVideoIndex < videos.length - 1 && (
              <div 
                className="nav-arrowVideo right"
                style={{
                  position: 'absolute',
                  right: '-50px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'white',
                  fontSize: '30px',
                  cursor: 'pointer',
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  borderRadius: '50%',
                  padding: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onClick={() => navigateVideo('next')}
              >
                <i className="fas fa-angle-right">›</i>
              </div>
            )}
          </div>
        </div>
      )}

      <Footer />

      {/* Analytics */}
      <Analytics siteId="101276548" />
         </>
  );
};

export default VideosPage; 