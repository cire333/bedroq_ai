// src/services/cognito.service.ts
import AWS from 'aws-sdk';
import authConfig from '../config/auth.config';

// Configure AWS SDK
AWS.config.update({
  region: authConfig.cognito.region,
});

const cognitoIdentityServiceProvider = new AWS.CognitoIdentityServiceProvider();

export interface CognitoUser {
  username: string;
  attributes: {
    sub: string;
    email: string;
    [key: string]: any;
  }[];
  groups: string[];
}

export const CognitoService = {
  // Get user details from Cognito
  getUserDetails: async (username: string): Promise<CognitoUser | null> => {
    try {
      const params = {
        UserPoolId: authConfig.cognito.userPoolId,
        Username: username,
      };
      
      const userData = await cognitoIdentityServiceProvider.adminGetUser(params).promise();
      
      // Get user's group membership
      const groupsResponse = await cognitoIdentityServiceProvider
        .adminListGroupsForUser(params)
        .promise();
      
      const groups = groupsResponse.Groups?.map(g => g.GroupName) || [];
      
      // Transform Cognito response to our format
      return {
        username: userData.Username!,
        attributes: userData.UserAttributes!.map(attr => ({
          [attr.Name]: attr.Value,
        })),
        groups,
      };
    } catch (error) {
      console.error('Error fetching user from Cognito:', error);
      return null;
    }
  },
  
  // Add additional Cognito operations as needed
};

export default CognitoService;