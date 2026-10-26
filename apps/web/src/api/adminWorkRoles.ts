import { apiClient } from './client.js';
import type { WorkRole, EmployeeWorkRoleAssignment } from '../types/index.js';

export interface CreateWorkRoleInput {
  name: string;
  description?: string;
}

export interface UpdateWorkRoleInput {
  name?: string;
  description?: string;
  isActive?: boolean;
}

export async function fetchWorkRoles(): Promise<WorkRole[]> {
  const res = await apiClient.get<WorkRole[]>('/admin/work-roles');
  return res.data;
}

export async function fetchWorkRole(id: string): Promise<WorkRole> {
  const res = await apiClient.get<WorkRole>(`/admin/work-roles/${id}`);
  return res.data;
}

export async function createWorkRole(
  data: CreateWorkRoleInput
): Promise<{ workRole: WorkRole }> {
  const res = await apiClient.post<{ workRole: WorkRole }>('/admin/work-roles', data);
  return res.data;
}

export async function updateWorkRole(
  id: string,
  data: UpdateWorkRoleInput
): Promise<{ workRole: WorkRole }> {
  const res = await apiClient.patch<{ workRole: WorkRole }>(
    `/admin/work-roles/${id}`,
    data
  );
  return res.data;
}

export async function deactivateWorkRole(id: string): Promise<{ ok: boolean }> {
  const res = await apiClient.patch<{ ok: boolean }>(
    `/admin/work-roles/${id}/deactivate`
  );
  return res.data;
}

export async function fetchEmployeeWorkRoles(
  employeeId: string
): Promise<{ employeeProfileId: string; workRoles: WorkRole[] }> {
  const res = await apiClient.get<{ employeeProfileId: string; workRoles: WorkRole[] }>(
    `/admin/work-roles/employees/${employeeId}/work-roles`
  );
  return res.data;
}

export async function assignWorkRoleToEmployee(
  employeeId: string,
  workRoleId: string
): Promise<{ assignment: EmployeeWorkRoleAssignment }> {
  const res = await apiClient.post<{ assignment: EmployeeWorkRoleAssignment }>(
    `/admin/work-roles/employees/${employeeId}/work-roles`,
    { workRoleId }
  );
  return res.data;
}

export async function removeWorkRoleFromEmployee(
  employeeId: string,
  workRoleId: string
): Promise<{ ok: boolean }> {
  const res = await apiClient.delete<{ ok: boolean }>(
    `/admin/work-roles/employees/${employeeId}/work-roles/${workRoleId}`
  );
  return res.data;
}
