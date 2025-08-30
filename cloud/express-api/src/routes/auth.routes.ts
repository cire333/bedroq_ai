// src/routes/auth.routes.ts
import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import authConfig from '../config/auth.config';
import { TypedRequestBody } from '../types';

interface LoginRequest {
  username: string;
  password: string;
}

const router = Router();

// This route is only for local development/testing
// In production, authentication is handled by Cognito
router.post('/login', (req: TypedRequestBody<LoginRequest>, res: Response) => {
  const { username, password } = req.body;
  
  // In development mode only - simplified validation
  if (process.env.NODE_ENV !== 'production') {
    if (username === 'admin' && password === 'password') {
      const token = jwt.sign(
        { 
          sub: 'dev-user-id', 
          email: 'admin@example.com',
          'cognito:groups': ['admin'],
        },
        authConfig.jwt.secret,
        { expiresIn: authConfig.jwt.expiresIn }
      );
      
      return res.json({ token });
    }
  }
  
  res.status(401).json({ error: 'Invalid credentials' });
});

// This endpoint validates a token and returns the decoded payload
router.get('/verify', (req: Request, res: Response) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(400).json({ error: 'Token is required' });
  }
  
  try {
    // This is a simplified validation for development
    // In production, tokens are validated against Cognito
    const decoded = jwt.verify(token, authConfig.jwt.secret);
    res.json({ valid: true, payload: decoded });
  } catch (error) {
    res.status(401).json({ valid: false, error: 'Invalid token' });
  }
});

export default router;