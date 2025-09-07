import { Router } from 'express';
import pool from '../database/config';
import { authenticate, requireAnyPermission, requirePlanIn } from '../middleware/rbac';

const router = Router();

// List clients for the organization
router.get('/', authenticate, requireAnyPermission(['users.view', 'org.view', 'clients.view' as any]), async (req: any, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM clients WHERE organization_id = ? ORDER BY created_at DESC',
      [req.user!.organization_id]
    );
    res.json(rows);
  } catch (error) {
    console.error('List clients error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create a client record
router.post('/', authenticate, requirePlanIn(['pro', 'enterprise']), requireAnyPermission(['users.manage', 'org.edit', 'clients.manage' as any]), async (req: any, res) => {
  try {
    const { name, email, phone, company } = req.body;
    if (!name || !email) return res.status(400).json({ message: 'Name and email required' });

    const [result] = await pool.execute(
      `INSERT INTO clients (organization_id, name, email, phone, company)
       VALUES (?, ?, ?, ?, ?)`,
      [req.user!.organization_id, name, email, phone || null, company || null]
    );
    const id = (result as any).insertId;
    const [rows] = await pool.execute('SELECT * FROM clients WHERE id = ?', [id]);
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Create client error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update client
router.put('/:id', authenticate, requireAnyPermission(['users.manage', 'org.edit', 'clients.manage' as any]), async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, email, phone, company, status } = req.body;
    const [result] = await pool.execute(
      `UPDATE clients SET 
        name = COALESCE(?, name),
        email = COALESCE(?, email),
        phone = COALESCE(?, phone),
        company = COALESCE(?, company),
        status = COALESCE(?, status)
       WHERE id = ? AND organization_id = ?`,
      [name || null, email || null, phone || null, company || null, status || null, id, req.user!.organization_id]
    );
    const [rows] = await pool.execute('SELECT * FROM clients WHERE id = ? AND organization_id = ?', [id, req.user!.organization_id]);
    if ((rows as any[]).length === 0) return res.status(404).json({ message: 'Client not found' });
    res.json(rows[0]);
  } catch (error) {
    console.error('Update client error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete client
router.delete('/:id', authenticate, requireAnyPermission(['users.manage', 'org.edit', 'clients.manage' as any]), async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    await pool.execute('DELETE FROM clients WHERE id = ? AND organization_id = ?', [id, req.user!.organization_id]);
    res.json({ message: 'Deleted' });
  } catch (error) {
    console.error('Delete client error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create client user account (for client login)
router.post('/:id/users', authenticate, requirePlanIn(['pro', 'enterprise']), requireAnyPermission(['users.manage', 'clients.manage' as any]), async (req: any, res) => {
  try {
    const clientId = parseInt(req.params.id);
    const { email, password_hash, first_name, last_name } = req.body;
    if (!email || !password_hash) return res.status(400).json({ message: 'Email and password_hash required' });

    // Ensure the client belongs to org
    const [c] = await pool.execute('SELECT id FROM clients WHERE id = ? AND organization_id = ?', [clientId, req.user!.organization_id]);
    if ((c as any[]).length === 0) return res.status(404).json({ message: 'Client not found' });

    const [result] = await pool.execute(
      `INSERT INTO client_users (client_id, organization_id, email, password_hash, first_name, last_name)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [clientId, req.user!.organization_id, email, password_hash, first_name || null, last_name || null]
    );
    const id = (result as any).insertId;
    const [row] = await pool.execute('SELECT * FROM client_users WHERE id = ?', [id]);
    res.status(201).json((row as any[])[0]);
  } catch (error) {
    console.error('Create client user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;


