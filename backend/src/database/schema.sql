-- Enhanced Flowbit App Database Schema (MySQL Compatible)
-- Version 2.0 - Multi-tenant with Role-Based Access Control

-- Create organizations table
CREATE TABLE IF NOT EXISTS organizations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(50) UNIQUE NOT NULL, -- URL-friendly identifier
    description TEXT,
    logo_url VARCHAR(255),
    invite_code VARCHAR(20) UNIQUE NOT NULL, -- Unique code for employees to join
    invite_code_enabled BOOLEAN DEFAULT TRUE, -- Can disable code-based invites
    default_role_id INT, -- Default role for new members joining via invite code
    subscription_plan ENUM('free', 'basic', 'premium', 'enterprise') DEFAULT 'free',
    max_users INT DEFAULT 5, -- Based on subscription plan
    max_projects INT DEFAULT 10, -- Based on subscription plan
    settings JSON, -- Organization-specific settings
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (default_role_id) REFERENCES roles(id) ON DELETE SET NULL
);

-- Create roles table for RBAC
CREATE TABLE IF NOT EXISTS roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    permissions JSON, -- Store permissions as JSON array
    is_system_role BOOLEAN DEFAULT FALSE, -- System roles can't be deleted
    organization_id INT, -- NULL for system roles, specific for custom org roles
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    UNIQUE KEY unique_role_per_org (name, organization_id)
);

-- Enhanced users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    avatar_url VARCHAR(255),
    phone VARCHAR(20),
    timezone VARCHAR(50) DEFAULT 'UTC',
    language VARCHAR(10) DEFAULT 'en',
    organization_id INT, -- Organization this user belongs to
    user_status ENUM('online', 'busy', 'dnd', 'offline') DEFAULT 'online', -- User's current status
    status_message VARCHAR(100), -- Optional status message
    last_seen TIMESTAMP NULL, -- When user was last active
    is_active BOOLEAN DEFAULT TRUE,
    email_verified BOOLEAN DEFAULT FALSE,
    email_verification_token VARCHAR(255),
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMP NULL,
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL
);

-- Organization memberships with roles
CREATE TABLE IF NOT EXISTS organization_members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    organization_id INT NOT NULL,
    user_id INT NOT NULL,
    role_id INT NOT NULL,
    invited_by INT, -- User who invited this member
    invited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    joined_at TIMESTAMP NULL, -- When user accepted invitation
    status ENUM('pending', 'active', 'suspended', 'left') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT,
    FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY unique_user_per_org (organization_id, user_id)
);

-- Enhanced projects table with organization context
CREATE TABLE IF NOT EXISTS projects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    organization_id INT NOT NULL,
    owner_id INT NOT NULL, -- Project owner
    status ENUM('active', 'archived', 'completed') DEFAULT 'active',
    priority ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
    start_date DATE,
    end_date DATE,
    budget DECIMAL(10,2),
    color_code VARCHAR(7), -- Hex color for UI
    settings JSON, -- Project-specific settings
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE RESTRICT
);

-- Project members with specific roles/permissions
CREATE TABLE IF NOT EXISTS project_members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    user_id INT NOT NULL,
    role ENUM('viewer', 'contributor', 'manager') DEFAULT 'contributor',
    permissions JSON, -- Specific permissions for this project
    added_by INT,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY unique_user_per_project (project_id, user_id)
);

-- Enhanced tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    status ENUM('backlog', 'todo', 'in-progress', 'review', 'completed', 'cancelled') DEFAULT 'todo',
    priority ENUM('lowest', 'low', 'medium', 'high', 'highest') DEFAULT 'medium',
    due_date DATE,
    start_date DATE,
    estimated_hours DECIMAL(5,2),
    actual_hours DECIMAL(5,2),
    progress_percentage INT DEFAULT 0,
    project_id INT NOT NULL,
    organization_id INT NOT NULL,
    assignee_id INT, -- Assigned user
    reporter_id INT NOT NULL, -- User who created the task
    parent_task_id INT, -- For subtasks
    sprint_id INT, -- For agile workflows
    labels JSON, -- Array of labels/tags
    attachments JSON, -- Array of file attachments
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (parent_task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- Task comments/activity log
CREATE TABLE IF NOT EXISTS task_comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    task_id INT NOT NULL,
    user_id INT NOT NULL,
    comment TEXT,
    comment_type ENUM('comment', 'status_change', 'assignment', 'attachment') DEFAULT 'comment',
    metadata JSON, -- Additional data for different comment types
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Time tracking
CREATE TABLE IF NOT EXISTS time_entries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    task_id INT NOT NULL,
    user_id INT NOT NULL,
    description TEXT,
    hours DECIMAL(5,2) NOT NULL,
    date_logged DATE NOT NULL,
    is_billable BOOLEAN DEFAULT FALSE,
    hourly_rate DECIMAL(8,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Audit log for important actions
CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    organization_id INT,
    user_id INT,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id INT,
    old_values JSON,
    new_values JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Invitations for new users
CREATE TABLE IF NOT EXISTS invitations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(100) NOT NULL,
    organization_id INT NOT NULL,
    role_id INT NOT NULL,
    invited_by INT NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    accepted_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_organization ON users(organization_id);
CREATE INDEX idx_users_status ON users(user_status);
CREATE INDEX idx_users_last_seen ON users(last_seen);
CREATE INDEX idx_users_email_verification ON users(email_verification_token);
CREATE INDEX idx_users_password_reset ON users(password_reset_token);
CREATE INDEX idx_org_members_org_user ON organization_members(organization_id, user_id);
CREATE INDEX idx_org_members_user ON organization_members(user_id);
CREATE INDEX idx_org_members_status ON organization_members(status);
CREATE INDEX idx_projects_organization ON projects(organization_id);
CREATE INDEX idx_projects_owner ON projects(owner_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_project_members_project ON project_members(project_id);
CREATE INDEX idx_project_members_user ON project_members(user_id);
CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_tasks_organization ON tasks(organization_id);
CREATE INDEX idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX idx_tasks_reporter ON tasks(reporter_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_task_comments_task ON task_comments(task_id);
CREATE INDEX idx_time_entries_task ON time_entries(task_id);
CREATE INDEX idx_time_entries_user ON time_entries(user_id);
CREATE INDEX idx_time_entries_date ON time_entries(date_logged);
CREATE INDEX idx_audit_logs_org ON audit_logs(organization_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_invitations_email ON invitations(email);

-- Insert default system roles
INSERT INTO roles (name, display_name, description, permissions, is_system_role, organization_id) VALUES
('super_admin', 'Super Admin', 'Full system access across all organizations', '["*"]', TRUE, NULL),
('org_owner', 'Organization Owner', 'Full access within organization', '["org.*", "projects.*", "tasks.*", "users.*", "settings.*"]', TRUE, NULL),
('org_admin', 'Organization Admin', 'Administrative access within organization', '["projects.*", "tasks.*", "users.view", "users.invite", "settings.view"]', TRUE, NULL),
('project_manager', 'Project Manager', 'Manage projects and teams', '["projects.view", "projects.edit", "projects.create", "tasks.*", "users.view"]', TRUE, NULL),
('team_lead', 'Team Lead', 'Lead team members and manage assigned projects', '["projects.view", "projects.edit", "tasks.*", "users.view"]', TRUE, NULL),
('developer', 'Developer', 'Work on tasks and projects', '["projects.view", "tasks.view", "tasks.edit", "tasks.create", "tasks.comment"]', TRUE, NULL),
('viewer', 'Viewer', 'Read-only access to assigned projects', '["projects.view", "tasks.view"]', TRUE, NULL);
