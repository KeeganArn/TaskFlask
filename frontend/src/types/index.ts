// Frontend types for the consolidated system

export interface Organization {
  id: number;
  name: string;
  slug: string;
  description?: string;
  logo_url?: string;
  invite_code: string;
  invite_code_enabled: boolean;
  subscription_plan: 'free' | 'basic' | 'premium' | 'enterprise';
  max_users: number;
  max_projects: number;
  settings?: any;
  created_at: string;
  updated_at: string;
  stats?: {
    member_count: number;
    project_count: number;
    task_count: number;
  };
}

export interface Role {
  id: number;
  name: string;
  display_name: string;
  description?: string;
  permissions: string[];
  is_system_role: boolean;
  organization_id?: number;
  created_at: string;
  updated_at: string;
  member_count?: number;
}

export interface User {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  phone?: string;
  timezone: string;
  language: string;
  organization_id?: number;
  user_status?: 'online' | 'busy' | 'dnd' | 'offline';
  status_message?: string;
  last_seen?: string;
  is_active: boolean;
  email_verified: boolean;
  last_login?: string;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: number;
  organization_id: number;
  user_id: number;
  role_id: number;
  invited_by?: number;
  invited_at: string;
  joined_at?: string;
  status: 'pending' | 'active' | 'suspended' | 'left';
  created_at: string;
  updated_at: string;
  user?: User;
  role?: Role;
  organization?: Organization;
  invited_by_user?: User;
}

export interface Project {
  id: number;
  name: string;
  description?: string;
  organization_id: number;
  owner_id: number;
  status: 'active' | 'archived' | 'completed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  start_date?: string;
  end_date?: string;
  budget?: number;
  color_code?: string;
  settings?: any;
  created_at: string;
  updated_at: string;
  owner?: User;
  organization?: Organization;
  members?: ProjectMember[];
  stats?: {
    task_count: number;
    completed_tasks: number;
    member_count: number;
    completion_rate: number;
  };
}

export interface ProjectMember {
  id: number;
  project_id: number;
  user_id: number;
  role: 'viewer' | 'contributor' | 'manager';
  permissions?: any;
  added_by?: number;
  added_at: string;
  user?: User;
  project?: Project;
}

export interface Task {
  id: number;
  title: string;
  description?: string;
  status: 'backlog' | 'todo' | 'in-progress' | 'review' | 'completed' | 'cancelled';
  priority: 'lowest' | 'low' | 'medium' | 'high' | 'highest';
  due_date?: string;
  start_date?: string;
  estimated_hours?: number;
  actual_hours?: number;
  progress_percentage: number;
  project_id: number;
  organization_id: number;
  assignee_id?: number;
  reporter_id: number;
  parent_task_id?: number;
  sprint_id?: number;
  labels?: string[];
  attachments?: any[];
  created_at: string;
  updated_at: string;
  project?: {
    id: number;
    name: string;
    color_code?: string;
  };
  assignee?: User;
  reporter?: User;
  parent_task?: {
    id: number;
    title: string;
  };
  subtasks?: Task[];
  comments?: TaskComment[];
  time_entries?: TimeEntry[];
}

export interface TaskComment {
  id: number;
  task_id: number;
  user_id: number;
  comment?: string;
  comment_type: 'comment' | 'status_change' | 'assignment' | 'attachment';
  metadata?: any;
  created_at: string;
  updated_at: string;
  user?: User;
  task?: Task;
}

export interface TimeEntry {
  id: number;
  task_id: number;
  user_id: number;
  description?: string;
  hours: number;
  date_logged: string;
  is_billable: boolean;
  hourly_rate?: number;
  created_at: string;
  updated_at: string;
  task?: Task;
  user?: User;
}

export interface Invitation {
  id: number;
  email: string;
  organization_id: number;
  role_id: number;
  invited_by: number;
  token: string;
  expires_at: string;
  accepted_at?: string;
  created_at: string;
  organization?: Organization;
  role?: Role;
  invited_by_user?: User;
  is_expired?: boolean;
}

// Request types
export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
  organization_name?: string; // For creating new organization
  organization_slug?: string; // For creating new organization
  organization_invite_code?: string; // For joining existing organization with code
  invitation_token?: string; // For joining existing organization via email invitation
}

export interface LoginRequest {
  email: string;
  password: string;
  organization_slug?: string; // Optional organization context
}

