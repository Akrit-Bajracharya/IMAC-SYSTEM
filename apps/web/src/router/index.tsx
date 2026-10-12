import { createBrowserRouter, Navigate } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth.js';
import { Spinner } from '../components/layout/Spinner.js';
import { ProtectedRoute } from '../components/layout/ProtectedRoute.js';
import { AdminLayout } from '../components/layout/AdminLayout.js';
import { EmployeeLayout } from '../components/layout/EmployeeLayout.js';

import { LoginPage } from '../pages/auth/LoginPage.js';
import { ChangePasswordPage } from '../pages/auth/ChangePasswordPage.js';
import { AdminDashboardPage } from '../pages/dashboard/AdminDashboardPage.js';
import { EmployeeDashboardPage } from '../pages/dashboard/EmployeeDashboardPage.js';
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
                path: '*',
                element: <AdminDashboardPage />,
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
                path: '*',
                element: <EmployeeDashboardPage />,
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
