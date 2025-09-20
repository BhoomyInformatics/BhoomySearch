/**
 * Enhanced Accessibility Hook for Keyboard Navigation and ARIA Support
 */

import { useEffect, useRef, useState, useCallback } from 'react';

interface AccessibilityConfig {
  enableKeyboardNavigation?: boolean;
  enableFocusManagement?: boolean;
  enableScreenReaderSupport?: boolean;
  enableHighContrast?: boolean;
  announcements?: boolean;
  skipLinksEnabled?: boolean;
}

interface FocusableElement {
  element: HTMLElement;
  id: string;
  type: string;
  tabIndex: number;
}

interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  action: () => void;
  description: string;
}

/**
 * Comprehensive accessibility hook with keyboard navigation and ARIA support
 */
export const useAccessibility = (config: AccessibilityConfig = {}) => {
  const {
    enableKeyboardNavigation = true,
    // enableFocusManagement = true,
    enableScreenReaderSupport = true,
    // enableHighContrast = false,
    announcements = true,
    skipLinksEnabled = true
  } = config;

  const [focusableElements, setFocusableElements] = useState<FocusableElement[]>([]);
  const [currentFocusIndex] = useState(-1);
  const [highContrastMode, setHighContrastMode] = useState(false);
  const [screenReaderMode, setScreenReaderMode] = useState(false);
  const announcementRef = useRef<HTMLDivElement | null>(null);
  const keyboardShortcuts = useRef<KeyboardShortcut[]>([]);

  // Initialize accessibility features
  useEffect(() => {
    if (enableScreenReaderSupport) {
      setupScreenReaderSupport();
    }

    if (enableKeyboardNavigation) {
      setupKeyboardNavigation();
    }

    if (skipLinksEnabled) {
      setupSkipLinks();
    }

    // Detect screen reader usage
    detectScreenReader();

    // Setup default keyboard shortcuts
    setupDefaultKeyboardShortcuts();

    return () => {
      cleanup();
    };
  }, []);

  // Setup screen reader support
  const setupScreenReaderSupport = useCallback(() => {
    // Create announcement area for screen readers
    if (!announcementRef.current) {
      const announcer = document.createElement('div');
      announcer.id = 'sr-announcements';
      announcer.setAttribute('aria-live', 'polite');
      announcer.setAttribute('aria-atomic', 'true');
      announcer.setAttribute('aria-label', 'Screen reader announcements');
      announcer.style.position = 'absolute';
      announcer.style.left = '-9999px';
      announcer.style.width = '1px';
      announcer.style.height = '1px';
      announcer.style.overflow = 'hidden';
      document.body.appendChild(announcer);
      announcementRef.current = announcer;
    }

    // Add role and aria-label attributes to main elements
    const main = document.querySelector('main');
    if (main && !main.getAttribute('role')) {
      main.setAttribute('role', 'main');
      main.setAttribute('aria-label', 'Main content');
    }

    const nav = document.querySelector('nav');
    if (nav && !nav.getAttribute('role')) {
      nav.setAttribute('role', 'navigation');
      nav.setAttribute('aria-label', 'Site navigation');
    }

    // Enhance form elements
    enhanceFormElements();
  }, []);

  // Setup keyboard navigation
  const setupKeyboardNavigation = useCallback(() => {
    const updateFocusableElements = () => {
      const selectors = [
        'a[href]',
        'button:not([disabled])',
        'input:not([disabled]):not([type="hidden"])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
        '[role="button"]:not([aria-disabled="true"])',
        '[role="link"]:not([aria-disabled="true"])',
        '[role="menuitem"]:not([aria-disabled="true"])'
      ];

      const elements = Array.from(document.querySelectorAll(selectors.join(', '))) as HTMLElement[];
      
      const focusableList: FocusableElement[] = elements
        .filter(el => {
          const style = window.getComputedStyle(el);
          return style.display !== 'none' && 
                 style.visibility !== 'hidden' && 
                 !el.hasAttribute('aria-hidden');
        })
        .map((el, index) => ({
          element: el,
          id: el.id || `focusable-${index}`,
          type: el.tagName.toLowerCase(),
          tabIndex: parseInt(el.getAttribute('tabindex') || '0')
        }));

      setFocusableElements(focusableList);
    };

    updateFocusableElements();

    // Update when DOM changes
    const observer = new MutationObserver(updateFocusableElements);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['disabled', 'tabindex', 'aria-hidden']
    });

    return () => observer.disconnect();
  }, []);

  // Setup skip links
  const setupSkipLinks = useCallback(() => {
    const skipLink = document.createElement('a');
    skipLink.href = '#main-content';
    skipLink.textContent = 'Skip to main content';
    skipLink.id = 'skip-link';
    skipLink.style.position = 'absolute';
    skipLink.style.top = '-40px';
    skipLink.style.left = '6px';
    skipLink.style.background = '#fe780e';
    skipLink.style.color = 'white';
    skipLink.style.padding = '8px';
    skipLink.style.textDecoration = 'none';
    skipLink.style.borderRadius = '4px';
    skipLink.style.zIndex = '9999';
    skipLink.style.transition = 'top 0.3s';

    skipLink.addEventListener('focus', () => {
      skipLink.style.top = '6px';
    });

    skipLink.addEventListener('blur', () => {
      skipLink.style.top = '-40px';
    });

    document.body.insertBefore(skipLink, document.body.firstChild);

    // Ensure main content has proper ID
    let mainContent = document.getElementById('main-content');
    if (!mainContent) {
      mainContent = document.querySelector('main') || document.querySelector('[role="main"]');
      if (mainContent) {
        mainContent.id = 'main-content';
      }
    }
  }, []);

  // Detect screen reader usage
  const detectScreenReader = useCallback(() => {
    // Check for common screen reader indicators
    const hasScreenReader = 
      window.navigator.userAgent.includes('NVDA') ||
      window.navigator.userAgent.includes('JAWS') ||
      window.navigator.userAgent.includes('VoiceOver') ||
      document.documentElement.style.getPropertyValue('forced-color-adjust') === 'none';

    setScreenReaderMode(hasScreenReader);

    if (hasScreenReader) {
      console.log('♿ Screen reader detected, enabling enhanced accessibility features');
      document.body.classList.add('screen-reader-mode');
    }
  }, []);

  // Setup default keyboard shortcuts
  const setupDefaultKeyboardShortcuts = useCallback(() => {
    const shortcuts: KeyboardShortcut[] = [
      {
        key: '/',
        action: () => focusSearchInput(),
        description: 'Focus search input'
      },
      {
        key: 'Escape',
        action: () => handleEscapeKey(),
        description: 'Close modals or clear focus'
      },
      {
        key: 'h',
        altKey: true,
        action: () => focusMainHeading(),
        description: 'Focus main heading'
      },
      {
        key: 'n',
        altKey: true,
        action: () => focusNavigation(),
        description: 'Focus navigation'
      },
      {
        key: 'm',
        altKey: true,
        action: () => focusMainContent(),
        description: 'Focus main content'
      }
    ];

    keyboardShortcuts.current = shortcuts;

    document.addEventListener('keydown', handleKeyboardShortcuts);
  }, []);

  // Handle keyboard shortcuts
  const handleKeyboardShortcuts = useCallback((event: KeyboardEvent) => {
    const activeElement = document.activeElement as HTMLElement;
    
    // Don't trigger shortcuts if user is typing in an input
    if (activeElement && (
      activeElement.tagName === 'INPUT' ||
      activeElement.tagName === 'TEXTAREA' ||
      activeElement.isContentEditable
    )) {
      return;
    }

    keyboardShortcuts.current.forEach(shortcut => {
      if (
        event.key === shortcut.key &&
        !!event.ctrlKey === !!shortcut.ctrlKey &&
        !!event.altKey === !!shortcut.altKey &&
        !!event.shiftKey === !!shortcut.shiftKey
      ) {
        event.preventDefault();
        shortcut.action();
        announce(`Keyboard shortcut activated: ${shortcut.description}`);
      }
    });
  }, []);

  // Focus management functions
  const focusSearchInput = useCallback(() => {
    const searchInput = document.querySelector('input[type="text"][name="q"], input[placeholder*="Search"], input[placeholder*="search"]') as HTMLInputElement;
    if (searchInput) {
      searchInput.focus();
      searchInput.select();
    }
  }, []);

  const focusMainHeading = useCallback(() => {
    const heading = document.querySelector('h1') as HTMLElement;
    if (heading) {
      heading.focus();
      // Make heading focusable if it isn't already
      if (!heading.hasAttribute('tabindex')) {
        heading.setAttribute('tabindex', '-1');
      }
    }
  }, []);

  const focusNavigation = useCallback(() => {
    const nav = document.querySelector('nav, [role="navigation"]') as HTMLElement;
    if (nav) {
      const firstLink = nav.querySelector('a, button') as HTMLElement;
      if (firstLink) {
        firstLink.focus();
      }
    }
  }, []);

  const focusMainContent = useCallback(() => {
    const main = document.querySelector('main, [role="main"], #main-content') as HTMLElement;
    if (main) {
      main.focus();
      if (!main.hasAttribute('tabindex')) {
        main.setAttribute('tabindex', '-1');
      }
    }
  }, []);

  const handleEscapeKey = useCallback(() => {
    // Close any open modals or dropdowns
    const modals = document.querySelectorAll('[role="dialog"], .modal, .dropdown-open');
    modals.forEach(modal => {
      const closeButton = modal.querySelector('[aria-label*="close"], .close, .modal-close') as HTMLElement;
      if (closeButton) {
        closeButton.click();
      }
    });

    // Clear focus from current element
    if (document.activeElement !== document.body) {
      (document.activeElement as HTMLElement)?.blur();
    }
  }, []);

  // Enhance form elements with proper labels and descriptions
  const enhanceFormElements = useCallback(() => {
    // Enhance form inputs
    document.querySelectorAll('input, select, textarea').forEach(input => {
      const element = input as HTMLInputElement;
      
      // Add required aria attributes
      if (element.required && !element.getAttribute('aria-required')) {
        element.setAttribute('aria-required', 'true');
      }

      // Add aria-invalid for validation
      if (element.validity && !element.validity.valid && !element.getAttribute('aria-invalid')) {
        element.setAttribute('aria-invalid', 'true');
      }

      // Ensure proper labeling
      if (!element.getAttribute('aria-label') && !element.getAttribute('aria-labelledby')) {
        const label = document.querySelector(`label[for="${element.id}"]`);
        if (!label && element.placeholder) {
          element.setAttribute('aria-label', element.placeholder);
        }
      }
    });

    // Enhance buttons
    document.querySelectorAll('button').forEach(button => {
      if (!button.getAttribute('aria-label') && !button.textContent?.trim()) {
        const icon = button.querySelector('svg, i, .icon');
        if (icon) {
          button.setAttribute('aria-label', 'Button');
        }
      }
    });

    // Enhance images
    document.querySelectorAll('img').forEach(img => {
      if (!img.alt) {
        if (img.src.includes('logo') || img.src.includes('brand')) {
          img.alt = 'Logo';
        } else if (img.hasAttribute('aria-hidden') || img.getAttribute('role') === 'presentation') {
          img.alt = '';
        } else {
          img.alt = 'Image';
        }
      }
    });
  }, []);

  // Screen reader announcements
  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (!announcements || !announcementRef.current) return;

    announcementRef.current.setAttribute('aria-live', priority);
    announcementRef.current.textContent = message;

    // Clear after a delay to allow for repeated announcements
    setTimeout(() => {
      if (announcementRef.current) {
        announcementRef.current.textContent = '';
      }
    }, 1000);

    console.log(`📢 Screen reader announcement (${priority}): ${message}`);
  }, [announcements]);

  // High contrast mode toggle
  const toggleHighContrast = useCallback(() => {
    const newMode = !highContrastMode;
    setHighContrastMode(newMode);
    
    if (newMode) {
      document.body.classList.add('high-contrast-mode');
      document.documentElement.style.setProperty('filter', 'contrast(150%) brightness(110%)');
      announce('High contrast mode enabled');
    } else {
      document.body.classList.remove('high-contrast-mode');
      document.documentElement.style.removeProperty('filter');
      announce('High contrast mode disabled');
    }
  }, [highContrastMode, announce]);

  // Add custom keyboard shortcut
  const addKeyboardShortcut = useCallback((shortcut: KeyboardShortcut) => {
    keyboardShortcuts.current.push(shortcut);
  }, []);

  // Remove keyboard shortcut
  const removeKeyboardShortcut = useCallback((key: string) => {
    keyboardShortcuts.current = keyboardShortcuts.current.filter(s => s.key !== key);
  }, []);

  // Focus trap for modals
  const createFocusTrap = useCallback((container: HTMLElement) => {
    const focusableSelectors = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusableElements = container.querySelectorAll(focusableSelectors) as NodeListOf<HTMLElement>;
    
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    container.addEventListener('keydown', handleTabKey);
    firstElement.focus();

    return () => {
      container.removeEventListener('keydown', handleTabKey);
    };
  }, []);

  // Cleanup function
  const cleanup = useCallback(() => {
    document.removeEventListener('keydown', handleKeyboardShortcuts);
    
    if (announcementRef.current) {
      document.body.removeChild(announcementRef.current);
      announcementRef.current = null;
    }

    const skipLink = document.getElementById('skip-link');
    if (skipLink) {
      document.body.removeChild(skipLink);
    }

    document.body.classList.remove('screen-reader-mode', 'high-contrast-mode');
    document.documentElement.style.removeProperty('filter');
  }, [handleKeyboardShortcuts]);

  return {
    // State
    focusableElements,
    currentFocusIndex,
    highContrastMode,
    screenReaderMode,

    // Functions
    announce,
    toggleHighContrast,
    addKeyboardShortcut,
    removeKeyboardShortcut,
    createFocusTrap,
    focusSearchInput,
    focusMainHeading,
    focusNavigation,
    focusMainContent,
    enhanceFormElements,

    // Utilities
    getKeyboardShortcuts: () => keyboardShortcuts.current,
    isScreenReaderActive: () => screenReaderMode
  };
};

