import axios from 'axios';
import { Task, Project, CreateTaskRequest, UpdateTaskRequest, CreateProjectRequest, UpdateProjectRequest } from '../types';

const API_BASE_URL = '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Tasks API
export const tasksApi = {
  getAll: () => api.get<Task[]>('/tasks').then(res => res.data),
  getById: (id: string) => api.get<Task>(`/tasks/${id}`).then(res => res.data),
  create: (data: CreateTaskRequest) => api.post<Task>('/tasks', data).then(res => res.data),
  update: (id: string, data: UpdateTaskRequest) => api.put<Task>(`/tasks/${id}`, data).then(res => res.data),
  delete: (id: string) => api.delete(`/tasks/${id}`),
};

// Projects API
export const projectsApi = {
  getAll: () => api.get<Project[]>('/projects').then(res => res.data),
  getById: (id: string) => api.get<Project>(`/projects/${id}`).then(res => res.data),
  create: (data: CreateProjectRequest) => api.post<Project>('/projects', data).then(res => res.data),
  update: (id: string, data: UpdateProjectRequest) => api.put<Project>(`/projects/${id}`, data).then(res => res.data),
  delete: (id: string) => api.delete(`/projects/${id}`),
};

// Auth API
export const authApi = {
  login: (email: string, password: string) => 
    api.post('/auth/login', { email, password }).then(res => res.data),
  register: (username: string, email: string, password: string) => 
    api.post('/auth/register', { username, email, password }).then(res => res.data),
};

export default api;
