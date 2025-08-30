// src/app.ts
import express, { Application } from 'express';
import cors from 'cors';
import routes from './routes';
import authRoutes from './routes/auth.routes';
import { authenticateCognitoJwt } from './middleware/auth.middleware';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import deviceRoutes from './routes/device.routes';

const app: Application = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Public routes
app.use('/api/auth', authRoutes);
app.use('/api/devices', deviceRoutes);

// Protected routes - require authentication
app.use('/api', authenticateCognitoJwt, routes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);



// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

export default app;