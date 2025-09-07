import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import pool from '../database/config';

const CLIENT_JWT_SECRET = process.env.CLIENT_JWT_SECRET || process.env.JWT_SECRET || 'your-secret-key-change-in-production';

interface ClientJWTPayload {
  clientUserId: number;
  organizationId: number;
  email: string;
}

export interface ClientAuthenticatedRequest extends Request {
  client?: {
    id: number; // client_users.id
    email: string;
    organization_id: number;
    client_id: number;
  };
}

export const authenticateClient = async (req: ClientAuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    if (!token) return res.status(401).json({ message: 'Access token required' });

    const decoded = jwt.verify(token, CLIENT_JWT_SECRET) as ClientJWTPayload;

    const [rows] = await pool.execute(
      `SELECT cu.id, cu.email, cu.organization_id, cu.client_id
       FROM client_users cu
       WHERE cu.id = ? AND cu.organization_id = ? AND cu.is_active = true`,
      [decoded.clientUserId, decoded.organizationId]
    );

    if ((rows as any[]).length === 0) return res.status(401).json({ message: 'Invalid client token' });

    const cu = (rows as any[])[0];
    req.client = {
      id: cu.id,
      email: cu.email,
      organization_id: cu.organization_id,
      client_id: cu.client_id
    };

    next();
  } catch (error) {
    console.error('Client auth error:', error);
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
};

export const signClientToken = (payload: ClientJWTPayload): string => {
  return jwt.sign(payload, CLIENT_JWT_SECRET, { expiresIn: '7d' });
};

export default {
  authenticateClient,
  signClientToken
};


