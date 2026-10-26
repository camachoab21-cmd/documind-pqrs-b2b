import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import db from '../config/db.js';
import { analizarDocumentoConGemini, generarEmbeddingGoogle, dividirEnChunks } from '../services/gemini.service.js';
import { upsertChunks, eliminarVectoresDocumento } from '../services/pinecone.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


// Formatos permitidos
const FORMATOS_PERMITIDOS = ['.pdf', '.docx', '.txt'];
const MAX_TAMAÑO_BYTES = 15 * 1024 * 1024; // 15 MB

/**
 * Valida coherente y centralizadamente si un usuario tiene permisos de lectura,
 * descarga o eliminación sobre un documento según rol, departamento y repositorio.
 */
export function verificarPermisoDocumento(usuario, doc) {
  if (!usuario || !doc) return false;
  const rol = (usuario.rol || '').toUpperCase();
  const ROLES_GLOBALES = ['ADMIN', 'AGENTE', 'SUPERVISOR'];
  if (ROLES_GLOBALES.includes(rol)) return true;

  let deptoPermitido = null;
  if (rol === 'LEGAL') deptoPermitido = 'Legal';
  else if (rol === 'FINANCIERO') deptoPermitido = 'Financiero';
  else if (rol === 'RECLUTADOR') deptoPermitido = 'Recursos Humanos';

  const deptoDoc = (doc.repo_departamento || '').toLowerCase();
  const deptoValido = Boolean(deptoPermitido && deptoDoc && deptoDoc === deptoPermitido.toLowerCase());
  const esDuenio = Boolean(doc.repo_usuario_id && usuario.id && Number(doc.repo_usuario_id) === Number(usuario.id));

  return deptoValido || esDuenio;
}

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
 * Registra un error en la tabla logs_errores de PostgreSQL
 */
