import { Router, Request, Response } from 'express';
import { Task, CreateTaskRequest, UpdateTaskRequest } from '../types';
import { tasks } from '../data/mockData';

const router = Router();

// GET /tasks - Get all tasks
router.get('/', (req: Request, res: Response) => {
  res.json(tasks);
});

// GET /tasks/:id - Get task by ID
router.get('/:id', (req: Request, res: Response) => {
  const task = tasks.find(t => t.id === req.params.id);
  if (!task) {
    return res.status(404).json({ message: 'Task not found' });
  }
  res.json(task);
});

// POST /tasks - Create new task
router.post('/', (req: Request<{}, {}, CreateTaskRequest>, res: Response) => {
  const { title, description, status, priority, dueDate, projectId } = req.body;
  
  if (!title || !description || !status || !priority || !dueDate || !projectId) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  const newTask: Task = {
    id: Date.now().toString(),
    title,
    description,
    status,
    priority,
    dueDate,
    projectId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  tasks.push(newTask);
  res.status(201).json(newTask);
});

// PUT /tasks/:id - Update task
router.put('/:id', (req: Request<{ id: string }, {}, UpdateTaskRequest>, res: Response) => {
  const taskIndex = tasks.findIndex(t => t.id === req.params.id);
  if (taskIndex === -1) {
    return res.status(404).json({ message: 'Task not found' });
  }

  const updatedTask = {
    ...tasks[taskIndex],
    ...req.body,
    updatedAt: new Date().toISOString()
  };

  tasks[taskIndex] = updatedTask;
  res.json(updatedTask);
});

// DELETE /tasks/:id - Delete task
router.delete('/:id', (req: Request, res: Response) => {
  const taskIndex = tasks.findIndex(t => t.id === req.params.id);
  if (taskIndex === -1) {
    return res.status(404).json({ message: 'Task not found' });
  }

  tasks.splice(taskIndex, 1);
  res.status(204).send();
});

export default router;
