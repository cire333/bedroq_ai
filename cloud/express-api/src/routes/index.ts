import { Router } from 'express';

const router = Router();

router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Import and use other route files
// router.use('/users', userRoutes);

export default router;