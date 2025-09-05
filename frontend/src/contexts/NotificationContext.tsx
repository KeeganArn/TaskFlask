import React, { createContext, useContext, useState, useEffect } from 'react';

interface NotificationContextType {
  permission: NotificationPermission;
  isEnabled: boolean;
  requestPermission: () => Promise<void>;
  toggleNotifications: () => void;
  showNotification: (title: string, body: string, options?: NotificationOptions & { onClick?: () => void }) => void;
  isSupported: boolean;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface NotificationProviderProps {
  children: React.ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [isEnabled, setIsEnabled] = useState<boolean>(
    localStorage.getItem('flowbit-notifications-enabled') !== 'false'
  );
  
  const isSupported = typeof Notification !== 'undefined';

  const requestPermission = async () => {
    if (!isSupported) {
      throw new Error('This browser does not support desktop notifications.');
    }

    if (permission === 'granted') {
      return;
    }

    try {
      const newPermission = await Notification.requestPermission();
      setPermission(newPermission);
      
      if (newPermission === 'granted') {
        setIsEnabled(true);
        localStorage.setItem('flowbit-notifications-enabled', 'true');
        
        // Show a test notification
        new Notification('Flowbit Notifications Enabled!', {
          body: 'You will now receive desktop notifications for messages and updates.',
          icon: '/favicon.ico'
        });
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      throw error;
    }
  };

  const toggleNotifications = () => {
    const newEnabled = !isEnabled;
    setIsEnabled(newEnabled);
    localStorage.setItem('flowbit-notifications-enabled', newEnabled.toString());
    
    if (newEnabled && permission === 'granted') {
      // Show confirmation notification when re-enabling
      new Notification('Flowbit Notifications Enabled!', {
        body: 'You will now receive desktop notifications.',
        icon: '/favicon.ico'
      });
    }
  };

  const showNotification = (
    title: string, 
    body: string, 
    options?: NotificationOptions & { onClick?: () => void }
  ) => {
    if (permission === 'granted' && isSupported && isEnabled) {
      const notification = new Notification(title, {
        body,
        icon: options?.icon || '/favicon.ico',
        tag: options?.tag || 'flowbit-notification',
        ...options
      });

      if (options?.onClick) {
        notification.onclick = options.onClick;
      }

      // Auto-close after 5 seconds unless specified otherwise
      const autoClose = options?.requireInteraction ? false : true;
      if (autoClose) {
        setTimeout(() => notification.close(), 5000);
      }
    }
  };

  // Update permission state when it changes
  useEffect(() => {
    if (isSupported) {
      const checkPermission = () => {
        setPermission(Notification.permission);
      };
      
      // Check permission periodically in case user changes it in browser settings
      const interval = setInterval(checkPermission, 5000);
      return () => clearInterval(interval);
    }
  }, [isSupported]);

  const contextValue: NotificationContextType = {
    permission,
    isEnabled,
    requestPermission,
    toggleNotifications,
    showNotification,
    isSupported
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
