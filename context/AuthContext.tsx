import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ENDPOINTS, apiRequest } from '../services/api';

export type UserRole = 'ADMIN' | 'SUPERUSER' | 'OPERATOR';

export interface AuthUser {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  role: UserRole;
  permissions: string[];
}

interface LoginResponse {
  token: string;
  expires_at: string;
  user: AuthUser;
}

interface AuthContextType {
  token: string | null;
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  permissions: string[];
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'auth_token';
const EXPIRES_KEY = 'auth_token_expires_at';

const parseExpiresAt = (value?: string | null) => {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
};

const isExpired = (value?: string | null) => {
  const timestamp = parseExpiresAt(value);
  return timestamp !== null && timestamp <= Date.now();
};

const readStoredToken = () => {
  const token = localStorage.getItem(TOKEN_KEY);
  const expiresAt = localStorage.getItem(EXPIRES_KEY);
  if (token && isExpired(expiresAt)) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EXPIRES_KEY);
    return null;
  }
  return token;
};

const readStoredExpiry = () => {
  const expiresAt = localStorage.getItem(EXPIRES_KEY);
  return isExpired(expiresAt) ? null : expiresAt;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => readStoredToken());
  const [expiresAt, setExpiresAt] = useState<string | null>(() => readStoredExpiry());
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const clearAuth = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EXPIRES_KEY);
    setToken(null);
    setExpiresAt(null);
    setUser(null);
  };

  const refreshMe = async () => {
    const currentToken = localStorage.getItem(TOKEN_KEY);
    const currentExpiry = localStorage.getItem(EXPIRES_KEY);
    if (!currentToken || isExpired(currentExpiry)) {
      clearAuth();
      setUser(null);
      return;
    }
    const me = await apiRequest<{ user?: AuthUser } | AuthUser>(ENDPOINTS.AUTH.ME);
    const resolvedUser = (me && typeof me === 'object' && 'user' in me ? me.user : me) as AuthUser | undefined;
    if (!resolvedUser) {
      throw new Error('Invalid /auth/me response');
    }
    setUser(resolvedUser);
  };

  const login = async (username: string, password: string) => {
    const payload = await apiRequest<LoginResponse>(ENDPOINTS.AUTH.LOGIN, {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    localStorage.setItem(TOKEN_KEY, payload.token);
    localStorage.setItem(EXPIRES_KEY, payload.expires_at);
    setToken(payload.token);
    setExpiresAt(payload.expires_at);
    setUser(payload.user);
  };

  const logout = async () => {
    try {
      if (localStorage.getItem(TOKEN_KEY)) {
        await apiRequest(ENDPOINTS.AUTH.LOGOUT, {
          method: 'POST',
        });
      }
    } catch {
      // Ignore logout failures and clear local session anyway.
    } finally {
      clearAuth();
    }
  };

  useEffect(() => {
    (async () => {
      try {
        if (!token) {
          setLoading(false);
          return;
        }
        if (isExpired(expiresAt)) {
          clearAuth();
          setLoading(false);
          return;
        }
        await refreshMe();
      } catch {
        clearAuth();
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  useEffect(() => {
    if (!token || !expiresAt) return;
    const expiryTimestamp = parseExpiresAt(expiresAt);
    if (expiryTimestamp === null) return;
    const remaining = expiryTimestamp - Date.now();
    if (remaining <= 0) {
      clearAuth();
      return;
    }
    const timeoutId = window.setTimeout(() => {
      clearAuth();
    }, remaining);
    return () => window.clearTimeout(timeoutId);
  }, [expiresAt, token]);

  const hasPermission = (permission: string) => {
    if (!user) return false;
    if (user.role === 'ADMIN') return true;
    // Business rule: non-admin users can never access AI or user management.
    if (permission === 'ai.access') return false;
    if (permission === 'users.manage') return false;
    return (user.permissions || []).includes(permission);
  };

  const value = useMemo<AuthContextType>(() => ({
    token,
    user,
    loading,
    isAuthenticated: !!token && !!user,
    isAdmin: user?.role === 'ADMIN',
    permissions: user?.permissions || [],
    login,
    logout,
    refreshMe,
    hasPermission,
  }), [token, user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
