import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import db from '../config/db.js';
import { analizarDocumentoConGemini } from '../services/gemini.service.js';
import { validarRutaCanonicaSegura } from './documents.controller.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Lista solicitudes PQRS con filtros avanzados y paginación
 */
export async function listarPqrs(req, res) {
  try {
    const { estado, prioridad, tipo, departamento, search, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const params = [];
    const conditions = [];

    if (estado) {
      conditions.push('s.estado = ?');
      params.push(estado);
    }
    if (prioridad) {
      conditions.push('s.prioridad = ?');
      params.push(prioridad);
    }
    if (tipo) {
      conditions.push('s.tipo_solicitud = ?');
      params.push(tipo);
    }
    if (departamento) {
      conditions.push('s.departamento = ?');
      params.push(departamento);
    }
    if (search) {
      conditions.push('(s.ticket_id ILIKE ? OR s.nombre_solicitante ILIKE ? OR s.asunto ILIKE ? OR s.email_solicitante ILIKE ?)');
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const listSql = `
      SELECT 
        s.id,
        s.ticket_id,
        s.nombre_solicitante AS nombre,
        s.email_solicitante AS email,
        s.tipo_solicitud AS tipo,
        s.prioridad,
        s.departamento,
        s.asunto,
        s.estado,
        s.sla_horas,
        s.sla_fecha_limite,
        s.created_at,
        COUNT(d.id) AS total_documentos
      FROM pqrs_solicitudes s
      LEFT JOIN documentos d ON d.ticket_id = s.ticket_id
      ${whereClause}
      GROUP BY s.id, s.ticket_id, s.nombre_solicitante, s.email_solicitante, s.tipo_solicitud, s.prioridad, s.departamento, s.asunto, s.estado, s.sla_horas, s.sla_fecha_limite, s.created_at
      ORDER BY s.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const countSql = `SELECT COUNT(*) AS total FROM pqrs_solicitudes s ${whereClause}`;

    const [rows, countRows] = await Promise.all([
      db.query(listSql, [...params, parseInt(limit, 10), offset]),
      db.query(countSql, params),
    ]);

    const total = parseInt(countRows[0]?.total || 0, 10);

    return res.json({
      status: 'success',
      data: rows,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(total / parseInt(limit, 10)),
      },
    });
  } catch (error) {
    console.error('[PQRS Controller] Error al listar:', error.message);
    return res.status(500).json({ status: 'error', mensaje: 'Error al consultar tickets PQRS' });
  }
}

/**
 * Enmascara un nombre personal preservando la inicial de cada palabra para confirmación de trámite.
 * Evita la recolección y correlación no autorizada de identidad por terceros.
 * Ejemplo: "Ciudadano Ejemplo" -> "C******** E******"
 */
function enmascararNombre(nombreCompleto) {
  if (!nombreCompleto || typeof nombreCompleto !== 'string') return 'Ciudadano(a)';
  return nombreCompleto
    .trim()
    .split(/\s+/)
    .map((parte) => {
      if (parte.length <= 2) return parte[0] + '*';
      return parte[0] + '*'.repeat(Math.max(parte.length - 1, 2));
    })
    .join(' ');
}

/**
 * Consulta el detalle de un ticket con su timeline y documentos adjuntos.
 * - Usuarios autenticados con rol interno: acceso completo a expediente, notas internas y documentos.
 * - Consultas públicas no autenticadas (portal ciudadano): exclusión estricta de notas internas,
 *   documentos privados, descripción del caso y datos personales sensibles del solicitante (con nombre enmascarado).
 */
export async function obtenerPqrsDetalle(req, res) {
  try {
    const { ticketId } = req.params;

    const tickets = await db.query(
      'SELECT * FROM pqrs_solicitudes WHERE ticket_id = ? LIMIT 1',
      [ticketId]
    );

    if (tickets.length === 0) {
      return res.status(404).json({ status: 'error', mensaje: 'Ticket no encontrado' });
    }

    const ticket = tickets[0];
    const ROLES_INTERNOS = ['ADMIN', 'AGENTE', 'LEGAL', 'FINANCIERO', 'RECLUTADOR', 'SUPERVISOR'];
    const esUsuarioInterno = Boolean(req.user && ROLES_INTERNOS.includes(req.user.rol?.toUpperCase()));

    let timeline = [];
    let documentos = [];
    let ticketData;

    if (esUsuarioInterno) {
      // 1. Acceso de funcionario/agente: expediente completo con datos íntegros
      ticketData = ticket;

      timeline = await db.query(
        'SELECT * FROM pqrs_actividades WHERE ticket_id = ? ORDER BY created_at ASC',
        [ticketId]
      );

      const rawDocs = await db.query(
        `SELECT d.*, m.metadata_json 
         FROM documentos d 
         LEFT JOIN metadatos_extraidos m ON m.documento_id = d.id 
         WHERE d.ticket_id = ? 
         ORDER BY d.creado_en DESC`,
        [ticketId]
      );

      documentos = (rawDocs || []).map((d) => ({
        ...d,
        url_descarga: `/api/documents/${d.id}/archivo`,
      }));
    } else {
      // 2. Consulta pública ciudadana: excluir notas internas y filtrar proyección estrictamente
      const actividadesPublicas = await db.query(
        `SELECT id, ticket_id, autor_nombre, autor_tipo, es_nota_interna, mensaje, estado_anterior, estado_nuevo, created_at
         FROM pqrs_actividades 
         WHERE ticket_id = ? AND (es_nota_interna = false OR es_nota_interna IS NULL) 
         ORDER BY created_at ASC`,
        [ticketId]
      );

      // Doble filtro defensivo en memoria para garantizar que ninguna nota interna se propague
      timeline = (actividadesPublicas || []).filter(act => !act.es_nota_interna);

      // Proyección restringida: preserva el contrato de visualización de PortalRadicacionPublica
      // Suprime descripcion (alto riesgo de fuga), correos, teléfonos, tracking_token, payloads y errores
      // Enmascara nombre_solicitante para mitigar recolección de datos de terceros
      ticketData = {
        ticket_id: ticket.ticket_id,
        asunto: ticket.asunto,
        estado: ticket.estado,
        nombre_solicitante: enmascararNombre(ticket.nombre_solicitante || ticket.cliente_nombre),
        departamento: ticket.departamento,
        fecha_radicacion: ticket.fecha_radicacion || ticket.created_at,
      };

      documentos = [];
    }

    return res.json({
      status: 'success',
      data: {
        ticket: ticketData,
        timeline,
        documentos,
      },
    });
  } catch (error) {
    console.error('[PQRS Controller] Error al obtener detalle:', error.message);
    return res.status(500).json({ status: 'error', mensaje: 'Error al consultar detalle del ticket' });
  }
}

/**
 * Actualiza el estado de un ticket y registra la nota en el timeline
 */
export async function actualizarEstadoPqrs(req, res) {
  try {
    const { ticketId } = req.params;
    const { nuevo_estado, nota = 'Estado actualizado por agente', agente_nombre = 'Agente Soporte', es_nota_interna = false } = req.body;

    if (!nuevo_estado) {
      return res.status(400).json({ status: 'error', mensaje: 'El campo nuevo_estado es requerido' });
    }

    const fechaResolucion = ['RESUELTO', 'CERRADO'].includes(nuevo_estado) ? new Date() : null;

    await db.query(
      `UPDATE pqrs_solicitudes 
       SET estado = ?, fecha_resolucion = COALESCE(?, fecha_resolucion), updated_at = NOW() 
       WHERE ticket_id = ?`,
      [nuevo_estado, fechaResolucion, ticketId]
    );

    await db.query(
      `INSERT INTO pqrs_actividades (ticket_id, autor_nombre, autor_tipo, es_nota_interna, mensaje, estado_nuevo)
       VALUES (?, ?, 'AGENTE', ?, ?, ?)`,
      [ticketId, agente_nombre, es_nota_interna, nota, nuevo_estado]
    );

    return res.json({
      status: 'success',
      mensaje: `Ticket ${ticketId} actualizado a ${nuevo_estado}`,
      nuevo_estado,
    });
  } catch (error) {
    console.error('[PQRS Controller] Error al actualizar estado:', error.message);
    return res.status(500).json({ status: 'error', mensaje: 'Error al actualizar el estado del ticket' });
  }
}

/**
 * Métricas generales y KPIs de la Mesa de Ayuda
 */
export async function obtenerKpisPqrs(req, res) {
  try {
    const [totales] = await db.query(`
      SELECT 
        COUNT(*) AS total_tickets,
        COUNT(*) FILTER (WHERE estado IN ('NUEVO', 'ASIGNADO', 'EN_GESTION')) AS tickets_abiertos,
        COUNT(*) FILTER (WHERE estado IN ('RESUELTO', 'CERRADO')) AS tickets_resueltos,
        COUNT(*) FILTER (WHERE prioridad = 'CRITICA' AND estado NOT IN ('RESUELTO', 'CERRADO')) AS criticos_pendientes,
        COUNT(*) FILTER (WHERE sla_fecha_limite < NOW() AND estado NOT IN ('RESUELTO', 'CERRADO')) AS vencidos_sla
      FROM pqrs_solicitudes
    `);

    const porTipo = await db.query(`
      SELECT tipo_solicitud AS tipo, COUNT(*) AS cantidad 
      FROM pqrs_solicitudes 
      GROUP BY tipo_solicitud
    `);

    const porDepto = await db.query(`
      SELECT departamento, COUNT(*) AS cantidad 
      FROM pqrs_solicitudes 
      GROUP BY departamento
    `);

    return res.json({
      status: 'success',
      data: {
        resumen: totales,
        distribucion_tipo: porTipo,
        distribucion_departamento: porDepto,
      },
    });
  } catch (error) {
    console.error('[PQRS Controller] Error al obtener KPIs:', error.message);
    return res.status(500).json({ status: 'error', mensaje: 'Error al consultar métricas de soporte' });
  }
}

// ─── Limitador de intentos fallidos en memoria para seguimiento privado ──────
const failedTrackingAttempts = new Map();
const MAX_FAILED_ATTEMPTS = 5;
const BLOCK_WINDOW_MS = 15 * 60 * 1000; // 15 minutos

function getRateLimitKey(req, ticketId) {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  return `${ip}:${String(ticketId).trim().toUpperCase()}`;
}

function checkRateLimit(key) {
  const record = failedTrackingAttempts.get(key);
  if (!record) return { blocked: false };

  const now = Date.now();
  if (now - record.firstAttemptAt > BLOCK_WINDOW_MS) {
    failedTrackingAttempts.delete(key);
    return { blocked: false };
  }

  if (record.count >= MAX_FAILED_ATTEMPTS) {
    const remainingSeconds = Math.ceil((BLOCK_WINDOW_MS - (now - record.firstAttemptAt)) / 1000);
    return { blocked: true, remainingSeconds };
  }

  return { blocked: false };
}

// Limpieza de entradas expiradas para prevenir crecimiento no acotado de memoria
function limpiarIntentosExpirados() {
  const now = Date.now();
  for (const [key, record] of failedTrackingAttempts.entries()) {
    if (now - record.firstAttemptAt > BLOCK_WINDOW_MS) {
      failedTrackingAttempts.delete(key);
    }
  }
}

function recordFailedAttempt(key) {
  const now = Date.now();
  limpiarIntentosExpirados();
  const record = failedTrackingAttempts.get(key);
  if (!record || now - record.firstAttemptAt > BLOCK_WINDOW_MS) {
    failedTrackingAttempts.set(key, { count: 1, firstAttemptAt: now });
  } else {
    record.count += 1;
  }
}

function resetRateLimit(key) {
  failedTrackingAttempts.delete(key);
}

/**
 * Función utilitaria para reiniciar el limitador en pruebas automatizadas
 */
export function _resetTrackingLimiter() {
  failedTrackingAttempts.clear();
}

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Consulta privada de radicado PQRS mediante tracking_token (UUID v4).
 * - Valida conjuntamente el identificador del radicado y el tracking_token en PostgreSQL.
 * - Rechaza tokens inválidos, malformados o pertenecientes a otros radicados sin revelar si el radicado existe.
 * - Suprime estrictamente notas internas y documentos no autorizados para descarga directa.
 * - Devuelve nombre íntegro del solicitante y descripción del caso al titular con token legítimo.
 * - Excluye correo, teléfono, tracking_token y metadatos técnicos internos de la respuesta.
 * - Aplica limitación de intentos fallidos (5 intentos máximos por ventana de 15 minutos).
 */
export async function consultarPqrsPrivado(req, res) {
  try {
    const { ticketId } = req.params;
    const { tracking_token } = req.body || {};

    if (!ticketId || typeof ticketId !== 'string' || !ticketId.trim()) {
      return res.status(400).json({ status: 'error', mensaje: 'Identificador de radicado requerido' });
    }

    const cleanTicketId = ticketId.trim();
    const rateLimitKey = getRateLimitKey(req, cleanTicketId);

    // 1. Verificación de limitación de intentos fallidos
    const limitStatus = checkRateLimit(rateLimitKey);
    if (limitStatus.blocked) {
      return res.status(429).json({
        status: 'error',
        mensaje: 'Demasiados intentos fallidos para este radicado. Intente nuevamente en 15 minutos.',
        reintentar_en_segundos: limitStatus.remainingSeconds,
      });
    }

    // 2. Validación estricta del formato de tracking_token (UUID v4)
    if (!tracking_token || typeof tracking_token !== 'string' || !UUID_V4_REGEX.test(tracking_token.trim())) {
      recordFailedAttempt(rateLimitKey);
      return res.status(400).json({
        status: 'error',
        mensaje: 'Clave privada de consulta inválida o malformada. Debe ser un UUID válido.',
      });
    }

    const cleanToken = tracking_token.trim().toLowerCase();

    // 3. Consulta conjunta parametrizada en PostgreSQL
    const tickets = await db.query(
      `SELECT 
         ticket_id,
         COALESCE(nombre_solicitante, cliente_nombre) AS nombre_solicitante,
         COALESCE(tipo_solicitud, tipo) AS tipo,
         prioridad,
         departamento,
         asunto,
         descripcion,
         estado,
         sla_horas,
         sla_fecha_limite,
         fecha_radicacion,
         created_at,
         fecha_resolucion,
         satisfaccion_score
       FROM pqrs_solicitudes 
       WHERE ticket_id = ? AND tracking_token = ?::uuid 
       LIMIT 1`,
      [cleanTicketId, cleanToken]
    );

    // 4. Si la combinación ticket_id + tracking_token no existe, rechazar sin revelar si el ticket existe
    if (!tickets || tickets.length === 0) {
      recordFailedAttempt(rateLimitKey);
      return res.status(404).json({
        status: 'error',
        mensaje: 'Radicado o clave privada de consulta incorrectos',
      });
    }

    // Clave correcta: reiniciar contador de intentos fallidos para esta clave/IP
    resetRateLimit(rateLimitKey);
    const ticket = tickets[0];

    // 5. Consulta de actividades ciudadanas (exclusión estricta de notas internas)
    const actividades = await db.query(
      `SELECT id, ticket_id, autor_nombre, autor_tipo, es_nota_interna, mensaje, estado_anterior, estado_nuevo, created_at
       FROM pqrs_actividades 
       WHERE ticket_id = ? AND (es_nota_interna = false OR es_nota_interna IS NULL) 
       ORDER BY created_at ASC`,
      [cleanTicketId]
    );

    // Filtro defensivo adicional en memoria
    const timeline = (actividades || []).filter(act => !act.es_nota_interna);

    // 6. Proyección autorizada para el titular del radicado
    // - Nombre completo y descripción íntegra del caso
    // - Exclusión de correo, teléfono, token, payloads y errores de infraestructura
    const ticketData = {
      ticket_id: ticket.ticket_id,
      asunto: ticket.asunto,
      estado: ticket.estado,
      nombre_solicitante: ticket.nombre_solicitante || ticket.cliente_nombre,
      departamento: ticket.departamento,
      tipo: ticket.tipo || ticket.tipo_solicitud,
      prioridad: ticket.prioridad,
      descripcion: ticket.descripcion,
      fecha_radicacion: ticket.fecha_radicacion || ticket.created_at,
      sla_horas: ticket.sla_horas,
      sla_fecha_limite: ticket.sla_fecha_limite,
      fecha_resolucion: ticket.fecha_resolucion,
      satisfaccion_score: ticket.satisfaccion_score,
    };

    // 7. Documentos adjuntos del radicado:
    // Proyección segura con endpoint protegido por tracking_token
    // No se exponen nombres físicos de archivos en disco ni URLs directas a /uploads
    const docs = await db.query(
      `SELECT id, nombre_archivo, tipo_formato, tamano_bytes, creado_en 
       FROM documentos 
       WHERE ticket_id = ? 
       ORDER BY creado_en DESC`,
      [cleanTicketId]
    );

    const documentos = (docs || []).map((d) => ({
      id: d.id,
      nombre_archivo: d.nombre_archivo,
      tipo_formato: d.tipo_formato,
      tamano_bytes: d.tamano_bytes,
      creado_en: d.creado_en,
      url_descarga: `/api/pqrs/${encodeURIComponent(cleanTicketId)}/documentos/${d.id}`,
    }));

    return res.json({
      status: 'success',
      data: {
        ticket: ticketData,
        timeline,
        documentos,
      },
    });
  } catch (error) {
    console.error('[PQRS Controller] Error en consulta privada:', error.message);
    return res.status(500).json({ status: 'error', mensaje: 'Error al consultar radicado privado' });
  }
}

/**
 * GET /api/pqrs/:ticketId/documentos/:documentId
 * POST /api/pqrs/:ticketId/documentos/:documentId/descargar
 * Permite a un ciudadano con credencial de seguimiento válida (tracking_token)
 * descargar únicamente los documentos asociados a su propio radicado.
 * 
 * - Valida ticketId y documentId.
 * - Valida tracking_token (vía cabecera x-tracking-token, body o fallback query param).
 * - Rechaza peticiones anónimas sin token con 401.
 * - Verifica conjuntamente la existencia del radicado y coincidencia del tracking_token.
 * - Verifica que el documento pertenezca explícitamente a ese ticket_id (previene IDOR).
 * - Valida la ruta física canónica con fs.realpathSync y path.relative (no solo startsWith).
 * - Sirve el archivo con cabecera X-Content-Type-Options: nosniff.
 */
export async function descargarDocumentoCiudadano(req, res) {
  try {
    const { ticketId, documentId } = req.params;

    // 1. Validar ticketId
    if (!ticketId || typeof ticketId !== 'string' || !ticketId.trim()) {
      return res.status(400).json({ ok: false, mensaje: 'Identificador de radicado requerido.' });
    }
    const cleanTicketId = ticketId.trim();

    // 2. Validar documentId numérico
    const docId = parseInt(documentId, 10);
    if (isNaN(docId) || docId <= 0) {
      return res.status(400).json({ ok: false, mensaje: 'Identificador de documento inválido.' });
    }

    // 3. Obtener credencial de seguimiento (tracking_token)
    // Se acepta exclusivamente vía cabecera HTTP 'x-tracking-token' o cuerpo de petición POST.
    // NUNCA mediante parámetros de consulta (query string).
    const rawToken = req.headers['x-tracking-token'] || 
                     req.body?.tracking_token || 
                     req.body?.token;

    // Si no se suministra token, rechazo anónimo inmediato (401)
    if (!rawToken || typeof rawToken !== 'string' || !rawToken.trim()) {
      return res.status(401).json({
        ok: false,
        mensaje: 'Acceso no autorizado. Se requiere clave privada de consulta (tracking_token).',
      });
    }

    const cleanToken = rawToken.trim().toLowerCase();

    // Validar formato UUID v4
    if (!UUID_V4_REGEX.test(cleanToken)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'Clave privada de consulta inválida o malformada. Debe ser un UUID válido.',
      });
    }

    // 4. Rate limiting defensivo contra fuerza bruta
    const rateLimitKey = getRateLimitKey(req, cleanTicketId);
    const limitStatus = checkRateLimit(rateLimitKey);
    if (limitStatus.blocked) {
      return res.status(429).json({
        ok: false,
        mensaje: 'Demasiados intentos fallidos para este radicado. Intente nuevamente en 15 minutos.',
        reintentar_en_segundos: limitStatus.remainingSeconds,
      });
    }

    // 5. Validar existencia del radicado y coincidencia del tracking_token
    const tickets = await db.query(
      'SELECT ticket_id FROM pqrs_solicitudes WHERE ticket_id = ? AND tracking_token = ?::uuid LIMIT 1',
      [cleanTicketId, cleanToken]
    );

    if (!tickets || tickets.length === 0) {
      recordFailedAttempt(rateLimitKey);
      return res.status(404).json({
        ok: false,
        mensaje: 'Radicado o clave privada de consulta incorrectos.',
      });
    }

    resetRateLimit(rateLimitKey);

    // 6. Verificar que el documento pertenezca estrictamente a este radicado
    // Se evita confiar ciegamente en documentId sin comprobar ticket_id (previene IDOR)
    const docs = await db.query(
      'SELECT id, nombre_archivo, url_descarga, tipo_formato, ticket_id FROM documentos WHERE id = ? AND ticket_id = ? LIMIT 1',
      [docId, cleanTicketId]
    );

    if (!docs || docs.length === 0) {
      return res.status(404).json({
        ok: false,
        mensaje: 'Documento no encontrado o no pertenece a este radicado.',
      });
    }

    const doc = docs[0];

    // 7. Resolución física canónica y estricta prevención de Path Traversal
    const uploadsDir = path.resolve(__dirname, '../uploads');
    const validacion = validarRutaCanonicaSegura(uploadsDir, doc.url_descarga || doc.nombre_archivo);
    if (!validacion.valido) {
      return res.status(validacion.codigo).json({ ok: false, mensaje: validacion.mensaje });
    }

    const safeFilePath = validacion.safeFilePath;

    // 8. Servir archivo con cabeceras de seguridad
    const mimeTypes = {
      PDF: 'application/pdf',
      DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      TXT: 'text/plain',
    };
    const contentType = mimeTypes[doc.tipo_formato?.toUpperCase()] || 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.nombre_archivo)}"`);

    return res.sendFile(safeFilePath);
  } catch (error) {
    console.error('[PQRS Controller] Error al descargar documento ciudadano:', error.message);
    return res.status(500).json({ ok: false, mensaje: 'Error al servir el archivo del radicado.' });
  }
}

