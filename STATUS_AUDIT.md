# Auditoría de estado — DocuMind & PQRS B2B

**Fecha:** 28/10/2026, America/Bogota. **Repositorio:** https://github.com/camachoab21-cmd/documind-pqrs-b2b. **Base examinada:** `main`, commit `58db32a9a8355b90a820ea3bb5bd55540943d21e`. El workspace estaba vacío; se clonó el repositorio con su historial. Alcance: inventario completo de archivos, contratos frontend/n8n/SQL, backend relacionado y diseño académico de semana 1. Las observaciones de implementación son estáticas salvo las comprobaciones expresamente registradas abajo.

## 1. Resumen ejecutivo

**Actualización 29/10/2026:** el diseño de semana 1 está integrado en React mediante `/semana-1`, con acceso público desde el login y enlace en el menú. Permite consultar el inventario, alternar arquitectura actual/propuesta y descargar el mismo PDF de dos páginas. Se instalaron las dependencias del frontend, compiló Vite y se ejecutaron 24 comprobaciones de navegador, todas aprobadas. Se corrigieron etiquetas del login, nombre del control de contraseña, foco visible y navegación de la tabla por teclado; se añadió respeto a movimiento reducido. Evidencia y límites en [PRUEBA_ESCRITORIO_SEMANA_1.md](docs/PRUEBA_ESCRITORIO_SEMANA_1.md). Las verificaciones originales siguientes corresponden al 28/10; la deuda de backend/n8n/DB no se da por resuelta con esta vista.

El sistema es más amplio que tres archivos: integra un portal HTML autónomo con cinco webhooks, una aplicación React, API Express, PostgreSQL, SMTP y servicios Gemini/Pinecone. Hay implementación de radicación, seguimiento, gestión, CSAT, documentos y chat. No hay evidencia de un despliegue conectado en esta sesión y existen divergencias entre los dos clientes. El workflow exportado está inactivo y no incluye credenciales asignadas.

La semana 1 queda cubierta documentalmente por [SEMANA_1_DISENO.pdf](docs/SEMANA_1_DISENO.pdf), con fuente [Markdown](docs/SEMANA_1_DISENO.md): cinco flujos inventariados, Ruta A elegida, lectura de formularios físicos PQRS y arquitectura propuesta. OCR, migración y despliegue siguen siendo trabajo futuro. No se presentan como funcionalidades implementadas.

## 2. Limpieza realizada y criterio de conservación

Se encontraron **15 archivos objetivo: 3 HTML, 10 JSON y 2 SQL**. No aparecieron los archivos `_2`, `_3`, `_4`, `_v4` ni nombres con hashes del ejemplo del encargo. Tampoco se encontraron duplicados exactos por SHA-256. Se conserva la revisión vigente disponible; no se certifica estabilidad funcional solo por el nombre o la fecha.

| Acción | Origen | Resultado y motivo |
|---|---|---|
| Renombrar | `formulario_pqrs.html` | `index.html`: portal autónomo vigente, conserva CSAT, asignación, CSV e identidad de reintentos. |
| Renombrar | `workflow/workflow_pqrs_soporte.json` | `workflow/n8n_workflow.json`: único workflow exportado; contenido intacto. |
| Actualizar referencias | `workflow/build_pqrs_workflow.js` y `docs/PANEL_SUSTENTACION.html` | Generación y cinco enlaces ajustados a los nombres nuevos. |
| Conservar | `frontend/index.html` | Entrada Vite/React, no duplica el portal autónomo. |
| Conservar | Los dos SQL de `database/` | PQRS y DocuMind definen tablas distintas y Compose ejecuta ambos. |
| Conservar | Manifiestos, locks, fixtures, devcontainer y documentación | Son dependencias, pruebas o documentos distintos, no versiones obsoletas. |

**Archivos eliminados definitivamente por obsolescencia: ninguno.** Los dos nombres antiguos desaparecen por renombrado. Borrar el portal por parecer antiguo perdería funciones que React aún no ofrece. El generador JS contiene la definición fuente del JSON y permite reproducirlo; no es basura temporal. No se borró historial Git, pruebas, esquemas ni documentación.

