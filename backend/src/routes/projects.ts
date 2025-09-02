import { Router, Request, Response } from 'express';
import { Project, CreateProjectRequest, UpdateProjectRequest } from '../types';
import pool from '../database/config';

const router = Router();

// GET /projects - Get all projects
router.get('/', async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM projects ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /projects/:id - Get project by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.execute(
      'SELECT * FROM projects WHERE id = ?',
      [id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /projects - Create new project
router.post('/', async (req: Request<{}, {}, CreateProjectRequest>, res: Response) => {
  try {
    const { name, description } = req.body;
    
    if (!name || !description) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // For now, we'll use a default user ID (you can update this when auth is implemented)
    const userId = 1;
    
    const [result] = await pool.execute(
      'INSERT INTO projects (name, description, user_id) VALUES (?, ?, ?)',
      [name, description, userId]
    );

    // Get the inserted project
    const [insertedProject] = await pool.execute(
      'SELECT * FROM projects WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json(insertedProject[0]);
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /projects/:id - Update project
router.put('/:id', async (req: Request<{ id: string }, {}, UpdateProjectRequest>, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    
    const [result] = await pool.execute(
      'UPDATE projects SET name = COALESCE(?, name), description = COALESCE(?, description), updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name, description, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Get the updated project
    const [updatedProject] = await pool.execute(
      'SELECT * FROM projects WHERE id = ?',
      [id]
    );

    res.json(updatedProject[0]);
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /projects/:id - Delete project
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const [result] = await pool.execute(
      'DELETE FROM projects WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Project not found' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /projects/:id/stats - Get project statistics
router.get('/:id/stats', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Get task counts for the project
    const [taskStats] = await pool.execute(`
      SELECT 
        COUNT(*) as total_tasks,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
        COUNT(CASE WHEN status = 'in-progress' THEN 1 END) as in_progress_tasks,
        COUNT(CASE WHEN status != 'completed' AND due_date < CURRENT_DATE THEN 1 END) as overdue_tasks
      FROM tasks 
      WHERE project_id = ?
    `, [id]);

    const stats = taskStats[0];
    const completionRate = stats.total_tasks > 0 ? Math.round((stats.completed_tasks / stats.total_tasks) * 100) : 0;

    res.json({
      totalTasks: parseInt(stats.total_tasks),
      completedTasks: parseInt(stats.completed_tasks),
      inProgressTasks: parseInt(stats.in_progress_tasks),
      overdueTasks: parseInt(stats.overdue_tasks),
      completionRate
    });
  } catch (error) {
    console.error('Error fetching project stats:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /projects/:id/tasks - Get all tasks for a project
router.get('/:id/tasks', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const [rows] = await pool.execute(`
      SELECT t.*, p.name as project_name 
      FROM tasks t 
      LEFT JOIN projects p ON t.project_id = p.id 
      WHERE t.project_id = ?
      ORDER BY t.updated_at DESC
    `, [id]);
    
    res.json(rows);
  } catch (error) {
    console.error('Error fetching project tasks:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
