import db from '../config/db.js';

/**
 * GET /api/repositories
 * Lista todos los repositorios. Si el usuario es ADMIN ve todos; otros ven los suyos.
 */
export async function listarRepositorios(req, res) {
  try {
    let sql, params;

    if (req.user.rol === 'ADMIN') {
      sql = `
        SELECT r.*, u.nombre AS creado_por, 
               COUNT(d.id) AS total_documentos
        FROM repositorios r
        JOIN usuarios u ON r.usuario_id = u.id
        LEFT JOIN documentos d ON r.id = d.repositorio_id
        GROUP BY r.id
        ORDER BY r.creado_en DESC
      `;
      params = [];
    } else {
      let depto = 'Legal';
      if (req.user.rol === 'FINANCIERO') depto = 'Financiero';
      if (req.user.rol === 'RECLUTADOR') depto = 'Recursos Humanos';

      sql = `
        SELECT r.*, u.nombre AS creado_por,
               COUNT(d.id) AS total_documentos
        FROM repositorios r
        JOIN usuarios u ON r.usuario_id = u.id
        LEFT JOIN documentos d ON r.id = d.repositorio_id
        WHERE r.departamento = ? OR r.usuario_id = ?
        GROUP BY r.id
        ORDER BY r.creado_en DESC
      `;
      params = [depto, req.user.id];
    }

    const repositorios = await db.query(sql, params);
    return res.status(200).json({ ok: true, repositorios });
  } catch (error) {
    console.error('Error al listar repositorios:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error al obtener repositorios.' });
  }
}

/**
 * POST /api/repositories
 * Crea un nuevo repositorio (carpeta lógica) asociado al usuario autenticado.
 */
export async function crearRepositorio(req, res) {
  const { nombre, descripcion, departamento } = req.body;

  if (!nombre || !departamento) {
    return res.status(400).json({
      ok: false,
      mensaje: 'Los campos nombre y departamento son requeridos.',
    });
  }

  try {
    const result = await db.query(
      'INSERT INTO repositorios (nombre, descripcion, departamento, usuario_id) VALUES (?, ?, ?, ?)',
      [nombre, descripcion || null, departamento, req.user.id]
    );

    const [nuevoRepo] = await db.query('SELECT * FROM repositorios WHERE id = ?', [result.insertId]);

    return res.status(201).json({
      ok: true,
      mensaje: 'Repositorio creado exitosamente.',
      repositorio: nuevoRepo,
    });
  } catch (error) {
    console.error('Error al crear repositorio:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error al crear el repositorio.' });
  }
}

/**
 * DELETE /api/repositories/:id
 * Elimina un repositorio (y en cascada sus documentos en MySQL).
 * Solo ADMIN puede eliminar.
 */
export async function eliminarRepositorio(req, res) {
  const { id } = req.params;

  try {
    const rows = await db.query('SELECT * FROM repositorios WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Repositorio no encontrado.' });
    }

    await db.query('DELETE FROM repositorios WHERE id = ?', [id]);

    return res.status(200).json({
      ok: true,
      mensaje: `Repositorio '${rows[0].nombre}' eliminado. Los documentos asociados fueron eliminados en cascada.`,
    });
  } catch (error) {
    console.error('Error al eliminar repositorio:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error al eliminar el repositorio.' });
  }
}
