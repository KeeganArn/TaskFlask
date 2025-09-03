import { Router, Request, Response } from 'express';
import pool from '../database/config';
import { 
  authenticate, 
  requirePermission,
  requireOrganizationAdmin 
} from '../middleware/rbac';
import { 
  CreateOrganizationRequest, 
  UpdateOrganizationRequest,
  CreateRoleRequest,
  UpdateRoleRequest,
  AuthenticatedRequest 
} from '../types/v2';

const router = Router();

/**
 * GET /organizations/current - Get current organization details
 */
router.get('/current', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [rows] = await pool.execute(`
      SELECT 
        o.*,
        COUNT(DISTINCT om.user_id) as member_count,
        COUNT(DISTINCT p.id) as project_count,
        COUNT(DISTINCT t.id) as task_count
      FROM organizations o
      LEFT JOIN organization_members om ON o.id = om.organization_id AND om.status = 'active'
      LEFT JOIN projects p ON o.id = p.organization_id
      LEFT JOIN tasks t ON o.id = t.organization_id
      WHERE o.id = ?
      GROUP BY o.id
    `, [req.user!.organization_id]);
    
    if ((rows as any[]).length === 0) {
      return res.status(404).json({ message: 'Organization not found' });
    }
    
    const org = (rows as any[])[0];
    
    res.json({
      ...org,
      settings: org.settings ? JSON.parse(org.settings) : {},
      stats: {
        member_count: parseInt(org.member_count),
        project_count: parseInt(org.project_count),
        task_count: parseInt(org.task_count)
      }
    });
    
  } catch (error) {
    console.error('Error fetching organization:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * PUT /organizations/current - Update current organization
 */
router.put('/current', 
  authenticate, 
  requireOrganizationAdmin,
  async (req: AuthenticatedRequest<{}, {}, UpdateOrganizationRequest>, res: Response) => {
  try {
    const { name, description, logo_url, settings } = req.body;
    
    const [result] = await pool.execute(
      `UPDATE organizations 
       SET name = COALESCE(?, name),
           description = COALESCE(?, description),
           logo_url = COALESCE(?, logo_url),
           settings = COALESCE(?, settings),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [name, description, logo_url, settings ? JSON.stringify(settings) : null, req.user!.organization_id]
    );
    
    if ((result as any).affectedRows === 0) {
      return res.status(404).json({ message: 'Organization not found' });
    }
    
    // Get updated organization
    const [updated] = await pool.execute(
      'SELECT * FROM organizations WHERE id = ?',
      [req.user!.organization_id]
    );
    
    const org = (updated as any[])[0];
    res.json({
      ...org,
      settings: org.settings ? JSON.parse(org.settings) : {}
    });
    
  } catch (error) {
    console.error('Error updating organization:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * GET /organizations/members - Get organization members
 */
router.get('/members', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status = 'active', role_name, search } = req.query;
    
    let query = `
      SELECT 
        om.*,
        u.username, u.email, u.first_name, u.last_name, u.avatar_url, u.last_login, u.is_active,
        u.user_status, u.status_message, u.last_seen, u.organization_id,
        r.name as role_name, r.display_name as role_display_name, r.permissions,
        inviter.username as invited_by_username
      FROM organization_members om
      INNER JOIN users u ON om.user_id = u.id
      INNER JOIN roles r ON om.role_id = r.id
      LEFT JOIN users inviter ON om.invited_by = inviter.id
      WHERE om.organization_id = ?
    `;
    
    const params: any[] = [req.user!.organization_id];
    
    if (status) {
      query += ' AND om.status = ?';
      params.push(status);
    }
    
    if (role_name) {
      query += ' AND r.name = ?';
      params.push(role_name);
    }
    
    if (search) {
      query += ' AND (u.username LIKE ? OR u.email LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    
    query += ' ORDER BY om.joined_at DESC';
    
    const [rows] = await pool.execute(query, params);
    
    const members = (rows as any[]).map(row => ({
      id: row.id,
      user_id: row.user_id,
      organization_id: row.organization_id,
      role_id: row.role_id,
      status: row.status,
      invited_at: row.invited_at,
      joined_at: row.joined_at,
      user: {
        id: row.user_id,
        username: row.username,
        email: row.email,
        first_name: row.first_name,
        last_name: row.last_name,
        avatar_url: row.avatar_url,
        last_login: row.last_login,
        is_active: row.is_active
      },
      role: {
        id: row.role_id,
        name: row.role_name,
        display_name: row.role_display_name,
        permissions: row.permissions ? JSON.parse(row.permissions) : []
      },
      invited_by: row.invited_by ? {
        username: row.invited_by_username
      } : null
    }));
    
    res.json(members);
    
  } catch (error) {
    console.error('Error fetching organization members:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * PUT /organizations/members/:userId/role - Update member role
 */
router.put('/members/:userId/role', 
  authenticate, 
  requireOrganizationAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { role_id } = req.body;
    
    if (!role_id) {
      return res.status(400).json({ message: 'role_id is required' });
    }
    
    // Verify role exists and belongs to organization
    const [roleCheck] = await pool.execute(
      'SELECT id FROM roles WHERE id = ? AND (organization_id = ? OR is_system_role = TRUE)',
      [role_id, req.user!.organization_id]
    );
    
    if ((roleCheck as any[]).length === 0) {
      return res.status(400).json({ message: 'Invalid role' });
    }
    
    const [result] = await pool.execute(
      'UPDATE organization_members SET role_id = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND organization_id = ?',
      [role_id, userId, req.user!.organization_id]
    );
    
    if ((result as any).affectedRows === 0) {
      return res.status(404).json({ message: 'Member not found' });
    }
    
    res.json({ message: 'Member role updated successfully' });
    
  } catch (error) {
    console.error('Error updating member role:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * PUT /organizations/members/:userId/status - Update member status
 */
router.put('/members/:userId/status', 
  authenticate, 
  requireOrganizationAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { status } = req.body;
    
    if (!['active', 'suspended', 'left'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    
    const [result] = await pool.execute(
      'UPDATE organization_members SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND organization_id = ?',
      [status, userId, req.user!.organization_id]
    );
    
    if ((result as any).affectedRows === 0) {
      return res.status(404).json({ message: 'Member not found' });
    }
    
    res.json({ message: 'Member status updated successfully' });
    
  } catch (error) {
    console.error('Error updating member status:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * DELETE /organizations/members/:userId - Remove member from organization
 */
router.delete('/members/:userId', 
  authenticate, 
  requireOrganizationAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;
    
    // Can't remove yourself
    if (parseInt(userId) === req.user!.id) {
      return res.status(400).json({ message: 'Cannot remove yourself from organization' });
    }
    
    const [result] = await pool.execute(
      'DELETE FROM organization_members WHERE user_id = ? AND organization_id = ?',
      [userId, req.user!.organization_id]
    );
    
    if ((result as any).affectedRows === 0) {
      return res.status(404).json({ message: 'Member not found' });
    }
    
    res.status(204).send();
    
  } catch (error) {
    console.error('Error removing member:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * GET /organizations/roles - Get organization roles
 */
router.get('/roles', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // First check if organization has default roles, create them if missing
    const [existingRoles] = await pool.execute(
      'SELECT COUNT(*) as role_count FROM roles WHERE organization_id = ?',
      [req.user!.organization_id]
    );
    
    const roleCount = (existingRoles as any[])[0].role_count;
    
    // If no roles exist, create default owner and member roles
    if (roleCount === 0) {
      console.log(`Creating default roles for organization ${req.user!.organization_id}`);
      
      // Create owner role
      await pool.execute(
        `INSERT INTO roles (name, display_name, description, permissions, is_system_role, organization_id)
         VALUES ('owner', 'Organization Owner', 'Full control over the organization', 
                 '["*", "users.view", "users.manage", "roles.view", "roles.manage", "projects.*", "tasks.*", "organization.manage"]', true, ?)`,
        [req.user!.organization_id]
      );
      
      // Create member role
      const [memberRoleResult] = await pool.execute(
        `INSERT INTO roles (name, display_name, description, permissions, is_system_role, organization_id)
         VALUES ('member', 'Team Member', 'Default role for team members', 
                 '["projects.view", "tasks.view", "tasks.create", "tasks.edit"]', true, ?)`,
        [req.user!.organization_id]
      );
      
      const memberRoleId = (memberRoleResult as any).insertId;
      
      // Set member role as default
      await pool.execute(
        'UPDATE organizations SET default_role_id = ? WHERE id = ?',
        [memberRoleId, req.user!.organization_id]
      );
    }

    // Now fetch all roles
    const [rows] = await pool.execute(`
      SELECT r.*, COUNT(om.id) as member_count
      FROM roles r
      LEFT JOIN organization_members om ON r.id = om.role_id AND om.organization_id = ?
      WHERE r.organization_id = ? OR r.is_system_role = TRUE
      GROUP BY r.id
      ORDER BY r.is_system_role DESC, r.created_at ASC
    `, [req.user!.organization_id, req.user!.organization_id]);
    
    const roles = (rows as any[]).map(row => ({
      ...row,
      permissions: row.permissions ? JSON.parse(row.permissions) : [],
      member_count: parseInt(row.member_count)
    }));
    
    res.json(roles);
    
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * POST /organizations/roles - Create custom role
 */
router.post('/roles', 
  authenticate, 
  requirePermission('roles.create'),
  async (req: AuthenticatedRequest<{}, {}, CreateRoleRequest>, res: Response) => {
  try {
    const { name, display_name, description, permissions } = req.body;
    
    if (!name || !display_name || !permissions) {
      return res.status(400).json({ message: 'name, display_name, and permissions are required' });
    }
    
    // Check if role name already exists in this organization
    const [existing] = await pool.execute(
      'SELECT id FROM roles WHERE name = ? AND (organization_id = ? OR is_system_role = TRUE)',
      [name, req.user!.organization_id]
    );
    
    if ((existing as any[]).length > 0) {
      return res.status(400).json({ message: 'Role name already exists' });
    }
    
    const [result] = await pool.execute(
      'INSERT INTO roles (name, display_name, description, permissions, organization_id) VALUES (?, ?, ?, ?, ?)',
      [name, display_name, description, JSON.stringify(permissions), req.user!.organization_id]
    );
    
    // Get created role
    const [created] = await pool.execute(
      'SELECT * FROM roles WHERE id = ?',
      [(result as any).insertId]
    );
    
    const role = (created as any[])[0];
    res.status(201).json({
      ...role,
      permissions: JSON.parse(role.permissions)
    });
    
  } catch (error) {
    console.error('Error creating role:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * PUT /organizations/roles/:id - Update custom role
 */
router.put('/roles/:id', 
  authenticate, 
  requirePermission('roles.edit'),
  async (req: AuthenticatedRequest<{ id: string }, {}, UpdateRoleRequest>, res: Response) => {
  try {
    const { id } = req.params;
    const { display_name, description, permissions } = req.body;
    
    // Verify role belongs to organization and is not a system role
    const [roleCheck] = await pool.execute(
      'SELECT id, is_system_role FROM roles WHERE id = ? AND organization_id = ?',
      [id, req.user!.organization_id]
    );
    
    if ((roleCheck as any[]).length === 0) {
      return res.status(404).json({ message: 'Role not found' });
    }
    
    const role = (roleCheck as any[])[0];
    if (role.is_system_role) {
      return res.status(400).json({ message: 'Cannot edit system roles' });
    }
    
    const [result] = await pool.execute(
      `UPDATE roles 
       SET display_name = COALESCE(?, display_name),
           description = COALESCE(?, description),
           permissions = COALESCE(?, permissions),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [display_name, description, permissions ? JSON.stringify(permissions) : null, id]
    );
    
    // Get updated role
    const [updated] = await pool.execute(
      'SELECT * FROM roles WHERE id = ?',
      [id]
    );
    
    const updatedRole = (updated as any[])[0];
    res.json({
      ...updatedRole,
      permissions: JSON.parse(updatedRole.permissions)
    });
    
  } catch (error) {
    console.error('Error updating role:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * DELETE /organizations/roles/:id - Delete custom role
 */
router.delete('/roles/:id', 
  authenticate, 
  requirePermission('roles.delete'),
  async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    // Verify role belongs to organization and is not a system role
    const [roleCheck] = await pool.execute(
      'SELECT id, is_system_role FROM roles WHERE id = ? AND organization_id = ?',
      [id, req.user!.organization_id]
    );
    
    if ((roleCheck as any[]).length === 0) {
      return res.status(404).json({ message: 'Role not found' });
    }
    
    const role = (roleCheck as any[])[0];
    if (role.is_system_role) {
      return res.status(400).json({ message: 'Cannot delete system roles' });
    }
    
    // Check if role is in use
    const [usage] = await pool.execute(
      'SELECT COUNT(*) as count FROM organization_members WHERE role_id = ?',
      [id]
    );
    
    if ((usage as any[])[0].count > 0) {
      return res.status(400).json({ message: 'Cannot delete role that is currently assigned to members' });
    }
    
    await pool.execute('DELETE FROM roles WHERE id = ?', [id]);
    
    res.status(204).send();
    
  } catch (error) {
    console.error('Error deleting role:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * GET /organizations/invitations - Get pending invitations
 */
router.get('/invitations', authenticate, requireOrganizationAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [rows] = await pool.execute(`
      SELECT 
        i.*,
        r.display_name as role_display_name,
        inviter.username as invited_by_username
      FROM invitations i
      INNER JOIN roles r ON i.role_id = r.id
      INNER JOIN users inviter ON i.invited_by = inviter.id
      WHERE i.organization_id = ? AND i.accepted_at IS NULL
      ORDER BY i.created_at DESC
    `, [req.user!.organization_id]);
    
    const invitations = (rows as any[]).map(row => ({
      ...row,
      role: {
        id: row.role_id,
        display_name: row.role_display_name
      },
      invited_by: {
        username: row.invited_by_username
      },
      is_expired: new Date() > new Date(row.expires_at)
    }));
    
    res.json(invitations);
    
  } catch (error) {
    console.error('Error fetching invitations:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * DELETE /organizations/invitations/:id - Cancel invitation
 */
router.delete('/invitations/:id', 
  authenticate, 
  requireOrganizationAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    const [result] = await pool.execute(
      'DELETE FROM invitations WHERE id = ? AND organization_id = ? AND accepted_at IS NULL',
      [id, req.user!.organization_id]
    );
    
    if ((result as any).affectedRows === 0) {
      return res.status(404).json({ message: 'Invitation not found' });
    }
    
    res.status(204).send();
    
  } catch (error) {
    console.error('Error canceling invitation:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
