// src/utils/token-verifier.utils.ts
import jwt from 'jsonwebtoken';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import authConfig from '../config/auth.config';
import { JwtPayload } from '../types/auth.types';

// Simple cache for Cognito verifiers keyed by tokenUse+clientId
const cognitoVerifierCache: Record<string, any> = {};

function createCognitoVerifier(tokenUse: 'access' | 'id') {
  const key = `${tokenUse}:${authConfig.cognito.appClientId}`;
  if (cognitoVerifierCache[key]) return cognitoVerifierCache[key]!;

  if (!authConfig.cognito.userPoolId) {
    throw new Error('Cognito configuration missing: set COGNITO_USER_POOL_ID in environment');
  }

  const verifier = CognitoJwtVerifier.create({
    userPoolId: authConfig.cognito.userPoolId,
    tokenUse,
    clientId: authConfig.cognito.appClientId || undefined,
  });

  cognitoVerifierCache[key] = verifier as any;
  return cognitoVerifierCache[key];
}

/**
 * Universal token verifier that works with both
 * Cognito tokens in production and local tokens in development
 */
export const verifyToken = async (token: string): Promise<JwtPayload> => {
  if (process.env.NODE_ENV === 'production') {
    // In production, verify against Cognito
    // Use Cognito verifier (default tokenUse = access). If you need to verify ID tokens,
    // pass tokenUse: 'id' when creating the verifier above or ensure the token's "token_use"
    // claim matches what you expect.
    // We'll try to inspect the token to determine token_use and pick the right verifier.
    let decoded: any;
    try {
      decoded = jwt.decode(token) as any;
    } catch (e) {
      // fall through to verifier which will provide a meaningful error
    }

    const tokenUse = decoded?.token_use === 'id' ? 'id' : 'access';
    const verifier: any = createCognitoVerifier(tokenUse);
    return await verifier.verify(token) as JwtPayload;
  } else {
    // In development, verify against local secret
    try {
      return jwt.verify(token, authConfig.jwt.secret) as JwtPayload;
    } catch (error) {
      // If local verification fails, try Cognito (for testing with real tokens)
      try {
        // Try Cognito using token_use detection
        let decoded: any;
        try { decoded = jwt.decode(token) as any; } catch (e) { /* ignore */ }
        const tokenUse = decoded?.token_use === 'id' ? 'id' : 'access';
  const verifier: any = createCognitoVerifier(tokenUse);
  return await verifier.verify(token) as JwtPayload;
      } catch (cognitoError) {
        throw error; // Re-throw the original error if both methods fail
      }
    }
  }
};