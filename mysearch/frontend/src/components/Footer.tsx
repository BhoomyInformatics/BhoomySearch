import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="footer-container" style={{
      backgroundColor: '#f8f9fa',
      borderTop: '1px solid #e5e5e5',
      padding: '20px 0',
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
        gap: '20px'
      }}>
        <div className="footer-col">
          <p style={{ margin: '0', fontSize: '14px', color: '#333' }}>
            <strong>Copyright © 2025 Bhoomy. All rights reserved.</strong>
          </p>
        </div>
        
        <div className="footer-col footer-center">
          <p style={{ margin: '0', fontSize: '14px', color: '#333' }}>
            <strong>
              <a 
                href="https://bhoomy.in/" 
                className="make-in-india" 
                style={{ 
                  color: '#007bff', 
                  textDecoration: 'none',
                  marginRight: '10px'
                }}
                onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'}
                onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
              >
                Make In India
              </a>
              |
              <a 
                href="https://about.bhoomy.in/" 
                className="about-us" 
                style={{ 
                  color: '#007bff', 
                  textDecoration: 'none',
                  marginLeft: '10px'
                }}
                onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'}
                onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
              >
                About Us
              </a>
            </strong>
          </p>
        </div>
        
        <div className="footer-col">
          <p style={{ margin: '0', fontSize: '14px', color: '#333' }}>
            <strong>
              Feedback & Suggestion: 
              <a 
                href="mailto:info@bhoomy.in" 
                style={{ 
                  color: '#007bff', 
                  textDecoration: 'none',
                  marginLeft: '5px'
                }}
                onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'}
                onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
              >
                <b>info@bhoomy.in</b>
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