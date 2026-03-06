/**
 * Mock API utilities (DEV/DEMO)
 *
 * Note: These functions are intended for local development/demo runs when the backend
 * is unavailable. Production should use real API endpoints.
 */

import { SearchResponse, ApiResponse } from '../types';

// Mock search results for when backend is not available
const generateMockResults = (query: string, page: number = 1): SearchResponse => {
  const resultsPerPage = 20;
  const totalResults = 150;
  
  const mockResults = Array.from({ length: resultsPerPage }, (_, index) => {
    const resultIndex = (page - 1) * resultsPerPage + index + 1;
    const wordCount = Math.floor(Math.random() * 2000) + 500;
    const content = `This is a sample search result for "${query}". Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.`;
    const category = ['technology', 'business', 'science', 'health'][Math.floor(Math.random() * 4)];
    
    // Calculate relevance score based on position and query match
    // Higher positions get higher scores (top results are more relevant)
    // Score range: 85-98% for good matches, with slight variation
    const baseScore = 95 - (index * 0.5); // Decrease slightly for lower positions
    const variation = (Math.random() - 0.5) * 6; // ±3% variation
    const relevanceScore = Math.max(85, Math.min(98, Math.round(baseScore + variation)));
    
    return {
      id: resultIndex,
      site_data_id: resultIndex,
      site_data_site_id: Math.floor(resultIndex / 10) + 1,
      site_data_link: `https://example${resultIndex}.com/page-about-${query.toLowerCase().replace(/\s+/g, '-')}`,
      site_data_title: `${query} - Result ${resultIndex} | Sample Website`,
      site_data_description: `This is a sample search result for "${query}". Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation.`,
      site_data_keywords: `${query}, ${category}, sample, example, test`,
      site_data_content: content,
      site_data_article: content,
      site_data_meta_description: `Meta description for ${query} result ${resultIndex}`,
      site_data_image: `https://picsum.photos/800/400?random=${resultIndex}`,
      site_data_icon: `https://picsum.photos/32/32?random=${resultIndex + 100}`,
      site_data_date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      site_data_last_update: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      site_data_visit: Math.floor(Math.random() * 10000),
      site_data_status: 'active',
      site_data_word_count: wordCount,
      word_count: wordCount,
      site_data_content_length: content.length,
      site_title: `Sample Site ${resultIndex}`,
      site_url: `https://example${resultIndex}.com`,
      site_category: category,
      site_language: 'en',
      site_country: 'us',
      score: relevanceScore
    };
  });

  return {
    results: mockResults,
    total: totalResults,
    page: page,
    per_page: resultsPerPage,
    total_pages: Math.ceil(totalResults / resultsPerPage),
    query: query,
    filters: {},
    time_taken: Math.random() * 0.5 + 0.1
  };
};

export const mockSearchAPI = async (query: string, page: number = 1): Promise<ApiResponse<SearchResponse>> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 500));
  
  if (!query || query.trim().length === 0) {
    return {
      success: false,
      error: 'Query cannot be empty',
      code: 400
    };
  }

  return {
    success: true,
    data: generateMockResults(query, page),
    message: 'Mock search results (Backend API not available)'
  };
};

export const mockImagesAPI = async (query: string, page: number = 1): Promise<ApiResponse<any>> => {
  await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
  
  const mockImages = Array.from({ length: 20 }, (_, index) => {
    const imageIndex = (page - 1) * 20 + index + 1;
    return {
      id: imageIndex,
      url: `https://picsum.photos/300/200?random=${imageIndex}&query=${query}`,
      title: `${query} Image ${imageIndex}`,
      source: `example${imageIndex}.com`,
      width: 300,
      height: 200,
      thumbnail: `https://picsum.photos/150/100?random=${imageIndex}&query=${query}`
    };
  });

  return {
    success: true,
    data: {
      images: mockImages,
      total: 500,
      page: page,
      per_page: 20,
      query: query
    },
    message: 'Mock image results (Backend API not available)'
  };
};

export const mockNewsAPI = async (query: string, page: number = 1): Promise<ApiResponse<any>> => {
  await new Promise(resolve => setTimeout(resolve, 400 + Math.random() * 300));
  const mockCategories = ['Technology', 'Sports', 'Business', 'Science', 'Entertainment', 'Health', 'Politics'];

  const mockNews = Array.from({ length: 15 }, (_, index) => {
    const newsIndex = (page - 1) * 15 + index + 1;
    const category = mockCategories[index % mockCategories.length];
    return {
      id: newsIndex,
      title: `${query} News Update ${newsIndex}`,
      description: `Latest news about ${query}. This is a sample news article with important updates and information. Stay informed with the latest developments.`,
      url: `https://news-example${newsIndex}.com/article-${query.toLowerCase().replace(/\s+/g, '-')}`,
      source: `News Source ${newsIndex}`,
      publishedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      imageUrl: `https://picsum.photos/70/65?random=${newsIndex + 1000}&news`,
      category,
      site_category: category
    };
  });

  return {
    success: true,
    data: {
      articles: mockNews,
      total: 200,
      page: page,
      per_page: 15,
      query: query
    },
    message: 'Mock news results (Backend API not available)'
  };
};

export const mockVideosAPI = async (query: string, page: number = 1): Promise<ApiResponse<any>> => {
  await new Promise(resolve => setTimeout(resolve, 350 + Math.random() * 400));
  
  const mockVideos = Array.from({ length: 12 }, (_, index) => {
    const videoIndex = (page - 1) * 12 + index + 1;
    return {
      id: videoIndex,
      title: `${query} Video Tutorial ${videoIndex}`,
      description: `Watch this comprehensive video about ${query}. Learn everything you need to know with step-by-step instructions and expert insights.`,
      url: `https://video-example${videoIndex}.com/watch?v=${query.toLowerCase().replace(/\s+/g, '')}${videoIndex}`,
      thumbnail: `https://picsum.photos/300/180?random=${videoIndex + 2000}&video`,
      duration: `${Math.floor(Math.random() * 20) + 5}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`,
      views: Math.floor(Math.random() * 1000000) + 10000,
      publishedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      channel: `Channel ${videoIndex}`,
      channelUrl: `https://video-example${videoIndex}.com/channel`
    };
  });

  return {
    success: true,
    data: {
      videos: mockVideos,
      total: 300,
      page: page,
      per_page: 12,
      query: query
    },
    message: 'Mock video results (Backend API not available)'
  };
};
