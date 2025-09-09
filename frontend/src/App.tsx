import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { CallProvider } from './contexts/CallContext';
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
import Messages from './pages/Messages';
import Billing from './pages/Billing';
import TimeTracking from './pages/TimeTracking';
import Analytics from './pages/Analytics';
import Documents from './pages/Documents';
import DevPortal from './pages/DevPortal';
import Integrations from './pages/Integrations';
import Clients from './pages/Clients';
import TicketTypes from './pages/TicketTypes';
import OrgTickets from './pages/OrgTickets';
import ClientLogin from './pages/ClientLogin';
import ClientPortal from './pages/ClientPortal';
import OrgTicketDetail from './pages/OrgTicketDetail';
import Unauthorized from './pages/Unauthorized';
import CrmCompanies from './pages/CrmCompanies';
import CrmContacts from './pages/CrmContacts';
import CrmDeals from './pages/CrmDeals';
import CrmActivities from './pages/CrmActivities';
import { ThemeProvider } from './contexts/ThemeContext';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NotificationProvider>
          <CallProvider>
            <SocketProvider>
              <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/client-login" element={<ClientLogin />} />
          <Route path="/client" element={<ClientPortal />} />
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

                  <Route path="/clients" element={
                    <ProtectedRoute requiredPermission="users.view" requiredPlanSlug="pro">
                      <Clients />
                    </ProtectedRoute>
                  } />


                  <Route path="/tickets-org" element={
                    <ProtectedRoute requiredPermission="tasks.view" requiredPlanSlug="pro">
                      <OrgTickets />
                    </ProtectedRoute>
                  } />

                  {/* CRM (Pro/Enterprise) */}
                  <Route path="/crm/companies" element={
                    <ProtectedRoute requiredPlanSlug="pro">
                      <CrmCompanies />
                    </ProtectedRoute>
                  } />
                  <Route path="/crm/contacts" element={
                    <ProtectedRoute requiredPlanSlug="pro">
                      <CrmContacts />
                    </ProtectedRoute>
                  } />
                  <Route path="/crm/deals" element={
                    <ProtectedRoute requiredPlanSlug="pro">
                      <CrmDeals />
                    </ProtectedRoute>
                  } />
                  <Route path="/crm/activities" element={
                    <ProtectedRoute requiredPlanSlug="pro">
                      <CrmActivities />
                    </ProtectedRoute>
                  } />
                  <Route path="/tickets-org/:id" element={
                    <ProtectedRoute requiredPermission="tasks.view">
                      <OrgTicketDetail />
                    </ProtectedRoute>
                  } />
                  
                  <Route path="/team" element={<TeamManagement />} />
                  
                  <Route path="/profile" element={<Profile />} />
                  
                                      <Route path="/settings" element={<OrganizationSettings />} />
                    
                    <Route path="/billing" element={<Billing />} />
                    
                    <Route path="/time-tracking" element={<TimeTracking />} />
                    
                    <Route path="/analytics" element={<Analytics />} />
                    
                    <Route path="/documents" element={<Documents />} />
                    <Route path="/dev-portal" element={<DevPortal />} />
                    <Route path="/integrations" element={<Integrations />} />
                    
                    <Route path="/messages" element={<Messages />} />
                  
                  {/* Catch all redirect */}
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          } />
                  </Routes>
              </Router>
            </SocketProvider>
          </CallProvider>
        </NotificationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;