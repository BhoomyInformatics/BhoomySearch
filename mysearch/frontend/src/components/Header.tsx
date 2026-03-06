/**
 * Enhanced Header with comprehensive SEO and Accessibility features
 */

import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams, Link, useLocation } from 'react-router-dom';
import { Search, Mic } from 'lucide-react';
import { useAccessibility } from '../hooks/useAccessibility';
// USER LOGIN ACCESS TEMPORARILY DISABLED - All users can access all data
// import { useAuthStore } from '../store/authStore';

interface NavigationItem {
  name: string;
  path: string;
  external?: boolean;
  ariaLabel?: string;
}

const Header: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const currentQuery = searchParams.get('q') || '';
  const [query, setQuery] = useState(currentQuery);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeNavItem, setActiveNavItem] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const voiceSearchProcessedRef = useRef<boolean>(false);
  // USER LOGIN ACCESS TEMPORARILY DISABLED - All users can access all data
  // const { user, isAuthenticated, logout } = useAuthStore();

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserMenu]);

  // Accessibility hooks
  const {
    announce,
    addKeyboardShortcut,
    focusSearchInput
  } = useAccessibility({
    enableKeyboardNavigation: true,
    enableFocusManagement: true,
    enableScreenReaderSupport: true
  });

  // Navigation items with accessibility labels
  const navigationItems: NavigationItem[] = [
    {
      name: 'All',
      path: '/search',
      ariaLabel: 'Search web pages'
    },
    {
      name: 'Images',
      path: '/images',
      ariaLabel: 'Search images'
    },
    {
      name: 'News',
      path: '/news',
      ariaLabel: 'Search news articles'
    },
    {
      name: 'Videos',
      path: '/videos',
      ariaLabel: 'Search videos'
    },
    {
      name: 'Maps',
      path: 'https://bhuvan-app1.nrsc.gov.in/bhuvan2d/bhuvan/bhuvan2d.php',
      external: true,
      ariaLabel: 'Open maps in new tab'
    }
  ];

  // Determine active navigation item
  useEffect(() => {
    const currentPath = location.pathname;
    const activeItem = navigationItems.find(item => 
      !item.external && currentPath.startsWith(item.path)
    );
    setActiveNavItem(activeItem?.name || '');
  }, [location.pathname]);

  // Update query when URL params change
  useEffect(() => {
    setQuery(currentQuery);
  }, [currentQuery]);

  // Keyboard shortcuts
  useEffect(() => {
    addKeyboardShortcut({
      key: '/',
      action: () => {
        focusSearchInput();
        if (searchInputRef.current) {
          searchInputRef.current.focus();
          searchInputRef.current.select();
        }
      },
      description: 'Focus search input'
    });

    addKeyboardShortcut({
      key: 'Escape',
      action: () => {
        setShowSuggestions(false);
      },
      description: 'Close suggestions'
    });
  }, [addKeyboardShortcut, focusSearchInput]);

  // Handle search submission
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent search if voice recognition just finished (give user time to review)
    if (voiceSearchProcessedRef.current) {
      // Clear the flag to allow search after user explicitly clicks
      voiceSearchProcessedRef.current = false;
    }
    
    // Stop voice recognition if still listening
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      // Don't search immediately after stopping voice - let user review the text
      return;
    }
    
    // Get query from input field (in case voice search updated it directly)
    const searchQuery = (searchInputRef.current?.value || query).trim();
    
    if (searchQuery) {
      // Update state to match input
      setQuery(searchQuery);
      
      announce(`Searching for: ${searchQuery}`, 'assertive');
      
      // Preserve current page type (news, images, videos) when searching
      const currentPath = location.pathname;
      let targetPath = '/search'; // Default to web search
      
      if (currentPath === '/news' || currentPath.startsWith('/news')) {
        targetPath = '/news';
      } else if (currentPath === '/images' || currentPath.startsWith('/images')) {
        targetPath = '/images';
      } else if (currentPath === '/videos' || currentPath.startsWith('/videos')) {
        targetPath = '/videos';
      }
      
      navigate(`${targetPath}?q=${encodeURIComponent(searchQuery)}`);
      setShowSuggestions(false);
    } else {
      announce('Please enter a search query', 'assertive');
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }
  };

  // Handle navigation with query preservation
  const handleNavigation = (path: string, searchQuery?: string, external?: boolean) => {
    if (external) {
      window.open(path, '_blank', 'noopener,noreferrer');
      announce('Opening external link in new tab');
      return;
    }

    if (searchQuery && searchQuery.trim()) {
      navigate(`${path}?q=${encodeURIComponent(searchQuery)}`);
    } else {
      navigate(path);
    }
  };

  // Handle input changes with suggestions
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    if (value.length > 2) {
      // Mock suggestions - in production, fetch from API
      const mockSuggestions = [
        `${value} tutorial`,
        `${value} guide`,
        `how to ${value}`,
        `best ${value}`,
        `${value} news`
      ].filter(s => s.length > value.length);
      
      setSuggestions(mockSuggestions);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  // Handle suggestion selection
  const handleSuggestionSelect = (suggestion: string) => {
    setQuery(suggestion);
    setShowSuggestions(false);
    announce(`Selected suggestion: ${suggestion}`);
    
    // Auto-navigate to search, preserving current page type
    setTimeout(() => {
      const currentPath = location.pathname;
      let targetPath = '/search'; // Default to web search
      
      if (currentPath === '/news' || currentPath.startsWith('/news')) {
        targetPath = '/news';
      } else if (currentPath === '/images' || currentPath.startsWith('/images')) {
        targetPath = '/images';
      } else if (currentPath === '/videos' || currentPath.startsWith('/videos')) {
        targetPath = '/videos';
      }
      
      navigate(`${targetPath}?q=${encodeURIComponent(suggestion)}`);
    }, 100);
  };

  // Voice search functionality
  const startVoiceSearch = () => {
    // Check if browser supports speech recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      announce('Voice search is not supported in your browser. Please use Chrome or Edge.');
      return;
    }

    // Stop any existing recognition
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    // Reset the processed flag
    voiceSearchProcessedRef.current = false;

    // Create new recognition instance
    const recognition = new SpeechRecognition();
    recognition.continuous = true; // Allow continuous speech
    recognition.interimResults = true; // Get interim results as user speaks
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      voiceSearchProcessedRef.current = false;
      announce('Listening... Speak your search query');
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      // Process all results
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }

      // Update input field with current transcript (interim or final)
      const currentTranscript = finalTranscript.trim() || interimTranscript.trim();
      if (currentTranscript && searchInputRef.current) {
        searchInputRef.current.value = currentTranscript;
        setQuery(currentTranscript); // Update state for visual feedback
      }

      // Only process final results (when user finishes speaking)
      if (finalTranscript.trim() && !voiceSearchProcessedRef.current) {
        const finalText = finalTranscript.trim();
        
        // Mark as processed to prevent duplicate handling
        voiceSearchProcessedRef.current = true;
        
        // Stop listening but don't set isListening to false immediately
        // This prevents accidental form submission
        if (recognitionRef.current) {
          recognitionRef.current.stop();
        }
        
        // Use a small delay before updating listening state to prevent form submission
        setTimeout(() => {
          setIsListening(false);
        }, 100);
        
        announce(`Heard: ${finalText}. Click search to find results.`);
        
        // Update input with final text
        if (searchInputRef.current) {
          searchInputRef.current.value = finalText;
        }
        setQuery(finalText);
        
        // Don't navigate automatically - wait for user to click search icon
        // The user can now review the text and click search when ready
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      voiceSearchProcessedRef.current = false;
      
      if (event.error === 'no-speech') {
        announce('No speech detected. Please try again.');
      } else if (event.error === 'not-allowed') {
        announce('Microphone permission denied. Please enable microphone access.');
      } else {
        announce('Voice search error. Please try again.');
      }
    };

    recognition.onend = () => {
      // Only update listening state if we haven't already processed final results
      // This prevents any accidental form submission
      if (!voiceSearchProcessedRef.current) {
        setIsListening(false);
      }
      // If we have a final transcript and user hasn't searched yet, keep it in the input
      // Reset processed flag after a delay to allow for new searches
      setTimeout(() => {
        voiceSearchProcessedRef.current = false;
      }, 2000); // Increased delay to ensure user has time to review
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopVoiceSearch = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  // Cleanup recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);


  return (
    <header 
      id="site-header"
      className="site-header bg-white"
      role="banner"
      aria-label="Site header with navigation and search"
      style={{ borderTop: 'none' }}
    >
      <div id="wrapper" style={{ borderTop: 'none' }}>
        <div className="container-fluid" style={{ borderTop: 'none' }}>
          {/* Main Header Row */}
          <div 
            className="row-header" 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              padding: '4px 0',
              background: '#fff',
              borderBottom: '1px solid #e5e5e5',
              minHeight: '60px',
              position: 'relative'
            }}
          >
            <div 
              className="header-inner-container"
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                width: '100%',
                justifyContent: 'space-between',
                maxWidth: '1400px',
                margin: '0 auto',
                paddingLeft: '20px',
                paddingRight: '20px'
              }}
            >
              {/* Logo Section */}
              <div 
                className="logo-section"
                style={{ 
                  flex: '0 0 auto',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <Link 
                  to="/" 
                  style={{ textDecoration: 'none' }}
                  aria-label="Bhoomy homepage"
                  onFocus={(e) => {
                    e.currentTarget.style.outline = '2px solid #fe780e';
                    e.currentTarget.style.outlineOffset = '2px';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.outline = 'none';
                  }}
                >
                  <img 
                    src="/images/Bhoomy1.png" 
                    alt="Bhoomy - Advanced Search Engine for Bharata"
                    style={{ 
                      height: '60px',
                      maxWidth: '180px',
                      objectFit: 'contain',
                      display: 'block'
                    }}
                    loading="eager"
                  />
                </Link>
              </div>

              {/* Search Form */}
              <div 
                className="search-section"
                style={{ 
                  flex: '1',
                  display: 'flex',
                  justifyContent: 'left',
                  padding: '0 20px',
                  position: 'relative'
                }}
              >
                <form 
                  onSubmit={handleSearch} 
                  className="search-form" 
                  style={{ 
                    width: '100%',
                    maxWidth: '700px',
                    position: 'relative'
                  }}
                  role="search"
                  aria-label="Header search form"
                >
                  <div className="input-group" style={{ position: 'relative', display: 'flex', alignItems: 'center', backgroundColor: 'white', border: '2px solid #ddd', borderRadius: '15px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', transition: 'all 0.3s ease' }}>
                    <label htmlFor="header-search-input" className="sr-only">
                      Search query
                    </label>
                    
                    <input
                      id="header-search-input"
                      ref={searchInputRef}
                      type="search"
                      placeholder="What are you looking for? Search with Bhoomy!"
                      name="q"
                      value={query}
                      onChange={handleInputChange}
                      className="form-control input-md"
                      style={{
                        flex: 1,
                        padding: '12px 12px 12px 16px',
                        border: 'none',
                        borderRadius: '0',
                        fontSize: '16px',
                        outline: 'none',
                        boxSizing: 'border-box',
                        backgroundColor: 'transparent'
                      }}
                      onFocus={(e) => {
                        const container = e.target.closest('.input-group') as HTMLElement;
                        if (container) {
                          container.style.borderColor = '#fe780e';
                          container.style.boxShadow = '0 3px 12px rgba(254,120,14,0.2)';
                        }
                        announce('Search input focused');
                      }}
                      onBlur={(e) => {
                        const container = e.target.closest('.input-group') as HTMLElement;
                        if (container) {
                          container.style.borderColor = '#ddd';
                          container.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                        }
                        setTimeout(() => setShowSuggestions(false), 200);
                      }}
                      autoComplete="off"
                      aria-expanded={showSuggestions}
                      aria-haspopup="listbox"
                      aria-describedby="search-help"
                    />
                    
                    <div id="search-help" className="sr-only">
                      Enter keywords to search across web, images, videos, and news. Use quotes for exact phrases.
                    </div>
                    
                    {/* Separator Line */}
                    <div style={{ 
                      height: '24px', 
                      width: '1px', 
                      backgroundColor: '#d1d5db',
                      margin: '0 8px'
                    }}></div>
                    
                    {/* Microphone Icon */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (isListening) {
                          stopVoiceSearch();
                        } else {
                          startVoiceSearch();
                        }
                      }}
                      style={{
                        backgroundColor: isListening ? 'rgba(254, 120, 14, 0.1)' : 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.3s ease',
                        marginRight: '4px',
                        borderRadius: '50%'
                      }}
                      onMouseOver={(e) => {
                        if (!isListening) {
                          e.currentTarget.style.color = '#ff9500';
                        }
                      }}
                      onMouseOut={(e) => {
                        if (!isListening) {
                          e.currentTarget.style.color = '#fe780e';
                        }
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.outline = '2px solid #fe780e';
                        e.currentTarget.style.outlineOffset = '2px';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.outline = 'none';
                      }}
                      aria-label={isListening ? "Stop voice search" : "Start voice search"}
                      title={isListening ? "Stop listening" : "Voice search"}
                    >
                      <Mic 
                        style={{ 
                          width: '18px', 
                          height: '18px', 
                          color: isListening ? '#ff9500' : '#fe780e',
                          animation: isListening ? 'pulse 1.5s ease-in-out infinite' : 'none'
                        }}
                        aria-hidden="true"
                      />
                    </button>
                    
                    {/* Search Icon on Right */}
                    <button 
                      className="btn search-submit" 
                      type="submit" 
                      style={{
                        backgroundColor: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '12px 16px',
                        borderRadius: '0 15px 15px 0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'color 0.3s ease',
                        color: '#fe780e',
                        marginRight: '4px'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.color = '#ff9500';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.color = '#fe780e';
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.outline = '2px solid #fe780e';
                        e.currentTarget.style.outlineOffset = '2px';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.outline = 'none';
                      }}
                      aria-label="Submit search"
                      title="Search"
                    >
                      <Search 
                        style={{ 
                          width: '20px', 
                          height: '20px'
                        }}
                        aria-hidden="true"
                      />
                    </button>
                  </div>

                  {/* Search Suggestions */}
                  {showSuggestions && suggestions.length > 0 && (
                    <div
                      className="header-suggestions"
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        backgroundColor: 'white',
                        border: '1px solid #ddd',
                        borderTop: 'none',
                        borderRadius: '0 0 15px 15px',
                        boxShadow: '0 4px 15px #f75d10',
                        zIndex: 1000,
                        maxHeight: '200px',
                        overflowY: 'auto'
                      }}
                      role="listbox"
                      aria-label="Search suggestions"
                    >
                      {suggestions.map((suggestion, index) => (
                        <div
                          key={index}
                          className="suggestion-item"
                          style={{
                            padding: '10px 16px',
                            cursor: 'pointer',
                            borderBottom: '1px solid #f5f5f5',
                            transition: 'background-color 0.2s ease',
                            fontSize: '14px'
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.backgroundColor = '#f8f9fa';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.backgroundColor = 'white';
                          }}
                          onClick={() => handleSuggestionSelect(suggestion)}
                          role="option"
                          tabIndex={0}
                          aria-selected={false}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleSuggestionSelect(suggestion);
                            }
                          }}
                        >
                          {suggestion}
                        </div>
                      ))}
                    </div>
                  )}
                </form>
              </div>

              {/* Secondary Logo / User Info */}
              <div 
                className="secondary-logo"
                style={{ 
                  flex: '0 0 auto',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}
              >
                {/* USER LOGIN ACCESS TEMPORARILY DISABLED - All users can access all data */}
                {/* 
                {isAuthenticated && user ? (
                  <div className="relative" style={{ position: 'relative' }} ref={userMenuRef}>
                    <button
                      onClick={() => setShowUserMenu(!showUserMenu)}
                      className="flex items-center gap-2 px-2 sm:px-3 py-2 bg-blue-50 dark:bg-gray-700 rounded-lg hover:bg-blue-100 dark:hover:bg-gray-600 transition-colors"
                      style={{
                        border: '1px solid #e5e7eb',
                        cursor: 'pointer'
                      }}
                      aria-label="User menu"
                    >
                      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                      <div className="hidden sm:block text-left">
                        <div className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[120px]">
                          {user.user_name || 'User'}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[120px]">
                          {user.user_email}
                        </div>
                      </div>
                    </button>
                    
                    {showUserMenu && (
                      <div 
                        className="absolute right-0 mt-2 w-48 sm:w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50"
                        style={{
                          top: '100%',
                          right: 0
                        }}
                      >
                        <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {user.user_name || 'User'}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {user.user_email}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setShowUserMenu(false);
                            navigate('/profile');
                          }}
                          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                        >
                          <User className="w-4 h-4" />
                          <span>Profile</span>
                        </button>
                        <button
                          onClick={() => {
                            logout();
                            setShowUserMenu(false);
                            navigate('/');
                          }}
                          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <LogOut className="w-4 h-4" />
                          <span>Logout</span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Link
                      to="/login"
                      state={{ from: { pathname: location.pathname + location.search } }}
                      className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                    >
                      Sign In
                    </Link>
                    <Link
                      to="/signup"
                      state={{ from: { pathname: location.pathname + location.search } }}
                      className="px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Sign Up
                    </Link>
                  </div>
                )}
                */}
                
                <Link 
                  to="/" 
                  style={{ textDecoration: 'none' }}
                  aria-label="Bhoomy homepage (secondary logo)"
                  onFocus={(e) => {
                    e.currentTarget.style.outline = '2px solid #fe780e';
                    e.currentTarget.style.outlineOffset = '2px';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.outline = 'none';
                  }}
                  className="hidden sm:block"
                >
                  <img 
                    src="/images/Bhoomy.png" 
                    alt="Bhoomy logo"
                    style={{ 
                      height: '55px',
                      maxWidth: '150px',
                      objectFit: 'contain',
                      display: 'block'
                    }}
                    loading="lazy"
                  />
                </Link>
              </div>

            </div>
          </div>

          {/* Navigation Links */}
          <nav 
            className="navbar-container mobile-navbar" 
            style={{
              borderBottom: '1px solid #e5e5e5',
              backgroundColor: '#f8f9fa',
              padding: '0',
              marginTop: '0'
            }}
            role="navigation"
            aria-label="Main navigation"
          >
            <div 
              className="navbar-nav-container" 
              style={{
                maxWidth: '1400px',
                margin: '0 auto',
                padding: '0 40px',
                display: 'flex',
                alignItems: 'flex-start'
              }}
            >
              <ul 
                className="nav navbar-nav" 
                style={{
                  display: 'flex',
                  listStyle: 'none',
                  margin: '0',
                  fontSize: '14px',
                  padding: '0',
                  gap: '8px',
                  flexWrap: 'wrap',
                  justifyContent: 'flex-start'
                }}
                role="menubar"
              >
                {navigationItems.map((item) => (
                  <li key={item.name} role="none">
                    {item.external ? (
                      <a 
                        href={item.path}
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{
                          textDecoration: 'none',
                          padding: '12px 16px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          color: '#5f6368',
                          fontWeight: '500',
                          borderBottom: '3px solid transparent',
                          transition: 'all 0.3s ease',
                          height: '100%'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.color = '#fe780e';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.color = '#5f6368';
                        }}
                        onFocus={(e) => {
                          // Remove focus outline and underline effects
                          e.currentTarget.style.outline = 'none';
                        }}
                        onBlur={(e) => {
                          // Remove focus outline and underline effects
                          e.currentTarget.style.outline = 'none';
                        }}
                        aria-label={item.ariaLabel}
                        role="menuitem"
                      >
                        <strong style={{ fontWeight: 'inherit' }}>{item.name}</strong>
                      </a>
                    ) : (
                      <button
                        onClick={() => handleNavigation(item.path, currentQuery)}
                        style={{
                          textDecoration: 'none',
                          padding: '12px 16px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          color: activeNavItem === item.name ? '#fe780e' : '#5f6368',
                          fontWeight: activeNavItem === item.name ? '600' : '500',
                          borderBottom: activeNavItem === item.name ? '3px solid #fe780e' : '3px solid transparent',
                          backgroundColor: activeNavItem === item.name ? '#fff3e0' : 'transparent',
                          transition: 'all 0.2s ease',
                          borderTop: 'none',
                          borderLeft: 'none',
                          borderRight: 'none',
                          cursor: 'pointer',
                          fontSize: '14px',
                          height: '100%',
                          outline: 'none'
                        }}
                        onMouseOver={(e) => {
                          if (activeNavItem !== item.name) {
                            e.currentTarget.style.color = '#fe780e';
                          }
                        }}
                        onMouseOut={(e) => {
                          if (activeNavItem !== item.name) {
                            e.currentTarget.style.color = '#5f6368';
                          }
                        }}
                        onFocus={(e) => {
                          // Remove focus outline and underline effects
                          e.currentTarget.style.outline = 'none';
                        }}
                        onBlur={(e) => {
                          // Remove focus outline and underline effects
                          e.currentTarget.style.outline = 'none';
                        }}
                        aria-label={item.ariaLabel}
                        aria-current={activeNavItem === item.name ? 'page' : undefined}
                        role="menuitem"
                      >
                        <strong style={{ fontWeight: 'inherit' }}>{item.name}</strong>
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </nav>

      </div>

        {/* Responsive and Accessibility Styles */}
        <style>{`
          /* Screen reader only content */
          .sr-only {
            position: absolute;
            width: 1px;
            height: 1px;
            padding: 0;
            margin: -1px;
            overflow: hidden;
            clip: rect(0, 0, 0, 0);
            white-space: nowrap;
            border: 0;
          }

          /* Pulse animation for voice search */
          @keyframes pulse {
            0%, 100% {
              opacity: 1;
              transform: scale(1);
            }
            50% {
              opacity: 0.7;
              transform: scale(1.1);
            }
          }

          /* High contrast mode support */
          @media (prefers-contrast: high) {
            .form-control {
              border: 3px solid #000 !important;
            }
            
            .search-submit {
              background-color: #000 !important;
              color: #fff !important;
            }
          }

          /* Reduced motion support */
          @media (prefers-reduced-motion: reduce) {
            * {
              animation-duration: 0.01ms !important;
              animation-iteration-count: 1 !important;
              transition-duration: 0.01ms !important;
            }
          }

          /* Responsive Styles */
          @media (max-width: 992px) {
            .row-header > div {
              padding: 0 10px !important;
            }
            
            .row-header img {
              height: 50px !important;
            }
            
            .search-form {
              max-width: 500px !important;
            }
          }
          
          @media (max-width: 768px) {
            .row-header {
              padding: 2px 0 !important;
              min-height: 50px !important;
            }
            
            .row-header img {
              height: 45px !important;
              max-width: 120px !important;
            }
            
            .secondary-logo {
              display: none !important;
            }

            .navbar-container {
              display: block !important;
            }
            
            .navbar-nav {
              gap: 8px !important;
              justifyContent: flex-start !important;
              flex-wrap: nowrap !important;
              overflow-x: auto !important;
              padding: 0 !important;
              margin: 0 !important;
              -webkit-overflow-scrolling: touch;
              scrollbar-width: none; /* Firefox */
            }
            .navbar-nav::-webkit-scrollbar {
              display: none; /* Safari and Chrome */
            }
            
            .navbar-nav-container {
              padding: 0 20px !important;
              justify-content: flex-start !important;
            }
            
            .navbar-nav li {
              flex-shrink: 0 !important;
            }
            
            .navbar-nav button,
            .navbar-nav a {
              font-size: 13px !important;
              padding: 10px 14px !important;
              white-space: nowrap !important;
              height: 100% !important;
            }
            
            .row-header > div,
            .header-inner-container {
              justify-content: flex-start !important;
              gap: 8px !important;
              flex-wrap: nowrap !important;
              align-items: center !important;
            }
            
            .logo-section {
              flex: 0 0 auto !important;
              min-width: 0 !important;
            }
            
            .search-section {
              flex: 1 1 auto !important;
              padding: 0 8px !important;
              min-width: 0 !important;
              max-width: 100% !important;
            }
            
            .search-form {
              max-width: 100% !important;
              width: 100% !important;
            }
            
            .input-group {
              flex-wrap: nowrap !important;
            }
            
            .input-group input {
              font-size: 13px !important;
              padding: 8px 6px 8px 32px !important;
              min-width: 0 !important;
            }
            
            .input-group button.search-submit {
              padding: 8px 10px !important;
              font-size: 11px !important;
            }
            
            .input-group button[aria-label="Voice search"] {
              padding: 6px !important;
              margin-right: 2px !important;
            }
            
            .input-group button[aria-label="Voice search"] svg {
              width: 16px !important;
              height: 16px !important;
            }
            
            .input-group > div[style*="height: 24px"] {
              height: 20px !important;
              margin: 0 4px !important;
            }
          }
          
          @media (max-width: 480px) {
            .row-header img {
              height: 40px !important;
              max-width: 100px !important;
            }
            
            .row-header > div {
              padding-left: 8px !important;
              padding-right: 8px !important;
              gap: 6px !important;
            }
            
            .logo-section {
              flex: 0 0 auto !important;
            }
            
            .search-section {
              padding: 0 4px !important;
              flex: 1 1 auto !important;
              min-width: 0 !important;
            }
            
            .input-group input {
              font-size: 12px !important;
              padding: 8px 4px 8px 28px !important;
            }
            
            .input-group input::placeholder {
              font-size: 10px !important;
            }
            
            .input-group button.search-submit {
              padding: 8px 8px !important;
              font-size: 10px !important;
            }
            
            .input-group > div[style*="height: 24px"] {
              display: none !important;
            }
            
            .input-group button[aria-label="Voice search"] {
              padding: 6px 3px !important;
              margin-right: 2px !important;
            }
            
            .input-group button[aria-label="Voice search"] svg {
              width: 14px !important;
              height: 14px !important;
            }
            
            .input-group > div[style*="left: 12px"] {
              left: 8px !important;
            }
            
            .input-group > div[style*="left: 12px"] svg {
              width: 14px !important;
              height: 14px !important;
            }
          }

          /* Print styles */
          @media print {
            .header-suggestions {
              display: none !important;
            }
          }
        `}</style>
      </div>
    </header>
  );
};

export default Header; 