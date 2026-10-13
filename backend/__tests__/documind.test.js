import request from 'supertest';
import app from '../app.js';
import db from '../config/db.js';

describe('Pruebas de API y Pipeline de IA - DocuMind', () => {
  let authToken;

  beforeAll(async () => {
    // Autenticar al analista para obtener el token JWT de las pruebas
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'diana.legal@documind.com',
        password: 'password_seguro_uts',
      });
    authToken = res.body.token;
  });

  afterAll(async () => {
    await db.end(); // Cerrar pool de MySQL al finalizar las pruebas
  });

  // ─── CP-01: Inicio de sesión seguro ─────────────────────────────────────────
  test('CP-01: Login exitoso de usuario registrado', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'diana.legal@documind.com',
        password: 'password_seguro_uts',
      });
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.usuario).toHaveProperty('rol');
  });

  test('CP-01b: Login fallido con contraseña incorrecta', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'diana.legal@documind.com',
        password: 'clave_incorrecta',
      });
    expect(res.statusCode).toEqual(401);
    expect(res.body.ok).toBeFalsy();
  });

  test('CP-01c: Acceso a ruta protegida sin token retorna 401', async () => {
    const res = await request(app).get('/api/documents');
    expect(res.statusCode).toEqual(401);
  });

  // ─── CP-05 & CP-06: Ingesta Documental ──────────────────────────────────────
  test('CP-05: Carga exitosa de PDF válido e inicio de pipeline', async () => {
    const res = await request(app)
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${authToken}`)
      .field('repositorio_id', 1)
      .attach(
        'file',
        Buffer.from('Contenido ficticio de un contrato de servicios corporativos entre las partes...'),
        'contrato_prueba.pdf'
      );

    expect(res.statusCode).toEqual(201);
    expect(res.body.documento.estado_procesamiento).toEqual('COMPLETADO');
    expect(res.body.documento.categoria_detectada).toEqual('Contrato');
  }, 60000); // Timeout extendido para llamada a Gemini API

  test('CP-06: Rechazo de archivos ejecutables maliciosos (.exe)', async () => {
    const res = await request(app)
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${authToken}`)
      .field('repositorio_id', 1)
      .attach('file', Buffer.from('exec() malicious code'), 'test_virus.exe');

    expect(res.statusCode).toEqual(400);
    expect(res.body.ok).toBeFalsy();
  });

  test('CP-06b: Rechazo de archivos que exceden 15 MB', async () => {
    // Generar buffer de ~16 MB
    const bigBuffer = Buffer.alloc(16 * 1024 * 1024, 'x');
    const res = await request(app)
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${authToken}`)
      .field('repositorio_id', 1)
      .attach('file', bigBuffer, 'archivo_enorme.pdf');

    expect(res.statusCode).toEqual(400);
  });

  // ─── CP-15 & CP-16: Chat RAG ─────────────────────────────────────────────────
  test('CP-15: Consulta con coincidencias retorna fuentes citadas', async () => {
    const res = await request(app)
      .post('/api/chat/query')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ query: '¿Qué penalizaciones tiene el contrato?' });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('respuesta');
    expect(res.body.fuentes_citadas.length).toBeGreaterThan(0);
  }, 30000);

  test('CP-16: Consulta sin contexto retorna respuesta honesta sin alucinaciones', async () => {
    const res = await request(app)
      .post('/api/chat/query')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ query: '¿Cuál es la órbita de Júpiter y Saturno?' });

    expect(res.statusCode).toEqual(200);
    expect(res.body.respuesta).toContain('No he encontrado información relevante en los documentos cargados');
  }, 30000);

  // ─── Health Check ────────────────────────────────────────────────────────────
  test('Health check retorna 200', async () => {
    const res = await request(app).get('/api/health');
    expect(res.statusCode).toEqual(200);
    expect(res.body.ok).toBeTruthy();
  });
});
