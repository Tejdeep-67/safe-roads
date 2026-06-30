import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authAPI, userAPI } from '../lib/api';

interface User {
  id: string;
  email: string;
  full_name: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if token exists and verify it
    const token = localStorage.getItem('auth_token');
    if (token) {
      verifyToken();
    } else {
      setLoading(false);
    }
  }, []);

  const verifyToken = async () => {
    try {
      // Instead of a separate verify call, try to fetch the profile directly.
      // If the token is invalid/expired the request will fail and we remove it.
      const userResponse = await userAPI.getProfile();
      if (userResponse?.data) {
        setUser({
          id: userResponse.data.id,
          email: userResponse.data.email,
          full_name: userResponse.data.full_name,
        });
      } else {
        localStorage.removeItem('auth_token');
        setUser(null);
      }
    } catch (error: any) {
      console.error('verifyToken error:', error?.response?.data || error.message || error);
      localStorage.removeItem('auth_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      const response = await authAPI.register(email, password, fullName);
      
      if (response.data.token) {
        localStorage.setItem('auth_token', response.data.token);
        // Fetch profile from server to ensure consistent user object
        try {
          const profile = await userAPI.getProfile();
          if (profile?.data) {
            setUser({
              id: profile.data.id,
              email: profile.data.email,
              full_name: profile.data.full_name,
            });
          }
        } catch (err) {
          // Fallback to response payload if profile fetch fails
          setUser({
            id: response.data.user?.id || '',
            email: response.data.user?.email || email,
            full_name: response.data.user?.full_name || fullName,
          });
        }
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Sign up failed');
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const response = await authAPI.login(email, password);
      
      if (response.data.token) {
        localStorage.setItem('auth_token', response.data.token);
        // Fetch profile from server to ensure consistent user object
        try {
          const profile = await userAPI.getProfile();
          if (profile?.data) {
            setUser({
              id: profile.data.id,
              email: profile.data.email,
              full_name: profile.data.full_name,
            });
          }
        } catch (err) {
          // Fallback to response payload if profile fetch fails
          setUser({
            id: response.data.user?.id || '',
            email: response.data.user?.email || email,
            full_name: response.data.user?.full_name || '',
          });
        }
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Sign in failed');
    }
  };

  const signOut = async () => {
    localStorage.removeItem('auth_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
