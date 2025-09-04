import { Router, Request, Response } from 'express';
import { Task, CreateTaskRequest, UpdateTaskRequest } from '../types';
import pool from '../database/config';
import { authenticate } from '../middleware/rbac';
import { AuthenticatedRequest } from '../types';

const router = Router();

// GET /tasks - Get all tasks for authenticated user
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const organizationId = req.user.organization_id;
    const [rows] = await pool.execute(`
      SELECT t.*, p.name as project_name 
      FROM tasks t 
      LEFT JOIN projects p ON t.project_id = p.id 
      WHERE t.organization_id = ?
      ORDER BY t.updated_at DESC
    `, [organizationId]);
    
    // Transform snake_case to camelCase for frontend
    const transformedRows = (rows as any[]).map(row => ({
      ...row,
      dueDate: row.due_date,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      projectId: row.project_id,
      userId: row.assignee_id || row.reporter_id,
      projectName: row.project_name
    }));
    
    res.json(transformedRows);
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
    
    if ((rows as any[]).length === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }
    
    // Transform snake_case to camelCase for frontend
    const task = (rows as any[])[0];
    const transformedTask = {
      ...task,
      dueDate: task.due_date,
      createdAt: task.created_at,
      updatedAt: task.updated_at,
      projectId: task.project_id,
      userId: task.user_id,
      projectName: task.project_name
    };
    
    res.json(transformedTask);
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /tasks - Create new task
router.post('/', authenticate, async (req: AuthenticatedRequest<{}, {}, CreateTaskRequest>, res: Response) => {
  try {
    console.log('Task creation - Request body:', req.body);
    console.log('Task creation - User:', req.user);
    const { title, description, status, priority, dueDate, projectId } = req.body;
    
    if (!title || !description || !status || !priority || !dueDate || !projectId) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    if (!req.user) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const userId = req.user.id;
    const organizationId = req.user.organization_id;
    
    // Verify the project belongs to the user's organization
    const [projectCheck] = await pool.execute(
      'SELECT id FROM projects WHERE id = ? AND organization_id = ?',
      [projectId, organizationId]
    );
    
    if ((projectCheck as any[]).length === 0) {
      return res.status(403).json({ message: 'Project not found or access denied' });
    }
    
    const [result] = await pool.execute(
      'INSERT INTO tasks (title, description, status, priority, due_date, project_id, organization_id, reporter_id, assignee_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [title, description, status, priority, dueDate, projectId, organizationId, userId, userId]
    );

    // Get the inserted task
    const [insertedTask] = await pool.execute(
      'SELECT t.*, p.name as project_name FROM tasks t LEFT JOIN projects p ON t.project_id = p.id WHERE t.id = ?',
      [(result as any).insertId]
    );

    // Transform snake_case to camelCase for frontend
    const task = (insertedTask as any[])[0];
    const transformedTask = {
      ...task,
      dueDate: task.due_date,
      createdAt: task.created_at,
      updatedAt: task.updated_at,
      projectId: task.project_id,
      userId: task.assignee_id || task.reporter_id,
      projectName: task.project_name
    };

    res.status(201).json(transformedTask);
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

    if ((result as any).affectedRows === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Get the updated task
    const [updatedTask] = await pool.execute(
      'SELECT t.*, p.name as project_name FROM tasks t LEFT JOIN projects p ON t.project_id = p.id WHERE t.id = ?',
      [id]
    );

    // Transform snake_case to camelCase for frontend
    const task = (updatedTask as any[])[0];
    const transformedTask = {
      ...task,
      dueDate: task.due_date,
      createdAt: task.created_at,
      updatedAt: task.updated_at,
      projectId: task.project_id,
      userId: task.user_id,
      projectName: task.project_name
    };

    res.json(transformedTask);
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

    if ((result as any).affectedRows === 0) {
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
    
    // Transform snake_case to camelCase for frontend
    const transformedRows = (rows as any[]).map(row => ({
      ...row,
      dueDate: row.due_date,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      projectId: row.project_id,
      userId: row.user_id,
      projectName: row.project_name
    }));
    
    res.json(transformedRows);
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

    // Transform snake_case to camelCase for frontend
    const transformedTasks = (updatedTasks as any[]).map(row => ({
      ...row,
      dueDate: row.due_date,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      projectId: row.project_id,
      userId: row.user_id,
      projectName: row.project_name
    }));

    res.json(transformedTasks);
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

    res.json({ deletedCount: (result as any).affectedRows, deletedIds: ids });
  } catch (error) {
    console.error('Error bulk deleting tasks:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
