import { Router } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../database/config';
import { signClientToken } from '../middleware/clientAuth';

const router = Router();

// Client login
router.post('/login', async (req, res) => {
  try {
    const { email, password, organization_slug } = req.body;
    if (!email || !password || !organization_slug) {
      return res.status(400).json({ message: 'email, password, organization_slug required' });
    }

    // Resolve organization_id from slug
    const [orgRows] = await pool.execute('SELECT id FROM organizations WHERE slug = ?', [organization_slug]);
    if ((orgRows as any[]).length === 0) return res.status(404).json({ message: 'Organization not found' });
    const organization_id = (orgRows as any[])[0].id;

    const [rows] = await pool.execute(
      `SELECT cu.*
       FROM client_users cu
       WHERE cu.email = ? AND cu.organization_id = ? AND cu.is_active = true`,
      [email, organization_id]
    );
    if ((rows as any[]).length === 0) return res.status(401).json({ message: 'Invalid credentials' });
    const cu = (rows as any[])[0];

    const ok = await bcrypt.compare(password, cu.password_hash);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

    await pool.execute('UPDATE client_users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [cu.id]);

    const token = signClientToken({ clientUserId: cu.id, organizationId: organization_id, email });
    return res.json({ token, client_user: { id: cu.id, email: cu.email, organization_id, client_id: cu.client_id } });
  } catch (error) {
    console.error('Client login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;


