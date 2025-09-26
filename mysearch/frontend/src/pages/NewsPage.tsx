import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ExternalLink } from 'lucide-react';
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
}

const NewsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const [news, setNews] = useState<NewsResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchStartTime, setSearchStartTime] = useState<number | null>(null);

  // Reset results when the query changes
  useEffect(() => {
    setPage(1);
    setNews([]);
    setTotal(0);
  }, [query]);

  useEffect(() => {
    if (query) {
      performSearch(query, page);
    }
  }, [query, page]);

  const performSearch = async (searchQuery: string, page = 1) => {
    if (!searchQuery.trim()) {
      return;
    }

    const currentSearchStartTime = Date.now();
    setSearchStartTime(currentSearchStartTime); // Reset timer for new search

    if (page === 1) {
      setLoading(true);
    }

    try {
      const response = await apiClient.searchNews(searchQuery, page, 20); // Limit to 20 news articles per page

      if (response.success) {
        const rawResults = response.data.results || [];
        // Map backend field names to frontend expected field names
        const newArticles = rawResults.map((item: any) => ({
          id: item.id || item.site_data_id,
          title: item.site_data_title || item.title,
          description: item.site_data_description || item.site_data_meta_description || item.description,
          content: item.site_data_content || item.content,
          url: item.site_data_link || item.url,
          icon: item.site_data_icon || item.icon || null,
          image: item.site_data_icon || item.site_data_image || item.site_data_thumbnail || item.site_data_og_image || item.image || null,
          publishedAt: item.site_data_date || item.publishedAt,
          source: item.site_title || item.source,
          author: item.author,
          category: item.site_category || item.category,
          visits: item.site_data_visit || item.visits || 0,
          lastUpdate: item.site_data_last_update || item.lastUpdate
        }));
        
        console.log('📰 NewsPage: Raw backend data:', { 
          first_raw_item_keys: rawResults[0] ? Object.keys(rawResults[0]) : 'NO ITEMS',
          first_raw_item: rawResults[0] || 'NO ITEMS'
        });
        
        console.log('📰 NewsPage: Mapped articles:', { 
          results_length: newArticles.length, 
          total: response.data.total,
          first_article: newArticles[0] ? {
            id: newArticles[0].id,
            title: newArticles[0].title,
            url: newArticles[0].url,
            icon: newArticles[0].icon,
            image: newArticles[0].image
          } : 'NO FIRST ARTICLE'
        });
        
        setNews((prev) => (page === 1 ? newArticles : [...prev, ...newArticles]));
        setTotal(response.data.total || 0);
        setPage(page);
      }
    } catch (error) {
      console.error('Search error:', error);
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

  // Load-more UX; we still keep page state for backend paging
  const canLoadMore = news.length < total;
  const handleLoadMore = () => {
    if (!loading && !loadingMore) {
      setLoadingMore(true);
      setPage(prev => prev + 1);
    }
  };

  const truncateText = (text: string, length: number) => {
    return text.length > length ? text.substring(0, length) + '...' : text;
  };

  if (!query) {
    return (
      <>
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">News Search</h2>
            <p className="text-gray-600">Enter a search query to find news articles</p>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      
      <div className="container news-container" style={{ maxWidth: '1400px',marginLeft: '10px', padding: '25px 40px' }}>
        <div className="panel-body news-panel">
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
          <small style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '20px' }}>
            Request time (Page generated in {getSeconds()} seconds.)
          </small>
          <div className="hr-line-dashed" style={{ 
            borderBottom: '2px dashed #e7eaec', 
            marginBottom: '20px' 
          }}></div>

          <div className="tab-content">
            <div className="tab-pane fade in active" id="tab1default">
              <div className="news-layout" style={{ display: 'flex' }}>
                <div className="col-lg-8 news-content" style={{ flex: '0 0 66.66%', paddingRight: '20px' }}>
                  <div className="inqbox-search">
                    {loading ? (
                      <div className="text-center" style={{ padding: '40px 0' }}>
                        <div className="animate-spin inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
                        <p className="mt-4 text-gray-600">Loading news...</p>
                      </div>
                    ) : (
                      news.map((article, index) => (
                        <motion.div
                          key={article.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.4, delay: index * 0.05 }}
                          className="search-result"
                          style={{
                            marginBottom: '25px',
                            paddingBottom: '20px',
                            borderBottom: '1px solid #eee'
                          }}
                        >
                          <h3 style={{
                            fontSize: '18px',
                            marginBottom: '10px',
                            lineHeight: '1.4'
                          }}>
                            <a 
                              href={article.url}
                              style={{
                                color: '#1a0dab',
                                textDecoration: 'none',
                                marginRight: '10px'
                              }}
                              onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'}
                              onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
                            >
                              {truncateText(article.title, 60)}
                            </a>
                            <a 
                              className="btn" 
                              href={article.url} 
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                color: '#666',
                                textDecoration: 'none',
                                fontSize: '14px'
                              }}
                            >
                              <ExternalLink style={{ width: '16px', height: '16px', display: 'inline' }} />
                            </a>
                          </h3>

                          <div className="search-link" style={{ 
                            display: 'flex', 
                            alignItems: 'flex-start',
                            marginBottom: '10px'
                          }}>
                            <a 
                              href={article.url} 
                              style={{ 
                                display: 'flex', 
                                textDecoration: 'none', 
                                color: 'inherit' 
                              }}
                            >
                              <div style={{ 
                                width: '70px', 
                                height: '65px', 
                                overflow: 'hidden', 
                                marginRight: '8px', 
                                border: '1px solid #CCC',
                                borderRadius: '4px'
                              }}>
                                <img 
                                  src={article.image || article.icon || '/images/News.jpg'} 
                                  className="image img-rounded" 
                                  style={{ 
                                    width: '100%', 
                                    height: '100%', 
                                    objectFit: article.image && article.image !== article.icon ? 'cover' : 'contain',
                                    backgroundColor: '#f8f9fa',
                                    padding: '8px'
                                  }}
                                  alt={article.title || "News image"}
                                  onError={(e) => {
                                    e.currentTarget.src = '/images/News.jpg';
                                  }}
                                />
                              </div>
                              <div style={{ flex: 1 }}>
                                <span style={{ 
                                  color: '#007bff', 
                                  fontWeight: 'bold',
                                  fontSize: '14px',
                                  display: 'block',
                                  marginBottom: '5px'
                                }}>
                                  {truncateText(article.url, 35)}
                                </span>
                                <p style={{ 
                                  margin: '0',
                                  maxHeight: '4.5em',
                                  overflow: 'hidden',
                                  whiteSpace: 'normal',
                                  textOverflow: 'ellipsis',
                                  lineHeight: '1.5em',
                                  marginRight: '2px',
                                  fontSize: '14px',
                                  color: '#333'
                                }}>
                                  {article.description}
                                </p>
                              </div>
                            </a>
                          </div>

                          <div className="update">
                            <div className="update-content" style={{
                              fontSize: '12px',
                              color: '#666',
                              display: 'flex',
                              gap: '15px'
                            }}>
                              <span>
                                <strong>Visits</strong>: {article.visits || '0'}
                              </span>
                              <span>
                                <strong>Last Update</strong>: {article.lastUpdate || 'Unknown'}
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      ))
                    )}

                    {/* Load More */}
                    {!loading && news.length > 0 && canLoadMore && (
                      <div className="text-center" style={{ marginTop: '30px' }}>
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
                          {loadingMore ? 'Loading…' : 'Load More News'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Sidebar space - kept for layout consistency */}
                <div className="news-sidebar" style={{ flex: '0 0 33.33%' }}>
                  {/* Sidebar content can be added here if needed */}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />

      {/* Analytics */}
      <Analytics siteId="101276548" />

      {/* Mobile responsive styles for news page */}
      <style>{`
        @media (max-width: 768px) {
          .news-container {
            padding: 15px 15px !important;
          }
          
          .news-layout {
            flex-direction: column !important;
          }
          
          .news-content {
            flex: 1 !important;
            padding-right: 0 !important;
            margin-bottom: 20px;
          }
          
          .news-sidebar {
            display: none !important;
          }
        }
        
        @media (max-width: 480px) {
          .news-container {
            padding: 10px 10px !important;
          }
          
          .results-heading {
            font-size: 16px !important;
          }
          
          .search-result h3 {
            font-size: 16px !important;
          }
          
          .search-link > a > div:first-child {
            width: 60px !important;
            height: 55px !important;
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

export default NewsPage; 