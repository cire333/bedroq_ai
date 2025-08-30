// src/services/device.service.ts
import { DeviceModel } from '../models/device.model';
import { Device, DeviceInput, DeviceFilters, DevicePaginatedResponse } from '../types/device.types';

export class DeviceService {
  private deviceModel: DeviceModel;
  
  constructor(deviceModel: DeviceModel) {
    this.deviceModel = deviceModel;
  }
  
  async getDevices(filters: DeviceFilters): Promise<DevicePaginatedResponse> {
    return this.deviceModel.getDevices(filters);
  }
  
  async getDeviceById(id: string): Promise<Device | null> {
    return this.deviceModel.getDeviceById(id);
  }
  
  async createDevice(deviceData: DeviceInput): Promise<Device> {
    // Could add validation logic here
    return this.deviceModel.createDevice(deviceData);
  }
  
  async updateDevice(id: string, updates: Partial<DeviceInput>): Promise<Device | null> {
    // Could add validation logic here
    return this.deviceModel.updateDevice(id, updates);
  }
  
  async softDeleteDevice(id: string, deletedBy?: string): Promise<boolean> {
    return this.deviceModel.softDeleteDevice(id, deletedBy);
  }
  
  async restoreDevice(id: string): Promise<boolean> {
    return this.deviceModel.restoreDevice(id);
  }
}