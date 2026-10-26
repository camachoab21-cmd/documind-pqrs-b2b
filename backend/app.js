import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

// Cargar variables de entorno
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });
dotenv.config({ path: join(__dirname, 'config/.env') });

// Rutas
import authRoutes from './routes/auth.routes.js';
import documentsRoutes from './routes/documents.routes.js';
import chatRoutes from './routes/chat.routes.js';
import repositoriesRoutes from './routes/repositories.routes.js';
import logsRoutes from './routes/logs.routes.js';
import pqrsRoutes from './routes/pqrs.routes.js';

const app = express();

// ─── Hardening de Servidor y Cabeceras de Seguridad ──────────────────────────
app.disable('x-powered-by');

// Configuración de trust proxy:
// - Por defecto es 'false' (entornos de desarrollo y pruebas para mitigar spoofing directo)
// - En producción detrás de un reverse proxy autorizado (Nginx), se activa mediante TRUST_PROXY (ej. '1' o IP específica)
const trustProxyEnv = process.env.TRUST_PROXY;
if (trustProxyEnv === 'true' || trustProxyEnv === '1') {
  app.set('trust proxy', 1);
} else if (trustProxyEnv && trustProxyEnv !== 'false' && trustProxyEnv !== '0') {
  const hopNum = Number(trustProxyEnv);
  app.set('trust proxy', isNaN(hopNum) ? trustProxyEnv : hopNum);
} else {
  app.set('trust proxy', false);
}

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '0');
  next();
});

// ─── Middlewares globales ────────────────────────────────────────────────────
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Protección de archivos físicos (/uploads) ────────────────────────────────
// Eliminar el servicio estático público desprotegido.
// Denegar acceso directo no autorizado a la carpeta física /uploads para mitigar fugas de archivos.
app.use('/uploads', (req, res) => {
  return res.status(401).json({
    ok: false,
    mensaje: 'Acceso directo a /uploads no autorizado. Los archivos físicos están protegidos y requieren consulta mediante endpoints seguros.',
  });
});


// Asegurar que el directorio de uploads existe
const uploadsDir = join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// ─── Rutas de la API ─────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/repositories', repositoriesRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/pqrs', pqrsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    ok: true,
    service: 'DocuMind API v1.0',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
  });
});

// ─── Manejo global de errores ─────────────────────────────────────────────────
app.use((err, req, res, next) => {
  if (err.name === 'MulterError' || err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      ok: false,
      mensaje: err.code === 'LIMIT_FILE_SIZE'
        ? 'El archivo excede el límite máximo permitido de 15 MB.'
        : `Error en la carga del archivo: ${err.message}`,
      codigo: err.code || 'MULTER_ERROR',
    });
  }

  console.error('Error no controlado:', err);
  res.status(err.status || 500).json({
    ok: false,
    mensaje: err.message || 'Error interno del servidor.',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ ok: false, mensaje: `Ruta no encontrada: ${req.method} ${req.path}` });
});

export default app;
