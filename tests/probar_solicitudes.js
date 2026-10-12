'use strict';

// Integración real: Node.js 18+, n8n publicado, PostgreSQL y SMTP configurados.
// Crea dos solicitudes y modifica solamente la solicitud estándar de esta ejecución.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const createdIds = new Set();
let passed = 0;
let currentStep = 'Configuración';
let config;

function fixture(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
}
function configuration() {
  assert.ok(Number(process.versions.node.split('.')[0]) >= 18, 'Se necesita Node.js 18 o superior.');
  const base = new URL(process.env.PQRS_BASE_URL || 'http://localhost:5678');
  assert.ok(['http:', 'https:'].includes(base.protocol), 'PQRS_BASE_URL debe usar http o https.');
  assert.ok(!base.username && !base.password && !base.search && !base.hash, 'La URL base no debe incluir credenciales, query ni fragmento.');
  const user = process.env.PQRS_ADMIN_USER || 'andrea.silva';
  const password = process.env.PQRS_ADMIN_PASSWORD || 'SupervisorSoporte2026*';
  const email = (process.env.PQRS_EMAIL_PRUEBA || 'pruebas.pqrs.academico@gmail.com').trim();
  assert.ok(user && password, 'Defina PQRS_ADMIN_USER y PQRS_ADMIN_PASSWORD con la credencial Basic Auth de los dos webhooks administrativos.');
  assert.ok(!user.includes(':'), 'El usuario Basic Auth no puede contener dos puntos.');
  assert.match(email, /^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Defina PQRS_EMAIL_PRUEBA con un buzón válido.');
  const timeout = Number(process.env.PQRS_TIMEOUT_MS || 30000);
  assert.ok(Number.isSafeInteger(timeout) && timeout >= 1000 && timeout <= 300000, 'PQRS_TIMEOUT_MS debe estar entre 1000 y 300000.');
  return { base: base.href.replace(/\/+$/, ''), auth: 'Basic ' + Buffer.from(`${user}:${password}`).toString('base64'), email, timeout };
}
async function request(method, endpoint, data, authenticated = false) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeout);
  try {
    const response = await fetch(config.base + '/webhook/' + endpoint, {
      method, redirect: 'error', signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(data === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(authenticated ? { Authorization: config.auth } : {}),
      },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    });
    const raw = await response.text();
    let body;
    try { body = JSON.parse(raw); } catch { body = null; }
    return { status: response.status, body };
  } catch (error) {
    throw new Error(error.name === 'AbortError' ? `Tiempo de espera agotado (${config.timeout} ms).` : `No se pudo completar la petición: ${error.message}`);
  } finally { clearTimeout(timer); }
}
function jsonResponse(response, expected, status = 'success') {
  assert.ok([].concat(expected).includes(response.status), `HTTP esperado ${[].concat(expected).join('/')} recibido ${response.status}.`);
  assert.ok(response.body && typeof response.body === 'object' && !Array.isArray(response.body), 'Se esperaba un objeto JSON.');
  assert.equal(response.body.status, status, 'El estado de la respuesta no coincide.');
  if (status === 'error') assert.equal(response.body.codigo, response.status);
  return response.body;
}
async function step(name, task) {
  currentStep = name;
  await task();
  passed += 1;
  console.log(`OK ${passed}. ${name}`);
}
async function list() {
  const body = jsonResponse(await request('GET', 'consultar-pqrs', undefined, true), 200);
  for (const key of ['total', 'urgentes', 'estandar', 'resueltos', 'en_gestion', 'activos', 'total_listado', 'limite_listado']) {
    assert.ok(Number.isInteger(body[key]) && body[key] >= 0, `KPI ${key} debe ser entero no negativo.`);
  }
  assert.ok(Array.isArray(body.tickets) && Array.isArray(body.agentes), 'Faltan tickets o agentes.');
  assert.equal(body.limite_listado, 100);
  assert.equal(body.total_listado, body.tickets.length);
  assert.equal(body.total_listado, Math.min(body.total, 100));
  assert.equal(body.urgentes + body.estandar, body.total);
  assert.ok(body.activos <= body.total && body.resueltos <= body.total && body.en_gestion <= body.activos);
  assert.ok(body.total === 0 ? body.cumplimiento_pct === null : typeof body.cumplimiento_pct === 'number' && body.cumplimiento_pct >= 0 && body.cumplimiento_pct <= 100, 'KPI de cumplimiento inválido.');
  return body;
}
function ownTicket(snapshot, ticketId) {
  assert.ok(createdIds.has(ticketId), 'La prueba solo puede gestionar tickets creados en esta ejecución.');
  const ticket = snapshot.tickets.find(item => item.ticket_id === ticketId);
  assert.ok(ticket, `El listado protegido no contiene el ticket propio ${ticketId}. Ejecute sin altas concurrentes.`);
  assert.ok(Number.isInteger(ticket.version) && ticket.version >= 1);
  assert.ok(Array.isArray(ticket.actividades));
  return ticket;
}
async function track(ticketId, token) {
  return request('GET', `consultar-ticket?id=${encodeURIComponent(ticketId)}&token=${encodeURIComponent(token)}`);
}
function timestamp(value, label) {
  assert.ok(typeof value === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)), `${label} debe ser fecha ISO con zona horaria.`);
}
function creation(response, payload, urgent, sla) {
  const body = jsonResponse(response, [201, 202]);
  assert.equal(body.codigo, response.status);
  assert.equal(body.guardada, true);
  assert.equal(body.duplicada, false);
  assert.equal(body.request_id, payload.request_id);
  assert.match(body.ticket_id, /^PQRS-\d{4}-\d{6,}$/);
  assert.match(body.tracking_token, UUID_V4);
  assert.equal(body.es_urgente, urgent);
  assert.equal(body.sla_horas, sla);
  timestamp(body.sla_fecha_limite, 'sla_fecha_limite');
  assert.ok(['ENVIADA', 'ERROR', 'SIN_CONFIRMAR'].includes(body.confirmacion_estado));
  assert.ok((urgent ? ['ENVIADA', 'ERROR', 'SIN_CONFIRMAR'] : ['NO_APLICA']).includes(body.alerta_estado));
  createdIds.add(body.ticket_id);
  return body;
}
function updatePayload(ticketId, agentId, version, changes = {}) {
  assert.ok(createdIds.has(ticketId), 'Prohibido modificar un ticket ajeno a esta ejecución.');
  return { ...fixture('payload_actualizar.json'), operation_id: randomUUID(), ticket_id: ticketId, agente_id: agentId, version, ...changes };
}
async function update(payload) {
  return request('POST', 'actualizar-ticket', payload, true);
}
function checkUpdate(response, payload, duplicate, expectedVersion) {
  const body = jsonResponse(response, 200);
  assert.equal(body.codigo, 200);
  assert.equal(body.duplicada, duplicate);
  assert.equal(body.ticket_id, payload.ticket_id);
  assert.equal(body.estado, payload.nuevo_estado);
  assert.equal(body.version, expectedVersion);
  return body;
}
async function run() {
  config = configuration();
  console.log('PRUEBAS DE INTEGRACIÓN PQRS — servicio real, sin simulación ni limpieza automática.');
  console.log('Se crearán dos tickets y se enviarán confirmaciones a PQRS_EMAIL_PRUEBA.');
  console.log('La alerta urgente se dirige al responsable configurado en el workflow.');
  const runId = randomUUID();
  const normalPayload = { ...fixture('payload_estandar.json'), request_id: randomUUID(), email: config.email, asunto: `Prueba estándar ${runId}` };
  const urgentPayload = { ...fixture('payload_urgente.json'), request_id: randomUUID(), email: config.email, asunto: `Prueba urgente ${runId}` };
  let baseline, normal, urgent, agent, initial, resolved, internal, final;
  const publicMessage = `Resolución pública de prueba ${runId}`;
  const privateMessage = `Nota interna de prueba ${runId}`;
  let resolution;

  await step('Listado y actualización rechazan acceso sin Basic Auth', async () => {
    assert.equal((await request('GET', 'consultar-pqrs')).status, 401);
    assert.equal((await request('POST', 'actualizar-ticket', {})).status, 401);
  });
  await step('Listado autorizado y línea base de persistencia', async () => {
    baseline = await list();
    agent = baseline.agentes.find(item => UUID.test(item.id) && typeof item.nombre === 'string' && item.nombre.length);
    assert.ok(agent, 'No hay un agente activo utilizable en el listado.');
  });
  await step('Solicitud inválida devuelve 400 sin guardar', async () => {
    const body = jsonResponse(await request('POST', 'radicar-pqrs', { ...fixture('payload_invalido.json'), request_id: randomUUID() }), 400, 'error');
    assert.equal(body.guardada, false);
    assert.ok(Array.isArray(body.errores) && body.errores.length > 0);
    assert.equal((await list()).total, baseline.total);
  });
  await step('Solicitud estándar persiste y ofrece seguimiento privado', async () => {
    normal = creation(await request('POST', 'radicar-pqrs', normalPayload), normalPayload, false, 24);
    const snapshot = await list();
    assert.equal(snapshot.total, baseline.total + 1);
    initial = ownTicket(snapshot, normal.ticket_id);
    assert.equal(initial.email, config.email.toLowerCase());
    assert.equal(initial.asunto, normalPayload.asunto);
    assert.equal(initial.tracking_token, normal.tracking_token);
    assert.equal(initial.estado, normal.estado);
    assert.equal(initial.fecha_resolucion, null);
    timestamp(initial.fecha_radicacion, 'fecha_radicacion');
    assert.equal(Date.parse(initial.sla_fecha_limite) - Date.parse(initial.fecha_radicacion), 24 * 3600000);
    const tracked = jsonResponse(await track(normal.ticket_id, normal.tracking_token), 200).ticket;
    assert.equal(tracked.ticket_id, normal.ticket_id);
    assert.equal(tracked.asunto, normalPayload.asunto);
    assert.ok(Array.isArray(tracked.timeline));
    assert.equal(Object.hasOwn(tracked, 'tracking_token'), false);
    assert.equal(Object.hasOwn(tracked, 'email'), false);
  });
  await step('Reintento de radicación conserva radicado y número de filas', async () => {
    const body = jsonResponse(await request('POST', 'radicar-pqrs', normalPayload), 200);
    assert.equal(body.guardada, true);
    assert.equal(body.duplicada, true);
    assert.equal(body.ticket_id, normal.ticket_id);
    assert.equal(body.tracking_token, normal.tracking_token);
    const snapshot = await list();
    assert.equal(snapshot.total, baseline.total + 1);
    assert.equal(ownTicket(snapshot, normal.ticket_id).actividades.length, initial.actividades.length);
  });
  await step('Mismo request_id con datos diferentes devuelve 409', async () => {
    const body = jsonResponse(await request('POST', 'radicar-pqrs', { ...normalPayload, asunto: 'Datos diferentes para el mismo identificador' }), 409, 'error');
    assert.equal(body.guardada, null);
    const snapshot = await list();
    assert.equal(snapshot.total, baseline.total + 1);
    assert.equal(ownTicket(snapshot, normal.ticket_id).asunto, normalPayload.asunto);
  });
  await step('Solicitud urgente persiste con SLA de cuatro horas', async () => {
    urgent = creation(await request('POST', 'radicar-pqrs', urgentPayload), urgentPayload, true, 4);
    assert.notEqual(urgent.ticket_id, normal.ticket_id);
    const snapshot = await list();
    assert.equal(snapshot.total, baseline.total + 2);
    const ticket = ownTicket(snapshot, urgent.ticket_id);
    assert.equal(ticket.es_urgente, true);
    assert.equal(ticket.sla_horas, 4);
    assert.equal(Date.parse(ticket.sla_fecha_limite) - Date.parse(ticket.fecha_radicacion), 4 * 3600000);
  });
  await step('Estado desconocido devuelve 400 sin cambiar versión', async () => {
    jsonResponse(await update(updatePayload(normal.ticket_id, agent.id, initial.version, { nuevo_estado: 'ESTADO_INEXISTENTE' })), 400, 'error');
    assert.equal(ownTicket(await list(), normal.ticket_id).version, initial.version);
  });
  await step('Clave incorrecta y radicado inexistente no revelan datos', async () => {
    for (const response of [await track(normal.ticket_id, randomUUID()), await track('PQRS-2000-000000', randomUUID())]) {
      const body = jsonResponse(response, 404, 'error');
      assert.equal(body.mensaje, 'Radicado o clave de consulta incorrectos');
      assert.equal(Object.hasOwn(body, 'ticket'), false);
    }
    const missing = { ...fixture('payload_actualizar.json'), operation_id: randomUUID(), ticket_id: 'PQRS-2000-000000', agente_id: agent.id, version: 1 };
    jsonResponse(await update(missing), 404, 'error');
  });
  await step('Resolución atómica con agente activo y nota pública', async () => {
    resolution = updatePayload(normal.ticket_id, agent.id, initial.version, { nuevo_estado: 'RESUELTO', mensaje_resolucion: publicMessage, es_nota_interna: false });
    checkUpdate(await update(resolution), resolution, false, initial.version + 1);
    resolved = ownTicket(await list(), normal.ticket_id);
    assert.equal(resolved.estado, 'RESUELTO');
    assert.equal(resolved.agente_asignado_id, agent.id);
    assert.equal(resolved.version, initial.version + 1);
    timestamp(resolved.fecha_resolucion, 'fecha_resolucion');
    assert.equal(resolved.actividades.length, initial.actividades.length + 1);
    assert.equal(resolved.actividades.filter(item => item.mensaje === publicMessage && item.autor === agent.nombre && item.es_nota_interna === false).length, 1);
    const ticket = jsonResponse(await track(normal.ticket_id, normal.tracking_token), 200).ticket;
    assert.equal(ticket.estado, 'RESUELTO');
    assert.equal(ticket.timeline.filter(item => item.mensaje === publicMessage).length, 1);
  });
  await step('Reintento de actualización no duplica actividad ni versión', async () => {
    checkUpdate(await update(resolution), resolution, true, resolved.version);
    const ticket = ownTicket(await list(), normal.ticket_id);
    assert.equal(ticket.version, resolved.version);
    assert.equal(ticket.fecha_resolucion, resolved.fecha_resolucion);
    assert.equal(ticket.actividades.length, resolved.actividades.length);
  });
  await step('Nota interna visible en panel y oculta en seguimiento', async () => {
    const payload = updatePayload(normal.ticket_id, agent.id, resolved.version, { nuevo_estado: 'RESUELTO', mensaje_resolucion: privateMessage, es_nota_interna: true });
    checkUpdate(await update(payload), payload, false, resolved.version + 1);
    internal = ownTicket(await list(), normal.ticket_id);
    assert.equal(internal.actividades.length, resolved.actividades.length + 1);
    assert.equal(internal.actividades.filter(item => item.mensaje === privateMessage && item.es_nota_interna === true).length, 1);
    const ticket = jsonResponse(await track(normal.ticket_id, normal.tracking_token), 200).ticket;
    assert.ok(!JSON.stringify(ticket).includes(privateMessage), 'La nota interna se filtró al seguimiento público.');
  });
  await step('Versión obsoleta devuelve 409 sin sobrescribir', async () => {
    jsonResponse(await update(updatePayload(normal.ticket_id, agent.id, resolved.version, { nuevo_estado: 'CERRADO', mensaje_resolucion: `Cambio obsoleto ${runId}` })), 409, 'error');
    const ticket = ownTicket(await list(), normal.ticket_id);
    assert.equal(ticket.version, internal.version);
    assert.equal(ticket.estado, internal.estado);
    assert.equal(ticket.actividades.length, internal.actividades.length);
  });
  await step('Reapertura elimina fecha de resolución y persiste', async () => {
    const payload = updatePayload(normal.ticket_id, agent.id, internal.version, { nuevo_estado: 'EN_GESTION', mensaje_resolucion: `Reapertura de prueba ${runId}`, es_nota_interna: false });
    checkUpdate(await update(payload), payload, false, internal.version + 1);
    final = await list();
    const ticket = ownTicket(final, normal.ticket_id);
    assert.equal(ticket.estado, 'EN_GESTION');
    assert.equal(ticket.fecha_resolucion, null);
    assert.equal(ticket.version, initial.version + 3);
    assert.equal(ticket.actividades.length, initial.actividades.length + 3);
    const tracked = jsonResponse(await track(normal.ticket_id, normal.tracking_token), 200).ticket;
    assert.equal(tracked.estado, 'EN_GESTION');
    assert.equal(tracked.fecha_resolucion, null);
    assert.ok(!JSON.stringify(tracked).includes(privateMessage));
  });
  await step('Conteos finales reflejan exactamente dos solicitudes nuevas', async () => {
    assert.equal(final.total, baseline.total + 2, 'Ejecute la batería sin radicaciones simultáneas.');
    assert.equal(final.urgentes, baseline.urgentes + 1);
    assert.equal(final.estandar, baseline.estandar + 1);
    assert.equal(final.resueltos, baseline.resueltos);
    assert.equal(final.activos, baseline.activos + 2);
    const ownInManagement = [normal, urgent].filter(item => ownTicket(final, item.ticket_id).estado === 'EN_GESTION').length;
    assert.equal(final.en_gestion, baseline.en_gestion + ownInManagement);
  });
  await step('SMTP registra aceptación de las dos confirmaciones y la alerta', async () => {
    const n = ownTicket(final, normal.ticket_id);
    const u = ownTicket(final, urgent.ticket_id);
    console.log(`  Correo: estándar=${n.confirmacion_estado}; urgente=${u.confirmacion_estado}; alerta=${u.alerta_estado}.`);
    assert.equal(n.confirmacion_estado, 'ENVIADA', 'Confirmación estándar pendiente o fallida; revise ejecución n8n y SMTP.');
    assert.equal(u.confirmacion_estado, 'ENVIADA', 'Confirmación urgente pendiente o fallida; revise ejecución n8n y SMTP.');
    assert.equal(u.alerta_estado, 'ENVIADA', 'Alerta urgente pendiente o fallida; revise ejecución n8n y SMTP.');
    assert.equal(n.alerta_estado, 'NO_APLICA');
  });
  console.log(`\nResultado: ${passed} comprobaciones completadas contra ${config.base}.`);
  console.log('Persistencia comprobada mediante listado protegido. ENVIADA indica aceptación SMTP, no llegada a bandeja.');
  console.log('Compruebe manualmente los dos acuses en el buzón de prueba y la alerta en el buzón del responsable.');
}

run().catch(error => {
  console.error(`\nFALLO en «${currentStep}»: ${error.message}`);
  console.error(`Comprobaciones anteriores correctas: ${passed}. La batería no se completó.`);
  console.error('No se borran solicitudes ni se reenvían correos automáticamente.');
  process.exitCode = 1;
}).finally(() => {
  if (createdIds.size) console.log(`Radicados creados por esta ejecución: ${[...createdIds].join(', ')}`);
});