async function registrarError(documentoId, severidad, mensaje, stack = null) {
  try {
    const errorMsg = stack ? `${mensaje} | ${stack.slice(0, 500)}` : mensaje;
    await db.query(
      'INSERT INTO logs_errores (documento_id, severidad, mensaje_error) VALUES (?, ?, ?)',
      [documentoId || null, severidad, errorMsg]
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
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await registrarError(null, 'WARNING', `Formato rechazado: ${extension} para archivo ${nombreArchivo}`);
    return res.status(400).json({
      ok: false,
      mensaje: `Formato no permitido: ${extension}. Solo se aceptan PDF, DOCX y TXT.`,
    });
  }

  // Validar tamaño (ni vacío ni superior al límite permitido)
  if (!tamañoBytes || tamañoBytes === 0) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return res.status(400).json({
      ok: false,
      mensaje: 'El archivo está vacío o no contiene datos válidos.',
    });
  }

  if (tamañoBytes > MAX_TAMAÑO_BYTES) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return res.status(400).json({
      ok: false,
      mensaje: `El archivo excede el límite de 15 MB. Tamaño recibido: ${(tamañoBytes / 1024 / 1024).toFixed(2)} MB.`,
    });
  }

  // Validar contenido real (inspección de firmas binarias y ejecutables maliciosos)
  try {
    const headerBuffer = Buffer.alloc(8);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, headerBuffer, 0, 8, 0);
    fs.closeSync(fd);

    // Detección estricta de binarios ejecutables o scripts disfrazados (MZ, ELF, scripts, php)
    const isWindowsExe = headerBuffer[0] === 0x4d && headerBuffer[1] === 0x5a; // 'MZ'
    const isElfExe = headerBuffer[0] === 0x7f && headerBuffer.toString('ascii', 1, 4) === 'ELF';
    const isShellScript = headerBuffer[0] === 0x23 && headerBuffer[1] === 0x21; // '#!'
    const isPhpOrScript = headerBuffer.toString('ascii', 0, 5).toLowerCase().includes('<?php') ||
                          headerBuffer.toString('ascii', 0, 7).toLowerCase().includes('<script');

    if (isWindowsExe || isElfExe || isShellScript || isPhpOrScript) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return res.status(400).json({
        ok: false,
        mensaje: 'El archivo contiene firmas ejecutables o secuencias de script no permitidas.',
      });
    }

    if (extension === '.txt') {
      if (headerBuffer.includes(0x00)) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        return res.status(400).json({
          ok: false,
          mensaje: 'El archivo TXT contiene bytes binarios no permitidos.',
        });
      }
    }
  } catch (inspectErr) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return res.status(400).json({ ok: false, mensaje: 'Error al inspeccionar el contenido del archivo.' });
  }

  let documentoId = null;

  try {
    // 1. Verificar que el repositorio existe y el usuario tiene permisos departamentales sobre él
    const repos = await db.query(
      'SELECT id, departamento, usuario_id FROM repositorios WHERE id = ?',
      [repositorio_id]
    );
    if (repos.length === 0) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return res.status(404).json({ ok: false, mensaje: 'Repositorio no encontrado.' });
    }

    const repo = repos[0];
    const rolUsuario = req.user?.rol?.toUpperCase();
    const ROLES_GLOBALES = ['ADMIN', 'AGENTE', 'SUPERVISOR'];
    if (!ROLES_GLOBALES.includes(rolUsuario)) {
      let deptoPermitido = 'Legal';
      if (rolUsuario === 'FINANCIERO') deptoPermitido = 'Financiero';
      if (rolUsuario === 'RECLUTADOR') deptoPermitido = 'Recursos Humanos';

      const tienePermisoRepo = (repo.departamento === deptoPermitido) || (repo.usuario_id === req.user?.id);
      if (!tienePermisoRepo) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        return res.status(403).json({
          ok: false,
          mensaje: 'No tiene permisos para subir documentos a este repositorio.',
        });
      }
    }

    // 2. Registrar documento en PostgreSQL con estado PROCESANDO
    const url_relativa = `/uploads/${req.file.filename}`;
    const insertResult = await db.query(
      `INSERT INTO documentos 
        (nombre_archivo, url_descarga, tipo_formato, tamano_bytes, estado_procesamiento, repositorio_id) 
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

    try {
      await upsertChunks(chunksConEmbedding, documentoId, parseInt(repositorio_id), nombreArchivo, url_relativa);
    } catch (pineconeErr) {
      console.warn('[Ingesta] Pinecone upsert advierte:', pineconeErr.message);
      await registrarError(documentoId, 'WARNING', `Pinecone indexación parcial: ${pineconeErr.message}`);
    }

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

    const rolUsuario = (req.user?.rol || '').toUpperCase();
    const ROLES_GLOBALES = ['ADMIN', 'AGENTE', 'SUPERVISOR'];
    if (!ROLES_GLOBALES.includes(rolUsuario)) {
      let depto = null;
      if (rolUsuario === 'LEGAL') depto = 'Legal';
      else if (rolUsuario === 'FINANCIERO') depto = 'Financiero';
      else if (rolUsuario === 'RECLUTADOR') depto = 'Recursos Humanos';

      if (depto) {
        conditions.push('(r.departamento = ? OR r.usuario_id = ?)');
        params.push(depto, req.user.id);
      } else {
        conditions.push('r.usuario_id = ?');
        params.push(req.user.id);
      }
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

    const safeDocumentos = documentos.map((d) => ({
      ...d,
      url_descarga: `/api/documents/${d.id}/archivo`,
    }));

    return res.status(200).json({
      ok: true,
      documentos: safeDocumentos,
      pagination: { page: parseInt(page), limit: parseInt(limit), total },
    });
  } catch (error) {
    console.error('Error al listar documentos:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error al obtener documentos.' });
  }
}

/**
 * GET /api/documents/:id
 * Devuelve un documento con sus metadatos JSON extraídos verificando rol y departamento.
 */
export async function obtenerDocumento(req, res) {
  const { id } = req.params;
  const docId = parseInt(id, 10);
  if (isNaN(docId) || docId <= 0) {
    return res.status(400).json({ ok: false, mensaje: 'Identificador de documento inválido.' });
  }

  try {
    const rows = await db.query(
      `SELECT d.*, r.departamento AS repo_departamento, r.usuario_id AS repo_usuario_id,
              me.metadata_json, me.fecha_extraccion 
       FROM documentos d
       LEFT JOIN repositorios r ON d.repositorio_id = r.id
       LEFT JOIN metadatos_extraidos me ON d.id = me.documento_id
       WHERE d.id = ?`,
      [docId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Documento no encontrado.' });
    }

    const doc = rows[0];

    // Control de acceso por rol, departamento y pertenencia de repositorio
    if (!verificarPermisoDocumento(req.user, doc)) {
      return res.status(403).json({
        ok: false,
        mensaje: 'No tiene permisos para acceder a este documento.',
      });
    }

    const docResponse = {
      ...doc,
      url_descarga: `/api/documents/${doc.id}/archivo`,
    };

    if (docResponse.metadata_json && typeof docResponse.metadata_json === 'string') {
      try {
        docResponse.metadata_json = JSON.parse(docResponse.metadata_json);
      } catch {
        // mantener como string si falla el parseo JSON
      }
    }

    return res.status(200).json({ ok: true, documento: docResponse });
  } catch (error) {
    console.error('Error al obtener documento:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error al obtener el documento.' });
  }
}

/**
 * DELETE /api/documents/:id
 * Elimina documento de la base de datos, sus vectores de Pinecone y el archivo físico en disco,
 * aplicando control de acceso coherente y registro de compensación.
 */
export async function eliminarDocumento(req, res) {
  const { id } = req.params;
  const docId = parseInt(id, 10);
  if (isNaN(docId) || docId <= 0) {
    return res.status(400).json({ ok: false, mensaje: 'Identificador de documento inválido.' });
  }

  try {
    const rows = await db.query(
      `SELECT d.id, d.nombre_archivo, d.url_descarga, r.departamento AS repo_departamento, r.usuario_id AS repo_usuario_id
       FROM documentos d
       LEFT JOIN repositorios r ON d.repositorio_id = r.id
       WHERE d.id = ?`,
      [docId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Documento no encontrado.' });
    }

    const doc = rows[0];

    // Control de acceso por rol y departamento
    if (!verificarPermisoDocumento(req.user, doc)) {
      return res.status(403).json({
        ok: false,
        mensaje: 'No tiene permisos para eliminar este documento.',
      });
    }

    // 1. Eliminar vectores de Pinecone con compensación y log defensivo
    try {
      await eliminarVectoresDocumento(docId);
    } catch (pineErr) {
      console.warn(`[Pinecone Compensación] Error al desindexar doc ${docId}:`, pineErr.message);
      await registrarError(docId, 'WARNING', `Pinecone desindexación parcial o fallida: ${pineErr.message}`);
    }

    // 2. Eliminar registro en base de datos (PostgreSQL/MySQL en cascada elimina metadatos)
    await db.query('DELETE FROM documentos WHERE id = ?', [docId]);

    // 3. Eliminar archivo físico de disco de forma segura
    if (doc.url_descarga || doc.nombre_archivo) {
      const uploadsDir = path.resolve(__dirname, '../uploads');
      const validacion = validarRutaCanonicaSegura(uploadsDir, doc.url_descarga || doc.nombre_archivo);
      if (validacion.valido && fs.existsSync(validacion.safeFilePath)) {
        try {
          fs.unlinkSync(validacion.safeFilePath);
        } catch (unlinkErr) {
          console.warn(`[Document Cleanup] No se pudo eliminar archivo físico ${validacion.safeFilePath}:`, unlinkErr.message);
        }
      }
    }

    return res.status(200).json({
      ok: true,
      mensaje: `Documento '${doc.nombre_archivo}' eliminado de la base de datos, índice vectorial y disco.`,
    });
  } catch (error) {
    console.error('Error al eliminar documento:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error al eliminar el documento.' });
  }
}

/**
 * Valida y resuelve la ruta física canónica de un archivo dentro de uploadsDir.
 * - Desreferencia enlaces simbólicos con fs.realpathSync
 * - No depende de comparación simple de prefijos de cadenas
 * - Verifica con path.relative que el recurso pertenezca estrictamente al directorio canónico
 * - Comprueba que no sea un directorio u objeto especial
 * - Rechaza secuencias de path traversal (.., %2e%2e), bytes nulos y flujos alternativos NTFS
 */
export function validarRutaCanonicaSegura(uploadsDir, rawTarget) {
  if (!rawTarget || typeof rawTarget !== 'string') {
    return { valido: false, codigo: 400, mensaje: 'Ruta de archivo no permitida.' };
  }

  // 1. Rechazo explícito de secuencias de traversal, bytes nulos y flujos alternativos NTFS
  if (
    rawTarget.includes('..') ||
    rawTarget.includes('%2e%2e') ||
    rawTarget.includes('%2E%2E') ||
    rawTarget.includes('\0') ||
    rawTarget.includes(':')
  ) {
    return { valido: false, codigo: 400, mensaje: 'Ruta de archivo no permitida.' };
  }

  // 2. Extraer el nombre de archivo base
  const rawFilename = path.basename(rawTarget);
  if (!rawFilename || rawFilename === '.' || rawFilename.includes('..') || rawFilename.includes('/') || rawFilename.includes('\\')) {
    return { valido: false, codigo: 400, mensaje: 'Ruta de archivo no permitida.' };
  }

  // 3. Resolver candidato absoluto dentro de uploadsDir
  const uploadsResolved = path.resolve(uploadsDir);
  const candidatePath = path.resolve(uploadsResolved, rawFilename);

  // 4. Verificar existencia física
  if (!fs.existsSync(candidatePath)) {
    return { valido: false, codigo: 404, mensaje: 'Archivo físico no disponible en el servidor.' };
  }

  // 5. Resolver rutas canónicas desreferenciando enlaces simbólicos
  let canonicalUploads;
  let canonicalFile;
  try {
    canonicalUploads = fs.realpathSync(uploadsResolved);
    canonicalFile = fs.realpathSync(candidatePath);
  } catch {
    return { valido: false, codigo: 400, mensaje: 'Error al resolver la ruta física canónica.' };
  }

  // 6. Verificar que sea un archivo regular (no directorio ni dispositivo)
  try {
    const stat = fs.statSync(canonicalFile);
    if (!stat.isFile()) {
      return { valido: false, codigo: 400, mensaje: 'El recurso solicitado no es un archivo regular.' };
    }
  } catch {
    return { valido: false, codigo: 400, mensaje: 'Error al inspeccionar el archivo físico.' };
  }

  // 7. Comprobación canónica estricta con path.relative (no depende de startsWith)
  const relativePath = path.relative(canonicalUploads, canonicalFile);
  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return { valido: false, codigo: 400, mensaje: 'Ruta de archivo no permitida fuera del directorio autorizado.' };
  }

  return { valido: true, safeFilePath: canonicalFile };
}

/**
 * GET /api/documents/:id/archivo
 * Descarga o previsualiza un documento físico verificando autenticación, rol y permisos departamentales.
 * Evita path traversal y rechaza accesos no autorizados.
 */
export async function descargarDocumento(req, res) {
  const { id } = req.params;

  // 1. Validar identificador numérico
  const docId = parseInt(id, 10);
  if (isNaN(docId) || docId <= 0) {
    return res.status(400).json({ ok: false, mensaje: 'Identificador de documento inválido.' });
  }

  try {
    // 2. Consultar documento y su repositorio asociado
    const rows = await db.query(
      `SELECT d.*, r.departamento AS repo_departamento, r.usuario_id AS repo_usuario_id 
       FROM documentos d
       JOIN repositorios r ON d.repositorio_id = r.id
       WHERE d.id = ?`,
      [docId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Documento no encontrado.' });
    }

    const doc = rows[0];

    // 3. Control de acceso por rol y departamento
    if (!verificarPermisoDocumento(req.user, doc)) {
      return res.status(403).json({
        ok: false,
        mensaje: 'No tiene permisos para acceder a este documento.',
      });
    }

    // 4. Resolución física canónica y prevención estricta de Path Traversal
    const uploadsDir = path.resolve(__dirname, '../uploads');
    const validacion = validarRutaCanonicaSegura(uploadsDir, doc.url_descarga || doc.nombre_archivo);
    if (!validacion.valido) {
      return res.status(validacion.codigo).json({ ok: false, mensaje: validacion.mensaje });
    }

    const safeFilePath = validacion.safeFilePath;

    // 5. Servir archivo con cabeceras de seguridad
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
    console.error('Error al descargar documento:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error al servir el archivo.' });
  }
}

