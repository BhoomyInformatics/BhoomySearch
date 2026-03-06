/**
 * Authentication Store
 * Manages user authentication state
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '../types';

interface AuthStore {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Actions
  login: (email: string, password: string) => Promise<boolean>;
  signup: (name: string, email: string, password: string) => Promise<boolean>;
  logout: () => void;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
}

// Mock authentication - for testing
const MOCK_USER = {
  email: 'user@bhoomy.in',
  password: 'Bhoomy@11'
};

const mockLogin = async (email: string, password: string): Promise<{ user: User; token: string } | null> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Check mock credentials
  if (email === MOCK_USER.email && password === MOCK_USER.password) {
    return {
      user: {
        user_id: 1,
        user_name: 'Test User',
        user_email: email,
        user_type: 'user',
        user_active: true,
        user_created: new Date().toISOString(),
        user_last_login: new Date().toISOString()
      },
      token: 'mock_jwt_token_' + Date.now()
    };
  }
  
  return null;
};

const mockSignup = async (name: string, email: string, _password: string): Promise<{ user: User; token: string } | null> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // For mock, just create a user
  return {
    user: {
      user_id: Date.now(),
      user_name: name,
      user_email: email,
      user_type: 'user',
      user_active: true,
      user_created: new Date().toISOString(),
      user_last_login: new Date().toISOString()
    },
    token: 'mock_jwt_token_' + Date.now()
  };
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (email: string, password: string) => {
        set({ isLoading: true });
        try {
          const result = await mockLogin(email, password);
          if (result) {
            set({
              user: result.user,
              token: result.token,
              isAuthenticated: true,
              isLoading: false
            });
            localStorage.setItem('auth_token', result.token);
            return true;
          } else {
            set({ isLoading: false });
            return false;
          }
        } catch (error) {
          console.error('Login error:', error);
          set({ isLoading: false });
          return false;
        }
      },

      signup: async (name: string, email: string, password: string) => {
        set({ isLoading: true });
        try {
          const result = await mockSignup(name, email, password);
          if (result) {
            set({
              user: result.user,
              token: result.token,
              isAuthenticated: true,
              isLoading: false
            });
            localStorage.setItem('auth_token', result.token);
            return true;
          } else {
            set({ isLoading: false });
            return false;
          }
        } catch (error) {
          console.error('Signup error:', error);
          set({ isLoading: false });
          return false;
        }
      },

      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false
        });
        localStorage.removeItem('auth_token');
      },

      setUser: (user: User | null) => {
        set({ user, isAuthenticated: !!user });
      },

      setToken: (token: string | null) => {
        set({ token });
        if (token) {
          localStorage.setItem('auth_token', token);
        } else {
          localStorage.removeItem('auth_token');
        }
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
);

