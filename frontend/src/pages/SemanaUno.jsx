import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ClipboardList, Download, GitBranch, ScanLine } from 'lucide-react';
import documentoDiseno from '../../../docs/SEMANA_1_DISENO.pdf?url';

// Inventario de la exportación n8n auditada. No representa una prueba de conexión.
const flujos = [
  { id: 'F01', nombre: 'Radicación', entrada: 'POST radicar-pqrs', acceso: 'Público', pasos: 'Validar y clasificar → pqrs_radicar → confirmación SMTP y escalamiento si es urgente.', resultado: 'Radicado, token privado y SLA de 2, 4, 24 o 48 horas.' },
  { id: 'F02', nombre: 'Consulta operativa', entrada: 'GET consultar-pqrs', acceso: 'Basic Auth', pasos: 'pqrs_listar en PostgreSQL → tickets, agentes y estadísticas.', resultado: 'KPIs y últimos 100 tickets.' },
  { id: 'F03', nombre: 'Seguimiento privado', entrada: 'GET consultar-ticket', acceso: 'Radicado + token', pasos: 'Validar consulta → pqrs_tracking en PostgreSQL.', resultado: 'Ticket y actividades públicas, sin notas internas.' },
  { id: 'F04', nombre: 'Actualización', entrada: 'POST actualizar-ticket', acceso: 'Basic Auth', pasos: 'Validar agente, nota, versión y operación → pqrs_actualizar.', resultado: 'Estado e historial; conflicto 409 si la versión cambió.' },
  { id: 'F05', nombre: 'Satisfacción', entrada: 'POST calificar-ticket', acceso: 'Radicado + token', pasos: 'Validar puntuación y ticket resuelto/cerrado → pqrs_calificar.', resultado: 'Calificación CSAT de 1 a 5 y registro de actividad.' },
];

const arquitecturaActual = [
  ['Portal HTML / radicación React', 'n8n: 5 webhooks', 'PostgreSQL / correo SMTP'],
  ['Plataforma React', 'API Express', 'PostgreSQL / Gemini / Pinecone'],
];
const arquitecturaPropuesta = [
  ['React: portal y agentes', 'Express: servicios F01–F05', 'PostgreSQL + cola de correo → SMTP'],
  ['Captura de formulario', 'Tesseract + Ollama / LangChain', 'Revisión humana → F01 → ticket'],
  ['Chat RAG en Express', 'LangChain + Ollama local', 'PostgreSQL + pgvector / fuentes'],
];

