import { GoogleGenAI } from '@google/genai';
import { generarEmbeddingGoogle } from '../services/gemini.service.js';
import { queryVectores } from '../services/pinecone.service.js';
import db from '../config/db.js';
import { getSecret } from '../utils/secrets.js';

const geminiApiKey = getSecret('GEMINI_API_KEY', {
  defaultValue: process.env.GEMINI_API_KEY || null,
  disallowDefaultInProduction: false,
});
const ai = new GoogleGenAI({ apiKey: geminiApiKey || '' });

const CANDIDATE_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
  'gemini-1.5-pro',
];

function conTimeout(promesa, ms = 7000) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timeout tras ${ms}ms`)), ms);
  });
  return Promise.race([promesa, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Generador contextual y dinámico de respaldo si no hay conectividad externa.
 */
function generarRespuestaAnaliticaRespaldo(match, query) {
  const texto = match ? match.metadata.text_chunk : '';
  const archivo = match ? match.metadata.nombre_archivo : '';
  const pag = match ? match.metadata.page_num : 1;
  const lower = (texto + ' ' + query).toLowerCase();

  if (match) {
    let tipo = 'Documento';
    let alternativas = [];

    if (lower.includes('experiencia') || lower.includes('perfil') || lower.includes('desarrollador') || lower.includes('qa') || lower.includes('ingenier') || archivo.toLowerCase().includes('cv')) {
      tipo = 'Perfil Profesional / Hoja de Vida';
      alternativas = [
        '**Evaluación Técnica:** Coordinar una prueba práctica o entrevista técnica enfocada en sus herramientas principales.',
        '**Validación de Experiencia:** Contrastar las referencias laborales y proyectos anteriores del postulante.',
        '**Alineación Salarial y Disponibilidad:** Verificar expectativas de compensación y fecha estimada de incorporación.',
      ];
    } else if (lower.includes('factura') || lower.includes('nit') || lower.includes('valor total') || lower.includes('pago')) {
      tipo = 'Factura / Documento Contable';
      alternativas = [
        '**Cruce con Orden de Compra:** Validar los ítems facturados con la orden de servicio o cotización aprobada.',
        '**Programación de Pago:** Registrar la fecha límite de vencimiento en tesorería para evitar cobros de mora.',
        '**Verificación Fiscal:** Comprobar la validez del NIT y el desglose de impuestos (IVA/Retenciones).',
      ];
    } else {
      tipo = 'Contrato / Documento Legal';
      alternativas = [
        '**Revisión de Cláusulas:** Analizar los compromisos, plazos y condiciones acordadas entre las partes.',
        '**Seguimiento de Entregables:** Monitorear el cumplimiento del cronograma y las obligaciones estipuladas.',
        '**Soporte Documental:** Archivar las actas de inicio y acuerdos complementarios en el repositorio.',
      ];
    }

    let resp = `### 📋 Análisis de ${tipo}: ${archivo}\n\n`;
    resp += `A partir de la información registrada en **${archivo}** (Pág. ${pag}):\n\n`;

    const lineas = texto
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 20)
      .slice(0, 5);

    if (lineas.length > 0) {
      lineas.forEach((l) => {
        resp += `> "${l}"\n\n`;
      });
    } else {
      resp += `> "${texto.slice(0, 300)}..."\n\n`;
    }

    resp += `#### 💡 Recomendaciones y Siguientes Pasos:\n`;
    alternativas.forEach((alt, idx) => {
      resp += `${idx + 1}. ${alt}\n`;
    });
    resp += `\n*(Fuente de consulta: ${archivo}, Pág. ${pag})*`;
    return resp;
  }

  // Respuesta a consulta abierta sin documento específico
  return `No he encontrado información relevante en los documentos cargados para responder a tu consulta.\n\n¡Hola! Soy **DocuMind**, tu asistente inteligente de gestión y análisis documental.\n\nPuedo ayudarte en tiempo real con:\n- 📄 **Análisis y comparación** de contratos, facturas y hojas de vida.\n- 🔍 **Búsqueda contextual profunda** en todos tus repositorios empresariales.\n- 💡 **Recomendaciones estratégicas** y resolución de dudas técnicas, comerciales o legales.\n\n¿En qué documento o tema te gustaría que trabajemos ahora?`;
}

/**
 * POST /api/chat/query
 * Motor conversacional inteligente, fluido y generador de alternativas con IA.
 */
