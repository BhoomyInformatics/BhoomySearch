/**
 * Enhanced SEO Hook for Dynamic Meta Tags and Structured Data
 */

import { useEffect } from 'react';

interface SEOData {
  title?: string;
  description?: string;
  keywords?: string[];
  canonicalUrl?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: string;
  twitterCard?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
  twitterSite?: string;
  author?: string;
  publishedTime?: string;
  modifiedTime?: string;
  section?: string;
  tags?: string[];
  locale?: string;
  alternateLocales?: string[];
  robots?: string;
  structuredData?: any;
}

interface SEOConfig {
  siteName: string;
  siteUrl: string;
  defaultTitle: string;
  defaultDescription: string;
  defaultImage: string;
  defaultKeywords: string[];
  twitterHandle: string;
  fbAppId?: string;
  locale: string;
  themeColor: string;
}

const defaultConfig: SEOConfig = {
  siteName: 'Bhoomy Search Engine',
  siteUrl: 'https://bhoomy.com',
  defaultTitle: 'Bhoomy - Bharata\'s Search Engine',
  defaultDescription: 'Advanced search engine with AI-powered results. Search the web, images, videos, and news with enhanced features and privacy protection.',
  defaultImage: '/images/Bhoomy-og.png',
  defaultKeywords: ['search engine', 'web search', 'image search', 'video search', 'news search', 'India', 'Bharata', 'AI search'],
  twitterHandle: '@BhoomySearch',
  locale: 'en_IN',
  themeColor: '#fe780e'
};

/**
 * Dynamic SEO management hook with comprehensive meta tag and structured data support
 */
export const useSEO = (seoData: SEOData, config: Partial<SEOConfig> = {}) => {
  const seoConfig = { ...defaultConfig, ...config };

  useEffect(() => {
    // Update document title
    const title = seoData.title 
      ? `${seoData.title} | ${seoConfig.siteName}`
      : seoConfig.defaultTitle;
    document.title = title;

    // Update meta tags
    updateMetaTag('description', seoData.description || seoConfig.defaultDescription);
    
    // Keywords
    if (seoData.keywords && seoData.keywords.length > 0) {
      updateMetaTag('keywords', seoData.keywords.join(', '));
    } else {
      updateMetaTag('keywords', seoConfig.defaultKeywords.join(', '));
    }

    // Canonical URL
    const canonical = seoData.canonicalUrl || window.location.href;
    updateLinkTag('canonical', canonical);

    // Robots
    updateMetaTag('robots', seoData.robots || 'index, follow');

    // Author
    if (seoData.author) {
      updateMetaTag('author', seoData.author);
    }

    // Open Graph tags
    updateMetaProperty('og:title', seoData.ogTitle || title);
    updateMetaProperty('og:description', seoData.ogDescription || seoData.description || seoConfig.defaultDescription);
    updateMetaProperty('og:image', seoData.ogImage || seoConfig.defaultImage);
    updateMetaProperty('og:url', canonical);
    updateMetaProperty('og:type', seoData.ogType || 'website');
    updateMetaProperty('og:site_name', seoConfig.siteName);
    updateMetaProperty('og:locale', seoData.locale || seoConfig.locale);

    // Twitter Card tags
    updateMetaName('twitter:card', seoData.twitterCard || 'summary_large_image');
    updateMetaName('twitter:title', seoData.twitterTitle || title);
    updateMetaName('twitter:description', seoData.twitterDescription || seoData.description || seoConfig.defaultDescription);
    updateMetaName('twitter:image', seoData.twitterImage || seoConfig.defaultImage);
    updateMetaName('twitter:site', seoData.twitterSite || seoConfig.twitterHandle);

    // Article-specific tags
    if (seoData.publishedTime) {
      updateMetaProperty('article:published_time', seoData.publishedTime);
    }
    if (seoData.modifiedTime) {
      updateMetaProperty('article:modified_time', seoData.modifiedTime);
    }
    if (seoData.section) {
      updateMetaProperty('article:section', seoData.section);
    }
    if (seoData.tags && seoData.tags.length > 0) {
      // Remove existing article:tag meta tags
      document.querySelectorAll('meta[property="article:tag"]').forEach(tag => tag.remove());
      
      // Add new article:tag meta tags
      seoData.tags.forEach(tag => {
        const meta = document.createElement('meta');
        meta.setAttribute('property', 'article:tag');
        meta.setAttribute('content', tag);
        document.head.appendChild(meta);
      });
    }

    // Alternate locales
    if (seoData.alternateLocales && seoData.alternateLocales.length > 0) {
      seoData.alternateLocales.forEach(locale => {
        updateLinkTag('alternate', `${seoConfig.siteUrl}/${locale}`, locale);
      });
    }

    // Structured Data (JSON-LD)
    if (seoData.structuredData) {
      updateStructuredData(seoData.structuredData);
    }

    // Theme color
    updateMetaTag('theme-color', seoConfig.themeColor);

    // Cleanup function
    return () => {
      // Optionally remove or reset meta tags when component unmounts
      // This is usually not necessary as the next page will update them
    };
  }, [seoData, seoConfig]);

  // Utility functions for meta tag management
  const updateMetaTag = (name: string, content: string) => {
    let meta = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement;
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', name);
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', content);
  };

  const updateMetaProperty = (property: string, content: string) => {
    let meta = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement;
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('property', property);
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', content);
  };

  const updateMetaName = (name: string, content: string) => {
    let meta = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement;
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', name);
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', content);
  };

  const updateLinkTag = (rel: string, href: string, hreflang?: string) => {
    const selector = hreflang 
      ? `link[rel="${rel}"][hreflang="${hreflang}"]`
      : `link[rel="${rel}"]`;
    
    let link = document.querySelector(selector) as HTMLLinkElement;
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', rel);
      if (hreflang) {
        link.setAttribute('hreflang', hreflang);
      }
      document.head.appendChild(link);
    }
    link.setAttribute('href', href);
  };

  const updateStructuredData = (data: any) => {
    // Remove existing structured data
    const existingScript = document.querySelector('script[type="application/ld+json"]');
    if (existingScript) {
      existingScript.remove();
    }

    // Add new structured data
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(data);
    document.head.appendChild(script);
  };

  return {
    updateSEO: (_newSeoData: Partial<SEOData>) => {
      // This function can be used to update SEO data dynamically
      // Implementation would merge newSeoData with current seoData and trigger re-render
    }
  };
};

