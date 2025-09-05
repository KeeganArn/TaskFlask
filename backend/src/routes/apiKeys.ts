import { Router, Response } from 'express';
import crypto from 'crypto';
import pool from '../database/config';
import { authenticate, requireOrganizationAdmin, requireFeature, AuthenticatedRequest } from '../middleware/rbac';

const router = Router();

// List API keys
router.get('/', authenticate, requireFeature('api_access'), requireOrganizationAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const organizationId = req.user!.organization_id;
    const [rows] = await pool.execute('SELECT id, name, key_prefix, permissions, last_used_at, expires_at, is_active, created_at FROM api_keys WHERE organization_id = ? ORDER BY created_at DESC', [organizationId]);
    res.json(rows);
  } catch (error) {
    console.error('Error listing API keys:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create API key (returns full key once)
router.post('/', authenticate, requireFeature('api_access'), requireOrganizationAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const organizationId = req.user!.organization_id;
    const userId = req.user!.id;
    const { name, permissions = [], expires_at = null } = req.body;
    if (!name) return res.status(400).json({ message: 'Name is required' });

    const rawKey = crypto.randomBytes(32).toString('hex');
    const keyPrefix = rawKey.slice(0, 8);
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    await pool.execute(`
      INSERT INTO api_keys (organization_id, name, key_hash, key_prefix, permissions, expires_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [organizationId, name, keyHash, keyPrefix, JSON.stringify(permissions), expires_at, userId]);

    res.status(201).json({ api_key: `${keyPrefix}.${rawKey}` });
  } catch (error) {
    console.error('Error creating API key:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Revoke / toggle active
router.put('/:id/toggle', authenticate, requireFeature('api_access'), requireOrganizationAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const organizationId = req.user!.organization_id;
    const { id } = req.params;
    await pool.execute(`UPDATE api_keys SET is_active = NOT is_active, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?`, [id, organizationId]);
    res.json({ ok: true });
  } catch (error) {
    console.error('Error toggling API key:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete API key
router.delete('/:id', authenticate, requireFeature('api_access'), requireOrganizationAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const organizationId = req.user!.organization_id;
    const { id } = req.params;
    await pool.execute('DELETE FROM api_keys WHERE id = ? AND organization_id = ?', [id, organizationId]);
    res.json({ ok: true });
  } catch (error) {
    console.error('Error deleting API key:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;


