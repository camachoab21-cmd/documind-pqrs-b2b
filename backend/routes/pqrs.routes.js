import { Router } from 'express';
import {
  listarPqrs,
  obtenerPqrsDetalle,
  actualizarEstadoPqrs,
  obtenerKpisPqrs,
  consultarPqrsPrivado,
  descargarDocumentoCiudadano,
} from '../controllers/pqrs.controller.js';
import { verificarToken, verificarTokenOpcional, requireRol } from '../middleware/auth.middleware.js';

const router = Router();

// Roles internos autorizados para la gestión y métricas de soporte
const ROLES_INTERNOS_PQRS = ['ADMIN', 'AGENTE', 'SUPERVISOR', 'LEGAL', 'FINANCIERO', 'RECLUTADOR'];

// Endpoints administrativos protegidos (requieren autenticación de funcionario)
router.get('/', verificarToken, requireRol(...ROLES_INTERNOS_PQRS), listarPqrs);
router.get('/kpis', verificarToken, requireRol(...ROLES_INTERNOS_PQRS), obtenerKpisPqrs);

// Endpoints ciudadanos de radicación, seguimiento y descarga protegida
router.get('/:ticketId', verificarTokenOpcional, obtenerPqrsDetalle);
router.post('/:ticketId/tracking', consultarPqrsPrivado);
router.get('/:ticketId/documentos/:documentId', descargarDocumentoCiudadano);
router.post('/:ticketId/documentos/:documentId/descargar', descargarDocumentoCiudadano);
router.put('/:ticketId/estado', verificarToken, actualizarEstadoPqrs);

export default router;

