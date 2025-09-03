import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import Tasks from './pages/Tasks';
import TeamManagement from './pages/TeamManagement';
import Profile from './pages/Profile';
import OrganizationSettings from './pages/OrganizationSettings';
import Unauthorized from './pages/Unauthorized';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
          
          {/* Protected Routes */}
          <Route path="/*" element={
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
                  
                  <Route path="/team" element={<TeamManagement />} />
                  
                  <Route path="/profile" element={<Profile />} />
                  
                  <Route path="/settings" element={<OrganizationSettings />} />
                  
                  {/* Catch all redirect */}
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
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