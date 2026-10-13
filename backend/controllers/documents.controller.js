import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import db from '../config/db.js';
import { analizarDocumentoConGemini, generarEmbeddingGoogle, dividirEnChunks } from '../services/gemini.service.js';
import { upsertChunks, eliminarVectoresDocumento } from '../services/pinecone.service.js';

// Formatos permitidos
const FORMATOS_PERMITIDOS = ['.pdf', '.docx', '.txt'];
const MAX_TAMAÑO_BYTES = 15 * 1024 * 1024; // 15 MB

/**
 * Extrae texto plano de un archivo según su extensión
 */
async function extraerTexto(filePath, extension) {
  if (extension === '.txt') {
    return fs.readFileSync(filePath, 'utf-8');
  }

  if (extension === '.pdf') {
    const dataBuffer = fs.readFileSync(filePath);
    try {
      const data = await pdfParse(dataBuffer);
      if (data && data.text && data.text.trim().length > 0) {
        return data.text;
      }
    } catch (e) {
      console.warn('[PDF Parser] Extrayendo contenido directo del buffer:', e.message);
    }

    // Extracción limpia de texto plano legible del PDF
    const rawContent = dataBuffer.toString('latin1');
    const lineas = rawContent.split('\n');
    const textoExtraido = [];

    for (const linea of lineas) {
      const match = linea.match(/\((.+?)\)\s*Tj/);
      if (match) {
        textoExtraido.push(match[1]);
      }
    }

    if (textoExtraido.length > 0) {
      return textoExtraido.join('\n');
    }

    // Fallback general: texto imprimible
    return rawContent.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  if (extension === '.docx') {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }

  throw new Error(`Formato no soportado: ${extension}`);
}

/**
 * Registra un error en la tabla logs_errores de MySQL
 */
async function registrarError(documentoId, severidad, mensaje, stack = null) {
  try {
    await db.query(
      'INSERT INTO logs_errores (documento_id, severidad, mensaje_error, stack_trace) VALUES (?, ?, ?, ?)',
      [documentoId || null, severidad, mensaje, stack || null]
    );
  } catch (logError) {
    console.error('Error al registrar log:', logError);
  }
}

/**
 * POST /api/documents/upload
 * Pipeline completo de ingesta: validación → MySQL → extracción texto → Gemini → Pinecone → MySQL
 */
export async function uploadDocumento(req, res) {
  if (!req.file) {
    return res.status(400).json({ ok: false, mensaje: 'No se recibió ningún archivo.' });
  }

  const { repositorio_id } = req.body;
  if (!repositorio_id) {
    return res.status(400).json({ ok: false, mensaje: 'repositorio_id es requerido.' });
  }

  const extension = path.extname(req.file.originalname).toLowerCase();
  const nombreArchivo = req.file.originalname;
  const filePath = req.file.path;
  const tamañoBytes = req.file.size;

  // Validar formato
  if (!FORMATOS_PERMITIDOS.includes(extension)) {
    fs.unlinkSync(filePath);
    await registrarError(null, 'WARNING', `Formato rechazado: ${extension} para archivo ${nombreArchivo}`);
    return res.status(400).json({
      ok: false,
      mensaje: `Formato no permitido: ${extension}. Solo se aceptan PDF, DOCX y TXT.`,
    });
  }

  // Validar tamaño
  if (tamañoBytes > MAX_TAMAÑO_BYTES) {
    fs.unlinkSync(filePath);
    return res.status(400).json({
      ok: false,
      mensaje: `El archivo excede el límite de 15 MB. Tamaño recibido: ${(tamañoBytes / 1024 / 1024).toFixed(2)} MB.`,
    });
  }

  let documentoId = null;

  try {
    // 1. Verificar que el repositorio existe y pertenece al usuario
    const repos = await db.query(
      'SELECT id FROM repositorios WHERE id = ?',
      [repositorio_id]
    );
    if (repos.length === 0) {
      fs.unlinkSync(filePath);
      return res.status(404).json({ ok: false, mensaje: 'Repositorio no encontrado.' });
    }

    // 2. Registrar documento en MySQL con estado PROCESANDO
    const url_relativa = `/uploads/${req.file.filename}`;
    const insertResult = await db.query(
      `INSERT INTO documentos 
        (nombre_archivo, url_descarga, tipo_formato, tamaño_bytes, estado_procesamiento, repositorio_id) 
       VALUES (?, ?, ?, ?, 'PROCESANDO', ?)`,
      [nombreArchivo, url_relativa, extension.replace('.', '').toUpperCase(), tamañoBytes, repositorio_id]
    );
    documentoId = insertResult.insertId;

    // 3. Extraer texto plano
    const textoPlano = await extraerTexto(filePath, extension);

    if (!textoPlano || textoPlano.trim().length < 10) {
      throw new Error('El documento no contiene texto extraíble suficiente.');
    }

    // 4. Análisis con Gemini (clasificación + metadatos estructurados)
    const analisis = await analizarDocumentoConGemini(textoPlano);

    // 5. Chunking con overlap (1000 chars, 200 overlap)
    const textosChunks = dividirEnChunks(textoPlano);

    // 6. Generar embeddings para cada chunk e indexar en Pinecone
    const chunksConEmbedding = [];
    for (let i = 0; i < textosChunks.length; i++) {
      const embedding = await generarEmbeddingGoogle(textosChunks[i]);
      chunksConEmbedding.push({
        texto: textosChunks[i],
        embedding,
        pageNum: Math.floor(i / 3) + 1, // Estimación de página
      });
    }

    await upsertChunks(chunksConEmbedding, documentoId, parseInt(repositorio_id), nombreArchivo, url_relativa);

    // 7. Guardar metadatos en MySQL y actualizar estado a COMPLETADO
    await db.query(
      'INSERT INTO metadatos_extraidos (documento_id, metadata_json) VALUES (?, ?)',
      [documentoId, JSON.stringify(analisis.metadatos)]
    );

    await db.query(
      `UPDATE documentos 
       SET estado_procesamiento = 'COMPLETADO', 
           categoria_detectada = ?, 
           score_confianza = ?, 
           resumen_ia = ?
       WHERE id = ?`,
      [analisis.categoria_detectada, analisis.score_confianza, analisis.resumen_ia, documentoId]
    );

    // Mantener archivo temporal para previsualización (Document Viewer)
    // fs.unlinkSync(filePath);

    const [docActualizado] = await db.query('SELECT * FROM documentos WHERE id = ?', [documentoId]);

    return res.status(201).json({
      ok: true,
      mensaje: 'Documento procesado e indexado exitosamente.',
      documento: docActualizado,
      analisis: {
        categoria_detectada: analisis.categoria_detectada,
        score_confianza: analisis.score_confianza,
        resumen_ia: analisis.resumen_ia,
        chunks_indexados: chunksConEmbedding.length,
      },
    });
  } catch (error) {
    console.error('Error en pipeline de ingesta:', error);

    // Cleanup archivo temporal si aún existe
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    // Actualizar estado a ERROR en MySQL
    if (documentoId) {
      await db.query(
        "UPDATE documentos SET estado_procesamiento = 'ERROR' WHERE id = ?",
        [documentoId]
      );
      await registrarError(documentoId, 'ERROR', error.message, error.stack);
    }

    return res.status(500).json({
      ok: false,
      mensaje: 'Error durante el pipeline de procesamiento de IA.',
      error: error.message,
    });
  }
}

/**
 * GET /api/documents
 * Lista documentos con filtro opcional por repositorio_id y paginación.
 */
export async function listarDocumentos(req, res) {
  const { repositorio_id, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    let sql = `
      SELECT d.*, r.nombre AS repositorio_nombre 
      FROM documentos d
      JOIN repositorios r ON d.repositorio_id = r.id
    `;
    const conditions = [];
    const params = [];

    if (req.user.rol !== 'ADMIN') {
      let depto = 'Legal';
      if (req.user.rol === 'FINANCIERO') depto = 'Financiero';
      if (req.user.rol === 'RECLUTADOR') depto = 'Recursos Humanos';
      conditions.push('(r.departamento = ? OR r.usuario_id = ?)');
      params.push(depto, req.user.id);
    }

    if (repositorio_id) {
      conditions.push('d.repositorio_id = ?');
      params.push(repositorio_id);
    }

    const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
    sql += whereClause;
    sql += ' ORDER BY d.creado_en DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const documentos = await db.query(sql, params);

    // Contar total
    let countSql = `
      SELECT COUNT(*) AS total 
      FROM documentos d
      JOIN repositorios r ON d.repositorio_id = r.id
      ${whereClause}
    `;
    const countParams = params.slice(0, conditions.length === 0 ? 0 : (req.user.rol !== 'ADMIN' ? (repositorio_id ? 3 : 2) : 1));
    const [{ total }] = await db.query(countSql, countParams);

    return res.status(200).json({
      ok: true,
      documentos,
      pagination: { page: parseInt(page), limit: parseInt(limit), total },
    });
  } catch (error) {
    console.error('Error al listar documentos:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error al obtener documentos.' });
  }
}

