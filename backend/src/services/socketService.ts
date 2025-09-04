import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import pool from '../database/config';
import { User } from '../types';

interface AuthenticatedSocket extends Socket {
  user?: User;
  organizationId?: number;
}

interface Socket {
  id: string;
  emit: (event: string, data: any) => void;
  join: (room: string) => void;
  leave: (room: string) => void;
  on: (event: string, callback: (data: any) => void) => void;
  disconnect: () => void;
  handshake: {
    auth: {
      token?: string;
    };
  };
}

export class SocketService {
  private io: SocketIOServer;
  private connectedUsers: Map<number, Set<string>> = new Map(); // userId -> socketIds

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        credentials: true
      }
    });

    this.setupAuthentication();
    this.setupEventHandlers();
  }

  private setupAuthentication() {
    this.io.use(async (socket: any, next) => {
      try {
        const token = socket.handshake.auth.token;
        
        if (!token) {
          return next(new Error('Authentication error: No token provided'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
        
        // Get user details from database
        const [userRows] = await pool.execute(
          `SELECT u.*, om.organization_id, om.role_id, r.name as role_name, r.permissions
           FROM users u 
           INNER JOIN organization_members om ON u.id = om.user_id 
           INNER JOIN roles r ON om.role_id = r.id
           WHERE u.id = ? AND u.is_active = TRUE AND om.status = 'active'`,
          [decoded.userId]
        );

        if ((userRows as any[]).length === 0) {
          return next(new Error('Authentication error: User not found'));
        }

        const user = (userRows as any[])[0];
        socket.user = {
          id: user.id,
          username: user.username,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          avatar_url: user.avatar_url,
          user_status: user.user_status,
          organization_id: user.organization_id,
          role: {
            id: user.role_id,
            name: user.role_name,
            permissions: JSON.parse(user.permissions || '[]')
          }
        };
        socket.organizationId = user.organization_id;

        next();
      } catch (error) {
        console.error('Socket authentication error:', error);
        next(new Error('Authentication error'));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      console.log(`User ${socket.user?.username} connected (${socket.id})`);

      // Track connected user
      if (socket.user) {
        this.addConnectedUser(socket.user.id, socket.id);
        
        // Update user status to online
        this.updateUserStatus(socket.user.id, 'online');
        
        // Join organization room for broadcasts
        socket.join(`org_${socket.organizationId}`);
        
        // Join user's chat rooms
        this.joinUserChatRooms(socket);
        
        // Notify organization about user coming online
        this.broadcastUserStatusChange(socket.organizationId!, socket.user.id, 'online');
      }

      // Handle joining specific chat rooms
      socket.on('join_room', (roomId: number) => {
        this.handleJoinRoom(socket, roomId);
      });

      // Handle leaving chat rooms
      socket.on('leave_room', (roomId: number) => {
        socket.leave(`room_${roomId}`);
        console.log(`User ${socket.user?.username} left room ${roomId}`);
      });

      // Handle sending messages
      socket.on('send_message', (data: { roomId: number; content: string; messageType?: string }) => {
        this.handleSendMessage(socket, data);
      });

      // Handle typing indicators
      socket.on('typing_start', (roomId: number) => {
        socket.to(`room_${roomId}`).emit('user_typing', {
          userId: socket.user?.id,
          username: socket.user?.username,
          roomId
        });
      });

      socket.on('typing_stop', (roomId: number) => {
        socket.to(`room_${roomId}`).emit('user_stopped_typing', {
          userId: socket.user?.id,
          roomId
        });
      });

      // Handle status updates
      socket.on('update_status', (status: string) => {
        if (socket.user) {
          this.updateUserStatus(socket.user.id, status);
          this.broadcastUserStatusChange(socket.organizationId!, socket.user.id, status);
        }
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`User ${socket.user?.username} disconnected (${socket.id})`);
        
        if (socket.user) {
          this.removeConnectedUser(socket.user.id, socket.id);
          
          // If user has no more connections, set to offline
          if (!this.isUserConnected(socket.user.id)) {
            this.updateUserStatus(socket.user.id, 'offline');
            this.broadcastUserStatusChange(socket.organizationId!, socket.user.id, 'offline');
          }
        }
      });
    });
  }

  private async joinUserChatRooms(socket: AuthenticatedSocket) {
    try {
      if (!socket.user) return;

      // Get all chat rooms user participates in
      const [rooms] = await pool.execute(`
        SELECT DISTINCT cr.id 
        FROM chat_rooms cr
        INNER JOIN chat_participants cp ON cr.id = cp.chat_room_id
        WHERE cp.user_id = ? AND cp.is_active = TRUE AND cr.organization_id = ?
      `, [socket.user.id, socket.organizationId]);

      (rooms as any[]).forEach(room => {
        socket.join(`room_${room.id}`);
      });

      console.log(`User ${socket.user.username} joined ${(rooms as any[]).length} chat rooms`);
    } catch (error) {
      console.error('Error joining user chat rooms:', error);
    }
  }

  private async handleJoinRoom(socket: AuthenticatedSocket, roomId: number) {
    try {
      if (!socket.user) return;

      // Verify user has access to this room
      const [access] = await pool.execute(`
        SELECT cr.id 
        FROM chat_rooms cr
        INNER JOIN chat_participants cp ON cr.id = cp.chat_room_id
        WHERE cr.id = ? AND cp.user_id = ? AND cp.is_active = TRUE AND cr.organization_id = ?
      `, [roomId, socket.user.id, socket.organizationId]);

      if ((access as any[]).length > 0) {
        socket.join(`room_${roomId}`);
        console.log(`User ${socket.user.username} joined room ${roomId}`);
        
        // Update last read timestamp
        await pool.execute(
          `UPDATE chat_participants SET last_read_at = CURRENT_TIMESTAMP WHERE chat_room_id = ? AND user_id = ?`,
          [roomId, socket.user.id]
        );
      } else {
        socket.emit('error', { message: 'Access denied to chat room' });
      }
    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  }

  private async handleSendMessage(socket: AuthenticatedSocket, data: { roomId: number; content: string; messageType?: string }) {
    try {
      if (!socket.user) return;

      const { roomId, content, messageType = 'text' } = data;

      // Verify access and insert message via API logic
      const connection = await pool.getConnection();
      
      try {
        await connection.beginTransaction();

        // Verify access
        const [access] = await connection.execute(`
          SELECT cr.id 
          FROM chat_rooms cr
          INNER JOIN chat_participants cp ON cr.id = cp.chat_room_id
          WHERE cr.id = ? AND cp.user_id = ? AND cp.is_active = TRUE AND cr.organization_id = ?
        `, [roomId, socket.user.id, socket.organizationId]);

        if ((access as any[]).length === 0) {
          socket.emit('error', { message: 'Access denied to chat room' });
          return;
        }

        // Insert message
        const [messageResult] = await connection.execute(
          `INSERT INTO messages (chat_room_id, sender_id, content, message_type)
           VALUES (?, ?, ?, ?)`,
          [roomId, socket.user.id, content, messageType]
        );

        const messageId = (messageResult as any).insertId;

        // Update room's last message timestamp
        await connection.execute(
          `UPDATE chat_rooms SET last_message_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [roomId]
        );

        await connection.commit();

        // Get the complete message with sender info
        const [messageData] = await connection.execute(`
          SELECT 
            m.*,
            u.username, u.first_name, u.last_name, u.avatar_url
          FROM messages m
          INNER JOIN users u ON m.sender_id = u.id
          WHERE m.id = ?
        `, [messageId]);

        const message = (messageData as any[])[0];
        const transformedMessage = {
          id: message.id,
          chat_room_id: message.chat_room_id,
          sender_id: message.sender_id,
          content: message.content,
          message_type: message.message_type,
          created_at: message.created_at,
          sender: {
            id: message.sender_id,
            username: message.username,
            first_name: message.first_name,
            last_name: message.last_name,
            avatar_url: message.avatar_url
          }
        };

        // Broadcast message to all room participants
        this.io.to(`room_${roomId}`).emit('new_message', transformedMessage);

      } finally {
        connection.release();
      }

    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  }

  private addConnectedUser(userId: number, socketId: string) {
    if (!this.connectedUsers.has(userId)) {
      this.connectedUsers.set(userId, new Set());
    }
    this.connectedUsers.get(userId)!.add(socketId);
  }

  private removeConnectedUser(userId: number, socketId: string) {
    const userSockets = this.connectedUsers.get(userId);
    if (userSockets) {
      userSockets.delete(socketId);
      if (userSockets.size === 0) {
        this.connectedUsers.delete(userId);
      }
    }
  }

  private isUserConnected(userId: number): boolean {
    return this.connectedUsers.has(userId) && this.connectedUsers.get(userId)!.size > 0;
  }

  private async updateUserStatus(userId: number, status: string) {
    try {
      await pool.execute(
        `UPDATE users SET user_status = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?`,
        [status, userId]
      );
    } catch (error) {
      console.error('Error updating user status:', error);
    }
  }

  private broadcastUserStatusChange(organizationId: number, userId: number, status: string) {
    this.io.to(`org_${organizationId}`).emit('user_status_changed', {
      userId,
      status,
      timestamp: new Date()
    });
  }

  // Public methods for external use
  public notifyNewChatRoom(organizationId: number, chatRoom: any) {
    this.io.to(`org_${organizationId}`).emit('new_chat_room', chatRoom);
  }

  public notifyRoomUpdate(roomId: number, update: any) {
    this.io.to(`room_${roomId}`).emit('room_updated', update);
  }

  public getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  public getConnectedUsers(): number[] {
    return Array.from(this.connectedUsers.keys());
  }
}

export default SocketService;
