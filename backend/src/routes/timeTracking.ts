import { Router, Response } from 'express';
import pool from '../database/config';
import { authenticate, requireFeature, AuthenticatedRequest } from '../middleware/rbac';

const router = Router();

/**
 * GET /time-tracking/sessions - Get time tracking sessions for user
 */
router.get('/sessions', authenticate, requireFeature('time_tracking'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const organizationId = req.user!.organization_id;
    const { 
      task_id, 
      start_date, 
      end_date, 
      limit = 50, 
      offset = 0 
    } = req.query;

    let query = `
      SELECT 
        ts.*,
        t.title as task_title,
        t.description as task_description,
        p.name as project_name,
        u.username, u.first_name, u.last_name
      FROM time_tracking_sessions ts
      JOIN tasks t ON ts.task_id = t.id
      JOIN projects p ON t.project_id = p.id
      JOIN users u ON ts.user_id = u.id
      WHERE ts.organization_id = ?
    `;

    const queryParams: any[] = [organizationId];

    // Filter by task if specified
    if (task_id) {
      query += ' AND ts.task_id = ?';
      queryParams.push(task_id);
    }

    // Filter by date range if specified
    if (start_date) {
      query += ' AND ts.start_time >= ?';
      queryParams.push(start_date);
    }

    if (end_date) {
      query += ' AND ts.start_time <= ?';
      queryParams.push(end_date);
    }

    // If not admin, only show own sessions
    if (!req.user!.role || req.user!.role !== 'owner') {
      query += ' AND ts.user_id = ?';
      queryParams.push(userId);
    }

    query += ' ORDER BY ts.start_time DESC LIMIT ? OFFSET ?';
    queryParams.push(parseInt(limit as string), parseInt(offset as string));

    const [sessions] = await pool.execute(query, queryParams);

    res.json(sessions);
  } catch (error) {
    console.error('Error fetching time tracking sessions:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * POST /time-tracking/sessions - Start a new time tracking session
 */
router.post('/sessions', authenticate, requireFeature('time_tracking'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const organizationId = req.user!.organization_id;
    const { task_id, description, is_billable = false, hourly_rate } = req.body;

    if (!task_id) {
      return res.status(400).json({ message: 'Task ID is required' });
    }

    // Verify task belongs to organization
    const [taskCheck] = await pool.execute(
      'SELECT id FROM tasks WHERE id = ? AND organization_id = ?',
      [task_id, organizationId]
    );

    if ((taskCheck as any[]).length === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Check if user has any active sessions and stop them
    await pool.execute(
      `UPDATE time_tracking_sessions 
       SET end_time = CURRENT_TIMESTAMP, 
           duration_minutes = TIMESTAMPDIFF(MINUTE, start_time, CURRENT_TIMESTAMP)
       WHERE user_id = ? AND end_time IS NULL`,
      [userId]
    );

    // Start new session
    const [result] = await pool.execute(`
      INSERT INTO time_tracking_sessions 
      (user_id, task_id, organization_id, description, start_time, is_billable, hourly_rate)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)
    `, [userId, task_id, organizationId, description || null, is_billable, hourly_rate || null]);

    const sessionId = (result as any).insertId;

    // Get the created session with task details
    const [newSession] = await pool.execute(`
      SELECT 
        ts.*,
        t.title as task_title,
        p.name as project_name
      FROM time_tracking_sessions ts
      JOIN tasks t ON ts.task_id = t.id
      JOIN projects p ON t.project_id = p.id
      WHERE ts.id = ?
    `, [sessionId]);

    res.status(201).json((newSession as any[])[0]);
  } catch (error) {
    console.error('Error starting time tracking session:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * PUT /time-tracking/sessions/:id/stop - Stop a time tracking session
 */
router.put('/sessions/:id/stop', authenticate, requireFeature('time_tracking'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const sessionId = req.params.id;

    // Stop the session and calculate duration
    const [result] = await pool.execute(`
      UPDATE time_tracking_sessions 
      SET end_time = CURRENT_TIMESTAMP,
          duration_minutes = TIMESTAMPDIFF(MINUTE, start_time, CURRENT_TIMESTAMP),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ? AND end_time IS NULL
    `, [sessionId, userId]);

    if ((result as any).affectedRows === 0) {
      return res.status(404).json({ message: 'Active session not found' });
    }

    // Get the updated session
    const [session] = await pool.execute(`
      SELECT 
        ts.*,
        t.title as task_title,
        p.name as project_name
      FROM time_tracking_sessions ts
      JOIN tasks t ON ts.task_id = t.id
      JOIN projects p ON t.project_id = p.id
      WHERE ts.id = ?
    `, [sessionId]);

    res.json((session as any[])[0]);
  } catch (error) {
    console.error('Error stopping time tracking session:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * GET /time-tracking/active - Get current active session for user
 */
router.get('/active', authenticate, requireFeature('time_tracking'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const [session] = await pool.execute(`
      SELECT 
        ts.*,
        t.title as task_title,
        t.description as task_description,
        p.name as project_name
      FROM time_tracking_sessions ts
      JOIN tasks t ON ts.task_id = t.id
      JOIN projects p ON t.project_id = p.id
      WHERE ts.user_id = ? AND ts.end_time IS NULL
      ORDER BY ts.start_time DESC
      LIMIT 1
    `, [userId]);

    if ((session as any[]).length === 0) {
      return res.json(null);
    }

    res.json((session as any[])[0]);
  } catch (error) {
    console.error('Error fetching active session:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * GET /time-tracking/stats - Get time tracking statistics
 */
router.get('/stats', authenticate, requireFeature('time_tracking'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const organizationId = req.user!.organization_id;
    const { period = 'week' } = req.query;

    let dateFilter = '';
    switch (period) {
      case 'today':
        dateFilter = 'AND DATE(ts.start_time) = CURDATE()';
        break;
      case 'week':
        dateFilter = 'AND ts.start_time >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
        break;
      case 'month':
        dateFilter = 'AND ts.start_time >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
        break;
      default:
        dateFilter = 'AND ts.start_time >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
    }

    // Get total time for user
    const [userStats] = await pool.execute(`
      SELECT 
        COALESCE(SUM(ts.duration_minutes), 0) as total_minutes,
        COUNT(ts.id) as session_count,
        COALESCE(SUM(CASE WHEN ts.is_billable THEN ts.duration_minutes ELSE 0 END), 0) as billable_minutes
      FROM time_tracking_sessions ts
      WHERE ts.user_id = ? AND ts.end_time IS NOT NULL ${dateFilter}
    `, [userId]);

    // Get time by project
    const [projectStats] = await pool.execute(`
      SELECT 
        p.name as project_name,
        p.id as project_id,
        COALESCE(SUM(ts.duration_minutes), 0) as total_minutes
      FROM time_tracking_sessions ts
      JOIN tasks t ON ts.task_id = t.id
      JOIN projects p ON t.project_id = p.id
      WHERE ts.user_id = ? AND ts.end_time IS NOT NULL ${dateFilter}
      GROUP BY p.id, p.name
      ORDER BY total_minutes DESC
    `, [userId]);

    // If user is admin, get organization stats
    let orgStats = null;
    if (req.user!.role === 'owner') {
      const [orgData] = await pool.execute(`
        SELECT 
          COALESCE(SUM(ts.duration_minutes), 0) as total_minutes,
          COUNT(DISTINCT ts.user_id) as active_users,
          COUNT(ts.id) as total_sessions
        FROM time_tracking_sessions ts
        WHERE ts.organization_id = ? AND ts.end_time IS NOT NULL ${dateFilter}
      `, [organizationId]);

      orgStats = (orgData as any[])[0];
    }

    res.json({
      user_stats: (userStats as any[])[0],
      project_breakdown: projectStats,
      organization_stats: orgStats
    });
  } catch (error) {
    console.error('Error fetching time tracking stats:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * PUT /time-tracking/sessions/:id - Update a time tracking session
 */
router.put('/sessions/:id', authenticate, requireFeature('time_tracking'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const sessionId = req.params.id;
    const { description, is_billable, hourly_rate } = req.body;

    // Update the session
    const [result] = await pool.execute(`
      UPDATE time_tracking_sessions 
      SET description = COALESCE(?, description),
          is_billable = COALESCE(?, is_billable),
          hourly_rate = COALESCE(?, hourly_rate),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `, [description, is_billable, hourly_rate, sessionId, userId]);

    if ((result as any).affectedRows === 0) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Get the updated session
    const [session] = await pool.execute(`
      SELECT 
        ts.*,
        t.title as task_title,
        p.name as project_name
      FROM time_tracking_sessions ts
      JOIN tasks t ON ts.task_id = t.id
      JOIN projects p ON t.project_id = p.id
      WHERE ts.id = ?
    `, [sessionId]);

    res.json((session as any[])[0]);
  } catch (error) {
    console.error('Error updating time tracking session:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * DELETE /time-tracking/sessions/:id - Delete a time tracking session
 */
router.delete('/sessions/:id', authenticate, requireFeature('time_tracking'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const sessionId = req.params.id;

    const [result] = await pool.execute(
      'DELETE FROM time_tracking_sessions WHERE id = ? AND user_id = ?',
      [sessionId, userId]
    );

    if ((result as any).affectedRows === 0) {
      return res.status(404).json({ message: 'Session not found' });
    }

    res.json({ message: 'Session deleted successfully' });
  } catch (error) {
    console.error('Error deleting time tracking session:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