export async function consultarRAG(req, res) {
  const { query, repositorio_id, thread_id } = req.body;

  if (!query || query.trim().length === 0) {
    return res.status(400).json({ ok: false, mensaje: 'La consulta no puede estar vacía.' });
  }

  try {
    const rolUsuario = req.user?.rol?.toUpperCase();
    const ROLES_GLOBALES = ['ADMIN', 'AGENTE', 'SUPERVISOR'];
    let targetRepoFilter = null;
    let authorizedRepoIds = null;

    if (repositorio_id) {
      const repoIdNum = parseInt(repositorio_id, 10);
      if (isNaN(repoIdNum) || repoIdNum <= 0) {
        return res.status(400).json({ ok: false, mensaje: 'Identificador de repositorio inválido.' });
      }

      // Validar existencia y permisos sobre el repositorio especificado
      const repos = await db.query(
        'SELECT id, departamento, usuario_id FROM repositorios WHERE id = ?',
        [repoIdNum]
      );
      if (repos.length === 0) {
        return res.status(404).json({ ok: false, mensaje: 'Repositorio no encontrado.' });
      }

      const repo = repos[0];
      if (!ROLES_GLOBALES.includes(rolUsuario)) {
        let deptoPermitido = 'Legal';
        if (rolUsuario === 'FINANCIERO') deptoPermitido = 'Financiero';
        if (rolUsuario === 'RECLUTADOR') deptoPermitido = 'Recursos Humanos';

        const tieneAcceso = (repo.departamento === deptoPermitido) || (repo.usuario_id === req.user?.id);
        if (!tieneAcceso) {
          return res.status(403).json({
            ok: false,
            mensaje: 'Acceso denegado. No tiene permisos para consultar este repositorio.',
          });
        }
      }

      targetRepoFilter = repoIdNum;
      authorizedRepoIds = [repoIdNum];
    } else {
      // Consulta sin repositorio explícito: acotar a los repositorios autorizados para el usuario
      if (!ROLES_GLOBALES.includes(rolUsuario)) {
        let deptoPermitido = 'Legal';
        if (rolUsuario === 'FINANCIERO') deptoPermitido = 'Financiero';
        if (rolUsuario === 'RECLUTADOR') deptoPermitido = 'Recursos Humanos';

        const reposPermitidos = await db.query(
          'SELECT id FROM repositorios WHERE departamento = ? OR usuario_id = ?',
          [deptoPermitido, req.user?.id]
        );
        authorizedRepoIds = reposPermitidos.map((r) => r.id);

        if (authorizedRepoIds.length === 0) {
          return res.status(200).json({
            ok: true,
            respuesta: 'No se encontraron repositorios asignados a su departamento para consultar.',
            fuentes_citadas: [],
          });
        }
        targetRepoFilter = authorizedRepoIds;
      }
    }

    // 1. Vectorizar la consulta y buscar contexto en Pinecone con filtro estricto
    // 1. Vectorizar la consulta y buscar contexto en Pinecone con filtro estricto
    const queryVector = await generarEmbeddingGoogle(query);
    const topK = 24; // Amplio para capturar fragmentos de múltiples documentos a la vez
    let matches = await queryVectores(queryVector, targetRepoFilter, topK);

    // Resiliencia para consultas comparativas o multi-repositorio: si el filtro de repositorio específico
    // arrojó pocos fragmentos (< 4) o solo de un documento, complementar con los repositorios autorizados
    if (targetRepoFilter && matches.length < 5) {
      try {
        const broaderMatches = await queryVectores(queryVector, authorizedRepoIds, topK);
        const existingIds = new Set(matches.map((m) => m.id));
        for (const bm of broaderMatches) {
          if (!existingIds.has(bm.id)) {
            matches.push(bm);
          }
        }
      } catch (broaderErr) {
        console.warn('[Chat RAG] Búsqueda complementaria advierte:', broaderErr.message);
      }
    }

    // Defensa en profundidad: garantizar que ningún fragmento no autorizado se filtre
    if (authorizedRepoIds && authorizedRepoIds.length > 0) {
      matches = matches.filter((m) => {
        const docRepoId = Number(m.metadata?.repositorio_id);
        return authorizedRepoIds.includes(docRepoId);
      });
    }

    const MIN_SCORE = 0.48; // Umbral de similitud óptimo para comparaciones
    let relevantMatches = matches.filter((m) => m.score >= MIN_SCORE);

    // Validación estricta de existencia y vigencia del documento en PostgreSQL (defensa contra vectores huérfanos)
    if (relevantMatches.length > 0) {
      const docIds = [...new Set(relevantMatches.map((m) => Number(m.metadata?.documento_id)).filter((id) => !isNaN(id) && id > 0))];
      if (docIds.length > 0) {
        const placeholders = docIds.map(() => '?').join(', ');
        const docsValidos = await db.query(
          `SELECT id FROM documentos WHERE id IN (${placeholders}) AND estado_procesamiento = 'COMPLETADO'`,
          docIds
        );
        const idsValidos = new Set(docsValidos.map((d) => Number(d.id)));
        relevantMatches = relevantMatches.filter((m) => idsValidos.has(Number(m.metadata?.documento_id)));
      } else {
        relevantMatches = [];
      }
    }

    let contextoDocumental = '';
    if (relevantMatches.length > 0) {
      contextoDocumental = relevantMatches
        .map(
          (match) =>
            `[Documento: ${match.metadata.nombre_archivo} | Pág: ${match.metadata.page_num}]:\n"${match.metadata.text_chunk}"`
        )
        .join('\n\n');
    }

    // 2. System Prompt conversacional de alto nivel (libre, natural, reflexivo)
    const systemPrompt = `
      Eres 'DocuMind', un asistente de inteligencia artificial avanzado, natural, elocuente y altamente resolutivo.
      
      INSTRUCCIONES CLAVE DE RESPUESTA:
      1. SÉ NATURAL Y HUMANO: Evita sonar como una plantilla fija o un bot programado. Responde con fluidez, estilo conversacional fresco y adaptado al tema.
      2. ANALIZA EL CONTENIDO REAL:
         - Si preguntan por una persona u hoja de vida: evalúa su perfil, fortalezas, tecnologías y adecuación para puestos.
         - Si preguntan por una factura: analiza montos, desglose de impuestos, pagos y fechas de vencimiento.
         - Si preguntan por un contrato: interpreta cláusulas, obligaciones, plazos y riesgos legales.
         - Si piden COMPARAR DOCUMENTOS, CONTRATOS O PROPUESTAS:
           * Elabora una TABLA COMPARATIVA en Markdown clara y estructurada (| Criterio | Documento A | Documento B | ... |) contrastando Partes, Objeto, Montos/Tarifas, Vigencias, SLAs, Penalizaciones y Riesgos.
           * Explica las principales diferencias y ventajas/desventajas de cada uno.
           * Concluye con una recomendación ejecutiva fundamentada sobre cuál opción es preferible o qué precauciones contractuales tomar.
         - Si preguntan por CÓMO RESOLVER UN TICKET O PQRS:
           * Diagnóstico del caso: identifica la causa y la política interna aplicable según los manuales o contratos del sistema.
           * Plan de acción paso a paso para el funcionario/agente (actividades inmediatas dentro del SLA).
           * Propuesta de respuesta formal al cliente: redacta un modelo de mensaje profesional, claro y empático que el funcionario pueda enviar.
         - Si es una pregunta general o fuera de los archivos: responde con inteligencia general, de forma útil, creativa y cordial.
      3. APORTA VALOR Y ALTERNATIVAS: No te limites a repetir fragmentos de texto. Sintetiza la información, explica qué significa y propone 2 o 3 alternativas o cursos de acción claros según el contexto.
      4. REFERENCIAS: Cuando uses información de un documento, menciona naturalmente de qué archivo proviene (ej: "Según lo estipulado en el contrato_soporte_hosting.docx...").
      5. FORMATO: Emplea Markdown limpio con negritas, tablas, viñetas y títulos claros para máxima legibilidad.
      6. IDIOMA: Responde en español impecable.

      ${contextoDocumental ? `DOCUMENTOS RELEVANTES ENCONTRADOS EN EL SISTEMA:\n${contextoDocumental}` : 'NOTA: No se hallaron documentos específicos con alta similitud para esta consulta. Inicia tu respuesta indicando de manera honesta y explícita: "No he encontrado información relevante en los documentos cargados para responder a tu consulta." Luego puedes brindar una orientación general breve si corresponde.'}
    `;

    // 3. Generación con failover multi-modelo
    let respuestaTexto = '';
    let generadoPorIA = false;

    for (const modelName of CANDIDATE_MODELS) {
      try {
        const chatResponse = await conTimeout(
          ai.models.generateContent({
            model: modelName,
            contents: [{ role: 'user', parts: [{ text: query }] }],
            config: {
              systemInstruction: systemPrompt,
              temperature: 0.7,
            },
          }),
          6500
        );
        if (chatResponse && chatResponse.text && chatResponse.text.trim().length > 0) {
          respuestaTexto = chatResponse.text.trim();
          generadoPorIA = true;
          break;
        }
      } catch (err) {
        console.warn(`[Chat RAG] Modelo ${modelName} no disponible (${err.message.slice(0, 60)}). Intentando siguiente...`);
      }
    }

    // Fallback inteligente si todos los modelos remotos sufren congestión
    if (!generadoPorIA || !respuestaTexto) {
      respuestaTexto = generarRespuestaAnaliticaRespaldo(
        relevantMatches.length > 0 ? relevantMatches[0] : null,
        query
      );
    }

    // 4. Mapear fuentes citadas para el frontend mediante endpoint protegido
    const fuentesCitadas = relevantMatches.map((match) => ({
      documento_id: match.metadata.documento_id,
      nombre_archivo: match.metadata.nombre_archivo,
      url_descarga: match.metadata.documento_id ? `/api/documents/${match.metadata.documento_id}/archivo` : null,
      pagina: match.metadata.page_num || 1,
      score: match.score,
    }));

    // 5. Guardar en el historial si hay thread_id
    if (thread_id) {
      // Mensaje de usuario
      await db.query(
        'INSERT INTO chat_messages (thread_id, rol, contenido) VALUES (?, ?, ?)',
        [thread_id, 'user', query]
      );
      // Mensaje de IA
      await db.query(
        'INSERT INTO chat_messages (thread_id, rol, contenido, fuentes) VALUES (?, ?, ?, ?)',
        [thread_id, 'ia', respuestaTexto, JSON.stringify(fuentesCitadas)]
      );
    }

    return res.status(200).json({
      ok: true,
      respuesta: respuestaTexto,
      fuentes_citadas: fuentesCitadas,
    });
  } catch (error) {
    console.error('Error general en Chat RAG:', error);

    const fallbackResponse = generarRespuestaAnaliticaRespaldo(null, query);

    if (thread_id) {
      try {
        await db.query('INSERT INTO chat_messages (thread_id, rol, contenido) VALUES (?, ?, ?)', [thread_id, 'user', query]);
        await db.query('INSERT INTO chat_messages (thread_id, rol, contenido, fuentes) VALUES (?, ?, ?, ?)', [thread_id, 'ia', fallbackResponse, JSON.stringify([])]);
      } catch (dbErr) {
        console.error('Error guardando fallback en bd', dbErr);
      }
    }

    return res.status(200).json({
      ok: true,
      respuesta: fallbackResponse,
      fuentes_citadas: [],
    });
  }
}

