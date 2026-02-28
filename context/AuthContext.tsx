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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const clearAuth = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EXPIRES_KEY);
    setToken(null);
    setUser(null);
  };

  const refreshMe = async () => {
    const currentToken = localStorage.getItem(TOKEN_KEY);
    if (!currentToken) {
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
        await refreshMe();
      } catch {
        clearAuth();
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

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