export interface AuthResponse {
  message: string;
  user: User;
  token: string;
  organization?: Organization;
  membership?: OrganizationMember;
  permissions: string[];
  organizations?: Array<{
    id: number;
    name: string;
    slug: string;
    role: string;
  }>;
  requireOrganizationSelection?: boolean;
}

export interface InviteUserRequest {
  email: string;
  role_id: number;
}

export interface CreateRoleRequest {
  name: string;
  display_name: string;
  description: string;
  permissions: string[];
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  status?: 'active' | 'archived' | 'completed';
  priority?: 'low' | 'medium' | 'high' | 'critical';
  start_date?: string;
  end_date?: string;
  budget?: number;
  color_code?: string;
  member_ids?: number[];
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  status?: 'active' | 'archived' | 'completed';
  priority?: 'low' | 'medium' | 'high' | 'critical';
  start_date?: string;
  end_date?: string;
  budget?: number;
  color_code?: string;
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  status?: 'backlog' | 'todo' | 'in-progress' | 'review' | 'completed' | 'cancelled';
  priority?: 'lowest' | 'low' | 'medium' | 'high' | 'highest';
  due_date?: string;
  start_date?: string;
  estimated_hours?: number;
  project_id: number;
  assignee_id?: number;
  parent_task_id?: number;
  labels?: string[];
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  status?: 'backlog' | 'todo' | 'in-progress' | 'review' | 'completed' | 'cancelled';
  priority?: 'lowest' | 'low' | 'medium' | 'high' | 'highest';
  due_date?: string;
  start_date?: string;
  estimated_hours?: number;
  actual_hours?: number;
  progress_percentage?: number;
  assignee_id?: number;
  labels?: string[];
}

export interface CreateTimeEntryRequest {
  description?: string;
  hours: number;
  date_logged: string;
  is_billable?: boolean;
  hourly_rate?: number;
}

export interface TaskFilters {
  status?: string;
  priority?: string;
  assignee_id?: number | string;
  project_id?: number;
  search?: string;
  due_date_from?: string;
  due_date_to?: string;
  page?: number;
  limit?: number;
}

export interface ProjectStats {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  completionRate: number;
  totalEstimatedHours: number;
  totalActualHours: number;
  totalTimeLogged: number;
  activeContributors: number;
  billableAmount: number;
  memberCount: number;
}

// Auth context type
export interface AuthContextType {
  user: User | null;
  organization: Organization | null;
  permissions: string[];
  token: string | null;
  login: (credentials: LoginRequest) => Promise<AuthResponse>;
  register: (data: RegisterRequest) => Promise<AuthResponse>;
  logout: () => void;
  selectOrganization: (orgSlug: string) => Promise<void>;
  hasPermission: (permission: string) => boolean;
  isLoading: boolean;
}

// Utility types
export type Permission = string;

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Messaging types
export interface ChatRoom {
  id: number;
  name?: string;
  type: 'direct' | 'group' | 'project' | 'general';
  organization_id: number;
  project_id?: number;
  created_by: number;
  description?: string;
  is_private: boolean;
  last_message_at?: string;
  created_at: string;
  updated_at: string;
  participant_count?: number;
  unread_count?: number;
  last_message?: Message;
  participants?: ChatParticipant[];
}

export interface ChatParticipant {
  id: number;
  chat_room_id: number;
  user_id: number;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
  last_read_at?: string;
  notifications_enabled: boolean;
  is_active: boolean;
  user?: User;
}

export interface Message {
  id: number;
  chat_room_id: number;
  sender_id: number;
  content: string;
  message_type: 'text' | 'file' | 'image' | 'system';
  reply_to_message_id?: number;
  file_url?: string;
  file_name?: string;
  file_size?: number;
  edited_at?: string;
  deleted_at?: string;
  created_at: string;
  updated_at: string;
  sender?: User;
  reply_to_message?: Message;
  reactions?: MessageReaction[];
}

export interface MessageReaction {
  id: number;
  message_id: number;
  user_id: number;
  emoji: string;
  created_at: string;
  user?: User;
}

export interface CreateChatRoomRequest {
  name?: string;
  type: 'direct' | 'group' | 'project' | 'general';
  description?: string;
  is_private?: boolean;
  project_id?: number;
  participant_ids: number[];
}

export interface CreateMessageRequest {
  content: string;
  message_type?: 'text' | 'file' | 'image';
  reply_to_message_id?: number;
  file_url?: string;
  file_name?: string;
  file_size?: number;
}