## 3. Radiografía del sistema actual

### 3.1 Frontend HTML autónomo — `index.html`

Vistas de radicación, comprobante, seguimiento/timeline, workspace de agentes, gestión de ticket, login de funcionario y CSAT. Ofrece filtros, KPIs, selección de agente, notas internas/públicas y CSV limitado a los últimos 100 registros. Los ejemplos del formulario rellenan entradas; no acreditan tickets persistidos.

Consume los cinco webhooks del inventario siguiente. La URL de n8n se configura en pantalla y se guarda en `localStorage`; `sessionStorage` conserva `request_id`, `operation_id`, payloads pendientes y comprobantes. Tickets y métricas provienen del servidor; Basic Auth permanece en memoria. Hay timeout de 30 s, control de cambio de host, validación de respuesta y reutilización del identificador cuando el resultado es incierto (`index.html:1674–1733, 2154–2187`). La selección visual de agente no equivale por sí sola a un permiso individual en servidor.

### 3.2 React + Express

`frontend/index.html` arranca `src/main.jsx`. `src/App.jsx:26–40, 62–80` define `/login`, `/radicar`, `/pqrs`, `/ingesta`, `/chat` y `/dashboard`; dashboard exige ADMIN en la interfaz. `AuthContext.jsx` restaura usuario/JWT de `localStorage`; el backend valida las peticiones. Datos de pantallas y filtros permanecen en estado React. La ingesta consulta cada 5 s y el dashboard cada 10 s; la barra de progreso de carga es estimada, no telemetría de OCR.

`frontend/src/services/api.js` usa Axios con `/api`, añade JWT y limpia sesión ante 401. Vite redirige `/api` a `localhost:5000`. El portal público radica directamente en `localhost:5678`; seguimiento privado pasa por Express. La API incluye:

| Grupo | Endpoints observados |
|---|---|
| Auth | POST `/api/auth/login`, POST `/register` (ADMIN), GET `/me`. |
| PQRS | GET `/api/pqrs`, `/kpis`, `/:ticketId`; POST `/:ticketId/tracking`; PUT `/:ticketId/estado`; GET/POST de descarga de documentos del ticket. |
| Documentos | POST `/api/documents/upload`; GET listado, detalle y `/:id/archivo`; DELETE `/:id`. |
| Chat | POST `/api/chat/query`; GET/POST `/threads`; GET mensajes y DELETE hilo. |
| Repositorios y TI | GET/POST/DELETE `/api/repositories`; GET `/api/logs` y `/dashboard` (ADMIN); GET `/api/health`. |

Ingesta procesa texto PDF, DOCX y TXT, clasifica, genera resumen/metadatos y embeddings e intenta indexar en Pinecone. No acepta fotos como módulo de visión y extraer bytes imprimibles de un PDF no equivale a OCR. El chat incorpora consulta, fuentes e hilos; tiene respuestas de respaldo heurísticas. Gemini, Pinecone y SMTP requieren configuración externa. El simulador de `tests/` no prueba persistencia PostgreSQL ni entrega real de correo.

### 3.3 Middleware n8n

Un workflow, `active: false`, **44 nodos**: 5 webhook, 18 code, 6 if, 8 postgres, 2 emailSend SMTP y 5 respondToWebhook. **Cero nodos Gmail, IA, cron o schedule.** Todas las credenciales deben asignarse después de importar. Configuración: `America/Bogota`, timeout de 120 s, almacenamiento de ejecuciones exitosas y fallidas.

