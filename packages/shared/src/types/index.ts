export const SystemRole = {
  SYSTEM_ADMIN: 'system_admin',
  HR_ADMIN: 'hr_admin',
  PROJECT_MANAGER: 'project_manager',
  EMPLOYEE: 'employee',
  VIEWER: 'viewer',
} as const;
export type SystemRole = typeof SystemRole[keyof typeof SystemRole];

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  systemRole: SystemRole;
  mustChangePassword: boolean;
}

export type ApiError = {
  error: string;
  message: string;
  details?: unknown[];
};
