import { Router, Response } from 'express';
import { ChatRoom, Message, CreateChatRoomRequest, CreateMessageRequest, UpdateMessageRequest } from '../types';
import pool from '../database/config';
import { authenticate } from '../middleware/rbac';
import { AuthenticatedRequest } from '../types';

const router = Router();

/**
 * GET /messages/rooms - Get all chat rooms for user
 */
router.get('/rooms', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const organizationId = req.user!.organization_id;

    const [rows] = await pool.execute(`
      SELECT 
        cr.*,
        COUNT(DISTINCT cp.user_id) as participant_count,
        0 as unread_count,
        last_msg.content as last_message_content,
        last_msg.created_at as last_message_at,
        last_msg.message_type as last_message_type,
        sender.username as last_message_sender
      FROM chat_rooms cr
      INNER JOIN chat_participants cp_user ON cr.id = cp_user.chat_room_id AND cp_user.user_id = ? AND cp_user.left_at IS NULL
      LEFT JOIN chat_participants cp ON cr.id = cp.chat_room_id AND cp.left_at IS NULL
      LEFT JOIN messages m ON cr.id = m.chat_room_id
      LEFT JOIN messages last_msg ON cr.id = last_msg.chat_room_id
      LEFT JOIN users sender ON last_msg.sender_id = sender.id
      WHERE cr.organization_id = ?
      GROUP BY cr.id
      ORDER BY cr.updated_at DESC
    `, [userId, organizationId]);

    // Get participant details for each chat room
    const chatRoomsWithParticipants = await Promise.all(
      (rows as any[]).map(async (row) => {
        // Get participants for this room
        const [participants] = await pool.execute(`
          SELECT cp.user_id, cp.role, u.username, u.first_name, u.last_name, u.email
          FROM chat_participants cp
          JOIN users u ON cp.user_id = u.id
          WHERE cp.chat_room_id = ? AND cp.left_at IS NULL
        `, [row.id]);

        return {
          id: row.id,
          name: row.name,
          type: row.type,
          organization_id: row.organization_id,
          created_by: row.created_by,
          description: row.description,
          created_at: row.created_at,
          updated_at: row.updated_at,
          participant_count: parseInt(row.participant_count),
          unread_count: parseInt(row.unread_count),
          participants: (participants as any[]).map(p => ({
            user_id: p.user_id,
            role: p.role,
            user: {
              id: p.user_id,
              username: p.username,
              first_name: p.first_name,
              last_name: p.last_name,
              email: p.email
            }
          })),
          last_message: row.last_message_content ? {
            content: row.last_message_content,
            created_at: row.last_message_at,
            message_type: row.last_message_type,
            sender: { username: row.last_message_sender }
          } : null
        };
      })
    );

    res.json(chatRoomsWithParticipants);
  } catch (error) {
    console.error('Error fetching chat rooms:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * POST /messages/rooms - Create new chat room
 */
router.post('/rooms', authenticate, async (req: AuthenticatedRequest<{}, {}, CreateChatRoomRequest>, res: Response) => {
  try {
    const { name, type, description, is_private = true, project_id, participant_ids } = req.body;
    const userId = req.user!.id;
    const organizationId = req.user!.organization_id;

    // Validate participants are in the same organization
    if (participant_ids && participant_ids.length > 0) {
      const [participantCheck] = await pool.execute(
        `SELECT COUNT(*) as count FROM users WHERE id IN (${participant_ids.map(() => '?').join(',')}) AND organization_id = ?`,
        [...participant_ids, organizationId]
      );
      
      if ((participantCheck as any[])[0].count !== participant_ids.length) {
        return res.status(400).json({ message: 'All participants must be in the same organization' });
      }
    }

    // For direct messages, check if chat room already exists
    if (type === 'direct' && participant_ids && participant_ids.length === 1) {
      const otherUserId = participant_ids[0];
      const [existingRoom] = await pool.execute(`
        SELECT cr.id 
        FROM chat_rooms cr
        INNER JOIN chat_participants cp1 ON cr.id = cp1.chat_room_id AND cp1.user_id = ?
        INNER JOIN chat_participants cp2 ON cr.id = cp2.chat_room_id AND cp2.user_id = ?
        WHERE cr.type = 'direct' AND cr.organization_id = ?
        GROUP BY cr.id
        HAVING COUNT(DISTINCT cp1.user_id) = 2
      `, [userId, otherUserId, organizationId]);

      if ((existingRoom as any[]).length > 0) {
        return res.status(400).json({ message: 'Direct message room already exists' });
      }
    }

    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // Create chat room
      const [roomResult] = await connection.execute(
        `INSERT INTO chat_rooms (name, type, organization_id, created_by, description)
         VALUES (?, ?, ?, ?, ?)`,
        [name || null, type, organizationId, userId, description || null]
      );

      const chatRoomId = (roomResult as any).insertId;

      // Add creator as owner
      await connection.execute(
        `INSERT INTO chat_participants (chat_room_id, user_id, role)
         VALUES (?, ?, 'owner')`,
        [chatRoomId, userId]
      );

      // Add other participants
      if (participant_ids && participant_ids.length > 0) {
        for (const participantId of participant_ids) {
          if (participantId !== userId) {
            await connection.execute(
              `INSERT INTO chat_participants (chat_room_id, user_id, role)
               VALUES (?, ?, 'member')`,
              [chatRoomId, participantId]
            );
          }
        }
      }

      await connection.commit();

      // Fetch the created room with details
      const [createdRoom] = await connection.execute(`
        SELECT cr.*, COUNT(cp.user_id) as participant_count
        FROM chat_rooms cr
        LEFT JOIN chat_participants cp ON cr.id = cp.chat_room_id AND cp.left_at IS NULL
        WHERE cr.id = ?
        GROUP BY cr.id
      `, [chatRoomId]);

      res.status(201).json((createdRoom as any[])[0]);

    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Error creating chat room:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * GET /messages/rooms/:roomId/messages - Get messages for a chat room
 */
router.get('/rooms/:roomId/messages', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { roomId } = req.params;
    const { page = '1', limit = '50' } = req.query;
    const userId = req.user!.id;
    const organizationId = req.user!.organization_id;

    // Verify user has access to this room
    const [accessCheck] = await pool.execute(`
      SELECT cr.id, cr.organization_id, cp.user_id, cp.left_at
      FROM chat_rooms cr
      INNER JOIN chat_participants cp ON cr.id = cp.chat_room_id
      WHERE cr.id = ? AND cp.user_id = ? AND cp.left_at IS NULL
    `, [roomId, userId]);

    // console.log('Access check for room', roomId, 'user', userId, 'org', organizationId, 'result:', accessCheck);

    if ((accessCheck as any[]).length === 0) {
      return res.status(403).json({ message: 'Access denied to this chat room' });
    }

    // Additional check: verify organization matches
    const roomData = (accessCheck as any[])[0];
    if (roomData.organization_id !== organizationId) {
      // console.log('Organization mismatch:', roomData.organization_id, 'vs', organizationId);
      return res.status(403).json({ message: 'Access denied: organization mismatch' });
    }

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [messages] = await pool.execute(`
      SELECT 
        m.*,
        u.username, u.first_name, u.last_name, u.avatar_url,
        reply_msg.content as reply_content,
        reply_sender.username as reply_sender_username
      FROM messages m
      INNER JOIN users u ON m.sender_id = u.id
      LEFT JOIN messages reply_msg ON m.reply_to_message_id = reply_msg.id
      LEFT JOIN users reply_sender ON reply_msg.sender_id = reply_sender.id
      WHERE m.chat_room_id = ? AND m.deleted_at IS NULL
      ORDER BY m.created_at DESC
      LIMIT ? OFFSET ?
    `, [roomId, parseInt(limit as string), offset]);

    const transformedMessages = (messages as any[]).map(msg => ({
      id: msg.id,
      chat_room_id: msg.chat_room_id,
      sender_id: msg.sender_id,
      content: msg.content,
      message_type: msg.message_type,
      reply_to_message_id: msg.reply_to_message_id,
      file_url: msg.file_url,
      file_name: msg.file_name,
      file_size: msg.file_size,
      edited_at: msg.edited_at,
      created_at: msg.created_at,
      updated_at: msg.updated_at,
      sender: {
        id: msg.sender_id,
        username: msg.username,
        first_name: msg.first_name,
        last_name: msg.last_name,
        avatar_url: msg.avatar_url
      },
      reply_to_message: msg.reply_content ? {
        content: msg.reply_content,
        sender: { username: msg.reply_sender_username }
      } : null
    }));

    // Note: Read timestamps not implemented yet

    res.json(transformedMessages.reverse()); // Reverse to show oldest first
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * POST /messages/rooms/:roomId/messages - Send message to chat room
 */
router.post('/rooms/:roomId/messages', authenticate, async (req: AuthenticatedRequest<{}, {}, CreateMessageRequest>, res: Response) => {
  try {
    const { roomId } = req.params;
    const { content, message_type = 'text', reply_to_message_id, file_url, file_name, file_size } = req.body;
    const userId = req.user!.id;
    const organizationId = req.user!.organization_id;

    // Verify user has access to this room
    const [accessCheck] = await pool.execute(`
      SELECT cr.id, cr.organization_id, cp.user_id, cp.left_at
      FROM chat_rooms cr
      INNER JOIN chat_participants cp ON cr.id = cp.chat_room_id
      WHERE cr.id = ? AND cp.user_id = ? AND cp.left_at IS NULL
    `, [roomId, userId]);

    // console.log('Send message access check for room', roomId, 'user', userId, 'org', organizationId, 'result:', accessCheck);

    if ((accessCheck as any[]).length === 0) {
      return res.status(403).json({ message: 'Access denied to this chat room' });
    }

    // Additional check: verify organization matches
    const roomData = (accessCheck as any[])[0];
    if (roomData.organization_id !== organizationId) {
      // console.log('Send message organization mismatch:', roomData.organization_id, 'vs', organizationId);
      return res.status(403).json({ message: 'Access denied: organization mismatch' });
    }

    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // Insert message
      const [messageResult] = await connection.execute(
        `INSERT INTO messages (chat_room_id, sender_id, content, message_type, reply_to_message_id)
         VALUES (?, ?, ?, ?, ?)`,
        [roomId, userId, content, message_type, reply_to_message_id || null]
      );

      const messageId = (messageResult as any).insertId;

      // Update chat room's updated timestamp
      await connection.execute(
        `UPDATE chat_rooms SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [roomId]
      );

      await connection.commit();

      // Fetch the created message with sender details
      const [createdMessage] = await connection.execute(`
        SELECT 
          m.*,
          u.username, u.first_name, u.last_name, u.avatar_url
        FROM messages m
        INNER JOIN users u ON m.sender_id = u.id
        WHERE m.id = ?
      `, [messageId]);

      const message = (createdMessage as any[])[0];
      const transformedMessage = {
        id: message.id,
        chat_room_id: message.chat_room_id,
        sender_id: message.sender_id,
        content: message.content,
        message_type: message.message_type,
        reply_to_message_id: message.reply_to_message_id,
        file_url: message.file_url,
        file_name: message.file_name,
        file_size: message.file_size,
        created_at: message.created_at,
        updated_at: message.updated_at,
        sender: {
          id: message.sender_id,
          username: message.username,
          first_name: message.first_name,
          last_name: message.last_name,
          avatar_url: message.avatar_url
        }
      };

      res.status(201).json(transformedMessage);

    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * GET /messages/contacts - Get available contacts (users in same organization)
 */
router.get('/contacts', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const organizationId = req.user!.organization_id;

    const [contacts] = await pool.execute(`
      SELECT 
        u.id, u.username, u.email, u.first_name, u.last_name, u.avatar_url, 
        u.user_status, u.status_message, u.last_seen
      FROM users u
      INNER JOIN organization_members om ON u.id = om.user_id
      WHERE om.organization_id = ? AND u.id != ?
      ORDER BY u.user_status = 'online' DESC, u.first_name ASC, u.username ASC
    `, [organizationId, userId]);

    res.json(contacts);
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
