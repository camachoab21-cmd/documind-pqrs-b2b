import db from '../config/db.js';
import { analizarDocumentoConGemini } from '../services/gemini.service.js';

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
 * Consulta el detalle completo de un ticket con su timeline y documentos adjuntos
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

    // Actividades del timeline
    const actividades = await db.query(
      'SELECT * FROM pqrs_actividades WHERE ticket_id = ? ORDER BY created_at ASC',
      [ticketId]
    );

    // Documentos asociados e ingestados por IA
    const documentos = await db.query(
      `SELECT d.*, m.metadata_json 
       FROM documentos d 
       LEFT JOIN metadatos_extraidos m ON m.documento_id = d.id 
       WHERE d.ticket_id = ? 
       ORDER BY d.creado_en DESC`,
      [ticketId]
    );

    return res.json({
      status: 'success',
      data: {
        ticket,
        timeline: actividades,
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
