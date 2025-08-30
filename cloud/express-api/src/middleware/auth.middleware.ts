// src/middleware/auth.middleware.ts
import { Response, NextFunction, Request, RequestHandler } from 'express';
import { expressjwt, GetVerificationKey } from 'express-jwt';
import jwksRsa from 'jwks-rsa';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import authConfig from '../config/auth.config';
import { AuthRequest, JwtPayload, UserData } from '../types/auth.types';

// Create a Cognito JWT verifier
const jwtVerifier = CognitoJwtVerifier.create({
  userPoolId: authConfig.cognito.userPoolId,
  tokenUse: 'access',
  clientId: authConfig.cognito.appClientId,
});

// Middleware to verify and decode JWT using jwks-rsa
export const authenticateJwt = expressjwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: authConfig.cognito.jwksUri,
  }) as GetVerificationKey,
  algorithms: ['RS256'],
  requestProperty: 'auth',
  getToken: function fromHeaderOrQuerystring(req) {
    if (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
      return req.headers.authorization.split(' ')[1];
    } else if (req.query && req.query.token) {
      return req.query.token as string;
    }
    return undefined;
  },
});

// Alternative middleware using aws-jwt-verify
export const authenticateCognitoJwt: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized', message: 'Missing or invalid token' });
      return;
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify the JWT token against Cognito
    const payload = await jwtVerifier.verify(token);
    
    // Create user data from the token
    const userData: UserData = {
      id: payload.sub as string,
      email: typeof payload.email === 'string' ? payload.email : undefined,
      groups: Array.isArray(payload['cognito:groups']) ? payload['cognito:groups'] as string[] : [],
      permissions: [], // Map groups to permissions if needed
    };
    
    // Attach to the request
    (req as AuthRequest).user = userData;
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
  }
};

// Role-based authorization middleware
export const requireRole = (roles: string[]): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthRequest;
    
    if (!authReq.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      return;
    }
    
    const userGroups = authReq.user.groups || [];
    const hasRole = roles.some(role => userGroups.includes(role));
    
    if (!hasRole) {
      res.status(403).json({ error: 'Forbidden', message: 'Insufficient permissions' });
      return;
    }
    
    next();
  };
};