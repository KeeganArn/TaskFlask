import { Router } from 'express';
import pool from '../database/config';
import { sendTicketEmail, sendTicketWebhook } from '../services/notifications';
import { authenticate, optionalAuth, requireAnyPermission, requirePlanIn, getOrganizationPlanSlug } from '../middleware/rbac';
import { authenticateClient, ClientAuthenticatedRequest } from '../middleware/clientAuth';

const router = Router();

// List ticket types (org)
router.get('/types', authenticate, requireAnyPermission(['tasks.view', 'projects.view', 'tickets.view' as any]), async (req: any, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM ticket_types WHERE organization_id = ? AND is_active = true ORDER BY created_at DESC', [req.user!.organization_id]);
    res.json(rows);
  } catch (error) {
    console.error('List ticket types error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create ticket type (enforce plan limits: pro=5, enterprise=10)
router.post('/types', authenticate, requirePlanIn(['pro', 'enterprise']), requireAnyPermission(['tasks.edit', 'projects.edit', 'tickets.manage' as any]), async (req: any, res) => {
  try {
    const { key_slug, display_name, description } = req.body;
    if (!key_slug || !display_name) return res.status(400).json({ message: 'key_slug and display_name required' });

    const plan = await getOrganizationPlanSlug(req.user!.organization_id);
    const limit = plan === 'enterprise' ? 10 : 5;

    const [countRows] = await pool.execute('SELECT COUNT(*) as cnt FROM ticket_types WHERE organization_id = ? AND is_active = true', [req.user!.organization_id]);
    const current = (countRows as any[])[0].cnt as number;
    if (current >= limit) {
      return res.status(403).json({ message: `Ticket type limit reached (${limit}) for your plan` });
    }

    const [result] = await pool.execute(
      `INSERT INTO ticket_types (organization_id, key_slug, display_name, description, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [req.user!.organization_id, key_slug, display_name, description || null, req.user!.id]
    );
    const id = (result as any).insertId;
    const [rows] = await pool.execute('SELECT * FROM ticket_types WHERE id = ?', [id]);
    res.status(201).json((rows as any[])[0]);
  } catch (error) {
    console.error('Create ticket type error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Seed default ticket types based on plan limits
router.post('/types/seed', authenticate, requirePlanIn(['pro', 'enterprise']), requireAnyPermission(['tasks.edit', 'tickets.manage' as any]), async (req: any, res) => {
  try {
    const plan = await getOrganizationPlanSlug(req.user!.organization_id);
    const limit = plan === 'enterprise' ? 10 : 5;

    const presets: Array<{ key_slug: string; display_name: string; description?: string }> = req.body?.presets || (
      plan === 'enterprise' ? [
        { key_slug: 'dev', display_name: 'Development' },
        { key_slug: 'cs', display_name: 'Customer Service' },
        { key_slug: 'onboard', display_name: 'New Client Onboarding' },
        { key_slug: 'bug', display_name: 'Bug' },
        { key_slug: 'feature', display_name: 'Feature Request' },
        { key_slug: 'billing', display_name: 'Billing' },
        { key_slug: 'security', display_name: 'Security' },
        { key_slug: 'ops', display_name: 'Operations' },
        { key_slug: 'sales', display_name: 'Sales' },
        { key_slug: 'other', display_name: 'Other' }
      ] : [
        { key_slug: 'dev', display_name: 'Development' },
        { key_slug: 'cs', display_name: 'Customer Service' },
        { key_slug: 'onboard', display_name: 'New Client Onboarding' },
        { key_slug: 'bug', display_name: 'Bug' },
        { key_slug: 'feature', display_name: 'Feature Request' }
      ]
    );

    const [countRows] = await pool.execute('SELECT COUNT(*) as cnt FROM ticket_types WHERE organization_id = ? AND is_active = true', [req.user!.organization_id]);
    let current = (countRows as any[])[0].cnt as number;
    const created: any[] = [];

    for (const p of presets) {
      if (current >= limit) break;
      try {
        const [result] = await pool.execute(
          `INSERT IGNORE INTO ticket_types (organization_id, key_slug, display_name, description, created_by)
           VALUES (?, ?, ?, ?, ?)`,
          [req.user!.organization_id, p.key_slug, p.display_name, p.description || null, req.user!.id]
        );
        const insertId = (result as any).insertId;
        if (insertId) {
          const [row] = await pool.execute('SELECT * FROM ticket_types WHERE id = ?', [insertId]);
          created.push((row as any[])[0]);
          current += 1;
        }
      } catch { /* ignore dup errors */ }
    }

    res.json({ message: 'Seed complete', created });
  } catch (error) {
    console.error('Seed ticket types error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update ticket type
router.put('/types/:id', authenticate, requireAnyPermission(['tasks.edit', 'projects.edit', 'tickets.manage' as any]), async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const { key_slug, display_name, description, is_active } = req.body;
    await pool.execute(
      `UPDATE ticket_types SET
        key_slug = COALESCE(?, key_slug),
        display_name = COALESCE(?, display_name),
        description = COALESCE(?, description),
        is_active = COALESCE(?, is_active)
       WHERE id = ? AND organization_id = ?`,
      [key_slug || null, display_name || null, description || null, typeof is_active === 'boolean' ? is_active : null, id, req.user!.organization_id]
    );
    const [rows] = await pool.execute('SELECT * FROM ticket_types WHERE id = ? AND organization_id = ?', [id, req.user!.organization_id]);
    if ((rows as any[]).length === 0) return res.status(404).json({ message: 'Ticket type not found' });
    res.json((rows as any[])[0]);
  } catch (error) {
    console.error('Update ticket type error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// List tickets (org users)
router.get('/', authenticate, requireAnyPermission(['tasks.view', 'tickets.view' as any]), async (req: any, res) => {
  try {
    const { status, priority, type_id, search, page = 1, limit = 50, label } = req.query as any;
    const p = Math.max(parseInt(page || '1'), 1);
    const l = Math.min(Math.max(parseInt(limit || '50'), 1), 100);
    const offset = (p - 1) * l;

    const conditions = ['t.organization_id = ?'];
    const params: any[] = [req.user!.organization_id];
    if (status) { conditions.push('t.status = ?'); params.push(status); }
    if (priority) { conditions.push('t.priority = ?'); params.push(priority); }
    if (type_id) { conditions.push('t.ticket_type_id = ?'); params.push(type_id); }
    if (search) { conditions.push('(t.title LIKE ? OR t.description LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
    if (label) { conditions.push('JSON_CONTAINS(t.labels, JSON_QUOTE(?))'); params.push(label); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const [rows] = await pool.execute(
      `SELECT t.*, tt.key_slug, tt.display_name as type_name
       FROM tickets t
       JOIN ticket_types tt ON t.ticket_type_id = tt.id
       ${where}
       ORDER BY t.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, l, offset]
    );
    res.json(rows);
  } catch (error) {
    console.error('List tickets error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get single ticket with comments
router.get('/:id', authenticate, requireAnyPermission(['tasks.view', 'tickets.view' as any]), async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const [rows] = await pool.execute(
      `SELECT t.*, tt.key_slug, tt.display_name as type_name
       FROM tickets t
       JOIN ticket_types tt ON t.ticket_type_id = tt.id
       WHERE t.id = ? AND t.organization_id = ?`,
      [id, req.user!.organization_id]
    );
    if ((rows as any[]).length === 0) return res.status(404).json({ message: 'Ticket not found' });
    const ticket = (rows as any[])[0];
    const [comments] = await pool.execute(
      `SELECT * FROM ticket_comments WHERE ticket_id = ? ORDER BY created_at ASC`,
      [id]
    );
    res.json({ ticket, comments });
  } catch (error) {
    console.error('Get ticket error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Client: list own tickets
router.get('/client', authenticateClient, async (req: ClientAuthenticatedRequest, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT t.*, tt.key_slug, tt.display_name as type_name
       FROM tickets t
       JOIN ticket_types tt ON t.ticket_type_id = tt.id
       WHERE t.organization_id = ? AND t.created_by_client_user_id = ?
       ORDER BY t.created_at DESC`,
      [req.client!.organization_id, req.client!.id]
    );
    res.json(rows);
  } catch (error) {
    console.error('Client list tickets error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create ticket (org user)
router.post('/', authenticate, requireAnyPermission(['tasks.create', 'tickets.create' as any]), async (req: any, res) => {
  try {
    const { ticket_type_id, title, description, priority, assigned_user_id } = req.body;
    if (!ticket_type_id || !title) return res.status(400).json({ message: 'ticket_type_id and title required' });
    // Default assignee from type if not provided
    let assignedId = assigned_user_id || null;
    if (!assignedId) {
      const [tt] = await pool.execute('SELECT default_assignee_id FROM ticket_types WHERE id = ? AND organization_id = ?', [ticket_type_id, req.user!.organization_id]);
      if ((tt as any[]).length) assignedId = (tt as any[])[0].default_assignee_id || null;
    }
    const [result] = await pool.execute(
      `INSERT INTO tickets (organization_id, ticket_type_id, title, description, priority, created_by_user_id, assigned_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.user!.organization_id, ticket_type_id, title, description || null, priority || 'medium', req.user!.id, assignedId]
    );
    const id = (result as any).insertId;
    const [rows] = await pool.execute('SELECT * FROM tickets WHERE id = ?', [id]);
    const created = (rows as any[])[0];
    // Notify
    await sendTicketEmail('ticket.created', { organization_id: req.user!.organization_id, ticket: created });
    await sendTicketWebhook('ticket.created', { organization_id: req.user!.organization_id, ticket: created });
    res.status(201).json(created);
  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update ticket (org user)
router.put('/:id', authenticate, requireAnyPermission(['tasks.edit', 'tickets.edit' as any]), async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const { title, description, status, priority, assigned_user_id, labels, sla_minutes, due_at } = req.body;
    await pool.execute(
      `UPDATE tickets SET
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        status = COALESCE(?, status),
        priority = COALESCE(?, priority),
        assigned_user_id = COALESCE(?, assigned_user_id),
        labels = COALESCE(?, labels),
        sla_minutes = COALESCE(?, sla_minutes),
        due_at = COALESCE(?, due_at)
       WHERE id = ? AND organization_id = ?`,
      [title || null, description || null, status || null, priority || null, typeof assigned_user_id === 'number' ? assigned_user_id : null, labels ? JSON.stringify(labels) : null, typeof sla_minutes === 'number' ? sla_minutes : null, due_at || null, id, req.user!.organization_id]
    );
    const [rows] = await pool.execute('SELECT * FROM tickets WHERE id = ? AND organization_id = ?', [id, req.user!.organization_id]);
    if ((rows as any[]).length === 0) return res.status(404).json({ message: 'Ticket not found' });
    const updated = (rows as any[])[0];
    await sendTicketEmail('ticket.updated', { organization_id: req.user!.organization_id, ticket: updated });
    await sendTicketWebhook('ticket.updated', { organization_id: req.user!.organization_id, ticket: updated });
    res.json(updated);
  } catch (error) {
    console.error('Update ticket error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Comments (org user)
router.post('/:id/comments', authenticate, requireAnyPermission(['tasks.comment', 'tickets.comment' as any]), async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const { comment } = req.body;
    if (!comment) return res.status(400).json({ message: 'comment required' });
    const [result] = await pool.execute(
      `INSERT INTO ticket_comments (ticket_id, author_user_id, comment)
       VALUES (?, ?, ?)`,
      [id, req.user!.id, comment]
    );
    const cid = (result as any).insertId;
    const [rows] = await pool.execute('SELECT * FROM ticket_comments WHERE id = ?', [cid]);
    await sendTicketEmail('ticket.commented', { organization_id: req.user!.organization_id, ticket_id: id, comment: rows[0] });
    await sendTicketWebhook('ticket.commented', { organization_id: req.user!.organization_id, ticket_id: id, comment: rows[0] });
    res.status(201).json((rows as any[])[0]);
  } catch (error) {
    console.error('Add ticket comment error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Client portal: create ticket without org-user auth, but authenticating a client user token will be added later
router.post('/client', authenticateClient, async (req: ClientAuthenticatedRequest, res) => {
  try {
    const { ticket_type_id, title, description, priority } = req.body;
    if (!ticket_type_id || !title) {
      return res.status(400).json({ message: 'ticket_type_id and title required' });
    }

    // Simple rate limit: max 5 tickets per 10 minutes per client user
    const [limRows] = await pool.execute(
      `SELECT COUNT(*) as cnt FROM tickets WHERE created_by_client_user_id = ? AND created_at > (NOW() - INTERVAL 10 MINUTE)`,
      [req.client!.id]
    );
    const recent = (limRows as any[])[0].cnt as number;
    if (recent >= 5) {
      return res.status(429).json({ message: 'Too many tickets created. Please try again later.' });
    }

    const [result] = await pool.execute(
      `INSERT INTO tickets (organization_id, ticket_type_id, title, description, priority, created_by_client_user_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.client!.organization_id, ticket_type_id, title, description || null, priority || 'medium', req.client!.id]
    );
    const id = (result as any).insertId;
    const [rows] = await pool.execute('SELECT * FROM tickets WHERE id = ?', [id]);
    const created = (rows as any[])[0];
    await sendTicketEmail('ticket.created', { organization_id: req.client!.organization_id, ticket: created });
    await sendTicketWebhook('ticket.created', { organization_id: req.client!.organization_id, ticket: created });
    res.status(201).json(created);
  } catch (error) {
    console.error('Client create ticket error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Client: list active ticket types for org
router.get('/client/types', authenticateClient, async (req: ClientAuthenticatedRequest, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, key_slug, display_name, description FROM ticket_types WHERE organization_id = ? AND is_active = true ORDER BY created_at DESC',
      [req.client!.organization_id]
    );
    res.json(rows);
  } catch (error) {
    console.error('Client list types error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Client: add comment to own ticket
router.post('/:id/comments/client', authenticateClient, async (req: ClientAuthenticatedRequest, res) => {
  try {
    const ticketId = parseInt(req.params.id);
    const { comment } = req.body;
    if (!comment) return res.status(400).json({ message: 'comment required' });

    // Ensure ticket belongs to org and was created by this client user
    const [tRows] = await pool.execute(
      'SELECT id FROM tickets WHERE id = ? AND organization_id = ? AND created_by_client_user_id = ?',
      [ticketId, req.client!.organization_id, req.client!.id]
    );
    if ((tRows as any[]).length === 0) return res.status(404).json({ message: 'Ticket not found' });

    const [result] = await pool.execute(
      `INSERT INTO ticket_comments (ticket_id, author_client_user_id, comment)
       VALUES (?, ?, ?)`,
      [ticketId, req.client!.id, comment]
    );
    const cid = (result as any).insertId;
    const [rows] = await pool.execute('SELECT * FROM ticket_comments WHERE id = ?', [cid]);
    res.status(201).json((rows as any[])[0]);
  } catch (error) {
    console.error('Client add comment error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;


