import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LifeBuoy,
  Search,
  Filter,
  RefreshCw,
  Clock,
  AlertTriangle,
  CheckCircle,
  FileText,
  MessageSquare,
  ChevronRight,
  X,
  Send,
  Sparkles,
  ShieldAlert,
  FolderOpen,
} from 'lucide-react';
import { pqrsAPI } from '../services/api';

const ESTADO_BADGES = {
  NUEVO: 'bg-blue-100 text-blue-800 border-blue-200',
  ASIGNADO: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  EN_GESTION: 'bg-amber-100 text-amber-800 border-amber-200',
  ESPERANDO_CLIENTE: 'bg-purple-100 text-purple-800 border-purple-200',
  RESUELTO: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  CERRADO: 'bg-slate-100 text-slate-800 border-slate-200',
};

const PRIORIDAD_BADGES = {
  CRITICA: 'bg-red-500 text-white font-bold',
  ALTA: 'bg-orange-500 text-white font-semibold',
  MEDIA: 'bg-blue-500 text-white',
  BAJA: 'bg-slate-400 text-white',
};

export default function GestionPqrs() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [ticketDetalle, setTicketDetalle] = useState(null);
  const [loadingDetalle, setLoadingDetalle] = useState(false);

  // Filtros
  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroPrioridad, setFiltroPrioridad] = useState('');
  const [filtroDepto, setFiltroDepto] = useState('');

  // Formulario actualización
  const [nuevoEstado, setNuevoEstado] = useState('');
  const [notaInterna, setNotaInterna] = useState('');
  const [actualizando, setActualizando] = useState(false);

  const cargarDatos = useCallback(async () => {
    try {
      setLoading(true);
      const [ticketsRes, kpisRes] = await Promise.all([
        pqrsAPI.list({
          search: search || undefined,
          estado: filtroEstado || undefined,
          prioridad: filtroPrioridad || undefined,
          departamento: filtroDepto || undefined,
        }),
        pqrsAPI.getKpis(),
      ]);

      setTickets(ticketsRes.data.data || []);
      setKpis(kpisRes.data.data?.resumen || null);
    } catch (err) {
      console.error('Error al cargar PQRS:', err);
    } finally {
      setLoading(false);
    }
  }, [search, filtroEstado, filtroPrioridad, filtroDepto]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const abrirDetalle = async (ticket) => {
    setSelectedTicket(ticket);
    setNuevoEstado(ticket.estado);
    setNotaInterna('');
    try {
      setLoadingDetalle(true);
      const res = await pqrsAPI.getById(ticket.ticket_id);
      setTicketDetalle(res.data.data);
    } catch (err) {
      console.error('Error al cargar detalle:', err);
    } finally {
      setLoadingDetalle(false);
    }
  };

  const handleActualizarEstado = async (e) => {
    e.preventDefault();
    if (!selectedTicket || !nuevoEstado) return;

    try {
      setActualizando(true);
      await pqrsAPI.updateStatus(selectedTicket.ticket_id, {
        nuevo_estado: nuevoEstado,
        nota: notaInterna || `Estado actualizado a ${nuevoEstado}`,
        es_nota_interna: true,
      });

      // Recargar detalle y lista
      const res = await pqrsAPI.getById(selectedTicket.ticket_id);
      setTicketDetalle(res.data.data);
      setNotaInterna('');
      cargarDatos();
    } catch (err) {
      console.error('Error al actualizar estado:', err);
      alert('Error al actualizar el estado del ticket.');
    } finally {
      setActualizando(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <LifeBuoy className="w-8 h-8 text-indigo-600" />
            Mesa de Ayuda & PQRS Inteligente
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Gestión de solicitudes empresariales unificadas con extracción documental RAG e IA.
          </p>
        </div>
        <button
          onClick={cargarDatos}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 font-medium text-sm transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* KPI Cards */}
      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Tickets</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{kpis.total_tickets || 0}</p>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs font-semibold text-amber-500 uppercase tracking-wider">En Gestión</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{kpis.tickets_abiertos || 0}</p>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs font-semibold text-red-500 uppercase tracking-wider">Críticos</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{kpis.criticos_pendientes || 0}</p>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs font-semibold text-emerald-500 uppercase tracking-wider">Resueltos</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{kpis.tickets_resueltos || 0}</p>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs font-semibold text-rose-500 uppercase tracking-wider">Vencidos SLA</p>
            <p className="text-2xl font-bold text-rose-600 mt-1">{kpis.vencidos_sla || 0}</p>
          </div>
        </div>
      )}

      {/* Barra de Búsqueda y Filtros */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por ID, solicitante o asunto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Todos los Estados</option>
          <option value="NUEVO">Nuevo</option>
          <option value="EN_GESTION">En Gestión</option>
          <option value="ESPERANDO_CLIENTE">Esperando Cliente</option>
          <option value="RESUELTO">Resuelto</option>
          <option value="CERRADO">Cerrado</option>
        </select>

        <select
          value={filtroPrioridad}
          onChange={(e) => setFiltroPrioridad(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Todas las Prioridades</option>
          <option value="CRITICA">Crítica</option>
          <option value="ALTA">Alta</option>
          <option value="MEDIA">Media</option>
          <option value="BAJA">Baja</option>
        </select>
      </div>

      {/* Tabla de Tickets */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Ticket ID</th>
                <th className="py-3 px-4">Solicitante</th>
                <th className="py-3 px-4">Asunto / Tipo</th>
                <th className="py-3 px-4">Prioridad</th>
                <th className="py-3 px-4">Estado</th>
                <th className="py-3 px-4">Documentos IA</th>
                <th className="py-3 px-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-400">
                    Cargando tickets...
                  </td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-400">
                    No se encontraron solicitudes registradas.
                  </td>
                </tr>
              ) : (
                tickets.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-indigo-600">
                      {t.ticket_id}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-800">{t.nombre}</p>
                      <p className="text-xs text-slate-400">{t.email}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-slate-800 truncate max-w-xs">{t.asunto}</p>
                      <span className="text-[11px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                        {t.tipo}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${PRIORIDAD_BADGES[t.prioridad] || 'bg-slate-200'}`}>
                        {t.prioridad}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2.5 py-1 rounded-full border ${ESTADO_BADGES[t.estado] || 'bg-slate-100'}`}>
                        {t.estado}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {parseInt(t.total_documentos, 10) > 0 ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <Sparkles className="w-3 h-3 text-emerald-500" />
                          {t.total_documentos} {t.total_documentos === 1 ? 'doc' : 'docs'}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => abrirDetalle(t)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                      >
                        Ver Detalle
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Lateral de Detalle */}
      {selectedTicket && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex justify-end">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                  {selectedTicket.ticket_id}
                </span>
                <h2 className="text-lg font-bold text-slate-800 mt-1">
                  {selectedTicket.asunto}
                </h2>
              </div>
              <button
                onClick={() => setSelectedTicket(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {loadingDetalle ? (
                <div className="py-12 text-center text-slate-400">
                  Cargando expediente...
                </div>
              ) : ticketDetalle ? (
                <>
                  {/* Datos del Solicitante */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-slate-400">Solicitante</p>
                      <p className="font-medium text-slate-800">{ticketDetalle.ticket.nombre_solicitante}</p>
                      <p className="text-xs text-slate-500">{ticketDetalle.ticket.email_solicitante}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Departamento Asignado</p>
                      <p className="font-medium text-slate-800">{ticketDetalle.ticket.departamento}</p>
                      <p className="text-xs text-indigo-600 font-semibold mt-0.5">SLA: {ticketDetalle.ticket.sla_horas}h</p>
                    </div>
                    <div className="col-span-2 pt-2 border-t border-slate-200">
                      <p className="text-xs text-slate-400 mb-1">Descripción del Caso</p>
                      <p className="text-slate-700 bg-white p-3 rounded-lg border border-slate-200 whitespace-pre-wrap text-xs">
                        {ticketDetalle.ticket.descripcion}
                      </p>
                    </div>
                  </div>

                  {/* Documentos Analizados por IA */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      Documentos & Evidencias Analizadas por DocuMind
                    </h3>
                    {ticketDetalle.documentos?.length === 0 ? (
                      <p className="text-xs text-slate-400 bg-slate-50 p-4 rounded-lg border border-dashed border-slate-200 text-center">
                        No hay archivos adjuntos en este ticket.
                      </p>
                    ) : (
                      ticketDetalle.documentos.map((doc) => (
                        <div key={doc.id} className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm text-indigo-950 flex items-center gap-2">
                              <FileText className="w-4 h-4 text-indigo-600" />
                              {doc.nombre_archivo}
                            </span>
                            <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full font-bold">
                              {doc.categoria_detectada || 'Documento'} ({doc.score_confianza || 0}%)
                            </span>
                          </div>
                          {doc.resumen_ia && (
                            <p className="text-xs text-slate-600 bg-white p-3 rounded-lg border border-indigo-50 leading-relaxed">
                              <strong className="text-indigo-900 block mb-1">Resumen Ejecutivo de IA:</strong>
                              {doc.resumen_ia}
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Timeline de Actividades */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-600" />
                      Línea de Tiempo & Trazabilidad
                    </h3>
                    <div className="space-y-2 border-l-2 border-slate-200 pl-4 ml-2">
                      {ticketDetalle.timeline?.map((act) => (
                        <div key={act.id} className="relative text-xs space-y-1">
                          <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-indigo-500 ring-4 ring-white" />
                          <p className="font-semibold text-slate-700">
                            {act.autor_nombre} ({act.autor_tipo})
                          </p>
                          <p className="text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                            {act.mensaje}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actualización de Estado */}
                  <form onSubmit={handleActualizarEstado} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Actualizar Estado del Ticket
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <select
                        value={nuevoEstado}
                        onChange={(e) => setNuevoEstado(e.target.value)}
                        className="text-xs border border-slate-300 rounded-lg p-2 bg-white font-medium"
                      >
                        <option value="NUEVO">NUEVO</option>
                        <option value="EN_GESTION">EN GESTIÓN</option>
                        <option value="ESPERANDO_CLIENTE">ESPERANDO CLIENTE</option>
                        <option value="RESUELTO">RESUELTO</option>
                        <option value="CERRADO">CERRADO</option>
                      </select>
                      <button
                        type="submit"
                        disabled={actualizando}
                        className="flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-lg px-4 py-2 text-xs font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50"
                      >
                        <Send className="w-3.5 h-3.5" />
                        {actualizando ? 'Guardando...' : 'Aplicar Cambio'}
                      </button>
                    </div>
                    <textarea
                      placeholder="Escriba una nota o resolución interna para el timeline..."
                      value={notaInterna}
                      onChange={(e) => setNotaInterna(e.target.value)}
                      rows={2}
                      className="w-full text-xs p-2.5 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </form>
                </>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
              <button
                id="btn-consultar-solucion-ia"
                onClick={() => {
                  const queryText = `¿Cómo resolver la solicitud ${selectedTicket.ticket_id} (${selectedTicket.tipo_solicitud || 'PQRS'} - ${selectedTicket.departamento}): "${selectedTicket.asunto}"? Detalle del caso: "${selectedTicket.descripcion || ''}". ¿Cuál es el diagnóstico técnico/operativo, las políticas aplicables y la respuesta recomendada para el cliente?`;
                  navigate(`/chat?query=${encodeURIComponent(queryText)}&repo=all`);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-colors shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                Consultar Solución con IA en Chat RAG
              </button>
              <button
                onClick={() => setSelectedTicket(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
