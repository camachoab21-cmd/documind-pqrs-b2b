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
  descargarDocumento,
} from '../controllers/documents.controller.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Formatos permitidos por política de ingesta documental
const FORMATOS_PERMITIDOS = ['.pdf', '.docx', '.txt'];

// Configuración de multer: almacenamiento temporal en /uploads con filtro estricto
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const sanitizedOriginal = path.basename(file.originalname || 'documento').replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${uniqueSuffix}-${sanitizedOriginal}`);
  },
});

const fileFilter = (req, file, cb) => {
  const extension = path.extname(file.originalname || '').toLowerCase();
  if (!FORMATOS_PERMITIDOS.includes(extension)) {
    const error = new Error(`Formato no permitido: ${extension || 'desconocido'}. Solo se aceptan PDF, DOCX y TXT.`);
    error.code = 'INVALID_FILE_TYPE';
    return cb(error, false);
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB límite UTS
});

// Middleware con manejo específico de errores de Multer (ej: límite de tamaño de archivo o formato inválido)
const handleUpload = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'INVALID_FILE_TYPE') {
        return res.status(400).json({
          ok: false,
          mensaje: err.message,
          codigo: 'INVALID_FILE_TYPE',
        });
      }
      if (err instanceof multer.MulterError || err.code === 'LIMIT_FILE_SIZE') {
        const mensaje = err.code === 'LIMIT_FILE_SIZE'
          ? 'El archivo excede el límite de 15 MB permitidos.'
          : `Error en la carga del archivo: ${err.message}`;
        return res.status(400).json({
          ok: false,
          mensaje,
          codigo: err.code,
        });
      }
      return res.status(400).json({
        ok: false,
        mensaje: err.message || 'Error al procesar el archivo subido.',
      });
    }
    next();
  });
};

const router = Router();

router.use(authMiddleware);

router.post('/upload', handleUpload, uploadDocumento);
router.get('/', listarDocumentos);
router.get('/:id', obtenerDocumento);
router.get('/:id/archivo', descargarDocumento);
router.delete('/:id', eliminarDocumento);

export default router;
