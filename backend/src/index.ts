import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import SocketService from './services/socketService';

// Import routes
import authRouter from './routes/auth';
import projectsRouter from './routes/projects';
import tasksRouter from './routes/tasks';
import usersRouter from './routes/users';
import organizationsRouter from './routes/organizations';
import messagesRouter from './routes/messages';
import subscriptionsRouter from './routes/subscriptions';
import callsRouter from './routes/calls';
import timeTrackingRouter from './routes/timeTracking';
import analyticsRouter from './routes/analytics';
import documentsRouter from './routes/documents';
import brandingRouter from './routes/branding';
import auditLogsRouter from './routes/auditLogs';
import apiKeysRouter from './routes/apiKeys';
import supportRouter from './routes/support';
import clientsRouter from './routes/clients';
import ticketsRouter from './routes/tickets';
import clientAuthRouter from './routes/clientAuth';

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 5000;

// Initialize Socket.IO service
const socketService = new SocketService(server);

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/users', usersRouter);
app.use('/api/organizations', organizationsRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/subscriptions', subscriptionsRouter);
app.use('/api/calls', callsRouter);
app.use('/api/time-tracking', timeTrackingRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/branding', brandingRouter);
app.use('/api/audit-logs', auditLogsRouter);
app.use('/api/api-keys', apiKeysRouter);
app.use('/api/support', supportRouter);
app.use('/api/clients', clientsRouter);
app.use('/api/tickets', ticketsRouter);
app.use('/api/client-auth', clientAuthRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    version: '2.0',
    features: [
      'multi-tenant',
      'rbac',
      'organizations',
      'enhanced-tasks',
      'time-tracking',
      'audit-logs'
    ]
  });
});



// API documentation endpoint
app.get('/api/docs', (req, res) => {
  res.json({
    title: 'TaskFlask API Documentation',
    version: '2.0',
    description: 'Multi-tenant task management API with role-based access control',
    endpoints: {
      authentication: {
        'POST /api/auth/register': 'Register new user with organization',
        'POST /api/auth/login': 'Login with organization context',
        'POST /api/auth/invite': 'Invite user to organization',
        'GET /api/auth/me': 'Get current user info'
      },
      organizations: {
        'GET /api/organizations/current': 'Get current organization',
        'PUT /api/organizations/current': 'Update organization',
        'GET /api/organizations/members': 'Get organization members',
        'PUT /api/organizations/members/:userId/role': 'Update member role',
        'PUT /api/organizations/members/:userId/status': 'Update member status',
        'DELETE /api/organizations/members/:userId': 'Remove member',
        'GET /api/organizations/roles': 'Get organization roles',
        'POST /api/organizations/roles': 'Create custom role',
        'PUT /api/organizations/roles/:id': 'Update custom role',
        'DELETE /api/organizations/roles/:id': 'Delete custom role',
        'GET /api/organizations/invitations': 'Get pending invitations',
        'DELETE /api/organizations/invitations/:id': 'Cancel invitation'
      },
      projects: {
        'GET /api/projects': 'Get organization projects',
        'GET /api/projects/:id': 'Get project details',
        'POST /api/projects': 'Create project',
        'PUT /api/projects/:id': 'Update project',
        'DELETE /api/projects/:id': 'Delete project',
        'GET /api/projects/:id/stats': 'Get project statistics',
        'GET /api/projects/:id/tasks': 'Get project tasks',
        'POST /api/projects/:id/members': 'Add project member',
        'DELETE /api/projects/:id/members/:userId': 'Remove project member'
      },
      tasks: {
        'GET /api/tasks': 'Get organization tasks with filters',
        'GET /api/tasks/:id': 'Get task details',
        'POST /api/tasks': 'Create task',
        'PUT /api/tasks/:id': 'Update task',
        'DELETE /api/tasks/:id': 'Delete task',
        'POST /api/tasks/:id/comments': 'Add task comment',
        'POST /api/tasks/:id/time': 'Log time for task',
        'GET /api/tasks/overdue': 'Get overdue tasks'
      },
      clients: {
        'GET /api/clients': 'List organization clients',
        'POST /api/clients': 'Create client',
        'PUT /api/clients/:id': 'Update client',
        'DELETE /api/clients/:id': 'Delete client',
        'POST /api/clients/:id/users': 'Create client login'
      },
      tickets: {
        'GET /api/tickets/types': 'List ticket types',
        'POST /api/tickets/types': 'Create ticket type (plan-limited)',
        'POST /api/tickets/types/seed': 'Seed default ticket types per plan',
        'GET /api/tickets': 'List tickets',
        'POST /api/tickets': 'Create ticket (org user)',
        'PUT /api/tickets/:id': 'Update ticket',
        'POST /api/tickets/:id/comments': 'Add ticket comment',
        'POST /api/tickets/client': 'Client creates ticket (client JWT)'
      }
    },
    permissions: {
      organization: ['org.view', 'org.edit', 'org.settings', 'org.delete'],
      users: ['users.view', 'users.invite', 'users.edit', 'users.remove'],
      projects: ['projects.view', 'projects.create', 'projects.edit', 'projects.delete', 'projects.members.view', 'projects.members.add', 'projects.members.remove'],
      tasks: ['tasks.view', 'tasks.create', 'tasks.edit', 'tasks.delete', 'tasks.assign', 'tasks.comment', 'tasks.time'],
      roles: ['roles.view', 'roles.create', 'roles.edit', 'roles.delete'],
      settings: ['settings.view', 'settings.edit']
    },
    roles: {
      'owner': 'Full access within organization',
      'admin': 'Administrative access within organization',
      'project_manager': 'Manage projects and teams',
      'team_lead': 'Lead team members and manage assigned projects',
      'member': 'Work on tasks and projects',
      'viewer': 'Read-only access to assigned projects'
    }
  });
});

// Default route
app.get('/', (req, res) => {
  res.json({
    message: 'TaskFlask API v2.0',
    documentation: '/api/docs',
    health: '/api/health',
    version: '2.0.0'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    message: 'Endpoint not found',
    documentation: '/api/docs'
  });
});

// Global error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Global error handler:', error);
  
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Invalid JSON in request body' });
  }
  
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Request body too large' });
  }
  
  res.status(500).json({ 
    message: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { error: error.message })
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 TaskFlask API v2.0 running on port ${PORT}`);
  console.log(`📖 API Documentation: http://localhost:${PORT}/api/docs`);
  console.log(`💚 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🏢 Multi-tenant with RBAC enabled`);
  console.log(`💬 WebSocket server ready for real-time messaging`);
});

export default app;