# React Component Lifecycle Optimization Guidelines

## 🎯 Memory Leak Prevention and Performance Best Practices

This document provides comprehensive guidelines for preventing memory leaks and optimizing React component lifecycle management in the Bhoomy Search Engine frontend.

---

## 📋 Table of Contents

1. [Memory Leak Common Causes](#memory-leak-common-causes)
2. [UseEffect Cleanup Best Practices](#useeffect-cleanup-best-practices)
3. [API Request Management](#api-request-management)
4. [Memory Monitoring Tools](#memory-monitoring-tools)
5. [Component Design Patterns](#component-design-patterns)
6. [Testing Memory Leaks](#testing-memory-leaks)
7. [Performance Optimization Checklist](#performance-optimization-checklist)

---

## 🚨 Memory Leak Common Causes

### 1. **Uncleared useEffect Hooks**
```typescript
// ❌ BAD: No cleanup function
useEffect(() => {
  const timer = setInterval(() => {
    updateData();
  }, 1000);
  // Missing cleanup - MEMORY LEAK
}, []);

// ✅ GOOD: Proper cleanup
useEffect(() => {
  const timer = setInterval(() => {
    updateData();
  }, 1000);
  
  return () => {
    clearInterval(timer);
  };
}, []);
```

### 2. **Uncancelled API Requests**
```typescript
// ❌ BAD: No abort controller
useEffect(() => {
  fetchData().then(setData);
}, []);

// ✅ GOOD: Abortable requests
useEffect(() => {
  const controller = new AbortController();
  
  fetchData({ signal: controller.signal })
    .then(data => {
      if (!controller.signal.aborted) {
        setData(data);
      }
    })
    .catch(error => {
      if (error.name !== 'AbortError') {
        console.error('Fetch failed:', error);
      }
    });
  
  return () => {
    controller.abort();
  };
}, []);
```

### 3. **Event Listeners Not Removed**
```typescript
// ❌ BAD: Event listener not removed
useEffect(() => {
  const handleResize = () => updateDimensions();
  window.addEventListener('resize', handleResize);
  // Missing cleanup - MEMORY LEAK
}, []);

// ✅ GOOD: Proper cleanup
useEffect(() => {
  const handleResize = () => updateDimensions();
  window.addEventListener('resize', handleResize);
  
  return () => {
    window.removeEventListener('resize', handleResize);
  };
}, []);
```

### 4. **State Updates on Unmounted Components**
```typescript
// ❌ BAD: No mount check
const fetchUserData = async (userId: string) => {
  const data = await api.getUser(userId);
  setUser(data); // Could run after unmount - WARNING
};

// ✅ GOOD: Mount check with useRef
const isMountedRef = useRef(true);

const fetchUserData = async (userId: string) => {
  const data = await api.getUser(userId);
  if (isMountedRef.current) {
    setUser(data);
  }
};

useEffect(() => {
  return () => {
    isMountedRef.current = false;
  };
}, []);
```

---

## 🧹 UseEffect Cleanup Best Practices

### 1. **Always Return Cleanup Functions**
```typescript
useEffect(() => {
  // Setup code
  const subscription = subscribe();
  const timer = setTimeout(callback, 1000);
  
  // Always return cleanup
  return () => {
    unsubscribe(subscription);
    clearTimeout(timer);
  };
}, [dependency]);
```

### 2. **Use Custom Hook for Complex Cleanup**
```typescript
// Custom hook for abortable API calls
const useAbortableEffect = (
  effect: (signal: AbortSignal) => Promise<void>,
  deps: DependencyList
) => {
  useEffect(() => {
    const controller = new AbortController();
    
    effect(controller.signal).catch(error => {
      if (error.name !== 'AbortError') {
        console.error('Effect failed:', error);
      }
    });
    
    return () => {
      controller.abort();
    };
  }, deps);
};

// Usage
useAbortableEffect(async (signal) => {
  const data = await fetchData({ signal });
  if (!signal.aborted) {
    setData(data);
  }
}, [fetchData]);
```

### 3. **Memory Monitor Integration**
```typescript
import { useComponentMemoryMonitor } from '../hooks/useComponentMemoryMonitor';

const MyComponent = () => {
  const {
    isMounted,
    registerEffect,
    unregisterEffect,
    createAbortablePromise
  } = useComponentMemoryMonitor({
    componentName: 'MyComponent',
    enableMemoryTracking: true,
    enableLeakDetection: true
  });

  useEffect(() => {
    if (!isMounted()) return;
    
    const effectName = 'data-fetch';
    registerEffect(effectName);
    
    const fetchData = async () => {
      // Async operation
    };
    
    fetchData();
    
    return () => {
      unregisterEffect(effectName);
    };
  }, [isMounted, registerEffect, unregisterEffect]);
};
```

---

## 🌐 API Request Management

### 1. **Enhanced API Client Usage**
```typescript
import { enhancedApiClient } from '../utils/enhancedApiClient';

const SearchComponent = () => {
  const [results, setResults] = useState([]);
  const controllerRef = useRef<AbortController | null>(null);

  const performSearch = async (query: string) => {
    // Cancel previous request
    if (controllerRef.current) {
      controllerRef.current.abort();
    }

    // Create new controller
    controllerRef.current = new AbortController();

    try {
      const response = await enhancedApiClient.search(
        { q: query },
        { 
          signal: controllerRef.current.signal,
          timeout: 30000,
          retryCount: 2
        }
      );
      
      if (response.success) {
        setResults(response.data?.results || []);
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Search failed:', error);
      }
    }
  };

  useEffect(() => {
    return () => {
      if (controllerRef.current) {
        controllerRef.current.abort();
      }
    };
  }, []);
};
```

### 2. **Batch Request Management**
```typescript
const useBatchRequests = () => {
  const activeRequests = useRef(new Map<string, AbortController>());

  const makeRequest = async (id: string, requestFn: Function) => {
    // Cancel existing request with same ID
    const existingController = activeRequests.current.get(id);
    if (existingController) {
      existingController.abort();
    }

    // Create new controller
    const controller = new AbortController();
    activeRequests.current.set(id, controller);

    try {
      const result = await requestFn(controller.signal);
      activeRequests.current.delete(id);
      return result;
    } catch (error) {
      activeRequests.current.delete(id);
      throw error;
    }
  };

  const cancelAll = () => {
    activeRequests.current.forEach(controller => controller.abort());
    activeRequests.current.clear();
  };

  useEffect(() => {
    return () => {
      cancelAll();
    };
  }, []);

  return { makeRequest, cancelAll };
};
```

---

## 🔍 Memory Monitoring Tools

### 1. **Component Memory Monitor Hook**
```typescript
const MyComponent = () => {
  const {
    getMemoryReport,
    getRenderCount,
    getLifespan,
    addCleanupFunction
  } = useComponentMemoryMonitor(
    {
      componentName: 'MyComponent',
      enableMemoryTracking: true,
      alertThreshold: 50 // 50MB
    },
    {
      onMemoryAlert: (usage) => {
        console.warn(`Memory usage high: ${usage}MB`);
      },
      onLeakDetected: (info) => {
        console.error('Leak detected:', info);
      }
    }
  );

  // Periodic memory reporting
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const interval = setInterval(() => {
        console.log('Memory Report:', getMemoryReport());
      }, 10000);

      addCleanupFunction(() => clearInterval(interval));
    }
  }, []);
};
```

### 2. **Memory Profiling Utilities**
```typescript
// Utility for measuring component memory impact
const measureMemoryImpact = (componentName: string) => {
  const startMemory = performance.memory?.usedJSHeapSize || 0;
  const startTime = Date.now();

  return {
    finish: () => {
      const endMemory = performance.memory?.usedJSHeapSize || 0;
      const endTime = Date.now();
      
      return {
        component: componentName,
        memoryDelta: endMemory - startMemory,
        timeDelta: endTime - startTime,
        memoryDeltaMB: (endMemory - startMemory) / (1024 * 1024)
      };
    }
  };
};

// Usage in component
const MyComponent = () => {
  const profiler = measureMemoryImpact('MyComponent');

  useEffect(() => {
    return () => {
      const metrics = profiler.finish();
      console.log('Component impact:', metrics);
    };
  }, []);
};
```

---

## 🏗️ Component Design Patterns

### 1. **Safe State Updates Pattern**
```typescript
const useSafeState = <T>(initialValue: T) => {
  const [state, setState] = useState(initialValue);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const safeSetState = useCallback((value: T | ((prev: T) => T)) => {
    if (isMountedRef.current) {
      setState(value);
    } else {
      console.warn('Attempted to set state on unmounted component');
    }
  }, []);

  return [state, safeSetState] as const;
};
```

### 2. **Resource Manager Pattern**
```typescript
const useResourceManager = () => {
  const resources = useRef<(() => void)[]>([]);

  const addResource = useCallback((cleanup: () => void) => {
    resources.current.push(cleanup);
  }, []);

  const cleanupAll = useCallback(() => {
    resources.current.forEach(cleanup => {
      try {
        cleanup();
      } catch (error) {
        console.error('Cleanup error:', error);
      }
    });
    resources.current = [];
  }, []);

  useEffect(() => {
    return cleanupAll;
  }, [cleanupAll]);

  return { addResource, cleanupAll };
};
```

### 3. **Async Operation Pattern**
```typescript
const useAsyncOperation = <T>(
  operation: (signal: AbortSignal) => Promise<T>,
  dependencies: DependencyList
) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    const controller = new AbortController();
    
    const runOperation = async () => {
      if (!isMountedRef.current) return;
      
      setLoading(true);
      setError(null);

      try {
        const result = await operation(controller.signal);
        
        if (isMountedRef.current && !controller.signal.aborted) {
          setData(result);
        }
      } catch (err) {
        if (err.name !== 'AbortError' && isMountedRef.current) {
          setError(err as Error);
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    };

    runOperation();

    return () => {
      controller.abort();
    };
  }, dependencies);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return { data, loading, error };
};
```

---

## 🧪 Testing Memory Leaks

### 1. **Manual Testing Checklist**
```typescript
// Component Testing Utilities
export const memoryTestUtils = {
  // Simulate rapid mount/unmount
  async stressMountUnmount(Component: React.FC, iterations = 100) {
    const container = document.createElement('div');
    document.body.appendChild(container);

    for (let i = 0; i < iterations; i++) {
      const root = ReactDOM.createRoot(container);
      root.render(<Component />);
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      root.unmount();
      
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    document.body.removeChild(container);
  },

  // Monitor memory during operations
  async measureMemoryDuringOperation(operation: () => Promise<void>) {
    const startMemory = performance.memory?.usedJSHeapSize || 0;
    
    await operation();
    
    // Force garbage collection if available
    if ('gc' in window) {
      (window as any).gc();
    }
    
    const endMemory = performance.memory?.usedJSHeapSize || 0;
    
    return {
      memoryDelta: endMemory - startMemory,
      memoryDeltaMB: (endMemory - startMemory) / (1024 * 1024)
    };
  }
};
```

### 2. **Automated Memory Tests**
```typescript
// Jest test example
describe('SearchPage Memory Leaks', () => {
  it('should not leak memory on mount/unmount', async () => {
    const { measureMemoryDuringOperation, stressMountUnmount } = memoryTestUtils;
    
    const memoryUsage = await measureMemoryDuringOperation(async () => {
      await stressMountUnmount(SearchPage, 50);
    });

    // Memory delta should be minimal (less than 5MB)
    expect(memoryUsage.memoryDeltaMB).toBeLessThan(5);
  });

  it('should cancel API requests on unmount', () => {
    const { unmount } = render(<SearchPage />);
    const cancelSpy = jest.spyOn(enhancedApiClient, 'cancelAllRequests');
    
    unmount();
    
    expect(cancelSpy).toHaveBeenCalled();
  });
});
```

---

## ✅ Performance Optimization Checklist

### Component Level
- [ ] All `useEffect` hooks have cleanup functions
- [ ] API requests use `AbortController`
- [ ] Event listeners are properly removed
- [ ] Timers and intervals are cleared
- [ ] State updates check component mount status
- [ ] Memory monitoring is implemented for critical components

### API Management
- [ ] Concurrent requests are cancelled when new ones start
- [ ] Request timeouts are configured
- [ ] Retry mechanisms with exponential backoff
- [ ] Error handling includes abort error detection
- [ ] Request batching for multiple related calls

### Memory Management
- [ ] Large objects are properly disposed
- [ ] References to DOM elements are cleared
- [ ] Closure references are minimized
- [ ] Memory monitoring alerts are configured
- [ ] Development tools for memory profiling are available

### Testing
- [ ] Memory leak tests are implemented
- [ ] Stress testing for mount/unmount cycles
- [ ] API cancellation tests
- [ ] Performance regression tests
- [ ] Memory usage benchmarks

### Monitoring
- [ ] Memory usage alerts in production
- [ ] Component lifecycle tracking
- [ ] API request monitoring
- [ ] Error tracking for memory-related issues
- [ ] Performance metrics collection

---

## 🚀 Implementation Examples

### SearchPage Implementation
The SearchPage component demonstrates all these best practices:

```typescript
import { useComponentMemoryMonitor } from '../hooks/useComponentMemoryMonitor';
import { enhancedApiClient } from '../utils/enhancedApiClient';

const SearchPage: React.FC = () => {
  // Memory monitoring setup
  const {
    isMounted,
    createAbortablePromise,
    registerEffect,
    unregisterEffect
  } = useComponentMemoryMonitor({
    componentName: 'SearchPage',
    enableMemoryTracking: true,
    enableLeakDetection: true
  });

  // Enhanced useEffect with cleanup
  useEffect(() => {
    const effectName = 'search-effect';
    registerEffect(effectName);
    
    // Effect logic here
    
    return () => {
      unregisterEffect(effectName);
      // Additional cleanup
    };
  }, [registerEffect, unregisterEffect]);

  // API calls with abort controller
  const performSearch = useCallback(async (query: string) => {
    if (!isMounted()) return;
    
    try {
      const response = await enhancedApiClient.search(
        { q: query },
        { timeout: 30000, retryCount: 2 }
      );
      
      if (isMounted() && response.success) {
        setResults(response.data?.results || []);
      }
    } catch (error) {
      if (error.name !== 'AbortError' && isMounted()) {
        setError(error.message);
      }
    }
  }, [isMounted]);
};
```

---

## 📚 Additional Resources

1. **React DevTools Profiler**: Use to identify performance bottlenecks
2. **Chrome DevTools Memory Tab**: Monitor heap usage and detect leaks
3. **React Error Boundaries**: Catch and handle component errors gracefully
4. **Bundle Analyzer**: Identify large dependencies that might impact memory

## 🎯 Key Takeaways

1. **Always implement cleanup functions** in useEffect hooks
2. **Use AbortController** for all API requests
3. **Check component mount status** before state updates
4. **Monitor memory usage** in development and production
5. **Test for memory leaks** as part of your testing strategy
6. **Use specialized hooks** for common patterns
7. **Profile your components** regularly to identify issues early

Remember: **Prevention is better than debugging!** Following these guidelines will help you build robust, memory-efficient React components that provide excellent user experience without degrading application performance.
