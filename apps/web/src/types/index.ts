export type SystemRole = 'system_admin' | 'hr_admin' | 'project_manager' | 'employee' | 'viewer';

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  systemRole: SystemRole;
  mustChangePassword: boolean;
}

export interface ApiError {
  error: string;
  message: string;
  details?: unknown[];
}
