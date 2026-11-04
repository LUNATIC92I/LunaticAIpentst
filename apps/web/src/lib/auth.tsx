'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { auth as authApi, platform, tokenStore, type Me } from './api';

interface AuthState {
  me: Me | null;
  loading: boolean;
  login: (email: string, password: string, totp?: string) => Promise<void>;
  register: (p: { email: string; password: string; displayName?: string; organizationName?: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async () => {
    if (!tokenStore.access) {
      setMe(null);
      setLoading(false);
      return;
    }
    try {
      setMe(await platform.me());
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshMe();
  }, [refreshMe]);

  const login = useCallback(
    async (email: string, password: string, totp?: string) => {
      const pair = await authApi.login(email, password, totp);
      tokenStore.set(pair.accessToken, pair.refreshToken);
      setMe(await platform.me());
    },
    [],
  );

  const register = useCallback(
    async (p: { email: string; password: string; displayName?: string; organizationName?: string }) => {
      const pair = await authApi.register(p);
      tokenStore.set(pair.accessToken, pair.refreshToken);
      setMe(await platform.me());
    },
    [],
  );

  const logout = useCallback(async () => {
    const refresh = tokenStore.refresh;
    if (refresh) await authApi.logout(refresh).catch(() => undefined);
    tokenStore.clear();
    setMe(null);
  }, []);

  return (
    <AuthContext.Provider value={{ me, loading, login, register, logout, refreshMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
