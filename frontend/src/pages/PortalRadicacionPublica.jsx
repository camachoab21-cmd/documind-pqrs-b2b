import React, { useState } from 'react';
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
  const [errorMsg, setErrorMsg] = useState('');

  // Formulario tracking
  const [ticketQuery, setTicketQuery] = useState('');
  const [buscandoTicket, setBuscandoTicket] = useState(false);
  const [ticketEncontrado, setTicketEncontrado] = useState(null);
  const [trackingError, setTrackingError] = useState('');

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

      setRadicadoExitoso(res.data?.ticket || {
        ticket_id: res.data?.ticket_id || `PQRS-2026-${Math.floor(100000 + Math.random() * 900000)}`,
        fecha_radicacion: new Date().toLocaleString(),
        sla_horas: formData.prioridad === 'Crítica' ? 2 : 24,
      });
    } catch (err) {
      console.error('Error al radicar:', err);
      setErrorMsg(err.response?.data?.mensaje || 'Error al conectar con el motor de radicación. Verifique que los servicios estén activos.');
    } finally {
      setEnviando(false);
    }
  };

  const handleConsultar = async (e) => {
    e.preventDefault();
    if (!ticketQuery.trim()) return;

    setBuscandoTicket(true);
    setTrackingError('');
    setTicketEncontrado(null);

    try {
      const res = await axios.get(`/api/pqrs/${ticketQuery.trim()}`);
      setTicketEncontrado(res.data?.data);
    } catch (err) {
      setTrackingError('No se encontró ningún radicado con el identificador ingresado.');
    } finally {
      setBuscandoTicket(false);
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
                  Guarda este número de radicado. Recibirás actualizaciones en tu correo electrónico.
                </p>
              </div>

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
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-xs hover:bg-indigo-500 transition-colors"
                >
                  Radicar otra solicitud
                </button>
                <button
                  onClick={() => {
                    setTicketQuery(radicadoExitoso.ticket_id);
                    setTab('tracking');
                  }}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 text-slate-200 font-semibold text-xs hover:bg-slate-700 transition-colors"
                >
                  Ver seguimiento en vivo
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
                Ingrese el identificador oficial de su ticket para conocer el avance de la gestión y las respuestas emitidas.
              </p>
            </div>

            <form onSubmit={handleConsultar} className="flex gap-2">
              <input
                type="text"
                placeholder="Ej: PQRS-2026-000001"
                value={ticketQuery}
                onChange={(e) => setTicketQuery(e.target.value)}
                className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={buscandoTicket}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-2"
              >
                <Search className="w-4 h-4" />
                Buscar
              </button>
            </form>

            {trackingError && (
              <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/40 text-rose-300 text-xs">
                {trackingError}
              </div>
            )}

            {ticketEncontrado && (
              <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-6 space-y-5 animate-fade-in">
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                  <div>
                    <span className="font-mono text-xs font-bold text-cyan-400 bg-cyan-950/60 px-2.5 py-1 rounded-md border border-cyan-800">
                      {ticketEncontrado.ticket.ticket_id}
                    </span>
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
                </div>

                {/* Timeline público */}
                <div className="space-y-3 pt-3 border-t border-white/5">
                  <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    Historial de Atención
                  </h4>
                  <div className="space-y-2 border-l border-white/10 pl-4 ml-1">
                    {ticketEncontrado.timeline
                      ?.filter((t) => !t.es_nota_interna)
                      .map((act) => (
                        <div key={act.id} className="text-xs space-y-1">
                          <p className="font-medium text-cyan-400">{act.autor_nombre} ({act.estado_nuevo})</p>
                          <p className="text-slate-300 bg-slate-950/60 p-2.5 rounded-lg border border-white/5">{act.mensaje}</p>
                        </div>
                      ))}
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
