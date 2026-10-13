import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

// Cargar variables de entorno
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, 'config/.env') });

// Rutas
import authRoutes from './routes/auth.routes.js';
import documentsRoutes from './routes/documents.routes.js';
import chatRoutes from './routes/chat.routes.js';
import repositoriesRoutes from './routes/repositories.routes.js';
import logsRoutes from './routes/logs.routes.js';
import pqrsRoutes from './routes/pqrs.routes.js';

const app = express();

// ─── Middlewares globales ────────────────────────────────────────────────────
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Archivos estáticos (para previsualización de documentos)
app.use('/uploads', express.static(join(__dirname, 'uploads')));
app.use('/uploads', (req, res) => {
  res.status(404).send(`
    <div style="font-family: system-ui, -apple-system, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #f8fafc; color: #64748b; text-align: center; padding: 20px;">
      <div style="font-size: 48px; margin-bottom: 16px;">📂</div>
      <h2 style="color: #334155; margin: 0 0 8px 0;">Archivo original no disponible</h2>
      <p style="margin: 0; max-width: 400px; line-height: 1.5;">El PDF físico no se encuentra en el servidor. Es probable que haya sido cargado antes de que se habilitara el historial visual de documentos.</p>
      <p style="margin: 16px 0 0 0; font-size: 14px; background: #e2e8f0; padding: 8px 12px; border-radius: 8px; color: #475569;">💡 Tip: Vuelva a subir el documento para activar el visor.</p>
    </div>
  `);
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
