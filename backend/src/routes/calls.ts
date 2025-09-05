import { Router, Response } from 'express';
import pool from '../database/config';
import { authenticate, AuthenticatedRequest } from '../middleware/rbac';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

/**
 * POST /calls/initiate - Start a new call
 */
router.post('/initiate', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { chat_room_id, call_type = 'video', participant_ids = [] } = req.body;
    const userId = req.user!.id;
    const organizationId = req.user!.organization_id;

    if (!chat_room_id) {
      return res.status(400).json({ message: 'chat_room_id is required' });
    }

    // Verify user has access to the chat room
    const [roomAccess] = await pool.execute(`
      SELECT cr.id 
      FROM chat_rooms cr
      INNER JOIN chat_participants cp ON cr.id = cp.chat_room_id
      WHERE cr.id = ? AND cr.organization_id = ? AND cp.user_id = ? AND cp.left_at IS NULL
    `, [chat_room_id, organizationId, userId]);

    if ((roomAccess as any[]).length === 0) {
      return res.status(403).json({ message: 'Access denied to this chat room' });
    }

    // Generate unique room ID for the call
    const roomId = `call_${uuidv4()}`;

    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // Create call session
      const [callResult] = await connection.execute(`
        INSERT INTO call_sessions (room_id, chat_room_id, organization_id, initiated_by, call_type)
        VALUES (?, ?, ?, ?, ?)
      `, [roomId, chat_room_id, organizationId, userId, call_type]);

      const callSessionId = (callResult as any).insertId;

      // Add initiator as participant
      await connection.execute(`
        INSERT INTO call_participants (call_session_id, user_id, is_video_enabled)
        VALUES (?, ?, ?)
      `, [callSessionId, userId, call_type === 'video']);

      // Add other participants if specified
      if (participant_ids.length > 0) {
        for (const participantId of participant_ids) {
          if (participantId !== userId) {
            await connection.execute(`
              INSERT INTO call_participants (call_session_id, user_id, is_video_enabled)
              VALUES (?, ?, ?)
            `, [callSessionId, participantId, call_type === 'video']);
          }
        }
      }

      // Update participants count
      await connection.execute(`
        UPDATE call_sessions 
        SET participants_count = (
          SELECT COUNT(*) FROM call_participants WHERE call_session_id = ?
        )
        WHERE id = ?
      `, [callSessionId, callSessionId]);

      await connection.commit();

      res.status(201).json({
        id: callSessionId,
        room_id: roomId,
        chat_room_id,
        call_type,
        status: 'initiated',
        participants_count: participant_ids.length + 1
      });

    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error initiating call:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * POST /calls/:roomId/join - Join an existing call
 */
router.post('/:roomId/join', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { roomId } = req.params;
    const userId = req.user!.id;
    const organizationId = req.user!.organization_id;

    // Get call session
    const [callSession] = await pool.execute(`
      SELECT cs.*, cr.organization_id as room_org_id
      FROM call_sessions cs
      LEFT JOIN chat_rooms cr ON cs.chat_room_id = cr.id
      WHERE cs.room_id = ? AND cs.organization_id = ?
    `, [roomId, organizationId]);

    if ((callSession as any[]).length === 0) {
      return res.status(404).json({ message: 'Call not found' });
    }

    const session = (callSession as any[])[0];

    if (session.status === 'ended') {
      return res.status(400).json({ message: 'Call has ended' });
    }

    // Check if user is already a participant
    const [existingParticipant] = await pool.execute(`
      SELECT id FROM call_participants 
      WHERE call_session_id = ? AND user_id = ?
    `, [session.id, userId]);

    if ((existingParticipant as any[]).length === 0) {
      // Add user as participant
      await pool.execute(`
        INSERT INTO call_participants (call_session_id, user_id, is_video_enabled)
        VALUES (?, ?, ?)
      `, [session.id, userId, session.call_type === 'video']);

      // Update participants count
      await pool.execute(`
        UPDATE call_sessions 
        SET participants_count = (
          SELECT COUNT(*) FROM call_participants WHERE call_session_id = ? AND left_at IS NULL
        ),
        status = 'ongoing'
        WHERE id = ?
      `, [session.id, session.id]);
    } else {
      // Update existing participant (rejoin)
      await pool.execute(`
        UPDATE call_participants 
        SET left_at = NULL, joined_at = CURRENT_TIMESTAMP
        WHERE call_session_id = ? AND user_id = ?
      `, [session.id, userId]);
    }

    res.json({
      id: session.id,
      room_id: roomId,
      call_type: session.call_type,
      status: 'ongoing'
    });

  } catch (error) {
    console.error('Error joining call:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * POST /calls/:roomId/leave - Leave a call
 */
router.post('/:roomId/leave', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { roomId } = req.params;
    const userId = req.user!.id;

    // Get call session
    const [callSession] = await pool.execute(`
      SELECT id FROM call_sessions WHERE room_id = ?
    `, [roomId]);

    if ((callSession as any[]).length === 0) {
      return res.status(404).json({ message: 'Call not found' });
    }

    const sessionId = (callSession as any[])[0].id;

    // Mark participant as left
    await pool.execute(`
      UPDATE call_participants 
      SET left_at = CURRENT_TIMESTAMP
      WHERE call_session_id = ? AND user_id = ?
    `, [sessionId, userId]);

    // Update participants count and check if call should end
    const [activeParticipants] = await pool.execute(`
      SELECT COUNT(*) as count FROM call_participants 
      WHERE call_session_id = ? AND left_at IS NULL
    `, [sessionId]);

    const activeCount = (activeParticipants as any[])[0].count;

    if (activeCount === 0) {
      // End the call if no active participants
      const duration = await pool.execute(`
        SELECT TIMESTAMPDIFF(SECOND, started_at, NOW()) as duration 
        FROM call_sessions WHERE id = ?
      `, [sessionId]);

      await pool.execute(`
        UPDATE call_sessions 
        SET status = 'ended', ended_at = CURRENT_TIMESTAMP, 
            duration_seconds = ?, participants_count = 0
        WHERE id = ?
      `, [(duration as any[])[0]?.duration || 0, sessionId]);
    } else {
      // Update participants count
      await pool.execute(`
        UPDATE call_sessions SET participants_count = ? WHERE id = ?
      `, [activeCount, sessionId]);
    }

    res.json({ message: 'Left call successfully' });

  } catch (error) {
    console.error('Error leaving call:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * GET /calls/:roomId/participants - Get call participants
 */
router.get('/:roomId/participants', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { roomId } = req.params;
    const organizationId = req.user!.organization_id;

    const [participants] = await pool.execute(`
      SELECT 
        cp.*,
        u.username, u.first_name, u.last_name, u.email, u.avatar_url
      FROM call_participants cp
      JOIN call_sessions cs ON cp.call_session_id = cs.id
      JOIN users u ON cp.user_id = u.id
      WHERE cs.room_id = ? AND cs.organization_id = ? AND cp.left_at IS NULL
      ORDER BY cp.joined_at ASC
    `, [roomId, organizationId]);

    res.json(participants);

  } catch (error) {
    console.error('Error fetching call participants:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * PUT /calls/:roomId/participant/settings - Update participant settings
 */
router.put('/:roomId/participant/settings', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { roomId } = req.params;
    const { is_muted, is_video_enabled, connection_quality } = req.body;
    const userId = req.user!.id;

    // Get call session
    const [callSession] = await pool.execute(`
      SELECT id FROM call_sessions WHERE room_id = ?
    `, [roomId]);

    if ((callSession as any[]).length === 0) {
      return res.status(404).json({ message: 'Call not found' });
    }

    const sessionId = (callSession as any[])[0].id;

    // Update participant settings
    const updates = [];
    const values = [];

    if (typeof is_muted === 'boolean') {
      updates.push('is_muted = ?');
      values.push(is_muted);
    }
    if (typeof is_video_enabled === 'boolean') {
      updates.push('is_video_enabled = ?');
      values.push(is_video_enabled);
    }
    if (connection_quality) {
      updates.push('connection_quality = ?');
      values.push(connection_quality);
    }

    if (updates.length > 0) {
      values.push(sessionId, userId);
      await pool.execute(`
        UPDATE call_participants 
        SET ${updates.join(', ')}
        WHERE call_session_id = ? AND user_id = ?
      `, values);
    }

    res.json({ message: 'Settings updated successfully' });

  } catch (error) {
    console.error('Error updating participant settings:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