| ID | Método / webhook | Autenticación | Pasos, servicios y resultado |
|---|---|---|---|
| F01 | POST `/webhook/radicar-pqrs` | Ninguna | Validar/normalizar → reglas de tipo, área y urgencia → `pqrs_radicar` → SMTP cliente y supervisor si urgente → registrar resultado → radicado/token/SLA. HTTP 201/202; reintento idéntico 200; payload cambiado 409. |
| F02 | GET `/webhook/consultar-pqrs` | Basic Auth | `pqrs_listar` → tickets, agentes, KPIs; límite de 100 tickets. |
| F03 | GET `/webhook/consultar-ticket` | Radicado + token en query | `pqrs_tracking` → ticket y actividades públicas; 400/404/503 según error. |
| F04 | POST `/webhook/actualizar-ticket` | Basic Auth | Validar datos → `pqrs_actualizar` con versión/operación/agente → historial y estado, o conflicto 409. |
| F05 | POST `/webhook/calificar-ticket` | Radicado + token en body | `pqrs_calificar` → CSAT 1–5 de ticket resuelto/cerrado y actividad. |

**SQL parametrizado:** la propiedad exportada es `parameters.options.queryReplacement`, no `queryParams`. Se usan `$1…$4` y expresiones que devuelven arrays. F01/F04 serializan un JSON como único parámetro; F03 recibe texto y UUID; F05 texto, UUID, entero y texto. El listado no necesita parámetros. No se interpola el cuerpo del usuario dentro de las sentencias SQL. La versión de los nodos y el comportamiento del export deben validarse con la versión de n8n instalada; `latest` no fija esa versión.

**Errores y reintentos:** seis nodos PostgreSQL derivan por salida de error; los dos de resultado SMTP continúan por salida regular. SMTP usa `continueRegularOutput`; los nodos posteriores comprueban destinatarios aceptados/rechazados y distinguen `ENVIADA`, `ERROR` y `SIN_CONFIRMAR`. Aceptación SMTP no demuestra entrega al buzón. Hay idempotencia y reintento solicitado por cliente, pero ningún `retryOnFail` configurado ni cola durable para reenvíos. No existe un trabajo periódico de SLA: el escalamiento se ejecuta al radicar un urgente.

### 3.4 PostgreSQL

`database/init_db.sql` abre/cierra una transacción, habilita `uuid-ossp`, crea tres enums (las columnas de PQRS usan VARCHAR + CHECK, no esos enums), secuencia de radicados y:

| Tabla | Responsabilidad |
|---|---|
| `usuarios_agentes` | UUID, nombre, correo, área, rol, activo; no es la tabla de login. |
| `pqrs_solicitudes` | Ticket, campos duales, SLA, estado, agente, CSAT, versión, UUID de petición/seguimiento y estado de correos. |
| `pqrs_actividades` | Historial, notas, estados, UUID de operación, payload y versión resultante. |

Dos triggers: `trg_sync_pqrs_columns` sincroniza nombres duales y `trg_update_pqrs_solicitudes_timestamp` actualiza `updated_at`. Diez índices explícitos: siete de consulta (`ticket_id`, estado, prioridad, urgente, límite SLA, departamento, actividades por ticket) y tres únicos de request, tracking y operación. `idx_pqrs_ticket_id` es redundante con el índice UNIQUE del ticket. Restricciones de estado, prioridad, tipo, correos, versión y puntuación; claves foráneas a agente/ticket. Semilla: tres agentes ficticios; **cero solicitudes**.

Ocho funciones: dos de trigger y `pqrs_radicar`, `pqrs_registrar_correo`, `pqrs_listar`, `pqrs_tracking`, `pqrs_actualizar`, `pqrs_calificar`. Radicación usa bloqueo por petición, secuencia, token y payload para idempotencia. Urgencia: prioridad Alta/Crítica o Reclamo. SLA: Crítica 2 h; Alta o Reclamo 4 h; Baja 48 h; resto 24 h, horas corridas. Actualización bloquea ticket y comprueba versión/operación; no define una matriz de transiciones entre estados.

`database/documind_postgres_schema.sql` añade nueve tablas: `usuarios`, `repositorios`, `documentos`, `metadatos_extraidos`, `logs_errores`, `consultas_logs`, `chat_threads`, `chat_messages` y `documentos_chunks`. Total del sistema: **12 tablas**. Define PK, UNIQUE y algunas FK; no crea triggers ni índices adicionales explícitos. Semilla: cinco usuarios con hash compartido de demostración y un repositorio con id=1. Los `ticket_id` de documentos/hilos no tienen FK y los logs carecen de algunas FK. La tabla de chunks existe, pero la ingesta inspeccionada escribe sus fragmentos en Pinecone, no en esa tabla.

