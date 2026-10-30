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

export type WorkLogStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

export interface WorkLogEntry {
  id: string;
  workLogDayId: string;
  workRoleId: string;
  hours: number;
  description: string | null;
  projectId: string | null;
  taskId: string | null;
  projectName?: string | null;
  taskTitle?: string | null;
  createdAt: string;
  updatedAt: string;
  workRole?: WorkRole;
}

export interface WorkLogDay {
  id: string;
  employeeProfileId: string;
  date: string;
  status: WorkLogStatus;
  submittedAt: string | null;
  approvedAt: string | null;
  approvedByUserId: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  entries: WorkLogEntry[];
}

export interface WorkLogDayResponse {
  ok?: boolean;
  workLog: WorkLogDay | null;
  totalHours: number;
  standardShiftHours: number;
  warnings: string[];
}

export interface WorkLogsListResponse {
  workLogs: WorkLogDay[];
  standardShiftHours: number;
  warnings: string[];
}

export interface UpsertWorkLogDraftPayload {
  date: string;
  entries: {
    workRoleId: string;
    hours: number;
    description?: string | null;
    projectId?: string | null;
    taskId?: string | null;
  }[];
}

export interface PatchWorkLogPayload {
  entries: {
    workRoleId: string;
    hours: number;
    description?: string | null;
    projectId?: string | null;
    taskId?: string | null;
  }[];
}

export interface WorkLogExportParams {
  startDate: string;
  endDate: string;
  status?: string;
  employee?: string;
  team?: string;
  workRoleId?: string;
  projectId?: string;
}

export interface SystemSettingItem {
  key: string;
  value: string;
  description: string | null;
  updatedAt: string;
  updatedBy: string;
}

export type ProjectStatus = 'on_track' | 'at_risk' | 'off_track' | 'on_hold' | 'complete';
export type ProjectRole = 'manager' | 'member' | 'viewer';

export interface ProjectMemberUser {
  id: string;
  displayName: string;
  username: string;
  systemRole?: SystemRole;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  projectRole: ProjectRole;
  addedByUserId: string;
  createdAt: string;
  updatedAt: string;
  user?: ProjectMemberUser;
}

export interface ProjectListItem {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  startDate: string | null;
  targetDate: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
}

export interface ProjectListResponse {
  items: ProjectListItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface ProjectDetail {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  startDate: string | null;
  targetDate: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  members: ProjectMember[];
  memberCount: number;
}

export interface ProjectSummary {
  status: ProjectStatus;
  progress: {
    percentage: number;
    totalTasks: number;
    completedTasks: number;
    strategy: string;
  };
  taskCounts: {
    todo: number;
    in_progress: number;
    blocked: number;
    done: number;
  };
  overdueCount: number;
  blockedCount: number;
  hours: {
    estimated: number;
    logged: number;
  };
  upcomingMilestones: {
    id: string;
    name: string;
    dueDate: string | null;
  }[];
}

export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface ProjectTask {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority?: TaskPriority;
  dueDate: string | null;
  estimatedHours: number | null;
  assigneeUserId: string | null;
  milestoneId: string | null;
  parentTaskId: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  assigneeIsProjectMember?: boolean;
  milestone?: { id: string; name: string } | null;
  assigneeUser?: { id: string; displayName: string; username: string } | null;
}

export interface ProjectTaskListResponse {
  items: ProjectTask[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface CreateProjectPayload {
  name: string;
  description?: string | null;
  startDate?: string | null;
  targetDate?: string | null;
}

export interface PatchProjectPayload {
  name?: string;
  description?: string | null;
  startDate?: string | null;
  targetDate?: string | null;
}

export interface ChangeProjectStatusPayload {
  status: ProjectStatus;
  reason: string;
}

export interface AddProjectMemberPayload {
  userId: string;
  projectRole: ProjectRole;
}
