import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Clock, TrendingUp } from 'lucide-react';
import { apiClient } from '../utils/api';

interface SearchSuggestionsProps {
  query: string;
  onSuggestionClick: (suggestion: string) => void;
}

interface Suggestion {
  text: string;
  type: 'history' | 'trending' | 'autocomplete';
}

const SearchSuggestions: React.FC<SearchSuggestionsProps> = ({ query, onSuggestionClick }) => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    const fetchSuggestions = async () => {
      setLoading(true);
      try {
        const response = await apiClient.get(`/search/suggestions?q=${encodeURIComponent(query)}`);
        const autocomplete = response.data.suggestions?.map((text: string) => ({
          text,
          type: 'autocomplete' as const
        })) || [];

        // Add some mock trending suggestions for demo
        const trending = [
          'AI technology',
          'Climate change',
          'Cryptocurrency',
          'Space exploration'
        ].filter(item => item.toLowerCase().includes(query.toLowerCase()))
         .map(text => ({ text, type: 'trending' as const }));

        setSuggestions([...autocomplete, ...trending].slice(0, 8));
      } catch (error) {
        // Fallback suggestions
        const fallback = [
          `${query} tutorial`,
          `${query} guide`,
          `${query} tips`,
          `what is ${query}`,
          `${query} examples`
        ].map(text => ({ text, type: 'autocomplete' as const }));
        
        setSuggestions(fallback.slice(0, 5));
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(debounceTimer);
  }, [query]);

  if (suggestions.length === 0 && !loading) {
    return null;
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'history':
        return <Clock className="w-4 h-4 text-gray-400" />;
      case 'trending':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      default:
        return <Search className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-2xl shadow-xl z-50 overflow-hidden"
    >
      {loading ? (
        <div className="p-4 text-center">
          <div className="animate-spin inline-block w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
          <span className="ml-2 text-gray-600 dark:text-gray-400">Loading suggestions...</span>
        </div>
      ) : (
        <div className="max-h-80 overflow-y-auto">
          {suggestions.map((suggestion, index) => (
            <motion.button
              key={`${suggestion.text}-${index}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: index * 0.05 }}
              onClick={() => onSuggestionClick(suggestion.text)}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 border-b border-gray-100 dark:border-gray-700 last:border-b-0 flex items-center gap-3"
            >
              {getIcon(suggestion.type)}
              <span className="text-gray-800 dark:text-gray-200 flex-1">
                {suggestion.text}
              </span>
              {suggestion.type === 'trending' && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                  Trending
                </span>
              )}
            </motion.button>
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default SearchSuggestions; 