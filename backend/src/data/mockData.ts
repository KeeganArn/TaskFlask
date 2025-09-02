import { Task, Project } from '../types';

export const tasks: Task[] = [
  {
    id: '1',
    title: 'Setup project structure',
    description: 'Initialize the basic project structure with folders and files',
    status: 'completed',
    priority: 'high',
    dueDate: '2024-01-15',
    projectId: '1',
    createdAt: '2024-01-10T10:00:00Z',
    updatedAt: '2024-01-12T15:30:00Z'
  },
  {
    id: '2',
    title: 'Design database schema',
    description: 'Create the database schema for tasks and projects',
    status: 'in-progress',
    priority: 'high',
    dueDate: '2024-01-20',
    projectId: '1',
    createdAt: '2024-01-10T10:00:00Z',
    updatedAt: '2024-01-14T09:15:00Z'
  },
  {
    id: '3',
    title: 'Implement user authentication',
    description: 'Add login and registration functionality',
    status: 'todo',
    priority: 'medium',
    dueDate: '2024-01-25',
    projectId: '1',
    createdAt: '2024-01-10T10:00:00Z',
    updatedAt: '2024-01-10T10:00:00Z'
  },
  {
    id: '4',
    title: 'Create marketing materials',
    description: 'Design brochures and social media content',
    status: 'todo',
    priority: 'low',
    dueDate: '2024-02-01',
    projectId: '2',
    createdAt: '2024-01-12T14:00:00Z',
    updatedAt: '2024-01-12T14:00:00Z'
  }
];

export const projects: Project[] = [
  {
    id: '1',
    name: 'Task Management App',
    description: 'A full-stack application for managing tasks and projects',
    createdAt: '2024-01-10T10:00:00Z',
    updatedAt: '2024-01-10T10:00:00Z'
  },
  {
    id: '2',
    name: 'Marketing Campaign',
    description: 'Q1 marketing campaign for product launch',
    createdAt: '2024-01-12T14:00:00Z',
    updatedAt: '2024-01-12T14:00:00Z'
  }
];