/**
 * Generate structured data for different page types
 */
export const generateStructuredData = {
  // Website/Organization schema
  website: (config: SEOConfig) => ({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: config.siteName,
    url: config.siteUrl,
    description: config.defaultDescription,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${config.siteUrl}/search?q={search_term_string}`,
      'query-input': 'required name=search_term_string'
    },
    publisher: {
      '@type': 'Organization',
      name: config.siteName,
      url: config.siteUrl,
      logo: {
        '@type': 'ImageObject',
        url: `${config.siteUrl}/images/Bhoomy1.png`,
        width: 300,
        height: 120
      }
    }
  }),

  // Search results page schema
  searchResults: (query: string, results: any[], config: SEOConfig) => ({
    '@context': 'https://schema.org',
    '@type': 'SearchResultsPage',
    url: `${config.siteUrl}/search?q=${encodeURIComponent(query)}`,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: results.length,
      itemListElement: results.slice(0, 10).map((result, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: result.site_data_link,
        name: result.site_data_title,
        description: result.site_data_description
      }))
    }
  }),

  // Breadcrumb schema
  breadcrumb: (items: Array<{name: string, url: string}>) => ({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url
    }))
  }),

  // FAQ schema
  faq: (questions: Array<{question: string, answer: string}>) => ({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: questions.map(qa => ({
      '@type': 'Question',
      name: qa.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: qa.answer
      }
    }))
  }),

  // Local business schema (if applicable)
  localBusiness: (config: SEOConfig) => ({
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: config.siteName,
    url: config.siteUrl,
    description: config.defaultDescription,
    applicationCategory: 'SearchEngine',
    operatingSystem: 'Web Browser',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'INR'
    }
  })
};

/**
 * SEO monitoring and analytics utilities
 */
export const seoAnalytics = {
  // Track page views with SEO data
  trackPageView: (page: string, seoData: SEOData) => {
    // Track page view with analytics (Google Analytics, etc.)
    if (typeof (window as any).gtag !== 'undefined') {
      (window as any).gtag('config', 'GA_MEASUREMENT_ID', {
        page_title: seoData.title,
        page_location: seoData.canonicalUrl || window.location.href,
        custom_map: {
          keywords: seoData.keywords?.join(', '),
          description: seoData.description
        }
      });
    }

    console.log('📊 SEO Page View Tracked:', {
      page,
      title: seoData.title,
      description: seoData.description,
      keywords: seoData.keywords
    });
  },

  // Check meta tag completeness
  auditMetaTags: () => {
    const requiredTags = [
      'title',
      'meta[name="description"]',
      'meta[name="keywords"]',
      'meta[property="og:title"]',
      'meta[property="og:description"]',
      'meta[property="og:image"]',
      'link[rel="canonical"]'
    ];

    const audit = {
      missing: [] as string[],
      present: [] as string[],
      score: 0
    };

    requiredTags.forEach(selector => {
      const element = document.querySelector(selector);
      if (element && element.getAttribute('content')) {
        audit.present.push(selector);
      } else {
        audit.missing.push(selector);
      }
    });

    audit.score = (audit.present.length / requiredTags.length) * 100;

    console.log('🔍 SEO Audit Results:', audit);
    return audit;
  },

  // Check accessibility compliance
  auditAccessibility: () => {
    const checks = {
      imagesWithAlt: 0,
      imagesWithoutAlt: 0,
      headingStructure: [],
      linksWithDescription: 0,
      linksWithoutDescription: 0,
      ariaLabels: 0,
      keyboardNavigation: false
    };

    // Check images
    document.querySelectorAll('img').forEach(img => {
      if (img.alt && img.alt.trim()) {
        checks.imagesWithAlt++;
      } else {
        checks.imagesWithoutAlt++;
      }
    });

    // Check heading structure
    document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(heading => {
      (checks.headingStructure as any[]).push({
        level: heading.tagName,
        text: heading.textContent?.substring(0, 50) || ''
      });
    });

    // Check links
    document.querySelectorAll('a').forEach(link => {
      if (link.getAttribute('aria-label') || 
          link.getAttribute('title') || 
          (link.textContent && link.textContent.trim())) {
        checks.linksWithDescription++;
      } else {
        checks.linksWithoutDescription++;
      }
    });

    // Check ARIA labels
    checks.ariaLabels = document.querySelectorAll('[aria-label], [aria-labelledby], [aria-describedby]').length;

    // Check keyboard navigation support
    checks.keyboardNavigation = document.querySelectorAll('[tabindex], button, input, select, textarea, a[href]').length > 0;

    console.log('♿ Accessibility Audit Results:', checks);
    return checks;
  }
};

export default useSEO;
