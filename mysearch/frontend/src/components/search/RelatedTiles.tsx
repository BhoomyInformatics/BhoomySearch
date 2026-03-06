import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useSearchStore } from '../../store/searchStore';
import { SearchResult } from '../../types';

interface RelatedTilesProps {
  query: string;
  results: SearchResult[];
}

interface RelatedTile {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  bgColor: string;
  searchQuery: string;
}

const RelatedTiles: React.FC<RelatedTilesProps> = ({ query, results }) => {
  const navigate = useNavigate();
  const { addToHistory } = useSearchStore();

  // Generate related tiles based on query and results
  const generateTiles = (): RelatedTile[] => {
    const tiles: RelatedTile[] = [];
    const queryLower = query.toLowerCase();

    // Extract unique patterns from results
    const categories = new Set<string>();
    results.slice(0, 10).forEach(result => {
      if (result.site_category) {
        categories.add(result.site_category);
      }
    });

    // Create tiles based on query context
    if (queryLower.includes('crop') || queryLower.includes('farm') || queryLower.includes('agriculture')) {
      tiles.push(
        {
          id: 'weather',
          title: 'Weather Forecast',
          description: 'Get weather updates for farming',
          icon: '🌤️',
          color: '#0ea5e9',
          bgColor: '#e0f2fe',
          searchQuery: 'weather forecast agriculture'
        },
        {
          id: 'prices',
          title: 'Crop Prices',
          description: 'Check current market prices',
          icon: '💰',
          color: '#10b981',
          bgColor: '#d1fae5',
          searchQuery: 'crop prices market'
        }
      );
    }

    if (queryLower.includes('student') || queryLower.includes('study') || queryLower.includes('education')) {
      tiles.push(
        {
          id: 'courses',
          title: 'Online Courses',
          description: 'Find courses to enhance skills',
          icon: '📚',
          color: '#3b82f6',
          bgColor: '#dbeafe',
          searchQuery: 'online courses free'
        },
        {
          id: 'scholarships',
          title: 'Scholarships',
          description: 'Discover scholarship opportunities',
          icon: '🎓',
          color: '#8b5cf6',
          bgColor: '#e9d5ff',
          searchQuery: 'scholarships 2025'
        }
      );
    }

    if (queryLower.includes('health') || queryLower.includes('medical') || queryLower.includes('doctor')) {
      tiles.push(
        {
          id: 'facilities',
          title: 'Medical Facilities',
          description: 'Find nearby healthcare centers',
          icon: '🏥',
          color: '#ef4444',
          bgColor: '#fee2e2',
          searchQuery: 'medical facilities near me'
        },
        {
          id: 'wellness',
          title: 'Wellness Tips',
          description: 'Health and wellness guidance',
          icon: '💚',
          color: '#10b981',
          bgColor: '#d1fae5',
          searchQuery: 'health wellness tips'
        }
      );
    }

    // Add generic related tiles if not enough
    if (tiles.length < 4) {
      tiles.push(
        {
          id: 'related1',
          title: 'Related Articles',
          description: 'Explore similar content',
          icon: '📄',
          color: '#fe780e',
          bgColor: '#fff7ed',
          searchQuery: `${query} articles`
        },
        {
          id: 'related2',
          title: 'Popular Searches',
          description: 'See what others are searching',
          icon: '🔥',
          color: '#f59e0b',
          bgColor: '#fef3c7',
          searchQuery: 'trending searches'
        }
      );
    }

    return tiles.slice(0, 4);
  };

  const tiles = generateTiles();

  const handleTileClick = (tile: RelatedTile) => {
    addToHistory(tile.searchQuery);
    navigate(`/search?q=${encodeURIComponent(tile.searchQuery)}`);
  };

  if (tiles.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8"
    >
      <h3 className="text-lg font-bold text-gray-800 mb-4">Related Searches</h3>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {tiles.map((tile, idx) => (
          <motion.div
            key={tile.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.1 }}
            whileHover={{ scale: 1.05, y: -4 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleTileClick(tile)}
            className="cursor-pointer rounded-xl p-4 shadow-md hover:shadow-lg transition-all border-2 border-transparent hover:border-orange-300"
            style={{
              background: `linear-gradient(135deg, ${tile.bgColor} 0%, ${tile.color}15 100%)`
            }}
          >
            <div className="flex items-start gap-3 mb-2">
              <div className="text-2xl">{tile.icon}</div>
              <div className="flex-1">
                <h4 className="font-bold text-sm text-gray-800 mb-1">{tile.title}</h4>
                <p className="text-xs text-gray-600 line-clamp-2">{tile.description}</p>
              </div>
            </div>
            <div className="flex items-center justify-end mt-3">
              <span className="text-xs font-medium" style={{ color: tile.color }}>
                Search →
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

export default RelatedTiles;

