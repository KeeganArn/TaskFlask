# Frontend V2 Upgrade Guide

## Overview

This guide covers upgrading the frontend to support the new V2 multi-tenant architecture with organization-based authentication and role-based access control.

## 🌟 New Features

### Multi-Tenant Authentication
- **Organization Selection**: Users can belong to multiple organizations
- **Organization Context**: All operations scoped to selected organization  
- **Invitation System**: Secure user onboarding via invitation tokens
- **Enhanced Registration**: Support for creating new organizations or joining existing ones

### Role-Based Access Control
- **Permission-Based UI**: Components show/hide based on user permissions
- **Protected Routes**: Route-level access control
- **Dynamic Navigation**: Menu items based on user role
- **Admin Interface**: Complete team and permission management

### Enhanced User Experience
- **Organization Branding**: Organization name and context in UI
- **User Profiles**: Enhanced user information display
- **Permission Feedback**: Clear messaging when access is denied
- **Responsive Design**: Mobile-friendly admin interfaces

## 📁 New File Structure

```
frontend/src/
├── types/v2.ts                    # V2 type definitions
├── services/api-v2.ts             # V2 API service layer
├── contexts/AuthContext-v2.tsx    # Enhanced auth context
├── components/
│   ├── Layout-v2.tsx             # Organization-aware layout
│   └── ProtectedRoute-v2.tsx     # Permission-based routing
└── pages/
    ├── Login-v2.tsx              # Multi-org login
    ├── Register-v2.tsx           # Enhanced registration
    ├── Team-v2.tsx               # Admin interface
    └── Unauthorized.tsx          # Access denied page
```

## 🔄 Migration Steps

### Step 1: Install Dependencies (if needed)
```bash
cd frontend
npm install
```

### Step 2: Update Main App Component

Create a new `App-v2.tsx` file or update your existing `App.tsx`:

```tsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext-v2';
import ProtectedRoute from './components/ProtectedRoute-v2';
import Layout from './components/Layout-v2';
import Login from './pages/Login-v2';
import Register from './pages/Register-v2';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import Tasks from './pages/Tasks';
import Team from './pages/Team-v2';
import Unauthorized from './pages/Unauthorized';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
          
          <Route path="/" element={
            <ProtectedRoute>
              <Layout>
                <Routes>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/projects" element={
                    <ProtectedRoute requiredPermission="projects.view">
                      <Projects />
                    </ProtectedRoute>
                  } />
                  <Route path="/tasks" element={
                    <ProtectedRoute requiredPermission="tasks.view">
                      <Tasks />
                    </ProtectedRoute>
                  } />
                  <Route path="/team" element={
                    <ProtectedRoute requiredPermission="users.view">
                      <Team />
                    </ProtectedRoute>
                  } />
                </Routes>
              </Layout>
            </ProtectedRoute>
          } />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
```

### Step 3: Update Existing Pages

Your existing pages (Dashboard, Projects, Tasks) need to be updated to use the V2 API:

#### Example: Update Projects Page
```tsx
// Replace imports
import { projectsApiV2, tasksApiV2 } from '../services/api-v2';
import { Project, Task } from '../types/v2';
import { useAuth, usePermission } from '../contexts/AuthContext-v2';

// Add permission checks
const Projects: React.FC = () => {
  const canCreateProjects = usePermission('projects.create');
  const canEditProjects = usePermission('projects.edit');
  
  // Update API calls
  const fetchProjects = async () => {
    try {
      const data = await projectsApiV2.getAll();
      setProjects(data);
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  // Conditional rendering based on permissions
  return (
    <div>
      {canCreateProjects && (
        <button onClick={() => setShowCreateForm(true)}>
          Create Project
        </button>
      )}
      {/* Rest of component */}
    </div>
  );
};
```

### Step 4: Update Environment Variables

Update your `.env` file to point to V2 API endpoints:

```bash
REACT_APP_API_URL=/api/v2
```

## 🔐 Permission System Usage

### Basic Permission Checks
```tsx
import { usePermission, useAnyPermission, useIsAdmin } from '../contexts/AuthContext-v2';

const MyComponent = () => {
  const canCreateTasks = usePermission('tasks.create');
  const canManageAnything = useAnyPermission(['projects.edit', 'tasks.edit']);
  const isAdmin = useIsAdmin();

  return (
    <div>
      {canCreateTasks && <button>Create Task</button>}
      {canManageAnything && <button>Manage</button>}
      {isAdmin && <button>Admin Panel</button>}
    </div>
  );
};
```

### Protected Route Examples
```tsx
// Require specific permission
<ProtectedRoute requiredPermission="users.invite">
  <InviteUserPage />
</ProtectedRoute>

// Require ALL permissions
<ProtectedRoute requiredPermissions={['projects.edit', 'tasks.edit']}>
  <ProjectManagementPage />
</ProtectedRoute>

// Require ANY permission
<ProtectedRoute anyPermission={['projects.view', 'tasks.view']}>
  <WorkspacePage />
</ProtectedRoute>

// Admin only
<ProtectedRoute adminOnly={true}>
  <AdminPanel />
</ProtectedRoute>
```

