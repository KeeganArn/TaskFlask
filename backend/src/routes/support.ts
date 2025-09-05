import { Router, Response } from 'express';
import pool from '../database/config';
import { authenticate, requireFeature, AuthenticatedRequest } from '../middleware/rbac';

const router = Router();

// Submit a support ticket (Pro: priority_support; Enterprise: dedicated_support)
router.post('/tickets', authenticate, requireFeature('priority_support'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const organizationId = req.user!.organization_id;
    const userId = req.user!.id;
    const { subject, message, priority = 'normal' } = req.body;
    if (!subject || !message) return res.status(400).json({ message: 'Subject and message are required' });

    const [result] = await pool.execute(
      `INSERT INTO support_tickets (organization_id, user_id, priority, subject, message)
       VALUES (?, ?, ?, ?, ?)`,
      [organizationId, userId, priority, subject, message]
    );
    res.status(201).json({ id: (result as any).insertId });
  } catch (error) {
    console.error('Error submitting ticket:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// List tickets for org
router.get('/tickets', authenticate, requireFeature('priority_support'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const organizationId = req.user!.organization_id;
    const [rows] = await pool.execute(
      `SELECT st.*, u.username, u.first_name, u.last_name 
       FROM support_tickets st JOIN users u ON st.user_id = u.id
       WHERE st.organization_id = ? ORDER BY st.created_at DESC`,
      [organizationId]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error listing tickets:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update ticket status (Enterprise support may triage)
router.put('/tickets/:id/status', authenticate, requireFeature('priority_support'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const organizationId = req.user!.organization_id;
    const { id } = req.params;
    const { status } = req.body;
    await pool.execute(
      `UPDATE support_tickets SET status = COALESCE(?, status), updated_at = CURRENT_TIMESTAMP 
       WHERE id = ? AND organization_id = ?`,
      [status, id, organizationId]
    );
    res.json({ ok: true });
  } catch (error) {
    console.error('Error updating ticket:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;


