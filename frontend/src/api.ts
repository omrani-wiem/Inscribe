import { FeedbackRecord } from './types';

// Même machine que la page, port 8080 (permet aussi de tester depuis un téléphone)
import.meta.env.DEV
// Dev : backend sur le port 8080. Production : même adresse que la page (nginx fait le proxy).
export const API_URL = import.meta.env.DEV ? `http://${window.location.hostname}:8080` : '';
const TOKEN_KEY = 'inkscribe_token';
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

export type AuthResult =
  | { status: 'OK'; token: string; email: string; shopName: string; shopId: string }
  | { status: 'VERIFY_EMAIL'; email: string }
  | { status: 'MFA_REQUIRED'; mfaToken: string };

export interface Me { email: string; shopName: string; shopId: string; totpEnabled: boolean }

// Routes d'authentification qui n'ont pas besoin de jeton : un 401 y est un message, pas une session expirée
const PUBLIC_AUTH = ['/auth/login', '/auth/register', '/auth/verify-email', '/auth/resend-code', '/auth/forgot', '/auth/reset'];

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const text = await res.text();

  if (res.status === 401 && !PUBLIC_AUTH.some(p => path.startsWith(p))) {
    if (getToken()) {
      clearToken();
      window.dispatchEvent(new Event('inkscribe:logout'));
    }
    throw new Error('Session expirée, reconnectez-vous.');
  }
  if (!res.ok) {
    let msg = `Erreur ${res.status}`;
    try { msg = JSON.parse(text).error || msg; } catch { /* pas de JSON */ }
    throw new Error(msg);
  }
  return (text ? JSON.parse(text) : undefined) as T;
}

const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });

export const api = {
  listFeedback: () => request<FeedbackRecord[]>('/feedback'),
  createFeedback: (r: FeedbackRecord) => post<FeedbackRecord>('/feedback', r),
  updateFeedback: (r: FeedbackRecord) =>
    request<FeedbackRecord>(`/feedback/${r.id}`, { method: 'PUT', body: JSON.stringify(r) }),
  deleteFeedback: (id: string) => request<void>(`/feedback/${id}`, { method: 'DELETE' }),
  getSettings: () => request<Record<string, unknown>>('/settings'),
  saveSettings: (s: unknown) =>
    request<unknown>('/settings', { method: 'PUT', body: JSON.stringify(s) }),

  register: (email: string, password: string, shopName: string) =>
    post<AuthResult>('/auth/register', { email, password, shopName }),
  login: (email: string, password: string) => post<AuthResult>('/auth/login', { email, password }),
  login2fa: (mfaToken: string, code: string) => post<AuthResult>('/auth/login/2fa', { mfaToken, code }),
  verifyEmail: (email: string, code: string) => post<AuthResult>('/auth/verify-email', { email, code }),
  resendCode: (email: string) => post<void>('/auth/resend-code', { email }),
  forgot: (email: string) => post<void>('/auth/forgot', { email }),
  resetPassword: (email: string, code: string, newPassword: string) =>
    post<void>('/auth/reset', { email, code, newPassword }),
  me: () => request<Me>('/auth/me'),

  twoFaSetup: () => post<{ secret: string; otpauthUri: string }>('/auth/2fa/setup'),
  twoFaEnable: (code: string) => post<void>('/auth/2fa/enable', { code }),
  twoFaDisable: (password: string, code: string) => post<void>('/auth/2fa/disable', { password, code }),

  analyzeText: (text: string) => post<Omit<FeedbackRecord, 'id' | 'timestamp'>>('/ai/analyze-text', { text }),
  analyzeImage: (image: string) => post<Omit<FeedbackRecord, 'id' | 'timestamp'>>('/ai/analyze-image', { image }),
  reply: (text: string, sentiment: string) => post<{ reply: string }>('/ai/reply', { text, sentiment }),
};