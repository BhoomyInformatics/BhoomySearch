/**
 * React Component Memory Monitor Hook
 * Tracks component lifecycle and memory usage to prevent memory leaks
 */

import { useEffect, useRef, useCallback } from 'react';

interface MemoryMetrics {
  renderCount: number;
  mountTime: number;
  lastRenderTime: number;
  memoryUsage?: any;
  activeEffects: Set<string>;
  cleanup: Array<() => void>;
}

interface ComponentMemoryConfig {
  componentName: string;
  enableMemoryTracking?: boolean;
  enableLeakDetection?: boolean;
  maxEffects?: number;
  alertThreshold?: number; // MB
}

interface ComponentLifecycleCallbacks {
  onMount?: () => void;
  onUnmount?: () => void;
  onRender?: (renderCount: number) => void;
  onMemoryAlert?: (usage: number) => void;
  onLeakDetected?: (leakInfo: any) => void;
}

/**
 * Enhanced hook for monitoring React component memory usage and lifecycle
 */
export const useComponentMemoryMonitor = (
  config: ComponentMemoryConfig,
  callbacks: ComponentLifecycleCallbacks = {}
) => {
  const metricsRef = useRef<MemoryMetrics>({
    renderCount: 0,
    mountTime: Date.now(),
    lastRenderTime: Date.now(),
    activeEffects: new Set(),
    cleanup: []
  });

  const isMountedRef = useRef(true);
  const effectsRegistry = useRef<Map<string, AbortController>>(new Map());
  const timersRegistry = useRef<Set<NodeJS.Timeout>>(new Set());
  const intervalRegistry = useRef<Set<NodeJS.Timeout>>(new Set());

  // Track renders
  useEffect(() => {
    metricsRef.current.renderCount++;
    metricsRef.current.lastRenderTime = Date.now();
    
    if (config.enableMemoryTracking && 'memory' in performance) {
      metricsRef.current.memoryUsage = (performance as any).memory;
      
      // Check memory threshold
      if (config.alertThreshold && metricsRef.current.memoryUsage) {
        const usedMB = metricsRef.current.memoryUsage.usedJSHeapSize / (1024 * 1024);
        if (usedMB > config.alertThreshold) {
          callbacks.onMemoryAlert?.(usedMB);
          console.warn(`🧠 Memory Alert: ${config.componentName} using ${usedMB.toFixed(2)}MB`);
        }
      }
    }

    callbacks.onRender?.(metricsRef.current.renderCount);
  });

  // Component mount/unmount tracking
  useEffect(() => {
    console.log(`🔄 Component mounted: ${config.componentName}`);
    callbacks.onMount?.();

    return () => {
      isMountedRef.current = false;
      console.log(`🔄 Component unmounting: ${config.componentName}`);
      
      // Cleanup all registered effects
      effectsRegistry.current.forEach((controller, effectName) => {
        console.log(`🧹 Aborting effect: ${effectName}`);
        controller.abort();
      });
      effectsRegistry.current.clear();

      // Clear all timers
      timersRegistry.current.forEach(timer => {
        console.log(`🧹 Clearing timer: ${timer}`);
        clearTimeout(timer);
      });
      timersRegistry.current.clear();

      // Clear all intervals
      intervalRegistry.current.forEach(interval => {
        console.log(`🧹 Clearing interval: ${interval}`);
        clearInterval(interval);
      });
      intervalRegistry.current.clear();

      // Run custom cleanup functions
      metricsRef.current.cleanup.forEach((cleanupFn, index) => {
        try {
          console.log(`🧹 Running cleanup function ${index + 1}`);
          cleanupFn();
        } catch (error) {
          console.error(`❌ Cleanup function ${index + 1} failed:`, error);
        }
      });

      callbacks.onUnmount?.();
    };
  }, []);

  // Memory leak detection
  useEffect(() => {
    if (!config.enableLeakDetection) return;

    const leakDetectionTimer = setTimeout(() => {
      const metrics = metricsRef.current;
      const now = Date.now();
      const lifespan = now - metrics.mountTime;
      
      // Detect potential leaks based on patterns
      const suspiciousPatterns = [];
      
      if (metrics.renderCount > 100 && lifespan < 60000) {
        suspiciousPatterns.push('excessive_renders');
      }
      
      if (metrics.activeEffects.size > (config.maxEffects || 10)) {
        suspiciousPatterns.push('too_many_effects');
      }
      
      if (effectsRegistry.current.size > 5) {
        suspiciousPatterns.push('uncleaned_abort_controllers');
      }

      if (suspiciousPatterns.length > 0) {
        const leakInfo = {
          component: config.componentName,
          patterns: suspiciousPatterns,
          metrics: {
            renderCount: metrics.renderCount,
            lifespan,
            activeEffects: Array.from(metrics.activeEffects),
            pendingControllers: effectsRegistry.current.size,
            activeTimers: timersRegistry.current.size
          }
        };
        
        console.warn(`🚨 Potential memory leak detected in ${config.componentName}:`, leakInfo);
        callbacks.onLeakDetected?.(leakInfo);
      }
    }, 30000); // Check after 30 seconds

    return () => clearTimeout(leakDetectionTimer);
  }, []);

  // Utility functions for effect management
  const registerEffect = useCallback((effectName: string, abortController?: AbortController) => {
    if (!isMountedRef.current) {
      console.warn(`⚠️ Attempting to register effect ${effectName} on unmounted component`);
      return null;
    }

    metricsRef.current.activeEffects.add(effectName);
    
    if (abortController) {
      effectsRegistry.current.set(effectName, abortController);
    }

    console.log(`📝 Registered effect: ${effectName}`);
    return effectName;
  }, []);

  const unregisterEffect = useCallback((effectName: string) => {
    metricsRef.current.activeEffects.delete(effectName);
    
    const controller = effectsRegistry.current.get(effectName);
    if (controller) {
      controller.abort();
      effectsRegistry.current.delete(effectName);
    }
    
    console.log(`🗑️ Unregistered effect: ${effectName}`);
  }, []);

  const createAbortablePromise = useCallback(<T>(
    promiseFactory: (signal: AbortSignal) => Promise<T>,
    effectName: string
  ): Promise<T> => {
    const controller = new AbortController();
    registerEffect(effectName, controller);

    return promiseFactory(controller.signal)
      .finally(() => {
        unregisterEffect(effectName);
      });
  }, [registerEffect, unregisterEffect]);

  const safeSetTimeout = useCallback((callback: () => void, delay: number): NodeJS.Timeout => {
    const timer = setTimeout(() => {
      if (isMountedRef.current) {
        callback();
      }
      timersRegistry.current.delete(timer);
    }, delay);
    
    timersRegistry.current.add(timer);
    return timer;
  }, []);

  const safeSetInterval = useCallback((callback: () => void, delay: number): NodeJS.Timeout => {
    const interval = setInterval(() => {
      if (isMountedRef.current) {
        callback();
      } else {
        clearInterval(interval);
        intervalRegistry.current.delete(interval);
      }
    }, delay);
    
    intervalRegistry.current.add(interval);
    return interval;
  }, []);

  const addCleanupFunction = useCallback((cleanupFn: () => void) => {
    metricsRef.current.cleanup.push(cleanupFn);
  }, []);

  const isMounted = useCallback(() => isMountedRef.current, []);

  const getMemoryReport = useCallback(() => {
    const metrics = metricsRef.current;
    const now = Date.now();
    
    return {
      componentName: config.componentName,
      isMounted: isMountedRef.current,
      lifespan: now - metrics.mountTime,
      renderCount: metrics.renderCount,
      timeSinceLastRender: now - metrics.lastRenderTime,
      activeEffects: Array.from(metrics.activeEffects),
      pendingControllers: effectsRegistry.current.size,
      activeTimers: timersRegistry.current.size,
      activeIntervals: intervalRegistry.current.size,
      cleanupFunctions: metrics.cleanup.length,
      memoryUsage: metrics.memoryUsage ? {
        used: (metrics.memoryUsage.usedJSHeapSize / (1024 * 1024)).toFixed(2) + 'MB',
        total: (metrics.memoryUsage.totalJSHeapSize / (1024 * 1024)).toFixed(2) + 'MB',
        limit: (metrics.memoryUsage.jsHeapSizeLimit / (1024 * 1024)).toFixed(2) + 'MB'
      } : null
    };
  }, [config.componentName]);

  return {
    // Core utilities
    isMounted,
    registerEffect,
    unregisterEffect,
    createAbortablePromise,
    
    // Safe timer utilities
    safeSetTimeout,
    safeSetInterval,
    
    // Cleanup utilities
    addCleanupFunction,
    
    // Monitoring utilities
    getMemoryReport,
    
    // Component metrics
    getRenderCount: () => metricsRef.current.renderCount,
    getLifespan: () => Date.now() - metricsRef.current.mountTime,
    getActiveEffectsCount: () => metricsRef.current.activeEffects.size
  };
};

