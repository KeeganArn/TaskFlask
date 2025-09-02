import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../database/config';

const router = Router();

// PUT /users/profile - Update user profile
router.put('/profile', async (req: Request, res: Response) => {
  try {
    // This would typically use middleware to verify the JWT token
    // For now, we'll use a placeholder user ID
    const userId = req.headers.authorization ? '1' : null;
    
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { username, email } = req.body;
    
    if (!username && !email) {
      return res.status(400).json({ message: 'At least one field is required' });
    }

    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    if (username) {
      updateFields.push(`username = ?`);
      updateValues.push(username);
      paramIndex++;
    }

    if (email) {
      updateFields.push(`email = ?`);
      updateValues.push(email);
      paramIndex++;
    }

    updateValues.push(userId);

    const query = `
      UPDATE users 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `;

    const [result] = await pool.execute(query, updateValues);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get the updated user
    const [updatedUser] = await pool.execute(
      'SELECT id, username, email, created_at FROM users WHERE id = ?',
      [userId]
    );

    res.json(updatedUser[0]);
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /users/password - Change user password
router.put('/password', async (req: Request, res: Response) => {
  try {
    // This would typically use middleware to verify the JWT token
    // For now, we'll use a placeholder user ID
    const userId = req.headers.authorization ? '1' : null;
    
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters long' });
    }

    // Get current user with password hash
    const [userResult] = await pool.execute(
      'SELECT password_hash FROM users WHERE id = ?',
      [userId]
    );

    if (userResult.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = userResult[0];

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValidPassword) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Hash new password
    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await pool.execute(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [newPasswordHash, userId]
    );

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
