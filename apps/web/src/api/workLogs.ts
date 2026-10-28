import { apiClient } from './client.js';
import type {
  WorkRole,
  WorkLogDayResponse,
  WorkLogsListResponse,
  UpsertWorkLogDraftPayload,
  PatchWorkLogPayload,
  WorkLogExportParams,
} from '../types/index.js';

/**
 * Fetch assigned active work roles for the current user.
 * GET /api/work-roles/my-roles
 */
export async function fetchMyWorkRoles(): Promise<WorkRole[]> {
  const res = await apiClient.get<WorkRole[]>('/work-roles/my-roles');
  return res.data;
}

/**
 * Fetch daily work log by calendar date (YYYY-MM-DD).
 * GET /api/work-logs/by-date?date=YYYY-MM-DD
 */
export async function fetchWorkLogByDate(date: string): Promise<WorkLogDayResponse> {
  const res = await apiClient.get<WorkLogDayResponse>('/work-logs/by-date', {
    params: { date },
  });
  return res.data;
}

/**
 * Fetch 7-day span of work logs starting on startDate (YYYY-MM-DD).
 * GET /api/work-logs/by-week?startDate=YYYY-MM-DD
 */
export async function fetchWorkLogsByWeek(startDate: string): Promise<WorkLogsListResponse> {
  const res = await apiClient.get<WorkLogsListResponse>('/work-logs/by-week', {
    params: { startDate },
  });
  return res.data;
}

/**
 * Fetch calendar month of work logs by year and month number.
 * GET /api/work-logs/by-month?year=YYYY&month=MM
 */
export async function fetchWorkLogsByMonth(
  year: number,
  month: number
): Promise<WorkLogsListResponse> {
  const res = await apiClient.get<WorkLogsListResponse>('/work-logs/by-month', {
    params: { year, month },
  });
  return res.data;
}

/**
 * Fetch single work log by day ID.
 * GET /api/work-logs/:id
 */
export async function fetchWorkLogById(id: string): Promise<WorkLogDayResponse> {
  const res = await apiClient.get<WorkLogDayResponse>(`/work-logs/${id}`);
  return res.data;
}

/**
 * Create or replace draft work log for a date.
 * POST /api/work-logs
 */
export async function saveWorkLogDraft(
  payload: UpsertWorkLogDraftPayload
): Promise<WorkLogDayResponse> {
  const res = await apiClient.post<WorkLogDayResponse>('/work-logs', payload);
  return res.data;
}

/**
 * Replace entries of an existing work log day.
 * PATCH /api/work-logs/:id
 */
export async function patchWorkLog(
  id: string,
  payload: PatchWorkLogPayload
): Promise<WorkLogDayResponse> {
  const res = await apiClient.patch<WorkLogDayResponse>(`/work-logs/${id}`, payload);
  return res.data;
}

/**
 * Conditionally submit a draft work log.
 * POST /api/work-logs/:id/submit
 */
export async function submitWorkLog(id: string): Promise<WorkLogDayResponse> {
  const res = await apiClient.post<WorkLogDayResponse>(`/work-logs/${id}/submit`);
  return res.data;
}

/**
 * Download Excel (.xlsx) export of work logs.
 * GET /api/work-logs/export
 */
export async function downloadWorkLogsExport(params: WorkLogExportParams): Promise<void> {
  const res = await apiClient.get('/work-logs/export', {
    params,
    responseType: 'blob',
  });

  const blob = new Blob([res.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `work-logs-export-${params.startDate}-to-${params.endDate}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

/**
 * Extracts error code and human-readable message from API error response.
 */
export function getWorkLogErrorInfo(error: any): {
  code: string;
  message?: string;
  status?: number;
} {
  const status = error?.response?.status;
  const data = error?.response?.data;
  const code = data?.error || (status === 403 ? 'forbidden' : status === 404 ? 'not_found' : 'unknown_error');
  const message = data?.message;
  return { code, message, status };
}
