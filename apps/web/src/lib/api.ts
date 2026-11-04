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

// ─── Missions / workspace ───
export type MissionStatus =
  | 'DRAFT'
  | 'SCOPING'
  | 'PLANNING'
  | 'RUNNING'
  | 'PAUSED'
  | 'AWAITING_APPROVAL'
  | 'COMPLETED'
  | 'FAILED'
  | 'ARCHIVED';

export interface Mission {
  id: string;
  name: string;
  description: string | null;
  status: MissionStatus;
  mode: 'CHAT' | 'AGENT';
  permissionMode: 'APPROVAL' | 'SUPERVISED' | 'AUTONOMOUS';
  agentProfile: 'STANDARD' | 'PRO' | 'MAX';
  emergencyStop: boolean;
  updatedAt: string;
  createdAt: string;
  scopeEntries?: ScopeEntry[];
  _count?: { messages?: number; findings?: number; scopeEntries?: number; toolRuns?: number; sandboxes?: number };
}
export interface ScopeEntry {
  id: string;
  type: 'host' | 'ip' | 'cidr';
  value: string;
  note: string | null;
}
export interface MissionMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}
export interface ScopeDecision {
  allowed: boolean;
  code: string;
  reason: string;
  matched?: { type: string; value: string };
  resolvedIps?: string[];
}

// ─── AI providers ───
export interface AiProvider {
  id: string;
  kind: string;
  label: string;
  baseUrl: string | null;
  state: string;
  models: { id: string; name: string; displayName: string | null; enabled: boolean }[];
  keyLastFour: string | null;
}
export interface ProviderTestResult {
  ok: boolean;
  model?: string;
  usage?: { inputTokens: number; outputTokens: number };
  error?: string;
}

export const ai = {
  status: () => api<{ configured: boolean }>('/ai/status'),
  providers: () => api<AiProvider[]>('/ai/providers'),
  addProvider: (payload: {
    kind: string;
    label: string;
    baseUrl?: string;
    apiKey?: string;
    defaultModel: string;
  }) => api<AiProvider>('/ai/providers', { method: 'POST', body: JSON.stringify(payload) }),
  testProvider: (id: string) => api<ProviderTestResult>(`/ai/providers/${id}/test`, { method: 'POST' }),
  removeProvider: (id: string) => api(`/ai/providers/${id}`, { method: 'DELETE' }),
};

export const missions = {
  list: () => api<Mission[]>('/missions'),
  get: (id: string) => api<Mission>(`/missions/${id}`),
  create: (payload: Partial<Pick<Mission, 'name' | 'description' | 'mode' | 'permissionMode' | 'agentProfile'>>) =>
    api<Mission>('/missions', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id: string, payload: Record<string, unknown>) =>
    api<Mission>(`/missions/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  transition: (id: string, to: MissionStatus) =>
    api<Mission>(`/missions/${id}/transition`, { method: 'POST', body: JSON.stringify({ to }) }),
  emergencyStop: (id: string, on: boolean) =>
    api<Mission>(`/missions/${id}/emergency-stop`, { method: on ? 'POST' : 'DELETE' }),
  addScope: (id: string, entry: { type: string; value: string; note?: string }) =>
    api<ScopeEntry>(`/missions/${id}/scope`, { method: 'POST', body: JSON.stringify(entry) }),
  removeScope: (id: string, entryId: string) =>
    api(`/missions/${id}/scope/${entryId}`, { method: 'DELETE' }),
  scopeCheck: (id: string, target: string, active = true, allowPrivateRanges = false) =>
    api<ScopeDecision>(`/missions/${id}/scope/check`, {
      method: 'POST',
      body: JSON.stringify({ target, active, allowPrivateRanges }),
    }),
  messages: (id: string) => api<MissionMessage[]>(`/missions/${id}/messages`),
  postMessage: (id: string, content: string) =>
    api<{ userMessage: MissionMessage; systemNotice: MissionMessage | null; aiStatus: string }>(
      `/missions/${id}/messages`,
      { method: 'POST', body: JSON.stringify({ content }) },
    ),
};

// ─── Agent orchestration ───
export interface PlanStep {
  index: number;
  title: string;
  action: 'scope_verify' | 'dns_recon' | 'tool';
  target: string;
  tool?: string;
  rationale: string;
  risk: 'low' | 'medium' | 'high';
}
export interface Execution {
  id: string;
  stepIndex: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'BLOCKED';
  summary: string | null;
  scopeDecision?: { code: string; reason: string; resolvedIps?: string[] } | null;
  toolRuns?: { id: string; tool: string; command: string; status: string; outputs?: { stream: string; content: string }[] }[];
}
export interface Finding {
  id: string;
  title: string;
  description: string | null;
  state: string;
  severity: string;
  evidence: { id: string; kind: string; summary: string | null; hash: string }[];
}

export const agent = {
  plan: (id: string) => api<{ steps: PlanStep[]; executions: Execution[] }>(`/missions/${id}/agent/plan`, { method: 'POST' }),
  getPlan: (id: string) => api<{ steps: PlanStep[] } | null>(`/missions/${id}/agent/plan`),
  executions: (id: string) => api<Execution[]>(`/missions/${id}/agent/executions`),
  approve: (id: string, execId: string, approved: boolean) =>
    api<Execution>(`/missions/${id}/agent/executions/${execId}/approve`, { method: 'POST', body: JSON.stringify({ approved }) }),
  advance: (id: string) => api<{ status: string; message?: string; action?: string; result?: unknown }>(`/missions/${id}/agent/advance`, { method: 'POST' }),
  run: (id: string) => api<unknown[]>(`/missions/${id}/agent/run`, { method: 'POST' }),
  findings: (id: string) => api<Finding[]>(`/missions/${id}/agent/findings`),
  verifyEvidence: (id: string) => api<{ count: number; valid: boolean; brokenAtIndex?: number }>(`/missions/${id}/agent/evidence/verify`),
};
