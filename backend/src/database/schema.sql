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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
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

-- End of core tables

-- All indexes (created at the end to avoid dependency issues)
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_organization ON users(organization_id);
CREATE INDEX idx_users_status ON users(user_status);
CREATE INDEX idx_users_last_seen ON users(last_seen);
CREATE INDEX idx_organizations_slug ON organizations(slug);

-- Core indexes only
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

-- Chat rooms for messaging
CREATE TABLE chat_rooms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  name VARCHAR(255),
  type ENUM('direct', 'group', 'channel') NOT NULL DEFAULT 'direct',
  description TEXT,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Chat participants
CREATE TABLE chat_participants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  chat_room_id INT NOT NULL,
  user_id INT NOT NULL,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  left_at TIMESTAMP NULL,
  role ENUM('admin', 'member') DEFAULT 'member',
  UNIQUE KEY unique_chat_participant (chat_room_id, user_id)
);

-- Messages
CREATE TABLE messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  chat_room_id INT NOT NULL,
  sender_id INT NOT NULL,
  content TEXT NOT NULL,
  message_type ENUM('text', 'image', 'file', 'system') DEFAULT 'text',
  reply_to_message_id INT NULL,
  edited_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Message reactions
CREATE TABLE message_reactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  message_id INT NOT NULL,
  user_id INT NOT NULL,
  emoji VARCHAR(10) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_reaction (message_id, user_id, emoji)
);

-- Indexes for messaging tables
CREATE INDEX idx_chat_rooms_organization ON chat_rooms(organization_id);
CREATE INDEX idx_chat_rooms_type ON chat_rooms(type);
CREATE INDEX idx_chat_participants_room ON chat_participants(chat_room_id);
CREATE INDEX idx_chat_participants_user ON chat_participants(user_id);
CREATE INDEX idx_messages_room ON messages(chat_room_id);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_created ON messages(created_at);
CREATE INDEX idx_message_reactions_message ON message_reactions(message_id);
CREATE INDEX idx_message_reactions_user ON message_reactions(user_id);

