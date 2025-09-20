import { StateCreator } from 'zustand';

// Performance monitoring slice
export interface PerformanceSlice {
  // Performance metrics
  renderCount: number;
  lastRenderTime: number;
  searchPerformance: {
    totalSearches: number;
    totalTime: number;
    averageTime: number;
    slowSearchCount: number;
    fastestSearch: number;
    slowestSearch: number;
  };
  stateChangeStats: {
    totalChanges: number;
    changesBySlice: Record<string, number>;
    lastChangeTime: number;
  };
  
  // Performance actions
  trackRender: () => void;
  trackSearchStart: (searchId: string) => void;
  trackSearchEnd: (searchId: string) => void;
  trackStateChange: (sliceName: string) => void;
  resetPerformanceStats: () => void;
  
  // Performance getters
  getPerformanceReport: () => PerformanceReport;
  isPerformanceGood: () => boolean;
  getSlowOperations: () => SlowOperation[];
}

interface PerformanceReport {
  renderCount: number;
  averageSearchTime: number;
  totalStateChanges: number;
  performanceScore: number;
  recommendations: string[];
}

interface SlowOperation {
  type: 'search' | 'render' | 'state_change';
  duration: number;
  timestamp: number;
  details?: any;
}

export const createPerformanceSlice: StateCreator<
  PerformanceSlice,
  [],
  [],
  PerformanceSlice
> = (set, get) => {
  const activeSearches = new Map<string, number>();
  const slowOperations: SlowOperation[] = [];
  
  return {
    // Initial state
    renderCount: 0,
    lastRenderTime: Date.now(),
    searchPerformance: {
      totalSearches: 0,
      totalTime: 0,
      averageTime: 0,
      slowSearchCount: 0,
      fastestSearch: Infinity,
      slowestSearch: 0
    },
    stateChangeStats: {
      totalChanges: 0,
      changesBySlice: {},
      lastChangeTime: Date.now()
    },

    // Actions
    trackRender: () => {
      const now = Date.now();
      const state = get();
      
      set({
        renderCount: state.renderCount + 1,
        lastRenderTime: now
      });
      
      // Log excessive renders
      if (state.renderCount > 0 && state.renderCount % 50 === 0) {
        console.warn('⚠️ PerformanceSlice: High render count detected:', state.renderCount);
      }
    },

    trackSearchStart: (searchId) => {
      const now = Date.now();
      activeSearches.set(searchId, now);
      
      console.log('⏱️ PerformanceSlice: Search started:', searchId);
    },

    trackSearchEnd: (searchId) => {
      const startTime = activeSearches.get(searchId);
      if (!startTime) return;
      
      const now = Date.now();
      const duration = now - startTime;
      activeSearches.delete(searchId);
      
      const state = get();
      const newTotalSearches = state.searchPerformance.totalSearches + 1;
      const newTotalTime = state.searchPerformance.totalTime + duration;
      const newAverageTime = newTotalTime / newTotalSearches;
      
      const isSlowSearch = duration > 2000; // 2 seconds threshold
      const newSlowSearchCount = state.searchPerformance.slowSearchCount + (isSlowSearch ? 1 : 0);
      
      if (isSlowSearch) {
        slowOperations.push({
          type: 'search',
          duration,
          timestamp: now,
          details: { searchId }
        });
        
        console.warn('🐌 PerformanceSlice: Slow search detected:', {
          searchId,
          duration: duration + 'ms'
        });
      }
      
      set({
        searchPerformance: {
          totalSearches: newTotalSearches,
          totalTime: newTotalTime,
          averageTime: newAverageTime,
          slowSearchCount: newSlowSearchCount,
          fastestSearch: Math.min(state.searchPerformance.fastestSearch, duration),
          slowestSearch: Math.max(state.searchPerformance.slowestSearch, duration)
        }
      });
      
      console.log('⏱️ PerformanceSlice: Search completed:', {
        searchId,
        duration: duration + 'ms',
        averageTime: newAverageTime.toFixed(2) + 'ms'
      });
    },

    trackStateChange: (sliceName) => {
      const now = Date.now();
      const state = get();
      
      const newChangesBySlice = {
        ...state.stateChangeStats.changesBySlice,
        [sliceName]: (state.stateChangeStats.changesBySlice[sliceName] || 0) + 1
      };
      
      set({
        stateChangeStats: {
          totalChanges: state.stateChangeStats.totalChanges + 1,
          changesBySlice: newChangesBySlice,
          lastChangeTime: now
        }
      });
      
      // Log frequent state changes
      const sliceChangeCount = newChangesBySlice[sliceName];
      if (sliceChangeCount > 0 && sliceChangeCount % 20 === 0) {
        console.warn('⚠️ PerformanceSlice: Frequent state changes in slice:', {
          sliceName,
          changeCount: sliceChangeCount
        });
      }
    },

    resetPerformanceStats: () => {
      console.log('🔄 PerformanceSlice: Resetting performance statistics');
      
      activeSearches.clear();
      slowOperations.length = 0;
      
      set({
        renderCount: 0,
        lastRenderTime: Date.now(),
        searchPerformance: {
          totalSearches: 0,
          totalTime: 0,
          averageTime: 0,
          slowSearchCount: 0,
          fastestSearch: Infinity,
          slowestSearch: 0
        },
        stateChangeStats: {
          totalChanges: 0,
          changesBySlice: {},
          lastChangeTime: Date.now()
        }
      });
    },

    // Computed functions
    getPerformanceReport: (): PerformanceReport => {
      const state = get();
      const { searchPerformance, stateChangeStats, renderCount } = state;
      
      // Calculate performance score (0-100)
      let score = 100;
      
      // Deduct points for slow searches
      if (searchPerformance.totalSearches > 0) {
        const slowSearchRatio = searchPerformance.slowSearchCount / searchPerformance.totalSearches;
        score -= slowSearchRatio * 30;
      }
      
      // Deduct points for excessive renders
      if (renderCount > 100) {
        score -= Math.min(20, (renderCount - 100) / 10);
      }
      
      // Deduct points for excessive state changes
      if (stateChangeStats.totalChanges > 200) {
        score -= Math.min(15, (stateChangeStats.totalChanges - 200) / 20);
      }
      
      score = Math.max(0, Math.round(score));
      
      // Generate recommendations
      const recommendations: string[] = [];
      
      if (searchPerformance.averageTime > 1500) {
        recommendations.push('Consider optimizing search API calls or implementing caching');
      }
      
      if (renderCount > 150) {
        recommendations.push('High render count detected - consider using React.memo or useMemo');
      }
      
      if (stateChangeStats.totalChanges > 300) {
        recommendations.push('Frequent state changes detected - consider batching updates');
      }
      
      const mostActiveSlice = Object.entries(stateChangeStats.changesBySlice)
        .sort(([, a], [, b]) => b - a)[0];
      
      if (mostActiveSlice && mostActiveSlice[1] > 50) {
        recommendations.push(`Consider optimizing ${mostActiveSlice[0]} slice - it has the most state changes`);
      }
      
      return {
        renderCount,
        averageSearchTime: searchPerformance.averageTime,
        totalStateChanges: stateChangeStats.totalChanges,
        performanceScore: score,
        recommendations
      };
    },

    isPerformanceGood: () => {
      const state = get();
      const report = state.getPerformanceReport();
      return report.performanceScore >= 70;
    },

    getSlowOperations: () => {
      return [...slowOperations].sort((a, b) => b.timestamp - a.timestamp);
    }
  };
};