function Diagrama({ filas, label }) {
  return (
    <div role="figure" aria-label={label} className="space-y-4">
      {filas.map((fila, i) => (
        <div key={i} className="flex flex-col gap-3 md:flex-row md:items-center">
          {fila.map((nodo, j) => (
            <React.Fragment key={nodo}>
              {j > 0 && <ArrowRight aria-hidden="true" className="h-5 w-5 shrink-0 rotate-90 self-center text-indigo-500 md:rotate-0" />}
              <div className="flex-1 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-5 text-center text-sm font-medium text-indigo-950">{nodo}</div>
            </React.Fragment>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function SemanaUno() {
  const [arquitectura, setArquitectura] = useState('actual');

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-800 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="space-y-5">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-indigo-700 hover:underline">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Volver a DocuMind
          </Link>
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">Tercer corte · Diseño e inventario</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Semana 1</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">El punto de partida de DocuMind & PQRS B2B y las decisiones para su siguiente etapa.</p>
            </div>
            <a href={documentoDiseno} download="SEMANA_1_DISENO.pdf" className="btn-primary inline-flex items-center justify-center gap-2">
              <Download className="h-4 w-4" aria-hidden="true" /> Diseño en PDF · 2 páginas
            </a>
          </div>
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
            Esta entrega documenta el diseño. La automatización actual sigue en n8n; la Ruta A y el OCR son decisiones para implementar en las siguientes semanas. El inventario describe el código, no certifica que los servicios estén conectados.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { icon: ClipboardList, titulo: '5 flujos inventariados', detalle: 'Disparadores, pasos, servicios y resultados.' },
            { icon: GitBranch, titulo: 'Ruta A elegida', detalle: 'Servicios propios con Node.js y Express.' },
            { icon: ScanLine, titulo: 'Caso de visión definido', detalle: 'Lectura de formularios físicos PQRS impresos.' },
          ].map(({ icon: Icon, titulo, detalle }) => (
            <div key={titulo} className="card p-5">
              <Icon className="mb-3 h-6 w-6 text-indigo-600" aria-hidden="true" />
              <h2 className="font-semibold text-slate-950">{titulo}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{detalle}</p>
            </div>
          ))}
        </div>

        <section aria-labelledby="inventario-title" className="card overflow-hidden">
          <div className="p-6">
            <h2 id="inventario-title" className="text-xl font-bold">Inventario del sistema actual</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Un workflow con 44 nodos: 5 webhooks, 8 nodos PostgreSQL y 2 SMTP. La clasificación usa reglas. Las alertas se envían al radicar casos urgentes; no hay monitor periódico de vencimientos ni nodos de IA en ese workflow.</p>
          </div>
          <div role="region" aria-label="Tabla de flujos, desplazable horizontalmente" tabIndex={0} className="overflow-x-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500">
            <table className="w-full min-w-[720px] text-left text-sm">
              <caption className="sr-only">Cinco flujos existentes en workflow/n8n_workflow.json; todos continúan en n8n.</caption>
              <thead className="border-y border-slate-200 bg-slate-50 text-slate-600">
                <tr>{['Flujo / disparador', 'Pasos y servicios', 'Resultado', 'Motor actual'].map(t => <th key={t} scope="col" className="px-6 py-3 font-semibold">{t}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {flujos.map(f => (
                  <tr key={f.id}>
                    <th scope="row" className="px-6 py-4 align-top font-normal">
                      <div className="font-semibold text-slate-950">{f.id} · {f.nombre}</div>
                      <code className="mt-1 block text-xs text-indigo-700">{f.entrada}</code>
                      <span className="mt-1 block text-xs text-slate-500">{f.acceso}</span>
                    </th>
                    <td className="px-6 py-4 align-top leading-6">{f.pasos}</td>
                    <td className="px-6 py-4 align-top leading-6">{f.resultado}</td>
                    <td className="px-6 py-4 align-top"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">n8n</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="decisiones-title" className="card p-6">
          <h2 id="decisiones-title" className="text-xl font-bold">Decisiones de diseño</h2>
          <div className="mt-5 grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="font-semibold text-indigo-800">Ruta A · Migrar a servicios propios</h3>
              <p className="mt-2 text-sm leading-6">Se reutilizarán Express y las funciones PostgreSQL para conservar los cinco flujos, sus SLA, idempotencia y seguimiento. La Ruta B mantendría n8n autoalojado y exigiría migrar un flujo con IA; añade un segundo motor que la Ruta A permite retirar.</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">El chatbot ya está en Express con Gemini/Pinecone. Se propone LangChain con Ollama local y almacenamiento de vectores en PostgreSQL; esa sustitución está pendiente.</p>
            </div>
            <div>
              <h3 className="font-semibold text-indigo-800">Visión · Digitalizar formularios PQRS</h3>
              <p className="mt-2 text-sm leading-6">Un agente subirá una foto JPG/PNG o un PDF escaneado. Tesseract y Ollama extraerán nombre, correo, teléfono, tipo, asunto y descripción, con confianza por campo. La revisión humana precederá a la creación del ticket mediante F01.</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">Confianza inferior a 0,85 o campos inválidos exigirán corrección. El umbral está por calibrar; no es una precisión medida. No existe todavía OCR ni evaluación con 20 fotografías.</p>
            </div>
          </div>
        </section>

        <section aria-labelledby="arquitectura-title" className="card p-6">
          <h2 id="arquitectura-title" className="text-xl font-bold">Arquitectura</h2>
          <div role="group" className="my-5 flex flex-wrap gap-2" aria-label="Seleccionar arquitectura">
            {[['actual', 'Actual · presente en el código'], ['propuesta', 'Propuesta · pendiente de implementar']].map(([valor, label]) => (
              <button key={valor} type="button" aria-pressed={arquitectura === valor} onClick={() => setArquitectura(valor)} className={arquitectura === valor ? 'btn-primary text-sm' : 'btn-secondary text-sm'}>{label}</button>
            ))}
          </div>
          <Diagrama filas={arquitectura === 'actual' ? arquitecturaActual : arquitecturaPropuesta} label={`Arquitectura ${arquitectura}`} />
          <p className="mt-4 text-sm leading-6 text-slate-600">
            {arquitectura === 'actual'
              ? 'React usa Express para gestión y seguimiento, y llama a n8n para radicar. El portal HTML autónomo usa los cinco webhooks. La ingesta actual procesa texto PDF/DOCX/TXT; no hace OCR de imágenes.'
              : 'Se conservarán permisos y archivos privados. Un trabajador con cola persistente gestionará errores, tres intentos ante fallos transitorios y registros de ejecución. El servidor para el modelo local y el despliegue debe confirmarse. Ante un fallo de IA, se permitirá revisión o radicación manual.'}
          </p>
        </section>

        <footer className="border-t border-slate-200 pt-5 text-sm leading-6 text-slate-600">
          <p><strong>Entrega de semana 1:</strong> inventario, elección de ruta, caso de visión y documento de 1–2 páginas con arquitectura. Implementación: semanas 2–3; integración, 20 imágenes y despliegue: semana 4.</p>
          <p className="mt-2">Fuente técnica: <code>workflow/n8n_workflow.json</code>, esquemas PostgreSQL y API Express. Esta vista y el PDF presentan el mismo alcance. Los pendientes técnicos se registran en <code>STATUS_AUDIT.md</code>.</p>
        </footer>
      </div>
    </main>
  );
}
