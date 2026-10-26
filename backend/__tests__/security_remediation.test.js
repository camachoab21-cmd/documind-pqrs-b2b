import request from 'supertest';
import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import path from 'path';
import fs from 'fs';
import app from '../app.js';
import db from '../config/db.js';
import { _resetLoginLimiter } from '../controllers/auth.controller.js';
import { _resetTrackingLimiter } from '../controllers/pqrs.controller.js';

describe('DocuMind — Pruebas de Remediación Prioritaria de Seguridad (Tarea 6)', () => {
  const JWT_SECRET = process.env.JWT_SECRET || 'uts_clavedesarrollo_secreta_documind_2026';
  let dbQuerySpy;

  const tokenAdmin = jwt.sign(
    { id: 1, nombre: 'Admin Global', email: 'admin@documind.com', rol: 'ADMIN' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const tokenAgente = jwt.sign(
    { id: 2, nombre: 'Agente Soporte', email: 'agente@documind.com', rol: 'AGENTE' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const tokenLegal = jwt.sign(
    { id: 3, nombre: 'Abogado Legal', email: 'legal@documind.com', rol: 'LEGAL' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const tokenFinanciero = jwt.sign(
    { id: 4, nombre: 'Contador Financiero', email: 'finanzas@documind.com', rol: 'FINANCIERO' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const tokenReclutador = jwt.sign(
    { id: 5, nombre: 'Reclutador RH', email: 'rh@documind.com', rol: 'RECLUTADOR' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const tokenCiudadanoNoAutorizado = jwt.sign(
    { id: 99, nombre: 'Ciudadano Externo', email: 'externo@ciudadano.com', rol: 'CIUDADANO' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  beforeEach(() => {
    _resetLoginLimiter();
    _resetTrackingLimiter();
    dbQuerySpy = jest.spyOn(db, 'query');
  });

  afterEach(() => {
    if (dbQuerySpy && dbQuerySpy.mockRestore) {
      dbQuerySpy.mockRestore();
    }
  });

  // ============================================================================
  // 1. CONTROL DE ACCESO EN LISTADO Y KPIS DE PQRS
  // ============================================================================
  describe('A. Control de Acceso en Endpoints Administrativos PQRS (/api/pqrs y /api/pqrs/kpis)', () => {
    test('SEC-PQRS-01: Petición anónima a GET /api/pqrs es rechazada con HTTP 401', async () => {
      const res = await request(app).get('/api/pqrs');
      expect(res.status).toBe(401);
      expect(res.body.ok).toBe(false);
      expect(res.body.mensaje).toMatch(/Token de autenticación requerido/i);
    });

    test('SEC-PQRS-02: Petición anónima a GET /api/pqrs/kpis es rechazada con HTTP 401', async () => {
      const res = await request(app).get('/api/pqrs/kpis');
      expect(res.status).toBe(401);
      expect(res.body.ok).toBe(false);
      expect(res.body.mensaje).toMatch(/Token de autenticación requerido/i);
    });

    test('SEC-PQRS-03: Usuario autenticado con rol no administrativo (CIUDADANO) es rechazado con HTTP 403', async () => {
      const res = await request(app)
        .get('/api/pqrs')
        .set('Authorization', `Bearer ${tokenCiudadanoNoAutorizado}`);
      expect(res.status).toBe(403);
      expect(res.body.ok).toBe(false);
      expect(res.body.mensaje).toMatch(/Acceso denegado/i);
    });

    test('SEC-PQRS-04: Usuario con rol AGENTE o ADMIN accede legítimamente a GET /api/pqrs', async () => {
      dbQuerySpy.mockResolvedValueOnce([
        { ticket_id: 'PQRS-2026-001', nombre: 'Juan Pérez', asunto: 'Reclamo' },
      ]);
      dbQuerySpy.mockResolvedValueOnce([{ total: 1 }]);

      const res = await request(app)
        .get('/api/pqrs?limit=10')
        .set('Authorization', `Bearer ${tokenAgente}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination.total).toBe(1);
    });

    test('SEC-PQRS-05: Usuario con rol SUPERVISOR o ADMIN accede legítimamente a GET /api/pqrs/kpis', async () => {
      dbQuerySpy.mockResolvedValueOnce([{ total_tickets: 50, tickets_abiertos: 10 }]);
      dbQuerySpy.mockResolvedValueOnce([{ tipo: 'Petición', cantidad: 30 }]);
      dbQuerySpy.mockResolvedValueOnce([{ departamento: 'Soporte', cantidad: 20 }]);

      const res = await request(app)
        .get('/api/pqrs/kpis')
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('resumen');
    });
  });

  // ============================================================================
  // 2. AUTORIZACIÓN DE DOCUMENTOS (IDOR, DEPARTAMENTOS Y CONSISTENCIA)
  // ============================================================================
  describe('B. Autorización Coherente de Documentos (IDOR y Departamentos)', () => {
    const docLegal = {
      id: 101,
      nombre_archivo: 'contrato_confidencial.pdf',
      url_descarga: '/uploads/101-contrato.pdf',
      tipo_formato: 'PDF',
      tamano_bytes: 50000,
      repositorio_id: 1,
      repo_departamento: 'Legal',
      repo_usuario_id: 3,
      metadata_json: JSON.stringify({ clausulas: 10 }),
    };

    test('SEC-DOC-01: Usuario FINANCIERO sobre documento Legal ajeno es rechazado con HTTP 403 en obtenerDocumento', async () => {
      dbQuerySpy.mockResolvedValueOnce([docLegal]);

      const res = await request(app)
        .get('/api/documents/101')
        .set('Authorization', `Bearer ${tokenFinanciero}`);

      expect(res.status).toBe(403);
      expect(res.body.ok).toBe(false);
      expect(res.body.mensaje).toMatch(/No tiene permisos para acceder a este documento/i);
    });

    test('SEC-DOC-02: Usuario LEGAL accede exitosamente a obtenerDocumento de su propio departamento', async () => {
      dbQuerySpy.mockResolvedValueOnce([docLegal]);

      const res = await request(app)
        .get('/api/documents/101')
        .set('Authorization', `Bearer ${tokenLegal}`);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.documento.id).toBe(101);
      expect(res.body.documento.nombre_archivo).toBe('contrato_confidencial.pdf');
    });

    test('SEC-DOC-03: Usuario ADMIN puede consultar cualquier documento sin importar el departamento', async () => {
      dbQuerySpy.mockResolvedValueOnce([docLegal]);

      const res = await request(app)
        .get('/api/documents/101')
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.documento.id).toBe(101);
    });

    test('SEC-DOC-04: Usuario RECLUTADOR sobre documento Legal ajeno es rechazado con HTTP 403 en eliminarDocumento', async () => {
      dbQuerySpy.mockResolvedValueOnce([docLegal]);

      const res = await request(app)
        .delete('/api/documents/101')
        .set('Authorization', `Bearer ${tokenReclutador}`);

      expect(res.status).toBe(403);
      expect(res.body.ok).toBe(false);
      expect(res.body.mensaje).toMatch(/No tiene permisos para eliminar este documento/i);
    });

    test('SEC-DOC-05: Usuario ADMIN puede eliminar documento con compensación y confirmación', async () => {
      dbQuerySpy.mockResolvedValueOnce([docLegal]); // SELECT d.id ...
      dbQuerySpy.mockResolvedValueOnce({ affectedRows: 1 }); // DELETE FROM documentos

      const res = await request(app)
        .delete('/api/documents/101')
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.mensaje).toMatch(/eliminado de la base de datos/i);
    }, 15000);

    test('SEC-DOC-06: Identificador no numérico en obtenerDocumento retorna HTTP 400', async () => {
      const res = await request(app)
        .get('/api/documents/abc')
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.mensaje).toMatch(/Identificador de documento inválido/i);
    });

    test('SEC-DOC-07: Documento con metadatos huérfanos (repo_departamento nulo) rechaza acceso a roles no globales', async () => {
      const docHuerfano = {
        id: 999,
        nombre_archivo: 'doc_sin_repo.pdf',
        url_descarga: '/uploads/999-doc.pdf',
        tipo_formato: 'PDF',
        tamano_bytes: 1000,
        repositorio_id: null,
        repo_departamento: null,
        repo_usuario_id: null,
      };
      dbQuerySpy.mockResolvedValueOnce([docHuerfano]);

      const res = await request(app)
        .get('/api/documents/999')
        .set('Authorization', `Bearer ${tokenCiudadanoNoAutorizado}`);

      expect(res.status).toBe(403);
      expect(res.body.ok).toBe(false);
      expect(res.body.mensaje).toMatch(/No tiene permisos para acceder a este documento/i);
    });
  });

  // ============================================================================
  // 3. AISLAMIENTO DEL CHAT RAG Y PREVENCIÓN DE FUGAS
  // ============================================================================
  describe('C. Aislamiento Departamental en RAG (/api/chat/query)', () => {
    test('SEC-RAG-01: Usuario RECLUTADOR que intenta consultar un repositorio Legal ajeno recibe HTTP 403', async () => {
      dbQuerySpy.mockResolvedValueOnce([
        { id: 1, departamento: 'Legal', usuario_id: 3 },
      ]);

      const res = await request(app)
        .post('/api/chat/query')
        .set('Authorization', `Bearer ${tokenReclutador}`)
        .send({
          query: '¿Cuáles son las cláusulas de indemnización?',
          repositorio_id: 1,
        });

      expect(res.status).toBe(403);
      expect(res.body.ok).toBe(false);
      expect(res.body.mensaje).toMatch(/No tiene permisos para consultar este repositorio/i);
    });

    test('SEC-RAG-02: Consulta sin repositorio asignado devuelve respuesta vacía controlada sin abrir búsqueda global', async () => {
      dbQuerySpy.mockResolvedValueOnce([]);

      const res = await request(app)
        .post('/api/chat/query')
        .set('Authorization', `Bearer ${tokenReclutador}`)
        .send({
          query: 'Consulta abierta sin repos',
        });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.fuentes_citadas).toEqual([]);
      expect(res.body.respuesta).toMatch(/No se encontraron repositorios asignados a su departamento/i);
    });

    test('SEC-RAG-03: Usuario LEGAL solo consulta sus repositorios autorizados y no filtra datos de FINANCIERO', async () => {
      // Repositorios de Legal autorizados: repo 10 (Legal)
      dbQuerySpy.mockResolvedValueOnce([{ id: 10 }]);

      const res = await request(app)
        .post('/api/chat/query')
        .set('Authorization', `Bearer ${tokenLegal}`)
        .send({
          query: 'Consulta sobre políticas internas',
        });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      // Las fuentes citadas NUNCA pueden ser de repositorios no autorizados
      (res.body.fuentes_citadas || []).forEach((f) => {
        expect(f.repositorio_id).not.toBe(20); // repo 20 es de Financiero
      });
    }, 15000);

    test('SEC-RAG-04: Vectores huérfanos en Pinecone cuyo documento fue eliminado de PostgreSQL son descartados de RAG', async () => {
      // 1. Repositorio autorizado: repo 1
      dbQuerySpy.mockResolvedValueOnce([{ id: 1, departamento: 'Legal', usuario_id: 3 }]);
      // 2. Validación de documentos en PostgreSQL para los matches de Pinecone:
      // El documento huérfano ya no existe en PostgreSQL
      dbQuerySpy.mockResolvedValueOnce([]); // SELECT id FROM documentos ... -> vacío

      const res = await request(app)
        .post('/api/chat/query')
        .set('Authorization', `Bearer ${tokenLegal}`)
        .send({
          query: 'Consulta sobre documento huérfano',
          repositorio_id: 1,
        });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.fuentes_citadas).toEqual([]);
    }, 15000);
  });

  // ============================================================================
  // 4. CONFIGURACIÓN DEFENSIVA DE MULTER Y VALIDACIÓN DE ARCHIVOS
  // ============================================================================
  describe('D. Filtro de Archivos Multer y Validación de Contenido Real', () => {
    test('SEC-FILE-01: Extensión no permitida (.bin) es rechazada por fileFilter antes de procesar con HTTP 400', async () => {
      const res = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .field('repositorio_id', '1')
        .attach('file', Buffer.from([0x01, 0x02, 0x03]), 'archivo.bin');

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.codigo).toBe('INVALID_FILE_TYPE');
      expect(res.body.mensaje).toMatch(/Formato no permitido/i);
    });

    test('SEC-FILE-02: Archivo con extensión .pdf pero firma ejecutable (MZ) es rechazado con HTTP 400', async () => {
      const binaryPayload = Buffer.from([0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
      const res = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .field('repositorio_id', '1')
        .attach('file', binaryPayload, 'falso.pdf');

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.mensaje).toMatch(/firmas ejecutables o secuencias de script no permitidas/i);
    });

    test('SEC-FILE-03: Archivo con extensión .txt pero con bytes nulos binarios es rechazado con HTTP 400', async () => {
      const binaryTxt = Buffer.from([0x54, 0x65, 0x78, 0x74, 0x00, 0x6F]);
      const res = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .field('repositorio_id', '1')
        .attach('file', binaryTxt, 'falso.txt');

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.mensaje).toMatch(/bytes binarios no permitidos/i);
    });

    test('SEC-FILE-04: Nombre con secuencias de path traversal es sanitizado por Multer de forma segura', async () => {
      const validPdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
      // Repositorio inexistente hace que el controlador limpie el archivo temporal y responda 404
      dbQuerySpy.mockResolvedValueOnce([]);

      const res = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .field('repositorio_id', '9999')
        .attach('file', validPdfBuffer, '../../../../etc/passwd.pdf');

      expect(res.status).toBe(404);
      expect(res.body.mensaje).toMatch(/repositorio no encontrado/i);

      // Comprobar que no se escribió ningún archivo fuera del directorio uploads
      const traversalAttemptPath = path.resolve(process.cwd(), '../../../../etc/passwd.pdf');
      expect(fs.existsSync(traversalAttemptPath)).toBe(false);
    });

    test('SEC-FILE-05: Archivo vacío (0 bytes) es rechazado con HTTP 400', async () => {
      const emptyBuffer = Buffer.alloc(0);

      const res = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .field('repositorio_id', '1')
        .attach('file', emptyBuffer, 'archivo_vacio.txt');

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.mensaje).toMatch(/vacío|no contiene datos/i);
    });
  });

  // ============================================================================
  // 5. CABECERAS HTTP, LIMITACIÓN DE LOGIN Y PROTECCIÓN JWT
  // ============================================================================
  describe('E. Hardening de Cabeceras HTTP y Rate Limiting de Autenticación', () => {
    test('SEC-HTTP-01: Cabeceras de seguridad requeridas están presentes en las respuestas', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });

    test('SEC-HTTP-02: Rate Limiter en /api/auth/login bloquea tras 5 intentos fallidos consecutivos con HTTP 429', async () => {
      dbQuerySpy.mockResolvedValue([]); // Credenciales no encontradas

      for (let i = 1; i <= 5; i++) {
        const res = await request(app)
          .post('/api/auth/login')
          .send({ email: 'victima@documind.com', password: `intento_${i}` });
        expect(res.status).toBe(401);
      }

      // 6.º intento debe ser bloqueado por Rate Limiter con HTTP 429
      const blockedRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'victima@documind.com', password: 'otro_intento' });

      expect(blockedRes.status).toBe(429);
      expect(blockedRes.body.ok).toBe(false);
      expect(blockedRes.body.mensaje).toMatch(/Demasiados intentos fallidos/i);
      expect(blockedRes.body).toHaveProperty('reintentar_en_segundos');
    });

    test('SEC-HTTP-03: Login exitoso reinicia el contador de intentos fallidos', async () => {
      // 3 intentos fallidos
      dbQuerySpy.mockResolvedValue([]);
      for (let i = 1; i <= 3; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({ email: 'usuario@documind.com', password: `clave_mala_${i}` });
      }

      // 4.º intento exitoso
      const bcrypt = (await import('bcryptjs')).default;
      const hashCorrecto = await bcrypt.hash('PasswordValida123!', 8);
      dbQuerySpy.mockResolvedValueOnce([
        { id: 10, nombre: 'Usuario Test', email: 'usuario@documind.com', password_hash: hashCorrecto, rol: 'ADMIN' },
      ]);

      const loginSuccessRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'usuario@documind.com', password: 'PasswordValida123!' });

      expect(loginSuccessRes.status).toBe(200);
      expect(loginSuccessRes.body.ok).toBe(true);

      // Siguiente intento fallido debe comenzar de nuevo en count=1 y NO bloquearse
      dbQuerySpy.mockResolvedValueOnce([]);
      const nuevoFallo = await request(app)
        .post('/api/auth/login')
        .send({ email: 'usuario@documind.com', password: 'otra_clave_mala' });
      expect(nuevoFallo.status).toBe(401); // No 429
    });

    test('SEC-JWT-01: Token con firma adulterada o clave distinta es rechazado con HTTP 401', async () => {
      const tokenFalso = jwt.sign(
        { id: 1, rol: 'ADMIN' },
        'clave_falsa_que_no_coincide_con_el_entorno'
      );

      const res = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${tokenFalso}`);

      expect(res.status).toBe(401);
      expect(res.body.ok).toBe(false);
      expect(res.body.mensaje).toMatch(/Token inválido o expirado/i);
    });
  });
});
