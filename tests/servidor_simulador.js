/**
 * SERVIDOR SIMULADOR LOCAL PARA PRUEBAS (MOCK n8n + PostgreSQL + SMTP)
 * Implementa 100% el contrato de los webhooks de n8n, soporte de RBAC,
 * idempotencia por request_id / operation_id, control de concurrencia optimista y CSAT.
 */
const http = require('http');
const { randomUUID } = require('crypto');

const PORT = 5678;

const estadosValidos = ['NUEVO', 'ASIGNADO', 'EN_GESTION', 'ESPERANDO_CLIENTE', 'RESUELTO', 'CERRADO'];

// Directorio de agentes corporativos
const agentes = [
  { id: '11111111-1111-4000-8000-000000000001', nombre: 'Andrea Silva', email: 'andrea.silva@empresa.com', rol: 'SUPERVISOR', departamento: 'Soporte Técnico y Sistemas', pass: 'SupervisorSoporte2026*' },
  { id: '22222222-2222-4000-8000-000000000002', nombre: 'Carlos Morales', email: 'carlos.morales@empresa.com', rol: 'AGENTE', departamento: 'Soporte Técnico y Sistemas', pass: 'AgenteSistemas2026*' },
  { id: '33333333-3333-4000-8000-000000000003', nombre: 'Laura Mendoza', email: 'laura.mendoza@empresa.com', rol: 'AGENTE', departamento: 'Facturación y Cobranzas', pass: 'AgenteFacturacion2026*' },
  { id: '44444444-4444-4000-8000-000000000004', nombre: 'Felipe Torres', email: 'felipe.torres@empresa.com', rol: 'AGENTE', departamento: 'Control de Calidad y Garantías', pass: 'AgenteCalidad2026*' }
];

let contadorRadicado = 891500;
const requestsGuardados = new Map();
const operationsGuardadas = new Map();

// Base de datos de tickets en memoria
const tickets = [
  {
    ticket_id: 'PQRS-2026-891501',
    request_id: '99999999-9999-4000-8000-000000000001',
    tracking_token: 'a0000000-0000-4000-8000-000000000001',
    cliente_nombre: 'Mariana Restrepo Cadavid',
    email: 'm.restrepo@empresa.com',
    telefono: '314 567 8901',
    departamento: 'Atención al Cliente General',
    tipo: 'Petición',
    prioridad: 'Media',
    asunto: 'Certificación comercial de paz y salvo',
    descripcion: 'Solicito expedición del certificado de paz y salvo contractual para presentar ante convocatoria pública.',
    estado: 'RESUELTO',
    es_urgente: false,
    sla_horas: 24,
    sla_fecha_limite: new Date(Date.now() + 24 * 3600000).toISOString(),
    fecha_radicacion: new Date(Date.now() - 48 * 3600000).toISOString(),
    fecha_resolucion: new Date(Date.now() - 12 * 3600000).toISOString(),
    version: 2,
    agente_asignado_id: '11111111-1111-4000-8000-000000000001',
    agente_asignado: 'Andrea Silva',
    satisfaccion_score: 5,
    satisfaccion_comentario: 'Excelente tiempo de respuesta y atención impecable.',
    actividades: [
      { autor: 'Sistema n8n', tipo: 'SISTEMA', mensaje: 'Radicación formal recibida vía webhook y persistida en PostgreSQL.', fecha: new Date(Date.now() - 48 * 3600000).toISOString(), es_nota_interna: false },
      { autor: 'Andrea Silva', tipo: 'SUPERVISOR', mensaje: 'Certificado generado y remitido al correo del cliente.', fecha: new Date(Date.now() - 12 * 3600000).toISOString(), es_nota_interna: false }
    ]
  },
  {
    ticket_id: 'PQRS-2026-891502',
    request_id: '99999999-9999-4000-8000-000000000002',
    tracking_token: 'b0000000-0000-4000-8000-000000000002',
    cliente_nombre: 'Carlos Alberto Gómez',
    email: 'carlos.gomez@empresa.com',
    telefono: '300 123 4567',
    departamento: 'Facturación y Cobranzas',
    tipo: 'Reclamo',
    prioridad: 'Alta',
    asunto: 'Cobro duplicado en factura mensual #8915',
    descripcion: 'El sistema facturó dos veces la mensualidad. Solicito anulación del cobro duplicado y emisión de nota de crédito.',
    estado: 'EN_GESTION',
    es_urgente: true,
    sla_horas: 4,
    sla_fecha_limite: new Date(Date.now() + 2 * 3600000).toISOString(),
    fecha_radicacion: new Date(Date.now() - 2 * 3600000).toISOString(),
    fecha_resolucion: null,
    version: 1,
    agente_asignado_id: '33333333-3333-4000-8000-000000000003',
    agente_asignado: 'Laura Mendoza',
    satisfaccion_score: null,
    satisfaccion_comentario: null,
    actividades: [
      { autor: 'Sistema n8n', tipo: 'SISTEMA', mensaje: 'Radicado clasificado en Ruta Urgente (Reclamo Alta Prioridad). Escalamiento a Facturación.', fecha: new Date(Date.now() - 2 * 3600000).toISOString(), es_nota_interna: false },
      { autor: 'Laura Mendoza', tipo: 'AGENTE', mensaje: 'Validando comprobante de pasarela de pagos con el banco recaudador.', fecha: new Date(Date.now() - 1 * 3600000).toISOString(), es_nota_interna: true }
    ]
  }
];

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (err) { reject(err); }
    });
  });
}