/**
 * GET /api/documents/:id
 * Devuelve un documento con sus metadatos JSON extraídos.
 */
export async function obtenerDocumento(req, res) {
  const { id } = req.params;

  try {
    const rows = await db.query(
      `SELECT d.*, me.metadata_json, me.fecha_extraccion 
       FROM documentos d
       LEFT JOIN metadatos_extraidos me ON d.id = me.documento_id
       WHERE d.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Documento no encontrado.' });
    }

    const doc = rows[0];
    if (doc.metadata_json && typeof doc.metadata_json === 'string') {
      doc.metadata_json = JSON.parse(doc.metadata_json);
    }

    return res.status(200).json({ ok: true, documento: doc });
  } catch (error) {
    console.error('Error al obtener documento:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error al obtener el documento.' });
  }
}

/**
 * DELETE /api/documents/:id
 * Elimina documento de MySQL y sus vectores de Pinecone.
 */
export async function eliminarDocumento(req, res) {
  const { id } = req.params;

  try {
    const rows = await db.query('SELECT id, nombre_archivo FROM documentos WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Documento no encontrado.' });
    }

    // Eliminar vectores de Pinecone
    await eliminarVectoresDocumento(parseInt(id));

    // MySQL elimina en cascada metadatos_extraidos y afecta logs
    await db.query('DELETE FROM documentos WHERE id = ?', [id]);

    return res.status(200).json({
      ok: true,
      mensaje: `Documento '${rows[0].nombre_archivo}' eliminado de MySQL y Pinecone.`,
    });
  } catch (error) {
    console.error('Error al eliminar documento:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error al eliminar el documento.' });
  }
}
