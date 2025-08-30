// src/utils/token-verifier.utils.ts
import jwt from 'jsonwebtoken';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import authConfig from '../config/auth.config';
import { JwtPayload } from '../types/auth.types';

// Create a Cognito JWT verifier
const cognitoVerifier = CognitoJwtVerifier.create({
  userPoolId: authConfig.cognito.userPoolId,
  tokenUse: 'access', // or 'id'
  clientId: authConfig.cognito.appClientId,
});

/**
 * Universal token verifier that works with both
 * Cognito tokens in production and local tokens in development
 */
export const verifyToken = async (token: string): Promise<JwtPayload> => {
  if (process.env.NODE_ENV === 'production') {
    // In production, verify against Cognito
    return await cognitoVerifier.verify(token) as JwtPayload;
  } else {
    // In development, verify against local secret
    try {
      return jwt.verify(token, authConfig.jwt.secret) as JwtPayload;
    } catch (error) {
      // If local verification fails, try Cognito (for testing with real tokens)
      try {
        return await cognitoVerifier.verify(token) as JwtPayload;
      } catch (cognitoError) {
        throw error; // Re-throw the original error if both methods fail
      }
    }
  }
};