import { Router } from 'express';
import pool from '../database/config';
import { authenticate, requireOrganizationAdmin, AuthenticatedRequest } from '../middleware/rbac';

const router = Router();

// List connections
router.get('/', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, provider, connected_at, created_at, updated_at FROM integration_connections WHERE organization_id = ? ORDER BY provider ASC',
      [req.user!.organization_id]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: 'Failed to list integrations' });
  }
});

// Connect (store token/settings)
router.post('/connect', authenticate, requireOrganizationAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { provider, access_token, refresh_token, settings } = req.body;
    if (!provider) return res.status(400).json({ message: 'provider is required' });
    await pool.execute(
      `INSERT INTO integration_connections (organization_id, provider, access_token, refresh_token, settings, connected_by)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE access_token = VALUES(access_token), refresh_token = VALUES(refresh_token), settings = VALUES(settings), updated_at = CURRENT_TIMESTAMP`,
      [req.user!.organization_id, provider, access_token || null, refresh_token || null, settings ? JSON.stringify(settings) : null, req.user!.id]
    );
    res.status(201).json({ message: 'Connected' });
  } catch (e) {
    res.status(500).json({ message: 'Failed to connect integration' });
  }
});

// Disconnect
router.post('/disconnect', authenticate, requireOrganizationAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { provider } = req.body;
    if (!provider) return res.status(400).json({ message: 'provider is required' });
    await pool.execute(
      'DELETE FROM integration_connections WHERE organization_id = ? AND provider = ? LIMIT 1',
      [req.user!.organization_id, provider]
    );
    res.json({ message: 'Disconnected' });
  } catch (e) {
    res.status(500).json({ message: 'Failed to disconnect integration' });
  }
});

export default router;


