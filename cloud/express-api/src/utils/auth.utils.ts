// src/utils/auth.utils.ts
import jwt from 'jsonwebtoken';
import authConfig from '../config/auth.config';

/**
 * Generate a test JWT token for development only
 * This should NEVER be used in production - Cognito handles token generation
 */
export const generateTestToken = (
  userId: string,
  email: string,
  groups: string[] = []
): string => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Test tokens should not be generated in production');
  }
  
  return jwt.sign(
    {
      sub: userId,
      email,
      'cognito:groups': groups,
      iss: authConfig.cognito.authority,
      client_id: authConfig.cognito.appClientId,
      username: email,
    },
    authConfig.jwt.secret as any,
    { expiresIn: authConfig.jwt.expiresIn } as any
  );
};