// src/controllers/device.controller.ts
import { Request, Response } from 'express';
import { DeviceService } from '../services/device.service';
import { DeviceInput, DeviceFilters } from '../types/device.types';

export class DeviceController {
  private deviceService: DeviceService;
  
  constructor(deviceService: DeviceService) {
    this.deviceService = deviceService;
  }
  
  /**
   * Get all devices with filtering and pagination
   */
  getDevices = async (req: Request, res: Response): Promise<void> => {
    try {
      const filters: DeviceFilters = {
        region: req.query.region as string | undefined,
        customer: req.query.customer as string | undefined,
        firmwareVersion: req.query.firmwareVersion as string | undefined,
        page: req.query.page ? parseInt(req.query.page as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined
      };
      
      const devices = await this.deviceService.getDevices(filters);
      res.json(devices);
    } catch (error) {
      console.error('Error fetching devices:', error);
      res.status(500).json({ error: 'Failed to fetch devices' });
    }
  };
  
  /**
   * Get a device by ID
   */
  getDeviceById = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id;
      const device = await this.deviceService.getDeviceById(id);
      
      if (!device) {
        res.status(404).json({ error: 'Device not found' });
        return;
      }
      
      res.json(device);
    } catch (error) {
      console.error('Error fetching device:', error);
      res.status(500).json({ error: 'Failed to fetch device' });
    }
  };
  
  /**
   * Create a new device
   */
  createDevice = async (req: Request, res: Response): Promise<void> => {
    try {
      const deviceData: DeviceInput = {
        region: req.body.region,
        customer: req.body.customer,
        firmwareVersion: req.body.firmwareVersion,
        currentConfigId: req.body.currentConfigId
      };
      
      // Basic validation
      if (!deviceData.region || !deviceData.customer) {
        res.status(400).json({ error: 'Region and customer are required' });
        return;
      }
      
      const newDevice = await this.deviceService.createDevice(deviceData);
      res.status(201).json(newDevice);
    } catch (error) {
      console.error('Error creating device:', error);
      res.status(500).json({ error: 'Failed to create device' });
    }
  };
  
  /**
   * Update an existing device
   */
  updateDevice = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id;
      const updates: Partial<DeviceInput> = {};
      
      // Only include fields that are actually provided
      if (req.body.region !== undefined) updates.region = req.body.region;
      if (req.body.customer !== undefined) updates.customer = req.body.customer;
      if (req.body.firmwareVersion !== undefined) updates.firmwareVersion = req.body.firmwareVersion;
      if (req.body.currentConfigId !== undefined) updates.currentConfigId = req.body.currentConfigId;
      
      const updatedDevice = await this.deviceService.updateDevice(id, updates);
      
      if (!updatedDevice) {
        res.status(404).json({ error: 'Device not found' });
        return;
      }
      
      res.json(updatedDevice);
    } catch (error) {
      console.error('Error updating device:', error);
      res.status(500).json({ error: 'Failed to update device' });
    }
  };
  
  /**
   * Soft delete a device
   */
  softDeleteDevice = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id;
      const deletedBy = req.body.deletedBy; // Optional
      
      const success = await this.deviceService.softDeleteDevice(id, deletedBy);
      
      if (!success) {
        res.status(404).json({ error: 'Device not found or already deleted' });
        return;
      }
      
      res.json({ message: 'Device deleted successfully' });
    } catch (error) {
      console.error('Error deleting device:', error);
      res.status(500).json({ error: 'Failed to delete device' });
    }
  };
  
  /**
   * Restore a soft-deleted device
   */
  restoreDevice = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id;
      const success = await this.deviceService.restoreDevice(id);
      
      if (!success) {
        res.status(404).json({ error: 'Device not found or not deleted' });
        return;
      }
      
      res.json({ message: 'Device restored successfully' });
    } catch (error) {
      console.error('Error restoring device:', error);
      res.status(500).json({ error: 'Failed to restore device' });
    }
  };
}