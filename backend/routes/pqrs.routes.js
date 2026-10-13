import { Router } from 'express';
import {
  listarPqrs,
  obtenerPqrsDetalle,
  actualizarEstadoPqrs,
  obtenerKpisPqrs,
} from '../controllers/pqrs.controller.js';
import { verificarToken } from '../middleware/auth.middleware.js';

const router = Router();

// Endpoints públicos o protegidos según requerimiento
router.get('/', listarPqrs);
router.get('/kpis', obtenerKpisPqrs);
router.get('/:ticketId', obtenerPqrsDetalle);
router.put('/:ticketId/estado', verificarToken, actualizarEstadoPqrs);

export default router;
