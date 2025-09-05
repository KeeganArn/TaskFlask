import { Router, Response } from 'express';
import pool from '../database/config';
import { authenticate, requireFeature, AuthenticatedRequest } from '../middleware/rbac';

const router = Router();

// List audit logs (Enterprise)
router.get('/', authenticate, requireFeature('audit_logs'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const organizationId = req.user!.organization_id;
    const { limit = 50, offset = 0, user_id, action, resource_type } = req.query as any;

    let query = `SELECT * FROM audit_logs WHERE organization_id = ?`;
    const params: any[] = [organizationId];

    if (user_id) { query += ' AND user_id = ?'; params.push(user_id); }
    if (action) { query += ' AND action = ?'; params.push(action); }
    if (resource_type) { query += ' AND resource_type = ?'; params.push(resource_type); }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [rows] = await pool.execute(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;


