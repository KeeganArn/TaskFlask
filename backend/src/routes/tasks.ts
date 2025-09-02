import { Router, Request, Response } from 'express';
import { Task, CreateTaskRequest, UpdateTaskRequest } from '../types';
import pool from '../database/config';

const router = Router();

// GET /tasks - Get all tasks
router.get('/', async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.execute(`
      SELECT t.*, p.name as project_name 
      FROM tasks t 
      LEFT JOIN projects p ON t.project_id = p.id 
      ORDER BY t.updated_at DESC
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /tasks/:id - Get task by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.execute(`
      SELECT t.*, p.name as project_name 
      FROM tasks t 
      LEFT JOIN projects p ON t.project_id = p.id 
      WHERE t.id = ?
    `, [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }
    
    res.json(rows[0]);
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
    
    const [result] = await pool.execute(
      'INSERT INTO tasks (title, description, status, priority, due_date, project_id, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [title, description, status, priority, dueDate, projectId, userId]
    );

    // Get the inserted task
    const [insertedTask] = await pool.execute(
      'SELECT t.*, p.name as project_name FROM tasks t LEFT JOIN projects p ON t.project_id = p.id WHERE t.id = ?',
      [result.insertId]
    );

    res.status(201).json(insertedTask[0]);
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
    
    const [result] = await pool.execute(
      `UPDATE tasks 
       SET title = COALESCE(?, title), 
           description = COALESCE(?, description), 
           status = COALESCE(?, status), 
           priority = COALESCE(?, priority), 
           due_date = COALESCE(?, due_date), 
           project_id = COALESCE(?, project_id), 
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [title, description, status, priority, dueDate, projectId, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Get the updated task
    const [updatedTask] = await pool.execute(
      'SELECT t.*, p.name as project_name FROM tasks t LEFT JOIN projects p ON t.project_id = p.id WHERE t.id = ?',
      [id]
    );

    res.json(updatedTask[0]);
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /tasks/:id - Delete task
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const [result] = await pool.execute(
      'DELETE FROM tasks WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
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
    const [rows] = await pool.execute(`
      SELECT t.*, p.name as project_name 
      FROM tasks t 
      LEFT JOIN projects p ON t.project_id = p.id 
      WHERE t.status != 'completed' 
      AND t.due_date < CURRENT_DATE
      ORDER BY t.due_date ASC
    `);
    res.json(rows);
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
        updateFields.push(`${key} = ?`);
        updateValues.push(value);
        paramIndex++;
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json({ message: 'No valid updates provided' });
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(...ids);

    const placeholders = ids.map(() => '?').join(',');
    const query = `
      UPDATE tasks 
      SET ${updateFields.join(', ')}
      WHERE id IN (${placeholders})
    `;

    const [result] = await pool.execute(query, updateValues);
    
    // Get the updated tasks
    const taskPlaceholders = ids.map(() => '?').join(',');
    const [updatedTasks] = await pool.execute(
      `SELECT t.*, p.name as project_name FROM tasks t LEFT JOIN projects p ON t.project_id = p.id WHERE t.id IN (${taskPlaceholders})`,
      ids
    );

    res.json(updatedTasks);
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

    const deletePlaceholders = ids.map(() => '?').join(',');
    const [result] = await pool.execute(
      `DELETE FROM tasks WHERE id IN (${deletePlaceholders})`,
      ids
    );

    res.json({ deletedCount: result.affectedRows, deletedIds: ids });
  } catch (error) {
    console.error('Error bulk deleting tasks:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
