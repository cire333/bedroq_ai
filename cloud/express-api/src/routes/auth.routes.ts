// src/routes/auth.routes.ts
import { Router, Request, Response, RequestHandler } from 'express';
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
const loginHandler = (req: Request<{}, any, LoginRequest>, res: Response) => {
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
        authConfig.jwt.secret as any,
        { expiresIn: authConfig.jwt.expiresIn } as any
      );

      return res.json({ token });
    }
  }

  res.status(401).json({ error: 'Invalid credentials' });
};

router.post('/login', loginHandler as any);

const verifyHandler = (req: Request, res: Response) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(400).json({ error: 'Token is required' });
  }

  try {
    // This is a simplified validation for development
    // In production, tokens are validated against Cognito
    const decoded = jwt.verify(token, authConfig.jwt.secret as any);
    res.json({ valid: true, payload: decoded });
  } catch (error) {
    res.status(401).json({ valid: false, error: 'Invalid token' });
  }
};

router.get('/verify', verifyHandler as any);
// This endpoint validates a token and returns the decoded payload

export default router;