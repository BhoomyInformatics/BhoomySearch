import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, GripVertical, X, Edit2 } from 'lucide-react';

export interface Persona {
  id: string;
  title: string;
  description: string;
  icon: string;
  popularSearches: string[];
  color: string;
  bgColor: string;
}

interface PersonaTileProps {
  persona: Persona;
  onSelect: (persona: Persona) => void;
  onRemove?: (id: string) => void;
  onEdit?: (persona: Persona) => void;
  isCustomizable?: boolean;
  isDragging?: boolean;
  onSearch?: (query: string) => void;
}

const PersonaTile: React.FC<PersonaTileProps> = ({
  persona,
  onSelect,
  onRemove,
  onEdit,
  isCustomizable = false,
  isDragging = false,
  onSearch
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ 
        opacity: isDragging ? 0.5 : 1, 
        scale: isDragging ? 0.95 : 1 
      }}
      whileHover={{ scale: isDragging ? 0.95 : 1.02, y: isDragging ? 0 : -4 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2 }}
      className={`relative group ${isDragging ? 'cursor-grabbing' : 'cursor-pointer'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`rounded-lg p-3 md:p-4 transition-all duration-300 shadow-md hover:shadow-xl border-2 ${
          isDragging ? 'border-dashed border-gray-400' : 'border-transparent hover:border-orange-300'
        } ${!isDragging && onSearch ? 'cursor-pointer' : ''}`}
        style={{
          background: `linear-gradient(135deg, ${persona.bgColor} 0%, ${persona.color}15 100%)`,
          borderColor: isHovered && !isDragging ? persona.color : undefined
        }}
        onClick={() => {
          if (!isDragging && onSearch) {
            onSearch(persona.title);
          } else if (!isDragging) {
            onSelect(persona);
          }
        }}
      >
        {/* Customization Controls */}
        {isCustomizable && (
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {onEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(persona);
                }}
                className="p-1 rounded-full bg-white/80 hover:bg-white shadow-sm"
                aria-label="Edit persona"
              >
                <Edit2 size={14} className="text-gray-600" />
              </button>
            )}
            {onRemove && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(persona.id);
                }}
                className="p-1 rounded-full bg-white/80 hover:bg-white shadow-sm"
                aria-label="Remove persona"
              >
                <X size={14} className="text-red-500" />
              </button>
            )}
          </div>
        )}

        {/* Drag Handle */}
        {isCustomizable && (
          <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-move">
            <GripVertical size={16} className="text-gray-400" />
          </div>
        )}

        {/* Icon */}
        <div className="flex items-center gap-2 mb-2">
          <div
            className="w-8 h-8 md:w-10 md:h-10 rounded-lg flex items-center justify-center text-xl md:text-2xl flex-shrink-0"
            style={{ backgroundColor: persona.color + '20' }}
          >
            {persona.icon}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-800 text-sm md:text-base truncate">{persona.title}</h3>
          </div>
        </div>

        {/* Description */}
        <p className="text-xs md:text-sm text-gray-600 mb-3 line-clamp-2">{persona.description}</p>

        {/* Popular Searches */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
            <Search size={12} />
            <span className="text-xs">Popular searches:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {persona.popularSearches.slice(0, 2).map((search, idx) => (
              <motion.button
                key={idx}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onSearch) {
                    onSearch(search);
                  } else {
                    onSelect({ ...persona, popularSearches: [search] });
                  }
                }}
                className="text-xs px-2 py-0.5 rounded-full bg-white/70 hover:bg-white border border-gray-200 transition-colors flex items-center gap-1"
                style={{ color: persona.color }}
              >
                <Search size={8} />
                <span className="truncate max-w-[80px]">{search}</span>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Click to select indicator */}
        <div className="mt-2 md:mt-3 flex items-center justify-end">
          <motion.div
            animate={{ x: isHovered ? 4 : 0 }}
            className="text-xs font-medium flex items-center gap-1"
            style={{ color: persona.color }}
          >
            Select <span>→</span>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};

export default PersonaTile;