## 4. Correspondencia de campos y hallazgos

| Entrada frontend | n8n / API | Persistencia | Diagnóstico |
|---|---|---|---|
| `nombre`, `email`, `telefono` | n8n los normaliza como `cliente_*` | Alias `nombre_solicitante`, `email_solicitante`, `telefono` sincronizados por trigger | Compatible; los alias no son por sí mismos un bug. |
| `tipo_solicitud` | n8n → `tipo` con tildes/capitalización | `tipo` y `tipo_solicitud` | Compatible por trigger y normalización. |
| `prioridad` | Portal: `Alta`; filtro React: `ALTA` | CHECK: `Baja/Media/Alta/Crítica` | Filtro React incompatible con igualdad SQL exacta. |
| `documento_id` al radicar | Clasificador n8n no lo incorpora a `datos` | `documentos.ticket_id` | No se vincula adjunto con ticket en este flujo. |
| `nota`, `nuevo_estado` en React | PUT Express directo | Actividad + UPDATE separados | No equivale a `mensaje_resolucion`, `agente_id`, `operation_id`, `version` de F04. |
| Token de seguimiento | n8n `token`; Express `tracking_token` | UUID `tracking_token` | Contratos distintos, válidos si se usa el endpoint correspondiente. |

| ID / prioridad | Evidencia | Hallazgo y consecuencia / comprobación pendiente |
|---|---|---|
| H01 / Alta | `PortalRadicacionPublica.jsx:100–113`; `documents.routes.js:81–83` | Carga pública usa Axios sin JWT contra ruta autenticada; captura el error y continúa. La petición puede terminar sin el adjunto. Probar radicación anónima con archivo. |
| H02 / Alta | `PortalRadicacionPublica.jsx:117–145`; nodo clasificador | `documento_id` descartado, UUID nuevo en cada envío y radicado aleatorio de respaldo si falta el del servidor. Se pueden duplicar intentos o mostrar un comprobante ficticio ante respuesta incompleta. |
| H03 / Alta | `pqrs.controller.js:204–235`; `pqrs.routes.js:26` | PUT solo exige JWT y omite control de rol específico, versión, operación y agente autenticado; acepta nombre de autor del body. UPDATE e INSERT no son una transacción. Reabrir conserva fecha de resolución por COALESCE. Comprobar paridad con F04 antes de migrar. |
| H04 / Media | `GestionPqrs.jsx:31–36, 204–207, 256`; `pqrs.controller.js:25–27`; `init_db.sql:204` | Filtros y badges en mayúsculas no coinciden con prioridades guardadas. Seleccionar Alta puede devolver lista vacía. |
| H05 / Alta | `PortalRadicacionPublica.jsx:130`; `api.js:4`; visores en `ChatRAG.jsx:138`, `IngestaDocumental.jsx:89` | URL n8n y visores fijadas a localhost; `VITE_API_BASE_URL` del ejemplo no se lee. Fallan en un servidor remoto sin ajustes. |
| H06 / Media | Correo F01; `docker-compose.yml:35`; `App.jsx:70–78` | Enlace de correo por defecto apunta a `/#token=...`; la pantalla pública está en `/radicar`. Un visitante puede terminar en login sin abrir seguimiento. Configurar base del portal con ruta correcta. |
| H07 / Alta | Workflow: credenciales ausentes, activo=false; Compose:24,40 | Importación no implica ejecución: faltan credenciales PostgreSQL/SMTP/Basic Auth y activación. Volumen n8n depende de `../vafel-sweet/n8n_data`; no es autocontenido. `latest` impide reproducibilidad de versión. |
| H08 / Alta | `gemini.service.js:119–128,354,368–406`; `documents.controller.js:245–253`; `pinecone.service.js:43–45` | Confianza calculada artificialmente y acotada a ≥70%; fallback vectorial hash no es embedding semántico; páginas estimadas. Se puede indicar COMPLETADO sin indexación. No usar estas cifras como precisión medida de IA. |
| H09 / Alta | `documents.controller.js:43–84`; `documents.routes.js` | No hay captura/interpretación de imágenes ni OCR. PDF escaneado puede llegar a fallback de bytes imprimibles. Visión es pendiente del tercer corte. |
| H10 / Media | `documind_postgres_schema.sql:17–44` | Reejecutar semilla restablece hashes de contraseñas; insertar repositorio id=1 no avanza su secuencia SERIAL. La primera creación normal puede colisionar con id=1. Verificar en DB limpia. |
| H11 / Alta | Workflow F02/F04 y `usuarios_agentes` | Basic Auth del webhook no está ligado a la identidad UUID del agente seleccionado. La selección y filtros visuales no acreditan RBAC individual ni aislamiento entre empresas; no existe `tenant_id`. |
| H12 / Media | Workflow F03 y settings | El token viaja en query al webhook y se guardan todas las ejecuciones con datos; revisar retención, accesos y logs. La API Express privada ya admite token en body/header. |
| H13 / Media | `ejecutar_pruebas.bat`, prueba de conexión | El probe espera éxito HTTP pero el ticket inexistente debe responder 404. Puede declarar caído un servicio sano y ofrecer simulador. Una prueba del simulador no acredita integración real. |
| H14 / Media | Workflow / API / pantallas React | CSAT y asignación/versionado existen en portal autónomo/SQL pero no tienen paridad completa en React. No retirar `index.html` antes de cubrirlos. No hay reintentos automáticos de correo ni monitor de vencimiento. |

