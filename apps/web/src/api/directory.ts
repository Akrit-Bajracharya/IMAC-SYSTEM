import { apiClient } from './client.js';
import type { DirectoryEmployee } from '../types/index.js';

export interface FetchDirectoryParams {
  search?: string;
  department?: string;
}

export async function fetchDirectoryEmployees(
  params?: FetchDirectoryParams
): Promise<DirectoryEmployee[]> {
  const queryParams = new URLSearchParams();
  if (params?.search) queryParams.set('search', params.search);
  if (params?.department) queryParams.set('department', params.department);

  const url = queryParams.toString() ? `/employees?${queryParams.toString()}` : '/employees';
  const res = await apiClient.get<DirectoryEmployee[]>(url);
  return res.data;
}

export async function fetchEmployeeDetails(id: string): Promise<any> {
  const res = await apiClient.get(`/employees/${id}`);
  return res.data;
}
