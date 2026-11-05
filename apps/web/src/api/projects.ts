import { apiClient } from './client.js';
import type {
  ProjectListResponse,
  ProjectListItem,
  ProjectDetail,
  ProjectSummary,
  ProjectTaskListResponse,
  ProjectTask,
  ProjectTaskDetail,
  TaskDependencyItem,
  TaskCommentItem,
  TaskCommentListResponse,
  TaskStatus,
  CreateTaskPayload,
  PatchTaskPayload,
  ChangeTaskStatusResponse,
  ProjectMilestone,
  CreateMilestonePayload,
  PatchMilestonePayload,
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
  status?: TaskStatus;
  assigneeUserId?: string;
  milestoneId?: string;
  parentTaskId?: string;
  topLevelOnly?: boolean;
  overdue?: boolean;
}

export async function fetchProjectTasks(
  projectId: string,
  params?: ListProjectTasksParams
): Promise<ProjectTaskListResponse> {
  const queryParams = new URLSearchParams();
  if (params?.limit) queryParams.set('limit', String(params.limit));
  if (params?.cursor) queryParams.set('cursor', params.cursor);
  if (params?.status) queryParams.set('status', params.status);
  if (params?.assigneeUserId) queryParams.set('assigneeUserId', params.assigneeUserId);
  if (params?.milestoneId) queryParams.set('milestoneId', params.milestoneId);
  if (params?.parentTaskId) queryParams.set('parentTaskId', params.parentTaskId);
  if (params?.topLevelOnly !== undefined) queryParams.set('topLevelOnly', String(params.topLevelOnly));
  if (params?.overdue !== undefined) queryParams.set('overdue', String(params.overdue));

  const url = queryParams.toString()
    ? `/projects/${projectId}/tasks?${queryParams.toString()}`
    : `/projects/${projectId}/tasks`;
  const res = await apiClient.get<ProjectTaskListResponse>(url);
  return res.data;
}

export async function createTask(
  projectId: string,
  payload: CreateTaskPayload
): Promise<ProjectTask> {
  const res = await apiClient.post<ProjectTask>(`/projects/${projectId}/tasks`, payload);
  return res.data;
}

export async function changeTaskStatus(
  projectId: string,
  taskId: string,
  status: TaskStatus
): Promise<ChangeTaskStatusResponse> {
  const res = await apiClient.post<ChangeTaskStatusResponse>(
    `/projects/${projectId}/tasks/${taskId}/status`,
    { status }
  );
  return res.data;
}

export async function fetchTaskDetail(
  projectId: string,
  taskId: string
): Promise<ProjectTaskDetail> {
  const res = await apiClient.get<ProjectTaskDetail>(`/projects/${projectId}/tasks/${taskId}`);
  return res.data;
}

export async function patchTask(
  projectId: string,
  taskId: string,
  payload: PatchTaskPayload
): Promise<ProjectTask> {
  const res = await apiClient.patch<ProjectTask>(`/projects/${projectId}/tasks/${taskId}`, payload);
  return res.data;
}

export async function deleteTask(
  projectId: string,
  taskId: string
): Promise<{ ok: boolean; deletedTaskId: string }> {
  const res = await apiClient.delete<{ ok: boolean; deletedTaskId: string }>(
    `/projects/${projectId}/tasks/${taskId}`
  );
  return res.data;
}

export async function fetchProjectMilestones(
  projectId: string
): Promise<ProjectMilestone[]> {
  const res = await apiClient.get<ProjectMilestone[]>(`/projects/${projectId}/milestones`);
  return res.data;
}

/**
 * Iteratively fetches all tasks of a project using cursor pagination until hasMore is false.
 */

export async function createProjectMilestone(
  projectId: string,
  payload: CreateMilestonePayload
): Promise<ProjectMilestone> {
  const res = await apiClient.post<ProjectMilestone>(
    `/projects/${projectId}/milestones`,
    payload
  );
  return res.data;
}

export async function patchProjectMilestone(
  projectId: string,
  milestoneId: string,
  payload: PatchMilestonePayload
): Promise<ProjectMilestone> {
  const res = await apiClient.patch<ProjectMilestone>(
    `/projects/${projectId}/milestones/${milestoneId}`,
    payload
  );
  return res.data;
}

export async function completeProjectMilestone(
  projectId: string,
  milestoneId: string
): Promise<{ id: string; completedAt: string }> {
  const res = await apiClient.post<{ id: string; completedAt: string }>(
    `/projects/${projectId}/milestones/${milestoneId}/complete`
  );
  return res.data;
}

export async function reopenProjectMilestone(
  projectId: string,
  milestoneId: string
): Promise<{ id: string; completedAt: null }> {
  const res = await apiClient.post<{ id: string; completedAt: null }>(
    `/projects/${projectId}/milestones/${milestoneId}/reopen`
  );
  return res.data;
}

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

export async function addTaskDependency(
  projectId: string,
  taskId: string,
  dependsOnTaskId: string
): Promise<TaskDependencyItem> {
  const res = await apiClient.post<TaskDependencyItem>(
    `/projects/${projectId}/tasks/${taskId}/dependencies`,
    { dependsOnTaskId }
  );
  return res.data;
}

export async function removeTaskDependency(
  projectId: string,
  taskId: string,
  dependsOnTaskId: string
): Promise<{ success: boolean }> {
  const res = await apiClient.delete<{ success: boolean }>(
    `/projects/${projectId}/tasks/${taskId}/dependencies/${dependsOnTaskId}`
  );
  return res.data;
}

export interface ListTaskCommentsParams {
  limit?: number;
  cursor?: string;
}

export async function fetchTaskComments(
  projectId: string,
  taskId: string,
  params?: ListTaskCommentsParams
): Promise<TaskCommentListResponse> {
  const queryParams = new URLSearchParams();
  if (params?.limit) queryParams.set('limit', String(params.limit));
  if (params?.cursor) queryParams.set('cursor', params.cursor);

  const url = queryParams.toString()
    ? `/projects/${projectId}/tasks/${taskId}/comments?${queryParams.toString()}`
    : `/projects/${projectId}/tasks/${taskId}/comments`;
  const res = await apiClient.get<TaskCommentListResponse>(url);
  return res.data;
}

export async function createTaskComment(
  projectId: string,
  taskId: string,
  body: string
): Promise<TaskCommentItem> {
  const res = await apiClient.post<TaskCommentItem>(
    `/projects/${projectId}/tasks/${taskId}/comments`,
    { body }
  );
  return res.data;
}

export async function patchTaskComment(
  projectId: string,
  taskId: string,
  commentId: string,
  body: string
): Promise<TaskCommentItem> {
  const res = await apiClient.patch<TaskCommentItem>(
    `/projects/${projectId}/tasks/${taskId}/comments/${commentId}`,
    { body }
  );
  return res.data;
}

export async function deleteTaskComment(
  projectId: string,
  taskId: string,
  commentId: string
): Promise<{ ok: boolean; deletedCommentId: string }> {
  const res = await apiClient.delete<{ ok: boolean; deletedCommentId: string }>(
    `/projects/${projectId}/tasks/${taskId}/comments/${commentId}`
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
