import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, LogIn, UserPlus, LogOut } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

const FloatingMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    setIsOpen(false);
    navigate('/');
  };

  const menuItems = [
    ...(isAuthenticated
      ? [
          {
            icon: User,
            label: 'Profile',
            onClick: () => {
              setIsOpen(false);
              // Navigate to profile page when available
            }
          },
          {
            icon: LogOut,
            label: 'Sign Out',
            onClick: handleLogout
          }
        ]
      : [
          {
            icon: LogIn,
            label: 'Sign In',
            onClick: () => {
              setIsOpen(false);
              navigate('/login');
            }
          },
          {
            icon: UserPlus,
            label: 'Sign Up',
            onClick: () => {
              setIsOpen(false);
              navigate('/signup');
            }
          }
        ])
  ];

  // Always show hamburger menu on left side for all devices
  return (
    <div className="fixed top-2 left-2 z-[100]" style={{ overflow: 'visible' }}>
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(!isOpen)}
        className="w-9 h-9 rounded-full shadow-lg flex items-center justify-center border border-orange-200 hover:border-orange-400 transition-colors"
        style={{ backgroundColor: '#fe780e', color: 'white' }}
        aria-label="Menu"
      >
        {isOpen ? (
          <X size={16} strokeWidth={2.5} />
        ) : (
          <div className="flex flex-col gap-1">
            <div className="w-3.5 h-0.5 bg-white rounded-full"></div>
            <div className="w-3.5 h-0.5 bg-white rounded-full"></div>
            <div className="w-3.5 h-0.5 bg-white rounded-full"></div>
          </div>
        )}
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Click-away overlay to close menu when clicking anywhere on page */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-transparent z-[90]"
            />
            <motion.div
              initial={{ x: -32, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -32, opacity: 0 }}
              transition={{ type: 'spring', damping: 18, stiffness: 280 }}
              className="fixed top-2 left-12 z-[100]"
              style={{ overflow: 'visible' }}
            >
              <div
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-0.5 shadow-md border border-white/30"
                style={{ backgroundColor: 'rgba(254,120,14,0.5)' }}
              >
                {menuItems.map((item, idx) => (
                  <motion.button
                    key={idx}
                    whileTap={{ scale: 0.96 }}
                    onClick={item.onClick}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium text-white/90 hover:text-white transition-colors whitespace-nowrap"
                    style={{ backgroundColor: 'rgba(254,120,14,0.5)' }}
                  >
                    <item.icon size={12} className="text-white" />
                    <span>{item.label}</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FloatingMenu;
