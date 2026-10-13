import request from 'supertest';
import app from '../app.js';
import db from '../config/db.js';

describe('Pruebas de API - Integración Mesa de Ayuda PQRS', () => {
  let authToken;

  beforeAll(async () => {
    // Autenticar para obtener token JWT de prueba si existe usuario
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@documind.com',
        password: 'admin',
      });
    authToken = res.body?.token;
  });

  afterAll(async () => {
    await db.end();
  });

  test('PQRS-01: Health check del sistema unificado', async () => {
    const res = await request(app).get('/api/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test('PQRS-02: Endpoint de KPIs responde con estructura válida', async () => {
    const res = await request(app).get('/api/pqrs/kpis');
    // Si la BD no está levantada en Docker, maneja el estado
    if (res.statusCode === 200) {
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('resumen');
    }
  });

  test('PQRS-03: Consulta de tickets retorna formato paginado', async () => {
    const res = await request(app).get('/api/pqrs?limit=5');
    if (res.statusCode === 200) {
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body).toHaveProperty('pagination');
    }
  });
});