Los hallazgos quedan registrados para la próxima iteración; esta limpieza no modifica las reglas de negocio ni afirma corregirlos. Las contraseñas de demostración y configuración local presentes en el repositorio original no deben interpretarse como credenciales de producción.

## 5. Checklist de salud técnica

| Enlace o control | Estado | Evidencia / límite |
|---|---|---|
| HTML → contratos n8n | Compatible estáticamente | Cinco rutas, identidad de reintentos y tokens; ejecución real pendiente. |
| React → Express | Parcial | Rutas presentes; discrepancias de adjunto, prioridad y actualización descritas. |
| React → n8n | Parcial | Radicación presente, URL local fija y comprobante de respaldo. |
| n8n → PostgreSQL | Compatible estáticamente | Ocho consultas parametrizadas y funciones SQL existentes; DB real no probada. |
| Express → PostgreSQL | Implementado, parcial | Adaptador traduce `?` a `$n`; divergencias en F04 y semillas. |
| n8n → SMTP | Pendiente de configuración | Dos nodos sin credenciales asignadas; sin correo enviado en esta auditoría. |
| IA / RAG | Implementado con degradación | Gemini/Pinecone y heurísticas; proveedor real y calidad no probados. |
| Visión del tercer corte | Diseñada | No implementada; no hay 20 imágenes ni métricas medidas. |
| Separación multiempresa | No demostrada | Roles/departamentos no sustituyen aislamiento de tenants. |
| Semana 1 | Entrega documental | Inventario + Ruta A + caso de visión + arquitectura en PDF de dos páginas. |

## 6. Tablero base y trazabilidad académica

| ID | Fase SDLC | Tarea / Épica | Componente (Front/n8n/DB) | Prioridad | Estado: TODO / IN PROGRESS / TESTING / DONE |
|---|---|---|---|---|---|
| S1-01 | Análisis | Inventariar cinco flujos y servicios externos | n8n/DB | Alta | DONE |
| S1-02 | Diseño | Elegir Ruta A y justificar frente a Ruta B | Front/n8n/DB | Alta | DONE |
| S1-03 | Diseño | Elegir lectura de formularios físicos PQRS | Front/DB | Alta | DONE |
| S1-04 | Diseño | Documento de 1–2 páginas y diagrama | Front/n8n/DB | Alta | DONE |
| AUD-01 | Mantenimiento | Inventario, nombres vigentes y reporte | Front/n8n/DB | Alta | DONE |
| REQ-___ | Por definir | Nuevo requisito del próximo backlog | Front / n8n / DB | Por definir | TODO |

