import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import pool from '../database/config';
import { Permission, AuthenticatedRequest } from '../types/v2';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

interface JWTPayload {
  userId: number;
  email: string;
  organizationId: number;
  membershipId: number;
}

/**
 * Enhanced authentication middleware with organization context
 */
export const authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ message: 'Access token required' });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    
    // Get user details with organization membership and role
    const [userResult] = await pool.execute(`
      SELECT 
        u.id, u.username, u.email, u.first_name, u.last_name, u.is_active,
        om.id as membership_id, om.organization_id, om.status as membership_status,
        r.id as role_id, r.name as role_name, r.display_name as role_display_name, 
        r.permissions,
        o.name as organization_name, o.slug as organization_slug
      FROM users u
      INNER JOIN organization_members om ON u.id = om.user_id
      INNER JOIN roles r ON om.role_id = r.id
      INNER JOIN organizations o ON om.organization_id = o.id
      WHERE u.id = ? AND om.organization_id = ?
    `, [decoded.userId, decoded.organizationId]);

    if ((userResult as any[]).length === 0) {
      return res.status(401).json({ message: 'Invalid user or organization access' });
    }

    const userData = (userResult as any[])[0];

    // Parse permissions from JSON
    let permissions: Permission[] = [];
    try {
      permissions = JSON.parse(userData.permissions || '[]');
    } catch (error) {
      console.error('Error parsing user permissions:', error);
    }

    // Attach user context to request
    req.user = {
      id: userData.id,
      email: userData.email,
      organization_id: userData.organization_id,
      permissions,
      role: {
        id: userData.role_id,
        name: userData.role_name,
        display_name: userData.role_display_name,
        permissions,
        is_system_role: true,
        organization_id: userData.organization_id,
        created_at: '',
        updated_at: ''
      },
      membership: {
        id: userData.membership_id,
        organization_id: userData.organization_id,
        user_id: userData.id,
        role_id: userData.role_id,
        status: userData.membership_status,
        invited_at: '',
        created_at: '',
        updated_at: ''
      }
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
};

/**
 * Check if user has specific permission
 */
export const hasPermission = (userPermissions: Permission[], requiredPermission: Permission): boolean => {
  // Check for wildcard permissions
  if (userPermissions.includes('*')) {
    return true;
  }

  // Check for exact permission
  if (userPermissions.includes(requiredPermission)) {
    return true;
  }

  // Check for wildcard category permissions
  const [category] = requiredPermission.split('.');
  const wildcardPermission = `${category}.*` as Permission;
  if (userPermissions.includes(wildcardPermission)) {
    return true;
  }

  return false;
};

/**
 * Middleware to require specific permission
 */
export const requirePermission = (permission: Permission) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!hasPermission(req.user.permissions, permission)) {
      return res.status(403).json({ 
        message: 'Insufficient permissions',
        required: permission,
        userPermissions: req.user.permissions
      });
    }

    next();
  };
};

/**
 * Middleware to require any of the specified permissions
 */
export const requireAnyPermission = (permissions: Permission[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const hasAnyPermission = permissions.some(permission => 
      hasPermission(req.user!.permissions, permission)
    );

    if (!hasAnyPermission) {
      return res.status(403).json({ 
        message: 'Insufficient permissions',
        required: permissions,
        userPermissions: req.user.permissions
      });
    }

    next();
  };
};

/**
 * Middleware to check if user can access specific organization
 */
export const requireOrganizationAccess = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  const organizationId = parseInt(req.params.organizationId || req.body.organization_id);
  
  if (organizationId && organizationId !== req.user.organization_id) {
    return res.status(403).json({ message: 'Access denied to this organization' });
  }

  next();
};

/**
 * Middleware to check if user can access specific project
 */
