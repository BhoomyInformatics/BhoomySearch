/**
 * Enhanced Header with comprehensive SEO and Accessibility features
 */

import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams, Link, useLocation } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useAccessibility } from '../hooks/useAccessibility';

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
  
  const searchInputRef = useRef<HTMLInputElement>(null);

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
      name: 'Web',
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
    if (query.trim()) {
      const searchQuery = query.trim();
      announce(`Searching for: ${searchQuery}`, 'assertive');
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
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
    
    // Auto-navigate to search
    setTimeout(() => {
      navigate(`/search?q=${encodeURIComponent(suggestion)}`);
    }, 100);
  };


  return (
    <header 
      id="site-header"
      className="site-header"
      role="banner"
      aria-label="Site header with navigation and search"
    >
      <div id="wrapper">
        <div className="container-fluid">
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
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              width: '100%',
              justifyContent: 'space-between',
              maxWidth: '1400px',
              margin: '0 auto',
              paddingLeft: '20px',
              paddingRight: '20px'
            }}>
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
                    fetchPriority="high"
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
                  <div className="input-group" style={{ position: 'relative' }}>
                    <label htmlFor="header-search-input" className="sr-only">
                      Search query
                    </label>
                    
                    <input
                      id="header-search-input"
                      ref={searchInputRef}
                      type="search"
                      placeholder="Search Web, Images, Videos, News..."
                      name="q"
                      value={query}
                      onChange={handleInputChange}
                      className="form-control input-md"
                      style={{
                        width: '100%',
                        padding: '12px 50px 12px 16px',
                        border: '2px solid #ddd',
                        borderRadius: '15px',
                        fontSize: '16px',
                        outline: 'none',
                        boxSizing: 'border-box',
                        transition: 'all 0.3s ease',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#fe780e';
                        e.target.style.boxShadow = '0 3px 12px rgba(254,120,14,0.2)';
                        announce('Search input focused');
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#ddd';
                        e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
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
                    
                    <button 
                      className="btn search-submit" 
                      type="submit" 
                      style={{
                        position: 'absolute',
                        right: '15px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        backgroundColor: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '6px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'background-color 0.3s ease'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(254,120,14,0.1)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
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
                          height: '20px', 
                          color: '#fe780e' 
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
                        boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
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

              {/* Secondary Logo */}
              <div 
                className="secondary-logo"
                style={{ 
                  flex: '0 0 auto',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
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
                  marginLeft: '10px',
                  fontSize: '14px',
                  padding: '4px 0',
                  gap: '25px',
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
                          padding: '8px 0',
                          display: 'inline-block',
                          color: '#333',
                          fontWeight: 'normal',
                          borderBottom: '2px solid transparent',
                          transition: 'all 0.3s ease'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.color = '#fe780e';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.color = '#333';
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
                        <strong>{item.name}</strong>
                      </a>
                    ) : (
                      <button
                        onClick={() => handleNavigation(item.path, currentQuery)}
                        style={{
                          textDecoration: 'none',
                          padding: '8px 0',
                          display: 'inline-block',
                          color: activeNavItem === item.name ? '#fe780e' : '#333',
                          fontWeight: 'normal',
                          borderBottom: '2px solid transparent',
                          transition: 'all 0.3s ease',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '14px'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.color = '#fe780e';
                        }}
                        onMouseOut={(e) => {
                          if (activeNavItem !== item.name) {
                            e.currentTarget.style.color = '#333';
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
                        <strong>{item.name}</strong>
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
              height: 65px !important;
              max-width: 200px !important;
            }
            
            .secondary-logo {
              display: none !important;
            }

            .navbar-container {
              display: block !important;
            }
            
            .navbar-nav {
              gap: 15px !important;
              justify-content: flex-start !important;
              flex-wrap: nowrap !important;
              overflow-x: auto !important;
              padding: 4px 0 !important;
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
              font-size: 12px !important;
              padding: 4px 0 !important;
              white-space: nowrap !important;
            }
            
            .row-header > div {
              justify-content: space-between !important;
              gap: 15px !important;
            }
            
            .search-section {
              flex: 1 !important;
              padding: 0 15px !important;
            }
            
            .search-form {
              max-width: 100% !important;
              width: 100% !important;
            }
          }
          
          @media (max-width: 480px) {
            .row-header img {
              height: 55px !important;
              max-width: 180px !important;
            }
            
            .form-control {
              font-size: 14px !important;
              padding: 10px 45px 10px 12px !important;
            }
            
            .search-section {
              padding: 0 10px !important;
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