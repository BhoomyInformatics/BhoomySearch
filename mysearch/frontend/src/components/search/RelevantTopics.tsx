import React from 'react';
import { motion } from 'framer-motion';
import { Search, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSearchStore } from '../../store/searchStore';

interface RelevantTopicsProps {
  query: string;
  results: any[];
}

const RelevantTopics: React.FC<RelevantTopicsProps> = ({ query, results }) => {
  const navigate = useNavigate();
  const { addToHistory } = useSearchStore();

  // Generate relevant topics based on query and results
  const generateTopics = () => {
    const topics: string[] = [];
    const queryLower = query.toLowerCase();
    
    // Extract unique categories from results
    const categories = new Set<string>();
    results.forEach(result => {
      if (result.site_category) {
        categories.add(result.site_category);
      }
    });

    // Generate topic suggestions
    if (queryLower.includes('crop') || queryLower.includes('farm')) {
      topics.push('agricultural techniques', 'crop management', 'farming methods', 'soil health');
    } else if (queryLower.includes('student') || queryLower.includes('study')) {
      topics.push('online courses', 'exam preparation', 'study materials', 'scholarships');
    } else if (queryLower.includes('health') || queryLower.includes('medical')) {
      topics.push('healthcare services', 'medical facilities', 'wellness tips', 'treatment options');
    } else if (queryLower.includes('business') || queryLower.includes('entrepreneur')) {
      topics.push('business strategies', 'startup ideas', 'marketing tips', 'funding options');
    } else {
      // Generic topics based on categories
      categories.forEach(cat => {
        if (cat && !queryLower.includes(cat.toLowerCase())) {
          topics.push(cat);
        }
      });
      // Add generic suggestions
      topics.push('related articles', 'similar content', 'popular searches', 'trending topics');
    }

    return topics.slice(0, 6);
  };

  const topics = generateTopics();

  const handleTopicClick = (topic: string) => {
    addToHistory(topic);
    navigate(`/search?q=${encodeURIComponent(topic)}`);
  };

  if (topics.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 sm:mb-8"
      style={{ paddingLeft: '15px', paddingRight: '15px' }}
    >
      <div className="flex items-center justify-center sm:justify-start gap-2 mb-4">
        <TrendingUp size={18} className="text-orange-600" />
        <h3 className="text-base sm:text-lg font-bold text-gray-800">Relevant Topics</h3>
        <span className="text-xs text-gray-500 hidden sm:inline">(Explore beyond "{query}")</span>
      </div>
      
      <div className="flex flex-wrap gap-2 sm:gap-3 justify-center sm:justify-start">
        {topics.map((topic, idx) => (
          <motion.button
            key={idx}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.05 }}
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleTopicClick(topic)}
            className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-white border-2 border-orange-200 rounded-lg hover:border-orange-400 hover:bg-orange-50 transition-all shadow-sm"
          >
            <Search size={12} className="text-orange-600 flex-shrink-0" />
            <span className="text-xs sm:text-sm font-medium text-gray-700 whitespace-nowrap">{topic}</span>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
};

export default RelevantTopics;

