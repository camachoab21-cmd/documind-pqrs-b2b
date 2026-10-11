/**
 * SERVIDOR SIMULADOR LOCAL PARA PRUEBAS INMEDIATAS (MOCK n8n + PostgreSQL + SMTP)
 * Permite probar el 100% del portal web, radicaciones, tracking, RBAC, SLAs y CSAT
 * sin depender de Docker Desktop ni tiempos de arranque pesados.
 */
const http = require('http');
const url = require('url');

const PORT = 5678;

// Semilla de agentes con credenciales corporativas
const agentes = [
  { id: '11111111-1111-4000-8000-000000000001', nombre: 'Andrea Silva', email: 'andrea.silva@empresa.com', rol: 'SUPERVISOR', departamento: 'Soporte Técnico y Sistemas', pass: 'SupervisorSoporte2026*' },
  { id: '22222222-2222-4000-8000-000000000002', nombre: 'Carlos Morales', email: 'carlos.morales@empresa.com', rol: 'AGENTE', departamento: 'Soporte Técnico y Sistemas', pass: 'AgenteSistemas2026*' },
  { id: '33333333-3333-4000-8000-000000000003', nombre: 'Laura Mendoza', email: 'laura.mendoza@empresa.com', rol: 'AGENTE', departamento: 'Facturación y Cobranzas', pass: 'AgenteFacturacion2026*' },
  { id: '44444444-4444-4000-8000-000000000004', nombre: 'Felipe Torres', email: 'felipe.torres@empresa.com', rol: 'AGENTE', departamento: 'Control de Calidad y Garantías', pass: 'AgenteCalidad2026*' }
];

