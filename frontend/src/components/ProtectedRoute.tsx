import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { subscriptionsApi } from '../services/api';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: string;
  requiredPermissions?: string[]; // Require ALL permissions
  anyPermission?: string[]; // Require ANY permission
  adminOnly?: boolean;
  redirectTo?: string;
  requiredPlanSlug?: 'pro' | 'enterprise';
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredPermission,
  requiredPermissions,
  anyPermission,
  adminOnly = false,
  redirectTo = '/login',
  requiredPlanSlug
}) => {
  const { user, organization, hasPermission, isLoading } = useAuth();
  const location = useLocation();
  const [planSlug, setPlanSlug] = useState<string | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<boolean>(!!requiredPlanSlug);
  const isOrgOwner = hasPermission('org.*') || hasPermission('*');

  useEffect(() => {
    // Org owners bypass plan checks
    if (!requiredPlanSlug || isOrgOwner) {
      setLoadingPlan(false);
      return;
    }
    let mounted = true;
    (async () => {
      try {
        const sub = await subscriptionsApi.getCurrentSubscription();
        if (mounted) setPlanSlug(sub?.plan_slug || 'free');
      } catch {
        if (mounted) setPlanSlug('free');
      } finally {
        if (mounted) setLoadingPlan(false);
      }
    })();
    return () => { mounted = false; };
  }, [requiredPlanSlug, isOrgOwner]);

  // Show loading spinner while checking auth
  if (isLoading || loadingPlan) {
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

  // Check plan requirement (e.g., hide for Basic/free)
  if (requiredPlanSlug && !isOrgOwner) {
    const current = planSlug || 'free';
    const satisfies = requiredPlanSlug === 'pro' ? (current === 'pro' || current === 'enterprise') : (current === 'enterprise');
    if (!satisfies) {
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
