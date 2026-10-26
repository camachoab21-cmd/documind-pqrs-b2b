import React, { useState, useEffect } from 'react';
import {
  LifeBuoy,
  Send,
  Search,
  CheckCircle2,
  Clock,
  Sparkles,
  UploadCloud,
  FileText,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Key,
  Copy,
  Check,
  Lock,
  Download,
  Loader2,
} from 'lucide-react';
import axios from 'axios';

export default function PortalRadicacionPublica() {
  const [tab, setTab] = useState('radicar'); // 'radicar' | 'tracking'

  // Formulario radicación
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    telefono: '',
    tipo_solicitud: 'Petición',
    prioridad: 'Media',
    departamento: 'Atención al Cliente General',
    asunto: '',
    descripcion: '',
  });

  const [archivo, setArchivo] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [radicadoExitoso, setRadicadoExitoso] = useState(null);
  const [tokenCopiado, setTokenCopiado] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Formulario tracking
  const [ticketQuery, setTicketQuery] = useState('');
  const [tokenQuery, setTokenQuery] = useState('');
  const [buscandoTicket, setBuscandoTicket] = useState(false);
  const [ticketEncontrado, setTicketEncontrado] = useState(null);
  const [trackingError, setTrackingError] = useState('');

  // Lectura de clave privada desde fragmento URL (#token=...&id=...)
  useEffect(() => {
    try {
      const rawHash = window.location.hash ? window.location.hash.replace(/^#/, '') : '';
      if (!rawHash) return;

      const params = new URLSearchParams(rawHash);
      const token = params.get('token');
      const idFromHash = params.get('id');

      const searchParams = new URLSearchParams(window.location.search);
      const ticketId = idFromHash || searchParams.get('id');

      // Eliminar inmediatamente el fragmento hash de la barra de direcciones sin recargar la página
      if (window.history && window.history.replaceState) {
        const cleanUrl = window.location.pathname + (ticketId ? `?id=${encodeURIComponent(ticketId)}` : '');
        window.history.replaceState(null, '', cleanUrl);
      }

      if (token) {
        setTab('tracking');
        if (ticketId) {
          setTicketQuery(ticketId);
        }
        setTokenQuery(token);

        if (ticketId && token) {
          consultarTracking(ticketId, token);
        }
      }
    } catch (e) {
      // Manejo silencioso de error de parseo
    }
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRadicar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    setErrorMsg('');

    try {
      // 1. Si hay archivo, subirlo primero al backend para análisis IA
      let documentoId = null;
      let resumenIa = null;
      if (archivo) {
        const fileForm = new FormData();
        fileForm.append('file', archivo);
        fileForm.append('repositorio_id', 1);

        try {
          const uploadRes = await axios.post('/api/documents/upload', fileForm, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          documentoId = uploadRes.data?.documento?.id;
          resumenIa = uploadRes.data?.documento?.resumen_ia;
        } catch (uploadErr) {
          console.warn('Carga directa de archivo opcional:', uploadErr.message);
        }
      }

      // 2. Disparar webhook de radicación en n8n
      const webhookPayload = {
        request_id: crypto.randomUUID(),
        nombre: formData.nombre,
        email: formData.email,
        telefono: formData.telefono,
        tipo_solicitud: formData.tipo_solicitud,
        prioridad: formData.prioridad,
        departamento: formData.departamento,
        asunto: formData.asunto,
        descripcion: formData.descripcion + (resumenIa ? `\n\n[Resumen Documento Adjunto por IA]: ${resumenIa}` : ''),
        documento_id: documentoId,
      };

      const webhookUrl = 'http://localhost:5678/webhook/radicar-pqrs';
      const res = await axios.post(webhookUrl, webhookPayload, {
        headers: { 'Content-Type': 'application/json' },
      });

      const dataRespuesta = res.data?.respuesta || res.data || {};
      const ticketId = dataRespuesta.ticket_id || res.data?.ticket?.ticket_id || res.data?.ticket_id;
      const trackingToken = dataRespuesta.tracking_token || res.data?.ticket?.tracking_token || res.data?.tracking_token || null;
      const slaHoras = dataRespuesta.sla_horas || res.data?.ticket?.sla_horas || (formData.prioridad === 'Crítica' ? 2 : 24);

      setRadicadoExitoso({
        ticket_id: ticketId || `PQRS-2026-${Math.floor(100000 + Math.random() * 900000)}`,
        tracking_token: trackingToken,
        fecha_radicacion: new Date().toLocaleString(),
        sla_horas: slaHoras,
      });
    } catch (err) {
      console.error('Error al radicar:', err);
      setErrorMsg(err.response?.data?.mensaje || 'Error al conectar con el motor de radicación. Verifique que los servicios estén activos.');
    } finally {
      setEnviando(false);
    }
  };

  const consultarTracking = async (ticket, token) => {
    const cleanTicket = (ticket || '').trim();
    const cleanToken = (token || '').trim();
    if (!cleanTicket) return;

    setBuscandoTicket(true);
    setTrackingError('');
    setTicketEncontrado(null);

    try {
      if (cleanToken) {
        // Consulta privada al nuevo endpoint de Express con tracking_token
        const res = await axios.post(`/api/pqrs/${encodeURIComponent(cleanTicket)}/tracking`, {
          tracking_token: cleanToken,
        });
        setTicketEncontrado({
          ...res.data?.data,
          es_privado: true,
        });
      } else {
        // Consulta pública sanitizada al endpoint GET de Express
        const res = await axios.get(`/api/pqrs/${encodeURIComponent(cleanTicket)}`);
        setTicketEncontrado({
          ...res.data?.data,
          es_privado: false,
        });
      }
    } catch (err) {
      const status = err.response?.status;
      const mensaje = err.response?.data?.mensaje;
      if (status === 429) {
        setTrackingError(mensaje || 'Demasiados intentos fallidos. Intente nuevamente en 15 minutos.');
      } else if (cleanToken) {
        setTrackingError(mensaje || 'Radicado o clave privada de consulta incorrectos. Verifique los datos.');
      } else {
        setTrackingError(mensaje || 'No se encontró ningún radicado con el identificador ingresado.');
      }
    } finally {
      setBuscandoTicket(false);
    }
  };

  const handleConsultar = (e) => {
    e.preventDefault();
    consultarTracking(ticketQuery, tokenQuery);
  };

  const copiarClave = async () => {
    if (!radicadoExitoso?.tracking_token) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(radicadoExitoso.tracking_token);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = radicadoExitoso.tracking_token;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setTokenCopiado(true);
      setTimeout(() => setTokenCopiado(false), 3000);
    } catch (err) {
      console.warn('Error al copiar al portapapeles:', err);
    }
  };

  const irASeguimientoPrivado = () => {
    if (!radicadoExitoso) return;
    const { ticket_id, tracking_token } = radicadoExitoso;
    setTicketQuery(ticket_id);
    if (tracking_token) {
      setTokenQuery(tracking_token);
    }
    setTab('tracking');
    consultarTracking(ticket_id, tracking_token || '');
  };

  const [descargandoDocId, setDescargandoDocId] = useState(null);

  const handleDescargarDocCiudadano = async (doc) => {
    if (!tokenQuery || !ticketEncontrado?.ticket?.ticket_id) return;
    let objectUrl = null;
    try {
      setDescargandoDocId(doc.id);
      const ticketId = ticketEncontrado.ticket.ticket_id;
      const res = await fetch(`/api/pqrs/${encodeURIComponent(ticketId)}/documentos/${doc.id}`, {
        method: 'GET',
        headers: {
          'x-tracking-token': tokenQuery.trim(),
        },
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.mensaje || 'Error al descargar el archivo.');
      }

      const blob = await res.blob();
      objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = doc.nombre_archivo || 'documento_radicado';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      alert(err.message || 'Error al descargar el archivo.');
    } finally {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      setDescargandoDocId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white">
      {/* Navbar Superior */}
      <header className="border-b border-white/10 backdrop-blur-md bg-slate-950/80 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-400 p-0.5 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <LifeBuoy className="w-5 h-5 text-cyan-400" />
              </div>
            </div>
            <div>
              <h1 className="font-bold text-base tracking-tight text-white flex items-center gap-2">
                DocuMind <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 font-mono">PQRS</span>
              </h1>
              <p className="text-[11px] text-slate-400">Portal de Radicación y Seguimiento Ciudadano</p>
            </div>
          </div>

          <div className="flex bg-slate-900 border border-white/10 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setTab('radicar')}
              className={`px-4 py-1.5 rounded-lg transition-all ${
                tab === 'radicar' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              Radicar Solicitud
            </button>
            <button
              onClick={() => setTab('tracking')}
              className={`px-4 py-1.5 rounded-lg transition-all ${
                tab === 'tracking' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              Consultar Estado
            </button>
          </div>
        </div>
      </header>

      {/* Contenido Central */}
      <main className="max-w-4xl mx-auto px-6 py-12 flex-1 w-full">
        {tab === 'radicar' ? (
          radicadoExitoso ? (
            <div className="bg-slate-900/90 border border-emerald-500/30 rounded-2xl p-8 max-w-xl mx-auto text-center space-y-6 shadow-2xl shadow-emerald-500/10 animate-fade-in">
              <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>

              <div>
                <span className="text-xs font-mono font-semibold text-emerald-400 uppercase tracking-widest bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-800">
                  Radicado Exitoso
                </span>
                <h2 className="text-2xl font-bold text-white mt-3 font-mono">
                  {radicadoExitoso.ticket_id}
                </h2>
                <p className="text-xs text-slate-400 mt-2 max-w-sm mx-auto">
                  Guarde este número de radicado y su clave privada. Recibirá notificaciones oficiales en su correo electrónico.
                </p>
              </div>

              {/* Clave Privada de Consulta y Advertencia de Seguridad */}
              {radicadoExitoso.tracking_token && (
                <div className="bg-slate-950/80 border border-cyan-500/40 rounded-xl p-4 text-left space-y-3 shadow-inner">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-cyan-400 flex items-center gap-1.5 uppercase tracking-wider font-mono">
                      <Key className="w-3.5 h-3.5 text-cyan-400" />
                      Clave Privada de Consulta
                    </span>
                    <button
                      type="button"
                      onClick={copiarClave}
                      className="px-2.5 py-1 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-700/60 text-cyan-300 text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {tokenCopiado ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400 font-semibold">Copiada</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Copiar Clave</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="p-2.5 bg-slate-900 rounded-lg border border-white/5 font-mono text-xs text-slate-200 select-all break-all tracking-wide">
                    {radicadoExitoso.tracking_token}
                  </div>
                  <div className="flex items-start gap-2.5 text-[11px] text-amber-300/90 bg-amber-950/40 border border-amber-800/40 rounded-lg p-2.5">
                    <ShieldAlert className="w-4 h-4 flex-shrink-0 text-amber-400 mt-0.5" />
                    <span className="leading-relaxed">
                      <strong>Advertencia de Seguridad:</strong> Conserve esta clave en un lugar seguro. Es su credencial para desbloquear la descripción completa y respuestas oficiales. DocuMind no permite recuperar claves privadas extraviadas.
                    </span>
                  </div>
                </div>
              )}

              <div className="bg-slate-950/60 p-4 rounded-xl border border-white/5 text-left text-xs space-y-2 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500">Tiempo estimado SLA:</span>
                  <span className="text-cyan-400 font-bold">{radicadoExitoso.sla_horas} Horas</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Fecha de radicación:</span>
                  <span className="text-slate-300">{radicadoExitoso.fecha_radicacion}</span>
                </div>
              </div>

              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => {
                    setRadicadoExitoso(null);
                    setFormData({
                      nombre: '',
                      email: '',
                      telefono: '',
                      tipo_solicitud: 'Petición',
                      prioridad: 'Media',
                      departamento: 'Atención al Cliente General',
                      asunto: '',
                      descripcion: '',
                    });
                    setArchivo(null);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 text-slate-200 font-semibold text-xs hover:bg-slate-700 transition-colors"
                >
                  Radicar otra solicitud
                </button>
                <button
                  onClick={irASeguimientoPrivado}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 text-white font-semibold text-xs hover:from-indigo-500 hover:to-cyan-400 shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Ver seguimiento privado
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="text-center max-w-xl mx-auto space-y-3">
                <span className="text-xs font-semibold uppercase tracking-widest text-cyan-400 bg-cyan-950/40 border border-cyan-800 px-3 py-1 rounded-full">
                  Plataforma Empresarial
                </span>
                <h2 className="text-3xl font-extrabold text-white tracking-tight">
                  Radicación de Peticiones, Quejas y Reclamos
                </h2>
                <p className="text-sm text-slate-400">
                  Diligencia el formulario. Nuestro motor de IA analizará y clasificará tu solicitud con asignación automática a los especialistas de área.
                </p>
              </div>

              <form onSubmit={handleRadicar} className="bg-slate-900/60 border border-white/10 rounded-2xl p-8 backdrop-blur-xl space-y-6 shadow-2xl">
                {errorMsg && (
                  <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-800/50 text-rose-300 text-xs flex items-center gap-3">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Nombre Completo *</label>
                    <input
                      type="text"
                      name="nombre"
                      required
                      placeholder="Ej: Juan Pérez"
                      value={formData.nombre}
                      onChange={handleChange}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Correo Electrónico *</label>
                    <input
                      type="email"
                      name="email"
                      required
                      placeholder="juan@empresa.com"
                      value={formData.email}
                      onChange={handleChange}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Teléfono / WhatsApp</label>
                    <input
                      type="tel"
                      name="telefono"
                      placeholder="+57 300 123 4567"
                      value={formData.telefono}
                      onChange={handleChange}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Tipo de Requerimiento *</label>
                    <select
                      name="tipo_solicitud"
                      value={formData.tipo_solicitud}
                      onChange={handleChange}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                    >
                      <option value="Petición">Petición (Información o Trámite)</option>
                      <option value="Queja">Queja (Inconformidad con la atención)</option>
                      <option value="Reclamo">Reclamo (Problema de producto o factura)</option>
                      <option value="Soporte Técnico">Soporte Técnico (Falla de sistema o servicio)</option>
                      <option value="Sugerencia">Sugerencia</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Asunto del Requerimiento *</label>
                  <input
                    type="text"
                    name="asunto"
                    required
                    placeholder="Resumen breve del motivo de su contacto"
                    value={formData.asunto}
                    onChange={handleChange}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Descripción Detallada *</label>
                  <textarea
                    name="descripcion"
                    required
                    rows={4}
                    placeholder="Explique con claridad los hechos, fechas, números de contrato o factura asociados..."
                    value={formData.descripcion}
                    onChange={handleChange}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                  />
                </div>

                {/* Adjuntar Archivo con análisis IA */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                    <span>Adjuntar Evidencia o Documento (Opcional)</span>
                    <span className="text-[11px] text-cyan-400 font-normal flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Análisis Automático con DocuMind RAG
                    </span>
                  </label>
                  <div className="border-2 border-dashed border-white/10 hover:border-indigo-500/50 rounded-2xl p-6 text-center transition-colors bg-slate-950/40">
                    <input
                      type="file"
                      id="file-upload"
                      className="hidden"
                      accept=".pdf,.docx,.txt"
                      onChange={(e) => setArchivo(e.target.files[0] || null)}
                    />
                    <label htmlFor="file-upload" className="cursor-pointer space-y-2 block">
                      <UploadCloud className="w-8 h-8 text-indigo-400 mx-auto" />
                      {archivo ? (
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-indigo-300">{archivo.name}</p>
                          <p className="text-xs text-slate-500">{(archivo.size / 1024).toFixed(1)} KB - Clic para cambiar</p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-xs font-medium text-slate-300">
                            Arrastre o haga clic para adjuntar su factura, contrato o constancia
                          </p>
                          <p className="text-[11px] text-slate-500 mt-1">Soporta PDF, DOCX, TXT hasta 15 MB</p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={enviando}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white font-bold text-sm shadow-xl shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {enviando ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Procesando Solicitud con IA...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Radicar Solicitud Oficial</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )
        ) : (
          /* Pestaña de Tracking */
          <div className="space-y-8 max-w-xl mx-auto">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-white tracking-tight">
                Consulta y Trazabilidad de Radicados
              </h2>
              <p className="text-xs text-slate-400">
                Consulte el avance público de su solicitud o ingrese su clave privada para acceder al expediente completo.
              </p>
            </div>

            <form onSubmit={handleConsultar} className="space-y-4 bg-slate-900/60 border border-white/10 rounded-2xl p-6 shadow-xl backdrop-blur-xl">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Número de Radicado *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: PQRS-2026-000001"
                  value={ticketQuery}
                  onChange={(e) => setTicketQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-indigo-500 uppercase"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-cyan-400">
                    <Key className="w-3.5 h-3.5" />
                    Clave Privada de Consulta (Opcional)
                  </span>
                  <span className="text-[11px] text-slate-400">UUID entregado al radicar</span>
                </label>
                <input
                  type="text"
                  placeholder="Ej: a0000000-0000-0000-0000-000000000001"
                  value={tokenQuery}
                  onChange={(e) => setTokenQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-cyan-500"
                />
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Ingrese la clave privada para visualizar la descripción íntegra y respuestas de gestión. Si la omite, obtendrá una consulta pública con datos protegidos.
                </p>
              </div>

              <button
                type="submit"
                disabled={buscandoTicket}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 disabled:opacity-50 cursor-pointer"
              >
                {buscandoTicket ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Verificando y consultando...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>Consultar Estado</span>
                  </>
                )}
              </button>
            </form>

            {trackingError && (
              <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/40 text-rose-300 text-xs flex items-center gap-2.5 animate-fade-in">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
                <span>{trackingError}</span>
              </div>
            )}

            {ticketEncontrado && (
              <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-6 space-y-5 animate-fade-in shadow-2xl">
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-cyan-400 bg-cyan-950/60 px-2.5 py-1 rounded-md border border-cyan-800">
                        {ticketEncontrado.ticket.ticket_id}
                      </span>
                      {ticketEncontrado.es_privado ? (
                        <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2 py-0.5 rounded-full flex items-center gap-1 font-mono">
                          <ShieldCheck className="w-3 h-3 text-emerald-400" />
                          Expediente Privado
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold text-amber-400 bg-amber-950/60 border border-amber-800/80 px-2 py-0.5 rounded-full flex items-center gap-1 font-mono">
                          <Lock className="w-3 h-3 text-amber-400" />
                          Vista Pública
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-white mt-2">
                      {ticketEncontrado.ticket.asunto}
                    </h3>
                  </div>
                  <span className="text-xs px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold">
                    {ticketEncontrado.ticket.estado}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                  <div>
                    <p className="text-slate-500">Solicitante:</p>
                    <p className="text-slate-200">{ticketEncontrado.ticket.nombre_solicitante}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Área Responsable:</p>
                    <p className="text-slate-200">{ticketEncontrado.ticket.departamento}</p>
                  </div>
                  {ticketEncontrado.ticket.tipo && (
                    <div>
                      <p className="text-slate-500">Tipo / Prioridad:</p>
                      <p className="text-slate-200">{ticketEncontrado.ticket.tipo} ({ticketEncontrado.ticket.prioridad || 'Media'})</p>
                    </div>
                  )}
                  {ticketEncontrado.ticket.sla_horas && (
                    <div>
                      <p className="text-slate-500">Plazo SLA:</p>
                      <p className="text-cyan-400">{ticketEncontrado.ticket.sla_horas} Horas</p>
                    </div>
                  )}
                </div>

                {/* Si es vista privada, mostrar descripción íntegra del caso */}
                {ticketEncontrado.es_privado && ticketEncontrado.ticket.descripcion ? (
                  <div className="space-y-1.5 p-3.5 bg-slate-950/60 rounded-xl border border-white/5">
                    <p className="text-xs font-semibold text-slate-400 flex items-center gap-1.5 uppercase font-mono">
                      <FileText className="w-3.5 h-3.5 text-indigo-400" />
                      Descripción Completa de la Solicitud
                    </p>
                    <p className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
                      {ticketEncontrado.ticket.descripcion}
                    </p>
                  </div>
                ) : (
                  !ticketEncontrado.es_privado ? (
                    <div className="p-3 bg-slate-950/40 rounded-xl border border-white/5 text-[11px] text-slate-400 flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                      <span>
                        La descripción y datos privados están protegidos. Ingrese su clave privada para acceder al expediente completo.
                      </span>
                    </div>
                  ) : null
                )}

                {/* Adjuntos y Evidencias Autorizadas del Radicado */}
                {ticketEncontrado.es_privado && ticketEncontrado.documentos && ticketEncontrado.documentos.length > 0 && (
                  <div className="space-y-2 p-3.5 bg-slate-950/60 rounded-xl border border-white/5">
                    <p className="text-xs font-semibold text-slate-400 flex items-center gap-1.5 uppercase font-mono">
                      <FileText className="w-3.5 h-3.5 text-indigo-400" />
                      Documentos y Evidencias Adjuntas ({ticketEncontrado.documentos.length})
                    </p>
                    <div className="space-y-2 pt-1">
                      {ticketEncontrado.documentos.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between p-2.5 bg-slate-900/90 rounded-lg border border-white/5 text-xs"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <FileText className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                            <span className="text-slate-200 truncate font-mono text-[11px]">{doc.nombre_archivo}</span>
                            <span className="text-slate-500 text-[10px] uppercase font-mono">({doc.tipo_formato})</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDescargarDocCiudadano(doc)}
                            disabled={descargandoDocId === doc.id}
                            className="flex items-center gap-1 px-3 py-1 bg-indigo-600/40 hover:bg-indigo-600/60 text-indigo-300 rounded-md border border-indigo-500/30 transition-all font-medium text-[11px] disabled:opacity-50 cursor-pointer"
                          >
                            {descargandoDocId === doc.id ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin text-indigo-300" />
                                <span>Descargando...</span>
                              </>
                            ) : (
                              <>
                                <Download className="w-3 h-3 text-indigo-300" />
                                <span>Descargar</span>
                              </>
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Timeline de atención */}
                <div className="space-y-3 pt-3 border-t border-white/5">
                  <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    Historial de Atención Oficial
                  </h4>
                  <div className="space-y-2 border-l border-white/10 pl-4 ml-1">
                    {ticketEncontrado.timeline
                      ?.filter((t) => !t.es_nota_interna)
                      .map((act) => (
                        <div key={act.id || act.created_at} className="text-xs space-y-1">
                          <p className="font-medium text-cyan-400">
                            {act.autor_nombre} {act.estado_nuevo ? `(${act.estado_nuevo})` : ''}
                          </p>
                          <p className="text-slate-300 bg-slate-950/60 p-2.5 rounded-lg border border-white/5">
                            {act.mensaje}
                          </p>
                        </div>
                      ))}
                    {(!ticketEncontrado.timeline || ticketEncontrado.timeline.length === 0) && (
                      <p className="text-xs text-slate-500 italic">No hay actividades públicas registradas todavía.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-6 text-center text-xs text-slate-500">
        <p>DocuMind Enterprise © 2026 — Plataforma Integral de Automatización e IA Documental</p>
      </footer>
    </div>
  );
}
