export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in-progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  dueDate: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  createdAt: string;
}

export interface CreateTaskRequest {
  title: string;
  description: string;
  status: Task['status'];
  priority: Task['priority'];
  dueDate: string;
  projectId: string;
}

export interface UpdateTaskRequest extends Partial<CreateTaskRequest> {}

export interface CreateProjectRequest {
  name: string;
  description: string;
}

export interface UpdateProjectRequest extends Partial<CreateProjectRequest> {}
