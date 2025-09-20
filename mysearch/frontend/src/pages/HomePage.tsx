import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { useSearchStore } from '../store/searchStore';
import Analytics from '../components/Analytics';

const HomePage: React.FC = () => {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const { addToHistory } = useSearchStore();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      addToHistory(query.trim());
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{
      background: 'linear-gradient(135deg, rgb(245, 247, 250) 0%, rgb(250, 240, 227) 100%)'
    }}>
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center"
          style={{ 
            marginTop: '1%', 
            width: '100%', 
            maxWidth: '700px', 
            margin: '2% auto 0',
            padding: '0 10px'
          }}
        >
          {/* Main Logo - Properly Centered */}
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mb-8"
            style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center' 
            }}
          >
            <img
              src="/images/Bhoomy1.png"
              alt="Bhoomy"
              style={{ 
                height: '120px',
                maxWidth: '100%',
                objectFit: 'contain'
              }}
            />
          </motion.div>

          {/* Search Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="search-form"
          >
            <form onSubmit={handleSearch}>
              <div className="input-group" style={{ 
                width: '100%', 
                position: 'relative',
                display: 'flex',
                alignItems: 'center'
              }}>
                <input
                  type="text"
                  placeholder="Search Web"
                  name="q"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="form-control input-lg"
                  style={{
                    borderRadius: '15px',
                    border: '2px solid #ddd',
                    padding: '15px 40px 15px 10px',
                    fontSize: '16px',
                    width: '100%',
                    boxSizing: 'border-box',
                    outline: 'none',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                    transition: 'all 0.3s ease'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#fe780e';
                    e.target.style.boxShadow = '0 4px 15px rgba(254,120,14,0.2)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#ddd';
                    e.target.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
                  }}
                  required
                />
                <button
                  type="submit"
                  className="btn"
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    backgroundColor: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '8px',
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
                >
                  <Search
                    style={{
                      fontSize: '20px',
                      color: '#fe780e',
                      width: '24px',
                      height: '22px'
                    }}
                  />
                </button>
              </div>
              
              <br />
              
              {/* Secondary Logo */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.8 }}
                style={{ 
                  display: 'flex', 
                  justifyContent: 'center', 
                  alignItems: 'center',
                  marginTop: '10px'
                }}
              >
                <img
                  src="/images/Bhoomy.png"
                  alt="Bhoomy"
                  style={{ 
                    height: '120px',
                    maxWidth: '100%',
                    objectFit: 'contain'
                  }}
                />
              </motion.div>
            </form>
          </motion.div>
        </motion.div>
      </div>

 
      {/* Responsive Styles */}
      <style>{`
        @media (max-width: 768px) {
          .container {
            position: fixed !important;
            padding: 0 !important;            
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            margin: 0 !important;            
            padding-top: 10vh !important;
          }
          
          .text-center {
            width: 95% !important;
            margin-top: 0% !important;
          }
          
          .form-control {
            font-size: 16px !important;
            padding: 12px 15px 12px 12px !important;
          }
          
          img {
            height: 90px !important;
          }
        }
        
        @media (max-width: 480px) {
        .container {
            position: fixed !important;
            padding: 0 !important;            
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            margin: 0 !important;            
            padding-top: 10vh !important;
          }


          .text-center {
            width: 98% !important;
          }
          
          .form-control {
            font-size: 14px !important;
            padding: 10px 10px 10px 10px !important;
          }
          
          img {
            height: 80px !important;
          }
        }
      `}</style>
      
      {/* Analytics */}
      <Analytics siteId="101276548" />
    </div>
  );
};

export default HomePage; 