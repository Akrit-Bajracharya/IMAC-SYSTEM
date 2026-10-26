import { apiClient } from './client.js';
import type { AdminUser, EmployeeProfile, SystemRole } from '../types/index.js';

export interface CreateAdminUserInput {
  username: string;
  displayName: string;
  systemRole: SystemRole;
  employeeCode?: string;
  department?: string;
  jobTitle?: string;
  startDate?: string;
  standardShiftHours?: number;
  workingDaysPerWeek?: number;
  managerUserId?: string;
}

export interface UpdateEmployeeProfileInput {
  department?: string;
  jobTitle?: string;
  startDate?: string | null;
  standardShiftHours?: number;
  workingDaysPerWeek?: number;
  employeeCode?: string;
  managerUserId?: string | null;
}

export async function fetchAdminUsers(): Promise<AdminUser[]> {
  const res = await apiClient.get<AdminUser[]>('/admin/users');
  return res.data;
}

export async function fetchAdminUser(id: string): Promise<AdminUser> {
  const res = await apiClient.get<AdminUser>(`/admin/users/${id}`);
  return res.data;
}

export async function createAdminUser(
  data: CreateAdminUserInput
): Promise<{ user: AdminUser; temporaryPassword: string }> {
  const res = await apiClient.post<{ user: AdminUser; temporaryPassword: string }>(
    '/admin/users',
    data
  );
  return res.data;
}

export async function deactivateUser(id: string): Promise<{ ok: boolean }> {
  const res = await apiClient.patch<{ ok: boolean }>(`/admin/users/${id}/deactivate`);
  return res.data;
}

export async function reactivateUser(id: string): Promise<{ ok: boolean }> {
  const res = await apiClient.patch<{ ok: boolean }>(`/admin/users/${id}/reactivate`);
  return res.data;
}

export async function resetUserPassword(
  id: string
): Promise<{ temporaryPassword: string }> {
  const res = await apiClient.post<{ temporaryPassword: string }>(
    `/admin/users/${id}/reset-password`
  );
  return res.data;
}

export async function updateUserRole(
  id: string,
  systemRole: SystemRole
): Promise<{ ok: boolean }> {
  const res = await apiClient.patch<{ ok: boolean }>(`/admin/users/${id}/role`, {
    systemRole,
  });
  return res.data;
}

export async function updateEmployeeProfile(
  id: string,
  profile: UpdateEmployeeProfileInput
): Promise<{ employeeProfile: EmployeeProfile }> {
  const res = await apiClient.patch<{ employeeProfile: EmployeeProfile }>(
    `/admin/users/${id}/profile`,
    profile
  );
  return res.data;
}
