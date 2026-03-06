import React from 'react';
import { motion } from 'framer-motion';
import { Info, FileText, Calendar, Globe, Tag } from 'lucide-react';
import { SearchResult } from '../../types';

interface InformationBoxProps {
  result: SearchResult;
}

const InformationBox: React.FC<InformationBoxProps> = ({ result }) => {
  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'N/A';
      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return 'N/A';
    }
  };

  const extractKeywords = (keywords: string) => {
    if (!keywords) return [];
    return keywords.split(',').slice(0, 5).map(k => k.trim());
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-orange-50 to-amber-50 border-2 border-orange-200 rounded-xl p-5 mb-6 shadow-md"
    >
      <div className="flex items-start gap-3 mb-4">
        <div className="p-2 bg-orange-100 rounded-lg">
          <Info size={20} className="text-orange-600" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-lg text-gray-800 mb-1">Quick Information</h3>
          <p className="text-sm text-gray-600">Key details about this result</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Source */}
        <div className="flex items-start gap-3">
          <Globe size={16} className="text-orange-600 mt-0.5 flex-shrink-0" />
          <div>
            <div className="text-xs font-semibold text-gray-500 mb-1">Source</div>
            <div className="text-sm font-medium text-gray-800 truncate">
              {result.site_title || 'Unknown Source'}
            </div>
          </div>
        </div>

        {/* Category */}
        <div className="flex items-start gap-3">
          <Tag size={16} className="text-orange-600 mt-0.5 flex-shrink-0" />
          <div>
            <div className="text-xs font-semibold text-gray-500 mb-1">Category</div>
            <div className="text-sm font-medium text-gray-800">
              {result.site_category || 'General'}
            </div>
          </div>
        </div>

        {/* Date */}
        <div className="flex items-start gap-3">
          <Calendar size={16} className="text-orange-600 mt-0.5 flex-shrink-0" />
          <div>
            <div className="text-xs font-semibold text-gray-500 mb-1">Published</div>
            <div className="text-sm font-medium text-gray-800">
              {formatDate(result.site_data_date)}
            </div>
          </div>
        </div>

        {/* Content Length */}
        <div className="flex items-start gap-3">
          <FileText size={16} className="text-orange-600 mt-0.5 flex-shrink-0" />
          <div>
            <div className="text-xs font-semibold text-gray-500 mb-1">Content</div>
            <div className="text-sm font-medium text-gray-800">
              {result.word_count || result.site_data_word_count || 0} words
            </div>
          </div>
        </div>
      </div>

      {/* Keywords */}
      {result.site_data_keywords && extractKeywords(result.site_data_keywords).length > 0 && (
        <div className="mt-4 pt-4 border-t border-orange-200">
          <div className="text-xs font-semibold text-gray-500 mb-2">Keywords</div>
          <div className="flex flex-wrap gap-2">
            {extractKeywords(result.site_data_keywords).map((keyword, idx) => (
              <span
                key={idx}
                className="px-2 py-1 bg-white border border-orange-200 rounded-md text-xs text-gray-700"
              >
                {keyword}
              </span>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default InformationBox;

