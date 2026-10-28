import { apiClient } from './client.js';
import type { SystemSettingItem } from '../types/index.js';

export async function fetchSettings(): Promise<SystemSettingItem[]> {
  const res = await apiClient.get<SystemSettingItem[]>('/admin/settings');
  return res.data;
}

export async function updateSetting(
  key: string,
  value: string
): Promise<{ ok: boolean; key: string; value: string }> {
  const res = await apiClient.patch<{ ok: boolean; key: string; value: string }>(
    `/admin/settings/${encodeURIComponent(key)}`,
    { value }
  );
  return res.data;
}
