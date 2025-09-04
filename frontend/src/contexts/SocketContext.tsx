import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { Message, ChatRoom } from '../types';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  onlineUsers: number[];
  joinRoom: (roomId: number) => void;
  leaveRoom: (roomId: number) => void;
  sendMessage: (roomId: number, content: string, messageType?: string) => void;
  startTyping: (roomId: number) => void;
  stopTyping: (roomId: number) => void;
  updateStatus: (status: string) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

interface SocketProviderProps {
  children: ReactNode;
}

interface SocketEventHandlers {
  onNewMessage?: (message: Message) => void;
  onNewChatRoom?: (chatRoom: ChatRoom) => void;
  onUserStatusChanged?: (data: { userId: number; status: string; timestamp: Date }) => void;
  onUserTyping?: (data: { userId: number; username: string; roomId: number }) => void;
  onUserStoppedTyping?: (data: { userId: number; roomId: number }) => void;
  onRoomUpdated?: (update: any) => void;
  onError?: (error: { message: string }) => void;
}

export const SocketProvider: React.FC<SocketProviderProps & SocketEventHandlers> = ({ 
  children, 
  onNewMessage,
  onNewChatRoom,
  onUserStatusChanged,
  onUserTyping,
  onUserStoppedTyping,
  onRoomUpdated,
  onError
}) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<number[]>([]);
  const { user, token } = useAuth();

  useEffect(() => {
    if (user && token) {
      // Create socket connection
      const newSocket = io(import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000', {
        auth: {
          token: token
        },
        transports: ['websocket', 'polling']
      });

      // Connection event handlers
      newSocket.on('connect', () => {
        console.log('✅ Connected to WebSocket server');
        setIsConnected(true);
      });

      newSocket.on('disconnect', (reason) => {
        console.log('❌ Disconnected from WebSocket server:', reason);
        setIsConnected(false);
      });

      newSocket.on('connect_error', (error) => {
        console.error('🔥 WebSocket connection error:', error);
        setIsConnected(false);
      });

      // Message event handlers
      newSocket.on('new_message', (message: Message) => {
        console.log('📨 New message received:', message);
        onNewMessage?.(message);
      });

      newSocket.on('new_chat_room', (chatRoom: ChatRoom) => {
        console.log('🏠 New chat room created:', chatRoom);
        onNewChatRoom?.(chatRoom);
      });

      newSocket.on('user_status_changed', (data: { userId: number; status: string; timestamp: Date }) => {
        console.log('👤 User status changed:', data);
        onUserStatusChanged?.(data);
      });

      newSocket.on('user_typing', (data: { userId: number; username: string; roomId: number }) => {
        console.log('⌨️ User typing:', data);
        onUserTyping?.(data);
      });

      newSocket.on('user_stopped_typing', (data: { userId: number; roomId: number }) => {
        console.log('⌨️ User stopped typing:', data);
        onUserStoppedTyping?.(data);
      });

      newSocket.on('room_updated', (update: any) => {
        console.log('🔄 Room updated:', update);
        onRoomUpdated?.(update);
      });

      newSocket.on('error', (error: { message: string }) => {
        console.error('❗ Socket error:', error);
        onError?.(error);
      });

      setSocket(newSocket);

      // Cleanup on unmount
      return () => {
        console.log('🧹 Cleaning up WebSocket connection');
        newSocket.disconnect();
        setSocket(null);
        setIsConnected(false);
      };
    } else {
      // Disconnect if user logs out
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
    }
  }, [user, token]); // Only reconnect when user or token changes

  const joinRoom = (roomId: number) => {
    if (socket && isConnected) {
      socket.emit('join_room', roomId);
      console.log(`🏠 Joining room ${roomId}`);
    }
  };

  const leaveRoom = (roomId: number) => {
    if (socket && isConnected) {
      socket.emit('leave_room', roomId);
      console.log(`🚪 Leaving room ${roomId}`);
    }
  };

  const sendMessage = (roomId: number, content: string, messageType = 'text') => {
    if (socket && isConnected) {
      socket.emit('send_message', { roomId, content, messageType });
      console.log(`📤 Sending message to room ${roomId}:`, content);
    } else {
      console.warn('Cannot send message: Socket not connected');
    }
  };

  const startTyping = (roomId: number) => {
    if (socket && isConnected) {
      socket.emit('typing_start', roomId);
    }
  };

  const stopTyping = (roomId: number) => {
    if (socket && isConnected) {
      socket.emit('typing_stop', roomId);
    }
  };

  const updateStatus = (status: string) => {
    if (socket && isConnected) {
      socket.emit('update_status', status);
      console.log(`📊 Updating status to: ${status}`);
    }
  };

  const value: SocketContextType = {
    socket,
    isConnected,
    onlineUsers,
    joinRoom,
    leaveRoom,
    sendMessage,
    startTyping,
    stopTyping,
    updateStatus
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

// Custom hook for messaging-specific socket events
export const useMessagingSocket = (handlers: SocketEventHandlers) => {
  const { socket, isConnected } = useSocket();

  useEffect(() => {
    if (!socket || !isConnected) return;

    const { 
      onNewMessage,
      onNewChatRoom,
      onUserStatusChanged,
      onUserTyping,
      onUserStoppedTyping,
      onRoomUpdated,
      onError
    } = handlers;

    // Register handlers
    if (onNewMessage) socket.on('new_message', onNewMessage);
    if (onNewChatRoom) socket.on('new_chat_room', onNewChatRoom);
    if (onUserStatusChanged) socket.on('user_status_changed', onUserStatusChanged);
    if (onUserTyping) socket.on('user_typing', onUserTyping);
    if (onUserStoppedTyping) socket.on('user_stopped_typing', onUserStoppedTyping);
    if (onRoomUpdated) socket.on('room_updated', onRoomUpdated);
    if (onError) socket.on('error', onError);

    // Cleanup
    return () => {
      if (onNewMessage) socket.off('new_message', onNewMessage);
      if (onNewChatRoom) socket.off('new_chat_room', onNewChatRoom);
      if (onUserStatusChanged) socket.off('user_status_changed', onUserStatusChanged);
      if (onUserTyping) socket.off('user_typing', onUserTyping);
      if (onUserStoppedTyping) socket.off('user_stopped_typing', onUserStoppedTyping);
      if (onRoomUpdated) socket.off('room_updated', onRoomUpdated);
      if (onError) socket.off('error', onError);
    };
  }, [socket, isConnected, handlers]);

  return { socket, isConnected };
};

export default SocketContext;
