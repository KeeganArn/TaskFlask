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
  PaginatedResponse,
  ChatRoom,
  Message,
  CreateChatRoomRequest,
  CreateMessageRequest,
  User
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
  },

  updateUserStatus: (status: string) =>
    api.put('/auth/status', { user_status: status }).then(res => res.data)
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

// Messages API
export const messagesApi = {
  // Chat rooms
  getRooms: () => 
    api.get<ChatRoom[]>('/messages/rooms').then(res => res.data),
    
  createRoom: (data: CreateChatRoomRequest) => 
    api.post<ChatRoom>('/messages/rooms', data).then(res => res.data),
    
  // Messages
  getMessages: (roomId: number, page = 1, limit = 50) => 
    api.get<Message[]>(`/messages/rooms/${roomId}/messages`, { 
      params: { page, limit } 
    }).then(res => res.data),
    
  sendMessage: (roomId: number, data: CreateMessageRequest) => 
    api.post<Message>(`/messages/rooms/${roomId}/messages`, data).then(res => res.data),
    
  // Contacts
  getContacts: () => 
    api.get<User[]>('/messages/contacts').then(res => res.data),
    
  // Utility function to create direct message room
  createDirectMessage: (userId: number) => 
    api.post<ChatRoom>('/messages/rooms', {
      type: 'direct',
      participant_ids: [userId]
    }).then(res => res.data),
};

// Subscriptions API
export const subscriptionsApi = {
  getPlans: () => 
    api.get('/subscriptions/plans').then(res => res.data),
    
  getCurrentSubscription: () => 
    api.get('/subscriptions/current').then(res => res.data),
    
  getUsage: () => 
    api.get('/subscriptions/usage').then(res => res.data),
    
  upgradePlan: (planSlug: string, billingCycle: 'monthly' | 'yearly' = 'monthly') => 
    api.post('/subscriptions/upgrade', { plan_slug: planSlug, billing_cycle: billingCycle }).then(res => res.data),
    
  checkFeature: (feature: string) => 
    api.get(`/subscriptions/features/${feature}`).then(res => res.data),
    
  getAllFeatures: () => 
    api.get('/subscriptions/features').then(res => res.data),
};

// CRM API
export const crmApi = {
  listCompanies: () => api.get('/crm/companies').then(res => res.data),
  createCompany: (data: { name: string; domain?: string; phone?: string; website?: string; address?: string; tags?: string[]; owner_user_id?: number }) =>
    api.post('/crm/companies', data).then(res => res.data),
  updateCompany: (id: number, data: Partial<{ name: string; domain: string; phone: string; website: string; address: string; tags: string[]; owner_user_id: number }>) =>
    api.put(`/crm/companies/${id}`, data).then(res => res.data),

  listContacts: () => api.get('/crm/contacts').then(res => res.data),
  createContact: (data: { company_id?: number; first_name?: string; last_name?: string; email?: string; phone?: string; title?: string; tags?: string[]; owner_user_id?: number }) =>
    api.post('/crm/contacts', data).then(res => res.data),
  updateContact: (id: number, data: Partial<{ company_id: number; first_name: string; last_name: string; email: string; phone: string; title: string; tags: string[]; owner_user_id: number }>) =>
    api.put(`/crm/contacts/${id}`, data).then(res => res.data),

  listStages: () => api.get('/crm/stages').then(res => res.data),
  seedStages: () => api.post('/crm/stages/seed', {}).then(res => res.data),

  listDeals: () => api.get('/crm/deals').then(res => res.data),
  createDeal: (data: { company_id?: number; contact_id?: number; name: string; stage_id?: number; amount?: number; currency?: string; expected_close?: string; owner_user_id?: number; source?: string; notes?: string }) =>
    api.post('/crm/deals', data).then(res => res.data),
  updateDeal: (id: number, data: Partial<{ company_id: number; contact_id: number; name: string; stage_id: number; amount: number; currency: string; expected_close: string; owner_user_id: number; source: string; notes: string }>) =>
    api.put(`/crm/deals/${id}`, data).then(res => res.data),

  listActivities: () => api.get('/crm/activities').then(res => res.data),
  createActivity: (data: { deal_id?: number; company_id?: number; contact_id?: number; type: 'call'|'meeting'|'email'|'task'|'note'; subject?: string; content?: string; due_at?: string }) =>
    api.post('/crm/activities', data).then(res => res.data),
};

// Documents API
export const documentsApi = {
  list: () => api.get('/documents').then(res => res.data),
  create: (data: { title: string; content?: string; visibility?: 'org' | 'private' }) =>
    api.post('/documents', data).then(res => res.data),
  get: (id: number) => api.get(`/documents/${id}`).then(res => res.data),
  update: (id: number, data: { title?: string; content?: string; visibility?: 'org' | 'private' }) =>
    api.put(`/documents/${id}`, data).then(res => res.data),
  remove: (id: number) => api.delete(`/documents/${id}`).then(res => res.data),
  startView: (id: number) => api.post(`/documents/${id}/view/start`).then(res => res.data),
  heartbeat: (sessionId: number) => api.post(`/documents/views/${sessionId}/heartbeat`).then(res => res.data),
  endView: (sessionId: number) => api.post(`/documents/views/${sessionId}/end`).then(res => res.data),
  activeViews: () => api.get('/documents/views/active').then(res => res.data)
};