// Base de datos en memoria para pruebas
let contadorRadicado = 891500;
const tickets = [
  {
    ticket_id: 'PQRS-2026-891501',
    tracking_token: 'a0000000-0000-4000-8000-000000000001',
    cliente_nombre: 'Mariana Restrepo Cadavid',
    email: 'm.restrepo@example.com',
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
      { autor: 'Sistema n8n', tipo: 'SISTEMA', mensaje: 'Radicación formal recibida vía webhook y almacenada en PostgreSQL.', fecha: new Date(Date.now() - 48 * 3600000).toISOString(), es_nota_interna: false },
      { autor: 'Andrea Silva', tipo: 'SUPERVISOR', mensaje: 'Certificado generado y remitido al correo del cliente.', fecha: new Date(Date.now() - 12 * 3600000).toISOString(), es_nota_interna: false }
    ]
  },
  {
    ticket_id: 'PQRS-2026-891502',
    tracking_token: 'b0000000-0000-4000-8000-000000000002',
    cliente_nombre: 'Carlos Alberto Gómez',
    email: 'carlos.gomez@example.com',
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
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
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

  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${pathname}`);

  try {
    // 1. CONSULTA PING & CONSULTA DE CASO INDIVIDUAL
    if (pathname === '/webhook/consultar-ticket' && req.method === 'GET') {
      const id = searchParams.get('id');
      const token = searchParams.get('token');

      // Ping de verificación de conexión del frontend
      if (id === 'PQRS-2000-000000' && token === '00000000-0000-4000-8000-000000000000') {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', codigo: 404, mensaje: 'Radicado o clave de consulta incorrectos' }));
        return;
      }

      const ticket = tickets.find(t => t.ticket_id === id && t.tracking_token === token);
      if (!ticket) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', codigo: 404, mensaje: 'No se encontró el requerimiento con ese radicado o clave privada.' }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'success',
        ticket: {
          ...ticket,
          timeline: ticket.actividades
        }
      }));
      return;
    }

    // 2. RADICACIÓN DE NUEVO REQUERIMIENTO
    if (pathname === '/webhook/radicar-pqrs' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const { request_id, nombre, email, telefono, departamento, tipo_solicitud, prioridad, asunto, descripcion } = body;

      if (!nombre || !email || !asunto || !descripcion) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', guardada: false, mensaje: 'Campos obligatorios incompletos.' }));
        return;
      }

      // Cálculo de SLA y ruta de decisión
      const prioUpper = (prioridad || '').toUpperCase();
      const tipoUpper = (tipo_solicitud || '').toUpperCase();
      const esUrgente = prioUpper === 'CRITICA' || prioUpper === 'ALTA' || tipoUpper === 'RECLAMO';
      const slaHoras = prioUpper === 'CRITICA' ? 2 : (prioUpper === 'ALTA' || tipoUpper === 'RECLAMO') ? 4 : prioUpper === 'BAJA' ? 48 : 24;
      
      const nuevoNumero = ++contadorRadicado;
      const ticketId = `PQRS-2026-${nuevoNumero}`;
      const trackingToken = cryptoRandomUuid();
      const fechaRadicacion = new Date().toISOString();
      const slaFechaLimite = new Date(Date.now() + slaHoras * 3600000).toISOString();

      const nuevoTicket = {
        ticket_id: ticketId,
        tracking_token: trackingToken,
        cliente_nombre: nombre,
        email: email,
        telefono: telefono || '',
        departamento: departamento || 'Atención al Cliente General',
        tipo: tipo_solicitud,
        prioridad: prioridad,
        asunto: asunto,
        descripcion: descripcion,
        estado: 'NUEVO',
        es_urgente: esUrgente,
        sla_horas: slaHoras,
        sla_fecha_limite: slaFechaLimite,
        fecha_radicacion: fechaRadicacion,
        fecha_resolucion: null,
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

      console.log(`[RADICACIÓN CONFIRMADA] ${ticketId} | SLA: ${slaHoras}h | Urgente: ${esUrgente}`);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'success',
        guardada: true,
        request_id: request_id,
        ticket_id: ticketId,
        tracking_token: trackingToken,
        tipo: tipo_solicitud,
        prioridad: prioridad,
        estado: 'NUEVO',
        es_urgente: esUrgente,
        sla_horas: slaHoras,
        sla_fecha_limite: slaFechaLimite,
        confirmacion_estado: 'ENVIADO',
        alerta_estado: esUrgente ? 'ENVIADO_SUPERVISOR' : 'NO_APLICA',
        mensaje: `Su solicitud ha sido radicada formalmente bajo el radicado ${ticketId}. Plazo máximo de atención: ${slaHoras} horas.`
      }));
      return;
    }

    // 3. CONSULTA WORKSPACE AGENTES (RBAC PROTEGIDO)
    if (pathname === '/webhook/consultar-pqrs' && req.method === 'GET') {
      const authHeader = req.headers['authorization'] || '';
      if (!authHeader.startsWith('Basic ')) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', mensaje: 'Requiere autenticación corporativa (RBAC).' }));
        return;
      }

      const creds = Buffer.from(authHeader.replace('Basic ', ''), 'base64').toString('utf-8').split(':');
      const user = creds[0], pass = creds[1];

      const agente = agentes.find(a => (a.email.toLowerCase().startsWith(user.toLowerCase()) || a.nombre.toLowerCase().replace(/\s+/g, '.').includes(user.toLowerCase())) && a.pass === pass);
      if (!agente) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', mensaje: 'Credenciales inválidas de funcionario.' }));
        return;
      }

      const total = tickets.length;
      const urgentes = tickets.filter(t => t.es_urgente).length;
      const activos = tickets.filter(t => !['RESUELTO', 'CERRADO'].includes(t.estado)).length;
      const resueltos = tickets.filter(t => ['RESUELTO', 'CERRADO'].includes(t.estado)).length;
      const cumplimientoPct = total > 0 ? Math.round((resueltos / total) * 100) : 100;
      const scores = tickets.map(t => t.satisfaccion_score).filter(Boolean);
      const avgCsat = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '5.0';

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'success',
        total: total,
        urgentes: urgentes,
        activos: activos,
        cumplimiento_pct: cumplimientoPct,
        satisfaccion_promedio: avgCsat,
        tickets: tickets.map(t => ({
          ...t,
          actividades: t.actividades
        })),
        agentes: agentes.map(a => ({ id: a.id, nombre: a.nombre, rol: a.rol, departamento: a.departamento }))
      }));
      return;
    }

    // 4. ACTUALIZACIÓN Y GESTIÓN DE TICKET (AGENTE)
    if (pathname === '/webhook/actualizar-ticket' && req.method === 'POST') {
      const authHeader = req.headers['authorization'] || '';
      if (!authHeader.startsWith('Basic ')) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', mensaje: 'No autorizado.' }));
        return;
      }

      const body = await parseJsonBody(req);
      const { ticket_id, nuevo_estado, agente_id, mensaje_resolucion, es_nota_interna, version } = body;

      const ticket = tickets.find(t => t.ticket_id === ticket_id);
      if (!ticket) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', mensaje: 'Ticket no encontrado.' }));
        return;
      }

      // Verificación de concurrencia optimista
      if (ticket.version !== version) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', mensaje: 'Conflicto de versión: el ticket fue modificado por otro funcionario.' }));
        return;
      }

      const agente = agentes.find(a => a.id === agente_id);
      ticket.estado = nuevo_estado;
      ticket.agente_asignado_id = agente_id;
      ticket.agente_asignado = agente ? agente.nombre : 'Funcionario';
      ticket.version++;

      if (['RESUELTO', 'CERRADO'].includes(nuevo_estado) && !ticket.fecha_resolucion) {
        ticket.fecha_resolucion = new Date().toISOString();
      }

      ticket.actividades.push({
        autor: agente ? agente.nombre : 'Funcionario',
        tipo: agente ? agente.rol : 'AGENTE',
        mensaje: mensaje_resolucion,
        fecha: new Date().toISOString(),
        es_nota_interna: Boolean(es_nota_interna)
      });

      console.log(`[TICKET ACTUALIZADO] ${ticket_id} -> ${nuevo_estado} (Versión ${ticket.version})`);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'success',
        ticket_id: ticket_id,
        version: ticket.version,
        mensaje: `Ticket ${ticket_id} actualizado con éxito al estado ${nuevo_estado}.`
      }));
      return;
    }

    // 5. CALIFICACIÓN DE SATISFACCIÓN CSAT (1-5 ESTRELLAS)
    if (pathname === '/webhook/calificar-ticket' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const { ticket_id, tracking_token, puntuacion, retroalimentacion } = body;

      const ticket = tickets.find(t => t.ticket_id === ticket_id && t.tracking_token === tracking_token);
      if (!ticket) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', mensaje: 'Ticket no válido para calificación.' }));
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

      console.log(`[CSAT REGISTRADO] ${ticket_id} -> ${puntuacion}/5 estrellas`);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'success',
        ticket_id: ticket_id,
        puntuacion: puntuacion,
        mensaje: 'Calificación de calidad almacenada con éxito en PostgreSQL.'
      }));
      return;
    }

    // Ruta no encontrada
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'error', mensaje: 'Endpoint no encontrado en el simulador n8n.' }));

  } catch (err) {
    console.error('Error procesando solicitud:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'error', mensaje: err.message }));
  }
});

function cryptoRandomUuid() {
  const b = require('crypto').randomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = b.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

server.listen(PORT, '0.0.0.0', () => {
  console.log('================================================================');
  console.log(`  🚀 SERVIDOR SIMULADOR n8n + POSTGRESQL ACTIVO EN PUERTO ${PORT}`);
  console.log('================================================================');
  console.log(`  - Endpoint base: http://localhost:${PORT}`);
  console.log('  - Webhooks simulados:');
  console.log('      • GET  /webhook/consultar-ticket?id=...&token=... (Ping & Tracking)');
  console.log('      • POST /webhook/radicar-pqrs');
  console.log('      • GET  /webhook/consultar-pqrs (RBAC protegido)');
  console.log('      • POST /webhook/actualizar-ticket');
  console.log('      • POST /webhook/calificar-ticket (CSAT)');
  console.log('----------------------------------------------------------------');
  console.log('  Presiona Ctrl + C para detener el simulador.');
  console.log('================================================================\n');
});
