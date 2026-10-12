import { useAuth } from '../../hooks/useAuth.js';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Spinner } from './Spinner.js';
import { UnauthorizedPage } from '../../pages/errors/UnauthorizedPage.js';
import type { SystemRole } from '../../types/index.js';

interface ProtectedRouteProps {
  allowedRoles?: SystemRole[];
  requirePasswordChanged?: boolean;
}

export function ProtectedRoute({
  allowedRoles,
  requirePasswordChanged = true,
}: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <Spinner />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (requirePasswordChanged && user.mustChangePassword)
    return <Navigate to="/change-password" replace />;
  if (allowedRoles && !allowedRoles.includes(user.systemRole))
    return <UnauthorizedPage />;

  return <Outlet />;
}
