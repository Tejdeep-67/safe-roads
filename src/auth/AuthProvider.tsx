import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError } from '../lib/api';

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

type Status = 'loading' | 'ready' | 'offline';

interface AuthValue {
  user: User | null;
  status: Status;
  signIn: (email: string, password: string) => Promise<User>;
  signUp: (name: string, email: string, password: string) => Promise<User>;
  signOut: () => Promise<void>;
  deleteAccount: (password: string) => Promise<number>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<Status>('loading');

  const refresh = useCallback(async () => {
    try {
      const { user } = await api<{ user: User | null }>('/api/auth/me');
      setUser(user);
      setStatus('ready');
    } catch (e) {
      // 503 = server up but sign-in not configured; anything else = can't reach it
      setStatus(e instanceof ApiError && e.status === 503 ? 'ready' : 'offline');
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { user } = await api<{ user: User }>('/api/auth/login', { method: 'POST', json: { email, password } });
    setUser(user);
    setStatus('ready');
    return user;
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    const { user } = await api<{ user: User }>('/api/auth/signup', { method: 'POST', json: { name, email, password } });
    setUser(user);
    setStatus('ready');
    return user;
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api('/api/auth/logout', { method: 'POST', json: {} });
    } finally {
      setUser(null);
    }
  }, []);

  const deleteAccount = useCallback(async (password: string) => {
    const res = await api<{ reportsRemoved: number }>('/api/auth/me', { method: 'DELETE', json: { password } });
    setUser(null);
    return res.reportsRemoved;
  }, []);

  const value = useMemo(
    () => ({ user, status, signIn, signUp, signOut, deleteAccount, refresh }),
    [user, status, signIn, signUp, signOut, deleteAccount, refresh],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const v = useContext(AuthContext);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}