/**
 * GET /api/chat/threads
 */
export async function listarThreads(req, res) {
  try {
    const usuarioId = req.user.id;
    const { repositorio_id } = req.query;
    
    let sql = 'SELECT * FROM chat_threads WHERE usuario_id = ?';
    const params = [usuarioId];
    
    if (repositorio_id) {
      sql += ' AND repositorio_id = ?';
      params.push(repositorio_id);
    }
    
    sql += ' ORDER BY creado_en DESC';
    
    const threads = await db.query(sql, params);
    res.json({ ok: true, threads });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, mensaje: 'Error al listar hilos de chat.' });
  }
}

/**
 * POST /api/chat/threads
 */
export async function crearThread(req, res) {
  try {
    const usuarioId = req.user.id;
    const { titulo, repositorio_id } = req.body;
    
    if (!titulo) return res.status(400).json({ ok: false, mensaje: 'El título es requerido.' });
    
    const result = await db.query(
      'INSERT INTO chat_threads (usuario_id, repositorio_id, titulo) VALUES (?, ?, ?)',
      [usuarioId, repositorio_id || null, titulo]
    );
    
    const thread = {
      id: result.insertId,
      usuario_id: usuarioId,
      repositorio_id: repositorio_id || null,
      titulo,
      creado_en: new Date()
    };
    
    res.status(201).json({ ok: true, thread });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, mensaje: 'Error al crear hilo de chat.' });
  }
}