-- Foreign key constraints for messaging tables
ALTER TABLE chat_rooms ADD FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE chat_rooms ADD FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE chat_participants ADD FOREIGN KEY (chat_room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE;
ALTER TABLE chat_participants ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE messages ADD FOREIGN KEY (chat_room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE;
ALTER TABLE messages ADD FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE messages ADD FOREIGN KEY (reply_to_message_id) REFERENCES messages(id) ON DELETE SET NULL;
ALTER TABLE message_reactions ADD FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE;
ALTER TABLE message_reactions ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Subscription Plans
CREATE TABLE subscription_plans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL,
  price_monthly DECIMAL(10,2) NOT NULL,
  price_yearly DECIMAL(10,2) NOT NULL,
  max_users INT DEFAULT NULL, -- NULL = unlimited
  max_organizations INT DEFAULT NULL, -- NULL = unlimited
  max_storage_gb INT DEFAULT 1,
  features JSON DEFAULT '[]',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Organization Subscriptions
CREATE TABLE organization_subscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  plan_id INT NOT NULL,
  status ENUM('active', 'past_due', 'canceled', 'trialing') DEFAULT 'trialing',
  billing_cycle ENUM('monthly', 'yearly') DEFAULT 'monthly',
  current_period_start DATE NOT NULL,
  current_period_end DATE NOT NULL,
  trial_end DATE DEFAULT NULL,
  canceled_at TIMESTAMP NULL,
  stripe_subscription_id VARCHAR(255) NULL,
  stripe_customer_id VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Usage Tracking
CREATE TABLE usage_tracking (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  metric_name VARCHAR(50) NOT NULL, -- 'storage_used', 'api_calls', 'users_count'
  metric_value BIGINT NOT NULL,
  recorded_at DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_org_metric_date (organization_id, metric_name, recorded_at)
);

-- Billing History
CREATE TABLE billing_invoices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  subscription_id INT NOT NULL,
  stripe_invoice_id VARCHAR(255) UNIQUE,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  status ENUM('pending', 'paid', 'failed', 'refunded') DEFAULT 'pending',
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  paid_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Time Tracking (Pro Feature)
CREATE TABLE time_tracking_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  task_id INT NOT NULL,
  organization_id INT NOT NULL,
  description TEXT,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NULL,
  duration_minutes INT DEFAULT 0,
  is_billable BOOLEAN DEFAULT FALSE,
  hourly_rate DECIMAL(8,2) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Custom Branding (Pro Feature)
CREATE TABLE organization_branding (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL UNIQUE,
  logo_url VARCHAR(500),
  primary_color VARCHAR(7) DEFAULT '#3B82F6',
  secondary_color VARCHAR(7) DEFAULT '#1E40AF',
  accent_color VARCHAR(7) DEFAULT '#F59E0B',
  custom_css TEXT,
  white_label_enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Video/Voice Calls
CREATE TABLE call_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_id VARCHAR(100) UNIQUE NOT NULL,
  chat_room_id INT,
  organization_id INT NOT NULL,
  initiated_by INT NOT NULL,
  call_type ENUM('audio', 'video') NOT NULL,
  status ENUM('initiated', 'ongoing', 'ended', 'failed') DEFAULT 'initiated',
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP NULL,
  duration_seconds INT DEFAULT 0,
  participants_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Call Participants
CREATE TABLE call_participants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  call_session_id INT NOT NULL,
  user_id INT NOT NULL,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  left_at TIMESTAMP NULL,
  connection_quality ENUM('excellent', 'good', 'fair', 'poor') DEFAULT 'good',
  is_muted BOOLEAN DEFAULT FALSE,
  is_video_enabled BOOLEAN DEFAULT TRUE,
  UNIQUE KEY unique_call_participant (call_session_id, user_id)
);

-- Enterprise Features - Audit Logs
CREATE TABLE audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  user_id INT,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id INT,
  old_values JSON,
  new_values JSON,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- API Keys for Enterprise
CREATE TABLE api_keys (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  key_hash VARCHAR(255) NOT NULL,
  key_prefix VARCHAR(20) NOT NULL,
  permissions JSON DEFAULT '[]',
  last_used_at TIMESTAMP NULL,
  expires_at TIMESTAMP NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert default subscription plans
INSERT INTO subscription_plans (name, slug, price_monthly, price_yearly, max_users, max_organizations, max_storage_gb, features) VALUES
('Free', 'free', 0.00, 0.00, 5, 1, 1, '["basic_messaging", "basic_tasks", "basic_projects"]'),
('Pro', 'pro', 15.00, 150.00, 25, 3, 10, '["time_tracking", "custom_branding", "analytics", "priority_support", "advanced_permissions"]'),
('Enterprise', 'enterprise', 50.00, 500.00, NULL, NULL, 100, '["sso", "audit_logs", "api_access", "custom_integrations", "dedicated_support", "white_labeling"]');

-- Indexes for subscription tables
CREATE INDEX idx_org_subscriptions_org ON organization_subscriptions(organization_id);
CREATE INDEX idx_org_subscriptions_plan ON organization_subscriptions(plan_id);
CREATE INDEX idx_usage_tracking_org ON usage_tracking(organization_id);
CREATE INDEX idx_usage_tracking_date ON usage_tracking(recorded_at);
CREATE INDEX idx_billing_invoices_org ON billing_invoices(organization_id);
CREATE INDEX idx_time_tracking_user ON time_tracking_sessions(user_id);
CREATE INDEX idx_time_tracking_task ON time_tracking_sessions(task_id);
CREATE INDEX idx_time_tracking_org ON time_tracking_sessions(organization_id);
CREATE INDEX idx_time_tracking_start ON time_tracking_sessions(start_time);
CREATE INDEX idx_branding_org ON organization_branding(organization_id);
CREATE INDEX idx_call_sessions_room ON call_sessions(room_id);
CREATE INDEX idx_call_sessions_chat_room ON call_sessions(chat_room_id);
CREATE INDEX idx_call_sessions_org ON call_sessions(organization_id);
CREATE INDEX idx_call_sessions_initiator ON call_sessions(initiated_by);
CREATE INDEX idx_call_participants_session ON call_participants(call_session_id);
CREATE INDEX idx_call_participants_user ON call_participants(user_id);
CREATE INDEX idx_audit_logs_org_new ON audit_logs(organization_id);
CREATE INDEX idx_audit_logs_user_new ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX idx_api_keys_org ON api_keys(organization_id);
CREATE INDEX idx_api_keys_prefix ON api_keys(key_prefix);
CREATE INDEX idx_api_keys_active ON api_keys(is_active);

-- Foreign key constraints for subscription tables
ALTER TABLE organization_subscriptions ADD FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE organization_subscriptions ADD FOREIGN KEY (plan_id) REFERENCES subscription_plans(id);
ALTER TABLE usage_tracking ADD FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE billing_invoices ADD FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE billing_invoices ADD FOREIGN KEY (subscription_id) REFERENCES organization_subscriptions(id) ON DELETE CASCADE;
ALTER TABLE time_tracking_sessions ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE time_tracking_sessions ADD FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;
ALTER TABLE time_tracking_sessions ADD FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE organization_branding ADD FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE call_sessions ADD FOREIGN KEY (chat_room_id) REFERENCES chat_rooms(id) ON DELETE SET NULL;
ALTER TABLE call_sessions ADD FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE call_sessions ADD FOREIGN KEY (initiated_by) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE call_participants ADD FOREIGN KEY (call_session_id) REFERENCES call_sessions(id) ON DELETE CASCADE;
ALTER TABLE call_participants ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE audit_logs ADD FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE audit_logs ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE api_keys ADD FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE api_keys ADD FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE;

-- Documents
CREATE TABLE documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  content LONGTEXT,
  created_by INT NOT NULL,
  updated_by INT DEFAULT NULL,
  visibility ENUM('org', 'private') DEFAULT 'org',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE document_view_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  document_id INT NOT NULL,
  user_id INT NOT NULL,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_heartbeat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP NULL,
  duration_seconds INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for documents
CREATE INDEX idx_documents_org ON documents(organization_id);
CREATE INDEX idx_documents_creator ON documents(created_by);
CREATE INDEX idx_documents_updated ON documents(updated_at);

-- Indexes for document view sessions
CREATE INDEX idx_doc_views_org ON document_view_sessions(organization_id);
CREATE INDEX idx_doc_views_doc ON document_view_sessions(document_id);
CREATE INDEX idx_doc_views_user ON document_view_sessions(user_id);
CREATE INDEX idx_doc_views_active ON document_view_sessions(ended_at, last_heartbeat);

-- FKs for documents
ALTER TABLE documents ADD FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE documents ADD FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE documents ADD FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

-- FKs for document view sessions
ALTER TABLE document_view_sessions ADD FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE document_view_sessions ADD FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE;
ALTER TABLE document_view_sessions ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Support Tickets (for priority_support / dedicated_support)
CREATE TABLE support_tickets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  user_id INT NOT NULL,
  priority ENUM('normal', 'high', 'urgent') DEFAULT 'normal',
  subject VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  status ENUM('open', 'in_progress', 'resolved', 'closed') DEFAULT 'open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX idx_support_org ON support_tickets(organization_id);
CREATE INDEX idx_support_user ON support_tickets(user_id);
CREATE INDEX idx_support_status ON support_tickets(status);

ALTER TABLE support_tickets ADD FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE support_tickets ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Clients (external customers managed by organizations)
CREATE TABLE clients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(150) NOT NULL,
  phone VARCHAR(30) NULL,
  company VARCHAR(150) NULL,
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_client_email_per_org (organization_id, email)
);

-- Client user accounts (login identities for clients)
CREATE TABLE client_users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_id INT NOT NULL,
  organization_id INT NOT NULL,
  email VARCHAR(150) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(50) NULL,
  last_name VARCHAR(50) NULL,
  last_login TIMESTAMP NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_client_user_email (organization_id, email)
);

-- Ticket types per organization (plan-limited)
CREATE TABLE ticket_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  key_slug VARCHAR(50) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_ticket_type_key (organization_id, key_slug)
);

