import { apiClient } from './client.js';
import type { AuthUser } from '../types/index.js';

export async function fetchCsrfToken(): Promise<string> {
  const res = await apiClient.get<{ csrfToken: string }>('/auth/csrf');
  return res.data.csrfToken;
}

export async function login(username: string, password: string): Promise<AuthUser> {
  const res = await apiClient.post<{ user: AuthUser }>('/auth/login', { username, password });
  return res.data.user;
}

export async function logout(): Promise<void> {
  await apiClient.post('/auth/logout');
}

export async function fetchMe(): Promise<AuthUser | null> {
  try {
    const res = await apiClient.get<{ user: AuthUser }>('/auth/me');
    return res.data.user;
  } catch {
    return null;
  }
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await apiClient.post('/auth/change-password', { currentPassword, newPassword });
}
