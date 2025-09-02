# Flowbit Task Manager

A full-stack task management application built with React, Node.js, and TypeScript.

## 🚀 Features

- **Dashboard**: Overview with statistics and recent tasks
- **Projects**: Create, edit, and manage projects
- **Tasks**: Full CRUD operations with filtering and status tracking
- **Responsive Design**: Mobile-friendly interface with Tailwind CSS
- **Real-time Updates**: Instant data synchronization between frontend and backend

## 🛠️ Tech Stack

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
- In-memory data storage (easily swappable to SQL)
- RESTful API endpoints
- CORS and security middleware

## 📁 Project Structure

```
flowbit-task-manager/
├── backend/                 # Express.js backend
│   ├── src/
│   │   ├── routes/         # API route handlers
│   │   ├── types/          # TypeScript interfaces
│   │   ├── data/           # Mock data storage
│   │   └── index.ts        # Server entry point
│   ├── package.json
│   └── tsconfig.json
├── frontend/                # React frontend
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── pages/          # Page components
│   │   ├── services/       # API service layer
│   │   ├── types/          # TypeScript interfaces
│   │   └── App.tsx         # Main app component
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
├── package.json             # Root package.json
└── README.md
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn

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

### Manual Start (Alternative)

If you prefer to run services separately:

**Backend:**
```bash
cd backend
npm run dev
```

**Frontend:**
```bash
cd frontend
npm run dev
```

## 🌐 API Endpoints

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

### Authentication (Mock)
- `POST /api/auth/login` - Mock login endpoint
- `POST /api/auth/register` - Mock registration endpoint

## 📊 Data Models

### Task
```typescript
interface Task {
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
```

### Project
```typescript
interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}
```

## 🎨 UI Components

- **Layout**: Responsive sidebar navigation with mobile support
- **Dashboard**: Statistics cards and recent tasks overview
- **Projects**: Project management with create/edit forms
- **Tasks**: Task management with filtering and status tracking
- **Forms**: Reusable form components with validation

## 🔧 Development

### Available Scripts

**Root:**
- `npm run dev` - Start both frontend and backend
- `npm run build` - Build both frontend and backend
- `npm run install:all` - Install dependencies for all packages

**Backend:**
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server

**Frontend:**
- `npm run dev` - Start Vite development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

### Code Quality

- **ESLint**: Code linting for both frontend and backend
- **Prettier**: Consistent code formatting
- **TypeScript**: Type safety across the entire application

## 🚀 Deployment

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

## 🔮 Future Enhancements

- [ ] Database integration (PostgreSQL/MySQL)
- [ ] User authentication with JWT
- [ ] Real-time updates with WebSockets
- [ ] File attachments for tasks
- [ ] Team collaboration features
- [ ] Advanced reporting and analytics
- [ ] Mobile app (React Native)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License.

## 🆘 Support

If you encounter any issues or have questions, please open an issue in the repository.
