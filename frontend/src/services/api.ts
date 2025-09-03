import axios from 'axios';
import {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  InviteUserRequest,
  Task,
  Project,
  Organization,
  OrganizationMember,
  Role,
  Invitation,
  CreateProjectRequest,
  UpdateProjectRequest,
  CreateTaskRequest,
  UpdateTaskRequest,
  CreateTimeEntryRequest,
  TaskFilters,
  ProjectStats,
  TaskComment,
  TimeEntry,
  PaginatedResponse
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

// Handle auth errors and organization context
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      localStorage.removeItem('organization');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Authentication API
export const authApi = {
  login: (data: LoginRequest) => 
    api.post<AuthResponse>('/auth/login', data).then(res => res.data),
    
  register: (data: RegisterRequest) => 
    api.post<AuthResponse>('/auth/register', data).then(res => res.data),
    
  invite: (data: InviteUserRequest) => 
    api.post('/auth/invite', data).then(res => res.data),
    
  getCurrentUser: () => 
    api.get('/auth/me').then(res => res.data),
    
  getUserOrganizations: () => 
    api.get('/auth/organizations').then(res => res.data),
    
  logout: () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    localStorage.removeItem('organization');
    localStorage.removeItem('permissions');
  },
  
  isAuthenticated: () => {
    return !!localStorage.getItem('authToken');
  },
  
  getStoredUser: () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },
  
  getStoredOrganization: () => {
    const org = localStorage.getItem('organization');
    return org ? JSON.parse(org) : null;
  },
  
  getStoredPermissions: () => {
    const permissions = localStorage.getItem('permissions');
    return permissions ? JSON.parse(permissions) : [];
  }
};

// Organizations API
export const organizationsApi = {
  getCurrent: () => 
    api.get<Organization>('/organizations/current').then(res => res.data),
    
  updateCurrent: (data: Partial<Organization>) => 
    api.put<Organization>('/organizations/current', data).then(res => res.data),
    
  getMembers: (params?: { status?: string; role_name?: string; search?: string }) => 
    api.get<OrganizationMember[]>('/organizations/members', { params }).then(res => res.data),
    
  updateMemberRole: (userId: number, roleId: number) => 
    api.put(`/organizations/members/${userId}/role`, { role_id: roleId }).then(res => res.data),
    
  updateMemberStatus: (userId: number, status: string) => 
    api.put(`/organizations/members/${userId}/status`, { status }).then(res => res.data),
    
  removeMember: (userId: number) => 
    api.delete(`/organizations/members/${userId}`),
    
  getRoles: () => 
    api.get<Role[]>('/organizations/roles').then(res => res.data),
    
  createRole: (data: { name: string; display_name: string; description?: string; permissions: string[] }) => 
    api.post<Role>('/organizations/roles', data).then(res => res.data),
    
  updateRole: (id: number, data: { display_name?: string; description?: string; permissions?: string[] }) => 
    api.put<Role>(`/organizations/roles/${id}`, data).then(res => res.data),
    
  deleteRole: (id: number) => 
    api.delete(`/organizations/roles/${id}`),
    
  getInvitations: () => 
    api.get<Invitation[]>('/organizations/invitations').then(res => res.data),
    
  cancelInvitation: (id: number) => 
    api.delete(`/organizations/invitations/${id}`)
};

// Projects API
export const projectsApi = {
  getAll: (params?: { status?: string; priority?: string; search?: string; owner_id?: number }) => 
    api.get<Project[]>('/projects', { params }).then(res => res.data),
    
  getById: (id: number) => 
    api.get<Project>(`/projects/${id}`).then(res => res.data),
    
  create: (data: CreateProjectRequest) => 
    api.post<Project>('/projects', data).then(res => res.data),
    
  update: (id: number, data: UpdateProjectRequest) => 
    api.put<Project>(`/projects/${id}`, data).then(res => res.data),
    
  delete: (id: number) => 
    api.delete(`/projects/${id}`),
    
  getStats: (id: number) => 
    api.get<ProjectStats>(`/projects/${id}/stats`).then(res => res.data),
    
  getTasks: (id: number, params?: { status?: string; priority?: string; assignee_id?: number; search?: string }) => 
    api.get<Task[]>(`/projects/${id}/tasks`, { params }).then(res => res.data),
    
  addMember: (id: number, userId: number, role: string = 'contributor') => 
    api.post(`/projects/${id}/members`, { user_id: userId, role }).then(res => res.data),
    
  removeMember: (id: number, userId: number) => 
    api.delete(`/projects/${id}/members/${userId}`)
};

