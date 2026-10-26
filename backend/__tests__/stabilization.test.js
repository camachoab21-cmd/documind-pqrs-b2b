import request from 'supertest';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import app from '../app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('DocuMind — Pruebas de Regresión y Estabilización (Ingesta y Manejo de Errores)', () => {
  let authToken;

  beforeAll(() => {
    // Token sintético para pruebas aisladas de capa HTTP / middleware
    authToken = jwt.sign(
      { id: 1, nombre: 'Diana Rodríguez', email: 'diana.legal@documind.com', rol: 'LEGAL' },
      process.env.JWT_SECRET || 'super_secret_jwt_key_documind_pqrs_2026',
      { expiresIn: '1h' }
    );
  });

  test('REG-01: Rechazo de archivos mayores a 15 MB por Multer retorna HTTP 400 con código tipado', async () => {
    // Generar buffer que excede el límite de 15 MB (~16 MB)
    const bigBuffer = Buffer.alloc(16 * 1024 * 1024, 'a');

    const res = await request(app)
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${authToken}`)
      .field('repositorio_id', 1)
      .attach('file', bigBuffer, 'documento_excesivo.pdf');

    expect(res.statusCode).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.codigo).toBe('LIMIT_FILE_SIZE');
    expect(res.body.mensaje).toContain('15 MB');
  });

  test('REG-02: Rechazo de formato no permitido (.exe) retorna HTTP 400', async () => {
    const res = await request(app)
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${authToken}`)
      .field('repositorio_id', 1)
      .attach('file', Buffer.from('binary-mock-payload'), 'script_malicioso.exe');

    expect(res.statusCode).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.mensaje).toContain('Formato no permitido');
  });

  test('REG-03: Petición sin archivo adjunto retorna HTTP 400', async () => {
    const res = await request(app)
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${authToken}`)
      .field('repositorio_id', 1);

    expect(res.statusCode).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.mensaje).toBe('No se recibió ningún archivo.');
  });

  test('REG-04: Verificación estática del identificador de columna tamano_bytes en el controlador', () => {
    const controllerPath = path.join(__dirname, '../controllers/documents.controller.js');
    const controllerCode = fs.readFileSync(controllerPath, 'utf8');

    // Debe contener tamano_bytes en la sentencia INSERT
    expect(controllerCode).toContain('tamano_bytes');
    // NO debe contener tamaño_bytes en las sentencias SQL
    expect(controllerCode).not.toMatch(/INSERT\s+INTO\s+documentos[^;]*tamaño_bytes/i);
  });
});