## 🎨 UI Components

### User Display
```tsx
import { getDisplayName, getInitials } from '../services/api-v2';

const UserAvatar = ({ user }) => (
  <div className="h-8 w-8 rounded-full bg-primary-600 flex items-center justify-center text-white">
    {user.avatar_url ? (
      <img src={user.avatar_url} alt="" className="h-8 w-8 rounded-full" />
    ) : (
      getInitials(getDisplayName(user))
    )}
  </div>
);
```

### Status Badges
```tsx
import { getStatusColor, getPriorityColor } from '../services/api-v2';

const StatusBadge = ({ status }) => (
  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(status)}`}>
    {status}
  </span>
);
```

### Date Formatting
```tsx
import { formatDate, formatRelativeTime } from '../services/api-v2';

const TaskItem = ({ task }) => (
  <div>
    <p>Due: {formatDate(task.due_date)}</p>
    <p>Updated {formatRelativeTime(task.updated_at)}</p>
  </div>
);
```

## 🔄 API Migration

### V1 → V2 API Changes

| V1 Endpoint | V2 Endpoint | Changes |
|-------------|-------------|---------|
| `GET /api/projects` | `GET /api/v2/projects` | Organization-scoped, enhanced filtering |
| `POST /api/projects` | `POST /api/v2/projects` | Member management support |
| `GET /api/tasks` | `GET /api/v2/tasks` | Pagination, assignee/reporter fields |
| `POST /api/auth/login` | `POST /api/v2/auth/login` | Organization context |
| `POST /api/auth/register` | `POST /api/v2/auth/register` | Organization creation/invitation |

### Authentication Flow

#### V1 (Old)
```tsx
const handleLogin = async (email, password) => {
  const response = await authApi.login({ email, password });
  localStorage.setItem('token', response.token);
};
```

#### V2 (New)
```tsx
const handleLogin = async (email, password, orgSlug) => {
  const response = await authApiV2.login({ 
    email, 
    password, 
    organization_slug: orgSlug 
  });
  
  if (response.requireOrganizationSelection) {
    // Show organization selection UI
    setOrganizations(response.organizations);
  } else {
    // Normal login flow
    localStorage.setItem('authToken', response.token);
    localStorage.setItem('user', JSON.stringify(response.user));
    localStorage.setItem('organization', JSON.stringify(response.organization));
  }
};
```

## 🧪 Testing

### Testing Permission-Based Components
```tsx
import { render } from '@testing-library/react';
import { AuthProvider } from '../contexts/AuthContext-v2';

const renderWithAuth = (component, { permissions = [] } = {}) => {
  const mockAuthValue = {
    user: { id: 1, username: 'test' },
    organization: { id: 1, name: 'Test Org' },
    permissions,
    hasPermission: (permission) => permissions.includes(permission)
  };

  return render(
    <AuthProvider value={mockAuthValue}>
      {component}
    </AuthProvider>
  );
};

// Test component with specific permissions
test('shows create button for users with create permission', () => {
  renderWithAuth(<MyComponent />, { permissions: ['tasks.create'] });
  expect(screen.getByText('Create Task')).toBeInTheDocument();
});
```

## 🚀 Deployment

### Environment Configuration

#### Development
```bash
REACT_APP_API_URL=http://localhost:5000/api/v2
```

#### Production
```bash
REACT_APP_API_URL=https://your-domain.com/api/v2
```

### Build Process
```bash
npm run build
```

## 🐛 Common Issues & Solutions

### Issue: "User not authenticated" errors
**Solution**: Ensure the V2 backend is running and JWT tokens include organization context.

### Issue: Permission denied on routes that should be accessible
**Solution**: Check that user permissions are correctly stored and retrieved from localStorage.

### Issue: Organization context missing
**Solution**: Verify that organization data is included in the JWT token and stored in the auth context.

### Issue: V1 API calls still being made
**Solution**: Update all API imports to use `api-v2.ts` instead of the original `api.ts`.

## 📚 Additional Resources

- **Backend V2 API Documentation**: `/api/docs` endpoint
- **Permission Reference**: See `types/v2.ts` for available permissions
- **Component Examples**: Check existing V2 components for implementation patterns

## 🔧 Development Tips

1. **Use Permission Hooks**: Always use `usePermission()` hooks instead of manual permission checking
2. **Error Boundaries**: Implement error boundaries for permission-related errors
3. **Loading States**: Handle loading states during organization/permission checks
4. **Fallback UI**: Provide meaningful fallbacks when permissions are insufficient
5. **Testing**: Test components with different permission combinations

## 📞 Support

For frontend migration issues:
1. Check browser console for authentication errors
2. Verify API endpoints are correctly configured
3. Test with different user roles and permissions
4. Ensure localStorage is properly managing auth state

Remember: The V2 frontend is designed to gracefully handle permission changes and organization context switching!
