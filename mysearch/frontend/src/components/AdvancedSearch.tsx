/**
 * Advanced Search Component with Boolean Operators Support
 * Provides guided input, syntax help, and examples for complex search queries
 */

import React, { useState, useEffect, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, HelpCircle, X, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { apiClient } from '../utils/api';

interface SyntaxHelp {
  operators: Record<string, string>;
  grouping: Record<string, string>;
  phrases: Record<string, string>;
  fields: Record<string, string>;
  ranges: Record<string, string>;
  examples: string[];
}

interface AdvancedSearchProps {
  onSearch: (query: string) => void;
  initialQuery?: string;
  className?: string;
}

const AdvancedSearch: React.FC<AdvancedSearchProps> = memo(({ 
  onSearch, 
  initialQuery = '', 
  className = '' 
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [showHelp, setShowHelp] = useState(false);
  const [syntaxHelp, setSyntaxHelp] = useState<SyntaxHelp | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedExample, setCopiedExample] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    operators: true,
    fields: false,
    examples: false,
    ranges: false
  });

  // Load syntax help on component mount
  useEffect(() => {
    const loadSyntaxHelp = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get('/api/search/syntax-help');
        if (response.data && response.data.success) {
          setSyntaxHelp(response.data.data.syntax_help);
        }
      } catch (error) {
        console.error('Failed to load syntax help:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSyntaxHelp();
  }, []);

  // Handle search submission
  const handleSearch = useCallback((searchQuery: string) => {
    if (searchQuery.trim()) {
      onSearch(searchQuery.trim());
    }
  }, [onSearch]);

  // Handle form submission
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(query);
  }, [query, handleSearch]);

  // Handle example click
  const handleExampleClick = useCallback((example: string) => {
    setQuery(example);
    handleSearch(example);
  }, [handleSearch]);

  // Copy example to clipboard
  const copyExample = useCallback(async (example: string) => {
    try {
      await navigator.clipboard.writeText(example);
      setCopiedExample(example);
      setTimeout(() => setCopiedExample(null), 2000);
    } catch (error) {
      console.error('Failed to copy example:', error);
    }
  }, []);

  // Toggle section expansion
  const toggleSection = useCallback((section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  }, []);

  // Quick insert buttons
  const quickInsert = useCallback((text: string) => {
    const textarea = document.getElementById('advanced-search-input') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newText = query.substring(0, start) + text + query.substring(end);
      setQuery(newText);
      
      // Focus and set cursor position
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + text.length, start + text.length);
      }, 0);
    }
  }, [query]);

  return (
    <div className={`advanced-search-container ${className}`}>
      {/* Search Form */}
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="relative">
          <textarea
            id="advanced-search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter your search query... (e.g., apple AND banana NOT politics)"
            className="w-full p-4 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
            rows={3}
            style={{ minHeight: '80px' }}
          />
          <div className="absolute top-2 right-2 flex gap-2">
            <button
              type="button"
              onClick={() => setShowHelp(!showHelp)}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              title="Search syntax help"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
            <button
              type="submit"
              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              title="Search"
            >
              <Search className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Insert Buttons */}
        <div className="flex flex-wrap gap-2 mt-3">
          <button
            type="button"
            onClick={() => quickInsert(' AND ')}
            className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            AND
          </button>
          <button
            type="button"
            onClick={() => quickInsert(' OR ')}
            className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            OR
          </button>
          <button
            type="button"
            onClick={() => quickInsert(' NOT ')}
            className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            NOT
          </button>
          <button
            type="button"
            onClick={() => quickInsert('" "')}
            className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            "phrase"
          </button>
          <button
            type="button"
            onClick={() => quickInsert('()')}
            className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            (group)
          </button>
        </div>
      </form>

      {/* Syntax Help Panel */}
      <AnimatePresence>
        {showHelp && syntaxHelp && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 mb-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Search Syntax Help
              </h3>
              <button
                onClick={() => setShowHelp(false)}
                className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Operators Section */}
            <div className="mb-6">
              <button
                onClick={() => toggleSection('operators')}
                className="flex items-center justify-between w-full text-left font-medium text-gray-900 dark:text-white mb-2"
              >
                <span>Boolean Operators</span>
                {expandedSections.operators ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              <AnimatePresence>
                {expandedSections.operators && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-2"
                  >
                    {Object.entries(syntaxHelp.operators).map(([operator, description]) => (
                      <div key={operator} className="flex items-center gap-3">
                        <code className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-sm font-mono">
                          {operator}
                        </code>
                        <span className="text-sm text-gray-600 dark:text-gray-400">{description}</span>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Fields Section */}
            <div className="mb-6">
              <button
                onClick={() => toggleSection('fields')}
                className="flex items-center justify-between w-full text-left font-medium text-gray-900 dark:text-white mb-2"
              >
                <span>Field-Specific Search</span>
                {expandedSections.fields ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              <AnimatePresence>
                {expandedSections.fields && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-2"
                  >
                    {Object.entries(syntaxHelp.fields).map(([field, description]) => (
                      <div key={field} className="flex items-center gap-3">
                        <code className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded text-sm font-mono">
                          {field}
                        </code>
                        <span className="text-sm text-gray-600 dark:text-gray-400">{description}</span>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Ranges Section */}
            <div className="mb-6">
              <button
                onClick={() => toggleSection('ranges')}
                className="flex items-center justify-between w-full text-left font-medium text-gray-900 dark:text-white mb-2"
              >
                <span>Range Queries</span>
                {expandedSections.ranges ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              <AnimatePresence>
                {expandedSections.ranges && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-2"
                  >
                    {Object.entries(syntaxHelp.ranges).map(([range, description]) => (
                      <div key={range} className="flex items-center gap-3">
                        <code className="px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded text-sm font-mono">
                          {range}
                        </code>
                        <span className="text-sm text-gray-600 dark:text-gray-400">{description}</span>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Examples Section */}
            <div className="mb-6">
              <button
                onClick={() => toggleSection('examples')}
                className="flex items-center justify-between w-full text-left font-medium text-gray-900 dark:text-white mb-2"
              >
                <span>Example Queries</span>
                {expandedSections.examples ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              <AnimatePresence>
                {expandedSections.examples && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-3"
                  >
                    {syntaxHelp.examples.map((example, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 bg-white dark:bg-gray-700 rounded-lg">
                        <code className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded text-sm font-mono">
                          {example}
                        </code>
                        <button
                          onClick={() => handleExampleClick(example)}
                          className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
                        >
                          Try
                        </button>
                        <button
                          onClick={() => copyExample(example)}
                          className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                          title="Copy example"
                        >
                          {copiedExample === example ? (
                            <Check className="w-4 h-4 text-green-600" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Grouping and Phrases */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Grouping</h4>
                <div className="space-y-2">
                  {Object.entries(syntaxHelp.grouping).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-3">
                      <code className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded text-sm font-mono">
                        {key}
                      </code>
                      <span className="text-sm text-gray-600 dark:text-gray-400">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Phrases</h4>
                <div className="space-y-2">
                  {Object.entries(syntaxHelp.phrases).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-3">
                      <code className="px-2 py-1 bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 rounded text-sm font-mono">
                        {key}
                      </code>
                      <span className="text-sm text-gray-600 dark:text-gray-400">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-4">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600 dark:text-gray-400">Loading syntax help...</span>
        </div>
      )}
    </div>
  );
});

AdvancedSearch.displayName = 'AdvancedSearch';

export default AdvancedSearch;
