import { Router } from 'express';
import { authMiddleware, requireRol } from '../middleware/auth.middleware.js';
import {
  listarRepositorios,
  crearRepositorio,
  eliminarRepositorio,
} from '../controllers/repositories.controller.js';

const router = Router();

router.use(authMiddleware);
router.get('/', listarRepositorios);
router.post('/', crearRepositorio);
router.delete('/:id', requireRol('ADMIN'), eliminarRepositorio);

export default router;
