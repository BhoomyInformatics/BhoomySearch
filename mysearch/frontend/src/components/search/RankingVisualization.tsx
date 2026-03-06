import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Award } from 'lucide-react';

interface RankingVisualizationProps {
  index: number;
  total: number;
  relevanceScore: number;
}

const RankingVisualization: React.FC<RankingVisualizationProps> = ({
  index,
  total,
  relevanceScore
}) => {
  const rankPercentage = ((total - index) / total) * 100;
  const scorePercentage = relevanceScore;

  return (
    <div className="flex items-center gap-3 mb-3">
      {/* Rank Badge */}
      <div className="flex items-center gap-2">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-sm"
          style={{
            background: index < 3 
              ? 'linear-gradient(135deg, #fe780e 0%, #ff9500 100%)'
              : 'linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%)',
            color: index < 3 ? 'white' : '#6b7280'
          }}
        >
          {index < 3 && <Award size={16} />}
          {index >= 3 && `#${index + 1}`}
        </div>
        {index < 3 && (
          <span className="text-xs font-semibold text-orange-600">
            {index === 0 ? 'Top Result' : index === 1 ? '2nd Best' : '3rd Best'}
          </span>
        )}
      </div>

      {/* Relevance Bar */}
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp size={12} className="text-orange-500" />
          <span className="text-xs font-medium text-gray-600">Relevance: {scorePercentage}%</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${scorePercentage}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="h-full rounded-full"
            style={{
              background: scorePercentage >= 80
                ? 'linear-gradient(90deg, #10b981 0%, #059669 100%)'
                : scorePercentage >= 60
                ? 'linear-gradient(90deg, #fe780e 0%, #ff9500 100%)'
                : 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)'
            }}
          />
        </div>
      </div>

      {/* Rank Percentage */}
      <div className="text-right">
        <div className="text-xs font-semibold text-gray-500">Top {Math.round(rankPercentage)}%</div>
        <div className="text-[10px] text-gray-400">of {total} results</div>
      </div>
    </div>
  );
};

export default RankingVisualization;

