export type SystemRole = 'system_admin' | 'hr_admin' | 'project_manager' | 'employee' | 'viewer';

export type AvailabilityStatusType =
  | 'available'
  | 'busy_in_meeting'
  | 'out_of_office'
  | 'on_leave'
  | 'working_remotely';

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  systemRole: SystemRole;
  mustChangePassword: boolean;
}

export interface EmployeeProfile {
  id: string;
  userId: string;
  employeeCode: string;
  department: string | null;
  jobTitle: string | null;
  startDate: string | null;
  standardShiftHours: number;
  workingDaysPerWeek: number;
  managerUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUser {
  id: string;
  username: string;
  displayName: string;
  systemRole: SystemRole;
  isActive: boolean;
  mustChangePassword: boolean;
  failedLoginCount: number;
  lockedUntil: string | null;
  createdAt: string;
  updatedAt: string;
  employeeProfile?: EmployeeProfile | null;
}

export interface WorkRole {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeWorkRoleAssignment {
  id: string;
  employeeProfileId: string;
  workRoleId: string;
  createdAt: string;
  workRole: WorkRole;
}

export interface DirectoryEmployee {
  id: string; // canonical userId
  profileId?: string;
  displayName: string;
  department: string | null;
  jobTitle: string | null;
  availability: AvailabilityStatusType | string;
  availabilityMessage?: string | null;
  // Extended fields for privileged roles (system_admin, hr_admin)
  username?: string;
  systemRole?: SystemRole;
  isActive?: boolean;
  employeeCode?: string | null;
  startDate?: string | null;
  standardShiftHours?: number;
  workingDaysPerWeek?: number;
  managerUserId?: string | null;
  createdAt?: string;
}

export interface ApiError {
  error: string;
  message: string;
  details?: unknown[];
}
