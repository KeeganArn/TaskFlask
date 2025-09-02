import { Router, Request, Response } from 'express';
import { Task, CreateTaskRequest, UpdateTaskRequest } from '../types';
import pool from '../database/config';

const router = Router();

// GET /tasks - Get all tasks
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT t.*, p.name as project_name 
      FROM tasks t 
      LEFT JOIN projects p ON t.project_id = p.id 
      ORDER BY t.updated_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /tasks/:id - Get task by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT t.*, p.name as project_name 
      FROM tasks t 
      LEFT JOIN projects p ON t.project_id = p.id 
      WHERE t.id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /tasks - Create new task
router.post('/', async (req: Request<{}, {}, CreateTaskRequest>, res: Response) => {
  try {
    const { title, description, status, priority, dueDate, projectId } = req.body;
    
    if (!title || !description || !status || !priority || !dueDate || !projectId) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // For now, we'll use a default user ID (you can update this when auth is implemented)
    const userId = 1;
    
    const result = await pool.query(
      'INSERT INTO tasks (title, description, status, priority, due_date, project_id, user_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [title, description, status, priority, dueDate, projectId, userId]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /tasks/:id - Update task
router.put('/:id', async (req: Request<{ id: string }, {}, UpdateTaskRequest>, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, status, priority, dueDate, projectId } = req.body;
    
    const result = await pool.query(
      `UPDATE tasks 
       SET title = COALESCE($1, title), 
           description = COALESCE($2, description), 
           status = COALESCE($3, status), 
           priority = COALESCE($4, priority), 
           due_date = COALESCE($5, due_date), 
           project_id = COALESCE($6, project_id), 
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $7 RETURNING *`,
      [title, description, status, priority, dueDate, projectId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /tasks/:id - Delete task
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'DELETE FROM tasks WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /tasks/overdue - Get overdue tasks
router.get('/overdue', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT t.*, p.name as project_name 
      FROM tasks t 
      LEFT JOIN projects p ON t.project_id = p.id 
      WHERE t.status != 'completed' 
      AND t.due_date < CURRENT_DATE
      ORDER BY t.due_date ASC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching overdue tasks:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PATCH /tasks/bulk - Bulk update tasks
router.patch('/bulk', async (req: Request, res: Response) => {
  try {
    const { ids, updates } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'Invalid task IDs' });
    }

    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        updateFields.push(`${key} = $${paramIndex}`);
        updateValues.push(value);
        paramIndex++;
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json({ message: 'No valid updates provided' });
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(...ids);

    const query = `
      UPDATE tasks 
      SET ${updateFields.join(', ')}
      WHERE id = ANY($${paramIndex})
      RETURNING *
    `;

    const result = await pool.query(query, updateValues);
    res.json(result.rows);
  } catch (error) {
    console.error('Error bulk updating tasks:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /tasks/bulk - Bulk delete tasks
router.delete('/bulk', async (req: Request, res: Response) => {
  try {
    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'Invalid task IDs' });
    }

    const result = await pool.query(
      'DELETE FROM tasks WHERE id = ANY($1) RETURNING id',
      [ids]
    );

    res.json({ deletedCount: result.rows.length, deletedIds: result.rows.map(row => row.id) });
  } catch (error) {
    console.error('Error bulk deleting tasks:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
