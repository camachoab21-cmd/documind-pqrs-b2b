import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { authMiddleware } from '../middleware/auth.middleware.js';
import {
  uploadDocumento,
  listarDocumentos,
  obtenerDocumento,
  eliminarDocumento,
} from '../controllers/documents.controller.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuración de multer: almacenamiento temporal en /uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB límite UTS
});

const router = Router();

router.use(authMiddleware);

router.post('/upload', upload.single('file'), uploadDocumento);
router.get('/', listarDocumentos);
router.get('/:id', obtenerDocumento);
router.delete('/:id', eliminarDocumento);

export default router;
