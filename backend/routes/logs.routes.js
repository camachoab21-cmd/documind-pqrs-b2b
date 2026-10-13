import { Router } from 'express';
import { authMiddleware, requireRol } from '../middleware/auth.middleware.js';
import { listarLogs, getDashboardData } from '../controllers/logs.controller.js';

const router = Router();

router.use(authMiddleware, requireRol('ADMIN'));
router.get('/', listarLogs);
router.get('/dashboard', getDashboardData);

export default router;
