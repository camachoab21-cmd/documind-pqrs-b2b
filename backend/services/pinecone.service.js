import { Pinecone } from '@pinecone-database/pinecone';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getSecret } from '../utils/secrets.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });
dotenv.config({ path: join(__dirname, '../config/.env') });

let pcInstance = null;
let indexInstance = null;

function getPineconeApiKey() {
  return getSecret('PINECONE_API_KEY', {
    defaultValue: null,
    disallowDefaultInProduction: false,
  });
}

/**
 * Obtiene la instancia del índice Pinecone (singleton lazy)
 */
function getIndex() {
  if (!indexInstance) {
    const apiKey = getPineconeApiKey();
    const indexName = process.env.PINECONE_INDEX_NAME || process.env.PINECONE_INDEX || 'documind';
    pcInstance = new Pinecone({ apiKey });
    indexInstance = pcInstance.index(indexName);
  }
  return indexInstance;
}

/**
 * Indexa chunks de texto con sus embeddings en Pinecone
 * @param {Array<{texto: string, embedding: number[], pageNum: number}>} chunks
 * @param {number} documentoId - ID del documento en MySQL / PostgreSQL
 * @param {number} repositorioId - ID del repositorio en MySQL / PostgreSQL
 * @param {string} nombreArchivo - Nombre del archivo para trazabilidad
 */
export async function upsertChunks(chunks, documentoId, repositorioId, nombreArchivo, urlDescarga) {
  if (!getPineconeApiKey()) {
    console.warn('[Pinecone Service] PINECONE_API_KEY no configurada. Omitiendo indexación vectorial.');
    return;
  }

  const index = getIndex();

  const vectors = chunks.map((chunk, i) => ({
    id: `doc_${documentoId}_chunk_${i}`,
    values: chunk.embedding,
    metadata: {
      documento_id: documentoId,
      repositorio_id: repositorioId,
      nombre_archivo: nombreArchivo,
      url_descarga: urlDescarga || '',  // Ruta real con timestamp para el Visor
      text_chunk: chunk.texto.slice(0, 1000),
      page_num: chunk.pageNum || 1,
    },
  }));

  // Upsert en lotes de 100 (límite de Pinecone)
  const batchSize = 100;
  for (let i = 0; i < vectors.length; i += batchSize) {
    const batch = vectors.slice(i, i + batchSize);
    await index.upsert(batch);
  }
}

/**
 * Busca los vectores más similares en Pinecone para una query dada
 * @param {number[]} queryVector - Embedding de 768 dims de la consulta
 * @param {number|number[]|null} repositorioId - Filtro opcional por repositorio único o lista de repositorios autorizados
 * @param {number} topK - Número de resultados a retornar (default 3)
 * @returns {Promise<Array>} Matches con metadata incluida
 */
export async function queryVectores(queryVector, repositorioId = null, topK = 3) {
  if (!getPineconeApiKey()) {
    console.warn('[Pinecone Service] PINECONE_API_KEY no configurada.');
    return [];
  }

  try {
    const index = getIndex();
    let filter;

    if (Array.isArray(repositorioId)) {
      if (repositorioId.length === 0) return [];
      filter = { repositorio_id: { $in: repositorioId } };
    } else if (repositorioId) {
      filter = { repositorio_id: { $eq: repositorioId } };
    }

    const response = await index.query({
      vector: queryVector,
      topK,
      includeMetadata: true,
      filter,
    });

    return response.matches || [];
  } catch (err) {
    console.warn('[Pinecone Service] Error al consultar vectores:', err.message);
    return [];
  }
}

/**
 * Elimina todos los vectores asociados a un documento de Pinecone
 * @param {number} documentoId - ID del documento a eliminar
 */
export async function eliminarVectoresDocumento(documentoId) {
  if (!getPineconeApiKey()) return;

  try {
    const index = getIndex();
    try {
      await index.deleteMany({
        filter: { documento_id: { $eq: documentoId } },
      });
    } catch {
      // Fallback: intentar eliminar IDs predecibles (hasta 500 chunks)
      const ids = Array.from({ length: 500 }, (_, i) => `doc_${documentoId}_chunk_${i}`);
      await index.deleteMany(ids);
    }
  } catch (err) {
    console.warn('[Pinecone Service] Error al eliminar vectores:', err.message);
  }
}