/**
 * Hook for creating abort controller with automatic cleanup
 */
export const useAbortController = (effectName: string) => {
  const controllerRef = useRef<AbortController>();
  
  useEffect(() => {
    controllerRef.current = new AbortController();
    console.log(`🎮 Created AbortController for: ${effectName}`);

    return () => {
      if (controllerRef.current) {
        console.log(`🛑 Aborting controller for: ${effectName}`);
        controllerRef.current.abort();
      }
    };
  }, [effectName]);

  return controllerRef.current;
};

/**
 * Hook for safe async operations with automatic cleanup
 */
export const useSafeAsync = <T>(
  asyncOperation: (signal: AbortSignal) => Promise<T>,
  dependencies: React.DependencyList,
  effectName: string
) => {
  const { createAbortablePromise, isMounted } = useComponentMemoryMonitor(
    { componentName: 'SafeAsync' },
    {}
  );

  useEffect(() => {
    // let promise: Promise<T> | null = null;

    if (isMounted()) {
      createAbortablePromise(asyncOperation, effectName)
        .catch(error => {
          if (error.name !== 'AbortError' && isMounted()) {
            console.error(`❌ Safe async operation failed (${effectName}):`, error);
          }
        });
    }

    return () => {
      // Cleanup is handled by createAbortablePromise
    };
  }, dependencies);
};

export default useComponentMemoryMonitor;
