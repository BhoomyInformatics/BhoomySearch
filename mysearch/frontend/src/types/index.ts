// Search result types based on database schema
export interface SearchResult {
  id: number;
  site_data_id: number;
  site_data_site_id: number;
  site_data_link: string;
  site_data_title: string;
  site_data_description: string;
  site_data_keywords: string;
  site_data_content: string;
  site_data_article: string;
  site_data_meta_description: string;
  site_data_image: string;
  site_data_icon?: string;
  site_data_date: string;
  site_data_last_update?: string;
  site_data_visit?: number;
  site_data_status: string;
  site_data_word_count: number;
  word_count: number;
  site_data_content_length: number;
  site_title: string;
  site_url: string;
  site_category: string;
  site_language: string;
  site_country: string;
  score?: number;
  highlight?: {
    title?: string[];
    description?: string[];
    content?: string[];
  };
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
  query: string;
  suggestions?: string[];
  filters?: SearchFilters;
  time_taken: number;
}

export interface SearchFilters {
  category?: string;
  language?: string;
  country?: string;
  date_range?: {
    from?: string;
    to?: string;
  };
  content_type?: 'all' | 'text' | 'images' | 'videos' | 'news';
  sort_by?: 'relevance' | 'date' | 'popularity';
}

export interface SearchQuery {
  q: string;
  page?: number;
  per_page?: number;
  filters?: SearchFilters;
}

// Site and crawl types
export interface Site {
  site_id: number;
  site_title: string;
  site_url: string;
  site_description: string;
  site_keywords: string;
  site_category: string;
  site_language: string;
  site_country: string;
  site_active: boolean;
  site_locked: boolean;
  site_priority: number;
  site_crawl_frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
  site_last_crawl_date: string;
  site_next_crawl_date: string;
  site_created: string;
  site_updated: string;
  total_pages_crawled: number;
  successful_crawls: number;
  failed_crawls: number;
  success_rate: number;
}

export interface CrawlStatistics {
  id: number;
  site_id: number;
  crawl_session_id: string;
  session_name: string;
  total_urls: number;
  successful_crawls: number;
  failed_crawls: number;
  duplicate_urls: number;
  skipped_urls: number;
  start_time: string;
  end_time?: string;
  duration_seconds?: number;
  status: 'running' | 'completed' | 'failed' | 'paused' | 'cancelled';
  error_message?: string;
}

// User and authentication types
export interface User {
  user_id: number;
  user_name: string;
  user_email: string;
  user_type: string;
  user_active: boolean;
  user_created: string;
  user_last_login?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// UI and application state types
export interface SearchState {
  query: string;
  results: SearchResult[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
  isLoading: boolean;
  error: string | null;
  filters: SearchFilters;
  suggestions: string[];
  recentSearches: string[];
  searchHistory: SearchQuery[];
}

export interface AppState {
  search: SearchState;
  auth: AuthState;
  ui: {
    theme: 'light' | 'dark';
    sidebar_open: boolean;
    mobile_menu_open: boolean;
  };
}

// API response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  code?: number;
}

// Socket.IO event types
export interface SocketEvents {
  search_suggestions: (query: string) => void;
  real_time_results: (results: SearchResult[]) => void;
  crawl_progress: (progress: CrawlProgress) => void;
}

export interface CrawlProgress {
  site_id: number;
  session_id: string;
  progress: number;
  current_url: string;
  status: string;
  pages_crawled: number;
  pages_remaining: number;
  estimated_time_remaining: number;
} 