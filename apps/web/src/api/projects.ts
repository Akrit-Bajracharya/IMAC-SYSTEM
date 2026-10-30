import { apiClient } from './client.js';
import type {
  ProjectListResponse,
  ProjectListItem,
  ProjectDetail,
  ProjectSummary,
  ProjectTaskListResponse,
  ProjectTask,
  CreateProjectPayload,
  PatchProjectPayload,
  ChangeProjectStatusPayload,
  AddProjectMemberPayload,
  ProjectMember,
} from '../types/index.js';

export interface ListProjectsParams {
  limit?: number;
  cursor?: string;
}

export async function fetchProjects(
  params?: ListProjectsParams
): Promise<ProjectListResponse> {
  const queryParams = new URLSearchParams();
  if (params?.limit) queryParams.set('limit', String(params.limit));
  if (params?.cursor) queryParams.set('cursor', params.cursor);

  const url = queryParams.toString() ? `/projects?${queryParams.toString()}` : '/projects';
  const res = await apiClient.get<ProjectListResponse>(url);
  return res.data;
}

/**
 * Iteratively fetches all pages of projects using cursor pagination until hasMore is false.
 */
export async function fetchAllAccessibleProjects(): Promise<ProjectListItem[]> {
  const allProjects: ProjectListItem[] = [];
  let currentCursor: string | undefined = undefined;
  let hasMore = true;

  while (hasMore) {
    const page: ProjectListResponse = await fetchProjects({
      limit: 100,
      cursor: currentCursor,
    });
    allProjects.push(...page.items);
    hasMore = page.hasMore && !!page.nextCursor;
    currentCursor = page.nextCursor ?? undefined;
  }

  return allProjects;
}

export async function fetchProjectById(id: string): Promise<ProjectDetail> {
  const res = await apiClient.get<ProjectDetail>(`/projects/${id}`);
  return res.data;
}

export async function createProject(
  payload: CreateProjectPayload
): Promise<ProjectDetail> {
  const res = await apiClient.post<ProjectDetail>('/projects', payload);
  return res.data;
}

export async function updateProject(
  id: string,
  payload: PatchProjectPayload
): Promise<ProjectDetail> {
  const res = await apiClient.patch<ProjectDetail>(`/projects/${id}`, payload);
  return res.data;
}

export async function changeProjectStatus(
  id: string,
  payload: ChangeProjectStatusPayload
): Promise<{ ok: boolean; statusEvent: any }> {
  const res = await apiClient.post<{ ok: boolean; statusEvent: any }>(
    `/projects/${id}/status`,
    payload
  );
  return res.data;
}

export async function fetchProjectSummary(id: string): Promise<ProjectSummary> {
  const res = await apiClient.get<ProjectSummary>(`/projects/${id}/summary`);
  return res.data;
}

export interface ListProjectTasksParams {
  limit?: number;
  cursor?: string;
  status?: string;
  topLevelOnly?: boolean;
}

export async function fetchProjectTasks(
  projectId: string,
  params?: ListProjectTasksParams
): Promise<ProjectTaskListResponse> {
  const queryParams = new URLSearchParams();
  if (params?.limit) queryParams.set('limit', String(params.limit));
  if (params?.cursor) queryParams.set('cursor', params.cursor);
  if (params?.status) queryParams.set('status', params.status);
  if (params?.topLevelOnly !== undefined) queryParams.set('topLevelOnly', String(params.topLevelOnly));

  const url = queryParams.toString()
    ? `/projects/${projectId}/tasks?${queryParams.toString()}`
    : `/projects/${projectId}/tasks`;
  const res = await apiClient.get<ProjectTaskListResponse>(url);
  return res.data;
}

/**
 * Iteratively fetches all tasks of a project using cursor pagination until hasMore is false.
 */
export async function fetchAllTasksForProject(
  projectId: string
): Promise<ProjectTask[]> {
  const allTasks: ProjectTask[] = [];
  let currentCursor: string | undefined = undefined;
  let hasMore = true;

  while (hasMore) {
    const page: ProjectTaskListResponse = await fetchProjectTasks(projectId, {
      limit: 100,
      cursor: currentCursor,
    });
    allTasks.push(...page.items);
    hasMore = page.hasMore && !!page.nextCursor;
    currentCursor = page.nextCursor ?? undefined;
  }

  return allTasks;
}

export async function addProjectMember(
  projectId: string,
  payload: AddProjectMemberPayload
): Promise<ProjectMember> {
  const res = await apiClient.post<ProjectMember>(
    `/projects/${projectId}/members`,
    payload
  );
  return res.data;
}

export async function removeProjectMember(
  projectId: string,
  userId: string
): Promise<{ success: boolean }> {
  const res = await apiClient.delete<{ success: boolean }>(
    `/projects/${projectId}/members/${userId}`
  );
  return res.data;
}

export function getProjectErrorInfo(err: any): {
  status: number;
  error: string;
  message: string;
  details?: any;
} {
  const status = err?.response?.status ?? 500;
  const data = err?.response?.data;
  const error = data?.error ?? 'unknown_error';
  const message = data?.message ?? err?.message ?? 'An unexpected error occurred';
  const details = data?.details;

  return { status, error, message, details };
}
