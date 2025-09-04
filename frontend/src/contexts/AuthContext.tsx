import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authApi, hasPermission } from '../services/api';
import { 
  AuthContextType, 
  User, 
  Organization, 
  LoginRequest, 
  RegisterRequest, 
  AuthResponse 
} from '../types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWindowFocused, setIsWindowFocused] = useState(true);

  // Initialize auth state from localStorage
  useEffect(() => {
    const initializeAuth = () => {
      try {
        const storedToken = localStorage.getItem('authToken');
        const storedUser = authApi.getStoredUser();
        const storedOrganization = authApi.getStoredOrganization();
        const storedPermissions = authApi.getStoredPermissions();

        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(storedUser);
          setOrganization(storedOrganization);
          setPermissions(storedPermissions);
          
          // Try to verify token, but don't logout if it fails (might be network issue)
          authApi.getCurrentUser()
            .then((response) => {
              // Update with fresh data if available
              if (response.user) {
                setUser(response.user);
                localStorage.setItem('user', JSON.stringify(response.user));
              }
              if (response.organization) {
                setOrganization(response.organization);
                localStorage.setItem('organization', JSON.stringify(response.organization));
              }
              if (response.permissions) {
                setPermissions(response.permissions);
                localStorage.setItem('permissions', JSON.stringify(response.permissions));
              }
              
              // Set user status to online when they load the app
              if (response.user && response.user.user_status !== 'online') {
                authApi.updateUserStatus('online').catch((error) => {
                  console.warn('Failed to update user status to online:', error);
                });
              }
            })
            .catch((error) => {
              console.warn('Token validation failed, keeping local session:', error);
              // Don't logout immediately - might be network issue
              // User can still use the app with cached data
              
              // Still try to set status to online for stored user
              if (storedUser && storedUser.user_status !== 'online') {
                authApi.updateUserStatus('online').catch((error) => {
                  console.warn('Failed to update user status to online:', error);
                });
              }
            });
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        logout();
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // Track window focus to manage online status
  useEffect(() => {
    const handleFocus = () => {
      setIsWindowFocused(true);
      if (user && token) {
        authApi.updateUserStatus('online').catch((error) => {
          console.warn('Failed to update status to online:', error);
        });
      }
    };

    const handleBlur = () => {
      setIsWindowFocused(false);
      if (user && token) {
        // Don't immediately set to offline, just track that window is not focused
        // We'll set to offline after a delay or when they actually leave
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setIsWindowFocused(true);
        if (user && token) {
          authApi.updateUserStatus('online').catch((error) => {
            console.warn('Failed to update status to online:', error);
          });
        }
      } else {
        setIsWindowFocused(false);
        // Set to offline when tab is hidden for more than 5 minutes
        setTimeout(() => {
          if (document.visibilityState === 'hidden' && user && token) {
            authApi.updateUserStatus('offline').catch((error) => {
              console.warn('Failed to update status to offline:', error);
            });
          }
        }, 5 * 60 * 1000); // 5 minutes
      }
    };

    const handleBeforeUnload = () => {
      if (user && token) {
        // Set to offline when user closes tab/browser
        navigator.sendBeacon('/api/auth/status', JSON.stringify({ user_status: 'offline' }));
      }
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [user, token]);

  const login = async (credentials: LoginRequest): Promise<AuthResponse> => {
    try {
      setIsLoading(true);
      const response = await authApi.login(credentials);
      
      if (response.requireOrganizationSelection) {
        // User belongs to multiple organizations, return response for org selection
        return response;
      }
      
      // Normal login flow
      if (response.token && response.user && response.organization) {
        setToken(response.token);
        setUser(response.user);
        setOrganization(response.organization);
        setPermissions(response.permissions);
        
        // Store in localStorage
        localStorage.setItem('authToken', response.token);
        localStorage.setItem('user', JSON.stringify(response.user));
        localStorage.setItem('organization', JSON.stringify(response.organization));
        localStorage.setItem('permissions', JSON.stringify(response.permissions));
      }
      
      return response;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: RegisterRequest): Promise<AuthResponse> => {
    try {
      setIsLoading(true);
      const response = await authApi.register(data);
      
      if (response.token && response.user && response.organization) {
        setToken(response.token);
        setUser(response.user);
        setOrganization(response.organization);
        setPermissions(response.permissions);
        
        // Store in localStorage
        localStorage.setItem('authToken', response.token);
        localStorage.setItem('user', JSON.stringify(response.user));
        localStorage.setItem('organization', JSON.stringify(response.organization));
        localStorage.setItem('permissions', JSON.stringify(response.permissions));
      }
      
      return response;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const selectOrganization = async (orgSlug: string): Promise<void> => {
    try {
      setIsLoading(true);
      
      // Get current user's email from stored user or token
      const email = user?.email || authApi.getStoredUser()?.email;
      if (!email) {
        throw new Error('No user email found');
      }
      
      // Login with specific organization
      const response = await authApi.login({ 
        email, 
        password: '', // We'll need to handle this differently in a real app
        organization_slug: orgSlug 
      });
      
      if (response.token && response.user && response.organization) {
        setToken(response.token);
        setUser(response.user);
        setOrganization(response.organization);
        setPermissions(response.permissions);
        
        // Store in localStorage
        localStorage.setItem('authToken', response.token);
        localStorage.setItem('user', JSON.stringify(response.user));
        localStorage.setItem('organization', JSON.stringify(response.organization));
        localStorage.setItem('permissions', JSON.stringify(response.permissions));
      }
    } catch (error) {
      console.error('Organization selection error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setOrganization(null);
    setPermissions([]);
    setToken(null);
    authApi.logout();
  };

  const hasUserPermission = (permission: string): boolean => {
    return hasPermission(permissions, permission);
  };

  const value: AuthContextType = {
    user,
    organization,
    permissions,
    token,
    login,
    register,
    logout,
    selectOrganization,
    hasPermission: hasUserPermission,
    isLoading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Helper hook for checking permissions
export const usePermission = (permission: string): boolean => {
  const { hasPermission } = useAuth();
  return hasPermission(permission);
};

// Helper hook for checking multiple permissions (any)
export const useAnyPermission = (permissions: string[]): boolean => {
  const { hasPermission } = useAuth();
  return permissions.some(permission => hasPermission(permission));
};

// Helper hook for checking if user is admin
export const useIsAdmin = (): boolean => {
  const { permissions } = useAuth();
  return hasPermission(permissions, 'org.edit') || 
         hasPermission(permissions, 'users.invite') ||
         hasPermission(permissions, 'org.*') ||
         hasPermission(permissions, '*');
};

// Helper hook for getting user display name
export const useUserDisplayName = (): string => {
  const { user } = useAuth();
  if (!user) return '';
  
  if (user.first_name || user.last_name) {
    return `${user.first_name || ''} ${user.last_name || ''}`.trim();
  }
  return user.username;
};

export default AuthContext;
