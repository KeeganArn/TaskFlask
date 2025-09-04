import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import pool from '../database/config';
import { authenticate, requireOrganizationAdmin } from '../middleware/rbac';
import { generateUniqueInviteCode, formatInviteCode, isValidInviteCodeFormat } from '../utils/invite-codes';
import {
  RegisterRequest,
  LoginRequest,
  AuthResponse,
  InviteUserRequest,
  AuthenticatedRequest
} from '../types/v2';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * POST /auth/register - Enhanced registration with organization support
 */
router.post('/register', async (req: Request<{}, {}, RegisterRequest>, res: Response) => {
  const connection = await pool.getConnection();
  await connection.beginTransaction();

  try {
    const { 
      username, 
      email, 
      password, 
      first_name, 
      last_name, 
      organization_name, 
      organization_slug,
      organization_invite_code,
      invitation_token 
    } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Username, email and password are required' });
    }

    // Check if user already exists
    const [existingUser] = await connection.execute(
      'SELECT id FROM users WHERE email = ? OR username = ?',
      [email, username]
    );

    if ((existingUser as any[]).length > 0) {
      await connection.rollback();
      return res.status(400).json({ message: 'User with this email or username already exists' });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create new user
    const [userResult] = await connection.execute(
      `INSERT INTO users (username, email, password_hash, first_name, last_name, email_verified) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [username, email, passwordHash, first_name || null, last_name || null, true]
    );

    const userId = (userResult as any).insertId;
    let organizationId: number;
    let roleId: number;

    if (organization_invite_code) {
      // User is joining existing organization with invite code
      const formattedCode = formatInviteCode(organization_invite_code);
      
      if (!isValidInviteCodeFormat(formattedCode)) {
        await connection.rollback();
        return res.status(400).json({ message: 'Invalid invite code format. Should be ABC-1234' });
      }

      const [orgResult] = await connection.execute(
        `SELECT o.id, o.name, o.invite_code_enabled, r.id as default_role_id
         FROM organizations o
         LEFT JOIN roles r ON r.organization_id = o.id AND r.name = 'member'
         WHERE o.invite_code = ? AND o.invite_code_enabled = true`,
        [formattedCode]
      );

      if ((orgResult as any[]).length === 0) {
        await connection.rollback();
        return res.status(400).json({ message: 'Invalid invite code or organization has disabled code-based invites' });
      }

      const organization = (orgResult as any[])[0];
      organizationId = organization.id;
      roleId = organization.default_role_id;

      // If no default member role exists, create one
      if (!roleId) {
        const [memberRoleResult] = await connection.execute(
          `INSERT INTO roles (name, display_name, description, permissions, is_system_role, organization_id)
           VALUES ('member', 'Team Member', 'Default role for team members', 
                   '["projects.view", "tasks.view", "tasks.create", "tasks.edit"]', true, ?)`,
          [organizationId]
        );
        roleId = (memberRoleResult as any).insertId;
        
        // Update organization to have this as default role
        await connection.execute(
          'UPDATE organizations SET default_role_id = ? WHERE id = ?',
          [roleId, organizationId]
        );
      }
    } else if (invitation_token) {
      // User is accepting an email invitation
      const [invitationResult] = await connection.execute(
        `SELECT i.organization_id, i.role_id, i.expires_at, i.accepted_at
         FROM invitations i
         WHERE i.token = ? AND i.email = ?`,
        [invitation_token, email]
      );

      if ((invitationResult as any[]).length === 0) {
        await connection.rollback();
        return res.status(400).json({ message: 'Invalid or expired invitation' });
      }

      const invitation = (invitationResult as any[])[0];

      if (invitation.accepted_at) {
        await connection.rollback();
        return res.status(400).json({ message: 'Invitation already accepted' });
      }

      if (new Date() > new Date(invitation.expires_at)) {
        await connection.rollback();
        return res.status(400).json({ message: 'Invitation has expired' });
      }

      organizationId = invitation.organization_id;
      roleId = invitation.role_id;

      // Mark invitation as accepted
      await connection.execute(
        'UPDATE invitations SET accepted_at = CURRENT_TIMESTAMP WHERE token = ?',
        [invitation_token]
      );

    } else if (organization_name && organization_slug) {
      // User is creating a new organization
      
      // Check if organization slug already exists
      const [existingOrg] = await connection.execute(
        'SELECT id FROM organizations WHERE slug = ?',
        [organization_slug]
      );

      if ((existingOrg as any[]).length > 0) {
        await connection.rollback();
        return res.status(400).json({ message: 'Organization slug already exists' });
      }

      // Generate unique invite code
      const checkInviteCodeExists = async (code: string): Promise<boolean> => {
        const [result] = await connection.execute(
          'SELECT id FROM organizations WHERE invite_code = ?',
          [code]
        );
        return (result as any[]).length > 0;
      };

      const inviteCode = await generateUniqueInviteCode(checkInviteCodeExists);

      // Create new organization with invite code
      const [orgResult] = await connection.execute(
        `INSERT INTO organizations (name, slug, invite_code, subscription_plan, max_users, max_projects) 
         VALUES (?, ?, ?, 'free', 5, 10)`,
        [organization_name, organization_slug, inviteCode]
      );

      organizationId = (orgResult as any).insertId;

      // Create system roles for new organization
      
      // 1. Create owner role
      const [ownerRoleResult] = await connection.execute(
        `INSERT INTO roles (name, display_name, description, permissions, is_system_role, organization_id)
         VALUES ('owner', 'Organization Owner', 'Full control over the organization', 
                 '["*", "users.view", "users.manage", "roles.view", "roles.manage", "projects.*", "tasks.*", "organization.manage"]', true, ?)`,
        [organizationId]
      );
      roleId = (ownerRoleResult as any).insertId;

      // 2. Create member role  
      const [memberRoleResult] = await connection.execute(
        `INSERT INTO roles (name, display_name, description, permissions, is_system_role, organization_id)
         VALUES ('member', 'Team Member', 'Default role for team members', 
                 '["projects.view", "tasks.view", "tasks.create", "tasks.edit"]', true, ?)`,
        [organizationId]
      );
      const memberRoleId = (memberRoleResult as any).insertId;
      
      // 3. Set member role as default for new joiners
      await connection.execute(
        'UPDATE organizations SET default_role_id = ? WHERE id = ?',
        [memberRoleId, organizationId]
      );

    } else {
      await connection.rollback();
      return res.status(400).json({ 
        message: 'Either provide organization_invite_code, invitation_token, or organization details to create new organization' 
      });
    }

    // Add user to organization
    await connection.execute(
      `INSERT INTO organization_members (organization_id, user_id, role_id, joined_at, status) 
       VALUES (?, ?, ?, CURRENT_TIMESTAMP, 'active')`,
      [organizationId, userId, roleId]
    );

    // Update user's organization_id field
    await connection.execute(
      `UPDATE users SET organization_id = ? WHERE id = ?`,
      [organizationId, userId]
    );

    await connection.commit();

    // Get complete user and organization data for response
    const [userData] = await connection.execute(
      `SELECT u.*, om.role_id, o.id as org_id, o.name as org_name, o.slug as org_slug, o.invite_code, o.invite_code_enabled,
              r.name as role_name, r.display_name as role_display_name, r.permissions
       FROM users u
       JOIN organization_members om ON u.id = om.user_id
       JOIN organizations o ON om.organization_id = o.id
       JOIN roles r ON om.role_id = r.id
       WHERE u.id = ? AND om.organization_id = ?`,
      [userId, organizationId]
    );

    const user = (userData as any[])[0];

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id,
        email: user.email,
        organizationId: user.org_id,
        roleId: user.role_id,
        permissions: JSON.parse(user.permissions || '[]')
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const response: AuthResponse = {
      message: 'Registration successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        avatar_url: user.avatar_url,
        phone: user.phone,
        timezone: user.timezone,
        language: user.language,
        is_active: user.is_active,
        email_verified: user.email_verified,
        last_login: user.last_login,
        created_at: user.created_at,
        updated_at: user.updated_at
      },
      organization: {
        id: user.org_id,
        name: user.org_name,
        slug: user.org_slug,
        invite_code: user.invite_code,
        invite_code_enabled: user.invite_code_enabled,
        description: '',
        logo_url: '',
        subscription_plan: 'free',
        max_users: 5,
        max_projects: 10,
        settings: {},
        created_at: '',
        updated_at: ''
      },
      membership: {
        id: 0,
        organization_id: user.org_id,
        user_id: user.id,
        role_id: user.role_id,
        invited_by: null,
        invited_at: '',
        joined_at: '',
        status: 'active',
        created_at: '',
        updated_at: ''
      },
      token,
      permissions: JSON.parse(user.permissions || '[]')
    };

    res.status(201).json(response);

  } catch (error) {
    await connection.rollback();
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    connection.release();
  }
});

/**
 * POST /auth/login - Enhanced login with organization support
 */
router.post('/login', async (req: Request<{}, {}, LoginRequest>, res: Response) => {
  try {
    const { email, password, organization_slug } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Get user with organization memberships
    const [userResult] = await pool.execute(
      `SELECT u.*, om.organization_id, om.role_id, om.status as membership_status,
              o.name as org_name, o.slug as org_slug, o.invite_code, o.invite_code_enabled,
              r.name as role_name, r.display_name as role_display_name, r.permissions
       FROM users u
       JOIN organization_members om ON u.id = om.user_id
       JOIN organizations o ON om.organization_id = o.id
       JOIN roles r ON om.role_id = r.id
       WHERE u.email = ? AND om.status = 'active'`,
      [email]
    );

    const userRecords = userResult as any[];

    if (userRecords.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const user = userRecords[0];

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Update last login and set status to online
    await pool.execute(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP, user_status = "online", last_seen = CURRENT_TIMESTAMP WHERE id = ?',
      [user.id]
    );

    // Handle organization selection
    let selectedOrg = null;

    if (organization_slug) {
      // User specified an organization
      selectedOrg = userRecords.find(record => record.org_slug === organization_slug);
      if (!selectedOrg) {
        return res.status(400).json({ message: 'You do not have access to this organization' });
      }
    } else if (userRecords.length === 1) {
      // User belongs to only one organization
      selectedOrg = userRecords[0];
    } else {
      // User belongs to multiple organizations, return list for selection
      const organizations = userRecords.map(record => ({
        id: record.organization_id,
        name: record.org_name,
        slug: record.org_slug,
        role: record.role_display_name
      }));

      return res.json({
        requireOrganizationSelection: true,
        organizations,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name
        }
      });
    }

    // Generate JWT token for selected organization
    const token = jwt.sign(
      { 
        userId: selectedOrg.id,
        email: selectedOrg.email,
        organizationId: selectedOrg.organization_id,
        roleId: selectedOrg.role_id,
        permissions: JSON.parse(selectedOrg.permissions || '[]')
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const response: AuthResponse = {
      message: 'Login successful',
      user: {
        id: selectedOrg.id,
        username: selectedOrg.username,
        email: selectedOrg.email,
        first_name: selectedOrg.first_name,
        last_name: selectedOrg.last_name,
        avatar_url: selectedOrg.avatar_url,
        phone: selectedOrg.phone,
        timezone: selectedOrg.timezone,
        language: selectedOrg.language,
        is_active: selectedOrg.is_active,
        email_verified: selectedOrg.email_verified,
        last_login: selectedOrg.last_login,
        created_at: selectedOrg.created_at,
        updated_at: selectedOrg.updated_at
      },
      organization: {
        id: selectedOrg.organization_id,
        name: selectedOrg.org_name,
        slug: selectedOrg.org_slug,
        invite_code: selectedOrg.invite_code,
        invite_code_enabled: selectedOrg.invite_code_enabled,
        description: '',
        logo_url: '',
        subscription_plan: 'free',
        max_users: 5,
        max_projects: 10,
        settings: {},
        created_at: '',
        updated_at: ''
      },
      token,
      permissions: JSON.parse(selectedOrg.permissions || '[]')
    };

    res.json(response);

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * POST /auth/invite - Invite user to organization
 */
router.post('/invite', authenticate, requireOrganizationAdmin, async (req: AuthenticatedRequest<{}, {}, InviteUserRequest>, res: Response) => {
  try {
    const { email, role_id } = req.body;
    const organizationId = req.user!.organizationId;
    const invitedBy = req.user!.userId;

    if (!email || !role_id) {
      return res.status(400).json({ message: 'Email and role_id are required' });
    }

    // Check if user already exists in organization
    const [existingMember] = await pool.execute(
      `SELECT om.id FROM organization_members om
       JOIN users u ON om.user_id = u.id
       WHERE u.email = ? AND om.organization_id = ?`,
      [email, organizationId]
    );

    if ((existingMember as any[]).length > 0) {
      return res.status(400).json({ message: 'User is already a member of this organization' });
    }

    // Check if invitation already exists
    const [existingInvitation] = await pool.execute(
      'SELECT id FROM invitations WHERE email = ? AND organization_id = ? AND accepted_at IS NULL',
      [email, organizationId]
    );

    if ((existingInvitation as any[]).length > 0) {
      return res.status(400).json({ message: 'Invitation already sent to this email' });
    }

    // Generate invitation token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

    // Create invitation
    const [result] = await pool.execute(
      `INSERT INTO invitations (email, organization_id, role_id, invited_by, token, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [email, organizationId, role_id, invitedBy, token, expiresAt]
    );

    const invitationId = (result as any).insertId;

    // Get invitation details for response
    const [invitationData] = await pool.execute(
      `SELECT i.*, o.name as org_name, r.display_name as role_name
       FROM invitations i
       JOIN organizations o ON i.organization_id = o.id
       JOIN roles r ON i.role_id = r.id
       WHERE i.id = ?`,
      [invitationId]
    );

    const invitation = (invitationData as any[])[0];

    // In a real app, you would send an email here
    // For now, return the invitation token
    res.status(201).json({
      message: 'Invitation sent successfully',
      invitation_token: token,
      invitation_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/register?token=${token}&email=${email}`,
      expires_at: expiresAt.toISOString()
    });

  } catch (error) {
    console.error('Invite error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * GET /auth/me - Get current user info
 */
router.get('/me', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const organizationId = req.user!.organization_id;

    const [userData] = await pool.execute(
      `SELECT u.*, om.role_id, o.id as org_id, o.name as org_name, o.slug as org_slug, o.invite_code, o.invite_code_enabled,
              r.name as role_name, r.display_name as role_display_name, r.permissions
       FROM users u
       JOIN organization_members om ON u.id = om.user_id
       JOIN organizations o ON om.organization_id = o.id
       JOIN roles r ON om.role_id = r.id
       WHERE u.id = ? AND om.organization_id = ?`,
      [userId, organizationId]
    );

    if ((userData as any[]).length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = (userData as any[])[0];

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        avatar_url: user.avatar_url,
        phone: user.phone,
        timezone: user.timezone,
        language: user.language,
        is_active: user.is_active,
        email_verified: user.email_verified,
        last_login: user.last_login,
        created_at: user.created_at,
        updated_at: user.updated_at
      },
      organization: {
        id: user.org_id,
        name: user.org_name,
        slug: user.org_slug,
        invite_code: user.invite_code,
        invite_code_enabled: user.invite_code_enabled,
        description: '',
        logo_url: '',
        subscription_plan: 'free',
        max_users: 5,
        max_projects: 10,
        settings: {},
        created_at: '',
        updated_at: ''
      },
      permissions: JSON.parse(user.permissions || '[]')
    });

  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * PUT /auth/status - Update user status
 */
router.put('/status', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { user_status, status_message } = req.body;
    
    // Validate status
    const validStatuses = ['online', 'busy', 'dnd', 'offline'];
    if (user_status && !validStatuses.includes(user_status)) {
      return res.status(400).json({ message: 'Invalid user status' });
    }

    const connection = await pool.getConnection();
    
    try {
      await connection.execute(
        `UPDATE users 
         SET user_status = COALESCE(?, user_status),
             status_message = COALESCE(?, status_message),
             last_seen = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [user_status || null, status_message || null, req.user!.id]
      );

      // Get updated user data
      const [rows] = await connection.execute(
        'SELECT id, username, email, first_name, last_name, user_status, status_message, last_seen FROM users WHERE id = ?',
        [req.user!.id]
      );

      const updatedUser = (rows as any[])[0];
      res.json({ 
        message: 'Status updated successfully',
        user: updatedUser
      });

    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;