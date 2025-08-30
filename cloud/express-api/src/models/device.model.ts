// src/models/device.model.ts
import { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { Device, DeviceInput, DeviceFilters, DevicePaginatedResponse } from '../types/device.types';
import { generateBinaryUuid, binaryToUuid, uuidToBinary } from '../utils/uuid.utils';

export class DeviceModel {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Get all devices with pagination and filtering
   */
  async getDevices(filters: DeviceFilters): Promise<DevicePaginatedResponse> {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;
    
    // Build WHERE clause based on filters
    let whereClause = 'WHERE deleted_at IS NULL';
    const queryParams: any[] = [];
    
    if (filters.region) {
      whereClause += ' AND region = ?';
      queryParams.push(filters.region);
    }
    
    if (filters.customer) {
      whereClause += ' AND customer = ?';
      queryParams.push(filters.customer);
    }
    
    if (filters.firmwareVersion) {
      whereClause += ' AND firmware_version = ?';
      queryParams.push(uuidToBinary(filters.firmwareVersion));
    }
    
    // Count total devices matching filters
    const [countResult] = await this.pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM devices ${whereClause}`,
      queryParams
    );
    
    const total = countResult[0].total as number;
    
    // Get paginated devices
    const paginationParams = [...queryParams, limit, offset];
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT device_id, region, customer, firmware_version, current_config_id, last_updated_at 
       FROM devices 
       ${whereClause} 
       ORDER BY last_updated_at DESC, region, customer
       LIMIT ? OFFSET ?`,
      paginationParams
    );
    
    // Transform database rows to Device objects
    const devices: Device[] = rows.map(row => ({
      id: binaryToUuid(row.device_id as Buffer)!,
      region: row.region as string,
      customer: row.customer as string,
      firmwareVersion: binaryToUuid(row.firmware_version as Buffer),
      currentConfigId: binaryToUuid(row.current_config_id as Buffer),
      lastUpdatedAt: row.last_updated_at as Date | null
    }));
    
    return {
      data: devices,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get a device by ID
   */
  async getDeviceById(id: string): Promise<Device | null> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      'SELECT device_id, region, customer, firmware_version, current_config_id, last_updated_at FROM devices WHERE device_id = ? AND deleted_at IS NULL',
      [uuidToBinary(id)]
    );
    
    if (!rows.length) return null;
    
    const row = rows[0];
    return {
      id: binaryToUuid(row.device_id as Buffer)!,
      region: row.region as string,
      customer: row.customer as string,
      firmwareVersion: binaryToUuid(row.firmware_version as Buffer),
      currentConfigId: binaryToUuid(row.current_config_id as Buffer),
      lastUpdatedAt: row.last_updated_at as Date | null
    };
  }

  /**
   * Create a new device
   */
  async createDevice(device: DeviceInput): Promise<Device> {
    const deviceId = generateBinaryUuid();
    const now = new Date();
    
    const params: any[] = [
      deviceId,
      device.region,
      device.customer,
      device.firmwareVersion ? uuidToBinary(device.firmwareVersion) : null,
      device.currentConfigId ? uuidToBinary(device.currentConfigId) : null,
      now
    ];
    
    await this.pool.query<ResultSetHeader>(
      `INSERT INTO devices (
        device_id, region, customer, firmware_version, current_config_id, last_updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      params
    );
    
    return {
      id: binaryToUuid(deviceId)!,
      region: device.region,
      customer: device.customer,
      firmwareVersion: device.firmwareVersion || null,
      currentConfigId: device.currentConfigId || null,
      lastUpdatedAt: now
    };
  }

  /**
   * Update an existing device
   */
  async updateDevice(id: string, updates: Partial<DeviceInput>): Promise<Device | null> {
    // Get current device to verify it exists
    const device = await this.getDeviceById(id);
    if (!device) return null;
    
    // Build update query
    const updates_arr: string[] = [];
    const params: any[] = [];
    
    if (updates.region !== undefined) {
      updates_arr.push('region = ?');
      params.push(updates.region);
    }
    
    if (updates.customer !== undefined) {
      updates_arr.push('customer = ?');
      params.push(updates.customer);
    }
    
    if (updates.firmwareVersion !== undefined) {
      updates_arr.push('firmware_version = ?');
      params.push(updates.firmwareVersion ? uuidToBinary(updates.firmwareVersion) : null);
    }
    
    if (updates.currentConfigId !== undefined) {
      updates_arr.push('current_config_id = ?');
      params.push(updates.currentConfigId ? uuidToBinary(updates.currentConfigId) : null);
    }
    
    // Always update last_updated_at timestamp
    updates_arr.push('last_updated_at = ?');
    const now = new Date();
    params.push(now);
    
    if (updates_arr.length === 0) {
      return device; // Nothing to update
    }
    
    // Add ID to the params
    params.push(uuidToBinary(id));
    
    await this.pool.query<ResultSetHeader>(
      `UPDATE devices SET ${updates_arr.join(', ')} WHERE device_id = ? AND deleted_at IS NULL`,
      params
    );
    
    // Return updated device
    return {
      ...device,
      region: updates.region ?? device.region,
      customer: updates.customer ?? device.customer,
      firmwareVersion: updates.firmwareVersion ?? device.firmwareVersion,
      currentConfigId: updates.currentConfigId ?? device.currentConfigId,
      lastUpdatedAt: now
    };
  }

  /**
   * Soft delete a device
   */
  async softDeleteDevice(id: string, deletedBy?: string): Promise<boolean> {
    const [result] = await this.pool.query<ResultSetHeader>(
      'UPDATE devices SET deleted_at = ?, deleted_by = ? WHERE device_id = ? AND deleted_at IS NULL',
      [new Date(), deletedBy ? uuidToBinary(deletedBy) : null, uuidToBinary(id)]
    );
    
    return result.affectedRows > 0;
  }

  /**
   * Restore a soft-deleted device
   */
  async restoreDevice(id: string): Promise<boolean> {
    const [result] = await this.pool.query<ResultSetHeader>(
      'UPDATE devices SET deleted_at = NULL, deleted_by = NULL WHERE device_id = ? AND deleted_at IS NOT NULL',
      [uuidToBinary(id)]
    );
    
    return result.affectedRows > 0;
  }
}