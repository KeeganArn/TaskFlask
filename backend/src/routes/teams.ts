import { Router, Request, Response } from 'express';
import pool from '../database/config';

const router = Router();

// Minimal incoming webhook receiver (for testing flows)
router.post('/incoming', async (req: Request, res: Response) => {
  try {
    const payload = req.body;
    try {
      await pool.execute(
        'INSERT INTO integration_events (organization_id, provider, event_type, payload) VALUES (?, ?, ?, ?)',
        [null, 'teams', payload.type || 'message', JSON.stringify(payload)]
      );
    } catch {}
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false });
  }
});

export default router;


