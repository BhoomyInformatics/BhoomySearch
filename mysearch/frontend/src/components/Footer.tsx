import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="footer-container" style={{
      backgroundColor: '#fce7f3',
      borderTop: '1px solid #e5e5e5',
      padding: '10px 0',
      marginTop: 'auto'
    }}>
      <div className="footer-row" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '0 20px',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <div className="footer-col">
          <p style={{ margin: '0', fontSize: '12px' }}>
            <strong style={{ color: '#fe780e' }}>
              Copyright © 2025 Bhoomy. All rights reserved.
            </strong>
          </p>
        </div>
        
        <div className="footer-col footer-center">
          <p style={{ margin: '0', fontSize: '12px' }}>
            <strong style={{ color: '#fe780e' }}>
              <a 
                href="https://bhoomy.in/" 
                className="make-in-india" 
                style={{ 
                  color: '#fe780e', 
                  textDecoration: 'none',
                  marginRight: '10px'
                }}
                onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'}
                onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
              >
                About Us
              </a>
              |
              <a 
                href="mailto:info@bhoomy.in" 
                className="feedback" 
                style={{ 
                  color: '#fe780e', 
                  textDecoration: 'none',
                  marginLeft: '10px',
                  marginRight: '10px'
                }}
                onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'}
                onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
              >
                Feedback:info@bhoomy.in
              </a>
              |
              <a 
                href="https://bhoomy.in/terms" 
                className="terms" 
                style={{ 
                  color: '#fe780e', 
                  textDecoration: 'none',
                  marginLeft: '10px'
                }}
                onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'}
                onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
              >
                Terms of use
              </a>
            </strong>
          </p>
        </div>
      </div>
      
      {/* Mobile responsive styles */}
      <style>{`
        @media (max-width: 768px) {
          .footer-row {
            justify-content: center !important;
            text-align: center !important;
            flex-direction: column !important;
          }
          
          .footer-col {
            text-align: center !important;
          }
        }
      `}</style>
    </footer>
  );
};

export default Footer;
