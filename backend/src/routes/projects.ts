import { Router, Request, Response } from 'express';
import { Project, CreateProjectRequest, UpdateProjectRequest } from '../types';
import { projects } from '../data/mockData';

const router = Router();

// GET /projects - Get all projects
router.get('/', (req: Request, res: Response) => {
  res.json(projects);
});

// GET /projects/:id - Get project by ID
router.get('/:id', (req: Request, res: Response) => {
  const project = projects.find(p => p.id === req.params.id);
  if (!project) {
    return res.status(404).json({ message: 'Project not found' });
  }
  res.json(project);
});

// POST /projects - Create new project
router.post('/', (req: Request<{}, {}, CreateProjectRequest>, res: Response) => {
  const { name, description } = req.body;
  
  if (!name || !description) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  const newProject: Project = {
    id: Date.now().toString(),
    name,
    description,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  projects.push(newProject);
  res.status(201).json(newProject);
});

// PUT /projects/:id - Update project
router.put('/:id', (req: Request<{ id: string }, {}, UpdateProjectRequest>, res: Response) => {
  const projectIndex = projects.findIndex(p => p.id === req.params.id);
  if (projectIndex === -1) {
    return res.status(404).json({ message: 'Project not found' });
  }

  const updatedProject = {
    ...projects[projectIndex],
    ...req.body,
    updatedAt: new Date().toISOString()
  };

  projects[projectIndex] = updatedProject;
  res.json(updatedProject);
});

// DELETE /projects/:id - Delete project
router.delete('/:id', (req: Request, res: Response) => {
  const projectIndex = projects.findIndex(p => p.id === req.params.id);
  if (projectIndex === -1) {
    return res.status(404).json({ message: 'Project not found' });
  }

  projects.splice(projectIndex, 1);
  res.status(204).send();
});

export default router;
