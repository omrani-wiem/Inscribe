import { FeedbackRecord } from './types';

// Même machine que la page, port 8080 (permet aussi de tester depuis un téléphone)
export const API_URL = `http://${window.location.hostname}:8080`;

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`API ${res.status} sur ${path}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const api = {
  listFeedback: () => request<FeedbackRecord[]>('/feedback'),
  createFeedback: (r: FeedbackRecord) =>
    request<FeedbackRecord>('/feedback', { method: 'POST', body: JSON.stringify(r) }),
  updateFeedback: (r: FeedbackRecord) =>
    request<FeedbackRecord>(`/feedback/${r.id}`, { method: 'PUT', body: JSON.stringify(r) }),
  deleteFeedback: (id: string) => request<void>(`/feedback/${id}`, { method: 'DELETE' }),
  getSettings: () => request<Record<string, unknown>>('/settings'),
  saveSettings: (s: unknown) =>
    request<unknown>('/settings', { method: 'PUT', body: JSON.stringify(s) }),
};