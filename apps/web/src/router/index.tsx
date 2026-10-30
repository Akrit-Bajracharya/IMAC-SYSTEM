import { createBrowserRouter, Navigate, useParams } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth.js';
import { Spinner } from '../components/layout/Spinner.js';
import { ProtectedRoute } from '../components/layout/ProtectedRoute.js';
import { AdminLayout } from '../components/layout/AdminLayout.js';
import { EmployeeLayout } from '../components/layout/EmployeeLayout.js';

import { LoginPage } from '../pages/auth/LoginPage.js';
import { ChangePasswordPage } from '../pages/auth/ChangePasswordPage.js';
import { AdminDashboardPage } from '../pages/dashboard/AdminDashboardPage.js';
import { EmployeeDashboardPage } from '../pages/dashboard/EmployeeDashboardPage.js';
import { UsersListPage } from '../pages/admin/UsersListPage.js';
import { WorkRolesPage } from '../pages/admin/WorkRolesPage.js';
import { EmployeeWorkRolesPage } from '../pages/admin/EmployeeWorkRolesPage.js';
import { WorkLogSettingsPage } from '../pages/admin/WorkLogSettingsPage.js';
import { DirectoryPage } from '../pages/directory/DirectoryPage.js';
import { ProjectListPage } from '../pages/projects/ProjectListPage.js';
import { ProjectDetailPage } from '../pages/projects/ProjectDetailPage.js';
import { DailyWorkLogPage } from '../pages/workLogs/DailyWorkLogPage.js';
import { WorkLogHistoryPage } from '../pages/workLogs/WorkLogHistoryPage.js';
import { WorkLogExportPage } from '../pages/workLogs/WorkLogExportPage.js';
import { NotFoundPage } from '../pages/errors/NotFoundPage.js';

function RootRedirect() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (['system_admin', 'hr_admin'].includes(user.systemRole)) {
    return <Navigate to="/admin" replace />;
  }
  return <Navigate to="/employee" replace />;
}

function RoleBasedDashboard() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (['system_admin', 'hr_admin'].includes(user.systemRole)) {
    return <AdminDashboardPage />;
  }
  return <EmployeeDashboardPage />;
}

function WorkLogRedirect({ subpath = '' }: { subpath?: string }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  const base = ['system_admin', 'hr_admin'].includes(user.systemRole)
    ? '/admin/work-log'
    : '/employee/work-log';
  const target = subpath ? `${base}/${subpath}` : base;
  return <Navigate to={target} replace />;
}


function ProjectsRedirect({ subpath = '' }: { subpath?: string }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  const base = ['system_admin', 'hr_admin'].includes(user.systemRole)
    ? '/admin/projects'
    : '/employee/projects';
  const target = subpath ? `${base}/${subpath}` : base;
  return <Navigate to={target} replace />;
}

function ProjectParamRedirect() {
  const { id } = useParams<{ id: string }>();
  return <ProjectsRedirect subpath={id} />;
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    element: <ProtectedRoute requirePasswordChanged={false} />,
    children: [
      {
        path: '/change-password',
        element: <ChangePasswordPage />,
      },
    ],
  },
  {
    path: '/',
    element: <ProtectedRoute requirePasswordChanged={true} />,
    children: [
      {
        index: true,
        element: <RootRedirect />,
      },
      {
        path: 'dashboard',
        element: <RoleBasedDashboard />,
      },
      {
        path: 'work-log',
        element: <WorkLogRedirect />,
      },
      {
        path: 'work-log/history',
        element: <WorkLogRedirect subpath="history" />,
      },
      {
        path: 'work-log/export',
        element: <WorkLogRedirect subpath="export" />,
      },
      {
        path: 'admin',
        element: (
          <ProtectedRoute allowedRoles={['system_admin', 'hr_admin']} />
        ),
        children: [
          {
            element: <AdminLayout />,
            children: [
              {
                index: true,
                element: <AdminDashboardPage />,
              },
              {
                path: 'users',
                element: <UsersListPage />,
              },
              {
                path: 'users/:userId/work-roles',
                element: <EmployeeWorkRolesPage />,
              },
              {
                path: 'work-roles',
                element: <WorkRolesPage />,
              },
              {
                path: 'work-roles/assign/:userId',
                element: <EmployeeWorkRolesPage />,
              },
              {
                path: 'directory',
                element: <DirectoryPage />,
              },
              {
                path: 'work-log',
                element: <DailyWorkLogPage />,
              },
              {
                path: 'work-log/history',
                element: <WorkLogHistoryPage />,
              },
              {
                path: 'work-log/export',
                element: <WorkLogExportPage />,
              },
              {
                path: 'settings',
                element: <ProtectedRoute allowedRoles={['system_admin']} />,
                children: [
                  {
                    index: true,
                    element: <WorkLogSettingsPage />,
                  },
                ],
              },
              {
                path: '*',
                element: <NotFoundPage />,
              },
            ],
          },
        ],
      },
      {
        path: 'employee',
        element: (
          <ProtectedRoute
            allowedRoles={['employee', 'project_manager', 'viewer']}
          />
        ),
        children: [
          {
            element: <EmployeeLayout />,
            children: [
              {
                index: true,
                element: <EmployeeDashboardPage />,
              },
              {
                path: 'directory',
                element: <DirectoryPage />,
              },
              {
                path: 'work-log',
                element: <DailyWorkLogPage />,
              },
              {
                path: 'work-log/history',
                element: <WorkLogHistoryPage />,
              },
              {
                path: 'work-log/export',
                element: <WorkLogExportPage />,
              },
              {
                path: '*',
                element: <NotFoundPage />,
              },
            ],
          },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);
