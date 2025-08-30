// src/routes/device.routes.ts
import { Router } from 'express';
import { DeviceController } from '../controllers/device.controller';
import { DeviceService } from '../services/device.service';
import { DeviceModel } from '../models/device.model';
import pool from '../config/db.config';

const router = Router();

// Initialize dependencies
const deviceModel = new DeviceModel(pool);
const deviceService = new DeviceService(deviceModel);
const deviceController = new DeviceController(deviceService);

// GET routes
router.get('/', deviceController.getDevices);
router.get('/:id', deviceController.getDeviceById);

// POST routes
router.post('/', deviceController.createDevice);
router.post('/:id/restore', deviceController.restoreDevice);

// PUT routes
router.put('/:id', deviceController.updateDevice);

// DELETE routes
router.delete('/:id', deviceController.softDeleteDevice);

export default router;