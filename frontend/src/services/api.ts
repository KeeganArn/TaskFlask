import axios from 'axios';
import { 
  Task, 
  Project, 
  User,
  CreateTaskRequest, 
  UpdateTaskRequest, 
  CreateProjectRequest, 
  UpdateProjectRequest,
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  TaskFilters,
  ProjectStats
} from '../types';

const API_BASE_URL = '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Tasks API
export const tasksApi = {
  getAll: (filters?: TaskFilters) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'all') {
          params.append(key, value);
        }
      });
    }
    return api.get<Task[]>(`/tasks?${params.toString()}`).then(res => res.data);
  },
  getById: (id: string) => api.get<Task>(`/tasks/${id}`).then(res => res.data),
  create: (data: CreateTaskRequest) => api.post<Task>('/tasks', data).then(res => res.data),
  update: (id: string, data: UpdateTaskRequest) => api.put<Task>(`/tasks/${id}`, data).then(res => res.data),
  delete: (id: string) => api.delete(`/tasks/${id}`),
  bulkUpdate: (ids: string[], updates: Partial<UpdateTaskRequest>) => 
    api.patch('/tasks/bulk', { ids, updates }).then(res => res.data),
  bulkDelete: (ids: string[]) => 
    api.delete('/tasks/bulk', { data: { ids } }),
  getOverdue: () => api.get<Task[]>('/tasks/overdue').then(res => res.data),
  getByProject: (projectId: string) => api.get<Task[]>(`/projects/${projectId}/tasks`).then(res => res.data),
};

// Projects API
export const projectsApi = {
  getAll: () => api.get<Project[]>('/projects').then(res => res.data),
  getById: (id: string) => api.get<Project>(`/projects/${id}`).then(res => res.data),
  create: (data: CreateProjectRequest) => api.post<Project>('/projects', data).then(res => res.data),
  update: (id: string, data: UpdateProjectRequest) => api.put<Project>(`/projects/${id}`, data).then(res => res.data),
  delete: (id: string) => api.delete(`/projects/${id}`),
  getStats: (id: string) => api.get<ProjectStats>(`/projects/${id}/stats`).then(res => res.data),
  getTasks: (id: string) => api.get<Task[]>(`/projects/${id}/tasks`).then(res => res.data),
};

// Auth API
export const authApi = {
  login: (data: LoginRequest) => 
    api.post<AuthResponse>('/auth/login', data).then(res => res.data),
  register: (data: RegisterRequest) => 
    api.post<AuthResponse>('/auth/register', data).then(res => res.data),
  logout: () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
  },
  getCurrentUser: () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },
  isAuthenticated: () => {
    return !!localStorage.getItem('authToken');
  },
};

// Users API
export const usersApi = {
  getCurrent: () => api.get<User>('/auth/me').then(res => res.data),
  updateProfile: (data: Partial<User>) => api.put<User>('/users/profile', data).then(res => res.data),
  changePassword: (currentPassword: string, newPassword: string) => 
    api.put('/users/password', { currentPassword, newPassword }),
};

export default api;