// Tasks API
export const tasksApi = {
  getAll: (filters?: TaskFilters) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, value.toString());
        }
      });
    }
    return api.get<PaginatedResponse<Task>>(`/tasks?${params.toString()}`).then(res => res.data);
  },
  
  getById: (id: number) => 
    api.get<Task>(`/tasks/${id}`).then(res => res.data),
    
  create: (data: CreateTaskRequest) => 
    api.post<Task>('/tasks', data).then(res => res.data),
    
  update: (id: number, data: UpdateTaskRequest) => 
    api.put<Task>(`/tasks/${id}`, data).then(res => res.data),
    
  delete: (id: number) => 
    api.delete(`/tasks/${id}`),
    
  addComment: (id: number, comment: string, commentType: string = 'comment', metadata?: any) => 
    api.post<TaskComment>(`/tasks/${id}/comments`, { 
      comment, 
      comment_type: commentType, 
      metadata 
    }).then(res => res.data),
    
  logTime: (id: number, data: CreateTimeEntryRequest) => 
    api.post<TimeEntry>(`/tasks/${id}/time`, data).then(res => res.data),
    
  getOverdue: () => 
    api.get<Task[]>('/tasks/overdue').then(res => res.data)
};

// Utility functions
export const hasPermission = (userPermissions: string[], requiredPermission: string): boolean => {
  // Check for wildcard permissions
  if (userPermissions.includes('*')) {
    return true;
  }

  // Check for exact permission
  if (userPermissions.includes(requiredPermission)) {
    return true;
  }

  // Check for wildcard category permissions
  const [category] = requiredPermission.split('.');
  const wildcardPermission = `${category}.*`;
  if (userPermissions.includes(wildcardPermission)) {
    return true;
  }

  return false;
};

export const getDisplayName = (user: { first_name?: string; last_name?: string; username: string }): string => {
  if (user.first_name || user.last_name) {
    return `${user.first_name || ''} ${user.last_name || ''}`.trim();
  }
  return user.username;
};

export const getInitials = (user: { first_name?: string; last_name?: string; username: string }): string => {
  if (user.first_name || user.last_name) {
    const first = user.first_name?.charAt(0)?.toUpperCase() || '';
    const last = user.last_name?.charAt(0)?.toUpperCase() || '';
    return `${first}${last}`;
  }
  return user.username.charAt(0).toUpperCase();
};

export const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString();
};

export const formatDateTime = (dateString: string): string => {
  return new Date(dateString).toLocaleString();
};

export const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'just now';
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }
};

export const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    // Task statuses
    'backlog': 'bg-gray-100 text-gray-800',
    'todo': 'bg-blue-100 text-blue-800',
    'in-progress': 'bg-yellow-100 text-yellow-800',
    'review': 'bg-purple-100 text-purple-800',
    'completed': 'bg-green-100 text-green-800',
    'cancelled': 'bg-red-100 text-red-800',
    
    // Project statuses
    'active': 'bg-green-100 text-green-800',
    'archived': 'bg-gray-100 text-gray-800',
    
    // Member statuses
    'pending': 'bg-yellow-100 text-yellow-800',
    'suspended': 'bg-red-100 text-red-800',
    'left': 'bg-gray-100 text-gray-800'
  };
  
  return colors[status] || 'bg-gray-100 text-gray-800';
};

export const getPriorityColor = (priority: string): string => {
  const colors: Record<string, string> = {
    'lowest': 'bg-gray-100 text-gray-800',
    'low': 'bg-green-100 text-green-800',
    'medium': 'bg-yellow-100 text-yellow-800',
    'high': 'bg-orange-100 text-orange-800',
    'highest': 'bg-red-100 text-red-800',
    'critical': 'bg-red-100 text-red-800'
  };
  
  return colors[priority] || 'bg-gray-100 text-gray-800';
};

export default api;