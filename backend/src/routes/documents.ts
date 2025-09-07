import { Router, Response } from 'express';
import pool from '../database/config';
import { authenticate, requireOrganizationAccess, requireFeature, AuthenticatedRequest } from '../middleware/rbac';

const router = Router();

// List documents (org-wide)
router.get('/', authenticate, requireFeature('advanced_permissions'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const organizationId = req.user!.organization_id;
    const [rows] = await pool.execute(`
      SELECT d.*, u.username as author_username, u.first_name as author_first_name, u.last_name as author_last_name
      FROM documents d
      JOIN users u ON d.created_by = u.id
      WHERE d.organization_id = ?
      ORDER BY d.updated_at DESC
    `, [organizationId]);
    res.json(rows);
  } catch (error) {
    console.error('Error listing documents:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create document
router.post('/', authenticate, requireFeature('advanced_permissions'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title, content, visibility = 'org' } = req.body;
    const organizationId = req.user!.organization_id;
    const userId = req.user!.id;

    if (!title) return res.status(400).json({ message: 'Title is required' });

    const [result] = await pool.execute(`
      INSERT INTO documents (organization_id, title, content, created_by, visibility)
      VALUES (?, ?, ?, ?, ?)
    `, [organizationId, title, content || null, userId, visibility]);

    const id = (result as any).insertId;
    const [rows] = await pool.execute('SELECT * FROM documents WHERE id = ?', [id]);
    res.status(201).json((rows as any[])[0]);
  } catch (error) {
    console.error('Error creating document:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get document by id
router.get('/:id', authenticate, requireFeature('advanced_permissions'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const organizationId = req.user!.organization_id;
    const { id } = req.params;
    const [rows] = await pool.execute('SELECT * FROM documents WHERE id = ? AND organization_id = ?', [id, organizationId]);
    if ((rows as any[]).length === 0) return res.status(404).json({ message: 'Document not found' });
    res.json((rows as any[])[0]);
  } catch (error) {
    console.error('Error fetching document:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update document
router.put('/:id', authenticate, requireFeature('advanced_permissions'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const organizationId = req.user!.organization_id;
    const userId = req.user!.id;
    const { id } = req.params;
    const { title, content, visibility } = req.body;

    const [result] = await pool.execute(`
      UPDATE documents
      SET title = COALESCE(?, title),
          content = COALESCE(?, content),
          visibility = COALESCE(?, visibility),
          updated_by = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND organization_id = ?
    `, [title, content, visibility, userId, id, organizationId]);

    if ((result as any).affectedRows === 0) return res.status(404).json({ message: 'Document not found' });
    const [rows] = await pool.execute('SELECT * FROM documents WHERE id = ?', [id]);
    res.json((rows as any[])[0]);
  } catch (error) {
    console.error('Error updating document:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete document
router.delete('/:id', authenticate, requireFeature('advanced_permissions'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const organizationId = req.user!.organization_id;
    const { id } = req.params;
    const [result] = await pool.execute('DELETE FROM documents WHERE id = ? AND organization_id = ?', [id, organizationId]);
    if ((result as any).affectedRows === 0) return res.status(404).json({ message: 'Document not found' });
    res.json({ message: 'Document deleted' });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Start view session (user opened document)
router.post('/:id/view/start', authenticate, requireFeature('advanced_permissions'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const organizationId = req.user!.organization_id;
    const userId = req.user!.id;
    const { id } = req.params;

    // Verify document
    const [doc] = await pool.execute('SELECT id FROM documents WHERE id = ? AND organization_id = ?', [id, organizationId]);
    if ((doc as any[]).length === 0) return res.status(404).json({ message: 'Document not found' });

    // End any existing active sessions for same doc/user
    await pool.execute(`
      UPDATE document_view_sessions
      SET ended_at = CURRENT_TIMESTAMP,
          duration_seconds = TIMESTAMPDIFF(SECOND, started_at, CURRENT_TIMESTAMP)
      WHERE document_id = ? AND user_id = ? AND ended_at IS NULL
    `, [id, userId]);

    // Start new session
    const [result] = await pool.execute(`
      INSERT INTO document_view_sessions (organization_id, document_id, user_id)
      VALUES (?, ?, ?)
    `, [organizationId, id, userId]);

    res.status(201).json({ session_id: (result as any).insertId });
  } catch (error) {
    console.error('Error starting document view session:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Heartbeat while viewing
router.post('/views/:sessionId/heartbeat', authenticate, requireFeature('advanced_permissions'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { sessionId } = req.params;
    const [result] = await pool.execute(`
      UPDATE document_view_sessions
      SET last_heartbeat = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ? AND ended_at IS NULL
    `, [sessionId, userId]);
    if ((result as any).affectedRows === 0) return res.status(404).json({ message: 'Active session not found' });
    res.json({ ok: true });
  } catch (error) {
    console.error('Error updating heartbeat:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// End view session
router.post('/views/:sessionId/end', authenticate, requireFeature('advanced_permissions'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { sessionId } = req.params;
    const [result] = await pool.execute(`
      UPDATE document_view_sessions
      SET ended_at = CURRENT_TIMESTAMP,
          duration_seconds = TIMESTAMPDIFF(SECOND, started_at, CURRENT_TIMESTAMP)
      WHERE id = ? AND user_id = ? AND ended_at IS NULL
    `, [sessionId, userId]);
    if ((result as any).affectedRows === 0) return res.status(404).json({ message: 'Active session not found' });
    res.json({ ok: true });
  } catch (error) {
    console.error('Error ending view session:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Manager view: who is viewing what (active within last 2 minutes)
router.get('/views/active', authenticate, requireFeature('advanced_permissions'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const organizationId = req.user!.organization_id;

    const [rows] = await pool.execute(`
      SELECT 
        dvs.id as session_id,
        dvs.document_id,
        d.title as document_title,
        dvs.user_id,
        u.username,
        u.first_name,
        u.last_name,
        dvs.started_at,
        dvs.last_heartbeat,
        TIMESTAMPDIFF(SECOND, dvs.started_at, COALESCE(dvs.ended_at, CURRENT_TIMESTAMP)) as duration_seconds
      FROM document_view_sessions dvs
      JOIN documents d ON d.id = dvs.document_id
      JOIN users u ON u.id = dvs.user_id
      WHERE dvs.organization_id = ?
        AND dvs.ended_at IS NULL
        AND dvs.last_heartbeat >= DATE_SUB(NOW(), INTERVAL 2 MINUTE)
      ORDER BY dvs.last_heartbeat DESC
    `, [organizationId]);

    res.json(rows);
  } catch (error) {
    // If the sessions table is missing (fresh DB), return empty list instead of 500
    if ((error as any)?.code === 'ER_NO_SUCH_TABLE') {
      return res.json([]);
    }
    console.error('Error fetching active document views:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;


