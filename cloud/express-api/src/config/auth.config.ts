// src/config/auth.config.ts
export default {
  cognito: {
    region: process.env.COGNITO_REGION || 'us-east-1',
    userPoolId: process.env.COGNITO_USER_POOL_ID || '',
    appClientId: process.env.COGNITO_APP_CLIENT_ID || '',
    // Authority is the URL of your Cognito User Pool
    authority: `https://cognito-idp.${process.env.COGNITO_REGION || 'us-east-1'}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID || ''}`,
    // JWKS URL for token verification
    jwksUri: `https://cognito-idp.${process.env.COGNITO_REGION || 'us-east-1'}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID || ''}/.well-known/jwks.json`,
  },
  // For local development/testing with custom JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'your-development-secret',
    expiresIn: '1d',
  }
};