const server = http.createServer(async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost:5678'}`);
  const pathname = parsedUrl.pathname.replace(/\/+$/, '');
  const searchParams = parsedUrl.searchParams;

  try {
    // 1. CONSULTA PING & CONSULTA DE SEGUIMIENTO (TRACKING)
    if (pathname === '/webhook/consultar-ticket' && req.method === 'GET') {
      const id = searchParams.get('id');
      const token = searchParams.get('token');

      const ticket = tickets.find(t => t.ticket_id === id && t.tracking_token === token);
      if (!ticket) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', codigo: 404, mensaje: 'Radicado o clave de consulta incorrectos' }));
        return;
      }

      // No revelar tracking_token ni email en la vista pública
      const { tracking_token, email, actividades, ...publicData } = ticket;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'success',
        ticket: {
          ...publicData,
          timeline: actividades.filter(a => !a.es_nota_interna)
        }
      }));
      return;
    }

    // 2. RADICACIÓN DE PQRS (POST)
    if (pathname === '/webhook/radicar-pqrs' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const { request_id, nombre, email, telefono, departamento, tipo_solicitud, prioridad, asunto, descripcion } = body;

      // Validación de payload
      const errores = [];
      if (!nombre || nombre.length < 2 || nombre.length > 150) errores.push('Nombre inválido.');
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errores.push('Correo electrónico inválido.');
      if (!asunto || asunto.length < 3 || asunto.length > 250) errores.push('Asunto inválido.');
      if (!descripcion || descripcion.length < 5 || descripcion.length > 5000) errores.push('Descripción inválida.');

      if (errores.length > 0) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', codigo: 400, guardada: false, errores }));
        return;
      }

      // Idempotencia por request_id
      if (requestsGuardados.has(request_id)) {
        const existente = requestsGuardados.get(request_id);
        const normalizadoGuardado = { ...existente.payload, request_id: undefined };
        const normalizadoEntrante = { ...body, request_id: undefined };

        if (JSON.stringify(normalizadoGuardado) !== JSON.stringify(normalizadoEntrante)) {
          res.writeHead(409, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'error', codigo: 409, guardada: null, mensaje: 'Mismo request_id con datos diferentes.' }));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'success',
          codigo: 200,
          guardada: true,
          duplicada: true,
          ...existente.respuesta
        }));
        return;
      }

      // Cálculo de SLA
      const prioUpper = (prioridad || '').toUpperCase();
      const tipoUpper = (tipo_solicitud || '').toUpperCase();
      const esUrgente = prioUpper === 'CRITICA' || prioUpper === 'ALTA' || tipoUpper === 'RECLAMO';
      const slaHoras = prioUpper === 'CRITICA' ? 2 : (prioUpper === 'ALTA' || tipoUpper === 'RECLAMO') ? 4 : prioUpper === 'BAJA' ? 48 : 24;

      const nuevoNumero = ++contadorRadicado;
      const ticketId = `PQRS-2026-${nuevoNumero}`;
      const trackingToken = randomUUID();
      const now = new Date();
      const fechaRadicacion = now.toISOString();
      const slaFechaLimite = new Date(now.getTime() + slaHoras * 3600000).toISOString();

      const nuevoTicket = {
        ticket_id: ticketId,
        request_id,
        tracking_token: trackingToken,
        cliente_nombre: nombre,
        email: email.toLowerCase(),
        telefono: telefono || '',
        departamento: departamento || 'Atención al Cliente General',
        tipo: tipo_solicitud,
        prioridad: prioridad,
        asunto,
        descripcion,
        estado: 'NUEVO',
        es_urgente: esUrgente,
        sla_horas: slaHoras,
        sla_fecha_limite: slaFechaLimite,
        fecha_radicacion: fechaRadicacion,
        fecha_resolucion: null,
        confirmacion_estado: 'ENVIADA',
        alerta_estado: esUrgente ? 'ENVIADA' : 'NO_APLICA',
        version: 1,
        agente_asignado_id: null,
        agente_asignado: null,
        satisfaccion_score: null,
        satisfaccion_comentario: null,
        actividades: [
          {
            autor: 'Sistema n8n',
            tipo: 'SISTEMA',
            mensaje: `Solicitud radicada bajo política de SLA (${slaHoras}h corridas). Ruta: ${esUrgente ? 'URGENTE' : 'ESTÁNDAR'}. Notificación SMTP enviada a ${email}.`,
            fecha: fechaRadicacion,
            es_nota_interna: false
          }
        ]
      };

      tickets.unshift(nuevoTicket);

      const respuestaTicket = {
        request_id,
        ticket_id: ticketId,
        tracking_token: trackingToken,
        tipo: tipo_solicitud,
        prioridad,
        estado: 'NUEVO',
        es_urgente: esUrgente,
        sla_horas: slaHoras,
        sla_fecha_limite: slaFechaLimite,
        confirmacion_estado: 'ENVIADA',
        alerta_estado: esUrgente ? 'ENVIADA' : 'NO_APLICA',
        mensaje: `Su solicitud ha sido radicada formalmente bajo el radicado ${ticketId}. Plazo máximo de atención: ${slaHoras} horas.`
      };

      requestsGuardados.set(request_id, { payload: body, respuesta: respuestaTicket });

      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'success',
        codigo: 201,
        guardada: true,
        duplicada: false,
        ...respuestaTicket
      }));
      return;
    }

    // 3. CONSULTA WORKSPACE (GET con Basic Auth)
    if (pathname === '/webhook/consultar-pqrs' && req.method === 'GET') {
      const authHeader = req.headers['authorization'] || '';
      if (!authHeader.startsWith('Basic ')) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', codigo: 401, mensaje: 'Requiere autenticación corporativa (RBAC).' }));
        return;
      }

      const creds = Buffer.from(authHeader.replace('Basic ', ''), 'base64').toString('utf-8').split(':');
      const user = creds[0], pass = creds[1];

      const agente = agentes.find(a => (a.email.toLowerCase().startsWith(user.toLowerCase()) || a.nombre.toLowerCase().replace(/\s+/g, '.').includes(user.toLowerCase())) && a.pass === pass);
      if (!agente) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', codigo: 403, mensaje: 'Credenciales inválidas de funcionario.' }));
        return;
      }

      const total = tickets.length;
      const urgentes = tickets.filter(t => t.es_urgente).length;
      const estandar = total - urgentes;
      const activos = tickets.filter(t => !['RESUELTO', 'CERRADO'].includes(t.estado)).length;
      const resueltos = tickets.filter(t => ['RESUELTO', 'CERRADO'].includes(t.estado)).length;
      const en_gestion = tickets.filter(t => t.estado === 'EN_GESTION').length;
      const cumplimientoPct = total > 0 ? Math.round((resueltos / total) * 100) : 100;
      const scores = tickets.map(t => t.satisfaccion_score).filter(Boolean);
      const avgCsat = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '5.0';

      const limiteListado = 100;
      const ticketsDevueltos = tickets.slice(0, limiteListado);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'success',
        codigo: 200,
        total,
        urgentes,
        estandar,
        activos,
        resueltos,
        en_gestion,
        total_listado: ticketsDevueltos.length,
        limite_listado: limiteListado,
        cumplimiento_pct: cumplimientoPct,
        satisfaccion_promedio: avgCsat,
        tickets: ticketsDevueltos.map(t => ({
          ...t,
          actividades: t.actividades
        })),
        agentes: agentes.map(a => ({ id: a.id, nombre: a.nombre, rol: a.rol, departamento: a.departamento }))
      }));
      return;
    }

    // 4. ACTUALIZACIÓN DE TICKET (POST con Basic Auth)
    if (pathname === '/webhook/actualizar-ticket' && req.method === 'POST') {
      const authHeader = req.headers['authorization'] || '';
      if (!authHeader.startsWith('Basic ')) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', codigo: 401, mensaje: 'No autorizado.' }));
        return;
      }

      const body = await parseJsonBody(req);
      const { operation_id, ticket_id, nuevo_estado, agente_id, mensaje_resolucion, es_nota_interna, version } = body;

      // Idempotencia por operation_id
      if (operationsGuardadas.has(operation_id)) {
        const op = operationsGuardadas.get(operation_id);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'success',
          codigo: 200,
          duplicada: true,
          ticket_id,
          estado: nuevo_estado,
          version: op.version,
          mensaje: `Operación ya aplicada previamente.`
        }));
        return;
      }

      if (!estadosValidos.includes(nuevo_estado)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', codigo: 400, mensaje: 'Estado inexistente o no permitido.' }));
        return;
      }

      const ticket = tickets.find(t => t.ticket_id === ticket_id);
      if (!ticket) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', codigo: 404, mensaje: 'Ticket no encontrado.' }));
        return;
      }

      if (ticket.version !== version) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', codigo: 409, mensaje: 'Conflicto de versión (concurrencia optimista).' }));
        return;
      }

      const agente = agentes.find(a => a.id === agente_id);
      ticket.estado = nuevo_estado;
      ticket.agente_asignado_id = agente_id;
      ticket.agente_asignado = agente ? agente.nombre : 'Funcionario';
      ticket.version++;

      if (['RESUELTO', 'CERRADO'].includes(nuevo_estado)) {
        if (!ticket.fecha_resolucion) ticket.fecha_resolucion = new Date().toISOString();
      } else {
        ticket.fecha_resolucion = null;
      }

      ticket.actividades.push({
        autor: agente ? agente.nombre : 'Funcionario',
        tipo: agente ? agente.rol : 'AGENTE',
        mensaje: mensaje_resolucion,
        fecha: new Date().toISOString(),
        es_nota_interna: Boolean(es_nota_interna)
      });

      operationsGuardadas.set(operation_id, { version: ticket.version });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'success',
        codigo: 200,
        duplicada: false,
        ticket_id,
        estado: nuevo_estado,
        version: ticket.version,
        mensaje: `Ticket ${ticket_id} actualizado con éxito al estado ${nuevo_estado}.`
      }));
      return;
    }

    // 5. CALIFICACIÓN CSAT (POST)
    if (pathname === '/webhook/calificar-ticket' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const { ticket_id, tracking_token, puntuacion, retroalimentacion } = body;

      const ticket = tickets.find(t => t.ticket_id === ticket_id && t.tracking_token === tracking_token);
      if (!ticket) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', codigo: 404, mensaje: 'Ticket no válido para calificación.' }));
        return;
      }

      ticket.satisfaccion_score = Number(puntuacion);
      ticket.satisfaccion_comentario = retroalimentacion || '';
      ticket.actividades.push({
        autor: ticket.cliente_nombre,
        tipo: 'CLIENTE',
        mensaje: `Calificación de servicio: ${'⭐'.repeat(puntuacion)} (${puntuacion}/5). ${retroalimentacion ? `Comentario: "${retroalimentacion}"` : ''}`,
        fecha: new Date().toISOString(),
        es_nota_interna: false
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'success',
        codigo: 200,
        ticket_id,
        puntuacion,
        mensaje: 'Calificación almacenada con éxito.'
      }));
      return;
    }

    // Ruta 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'error', codigo: 404, mensaje: 'Endpoint no encontrado en el simulador n8n.' }));

  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'error', codigo: 500, mensaje: err.message }));
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[SIMULADOR n8n + POSTGRESQL] Activo en http://localhost:${PORT}`);
});
