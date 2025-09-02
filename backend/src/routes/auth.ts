import { Router, Request, Response } from 'express';

const router = Router();

// POST /auth/login - Mock login endpoint
router.post('/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  // Mock authentication - always return success
  res.json({
    message: 'Login successful',
    user: {
      id: '1',
      email,
      username: email.split('@')[0]
    },
    token: 'mock-jwt-token-' + Date.now()
  });
});

// POST /auth/register - Mock register endpoint
router.post('/register', (req: Request, res: Response) => {
  const { username, email, password } = req.body;
  
  if (!username || !email || !password) {
    return res.status(400).json({ message: 'Username, email and password are required' });
  }

  // Mock registration - always return success
  res.status(201).json({
    message: 'Registration successful',
    user: {
      id: Date.now().toString(),
      username,
      email
    },
    token: 'mock-jwt-token-' + Date.now()
  });
});

export default router;
