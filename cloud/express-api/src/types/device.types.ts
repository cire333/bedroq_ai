// src/types/device.types.ts
export interface Device {
  id: string;
  region: string;
  customer: string;
  firmwareVersion: string | null;
  currentConfigId: string | null;
  lastUpdatedAt: Date | null;
}

export interface DeviceInput {
  region: string;
  customer: string;
  firmwareVersion?: string;
  currentConfigId?: string;
}

export interface DeviceFilters {
  region?: string;
  customer?: string;
  firmwareVersion?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export interface DevicePaginatedResponse extends PaginatedResponse<Device> {}