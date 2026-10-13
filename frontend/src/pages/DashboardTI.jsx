import React, { useState, useEffect, useCallback } from 'react';
import {
  Database,
  CheckCircle2,
  FileText,
  AlertOctagon,
  RefreshCw,
  Loader2,
  TrendingUp,
  Activity,
} from 'lucide-react';
import { logsAPI } from '../services/api';

const SEVERIDAD_CLASES = {
  CRITICAL: 'log-critical',
  ERROR: 'log-error',
  WARNING: 'log-warning',
  INFO: 'log-info',
};

const SEVERIDAD_ROW_BG = {
  CRITICAL: 'bg-red-50 border-red-100',
  ERROR: 'bg-orange-50 border-orange-100',
  WARNING: 'bg-amber-50 border-amber-100',
  INFO: 'bg-blue-50 border-blue-100',
};

function formatHora(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleTimeString('es-CO', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function KPICard({ titulo, valor, subtitulo, Icon, colorClass, bgClass }) {
  return (
    <div className="card p-5 flex items-center justify-between">
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{titulo}</p>
        <p className={`text-3xl font-bold mt-1 ${colorClass}`}>{valor ?? '—'}</p>
        <p className={`text-[10px] mt-1 ${colorClass} opacity-70`}>{subtitulo}</p>
      </div>
      <div className={`p-3 ${bgClass} rounded-xl`}>
        <Icon className={`w-6 h-6 ${colorClass}`} />
      </div>
    </div>
  );
}

export default function DashboardTI() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filtroSeveridad, setFiltroSeveridad] = useState('TODOS');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const cargarDashboard = useCallback(async () => {
    try {
      const res = await logsAPI.dashboard();
      setData(res.data);
    } catch {
      // Silencioso
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarDashboard();
    let interval;
    if (autoRefresh) {
      interval = setInterval(cargarDashboard, 10000); // Actualizar cada 10s
    }
    return () => clearInterval(interval);
  }, [cargarDashboard, autoRefresh]);

  const kpis = data?.kpis;
  const categorias = data?.categorias_ia || [];
  const logsRecientes = data?.logs_recientes || [];

  const totalCategorias = categorias.reduce((acc, c) => acc + parseInt(c.cantidad), 0);

  const CATEGORIAS_CONFIG = {
    Contrato: { color: 'bg-indigo-600', textColor: 'text-indigo-600' },
    Factura: { color: 'bg-teal-500', textColor: 'text-teal-600' },
    'Hoja de Vida': { color: 'bg-emerald-500', textColor: 'text-emerald-600' },
    Otros: { color: 'bg-amber-500', textColor: 'text-amber-600' },
  };

  const logsFiltrados = filtroSeveridad === 'TODOS'
    ? logsRecientes
    : logsRecientes.filter((l) => l.severidad === filtroSeveridad);

  const eficacia = kpis?.total_archivos > 0
    ? ((kpis.procesados_exito / kpis.total_archivos) * 100).toFixed(1)
    : '0.0';

  return (
    <div id="pantalla-dashboard" className="p-8 bg-slate-50 min-h-screen w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <span>📊</span> Dashboard Operativo y Monitoreo de IA
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Visualización de métricas en tiempo real, volumetrías de archivos (MySQL) y bitácora de auditoría de IA.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="accent-indigo-600"
            />
            <Activity className="w-3.5 h-3.5" />
            Auto-refresh (10s)
          </label>
          <button
            id="btn-refresh-dashboard"
            onClick={cargarDashboard}
            className="flex items-center gap-2 btn-secondary text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
        </div>
      ) : (
        <>
          {/* Grid de 4 KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
            <KPICard
              titulo="Total Archivos"
              valor={kpis?.total_archivos ?? 0}
              subtitulo="Sincronizados en MySQL"
              Icon={Database}
              colorClass="text-indigo-700"
              bgClass="bg-indigo-50"
            />
            <KPICard
              titulo="Procesados con Éxito"
              valor={kpis?.procesados_exito ?? 0}
              subtitulo={`${eficacia}% Eficacia del Pipeline`}
              Icon={CheckCircle2}
              colorClass="text-emerald-600"
              bgClass="bg-emerald-50"
            />
            <KPICard
              titulo="Contratos & CVs"
              valor={kpis?.contratos_cvs ?? 0}
              subtitulo="Áreas de Negocio Clave"
              Icon={FileText}
              colorClass="text-cyan-600"
              bgClass="bg-cyan-50"
            />
            <KPICard
              titulo="Fallos Detectados"
              valor={String(kpis?.fallos ?? 0).padStart(2, '0')}
              subtitulo="Requieren Auditoría de TI"
              Icon={AlertOctagon}
              colorClass="text-rose-600"
              bgClass="bg-rose-50"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Gráfico de categorías */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-lg font-bold text-slate-700">Documentos por Categoría (IA)</h2>
                <TrendingUp className="w-4 h-4 text-slate-400" />
              </div>
              <p className="text-xs text-slate-400 mb-6">
                Clasificados automáticamente de manera inteligente por Gemini.
              </p>

              {categorias.length === 0 ? (
                <div className="text-center py-8 text-slate-300">
                  <FileText className="w-10 h-10 mx-auto mb-2" />
                  <p className="text-sm">Sin datos de categorías aún.</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {categorias.map((cat) => {
                    const config = CATEGORIAS_CONFIG[cat.categoria_detectada] || {
                      color: 'bg-slate-400', textColor: 'text-slate-600',
                    };
                    const pct = totalCategorias > 0
                      ? ((parseInt(cat.cantidad) / totalCategorias) * 100).toFixed(0)
                      : 0;

                    return (
                      <div key={cat.categoria_detectada}>
                        <div className="flex justify-between text-sm mb-2">
                          <span className={`font-semibold ${config.textColor}`}>
                            {cat.categoria_detectada}
                          </span>
                          <span className="text-slate-400 text-xs">
                            {cat.cantidad} docs · {pct}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                          <div
                            className={`${config.color} h-full rounded-full relative overflow-hidden transition-all duration-700`}
                            style={{ width: `${pct}%` }}
                          >
                            <div className="absolute inset-0 progress-shimmer" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Consola de Logs de Auditoría */}
            <div className="card p-6 flex flex-col">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-lg font-bold text-slate-700">Registro y Logs de Auditoría IA</h2>
              </div>
              <p className="text-xs text-slate-400 mb-4">
                Bitácora técnica de fallas para depuración inmediata del Administrador de TI.
              </p>

              {/* Filtros de severidad */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {['TODOS', 'CRITICAL', 'ERROR', 'WARNING', 'INFO'].map((sev) => (
                  <button
                    key={sev}
                    id={`filtro-log-${sev.toLowerCase()}`}
                    onClick={() => setFiltroSeveridad(sev)}
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                      filtroSeveridad === sev
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'
                    }`}
                  >
                    {sev}
                  </button>
                ))}
              </div>

              {/* Lista de logs */}
              <div className="space-y-2 max-h-[32vh] overflow-y-auto flex-1">
                {logsFiltrados.length === 0 ? (
                  <div className="text-center py-8 text-slate-300">
                    <Activity className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-xs">Sin registros de {filtroSeveridad !== 'TODOS' ? filtroSeveridad : 'errores'}.</p>
                  </div>
                ) : (
                  logsFiltrados.map((log) => (
                    <div
                      key={log.id}
                      className={`p-3 border rounded-xl flex justify-between items-start gap-3 text-xs animate-fade-in ${SEVERIDAD_ROW_BG[log.severidad] || 'bg-slate-50 border-slate-100'}`}
                    >
                      <div className="flex items-start gap-2.5 flex-1 min-w-0">
                        <span className={`${SEVERIDAD_CLASES[log.severidad] || 'log-info'} flex-shrink-0 mt-0.5`}>
                          {log.severidad}
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-700 leading-tight truncate">{log.mensaje_error}</p>
                          {log.nombre_archivo && (
                            <p className="text-slate-400 text-[10px] mt-0.5 truncate">
                              Archivo: {log.nombre_archivo}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="text-slate-400 flex-shrink-0 font-mono text-[10px]">
                        {formatHora(log.creado_en)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
