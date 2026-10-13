import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { consultarRAG, listarThreads, crearThread, listarMensajes, eliminarThread } from '../controllers/chat.controller.js';

const router = Router();

router.use(authMiddleware);

// Endpoint de RAG (se modificará en el controlador para guardar mensaje)
router.post('/query', consultarRAG);

// Endpoints de Historial de Chat
router.get('/threads', listarThreads);
router.post('/threads', crearThread);
router.get('/threads/:threadId/messages', listarMensajes);
router.delete('/threads/:threadId', eliminarThread);

export default router;
