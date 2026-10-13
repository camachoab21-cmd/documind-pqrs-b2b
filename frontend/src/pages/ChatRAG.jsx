import React, { useState, useRef, useEffect } from 'react';
import { Send, FileText, Bot, User, Loader2, MessageSquare, Trash2, AlertCircle, Filter, Plus, MessageCircle, Eye, X } from 'lucide-react';
import { chatAPI, repositoriesAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

function TypingIndicator() {
  return (
    <div className="flex items-start justify-start gap-3 animate-fade-in">
      <div className="bg-indigo-50 p-2 rounded-full border border-indigo-100">
        <Bot className="text-indigo-600 w-5 h-5" />
      </div>
      <div className="bg-white border border-slate-100 p-4 rounded-2xl rounded-tl-none shadow-sm">
        <p className="text-xs font-bold text-indigo-700 mb-2">🤖 DocuMind Gemini Engine</p>
        <div className="flex items-center gap-1.5">
          <div className="typing-dot" style={{ animationDelay: '0ms' }} />
          <div className="typing-dot" style={{ animationDelay: '150ms' }} />
          <div className="typing-dot" style={{ animationDelay: '300ms' }} />
          <span className="text-xs text-slate-400 ml-1">Consultando documentos...</span>
        </div>
      </div>
    </div>
  );
}

function MensajeUsuario({ texto, nombre }) {
  return (
    <div className="flex items-start justify-end gap-3 animate-slide-right">
      <div className="bg-indigo-600 text-white p-4 rounded-2xl rounded-tr-none shadow-sm max-w-xl">
        <p className="font-semibold mb-1 text-indigo-200 text-xs">{nombre} (Analista)</p>
        <p className="text-sm leading-relaxed">{texto}</p>
      </div>
      <div className="bg-indigo-100 p-2 rounded-full flex-shrink-0">
        <User className="text-indigo-600 w-5 h-5" />
      </div>
    </div>
  );
}

function MensajeIA({ respuesta, fuentes, onViewDoc }) {
  return (
    <div className="flex items-start justify-start gap-3 animate-slide-left">
      <div className="bg-indigo-50/50 p-2 rounded-full border border-indigo-100 flex-shrink-0">
        <Bot className="text-indigo-600 w-5 h-5" />
      </div>
      <div className="bg-white border border-slate-100 p-5 rounded-2xl rounded-tl-none shadow-sm max-w-2xl w-full">
        <p className="font-bold text-indigo-700 mb-3 text-xs">🤖 DocuMind Gemini Engine</p>
        <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
          {respuesta}
        </div>

        {/* Caja de citación obligatoria */}
        {fuentes && fuentes.length > 0 && (
          <div className="mt-4 p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl">
            <div className="flex items-center gap-1.5 mb-2">
              <FileText className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
              <span className="text-xs font-semibold text-indigo-700">Fuentes Citadas</span>
            </div>
            <div className="space-y-1">
              {fuentes.map((f, i) => (
                <div key={i} className="flex items-center justify-between text-xs text-indigo-600 group">
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full flex-shrink-0" />
                    <span className="italic truncate" title={f.nombre_archivo}>
                      {f.nombre_archivo} (Pág {f.pagina})
                    </span>
                    {f.score && (
                      <span className="text-indigo-300 font-mono text-[10px]">
                        {(f.score * 100).toFixed(0)}% relevancia
                      </span>
                    )}
                  </div>
                  {f.url_descarga && (
                    <button 
                      onClick={() => onViewDoc(f.url_descarga, f.nombre_archivo)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-indigo-100 rounded transition-opacity"
                      title="Ver Documento Original"
                    >
                      <Eye className="w-3.5 h-3.5 text-indigo-600" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const MENSAJE_BIENVENIDA = {
  tipo: 'ia',
  respuesta: `¡Hola! Soy **DocuMind**, tu asistente conversacional de documentos empresariales. 🤖\n\nPuedo responder preguntas basadas en los documentos indexados en tus repositorios. Prueba preguntarme:\n\n• ⚖️ ¿Qué penalizaciones tiene el contrato de servicios oriente?\n• 💵 ¿Cuál es el valor total y fecha de pago de la factura de ESSA?\n• 👥 ¿Qué tecnologías domina Carlos Mendoza y cuántos años de experiencia tiene?\n\n*Nota: Respondo con información exacta y trazable citando las fuentes documentales.*`,
  fuentes: [],
};

export default function ChatRAG({ selectedRepo }) {
  const { user } = useAuth();
  const [mensajes, setMensajes] = useState([MENSAJE_BIENVENIDA]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [repositorios, setRepositorios] = useState([]);
  const [filtroRepoId, setFiltroRepoId] = useState(selectedRepo ? String(selectedRepo.id) : '');
  
  // Hilos de chat
  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [loadingThreads, setLoadingThreads] = useState(false);
  
  // Visor de documentos
  const [docViewerUrl, setDocViewerUrl] = useState(null);
  const [docViewerTitle, setDocViewerTitle] = useState('');

  const chatEndRef = useRef(null);

  useEffect(() => {
    const fetchRepos = async () => {
      try {
        const res = await repositoriesAPI.list();
        setRepositorios(res.data.repositorios || []);
      } catch {}
    };
    fetchRepos();
  }, [user?.id]);

  useEffect(() => {
    if (selectedRepo) {
      setFiltroRepoId(String(selectedRepo.id));
    }
  }, [selectedRepo]);

  // Cargar threads
  useEffect(() => {
    const fetchThreads = async () => {
      try {
        setLoadingThreads(true);
        const res = await chatAPI.getThreads(filtroRepoId ? parseInt(filtroRepoId) : null);
        setThreads(res.data.threads || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingThreads(false);
      }
    };
    fetchThreads();
  }, [filtroRepoId, user?.id]);

  // Cargar mensajes del thread activo
  useEffect(() => {
    const fetchMessages = async () => {
      if (!activeThreadId) {
        setMensajes([MENSAJE_BIENVENIDA]);
        return;
      }
      try {
        setLoading(true);
        const res = await chatAPI.getMessages(activeThreadId);
        const msgs = res.data.messages.map(m => ({
          tipo: m.rol === 'user' ? 'usuario' : 'ia',
          texto: m.rol === 'user' ? m.contenido : undefined,
          respuesta: m.rol === 'ia' ? m.contenido : undefined,
          fuentes: m.fuentes
        }));
        setMensajes(msgs.length ? msgs : [MENSAJE_BIENVENIDA]);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchMessages();
  }, [activeThreadId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes, loading]);

  const createThread = async (queryText) => {
    try {
      const title = queryText.length > 30 ? queryText.substring(0, 30) + '...' : queryText;
      const res = await chatAPI.createThread(title, filtroRepoId ? parseInt(filtroRepoId) : null);
      const newThread = res.data.thread;
      setThreads(prev => [newThread, ...prev]);
      setActiveThreadId(newThread.id);
      return newThread.id;
    } catch (err) {
      console.error('Error al crear thread', err);
      return null;
    }
  };

  const handleSend = async (overrideQuery = null) => {
    const query = overrideQuery || inputText.trim();
    if (!query || loading) return;

    setInputText('');
    setError('');

    setMensajes((prev) => [...prev, { tipo: 'usuario', texto: query }]);
    setLoading(true);

    let currentThreadId = activeThreadId;
    if (!currentThreadId) {
      currentThreadId = await createThread(query);
    }

    try {
      const res = await chatAPI.query(query, filtroRepoId ? parseInt(filtroRepoId) : null, currentThreadId);
      const { respuesta, fuentes_citadas } = res.data;

      setMensajes((prev) => [...prev, { tipo: 'ia', respuesta, fuentes: fuentes_citadas }]);
    } catch (err) {
      const msg = err.response?.data?.mensaje || 'Error en el motor RAG. Intenta nuevamente.';
      setError(msg);
      setMensajes((prev) => [
        ...prev,
        {
          tipo: 'ia',
          respuesta: `⚠️ ${msg}`,
          fuentes: [],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const limpiarChat = () => {
    setActiveThreadId(null);
    setMensajes([MENSAJE_BIENVENIDA]);
    setError('');
  };

  const handleDeleteThread = async (e, threadId) => {
    e.stopPropagation();
    if (!window.confirm('¿Eliminar esta conversación?')) return;
    try {
      await chatAPI.deleteThread(threadId);
      setThreads(prev => prev.filter(t => t.id !== threadId));
      if (activeThreadId === threadId) limpiarChat();
    } catch (err) {
      console.error('Error al eliminar hilo', err);
    }
  };

  const preguntasRapidas = [
    'Hola, ¿qué puedes hacer por mí?',
    '¿Cuáles son las penalizaciones del contrato de servicios oriente?',
    '¿Cuál es el valor y fecha de vencimiento de la factura ESSA?',
    '¿Qué candidato tiene experiencia en React y cuántos años?',
  ];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50">
      
      {/* Sidebar Historial */}
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col hidden md:flex flex-shrink-0">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-700">Historial de Chat</h2>
          <button 
            onClick={limpiarChat}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
            title="Nuevo Chat"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loadingThreads ? (
            <div className="flex justify-center p-4"><Loader2 className="w-4 h-4 animate-spin text-slate-300" /></div>
          ) : threads.length === 0 ? (
            <p className="text-xs text-slate-400 text-center p-4">No hay conversaciones previas</p>
          ) : (
            threads.map(t => (
              <div
                key={t.id}
                className={`w-full text-left p-2.5 rounded-lg text-xs flex items-center gap-2 transition-colors group cursor-pointer ${activeThreadId === t.id ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-600'}`}
                onClick={() => setActiveThreadId(t.id)}
              >
                <MessageCircle className={`w-3.5 h-3.5 flex-shrink-0 ${activeThreadId === t.id ? 'text-indigo-500' : 'text-slate-400'}`} />
                <span className={`truncate flex-1 ${activeThreadId === t.id ? 'font-semibold' : ''}`}>{t.titulo}</span>
                <button
                  onClick={(e) => handleDeleteThread(e, t.id)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-rose-100 hover:text-rose-600 text-slate-400 rounded transition-all flex-shrink-0"
                  title="Eliminar conversación"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div id="pantalla-chat" className="flex flex-col flex-1 h-screen">
        {/* Header del chat */}
        <div className="bg-white border-b border-slate-100 px-8 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <span>💬</span> Chat Conversacional RAG Inteligente
            </h1>
            <p className="text-slate-400 text-sm mt-0.5">
              Consultas en lenguaje natural con citas y trazabilidad documental
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Selector de Repositorio en Chat */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700">
              <Filter className="w-3.5 h-3.5 text-indigo-500" />
              <select
                value={filtroRepoId}
                onChange={(e) => setFiltroRepoId(e.target.value)}
                className="bg-transparent border-none outline-none text-xs font-medium text-slate-700 cursor-pointer"
              >
                <option value="">🌐 Todos los Repositorios</option>
                {repositorios.map((r) => (
                  <option key={r.id} value={r.id}>
                    📁 {r.nombre} ({r.departamento})
                  </option>
                ))}
              </select>
            </div>

            <button
              id="btn-limpiar-chat"
              onClick={limpiarChat}
              className="flex items-center gap-1.5 text-slate-400 hover:text-rose-500 text-xs font-medium transition-colors px-3 py-1.5 rounded-lg hover:bg-rose-50 border border-transparent hover:border-rose-100"
              title="Limpiar conversación"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Limpiar
            </button>
          </div>
        </div>

        {/* Área de mensajes */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
          {mensajes.map((msg, i) =>
            msg.tipo === 'usuario' ? (
              <MensajeUsuario key={i} texto={msg.texto} nombre={user?.nombre || 'Usuario'} />
            ) : (
              <MensajeIA 
                key={i} 
                respuesta={msg.respuesta} 
                fuentes={msg.fuentes} 
                onViewDoc={(url, title) => {
                  console.log('[DocViewer] url_descarga recibida:', url, '| archivo:', title);
                  setDocViewerUrl(url);
                  setDocViewerTitle(title);
                }} 
              />
            )
          )}
          {loading && <TypingIndicator />}
          <div ref={chatEndRef} />
        </div>

        {/* Sugerencias rápidas (cuando hay pocos mensajes) */}
        {mensajes.length <= 1 && !loading && (
          <div className="px-8 pb-4 flex-shrink-0">
            <div className="flex gap-2 flex-wrap">
              {preguntasRapidas.map((p, i) => (
                <button
                  key={i}
                  id={`sugerencia-${i}`}
                  onClick={() => {
                    handleSend(p);
                  }}
                  className="text-xs text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 px-3.5 py-2 rounded-full transition-all hover:scale-[1.02] shadow-sm text-left"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input de envío */}
        <div className="bg-white border-t border-slate-100 px-8 py-4 flex-shrink-0">
          {error && (
            <div className="mb-3 flex items-center gap-2 text-xs text-rose-600 bg-rose-50 border border-rose-100 px-3 py-2 rounded-lg">
              <AlertCircle className="w-3.5 h-3.5" />
              {error}
            </div>
          )}
          <div className="flex gap-3 bg-slate-50 border border-slate-200 rounded-2xl p-2 focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
            <div className="flex items-center pl-2 text-slate-400">
              <MessageSquare className="w-4 h-4" />
            </div>
            <textarea
              id="input-chat-query"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escriba su consulta aquí (ej: '¿Cuáles son las cláusulas penales del contrato?' o 'Hola')..."
              rows={1}
              disabled={loading}
              className="flex-1 bg-transparent resize-none border-none outline-none text-sm text-slate-700 placeholder-slate-400 py-1.5"
            />
            <button
              id="btn-enviar-chat"
              onClick={() => handleSend()}
              disabled={!inputText.trim() || loading}
              className="btn-primary p-2.5 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
              title="Enviar mensaje (Enter)"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-center text-[11px] text-slate-400 mt-2">
            Presione <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px]">Enter</kbd> para enviar · <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px]">Shift + Enter</kbd> para salto de línea
          </p>
        </div>
      </div>

      {/* Modal Visor Documento */}
      {docViewerUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80" onClick={() => setDocViewerUrl(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-500" />
                {docViewerTitle}
              </h3>
              <button onClick={() => setDocViewerUrl(null)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden bg-slate-100">
              <iframe src={`http://localhost:5000${docViewerUrl}`} className="w-full h-full border-none" title="Visor" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