export const requireProjectAccess = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const projectId = parseInt(req.params.projectId || req.params.id || req.body.project_id);
    
    if (!projectId) {
      return res.status(400).json({ message: 'Project ID required' });
    }

    // Check if user has access to this project
    const [projectResult] = await pool.execute(`
      SELECT p.id, p.organization_id, pm.role as project_role
      FROM projects p
      LEFT JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = ?
      WHERE p.id = ? AND p.organization_id = ?
    `, [req.user.id, projectId, req.user.organization_id]);

    if ((projectResult as any[]).length === 0) {
      return res.status(404).json({ message: 'Project not found or access denied' });
    }

    const project = (projectResult as any[])[0];

    // If user is not a project member, check if they have org-level project permissions
    if (!project.project_role) {
      if (!hasPermission(req.user.permissions, 'projects.view')) {
        return res.status(403).json({ message: 'Access denied to this project' });
      }
    }

    // Attach project info to request for further use
    (req as any).project = {
      id: project.id,
      organization_id: project.organization_id,
      user_role: project.project_role
    };

    next();
  } catch (error) {
    console.error('Project access check error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Middleware to check if user is organization owner or admin
 */
export const requireOrganizationAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  const isAdmin = hasPermission(req.user.permissions, 'org.edit') ||
                  hasPermission(req.user.permissions, 'users.invite') ||
                  hasPermission(req.user.permissions, 'users.manage') ||
                  req.user.role.name === 'owner' ||
                  req.user.role.name === 'org_owner' ||
                  req.user.role.name === 'org_admin';

  if (!isAdmin) {
    return res.status(403).json({ message: 'Organization admin access required' });
  }

  next();
};

/**
 * Middleware for resource ownership validation
 */
export const requireResourceOwnership = (resourceType: 'task' | 'project' | 'comment') => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const resourceId = parseInt(req.params.id);
      let query = '';
      let ownerField = '';

      switch (resourceType) {
        case 'task':
          query = 'SELECT reporter_id, assignee_id FROM tasks WHERE id = ? AND organization_id = ?';
          ownerField = 'reporter_id';
          break;
        case 'project':
          query = 'SELECT owner_id FROM projects WHERE id = ? AND organization_id = ?';
          ownerField = 'owner_id';
          break;
        case 'comment':
          query = 'SELECT user_id FROM task_comments WHERE id = ?';
          ownerField = 'user_id';
          break;
        default:
          return res.status(400).json({ message: 'Invalid resource type' });
      }

      const [result] = await pool.execute(query, 
        resourceType === 'comment' ? [resourceId] : [resourceId, req.user.organization_id]
      );

      if ((result as any[]).length === 0) {
        return res.status(404).json({ message: `${resourceType} not found` });
      }

      const resource = (result as any[])[0];
      const isOwner = resource[ownerField] === req.user.id;
      const isAssignee = resourceType === 'task' && resource.assignee_id === req.user.id;

      // Allow access if user is owner, assignee (for tasks), or has admin permissions
      if (isOwner || isAssignee || hasPermission(req.user.permissions, `${resourceType}s.edit` as Permission)) {
        next();
      } else {
        return res.status(403).json({ message: 'Access denied to this resource' });
      }
    } catch (error) {
      console.error('Resource ownership check error:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  };
};

/**
 * Optional authentication - sets user context if token is provided but doesn't require it
 */
export const optionalAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    // If token is provided, authenticate normally
    return authenticate(req, res, next);
  } else {
    // No token provided, continue without user context
    next();
  }
};

/**
 * Feature access middleware - checks if organization has access to a specific feature
 */
export const requireFeature = (feature: string) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user || !req.user.organization_id) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const organizationId = req.user.organization_id;

      // Base Pro features to inherit for Enterprise
      const PRO_FEATURES = [
        'time_tracking',
        'custom_branding',
        'analytics',
        'priority_support',
        'advanced_permissions'
      ];

      const augmentFeatures = (planSlug: string, rawFeatures: any): string[] => {
        let list: string[] = [];
        try {
          if (Array.isArray(rawFeatures)) list = rawFeatures as string[];
          else if (typeof rawFeatures === 'string') list = JSON.parse(rawFeatures || '[]');
        } catch {
          list = [];
        }
        if (planSlug === 'enterprise') {
          return Array.from(new Set<string>([...list, ...PRO_FEATURES]));
        }
        return list;
      };

      // Check active subscription first
      const [subscription] = await pool.execute(`
        SELECT sp.features, sp.name as plan_name, sp.slug as plan_slug
        FROM organization_subscriptions os
        JOIN subscription_plans sp ON os.plan_id = sp.id
        WHERE os.organization_id = ? AND os.status IN ('active', 'trialing')
        ORDER BY os.created_at DESC
        LIMIT 1
      `, [organizationId]);

      let currentPlanName = 'Unknown';
      let featureList: string[] = [];

      if ((subscription as any[]).length > 0) {
        const sub = (subscription as any[])[0];
        currentPlanName = sub.plan_name;
        featureList = augmentFeatures(sub.plan_slug, sub.features);
      } else {
        // Fallback to organization's subscription_plan column
        const [orgPlanRows] = await pool.execute(
          `SELECT o.subscription_plan as plan_slug, sp.features, sp.name as plan_name
           FROM organizations o
           LEFT JOIN subscription_plans sp ON sp.slug = o.subscription_plan
           WHERE o.id = ?
           LIMIT 1`,
          [organizationId]
        );
        if ((orgPlanRows as any[]).length === 0) {
          return res.status(403).json({ message: 'No subscription context found', feature_required: feature });
        }
        const row = (orgPlanRows as any[])[0];
        currentPlanName = row.plan_name || row.plan_slug;
        featureList = augmentFeatures(row.plan_slug, row.features || '[]');
      }

      if (!featureList.includes(feature)) {
        return res.status(403).json({ 
          message: `Feature '${feature}' not available in your current plan`,
          current_plan: currentPlanName,
          feature_required: feature
        });
      }

      next();
    } catch (error) {
      console.error('Feature access check error:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  };
};

export default {
  authenticate,
  hasPermission,
  requirePermission,
  requireAnyPermission,
  requireOrganizationAccess,
  requireProjectAccess,
  requireOrganizationAdmin,
  requireResourceOwnership,
  requireFeature,
  optionalAuth
};
