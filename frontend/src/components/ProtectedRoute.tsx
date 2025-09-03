import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: string;
  requiredPermissions?: string[]; // Require ALL permissions
  anyPermission?: string[]; // Require ANY permission
  adminOnly?: boolean;
  redirectTo?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredPermission,
  requiredPermissions,
  anyPermission,
  adminOnly = false,
  redirectTo = '/login'
}) => {
  const { user, organization, hasPermission, isLoading } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user || !organization) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // Check admin access
  if (adminOnly) {
    const isAdmin = hasPermission('org.edit') || 
                   hasPermission('users.invite') ||
                   hasPermission('org.*') ||
                   hasPermission('*');
    
    if (!isAdmin) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  // Check single permission
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // Check all required permissions
  if (requiredPermissions) {
    const hasAllPermissions = requiredPermissions.every(permission => 
      hasPermission(permission)
    );
    if (!hasAllPermissions) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  // Check any permission
  if (anyPermission) {
    const hasAnyPermission = anyPermission.some(permission => 
      hasPermission(permission)
    );
    if (!hasAnyPermission) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return <>{children}</>;
};

// Permission-specific route components
export const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ProtectedRoute adminOnly={true}>
    {children}
  </ProtectedRoute>
);

export const ProjectManagerRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ProtectedRoute anyPermission={['projects.create', 'projects.edit', 'projects.*', '*']}>
    {children}
  </ProtectedRoute>
);

export const UserManagementRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ProtectedRoute anyPermission={['users.view', 'users.invite', 'users.*', '*']}>
    {children}
  </ProtectedRoute>
);

export const TaskManagementRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ProtectedRoute anyPermission={['tasks.create', 'tasks.edit', 'tasks.*', '*']}>
    {children}
  </ProtectedRoute>
);

export default ProtectedRoute;
