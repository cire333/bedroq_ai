// src/config/permissions.config.ts
export const ROLES = {
  ADMIN: 'admin',
  OPERATOR: 'operator',
  VIEWER: 'viewer',
};

export const PERMISSIONS = {
  CREATE_DEVICE: 'create:device',
  READ_DEVICE: 'read:device',
  UPDATE_DEVICE: 'update:device',
  DELETE_DEVICE: 'delete:device',
  
  CREATE_CONFIG: 'create:config',
  READ_CONFIG: 'read:config',
  UPDATE_CONFIG: 'update:config',
  DELETE_CONFIG: 'delete:config',
  
  // Add more permissions as needed
};

// Map Cognito groups to permissions
export const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: [
    // Admin has all permissions
    ...Object.values(PERMISSIONS),
  ],
  [ROLES.OPERATOR]: [
    // Operators can read everything, create and update some things
    PERMISSIONS.READ_DEVICE,
    PERMISSIONS.CREATE_DEVICE,
    PERMISSIONS.UPDATE_DEVICE,
    PERMISSIONS.READ_CONFIG,
    PERMISSIONS.CREATE_CONFIG,
    PERMISSIONS.UPDATE_CONFIG,
  ],
  [ROLES.VIEWER]: [
    // Viewers can only read
    PERMISSIONS.READ_DEVICE,
    PERMISSIONS.READ_CONFIG,
  ],
};

// Function to get permissions for a user based on their Cognito groups
export const getUserPermissions = (groups: string[]): string[] => {
  const permissions = new Set<string>();
  
  groups.forEach(group => {
    if (ROLE_PERMISSIONS[group]) {
      ROLE_PERMISSIONS[group].forEach(permission => permissions.add(permission));
    }
  });
  
  return Array.from(permissions);
};