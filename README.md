# Flowbit Task Manager

A full-stack task management application built with React, Node.js, TypeScript, and PostgreSQL.

## Features

- **Dashboard**: Overview with statistics and recent tasks
- **Projects**: Create, edit, and manage projects
- **Tasks**: Full CRUD operations with filtering and status tracking
- **Authentication**: JWT-based user authentication and registration
- **Database**: PostgreSQL database with proper relationships and constraints
- **Responsive Design**: Mobile-friendly interface with Tailwind CSS
- **Real-time Updates**: Instant data synchronization between frontend and backend

## Tech Stack

### Frontend
- React 18 with TypeScript
- Vite for fast development and building
- Tailwind CSS for styling
- React Router for navigation
- Axios for API communication
- Lucide React for icons

### Backend
- Node.js with Express
- TypeScript for type safety
- PostgreSQL database with connection pooling
- JWT authentication with bcrypt password hashing
- RESTful API endpoints
- CORS and security middleware

## Project Structure

```
flowbit-task-manager/
├── database/
│   └── schema.sql              # PostgreSQL database schema
├── backend/                     # Express.js backend
│   ├── src/
│   │   ├── routes/             # API route handlers
│   │   ├── types/              # TypeScript interfaces
│   │   ├── database/           # Database configuration
│   │   ├── middleware/         # Authentication middleware
│   │   └── index.ts            # Server entry point
│   ├── package.json
│   └── tsconfig.json
├── frontend/                    # React frontend
│   ├── src/
│   │   ├── components/         # Reusable components
│   │   ├── pages/              # Page components
│   │   ├── services/           # API service layer
│   │   ├── types/              # TypeScript interfaces
│   │   └── App.tsx             # Main app component
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
├── package.json                 # Root package.json
└── README.md
```

## Quick Start

### Prerequisites
- Node.js 18+ 
- PostgreSQL 12+
- npm or yarn

### Database Setup

1. **Install PostgreSQL** and start the service
2. **Create a `.env` file** in the backend directory:
   ```bash
   # Database Configuration
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=flowbit
   DB_USER=postgres
   DB_PASSWORD=your_password_here
   
   # JWT Configuration
   JWT_SECRET=your-super-secret-jwt-key-change-in-production
   
   # Server Configuration
   PORT=5000
   NODE_ENV=development
   ```

3. **Setup database**:
   ```bash
   cd backend
   npm run db:setup
   ```

4. **Create tables** using your `database/schema.sql` file:
   ```bash
   psql -U postgres -d flowbit -f database/schema.sql
   ```

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd flowbit-task-manager
   ```

2. **Install all dependencies**
   ```bash
   npm run install:all
   ```

3. **Start development servers**
   ```bash
   npm run dev
   ```

This will start both the backend (port 5000) and frontend (port 3000) concurrently.

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user info (protected)

### Tasks
- `GET /api/tasks` - Get all tasks
- `GET /api/tasks/:id` - Get task by ID
- `POST /api/tasks` - Create new task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task

### Projects
- `GET /api/projects` - Get all projects
- `GET /api/projects/:id` - Get project by ID
- `POST /api/projects` - Create new project
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

## Database Schema

The application uses PostgreSQL with the following main tables:

- **users**: User accounts with authentication
- **projects**: Project definitions linked to users
- **tasks**: Task items linked to projects and users

Key features:
- Foreign key constraints for data integrity
- Proper indexing for performance
- Timestamp tracking for audit trails
- User isolation for multi-tenant support

## Authentication

- **JWT tokens** for stateless authentication
- **bcrypt** for secure password hashing
- **Protected routes** using middleware
- **Token expiration** for security

## UI Components

- **Layout**: Responsive sidebar navigation with mobile support
- **Dashboard**: Statistics cards and recent tasks overview
- **Projects**: Project management with create/edit forms
- **Tasks**: Task management with filtering and status tracking
- **Forms**: Reusable form components with validation

## Development

### Available Scripts

**Root:**
- `npm run dev` - Start both frontend and backend
- `npm run build` - Build both frontend and backend
- `npm run install:all` - Install dependencies for all packages

**Backend:**
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm run db:setup` - Setup database connection

**Frontend:**
- `npm run dev` - Start Vite development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

### Code Quality

- **ESLint**: Code linting for both frontend and backend
- **Prettier**: Consistent code formatting
- **TypeScript**: Type safety across the entire application

## Deployment

### Backend
```bash
cd backend
npm run build
npm start
```

### Frontend
```bash
cd frontend
npm run build
# Serve the dist folder with your preferred web server
```

### Database
- Ensure PostgreSQL is running and accessible
- Set proper environment variables
- Consider using connection pooling in production

## Future Enhancements

- [ ] Real-time updates with WebSockets
- [ ] File attachments for tasks
- [ ] Team collaboration features
- [ ] Advanced reporting and analytics
- [ ] Mobile app (React Native)
- [ ] Email notifications
- [ ] Task templates and recurring tasks

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

If you encounter any issues or have questions, please open an issue in the repository.