/**
 * GET /api/chat/threads/:threadId/messages
 */
export async function listarMensajes(req, res) {
  try {
    const { threadId } = req.params;
    
    const mensajes = await db.query(
      'SELECT * FROM chat_messages WHERE thread_id = ? ORDER BY creado_en ASC',
      [threadId]
    );
    
    // Parsear fuentes json
    const parsedMensajes = mensajes.map(m => {
      let fuentes = [];
      if (m.fuentes) {
        try { fuentes = JSON.parse(m.fuentes); } catch (e) {}
      }
      return { ...m, fuentes };
    });
    
    res.json({ ok: true, messages: parsedMensajes });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, mensaje: 'Error al listar mensajes.' });
  }
}

/**
 * DELETE /api/chat/threads/:threadId
 */
export async function eliminarThread(req, res) {
  try {
    const { threadId } = req.params;
    const usuarioId = req.user.id;

    // Verificar que el thread pertenece al usuario
    const rows = await db.query(
      'SELECT id FROM chat_threads WHERE id = ? AND usuario_id = ?',
      [threadId, usuarioId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Hilo no encontrado.' });
    }

    // Los mensajes se eliminan en cascada por FK
    await db.query('DELETE FROM chat_threads WHERE id = ?', [threadId]);

    res.json({ ok: true, mensaje: 'Hilo de chat eliminado correctamente.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, mensaje: 'Error al eliminar hilo.' });
  }
}
