import { Router } from 'express';
import { login, register, me } from '../controllers/auth.controller.js';
import { authMiddleware, requireRol } from '../middleware/auth.middleware.js';

const router = Router();

router.post('/login', login);
router.post('/register', authMiddleware, requireRol('ADMIN'), register);
router.get('/me', authMiddleware, me);

export default router;
