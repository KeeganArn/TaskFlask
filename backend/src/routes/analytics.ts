import { Router, Response } from 'express';
import pool from '../database/config';
import { authenticate, requireFeature, AuthenticatedRequest } from '../middleware/rbac';

const router = Router();

/**
 * GET /analytics/overview - Get organization overview analytics
 */
router.get('/overview', authenticate, requireFeature('analytics'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const organizationId = req.user!.organization_id;
    const { period = '30' } = req.query; // days

    const days = parseInt(period as string) || 30;

    // Get basic organization metrics
    const [orgMetrics] = await pool.execute(`
      SELECT 
        (SELECT COUNT(*) FROM users WHERE organization_id = ?) as total_users,
        (SELECT COUNT(*) FROM projects WHERE organization_id = ?) as total_projects,
        (SELECT COUNT(*) FROM tasks WHERE organization_id = ?) as total_tasks,
        (SELECT COUNT(*) FROM tasks WHERE organization_id = ? AND status = 'completed') as completed_tasks
    `, [organizationId, organizationId, organizationId, organizationId]);

    // Get activity metrics over period
    const [activityMetrics] = await pool.execute(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as tasks_created
      FROM tasks 
      WHERE organization_id = ? 
      AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `, [organizationId, days]);

    // Get task completion metrics
    const [completionMetrics] = await pool.execute(`
      SELECT 
        DATE(updated_at) as date,
        COUNT(*) as tasks_completed
      FROM tasks 
      WHERE organization_id = ? 
      AND status = 'completed'
      AND updated_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY DATE(updated_at)
      ORDER BY date DESC
    `, [organizationId, days]);

    // Get user activity
    const [userActivity] = await pool.execute(`
      SELECT 
        u.id,
        u.username,
        u.first_name,
        u.last_name,
        COUNT(DISTINCT t.id) as tasks_created,
        COUNT(DISTINCT a.id) as tasks_assigned,
        u.last_seen
      FROM users u
      LEFT JOIN tasks t ON t.reporter_id = u.id AND t.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      LEFT JOIN tasks a ON a.assignee_id = u.id AND a.updated_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      WHERE u.organization_id = ?
      GROUP BY u.id, u.username, u.first_name, u.last_name, u.last_seen
      ORDER BY (tasks_created + tasks_assigned) DESC
    `, [days, days, organizationId]);

    // Get project activity
    const [projectActivity] = await pool.execute(`
      SELECT 
        p.id,
        p.name,
        p.description,
        COUNT(DISTINCT t.id) as total_tasks,
        COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.id END) as completed_tasks,
        COUNT(DISTINCT CASE WHEN t.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY) THEN t.id END) as recent_tasks
      FROM projects p
      LEFT JOIN tasks t ON t.project_id = p.id
      WHERE p.organization_id = ?
      GROUP BY p.id, p.name, p.description
      ORDER BY recent_tasks DESC
    `, [days, organizationId]);

    res.json({
      overview: (orgMetrics as any[])[0],
      activity_timeline: activityMetrics,
      completion_timeline: completionMetrics,
      user_activity: userActivity,
      project_activity: projectActivity,
      period_days: days
    });
  } catch (error) {
    console.error('Error fetching analytics overview:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * GET /analytics/time-tracking - Get time tracking analytics (requires both analytics and time_tracking features)
 */
router.get('/time-tracking', authenticate, requireFeature('analytics'), requireFeature('time_tracking'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const organizationId = req.user!.organization_id;
    const { period = '30' } = req.query;

    const days = parseInt(period as string) || 30;

    // Get time tracking overview
    const [timeOverview] = await pool.execute(`
      SELECT 
        COUNT(DISTINCT ts.user_id) as active_users,
        COUNT(ts.id) as total_sessions,
        COALESCE(SUM(ts.duration_minutes), 0) as total_minutes,
        COALESCE(AVG(ts.duration_minutes), 0) as avg_session_minutes,
        COALESCE(SUM(CASE WHEN ts.is_billable THEN ts.duration_minutes ELSE 0 END), 0) as billable_minutes
      FROM time_tracking_sessions ts
      WHERE ts.organization_id = ? 
      AND ts.start_time >= DATE_SUB(NOW(), INTERVAL ? DAY)
      AND ts.end_time IS NOT NULL
    `, [organizationId, days]);

    // Get daily time breakdown
    const [dailyTime] = await pool.execute(`
      SELECT 
        DATE(ts.start_time) as date,
        COALESCE(SUM(ts.duration_minutes), 0) as total_minutes,
        COUNT(ts.id) as session_count,
        COUNT(DISTINCT ts.user_id) as active_users
      FROM time_tracking_sessions ts
      WHERE ts.organization_id = ? 
      AND ts.start_time >= DATE_SUB(NOW(), INTERVAL ? DAY)
      AND ts.end_time IS NOT NULL
      GROUP BY DATE(ts.start_time)
      ORDER BY date DESC
    `, [organizationId, days]);

    // Get time by user
    const [userTime] = await pool.execute(`
      SELECT 
        u.id,
        u.username,
        u.first_name,
        u.last_name,
        COALESCE(SUM(ts.duration_minutes), 0) as total_minutes,
        COUNT(ts.id) as session_count,
        COALESCE(SUM(CASE WHEN ts.is_billable THEN ts.duration_minutes ELSE 0 END), 0) as billable_minutes
      FROM users u
      LEFT JOIN time_tracking_sessions ts ON ts.user_id = u.id 
        AND ts.start_time >= DATE_SUB(NOW(), INTERVAL ? DAY)
        AND ts.end_time IS NOT NULL
      WHERE u.organization_id = ?
      GROUP BY u.id, u.username, u.first_name, u.last_name
      HAVING total_minutes > 0
      ORDER BY total_minutes DESC
    `, [days, organizationId]);

    // Get time by project
    const [projectTime] = await pool.execute(`
      SELECT 
        p.id,
        p.name,
        COALESCE(SUM(ts.duration_minutes), 0) as total_minutes,
        COUNT(ts.id) as session_count,
        COALESCE(AVG(ts.duration_minutes), 0) as avg_session_minutes
      FROM projects p
      LEFT JOIN tasks t ON t.project_id = p.id
      LEFT JOIN time_tracking_sessions ts ON ts.task_id = t.id 
        AND ts.start_time >= DATE_SUB(NOW(), INTERVAL ? DAY)
        AND ts.end_time IS NOT NULL
      WHERE p.organization_id = ?
      GROUP BY p.id, p.name
      HAVING total_minutes > 0
      ORDER BY total_minutes DESC
    `, [days, organizationId]);

    res.json({
      overview: (timeOverview as any[])[0],
      daily_breakdown: dailyTime,
      user_breakdown: userTime,
      project_breakdown: projectTime,
      period_days: days
    });
  } catch (error) {
    console.error('Error fetching time tracking analytics:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * GET /analytics/tasks - Get task analytics
 */
router.get('/tasks', authenticate, requireFeature('analytics'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const organizationId = req.user!.organization_id;
    const { period = '30' } = req.query;

    const days = parseInt(period as string) || 30;

    // Get task status distribution
    const [statusDistribution] = await pool.execute(`
      SELECT 
        status,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM tasks WHERE organization_id = ?), 2) as percentage
      FROM tasks 
      WHERE organization_id = ?
      GROUP BY status
      ORDER BY count DESC
    `, [organizationId, organizationId]);

    // Get priority distribution
    const [priorityDistribution] = await pool.execute(`
      SELECT 
        priority,
        COUNT(*) as count
      FROM tasks 
      WHERE organization_id = ?
      GROUP BY priority
      ORDER BY 
        CASE priority 
          WHEN 'critical' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'medium' THEN 3 
          WHEN 'low' THEN 4 
        END
    `, [organizationId]);

    // Get completion trend
    const [completionTrend] = await pool.execute(`
      SELECT 
        DATE(updated_at) as date,
        COUNT(*) as completed_count
      FROM tasks 
      WHERE organization_id = ? 
      AND status = 'completed'
      AND updated_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY DATE(updated_at)
      ORDER BY date DESC
    `, [organizationId, days]);

    // Get average completion time
    const [completionTimes] = await pool.execute(`
      SELECT 
        AVG(DATEDIFF(updated_at, created_at)) as avg_completion_days,
        MIN(DATEDIFF(updated_at, created_at)) as min_completion_days,
        MAX(DATEDIFF(updated_at, created_at)) as max_completion_days
      FROM tasks 
      WHERE organization_id = ? 
      AND status = 'completed'
      AND updated_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
    `, [organizationId, days]);

    // Get most productive users
    const [productiveUsers] = await pool.execute(`
      SELECT 
        u.id,
        u.username,
        u.first_name,
        u.last_name,
        COUNT(DISTINCT t_created.id) as tasks_created,
        COUNT(DISTINCT t_completed.id) as tasks_completed
      FROM users u
      LEFT JOIN tasks t_created ON t_created.reporter_id = u.id 
        AND t_created.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      LEFT JOIN tasks t_completed ON t_completed.assignee_id = u.id 
        AND t_completed.status = 'completed'
        AND t_completed.updated_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      WHERE u.organization_id = ?
      GROUP BY u.id, u.username, u.first_name, u.last_name
      HAVING (tasks_created + tasks_completed) > 0
      ORDER BY (tasks_created + tasks_completed) DESC
      LIMIT 10
    `, [days, days, organizationId]);

    res.json({
      status_distribution: statusDistribution,
      priority_distribution: priorityDistribution,
      completion_trend: completionTrend,
      completion_times: (completionTimes as any[])[0],
      productive_users: productiveUsers,
      period_days: days
    });
  } catch (error) {
    console.error('Error fetching task analytics:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * GET /analytics/projects - Get project analytics
 */
router.get('/projects', authenticate, requireFeature('analytics'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const organizationId = req.user!.organization_id;

    // Get project performance metrics
    const [projectMetrics] = await pool.execute(`
      SELECT 
        p.id,
        p.name,
        p.description,
        p.created_at,
        COUNT(DISTINCT t.id) as total_tasks,
        COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.id END) as completed_tasks,
        COUNT(DISTINCT CASE WHEN t.status = 'in_progress' THEN t.id END) as in_progress_tasks,
        COUNT(DISTINCT CASE WHEN t.status = 'todo' THEN t.id END) as todo_tasks,
        COUNT(DISTINCT t.assignee_id) as team_members,
        ROUND(
          COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.id END) * 100.0 / 
          NULLIF(COUNT(DISTINCT t.id), 0), 2
        ) as completion_percentage,
        AVG(CASE WHEN t.status = 'completed' THEN DATEDIFF(t.updated_at, t.created_at) END) as avg_completion_days
      FROM projects p
      LEFT JOIN tasks t ON t.project_id = p.id
      WHERE p.organization_id = ?
      GROUP BY p.id, p.name, p.description, p.created_at
      ORDER BY total_tasks DESC
    `, [organizationId]);

    // Get project activity timeline
    const [projectActivity] = await pool.execute(`
      SELECT 
        p.id,
        p.name,
        DATE(t.created_at) as date,
        COUNT(t.id) as tasks_created
      FROM projects p
      LEFT JOIN tasks t ON t.project_id = p.id AND t.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      WHERE p.organization_id = ?
      AND t.id IS NOT NULL
      GROUP BY p.id, p.name, DATE(t.created_at)
      ORDER BY date DESC
    `, [organizationId]);

    res.json({
      project_metrics: projectMetrics,
      activity_timeline: projectActivity
    });
  } catch (error) {
    console.error('Error fetching project analytics:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