// Calls API
export const callsApi = {
  initiateCall: (chatRoomId: number, callType: 'audio' | 'video', participantIds: number[] = []) =>
    api.post('/calls/initiate', {
      chat_room_id: chatRoomId,
      call_type: callType,
      participant_ids: participantIds
    }).then(res => res.data),

  joinCall: (roomId: string) =>
    api.post(`/calls/${roomId}/join`).then(res => res.data),

  leaveCall: (roomId: string) =>
    api.post(`/calls/${roomId}/leave`).then(res => res.data),

  getParticipants: (roomId: string) =>
    api.get(`/calls/${roomId}/participants`).then(res => res.data),

  updateParticipantSettings: (roomId: string, settings: any) =>
    api.put(`/calls/${roomId}/participant/settings`, settings).then(res => res.data),
};

// Time Tracking API
export const timeTrackingApi = {
  getSessions: (params?: { task_id?: number; start_date?: string; end_date?: string; limit?: number; offset?: number }) =>
    api.get('/time-tracking/sessions', { params }).then(res => res.data),

  startSession: (taskId: number, description?: string, isBillable?: boolean, hourlyRate?: number) =>
    api.post('/time-tracking/sessions', {
      task_id: taskId,
      description,
      is_billable: isBillable,
      hourly_rate: hourlyRate
    }).then(res => res.data),

  stopSession: (sessionId: number) =>
    api.put(`/time-tracking/sessions/${sessionId}/stop`).then(res => res.data),

  getActiveSession: () =>
    api.get('/time-tracking/active').then(res => res.data),

  getStats: (period?: 'today' | 'week' | 'month') =>
    api.get('/time-tracking/stats', { params: { period } }).then(res => res.data),

  updateSession: (sessionId: number, data: { description?: string; is_billable?: boolean; hourly_rate?: number }) =>
    api.put(`/time-tracking/sessions/${sessionId}`, data).then(res => res.data),

  deleteSession: (sessionId: number) =>
    api.delete(`/time-tracking/sessions/${sessionId}`).then(res => res.data),
};

// Analytics API
export const analyticsApi = {
  getOverview: (period?: number) =>
    api.get('/analytics/overview', { params: { period } }).then(res => res.data),

  getTimeTrackingAnalytics: (period?: number) =>
    api.get('/analytics/time-tracking', { params: { period } }).then(res => res.data),

  getTaskAnalytics: (period?: number) =>
    api.get('/analytics/tasks', { params: { period } }).then(res => res.data),

  getProjectAnalytics: () =>
    api.get('/analytics/projects').then(res => res.data),
};

export default api;

// Clients & Tickets APIs
export const clientsApi = {
  list: () => api.get('/clients').then(res => res.data),
  create: (data: { name: string; email: string; phone?: string; company?: string }) =>
    api.post('/clients', data).then(res => res.data),
  update: (id: number, data: Partial<{ name: string; email: string; phone?: string; company?: string; status?: 'active' | 'inactive' }>) =>
    api.put(`/clients/${id}`, data).then(res => res.data),
  remove: (id: number) => api.delete(`/clients/${id}`).then(res => res.data),
  createUser: (clientId: number, data: { email: string; password_hash: string; first_name?: string; last_name?: string }) =>
    api.post(`/clients/${clientId}/users`, data).then(res => res.data),
  // helper to hash on frontend for now (avoid sending raw password to server's route expecting hash)
  hashPassword: async (password: string): Promise<string> => {
    // Lightweight hash emulation; in production, create a dedicated endpoint to create client user with raw password
    const { default: bcrypt } = await import('bcryptjs');
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }
};

export const ticketsApi = {
  listTypes: () => api.get('/tickets/types').then(res => res.data),
  createType: (data: { key_slug: string; display_name: string; description?: string }) =>
    api.post('/tickets/types', data).then(res => res.data),
  updateType: (id: number, data: Partial<{ key_slug: string; display_name: string; description?: string; is_active?: boolean }>) =>
    api.put(`/tickets/types/${id}`, data).then(res => res.data),

  list: () => api.get('/tickets').then(res => res.data),
  create: (data: { ticket_type_id: number; title: string; description?: string; priority?: string; assigned_user_id?: number }) =>
    api.post('/tickets', data).then(res => res.data),
  update: (id: number, data: Partial<{ title: string; description?: string; status?: string; priority?: string; assigned_user_id?: number }>) =>
    api.put(`/tickets/${id}`, data).then(res => res.data),
  addComment: (id: number, comment: string) =>
    api.post(`/tickets/${id}/comments`, { comment }).then(res => res.data),
  getById: (id: number) => api.get(`/tickets/${id}`).then(res => res.data),
  exportCsv: (filters?: Record<string, string | number>) => {
    const params = new URLSearchParams();
    if (filters) Object.entries(filters).forEach(([k,v]) => params.append(k, String(v)));
    return api.get(`/tickets/export/csv?${params.toString()}`, { responseType: 'blob' }).then(res => res.data);
  },
  listAttachments: (id: number) => api.get(`/tickets/${id}/attachments`).then(res => res.data),
  addAttachment: (id: number, data: { url: string; file_name: string; file_size?: number; comment_id?: number }) =>
    api.post(`/tickets/${id}/attachments`, data).then(res => res.data),
};