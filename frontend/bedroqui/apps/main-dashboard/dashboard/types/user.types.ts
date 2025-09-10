// types.ts
export interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  lastLogin: string | null;
  department?: string;
  phoneNumber?: string;
  createdAt: string;
}

export type UserRole = 'Admin' | 'Editor' | 'Viewer';
export type UserStatus = 'Active' | 'Inactive' | 'Pending';

export interface UserFormData {
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  department?: string;
  phoneNumber?: string;
}

export interface LoginHistoryEntry {
  id: number;
  timestamp: string;
  device: string;
  location: string;
  browser: string;
}

export interface SnackbarState {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'warning' | 'info';
}