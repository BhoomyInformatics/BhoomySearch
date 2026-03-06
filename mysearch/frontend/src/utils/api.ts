import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { SearchQuery, SearchResponse, ApiResponse, Site, CrawlStatistics } from '../types';
// MOCK API DISABLED - Using production server with direct DB and Elasticsearch access
// import { mockSearchAPI, mockImagesAPI, mockNewsAPI, mockVideosAPI } from './mockApi';

class APIClient {
  private api: AxiosInstance;

  // Method to get the correct API base URL
  private getAPIBaseURL(): string {
    // In production, use the same origin as the frontend
    if (typeof window !== 'undefined') {
      const { protocol, hostname, port } = window.location;
      
      // If we're on the production domain, use the same origin
      if (hostname.includes('bhoomy.in') || hostname.includes('bhoomy.com')) {
        return `${protocol}//${hostname}${port ? `:${port}` : ''}`;
      }
      
      // For local development or other domains
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return `${protocol}//${hostname}:3000`;
      }
      
      // Default to same origin
      return `${protocol}//${hostname}${port ? `:${port}` : ''}`;
    }
    
    // Fallback for server-side rendering
    return 'http://localhost:3000';
  }

  constructor(baseURL?: string) {
    // Automatically detect the correct API URL based on environment
    const defaultBaseURL = this.getAPIBaseURL();
    
    this.api = axios.create({
      baseURL: baseURL || defaultBaseURL,
      timeout: 10000, // Increased timeout for production
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('auth_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.api.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('auth_token');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Helper method to handle API responses
  private handleResponse<T>(response: AxiosResponse): ApiResponse<T> {
    // If the backend already returns the proper structure, return it directly
    if (response.data && typeof response.data.success !== 'undefined') {
      return response.data;
    }
    
    // Fallback for other responses
    return {
      success: true,
      data: response.data,
      message: response.data.message || 'Success'
    };
  }

  private handleError(error: any): ApiResponse {
    const isConnectionError = error.code === 'ECONNREFUSED' || 
                              error.code === 'ERR_CONNECTION_REFUSED' || 
                              error.code === 'ENOTFOUND' ||
                              error.message?.includes('Network Error') ||
                              error.message?.includes('ERR_CONNECTION_REFUSED');
    
    if (error.response) {
      // Server responded with an error status
      const statusCode = error.response.status;
      const errorMessage = error.response.data?.message || error.response.data?.error || 'Server error';
      
      console.warn(`Server error ${statusCode}: ${errorMessage}`);
      
      return {
        success: false,
        error: errorMessage,
        code: statusCode
      };
    } else if (error.request || isConnectionError) {
      // Network error - backend is not available (don't log error, just return)
      // The caller will handle fallback to mock API
      return {
        success: false,
        error: 'Backend server not available',
        code: 0
      };
    } else {
      // Only log unexpected errors
      console.error('API Error:', error);
      return {
        success: false,
        error: error.message || 'An unexpected error occurred',
        code: -1
      };
    }
  }

  // Search API methods with fallback
  async search(query: SearchQuery): Promise<ApiResponse<SearchResponse>> {
    try {
      console.log(`🔍 Searching for: "${query.q}" via API: ${this.api.defaults.baseURL}/api/search`);
      console.log('🔍 Search parameters:', {
        q: query.q,
        page: query.page || 1,
        per_page: query.per_page || 20,
        category: query.filters?.category,
        language: query.filters?.language,
        country: query.filters?.country,
        content_type: query.filters?.content_type || 'all',
        sort_by: query.filters?.sort_by || 'relevance',
        date_from: query.filters?.date_range?.from,
        date_to: query.filters?.date_range?.to
      });
      
      const response = await this.api.get('/api/search', {
        params: {
          q: query.q,
          page: query.page || 1,
          per_page: query.per_page || 20,
          category: query.filters?.category,
          language: query.filters?.language,
          country: query.filters?.country,
          content_type: query.filters?.content_type || 'all',
          sort_by: query.filters?.sort_by || 'relevance',
          date_from: query.filters?.date_range?.from,
          date_to: query.filters?.date_range?.to
        }
      });
      
      console.log('✅ API search successful - Raw Response:', {
        status: response.status,
        statusText: response.statusText,
        data_keys: Object.keys(response.data),
        data_success: response.data.success,
        data_structure: {
          success: response.data.success,
          data: response.data.data ? {
            results_count: response.data.data.results?.length,
            total: response.data.data.total,
            query: response.data.data.query
          } : 'NO DATA OBJECT',
          error: response.data.error
        }
      });
      
      const handledResponse = this.handleResponse<SearchResponse>(response);
      console.log('✅ Handled Response:', {
        success: handledResponse.success,
        data: handledResponse.data ? {
          results_count: handledResponse.data.results?.length,
          total: handledResponse.data.total,
          query: handledResponse.data.query
        } : 'NO DATA',
        error: handledResponse.error
      });
      
      return handledResponse;
    } catch (error: any) {
      const errorResponse = this.handleError(error);
      
      // MOCK API DISABLED - Using production server with direct DB and Elasticsearch access
      // Fallback to mock API if backend is unavailable - DISABLED
      /*
      const isConnectionError = error.code === 'ECONNREFUSED' || 
                                error.code === 'ERR_CONNECTION_REFUSED' || 
                                error.code === 'ENOTFOUND' ||
                                errorResponse.code === 0;
      
      if (!errorResponse.success && isConnectionError) {
        // Only log fallback message, don't log the connection error (expected when backend is down)
        console.log('🔄 Falling back to mock API for search');
        try {
          return await mockSearchAPI(query.q, query.page || 1);
        } catch (mockError) {
          console.error('❌ Mock API also failed:', mockError);
          return errorResponse;
        }
      } else if (!isConnectionError) {
        // Only log non-connection errors
        console.error('❌ API search failed:', error);
      }
      */
      
      // Log all errors when mock API is disabled
      console.error('❌ API search failed:', error);
      return errorResponse;
    }
  }

  async searchImages(query: string, page: number = 1, per_page: number = 100): Promise<ApiResponse<any>> {
    try {
      console.log(`🖼️ Searching images for: "${query}" via API: ${this.api.defaults.baseURL}/api/images`);
      console.log('🖼️ Images search parameters:', { q: query, page, per_page });
      const response = await this.api.get('/api/images', {
        params: { q: query, page, per_page }
      });
      console.log('✅ API images search successful');
      return this.handleResponse<any>(response);
    } catch (error: any) {
      console.error('❌ API images search failed:', error);
      const errorResponse = this.handleError(error);
      
      // MOCK API DISABLED - Using production server with direct DB and Elasticsearch access
      // Fallback to mock API if backend is unavailable - DISABLED
      /*
      if (!errorResponse.success && (errorResponse.code === 0 || error.code === 'ECONNREFUSED' || error.code === 'ERR_CONNECTION_REFUSED' || error.code === 'ENOTFOUND')) {
        console.log('🔄 Falling back to mock API for images');
        try {
          return await mockImagesAPI(query, page);
        } catch (mockError) {
          console.error('❌ Mock API also failed:', mockError);
          return errorResponse;
        }
      }
      */
      
      return errorResponse;
    }
  }

  async searchNews(query: string, page: number = 1, per_page: number = 20): Promise<ApiResponse<any>> {
    try {
      console.log(`📰 Searching news for: "${query}" via API: ${this.api.defaults.baseURL}/api/news`);
      console.log('📰 News search parameters:', { q: query, page, per_page });
      const response = await this.api.get('/api/news', {
        params: { q: query, page, per_page }
      });
      console.log('✅ API news search successful');
      return this.handleResponse<any>(response);
    } catch (error: any) {
      console.error('❌ API news search failed:', error);
      const errorResponse = this.handleError(error);
      
      // MOCK API DISABLED - Using production server with direct DB and Elasticsearch access
      // Fallback to mock API if backend is unavailable - DISABLED
      /*
      if (!errorResponse.success && (errorResponse.code === 0 || error.code === 'ECONNREFUSED' || error.code === 'ERR_CONNECTION_REFUSED' || error.code === 'ENOTFOUND')) {
        console.log('🔄 Falling back to mock API for news');
        try {
          return await mockNewsAPI(query, page);
        } catch (mockError) {
          console.error('❌ Mock API also failed:', mockError);
          return errorResponse;
        }
      }
      */
      
      return errorResponse;
    }
  }

  async searchVideos(query: string, page: number = 1, per_page: number = 20): Promise<ApiResponse<any>> {
    try {
      console.log(`🎬 Searching videos for: "${query}" via API: ${this.api.defaults.baseURL}/api/videos`);
      console.log('🎬 Videos search parameters:', { q: query, page, per_page });
      const response = await this.api.get('/api/videos', {
        params: { q: query, page, per_page }
      });
      console.log('✅ API videos search successful');
      return this.handleResponse<any>(response);
    } catch (error: any) {
      console.error('❌ API videos search failed:', error);
      const errorResponse = this.handleError(error);
      
      // MOCK API DISABLED - Using production server with direct DB and Elasticsearch access
      // Fallback to mock API if backend is unavailable - DISABLED
      /*
      if (!errorResponse.success && (errorResponse.code === 0 || error.code === 'ECONNREFUSED' || error.code === 'ERR_CONNECTION_REFUSED' || error.code === 'ENOTFOUND')) {
        console.log('🔄 Falling back to mock API for videos');
        try {
          return await mockVideosAPI(query, page);
        } catch (mockError) {
          console.error('❌ Mock API also failed:', mockError);
          return errorResponse;
        }
      }
      */
      
      return errorResponse;
    }
  }

  async getSuggestions(query: string): Promise<ApiResponse<string[]>> {
    try {
      const response = await this.api.get('/api/search/suggestions', {
        params: { q: query }
      });
      return this.handleResponse<string[]>(response);
    } catch (error: any) {
      // Only log error if it's not a connection refused (backend down is expected in dev)
      const isConnectionError = error.code === 'ECONNREFUSED' || 
                                error.code === 'ERR_CONNECTION_REFUSED' || 
                                error.code === 'ENOTFOUND' ||
                                error.message?.includes('Network Error') ||
                                error.message?.includes('ERR_CONNECTION_REFUSED');
      
      if (!isConnectionError) {
        console.error('❌ API suggestions failed:', error);
      }
      
      return {
        success: false,
        error: 'Suggestions service temporarily unavailable',
        data: []
      };
    }
  }

  async getCategories(): Promise<ApiResponse<string[]>> {
    try {
      const response = await this.api.get('/api/categories');
      return this.handleResponse<string[]>(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getLanguages(): Promise<ApiResponse<{ code: string; name: string }[]>> {
    try {
      const response = await this.api.get('/api/languages');
      return this.handleResponse<{ code: string; name: string }[]>(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

  // Site management API methods
  async getSites(page = 1, per_page = 20): Promise<ApiResponse<{ sites: Site[]; total: number }>> {
    try {
      const response = await this.api.get('/api/sites', {
        params: { page, per_page }
      });
      return this.handleResponse<{ sites: Site[]; total: number }>(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getSite(siteId: number): Promise<ApiResponse<Site>> {
    try {
      const response = await this.api.get(`/api/sites/${siteId}`);
      return this.handleResponse<Site>(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async addSite(siteData: Partial<Site>): Promise<ApiResponse<Site>> {
    try {
      const response = await this.api.post('/api/sites', siteData);
      return this.handleResponse<Site>(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async updateSite(siteId: number, siteData: Partial<Site>): Promise<ApiResponse<Site>> {
    try {
      const response = await this.api.put(`/api/sites/${siteId}`, siteData);
      return this.handleResponse<Site>(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async deleteSite(siteId: number): Promise<ApiResponse<void>> {
    try {
      const response = await this.api.delete(`/api/sites/${siteId}`);
      return this.handleResponse<void>(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

  // Crawl statistics API methods
  async getCrawlStatistics(siteId?: number): Promise<ApiResponse<CrawlStatistics[]>> {
    try {
      const response = await this.api.get('/api/crawl/statistics', {
        params: siteId ? { site_id: siteId } : {}
      });
      return this.handleResponse<CrawlStatistics[]>(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async startCrawl(siteId: number): Promise<ApiResponse<{ session_id: string }>> {
    try {
      const response = await this.api.post(`/api/crawl/start/${siteId}`);
      return this.handleResponse<{ session_id: string }>(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async stopCrawl(sessionId: string): Promise<ApiResponse<void>> {
    try {
      const response = await this.api.post(`/api/crawl/stop/${sessionId}`);
      return this.handleResponse<void>(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

  // Authentication API methods
  async login(email: string, password: string): Promise<ApiResponse<{ token: string; user: any }>> {
    try {
      const response = await this.api.post('/api/auth/login', { email, password });
      return this.handleResponse<{ token: string; user: any }>(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async register(userData: { name: string; email: string; password: string }): Promise<ApiResponse<{ token: string; user: any }>> {
    try {
      const response = await this.api.post('/api/auth/register', userData);
      return this.handleResponse<{ token: string; user: any }>(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async logout(): Promise<ApiResponse<void>> {
    try {
      const response = await this.api.post('/api/auth/logout');
      localStorage.removeItem('auth_token');
      return this.handleResponse<void>(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getCurrentUser(): Promise<ApiResponse<any>> {
    try {
      const response = await this.api.get('/api/auth/me');
      return this.handleResponse<any>(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

  // Generic GET method for convenience
  async get(url: string, params?: any): Promise<any> {
    try {
      const response = await this.api.get(url, { params });
      return response;
    } catch (error) {
      throw error;
    }
  }

  // Health check endpoint
  async healthCheck(): Promise<ApiResponse<{ status: string; timestamp: string }>> {
    try {
      const response = await this.api.get('/api/health');
      return this.handleResponse<{ status: string; timestamp: string }>(response);
    } catch (error) {
      return this.handleError(error);
    }
  }
}

// Create and export API instance
export const apiClient = new APIClient();

// Export specific API modules for better organization
export const searchAPI = {
  search: (query: SearchQuery) => apiClient.search(query),
  getSuggestions: (query: string) => apiClient.getSuggestions(query),
  getCategories: () => apiClient.getCategories(),
  getLanguages: () => apiClient.getLanguages()
};

export const siteAPI = {
  getSites: (page?: number, per_page?: number) => apiClient.getSites(page, per_page),
  getSite: (siteId: number) => apiClient.getSite(siteId),
  addSite: (siteData: Partial<Site>) => apiClient.addSite(siteData),
  updateSite: (siteId: number, siteData: Partial<Site>) => apiClient.updateSite(siteId, siteData),
  deleteSite: (siteId: number) => apiClient.deleteSite(siteId)
};

export const crawlAPI = {
  getStatistics: (siteId?: number) => apiClient.getCrawlStatistics(siteId),
  start: (siteId: number) => apiClient.startCrawl(siteId),
  stop: (sessionId: string) => apiClient.stopCrawl(sessionId)
};

export const authAPI = {
  login: (email: string, password: string) => apiClient.login(email, password),
  register: (userData: { name: string; email: string; password: string }) => apiClient.register(userData),
  logout: () => apiClient.logout(),
  getCurrentUser: () => apiClient.getCurrentUser()
};

export default apiClient; 