Plantilla para copiar sin asumir nuevas tareas:

| ID | Fase SDLC | Tarea / Épica | Componente (Front/n8n/DB) | Prioridad | Estado: TODO / IN PROGRESS / TESTING / DONE |
|---|---|---|---|---|---|
| | | | | | TODO |

## 7. Verificación y límites de la entrega

Los resultados de validación final, inventario por archivo y árbol final se registran a continuación. No se instalaron dependencias de la aplicación, no se levantó Docker, no se cambiaron bases de datos ni se enviaron correos. Las suites Jest, build React y pruebas contra n8n/PostgreSQL reales quedan pendientes; no se necesitan para acreditar un diseño de semana 1, pero sí antes de afirmar que el sistema está operativo. El PDF de la guía se utilizó como fuente de requisitos, no como autorización para ejecutar las semanas siguientes.

### Resultados comprobados

- JSON: 10 archivos analizados; grafo de 44 nodos sin referencias rotas.
- Generador: `node workflow/build_pqrs_workflow.js`; exportación idéntica byte a byte al blob Git original; el checkout de Windows tenía saltos CRLF, normalizados a LF por el generador.
- Sintaxis: `node --check` sobre 31 archivos JS; compilación aislada de 18 nodos Code y 1 script HTML; sin errores. Esto no ejecuta JSX ni sustituye el build React.
- Contratos: 6 casos locales de validación aprobados (estándar, urgente, inválido, Crítica, Baja y actualización); sin servicios externos.
- Funciones PostgreSQL invocadas por el workflow encontradas en el esquema; consultas con valores usan placeholders y `queryReplacement`.
- Cinco enlaces del panel actualizados; nombres anteriores ausentes del código ejecutable.
- `git diff --check`: sin errores de espacios. HTML y JSON renombrados conservan el contenido original (normalizando saltos de línea).
- PDF de diseño: dos páginas verificadas y renderizadas con Poppler; ambas revisadas visualmente, sin texto cortado, tablas desbordadas ni solapamientos.
- Publicación: `.gitattributes` marca los PDF como binarios para conservar sus bytes en los checkouts de Windows.

### Inventario final HTML / JSON / SQL

| Archivo | SHA-256 (16 caracteres) | Decisión |
|---|---|---|
| `.devcontainer/devcontainer.json` | `1c270ed4fb40fa7e` | Conservar: componente, configuración o fixture vigente |
| `backend/package-lock.json` | `1a5cf6694a5ff803` | Conservar: componente, configuración o fixture vigente |
| `backend/package.json` | `0acb2f22f2685f0b` | Conservar: componente, configuración o fixture vigente |
| `database/documind_postgres_schema.sql` | `1df75761546e2c7b` | Conservar: componente, configuración o fixture vigente |
| `database/init_db.sql` | `2ac32af33e22bcd1` | Conservar: componente, configuración o fixture vigente |
| `docs/PANEL_SUSTENTACION.html` | `2eb59935af697b04` | Conservar: componente, configuración o fixture vigente |
| `frontend/index.html` | `b69daa9bf86e3e11` | Conservar: componente, configuración o fixture vigente |
| `frontend/package-lock.json` | `8e53af1c4a49f1ea` | Conservar: componente, configuración o fixture vigente |
| `frontend/package.json` | `b44f06718449429b` | Conservar: componente, configuración o fixture vigente |
| `index.html` | `e91d516bb974be36` | Conservar: componente, configuración o fixture vigente |
| `tests/payload_actualizar.json` | `2c7a16cb9feedd17` | Conservar: componente, configuración o fixture vigente |
| `tests/payload_estandar.json` | `dded47704eda45d2` | Conservar: componente, configuración o fixture vigente |
| `tests/payload_invalido.json` | `f24fef7cac0280f7` | Conservar: componente, configuración o fixture vigente |
| `tests/payload_urgente.json` | `7df3151876ce6d9c` | Conservar: componente, configuración o fixture vigente |
| `workflow/n8n_workflow.json` | `8bc331165863a413` | Conservar: componente, configuración o fixture vigente |

