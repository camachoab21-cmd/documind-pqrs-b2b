import db from '../config/db.js';

/**
 * GET /api/logs
 * Devuelve el registro de auditoría de errores del sistema (solo ADMIN).
 * Soporta filtros por severidad y paginación.
 */
export async function listarLogs(req, res) {
  const { severidad, page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    let sql = `
      SELECT l.*, d.nombre_archivo 
      FROM logs_errores l
      LEFT JOIN documentos d ON l.documento_id = d.id
    `;
    const params = [];

    const severidadesValidas = ['INFO', 'WARNING', 'ERROR', 'CRITICAL'];
    if (severidad && severidadesValidas.includes(severidad.toUpperCase())) {
      sql += ' WHERE l.severidad = ?';
      params.push(severidad.toUpperCase());
    }

    sql += ' ORDER BY l.creado_en DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const logs = await db.query(sql, params);

    // Estadísticas del dashboard
    const stats = await db.query(`
      SELECT 
        severidad,
        COUNT(*) AS cantidad
      FROM logs_errores
      GROUP BY severidad
    `);

    // KPIs de documentos para el dashboard
    const kpis = await db.query(`
      SELECT
        COUNT(*) AS total_archivos,
        SUM(CASE WHEN estado_procesamiento = 'COMPLETADO' THEN 1 ELSE 0 END) AS procesados_exito,
        SUM(CASE WHEN estado_procesamiento = 'ERROR' THEN 1 ELSE 0 END) AS fallos,
        SUM(CASE WHEN categoria_detectada IN ('Contrato', 'Hoja de Vida') THEN 1 ELSE 0 END) AS contratos_cvs
      FROM documentos
    `);

    // Distribución por categoría IA
    const categorias = await db.query(`
      SELECT categoria_detectada, COUNT(*) AS cantidad
      FROM documentos
      WHERE categoria_detectada IS NOT NULL
      GROUP BY categoria_detectada
      ORDER BY cantidad DESC
    `);

    return res.status(200).json({
      ok: true,
      logs,
      estadisticas_logs: stats,
      kpis: kpis[0],
      categorias_ia: categorias,
      pagination: { page: parseInt(page), limit: parseInt(limit) },
    });
  } catch (error) {
    console.error('Error al listar logs:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error al obtener logs de auditoría.' });
  }
}

/**
 * GET /api/logs/dashboard
 * Retorna métricas agregadas para el Dashboard de TI.
 */
export async function getDashboardData(req, res) {
  try {
    const kpis = await db.query(`
      SELECT
        COUNT(*) AS total_archivos,
        SUM(CASE WHEN estado_procesamiento = 'COMPLETADO' THEN 1 ELSE 0 END) AS procesados_exito,
        SUM(CASE WHEN estado_procesamiento = 'ERROR' THEN 1 ELSE 0 END) AS fallos,
        SUM(CASE WHEN categoria_detectada IN ('Contrato', 'Hoja de Vida') THEN 1 ELSE 0 END) AS contratos_cvs
      FROM documentos
    `);

    const categorias = await db.query(`
      SELECT categoria_detectada, COUNT(*) AS cantidad
      FROM documentos
      WHERE categoria_detectada IS NOT NULL
      GROUP BY categoria_detectada
      ORDER BY cantidad DESC
    `);

    const logsRecientes = await db.query(`
      SELECT l.id, l.severidad, l.mensaje_error, l.creado_en, d.nombre_archivo
      FROM logs_errores l
      LEFT JOIN documentos d ON l.documento_id = d.id
      ORDER BY l.creado_en DESC
      LIMIT 20
    `);

    return res.status(200).json({
      ok: true,
      kpis: kpis[0],
      categorias_ia: categorias,
      logs_recientes: logsRecientes,
    });
  } catch (error) {
    console.error('Error en dashboard data:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error al obtener datos del dashboard.' });
  }
}
