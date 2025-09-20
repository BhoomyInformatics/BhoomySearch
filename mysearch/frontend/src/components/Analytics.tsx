import { useEffect } from 'react';

interface AnalyticsProps {
  siteId: string;
}

const Analytics: React.FC<AnalyticsProps> = ({ siteId }) => {
  useEffect(() => {
    console.log('📊 Analytics: Initializing Clicky tracking for site ID:', siteId);
    
    // Create script element exactly as provided
    const script = document.createElement('script');
    script.async = true;
    script.setAttribute('data-id', siteId);
    script.src = '//static.getclicky.com/js';
    document.head.appendChild(script);

    // Create noscript element exactly as provided
    const noscript = document.createElement('noscript');
    noscript.innerHTML = `<p><img alt="Clicky" width="1" height="1" src="//in.getclicky.com/${siteId}ns.gif" /></p>`;
    document.body.appendChild(noscript);

    // Cleanup function
    return () => {
      console.log('📊 Analytics: Cleaning up Clicky tracking');
      const existingScript = document.querySelector(`script[data-id="${siteId}"]`);
      if (existingScript) {
        existingScript.remove();
      }
      
      const existingNoscript = document.querySelector('noscript');
      if (existingNoscript && existingNoscript.innerHTML.includes(siteId)) {
        existingNoscript.remove();
      }
    };
  }, [siteId]);

  // Render the exact script tags as provided
  return (
    <>
      <script async data-id={siteId} src="//static.getclicky.com/js"></script>
      <noscript>
        <p>
          <img alt="Clicky" width="1" height="1" src={`//in.getclicky.com/${siteId}ns.gif`} />
        </p>
      </noscript>
    </>
  );
};

export default Analytics;
