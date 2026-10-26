import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Trash2,
  Eye,
  X,
  Loader2,
  RefreshCw,
  FileSearch,
  FolderOpen,
  Plus,
  FolderPlus,
} from 'lucide-react';
import { documentsAPI, repositoriesAPI } from '../services/api';

const BADGE_MAP = {
  COMPLETADO: 'badge-completado',
  PROCESANDO: 'badge-procesando',
  ERROR: 'badge-error',
  PENDIENTE: 'badge-pendiente',
};

const CATEGORIA_ICON = {
  Contrato: '📄',
  Factura: '🧾',
  'Hoja de Vida': '👤',
  Otros: '📁',
};

function formatBytes(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatFecha(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function IngestaDocumental({ selectedRepo, onRepoSelect }) {
  const [dragActive, setDragActive] = useState(false);
  const [documentos, setDocumentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState(null); // { tipo, mensaje }
  const [docDetalle, setDocDetalle] = useState(null); // Modal de detalle
  const [eliminando, setEliminando] = useState(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const fileInputRef = useRef(null);
  const pollingRef = useRef(null);

  // Gestión de repositorios directa en la página
  const [repositorios, setRepositorios] = useState([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [modalNuevoRepo, setModalNuevoRepo] = useState(false);
  const [formRepo, setFormRepo] = useState({ nombre: '', departamento: 'Legal', descripcion: '' });
  const [guardandoRepo, setGuardandoRepo] = useState(false);

  const previewBlobUrlRef = useRef(null);

  // Manejo de ciclo de vida de Object URL seguro para vista previa autenticada con AbortController
  useEffect(() => {
    if (previewBlobUrlRef.current) {
      URL.revokeObjectURL(previewBlobUrlRef.current);
      previewBlobUrlRef.current = null;
    }

    if (!docDetalle?.url_descarga || docDetalle?.tipo_formato?.toUpperCase() !== 'PDF') {
      setPreviewBlobUrl(null);
      return;
    }

    const abortController = new AbortController();
    setLoadingPreview(true);
    const token = localStorage.getItem('documind_token');
    const fullUrl = docDetalle.url_descarga.startsWith('http')
      ? docDetalle.url_descarga
      : `http://localhost:5000${docDetalle.url_descarga}`;

    fetch(fullUrl, {
      signal: abortController.signal,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: Error al cargar vista previa`);
        return res.blob();
      })
      .then((blob) => {
        const objectUrl = URL.createObjectURL(blob);
        previewBlobUrlRef.current = objectUrl;
        setPreviewBlobUrl(objectUrl);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        console.error('Error fetching preview blob:', err);
        setPreviewBlobUrl(null);
      })
      .finally(() => {
        if (!abortController.signal.aborted) {
          setLoadingPreview(false);
        }
      });

    return () => {
      abortController.abort();
      if (previewBlobUrlRef.current) {
        URL.revokeObjectURL(previewBlobUrlRef.current);
        previewBlobUrlRef.current = null;
      }
    };
  }, [docDetalle?.url_descarga, docDetalle?.tipo_formato]);

  const cargarDocumentos = useCallback(async () => {
    try {
      const params = selectedRepo ? { repositorio_id: selectedRepo.id } : {};
      const res = await documentsAPI.list(params);
      setDocumentos(res.data.documentos || []);
    } catch {
      // error silencioso en polling
    } finally {
      setLoading(false);
    }
  }, [selectedRepo]);

  const cargarRepositorios = useCallback(async () => {
    try {
      setLoadingRepos(true);
      const res = await repositoriesAPI.list();
      const repos = res.data?.repositorios || [];
      setRepositorios(repos);
      if (repos.length > 0 && onRepoSelect) {
        if (!selectedRepo || !repos.some((r) => r.id === selectedRepo.id)) {
          onRepoSelect(repos[0]);
        }
      }
    } catch (err) {
      console.warn('Error al obtener repositorios:', err.message);
    } finally {
      setLoadingRepos(false);
    }
  }, [selectedRepo, onRepoSelect]);

  useEffect(() => {
    cargarRepositorios();
  }, []);

  const handleCrearRepoSubmit = async (e) => {
    e.preventDefault();
    if (!formRepo.nombre.trim()) return;

    setGuardandoRepo(true);
    try {
      const res = await repositoriesAPI.create({
        nombre: formRepo.nombre.trim(),
        departamento: formRepo.departamento,
        descripcion: formRepo.descripcion.trim() || undefined,
      });

      const nuevo = res.data?.repositorio;
      setModalNuevoRepo(false);
      setFormRepo({ nombre: '', departamento: 'Legal', descripcion: '' });
      await cargarRepositorios();
      if (nuevo && onRepoSelect) {
        onRepoSelect(nuevo);
      }
      setUploadStatus({
        tipo: 'success',
        mensaje: `✅ Repositorio '${nuevo?.nombre || formRepo.nombre}' creado y seleccionado exitosamente.`
      });
    } catch (err) {
      setUploadStatus({
        tipo: 'error',
        mensaje: err.response?.data?.mensaje || 'Error al crear el repositorio.'
      });
    } finally {
      setGuardandoRepo(false);
    }
  };

  useEffect(() => {
    cargarDocumentos();
    // Polling cada 5s para actualizar estados en tiempo real
    pollingRef.current = setInterval(cargarDocumentos, 5000);
    return () => clearInterval(pollingRef.current);
  }, [cargarDocumentos]);

  const procesarArchivos = async (files) => {
    if (!files || files.length === 0) return;

    if (!selectedRepo) {
      setUploadStatus({ tipo: 'error', mensaje: '⚠️ Selecciona o crea un repositorio antes de cargar archivos.' });
      return;
    }

    const archivosArray = Array.from(files);
    const extensionesPermitidas = ['.pdf', '.docx', '.txt'];
    let exitosos = 0;
    let fallidos = 0;

    setUploading(true);

    for (let i = 0; i < archivosArray.length; i++) {
      const archivo = archivosArray[i];
      const ext = archivo.name.substring(archivo.name.lastIndexOf('.')).toLowerCase();

      if (!extensionesPermitidas.includes(ext) || archivo.size > 15 * 1024 * 1024) {
        fallidos++;
        continue;
      }

      setUploadProgress(0);
      setUploadStatus({ 
        tipo: 'info', 
        mensaje: `🔄 Procesando [${i + 1}/${archivosArray.length}] "${archivo.name}" con IA...` 
      });

      // Simular progreso visual
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + Math.random() * 8, 90));
      }, 500);

      try {
        const formData = new FormData();
        formData.append('file', archivo);
        formData.append('repositorio_id', selectedRepo.id);

        await documentsAPI.upload(formData);
        exitosos++;
      } catch (err) {
        fallidos++;
      } finally {
        clearInterval(progressInterval);
        setUploadProgress(100);
      }
    }

    setUploading(false);
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
    
    setUploadStatus({
      tipo: fallidos === 0 ? 'success' : (exitosos === 0 ? 'error' : 'info'),
      mensaje: `✅ Proceso completado. ${exitosos} archivos indexados. ` + (fallidos > 0 ? `❌ ${fallidos} fallidos.` : '')
    });
    
    await cargarDocumentos();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    procesarArchivos(e.dataTransfer.files);
  };

  const handleFileChange = (e) => {
    procesarArchivos(e.target.files);
  };

  const handleEliminar = async (doc) => {
    if (!window.confirm(`¿Eliminar "${doc.nombre_archivo}" de MySQL y Pinecone?`)) return;
    setEliminando(doc.id);
    try {
      await documentsAPI.delete(doc.id);
      await cargarDocumentos();
    } catch {
      // Silencioso
    } finally {
      setEliminando(null);
    }
  };

  const verDetalle = async (doc) => {
    try {
      const res = await documentsAPI.getById(doc.id);
      setDocDetalle(res.data.documento);
    } catch {
      setDocDetalle(doc);
    }
  };

  return (
    <div id="pantalla-ingesta" className="p-8 bg-slate-50 min-h-screen w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <span>📥</span> Ingesta y Carga Documental
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Cargue archivos PDF, DOCX y TXT para que la IA extraiga metadatos y clasifique automáticamente.
            {selectedRepo && (
              <span className="ml-2 text-indigo-600 font-semibold">
                → Repositorio: {selectedRepo.nombre}
              </span>
            )}
          </p>
        </div>
        <button
          id="btn-refresh-documentos"
          onClick={cargarDocumentos}
          className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 text-sm font-medium transition-colors px-3 py-2 rounded-lg hover:bg-white border border-transparent hover:border-slate-200"
        >
          <RefreshCw className="w-4 h-4" />
          Actualizar
        </button>
      </div>

      {/* Barra de Selección y Control de Repositorio */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 flex-shrink-0">
            <FolderOpen className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <label htmlFor="select-repositorio-activo" className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Repositorio de Ingesta Activo
            </label>
            <div className="flex items-center gap-2">
              <select
                id="select-repositorio-activo"
                value={selectedRepo?.id || ''}
                onChange={(e) => {
                  const id = parseInt(e.target.value);
                  const repo = repositorios.find((r) => r.id === id);
                  if (repo && onRepoSelect) onRepoSelect(repo);
                }}
                disabled={loadingRepos || repositorios.length === 0}
                className="w-full max-w-md bg-slate-50 hover:bg-slate-100/80 border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
              >
                {repositorios.length === 0 ? (
                  <option value="">(No hay repositorios disponibles)</option>
                ) : (
                  repositorios.map((r) => (
                    <option key={r.id} value={r.id}>
                      📁 {r.nombre} ({r.departamento}) — {r.total_documentos || 0} docs
                    </option>
                  ))
                )}
              </select>
              {loadingRepos && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            id="btn-crear-repositorio-ingesta"
            onClick={() => setModalNuevoRepo(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm hover:shadow transition-all"
          >
            <FolderPlus className="w-4 h-4" />
            <span>+ Nuevo Repositorio</span>
          </button>
        </div>
      </div>

      {/* Banner si no hay repositorios creados */}
      {repositorios.length === 0 && !loadingRepos && (
        <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <p className="text-amber-800 text-sm">
              No tienes ningún repositorio creado todavía. Crea tu primer repositorio para comenzar a subir documentos.
            </p>
          </div>
          <button
            onClick={() => setModalNuevoRepo(true)}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow-sm"
          >
            Crear Repositorio Ahora
          </button>
        </div>
      )}

      {/* Zona Drag & Drop */}
      <div
        id="zona-drag-drop"
        className={`bg-white border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center transition-all duration-200 cursor-pointer mb-6 ${
          dragActive
            ? 'border-indigo-500 bg-indigo-50/50 scale-[1.01] shadow-lg shadow-indigo-100'
            : 'border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50/20'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt"
          multiple
          onChange={handleFileChange}
          className="hidden"
          disabled={uploading}
        />
        {uploading ? (
          <div className="text-center">
            <Loader2 className="w-14 h-14 text-indigo-500 animate-spin mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">Pipeline de IA en proceso...</h3>
            <p className="text-slate-400 text-sm mb-4">Extrayendo texto · Clasificando con Gemini · Indexando en Pinecone</p>
            <div className="w-64 mx-auto bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className="bg-indigo-600 h-full rounded-full transition-all duration-300 relative overflow-hidden"
                style={{ width: `${uploadProgress}%` }}
              >
                <div className="absolute inset-0 progress-shimmer" />
              </div>
            </div>
            <p className="text-indigo-600 text-sm font-semibold mt-2">{Math.round(uploadProgress)}%</p>
          </div>
        ) : (
          <>
            {selectedRepo && (
              <div className="mb-3 px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-full text-xs font-semibold text-indigo-700 inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Destino: {selectedRepo.nombre} ({selectedRepo.departamento})
              </div>
            )}
            <UploadCloud className={`w-16 h-16 mb-3 transition-colors ${dragActive ? 'text-indigo-600' : 'text-indigo-400'}`} />
            <h3 className="text-lg font-semibold text-slate-700 mb-1">
              {dragActive ? '¡Suelte el archivo aquí!' : 'Arrastre y suelte sus archivos aquí'}
            </h3>
            <p className="text-slate-400 text-sm mb-4">
              Soporta PDF, DOCX, TXT · Máximo 15 MB (Límite UTS)
            </p>
            <button
              id="btn-seleccionar-archivo"
              className="btn-primary pointer-events-none"
            >
              Seleccionar Archivos
            </button>
          </>
        )}
      </div>

      {/* Alerta de resultado de carga */}
      {uploadStatus && (
        <div
          className={`mb-5 p-4 rounded-xl flex items-start gap-3 animate-slide-up border ${
            uploadStatus.tipo === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : uploadStatus.tipo === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}
        >
          <p className="text-sm flex-1">{uploadStatus.mensaje}</p>
          <button onClick={() => setUploadStatus(null)} className="opacity-60 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabla de documentos */}
      <div className="card overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-700">Documentos Recientes en el Repositorio</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Muestra el estado en tiempo real del pipeline de procesamiento de Inteligencia Artificial.
            </p>
          </div>
          {loading && <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />}
        </div>

        {documentos.length === 0 && !loading ? (
          <div className="py-16 text-center">
            <FileSearch className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">Sin documentos en este repositorio.</p>
            <p className="text-slate-300 text-sm mt-1">Carga el primer archivo para comenzar.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 text-slate-400 font-semibold text-xs border-b border-slate-100">
                  <th className="p-4">Archivo</th>
                  <th className="p-4">Formato</th>
                  <th className="p-4">Tamaño</th>
                  <th className="p-4">Categoría IA</th>
                  <th className="p-4">Confianza</th>
                  <th className="p-4">Cargado</th>
                  <th className="p-4 text-center">Estado Pipeline</th>
                  <th className="p-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-sm text-slate-600">
                {documentos.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-slate-300 flex-shrink-0" />
                        <span className="font-medium text-slate-800 max-w-[220px] truncate" title={doc.nombre_archivo}>
                          {doc.nombre_archivo}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="text-slate-400 font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">
                        {doc.tipo_formato}
                      </span>
                    </td>
                    <td className="p-4 text-slate-500">{formatBytes(doc.tamano_bytes ?? doc.tamaño_bytes)}</td>
                    <td className="p-4 font-semibold text-indigo-600">
                      {doc.categoria_detectada
                        ? `${CATEGORIA_ICON[doc.categoria_detectada] || '📁'} ${doc.categoria_detectada}`
                        : <span className="text-slate-400 font-normal">Pendiente</span>
                      }
                    </td>
                    <td className="p-4">
                      {doc.score_confianza != null ? (
                        <span className={`font-semibold ${doc.score_confianza >= 80 ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {parseFloat(doc.score_confianza).toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="p-4 text-slate-400 text-xs">{formatFecha(doc.creado_en)}</td>
                    <td className="p-4 text-center">
                      <span className={BADGE_MAP[doc.estado_procesamiento] || 'badge-pendiente'}>
                        {doc.estado_procesamiento}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          id={`btn-ver-doc-${doc.id}`}
                          onClick={() => verDetalle(doc)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Ver detalle"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          id={`btn-eliminar-doc-${doc.id}`}
                          onClick={() => handleEliminar(doc)}
                          disabled={eliminando === doc.id}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Eliminar"
                        >
                          {eliminando === doc.id
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <Trash2 className="w-4 h-4" />
                          }
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Detalle */}
      {docDetalle && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
          onClick={() => setDocDetalle(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera Modal */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 flex-shrink-0">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Detalle del Documento</h3>
                <p className="text-slate-500 text-xs mt-0.5 truncate max-w-md">{docDetalle.nombre_archivo}</p>
              </div>
              <button 
                onClick={() => setDocDetalle(null)} 
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido Modal con Scroll */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* Info básica */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5">
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Categoría IA</p>
                  <p className="text-slate-800 font-bold text-base flex items-center gap-1.5">
                    {CATEGORIA_ICON[docDetalle.categoria_detectada]} {docDetalle.categoria_detectada || '—'}
                  </p>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5">
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Confianza de Extracción</p>
                  <p className={`font-bold text-xl ${(docDetalle.score_confianza || 0) >= 80 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {docDetalle.score_confianza != null ? `${parseFloat(docDetalle.score_confianza).toFixed(1)}%` : '—'}
                  </p>
                </div>
              </div>

              {/* Resumen IA Completo */}
              {docDetalle.resumen_ia && (
                <div className="bg-gradient-to-br from-indigo-50/90 to-blue-50/60 border border-indigo-100 rounded-xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2 pb-2 border-b border-indigo-100/60">
                    <p className="text-xs text-indigo-700 font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <span>🤖</span> Resumen Inteligente de DocuMind
                    </p>
                    <span className="text-[11px] bg-indigo-100 text-indigo-800 font-medium px-2 py-0.5 rounded-full">
                      Análisis IA Completo
                    </span>
                  </div>
                  <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto pr-1">
                    {docDetalle.resumen_ia}
                  </div>
                </div>
              )}

              {/* Metadatos JSON */}
              {docDetalle.metadata_json && Object.keys(docDetalle.metadata_json).filter(k => docDetalle.metadata_json[k] != null).length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">Metadatos Estructurados Extraídos</p>
                  <div className="bg-slate-900 rounded-xl p-4 overflow-x-auto shadow-inner">
                    <pre className="text-emerald-400 text-xs font-mono leading-relaxed">
                      {JSON.stringify(
                        Object.fromEntries(
                          Object.entries(docDetalle.metadata_json).filter(([, v]) => v != null && v !== '' && !(Array.isArray(v) && v.length === 0))
                        ),
                        null, 2
                      )}
                    </pre>
                  </div>
                </div>
              )}

              {/* Ficha técnica */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
                <div className="bg-slate-50 p-2.5 rounded-lg"><span className="text-slate-400 block font-medium">Formato:</span> <span className="font-semibold text-slate-700 uppercase">{docDetalle.tipo_formato}</span></div>
                <div className="bg-slate-50 p-2.5 rounded-lg"><span className="text-slate-400 block font-medium">Tamaño:</span> <span className="font-semibold text-slate-700">{formatBytes(docDetalle.tamano_bytes ?? docDetalle.tamaño_bytes)}</span></div>
                <div className="bg-slate-50 p-2.5 rounded-lg"><span className="text-slate-400 block font-medium">Estado:</span> <span className="font-semibold text-emerald-600">{docDetalle.estado_procesamiento}</span></div>
                <div className="bg-slate-50 p-2.5 rounded-lg"><span className="text-slate-400 block font-medium">Cargado:</span> <span className="font-semibold text-slate-700">{formatFecha(docDetalle.creado_en)}</span></div>
              </div>

              {/* Visor de Documento embebido con URL de objeto temporal autenticada (sin credenciales en URL) */}
              {docDetalle.url_descarga && docDetalle.tipo_formato === 'PDF' && (
                <div className="mt-4 border border-slate-200 rounded-xl overflow-hidden h-[500px] flex items-center justify-center bg-slate-100">
                  {loadingPreview ? (
                    <div className="flex flex-col items-center gap-2 text-slate-500">
                      <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                      <span className="text-xs">Cargando vista previa protegida...</span>
                    </div>
                  ) : previewBlobUrl ? (
                    <iframe 
                      src={previewBlobUrl} 
                      className="w-full h-full bg-slate-100" 
                      title="Visor de Documento"
                    />
                  ) : (
                    <div className="text-xs text-rose-500">No fue posible previsualizar el documento de forma segura.</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Crear Repositorio */}
      {modalNuevoRepo && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                  <FolderPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">Crear Repositorio Documental</h3>
                  <p className="text-slate-500 text-xs">Carpeta lógica para almacenamiento e indexación RAG</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalNuevoRepo(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCrearRepoSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nombre del Repositorio *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Contratos Proveedores 2026"
                  value={formRepo.nombre}
                  onChange={(e) => setFormRepo({ ...formRepo, nombre: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Departamento / Área *
                </label>
                <select
                  value={formRepo.departamento}
                  onChange={(e) => setFormRepo({ ...formRepo, departamento: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
                >
                  <option value="Legal">Legal</option>
                  <option value="Financiero">Financiero</option>
                  <option value="Recursos Humanos">Recursos Humanos</option>
                  <option value="Soporte Técnico y Sistemas">Soporte Técnico y Sistemas</option>
                  <option value="Control de Calidad y Garantías">Control de Calidad y Garantías</option>
                  <option value="Operaciones">Operaciones</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Descripción (Opcional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Descripción del tipo de documentos que alojará este repositorio..."
                  value={formRepo.descripcion}
                  onChange={(e) => setFormRepo({ ...formRepo, descripcion: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalNuevoRepo(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoRepo || !formRepo.nombre.trim()}
                  className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-md transition-all"
                >
                  {guardandoRepo ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    'Crear Repositorio'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
