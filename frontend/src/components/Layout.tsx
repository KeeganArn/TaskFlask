import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FolderOpen, 
  CheckSquare, 
  Users, 
  Settings, 
  LogOut, 
  Menu,
  MessageCircle,
  X,
  Bell,
  Search,
  Building2,
  User,
  ChevronDown,
  CreditCard,
  Clock,
  BarChart3,
  FileText
} from 'lucide-react';
import { useAuth, usePermission, useUserDisplayName } from '../contexts/AuthContext';
import { subscriptionsApi } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { useNotifications } from '../contexts/NotificationContext';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, organization, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const userDisplayName = useUserDisplayName();
  const { permission: notificationPermission, isEnabled: notificationsEnabled, requestPermission, toggleNotifications } = useNotifications();
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [planSlug, setPlanSlug] = useState<string | null>('free');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem('sidebar_collapsed');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (userMenuOpen && !target.closest('[data-dropdown="user-menu"]')) {
        setUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [userMenuOpen]);

  // Handle notification button click
  const handleNotificationClick = async () => {
    try {
      if (notificationPermission === 'denied') {
        alert('Notifications are blocked. Please enable them in your browser settings.');
        return;
      }

      if (notificationPermission === 'granted') {
        // Toggle notifications on/off
        toggleNotifications();
        return;
      }

      // Request permission if not granted yet
      await requestPermission();
    } catch (error) {
      alert('Failed to enable notifications. Please try again.');
    }
  };

  // Load current subscription plan for feature-gating by plan
  useEffect(() => {
    const loadPlan = async () => {
      try {
        const sub = await subscriptionsApi.getCurrentSubscription();
        setPlanSlug(sub?.plan_slug || null);
      } catch (e) {
        setPlanSlug('free');
      }
    };
    loadPlan();
  }, []);

  // Permission checks
  const canViewUsers = usePermission('users.view');
  const canViewClients = usePermission('users.view') && planSlug !== 'free';
  const canViewSettings = usePermission('settings.view');
  const canViewProjects = usePermission('projects.view');
  const canViewTasks = usePermission('tasks.view') && planSlug !== 'free';
  const canManageTasks = usePermission('tasks.edit') && planSlug !== 'free';
  const canUseCrm = planSlug !== 'free';
  const isOrgOwner = usePermission('org.*') || usePermission('*');

  const navigationSections = [
    {
      header: 'Overview',
      items: [
        { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, show: true },
      ]
    },
    {
      header: 'CRM',
      items: [
        { name: 'Companies', href: '/crm/companies', icon: Building2, show: canUseCrm || isOrgOwner },
        { name: 'Contacts', href: '/crm/contacts', icon: Users, show: canUseCrm || isOrgOwner },
        { name: 'Deals', href: '/crm/deals', icon: FolderOpen, show: canUseCrm || isOrgOwner },
        { name: 'Activities', href: '/crm/activities', icon: Clock, show: canUseCrm || isOrgOwner },
      ]
    },
    {
      header: 'Work',
      items: [
        { name: 'Projects', href: '/projects', icon: FolderOpen, show: canViewProjects },
        { name: 'Tasks', href: '/tasks', icon: CheckSquare, show: canViewTasks },
        { name: 'Time Tracking', href: '/time-tracking', icon: Clock, show: planSlug !== 'free' },
        { name: 'Documents', href: '/documents', icon: FileText, show: planSlug !== 'free' },
      ]
    },
    {
      header: 'Support',
      items: [
        { name: 'Tickets', href: '/tickets-org', icon: FileText, show: canViewTasks },
        { name: 'Clients', href: '/clients', icon: Users, show: canViewClients },
      ]
    },
    {
      header: 'Communication',
      items: [
        { name: 'Messages', href: '/messages', icon: MessageCircle, show: true },
        { name: 'Analytics', href: '/analytics', icon: BarChart3, show: planSlug !== 'free' },
      ]
    },
    {
      header: 'Admin',
      items: [
        { name: 'Team', href: '/team', icon: Users, show: canViewUsers },
        { name: 'Settings', href: '/settings', icon: Settings, show: canViewSettings },
        { name: 'Integrations', href: '/integrations', icon: Settings, show: true },
        { name: 'Dev Portal', href: '/dev-portal', icon: Settings, show: true },
        { name: 'Billing', href: '/billing', icon: CreditCard, show: true },
      ]
    },
  ];

  const toggleSection = (header: string) => {
    setCollapsed((prev) => {
      const next = { ...prev, [header]: !prev[header] };
      localStorage.setItem('sidebar_collapsed', JSON.stringify(next));
      return next;
    });
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="h-screen flex overflow-hidden bg-gray-100 dark:bg-gray-900">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 flex z-40 md:hidden ${sidebarOpen ? '' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        
        <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white dark:bg-gray-800">
          <div className="absolute top-0 right-0 -mr-12 pt-2">
          <button
              className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
            onClick={() => setSidebarOpen(false)}
          >
              <X className="h-6 w-6 text-white" />
          </button>
        </div>
        
          <div className="flex-1 h-0 pt-5 pb-4 overflow-y-auto">
            <div className="flex-shrink-0 flex items-center px-4">
              <div className="flex items-center">
                {/* Logo */}
                <img 
                  src="/logo.png" 
                  alt="TaskFlask" 
                  className="h-10 w-auto"
                  onError={(e) => {
                    // Fallback to icon if logo doesn't exist
                    (e.target as HTMLImageElement).style.display = 'none';
                    const fallback = (e.target as HTMLImageElement).nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
                <div className="h-8 w-8 bg-primary-600 rounded-lg items-center justify-center" style={{ display: 'none' }}>
                  <Building2 className="h-5 w-5 text-white" />
                </div>
                <div className="ml-3">
                  <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">TaskFlask</h1>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{organization?.name}</p>
                </div>
              </div>
            </div>
            
            <nav className="mt-5 px-2 space-y-6">
              {navigationSections.map((section) => (
                <div key={section.header}>
                  <button type="button" onClick={() => toggleSection(section.header)} className="w-full flex items-center justify-between px-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <span>{section.header}</span>
                    <ChevronDown className={`h-3 w-3 transition-transform ${collapsed[section.header] ? '-rotate-90' : ''}`} />
                  </button>
                  <div className={`mt-2 space-y-1 ${collapsed[section.header] ? 'hidden' : ''}` }>
                    {section.items.filter(i => i.show).map((item) => {
                      const isActive = location.pathname === item.href;
                      return (
                        <Link
                          key={item.name}
                          to={item.href}
                          className={`group flex items-center px-2 py-2 text-base font-medium rounded-md ${
                            isActive
                              ? 'bg-primary-100 text-primary-900 dark:bg-primary-900/30 dark:text-primary-100'
                              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
                          }`}
                          onClick={() => setSidebarOpen(false)}
                        >
                          <item.icon className={`mr-4 h-6 w-6 ${
                            isActive ? 'text-primary-500' : 'text-gray-400 group-hover:text-gray-500 dark:text-gray-400 dark:group-hover:text-gray-300'
                          }`} />
                          {item.name}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </div>
        </div>
          </div>

      {/* Desktop sidebar */}
      <div className="hidden md:flex md:flex-shrink-0">
        <div className="flex flex-col w-64">
          <div className="flex flex-col h-0 flex-1 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
            <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
              <div className="flex items-center flex-shrink-0 px-4">
                <div className="flex items-center">
                  {/* Logo */}
                  <img 
                    src="/logo.png" 
                    alt="TaskFlask" 
                    className="h-10 w-auto"
                    onError={(e) => {
                      // Fallback to icon if logo doesn't exist
                      (e.target as HTMLImageElement).style.display = 'none';
                      const fallback = (e.target as HTMLImageElement).nextElementSibling as HTMLElement;
                      if (fallback) fallback.style.display = 'flex';
                    }}
                  />
                  <div className="h-8 w-8 bg-primary-600 rounded-lg items-center justify-center" style={{ display: 'none' }}>
                    <Building2 className="h-5 w-5 text-white" />
                  </div>
                  <div className="ml-3">
                    <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">TaskFlask</h1>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{organization?.name}</p>
                </div>
                </div>
              </div>
              
              <nav className="mt-5 flex-1 px-2 space-y-6">
                {navigationSections.map((section) => (
                  <div key={section.header}>
                    <button type="button" onClick={() => toggleSection(section.header)} className="w-full flex items-center justify-between px-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      <span>{section.header}</span>
                      <ChevronDown className={`h-3 w-3 transition-transform ${collapsed[section.header] ? '-rotate-90' : ''}`} />
                    </button>
                    <div className={`mt-2 space-y-1 ${collapsed[section.header] ? 'hidden' : ''}` }>
                      {section.items.filter(i => i.show).map((item) => {
                        const isActive = location.pathname === item.href;
                        return (
                          <Link
                            key={item.name}
                            to={item.href}
                            className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                              isActive
                                ? 'bg-primary-100 text-primary-900 dark:bg-primary-900/30 dark:text-primary-100'
                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
                            }`}
                          >
                            <item.icon className={`mr-3 h-5 w-5 ${
                              isActive ? 'text-primary-500' : 'text-gray-400 group-hover:text-gray-500 dark:text-gray-400 dark:group-hover:text-gray-300'
                            }`} />
                            {item.name}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </nav>
            </div>
            </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-col w-0 flex-1 overflow-hidden">
        {/* Top navigation */}
        <div className="relative z-10 flex-shrink-0 flex h-16 bg-white shadow">
            <button
            className="px-4 border-r border-gray-200 text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 md:hidden"
              onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>
          
          <div className="flex-1 px-4 flex justify-between">
            <div className="flex-1 flex">
              <div className="w-full flex md:ml-0">
                <label htmlFor="search-field" className="sr-only">Search</label>
                <div className="relative w-full text-gray-400 focus-within:text-gray-600">
                  <div className="absolute inset-y-0 left-0 flex items-center pointer-events-none">
                    <Search className="h-5 w-5" />
                  </div>
                  <input
                    id="search-field"
                    className="block w-full h-full pl-8 pr-3 py-2 border-transparent text-gray-900 placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-0 focus:border-transparent sm:text-sm"
                    placeholder="Search projects, tasks..."
                    type="search"
                  />
                </div>
              </div>
            </div>
            
            <div className="ml-4 flex items-center md:ml-6">
              {/* Notifications */}
              <button 
                onClick={handleNotificationClick}
                className={`bg-white p-1 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors ${
                  notificationPermission === 'granted' && notificationsEnabled
                    ? 'text-green-600 hover:text-green-700' 
                    : notificationPermission === 'granted' && !notificationsEnabled
                    ? 'text-yellow-500 hover:text-yellow-600'
                    : notificationPermission === 'denied'
                    ? 'text-red-400 hover:text-red-500'
                    : 'text-gray-400 hover:text-gray-500'
                }`}
                title={
                  notificationPermission === 'granted' && notificationsEnabled
                    ? 'Notifications enabled - click to disable' 
                    : notificationPermission === 'granted' && !notificationsEnabled
                    ? 'Notifications disabled - click to enable'
                    : notificationPermission === 'denied'
                    ? 'Notifications blocked - check browser settings'
                    : 'Click to enable desktop notifications'
                }
              >
                <Bell className="h-6 w-6" />
              </button>

              {/* Theme toggle moved to Settings */}

              {/* Profile dropdown */}
              <div className="ml-3 relative z-50" data-dropdown="user-menu">
                <div>
                  <button
                    className="max-w-xs bg-white flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                  >
                    <div className="h-8 w-8 rounded-full bg-primary-600 flex items-center justify-center text-white text-sm font-medium">
                      {user?.avatar_url ? (
                        <img className="h-8 w-8 rounded-full" src={user.avatar_url} alt="" />
                      ) : (
                        getInitials(userDisplayName)
                      )}
                    </div>
                    <div className="hidden md:block ml-3 text-left">
                      <p className="text-sm font-medium text-gray-700">{userDisplayName}</p>
                      <div className="flex items-center space-x-2">
                        <p className="text-xs text-gray-500">{user?.email}</p>
                        {user?.user_status && (
                          <div className={`h-2 w-2 rounded-full ${
                            user.user_status === 'online' ? 'bg-green-500' :
                            user.user_status === 'busy' ? 'bg-yellow-500' :
                            user.user_status === 'dnd' ? 'bg-red-500' : 'bg-gray-400'
                          }`} title={user.user_status} />
                        )}
                      </div>
                    </div>
                    <ChevronDown className="hidden md:block ml-2 h-4 w-4 text-gray-400" />
                  </button>
                </div>
                
                {userMenuOpen && (
                  <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-[100]">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-900">{userDisplayName}</p>
                      <p className="text-xs text-gray-500">{organization?.name}</p>
                    </div>
                    
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        navigate('/profile');
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 text-left"
                    >
                      <User className="mr-3 h-4 w-4" />
                      Your Profile
                    </button>
                    
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        navigate('/settings');
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 text-left"
                    >
                      <Settings className="mr-3 h-4 w-4" />
                      Settings
            </button>
            
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        handleLogout();
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 text-left"
                    >
                      <LogOut className="mr-3 h-4 w-4" />
                      Sign out
                    </button>
                </div>
              )}
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 relative overflow-y-auto focus:outline-none">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          {children}
            </div>
          </div>
        </main>
      </div>


    </div>
  );
};

export default Layout;
