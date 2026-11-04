/**
 * Minimal typed API client for the LUNATIC backend.
 * Access token is held in memory + localStorage; refresh token in localStorage.
 * On a 401 it attempts a single refresh before failing.
 */
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? 'http://localhost:4000/api';

const ACCESS_KEY = 'lunatic.access';
const REFRESH_KEY = 'lunatic.refresh';

export const tokenStore = {
  get access() {
    if (typeof window === 'undefined') return null;
    try {
      return localStorage.getItem(ACCESS_KEY);
    } catch {
      return null;
    }
  },
  get refresh() {
    if (typeof window === 'undefined') return null;
    try {
      return localStorage.getItem(REFRESH_KEY);
    } catch {
      return null;
    }
  },
  set(access: string, refresh: string) {
    try {
      localStorage.setItem(ACCESS_KEY, access);
      localStorage.setItem(REFRESH_KEY, refresh);
    } catch {
      /* storage unavailable (private mode) — tokens live only in this tab */
    }
  },
  clear() {
    try {
      localStorage.removeItem(ACCESS_KEY);
      localStorage.removeItem(REFRESH_KEY);
    } catch {
      /* ignore */
    }
  },
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
  }
}

async function raw<T>(path: string, init: RequestInit, withAuth: boolean): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json');
  if (withAuth && tokenStore.access) headers.set('authorization', `Bearer ${tokenStore.access}`);

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  const text = await res.text();
  const body = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    const message = (body && (body.message || body.error)) || `Request failed (${res.status})`;
    throw new ApiError(res.status, Array.isArray(message) ? message.join(', ') : message, body);
  }
  return body as T;
}

async function tryRefresh(): Promise<boolean> {
  const refresh = tokenStore.refresh;
  if (!refresh) return false;
  try {
    const data = await raw<{ accessToken: string; refreshToken: string }>(
      '/auth/refresh',
      { method: 'POST', body: JSON.stringify({ refreshToken: refresh }) },
      false,
    );
    tokenStore.set(data.accessToken, data.refreshToken);
    return true;
  } catch {
    tokenStore.clear();
    return false;
  }
}

export async function api<T>(path: string, init: RequestInit = {}, withAuth = true): Promise<T> {
  try {
    return await raw<T>(path, init, withAuth);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401 && withAuth && (await tryRefresh())) {
      return raw<T>(path, init, withAuth);
    }
    throw err;
  }
}

// ─── Typed endpoints ───
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}
export interface Me {
  user: { id: string; email: string; displayName: string | null; mfaEnabled: boolean; lastLoginAt: string | null };
  org: { id: string; name: string; slug: string } | null;
  permissions: string[];
}
export interface DashboardStats {
  missions: { total: number; running: number; completed: number };
  vulnerabilities: {
    discovered: number;
    confirmed: number;
    pending: number;
    falsePositive: number;
    bySeverity: { state: string; _count: { _all: number } }[];
  };
  commandsExecuted: number;
  aiTokens: number;
  sandboxes: { status: string; count: number }[];
  recentActivity: { id: string; action: string; target: string | null; createdAt: string }[];
  recentMissions: { id: string; name: string; status: string; mode: string; updatedAt: string }[];
}

export const auth = {
  login: (email: string, password: string, totp?: string) =>
    api<TokenPair>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password, totp }) }, false),
  register: (payload: { email: string; password: string; displayName?: string; organizationName?: string }) =>
    api<TokenPair>('/auth/register', { method: 'POST', body: JSON.stringify(payload) }, false),
  logout: (refreshToken: string) =>
    api('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) }, false),
};

export const platform = {
  me: () => api<Me>('/me'),
  dashboard: () => api<DashboardStats>('/dashboard/stats'),
};
