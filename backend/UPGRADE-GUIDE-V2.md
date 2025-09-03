# Flowbit V2 Upgrade Guide

## Overview

Flowbit V2 introduces a complete architectural overhaul with multi-tenant capabilities and role-based access control (RBAC). This guide will help you migrate from V1 to V2.

## 🌟 New Features in V2

### Multi-Tenancy
- **Organizations**: Isolated workspaces for different companies/teams
- **Organization Memberships**: Users can belong to multiple organizations
- **Data Isolation**: Complete separation of data between organizations

### Role-Based Access Control (RBAC)
- **System Roles**: Pre-defined roles (Owner, Admin, Project Manager, Team Lead, Developer, Viewer)
- **Custom Roles**: Create organization-specific roles
- **Granular Permissions**: Fine-grained control over features and data access
- **Permission Inheritance**: Wildcard permissions for easy management

### Enhanced Features
- **Project Members**: Assign specific users to projects with roles
- **Task Assignment**: Proper assignee/reporter tracking
- **Time Tracking**: Log hours against tasks
- **Task Comments**: Comment system with metadata
- **Audit Logs**: Track important actions
- **User Invitations**: Secure invitation system

## 🗄️ Database Changes

### New Tables
- `organizations` - Organization/tenant data
- `roles` - Role definitions with permissions
- `organization_members` - User-organization relationships
- `project_members` - Project-specific access control
- `task_comments` - Task comment system
- `time_entries` - Time tracking
- `audit_logs` - Action audit trail
- `invitations` - User invitation system

### Modified Tables
- `users` - Enhanced with profile fields
- `projects` - Added organization context and enhanced fields
- `tasks` - Enhanced with assignee/reporter, time tracking, labels

## 🚀 Migration Process

### Prerequisites
1. **Backup your database** - CRITICAL before starting migration
2. **Stop your application** - Ensure no active connections
3. **Install dependencies** - `npm install` in backend directory

### Step 1: Install New Dependencies
```bash
cd backend
npm install
```

### Step 2: Run Migration
```bash
# Run the migration script
npm run db:migrate

# If you need to rollback (only do this immediately after migration)
npm run db:rollback
```

### Step 3: Start V2 Server
```bash
# Development
npm run dev

# Or use the V2 index file specifically
npx ts-node src/index-v2.ts
```

### Step 4: Update Frontend (covered in separate todo)

## 📡 API Changes

### Authentication

#### V1 (Legacy)
```javascript
// Registration
POST /api/auth/register
{
  "username": "john",
  "email": "john@example.com",
  "password": "password"
}

// Login
POST /api/auth/login
{
  "email": "john@example.com",
  "password": "password"
}
```

#### V2 (New)
```javascript
// Registration with new organization
POST /api/v2/auth/register
{
  "username": "john",
  "email": "john@example.com", 
  "password": "password",
  "first_name": "John",
  "last_name": "Doe",
  "organization_name": "Acme Corp",
  "organization_slug": "acme-corp"
}

// Registration with invitation
POST /api/v2/auth/register
{
  "username": "john",
  "email": "john@example.com",
  "password": "password",
  "invitation_token": "abc123..."
}

// Login
POST /api/v2/auth/login
{
  "email": "john@example.com",
  "password": "password",
  "organization_slug": "acme-corp" // optional if user has multiple orgs
}
```

### Projects

#### V1 → V2 Mapping
- `GET /api/projects` → `GET /api/v2/projects`
- `POST /api/projects` → `POST /api/v2/projects`
- Projects now automatically scoped to user's organization
- Enhanced with member management and detailed statistics

### Tasks

#### V1 → V2 Mapping
- `GET /api/tasks` → `GET /api/v2/tasks`
- `POST /api/tasks` → `POST /api/v2/tasks`
- Tasks now have assignee/reporter fields
- Enhanced filtering and pagination
- Comment and time tracking support

## 🔐 Permissions System

### Permission Categories
- `org.*` - Organization management
- `users.*` - User management
- `projects.*` - Project management
- `tasks.*` - Task management
- `roles.*` - Role management
- `settings.*` - Settings management

### Default Roles

| Role | Permissions | Description |
|------|-------------|-------------|
| **org_owner** | `["org.*", "projects.*", "tasks.*", "users.*", "settings.*"]` | Full organization access |
| **org_admin** | `["projects.*", "tasks.*", "users.view", "users.invite", "settings.view"]` | Administrative access |
| **project_manager** | `["projects.view", "projects.edit", "projects.create", "tasks.*", "users.view"]` | Project management |
| **team_lead** | `["projects.view", "projects.edit", "tasks.*", "users.view"]` | Team leadership |
| **developer** | `["projects.view", "tasks.view", "tasks.edit", "tasks.create", "tasks.comment"]` | Development work |
| **viewer** | `["projects.view", "tasks.view"]` | Read-only access |

## 🔧 Configuration

### Environment Variables
```bash
# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=flowbit
DB_PORT=3306

# JWT
JWT_SECRET=your-secure-secret-key

# Frontend URL for CORS
FRONTEND_URL=http://localhost:3001

# Environment
NODE_ENV=development
```

## 🧪 Testing the Migration

### 1. Verify Database Structure
```sql
-- Check if new tables exist
SHOW TABLES;

-- Verify organizations table
SELECT * FROM organizations LIMIT 5;

-- Check user migration
SELECT u.email, o.name as org_name, r.display_name as role 
FROM users u 
JOIN organization_members om ON u.id = om.user_id 
JOIN organizations o ON om.organization_id = o.id 
JOIN roles r ON om.role_id = r.id;
```

### 2. Test API Endpoints
```bash
# Health check
curl http://localhost:5000/api/v2/health

# Get API documentation
curl http://localhost:5000/api/docs

# Test authentication (after creating a user)
curl -X POST http://localhost:5000/api/v2/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@flowbit.com","password":"password"}'
```

### 3. Verify Data Migration
- All existing users should be in the default organization
- All projects should have organization_id = 1
- All tasks should have organization_id = 1
- Users should have org_owner role in default organization

## 🚨 Troubleshooting

### Migration Fails
```bash
# Check MySQL error logs
# Verify database permissions
# Ensure no foreign key conflicts

# If migration partially completed, rollback and retry
npm run db:rollback
npm run db:migrate
```

### Permission Errors
- Verify JWT tokens include organization context
- Check user has appropriate role assignments
- Confirm API requests include proper authentication headers

### Data Access Issues
- Ensure organization_id is properly set on all queries
- Verify user belongs to the organization they're trying to access
- Check project/task access permissions

## 📚 API Documentation

Once V2 is running, access comprehensive API documentation at:
- `http://localhost:5000/api/docs` - Full API documentation
- `http://localhost:5000/api/v2/health` - V2 health check

## 🔄 Rollback Plan

If you need to rollback to V1:

```bash
# Stop V2 application
# Run rollback script
npm run db:rollback

# Start V1 application
npx ts-node src/index.ts
```

**⚠️ Warning**: Only rollback immediately after migration. If you've created new V2 data, rollback will cause data loss.

## 📞 Support

For migration issues:
1. Check the console logs for specific error messages
2. Verify database schema matches expected V2 structure
3. Test with a fresh database if migration issues persist
4. Ensure all dependencies are properly installed

Remember: **Always backup your database before migration!**
