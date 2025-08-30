// src/types/auth.types.ts
import { Request } from 'express';

export interface JwtPayload {
  sub: string;         // Cognito user ID
  email?: string;
  'cognito:groups'?: string[];
  exp: number;         // Expiration time
  iat: number;         // Issued at time
  iss: string;         // Issuer (Cognito URL)
  client_id?: string;  // App client ID
  username?: string;
  scope?: string;      // OAuth scopes
  [key: string]: any;
}

// Define custom user properties
export interface UserData {
  id: string;
  email?: string;
  groups?: string[];
  permissions?: string[];
}

export interface AuthRequest extends Request {
  auth?: JwtPayload;
  user?: UserData;
}