-- Tickets (can be created by org users or client users)
CREATE TABLE tickets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  ticket_type_id INT NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  status ENUM('open', 'in_progress', 'resolved', 'closed') DEFAULT 'open',
  priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
  created_by_user_id INT NULL,
  created_by_client_user_id INT NULL,
  assigned_user_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Ticket comments (by org users or client users)
CREATE TABLE ticket_comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ticket_id INT NOT NULL,
  author_user_id INT NULL,
  author_client_user_id INT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Indexes for clients/tickets
CREATE INDEX idx_clients_org ON clients(organization_id);
CREATE INDEX idx_client_users_org ON client_users(organization_id);
CREATE INDEX idx_client_users_client ON client_users(client_id);
CREATE INDEX idx_ticket_types_org ON ticket_types(organization_id);
CREATE INDEX idx_tickets_org ON tickets(organization_id);
CREATE INDEX idx_tickets_type ON tickets(ticket_type_id);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_priority ON tickets(priority);
CREATE INDEX idx_ticket_comments_ticket ON ticket_comments(ticket_id);

-- Foreign keys for clients/tickets
ALTER TABLE clients ADD FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE client_users ADD FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE client_users ADD FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE ticket_types ADD FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE ticket_types ADD FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE tickets ADD FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE tickets ADD FOREIGN KEY (ticket_type_id) REFERENCES ticket_types(id) ON DELETE RESTRICT;
ALTER TABLE tickets ADD FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE tickets ADD FOREIGN KEY (created_by_client_user_id) REFERENCES client_users(id) ON DELETE SET NULL;
ALTER TABLE tickets ADD FOREIGN KEY (assigned_user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE ticket_comments ADD FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE;
ALTER TABLE ticket_comments ADD FOREIGN KEY (author_user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE ticket_comments ADD FOREIGN KEY (author_client_user_id) REFERENCES client_users(id) ON DELETE SET NULL;

-- Schema complete - ready for copy-paste execution!

-- Extensions for tickets: attachments, labels, SLA, default assignee per type
ALTER TABLE ticket_types ADD COLUMN IF NOT EXISTS default_assignee_id INT NULL;
ALTER TABLE ticket_types ADD FOREIGN KEY (default_assignee_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE tickets 
  ADD COLUMN IF NOT EXISTS labels JSON DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS sla_minutes INT NULL,
  ADD COLUMN IF NOT EXISTS due_at TIMESTAMP NULL;

CREATE TABLE IF NOT EXISTS ticket_attachments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ticket_id INT NOT NULL,
  comment_id INT NULL,
  url VARCHAR(1000) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size INT NULL,
  created_by_user_id INT NULL,
  created_by_client_user_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (comment_id) REFERENCES ticket_comments(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by_client_user_id) REFERENCES client_users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_ticket_attachments_ticket ON ticket_attachments(ticket_id);