### Estructura final completa (sin metadatos `.git/`)

```text
.devcontainer/devcontainer.json
.gitattributes
.gitignore
backend/.env.example
backend/.gitignore
backend/__tests__/documind.test.js
backend/__tests__/pqrs.test.js
backend/__tests__/secrets.test.js
backend/__tests__/security_remediation.test.js
backend/__tests__/stabilization.test.js
backend/app.js
backend/config/db.js
backend/controllers/auth.controller.js
backend/controllers/chat.controller.js
backend/controllers/documents.controller.js
backend/controllers/logs.controller.js
backend/controllers/pqrs.controller.js
backend/controllers/repositories.controller.js
backend/middleware/auth.middleware.js
backend/package-lock.json
backend/package.json
backend/routes/auth.routes.js
backend/routes/chat.routes.js
backend/routes/documents.routes.js
backend/routes/logs.routes.js
backend/routes/pqrs.routes.js
backend/routes/repositories.routes.js
backend/server.js
backend/services/gemini.service.js
backend/services/pinecone.service.js
backend/utils/secrets.js
database/documind_postgres_schema.sql
database/init_db.sql
detener_documind_pqrs.bat
docker-compose.prod.example.yml
docker-compose.yml
docs/DRP_PLAN_RECUPERACION.md
docs/GUION_DEMO_DOCUMIND.md
docs/INFORME_FINAL_ENTREGA_DOCUMIND.md
docs/MATRIZ_ACEPTACION_DOCUMIND.md
docs/nginx.conf.example
docs/PANEL_SUSTENTACION.html
docs/PREGUNTAS_DEFENSA_DOCUMIND.md
docs/PRESENTACION_DOCUMIND.md
docs/PRUEBA_ESCRITORIO_SEMANA_1.md
docs/evidencias/semana1-escritorio.jpg
docs/evidencias/semana1-resultados.json
docs/RESUMEN_EJECUTIVO_DOCUMIND.md
docs/SEMANA_1_DISENO.md
docs/SEMANA_1_DISENO.pdf
ejecutar_pruebas.bat
frontend/.env.example
frontend/.gitignore
frontend/index.html
frontend/package-lock.json
frontend/package.json
frontend/postcss.config.js
frontend/src/App.jsx
frontend/src/components/ProtectedRoute.jsx
frontend/src/components/Sidebar.jsx
frontend/src/context/AuthContext.jsx
frontend/src/index.css
frontend/src/main.jsx
frontend/src/pages/ChatRAG.jsx
frontend/src/pages/DashboardTI.jsx
frontend/src/pages/GestionPqrs.jsx
frontend/src/pages/IngestaDocumental.jsx
frontend/src/pages/Login.jsx
frontend/src/pages/PortalRadicacionPublica.jsx
frontend/src/pages/SemanaUno.jsx
frontend/src/services/api.js
frontend/tailwind.config.js
frontend/vite.config.js
index.html
iniciar_documind_pqrs.bat
README.md
STATUS_AUDIT.md
tests/payload_actualizar.json
tests/payload_estandar.json
tests/payload_invalido.json
tests/payload_urgente.json
tests/probar_solicitudes.js
tests/servidor_simulador.js
workflow/build_pqrs_workflow.js
workflow/n8n_workflow.json
```

### Próximos insumos, fuera de semana 1

Para integración real: variables de entorno, credenciales n8n/SMTP y una base de pruebas. Para semanas 3–4: 20 fotos con datos ficticios o autorización y servidor disponible para OCR/modelo local. No se solicitaron secretos para esta entrega documental. La guía deja las fechas exactas al docente; no se inventó una fecha límite.