/**
 * Accessibility audit utilities
 */
export const accessibilityAudit = {
  // Check color contrast
  checkColorContrast: (element: HTMLElement) => {
    const style = window.getComputedStyle(element);
    const backgroundColor = style.backgroundColor;
    const color = style.color;
    
    // Simplified contrast check (for demo purposes)
    // In production, use a proper color contrast library
    console.log('🎨 Color contrast check:', { backgroundColor, color });
    
    return {
      backgroundColor,
      color,
      passesWCAG: true // Simplified for demo
    };
  },

  // Check heading structure
  checkHeadingStructure: () => {
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    const structure = headings.map(h => ({
      level: parseInt(h.tagName.charAt(1)),
      text: h.textContent?.substring(0, 50) || '',
      hasId: !!h.id,
      hasTabIndex: h.hasAttribute('tabindex')
    }));

    // Check for proper hierarchy
    const issues = [];
    for (let i = 1; i < structure.length; i++) {
      const prev = structure[i - 1];
      const current = structure[i];
      
      if (current.level > prev.level + 1) {
        issues.push(`Heading level ${current.level} follows heading level ${prev.level} (skipped level)`);
      }
    }

    return { structure, issues };
  },

  // Check form accessibility
  checkFormAccessibility: () => {
    const forms = Array.from(document.querySelectorAll('form'));
    const results = forms.map(form => {
      const inputs = Array.from(form.querySelectorAll('input, select, textarea'));
      const inputIssues = inputs.map(input => {
        const issues = [];
        
        if (!input.getAttribute('aria-label') && !input.getAttribute('aria-labelledby')) {
          const label = form.querySelector(`label[for="${input.id}"]`);
          if (!label) {
            issues.push('Missing label');
          }
        }
        
        if (input.hasAttribute('required') && !input.getAttribute('aria-required')) {
          issues.push('Missing aria-required attribute');
        }

        return {
          element: input.tagName.toLowerCase(),
          id: input.id,
          issues
        };
      });

      return {
        form: form.id || 'unnamed',
        inputCount: inputs.length,
        inputIssues: inputIssues.filter(i => i.issues.length > 0)
      };
    });

    return results;
  },

  // Generate accessibility report
  generateReport: () => {
    const headingCheck = accessibilityAudit.checkHeadingStructure();
    const formCheck = accessibilityAudit.checkFormAccessibility();
    
    const imageCheck = {
      total: document.querySelectorAll('img').length,
      withAlt: document.querySelectorAll('img[alt]').length,
      withoutAlt: document.querySelectorAll('img:not([alt])').length
    };

    const linkCheck = {
      total: document.querySelectorAll('a').length,
      withDescription: document.querySelectorAll('a[aria-label], a[title], a:not(:empty)').length
    };

    const report = {
      timestamp: new Date().toISOString(),
      headings: headingCheck,
      forms: formCheck,
      images: imageCheck,
      links: linkCheck,
      score: calculateAccessibilityScore({
        headingIssues: headingCheck.issues.length,
        formIssues: formCheck.reduce((sum, f) => sum + f.inputIssues.length, 0),
        imageIssues: imageCheck.withoutAlt,
        linkIssues: linkCheck.total - linkCheck.withDescription
      })
    };

    console.log('♿ Accessibility Audit Report:', report);
    return report;
  }
};

// Calculate accessibility score
const calculateAccessibilityScore = (issues: {
  headingIssues: number;
  formIssues: number;
  imageIssues: number;
  linkIssues: number;
}) => {
  const totalIssues = Object.values(issues).reduce((sum, count) => sum + count, 0);
  const maxPossibleIssues = 100; // Simplified scoring
  const score = Math.max(0, 100 - (totalIssues / maxPossibleIssues) * 100);
  
  return {
    score: Math.round(score),
    level: score >= 90 ? 'Excellent' : score >= 70 ? 'Good' : score >= 50 ? 'Fair' : 'Needs Improvement',
    issues
  };
};

export default useAccessibility;
