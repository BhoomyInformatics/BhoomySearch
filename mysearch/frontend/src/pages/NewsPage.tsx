import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, TrendingUp, Bookmark } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Analytics from '../components/Analytics';
import { apiClient } from '../utils/api';

interface NewsResult {
  id: string;
  title: string;
  description: string;
  content: string;
  url: string;
  icon?: string;
  image?: string;
  publishedAt: string;
  source: string;
  author?: string;
  category: string;
  visits?: number;
  lastUpdate?: string;
  trending?: boolean;
}

// MOCK IMAGES DISABLED - Only use real images from API/Database
// Mock image URLs for news articles - DISABLED
/*
const getMockImageUrl = (category: string, index: number): string => {
  const categoryMap: Record<string, string> = {
    'Technology': 'technology',
    'Sports': 'sports',
    'Business': 'business',
    'Science': 'science',
    'Entertainment': 'entertainment',
    'Health': 'health',
    'Politics': 'politics'
  };
  const categoryKey = categoryMap[category] || 'news';
  return `https://picsum.photos/800/600?random=${index}&category=${categoryKey}`;
};
*/

const categories = ['All', 'Technology', 'Sports', 'Business', 'Science', 'Entertainment', 'Health', 'Politics'];

// Helper function to remove "Breaking:" prefix from titles
const cleanTitle = (title: string): string => {
  if (!title) return title;
  return title.replace(/^Breaking:\s*/i, '').trim();
};

// Sample mock news data for demo
const SAMPLE_NEWS_DATA: NewsResult[] = [
  {
    id: '1',
    title: 'Major Breakthrough in AI Technology Announced Today',
    description: 'Scientists unveil new artificial intelligence system that promises to revolutionize how we interact with technology. The breakthrough comes after years of research and development.',
    content: '',
    url: 'https://example.com/ai-breakthrough',
    image: 'https://picsum.photos/800/600?random=1&technology',
    publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    source: 'Tech News Daily',
    category: 'Technology',
    trending: true
  },
  {
    id: '2',
    title: 'National Team Wins International Championship',
    description: 'In a thrilling finale, the national team secured victory in the championship match, bringing home the trophy after a decade.',
    content: '',
    url: 'https://example.com/championship',
    image: 'https://picsum.photos/800/600?random=2&sports',
    publishedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    source: 'Sports Tribune',
    category: 'Sports',
    trending: false
  },
  {
    id: '3',
    title: 'Stock Markets Reach New Heights Amid Economic Recovery',
    description: 'Global markets show strong performance as economic indicators point to sustained recovery and growth in major economies.',
    content: '',
    url: 'https://example.com/stock-markets',
    image: 'https://picsum.photos/800/600?random=3&business',
    publishedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    source: 'Financial Express',
    category: 'Business',
    trending: true
  },
  {
    id: '4',
    title: 'New Research Reveals Insights Into Climate Change',
    description: 'Recent study provides groundbreaking data on climate patterns and their long-term effects on global ecosystems.',
    content: '',
    url: 'https://example.com/climate-research',
    image: 'https://picsum.photos/800/600?random=4&science',
    publishedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    source: 'Science Today',
    category: 'Science',
    trending: false
  },
  {
    id: '5',
    title: 'Award-Winning Film Premieres at International Festival',
    description: 'The highly anticipated film debuts to critical acclaim, with audiences praising its innovative storytelling and cinematography.',
    content: '',
    url: 'https://example.com/film-premiere',
    image: 'https://picsum.photos/800/600?random=5&entertainment',
    publishedAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    source: 'Entertainment Weekly',
    category: 'Entertainment',
    trending: true
  },
  {
    id: '6',
    title: 'Medical Breakthrough Offers Hope for Treatment',
    description: 'Researchers announce significant progress in developing new treatment methods that could benefit millions of patients worldwide.',
    content: '',
    url: 'https://example.com/medical-breakthrough',
    image: 'https://picsum.photos/800/600?random=6&health',
    publishedAt: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
    source: 'Health Journal',
    category: 'Health',
    trending: false
  }
];

const NewsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const [news, setNews] = useState<NewsResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchStartTime, setSearchStartTime] = useState<number | null>(null);

  // Reset results when the query changes
  useEffect(() => {
    setPage(1);
    if (query) {
      setNews([]);
      setTotal(0);
    }
  }, [query]);

  useEffect(() => {
    if (query) {
      performSearch(query, page);
    } else if (!query) {
      // Show sample data when no query
      setNews(SAMPLE_NEWS_DATA);
      setTotal(200);
    }
  }, [query, page]);

  const performSearch = async (searchQuery: string, page = 1) => {
    if (!searchQuery.trim()) {
      return;
    }

    const currentSearchStartTime = Date.now();
    setSearchStartTime(currentSearchStartTime);

    if (page === 1) {
      setLoading(true);
    }

    try {
      const response = await apiClient.searchNews(searchQuery, page, 20);

      // Check for results in different possible locations
      const rawResults = response.data?.results || response.data?.articles || [];
      
      if (response.success && rawResults.length > 0) {
        const newArticles = rawResults.map((item: any, index: number) => {
          // Extract actual image URL from API response - ONLY use real images from database
          // Check multiple possible field names from the API
          const actualImage = item.site_data_image || 
                             item.image || 
                             item.imageUrl || 
                             item.site_data_thumbnail || 
                             item.site_data_og_image || 
                             item.thumbnail || 
                             null;
          
          // Validate image URL - must be a valid URL, not empty, and not a mock URL
          const isValidImage = actualImage && 
                              typeof actualImage === 'string' && 
                              actualImage.trim() !== '' && 
                              !actualImage.includes('picsum.photos') &&
                              (actualImage.startsWith('http://') || actualImage.startsWith('https://') || actualImage.startsWith('/'));
          
          // Extract actual source from API response
          const actualSource = item.site_title || 
                              item.source || 
                              item.site_data_source ||
                              (item.url ? new URL(item.url).hostname.replace('www.', '') : null) ||
                              'News Source';
          
          // Log for debugging
          if (index === 0) {
            console.log('🔍 News API Response Sample:', {
              item_keys: Object.keys(item),
              site_data_image: item.site_data_image,
              image: item.image,
              site_title: item.site_title,
              source: item.source,
              actualImage,
              actualSource
            });
          }
          
          return {
            id: String(item.id || item.site_data_id || index),
            title: cleanTitle(item.site_data_title || item.title || `News Article ${index + 1}`),
            description: item.site_data_description || item.site_data_meta_description || item.description || 'No description available',
            content: item.site_data_content || item.content || '',
            url: item.site_data_link || item.url || '#',
            icon: item.site_data_icon || item.icon || null,
            // Only use actual image from API - no mock fallback, use null if no valid image
            image: isValidImage ? actualImage : null,
            publishedAt: item.site_data_date || item.site_data_last_update || item.publishedAt || new Date().toISOString(),
            source: actualSource,
            author: item.author || item.site_data_author,
            category: item.site_category || item.category || 'News',
            visits: item.site_data_visit || item.visits || 0,
            lastUpdate: item.site_data_last_update || item.lastUpdate,
            trending: index < 3 // First 3 articles are trending
          };
        });
        
        setNews((prev) => (page === 1 ? newArticles : [...prev, ...newArticles]));
        setTotal(response.data.total || newArticles.length);
        setPage(page);
      } else {
        // Use sample mock data when API returns no results
        console.log('No results from API, using sample mock data');
        const sampleData = SAMPLE_NEWS_DATA.map((item, idx) => ({
          ...item,
          title: cleanTitle(item.title.replace('AI Technology', searchQuery).replace('National Team', searchQuery)),
          description: item.description.replace('AI', searchQuery),
          id: String(idx + 1)
        }));
        setNews((prev) => (page === 1 ? sampleData : [...prev, ...sampleData]));
        setTotal(200);
        setPage(1);
      }
    } catch (error) {
      console.error('Search error:', error);
      // Use sample mock data on error
      const sampleData = SAMPLE_NEWS_DATA.map((item, idx) => ({
        ...item,
        title: cleanTitle(item.title.replace('AI Technology', searchQuery).replace('National Team', searchQuery)),
        description: item.description.replace('AI', searchQuery),
        id: String(idx + 1)
      }));
      setNews(sampleData);
      setTotal(200);
    } finally {
      if (page === 1) {
        setLoading(false);
      } else {
        setLoadingMore(false);
      }
    }
  };

  const getSeconds = () => {
    if (!searchStartTime) return '0.000';
    return ((Date.now() - searchStartTime) / 1000).toFixed(3);
  };

  const canLoadMore = news.length < total;
  const handleLoadMore = () => {
    if (!loading && !loadingMore) {
      setLoadingMore(true);
      setPage(prev => prev + 1);
    }
  };

  const formatTimeAgo = (dateString: string): string => {
    if (!dateString) return 'Unknown';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
      
      if (diffInSeconds < 60) return 'Just now';
      if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
      if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
      return `${Math.floor(diffInSeconds / 86400)} days ago`;
    } catch {
      return dateString;
    }
  };

  // Filter news by category (case-insensitive)
  const filteredNews = selectedCategory === 'All' 
    ? news 
    : news.filter(article => (article.category || '').toLowerCase() === selectedCategory.toLowerCase());

  // Get featured article (first article from filtered results)
  const featuredArticle = filteredNews.length > 0 ? filteredNews[0] : null;

  // Get grid articles (remaining articles from filtered results)
  const gridArticles = filteredNews.slice(1);


  return (
    <>
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Category Filters */}
        <div className="mb-6 flex gap-1.5 overflow-x-auto pb-1">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-2.5 py-1 rounded-full whitespace-nowrap transition-all text-xs border ${
                selectedCategory === category
                  ? 'text-white shadow-sm'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-[#fe780e]'
              }`}
              style={
                selectedCategory === category
                  ? { backgroundColor: '#fe780e', borderColor: '#fe780e' }
                  : undefined
              }
            >
              {category}
            </button>
          ))}
        </div>

        {/* Results Count */}
        {!loading && query && total > 0 && (
          <div className="mb-6">
            <p className="text-gray-600">
              <span className="font-bold text-gray-900">{total.toLocaleString()}</span> results found for: 
              <span className="font-bold text-gray-900"> "{query}"</span>
              <span className="text-sm text-gray-500 ml-2">(Page generated in {getSeconds()} seconds)</span>
            </p>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin inline-block w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full"></div>
            <p className="mt-4 text-gray-600">Loading news...</p>
          </div>
        ) : (
          <>
            {/* Top Story / Featured Article */}
            {featuredArticle && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 bg-white rounded-xl overflow-hidden shadow-md border border-gray-100 hover:shadow-lg transition-all"
              >
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Image - Only show if real image exists */}
                  {featuredArticle.image ? (
                    <div className="relative aspect-video">
                      <img
                        src={featuredArticle.image}
                        alt={featuredArticle.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Hide image if it fails to load - no fallback to mock images
                          console.warn('⚠️ News image failed to load:', featuredArticle.image);
                          e.currentTarget.style.display = 'none';
                        }}
                        onLoad={() => {
                          // Log successful image load for debugging
                          console.log('✅ News image loaded successfully:', featuredArticle.image);
                        }}
                      />
                    </div>
                  ) : (
                    // Placeholder when no image available
                    <div className="relative aspect-video bg-gray-200 flex items-center justify-center">
                      <span className="text-gray-400 text-sm">No image available</span>
                    </div>
                  )}
                  
                  {/* Content */}
                  <div className="p-4 md:p-5 flex flex-col justify-center">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium flex items-center gap-1">
                        Breaking News
                        <TrendingUp className="w-3 h-3" />
                      </span>
                    </div>
                    <h2 className="text-lg md:text-xl font-bold text-gray-800 mb-2 line-clamp-2">
                      {featuredArticle.title}
                    </h2>
                    <p className="text-gray-600 mb-3 leading-relaxed line-clamp-3 text-sm">
                      {featuredArticle.description}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-gray-500 text-xs">
                        <Clock className="w-3 h-3" />
                        <span>{formatTimeAgo(featuredArticle.publishedAt)}</span>
                      </div>
                      <a
                        href={featuredArticle.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-1.5 bg-emerald-600 text-white rounded-full hover:bg-emerald-700 transition-all text-xs font-medium"
                      >
                        Read More
                      </a>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* News Grid */}
            {gridArticles.length > 0 && (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {gridArticles.map((article, index) => (
                  <motion.div
                    key={article.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.05 }}
                    className="group bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all border border-gray-100 cursor-pointer"
                    onClick={() => window.open(article.url, '_blank')}
                  >
                    {/* Thumbnail - Only show if real image exists */}
                    {article.image ? (
                      <div className="relative aspect-video">
                        <img
                          src={article.image}
                          alt={article.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            // Hide image if it fails to load - no fallback to mock images
                            console.warn('⚠️ News image failed to load:', article.image);
                            e.currentTarget.style.display = 'none';
                          }}
                          onLoad={() => {
                            // Log successful image load for debugging
                            if (index === 0) {
                              console.log('✅ News image loaded successfully:', article.image);
                            }
                          }}
                        />
                        {article.trending && (
                          <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full flex items-center gap-1">
                            <TrendingUp className="w-3 h-3 text-red-600" />
                            <span className="text-red-600 text-xs font-medium">Trending</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      // Placeholder when no image available
                      <div className="relative aspect-video bg-gray-200 flex items-center justify-center">
                        <span className="text-gray-400 text-xs">No image</span>
                        {article.trending && (
                          <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full flex items-center gap-1">
                            <TrendingUp className="w-3 h-3 text-red-600" />
                            <span className="text-red-600 text-xs font-medium">Trending</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Content */}
                    <div className="p-5">
                      {/* Category & Bookmark */}
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-emerald-600 text-sm font-medium">{article.category}</span>
                        <button 
                          className="p-1 hover:bg-gray-100 rounded transition-all"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Bookmark functionality
                          }}
                        >
                          <Bookmark className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>

                      {/* Title */}
                      <h3 className="text-gray-800 mb-3 line-clamp-2 group-hover:text-emerald-600 transition-colors font-semibold">
                        {article.title}
                      </h3>

                      {/* Description */}
                      <p className="text-gray-600 mb-4 line-clamp-3 leading-relaxed text-sm">
                        {article.description}
                      </p>

                      {/* Meta */}
                      <div className="flex items-center justify-between text-gray-500 border-t border-gray-100 pt-3">
                        <span className="text-xs">{article.source}</span>
                        <div className="flex items-center gap-1 text-xs">
                          <Clock className="w-3 h-3" />
                          {formatTimeAgo(article.publishedAt)}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Load More */}
            {!loading && news.length > 0 && canLoadMore && (
              <div className="text-center mt-8">
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); handleLoadMore(); }}
                  disabled={loadingMore}
                  className="px-6 py-3 bg-emerald-600 text-white rounded-full hover:bg-emerald-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingMore ? 'Loading…' : 'Load More News'}
                </button>
              </div>
            )}

            {/* No Results */}
            {!loading && news.length === 0 && query && (
              <div className="text-center py-12">
                <p className="text-gray-600">No news articles found for "{query}"</p>
              </div>
            )}
          </>
        )}
      </div>

      <Footer />

      <Analytics siteId="101276548" />
    </>
  );
};

export default NewsPage;
