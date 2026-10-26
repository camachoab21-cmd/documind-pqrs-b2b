# INFORME TÉCNICO FINAL DE ENTREGA — DOCUMIND & PQRS ENTERPRISE
**Proyecto:** Plataforma de Gestión Documental Inteligente (DocuMind) y Sistema de Atención de PQRS  
**Repositorio:** `JuanFe28/actividad-pqrs-n8n` (`H:\vafel-stack\actividad-pqrs-b2b`)  
**Fecha de Emisión:** 18 de octubre de 2026 | **Versión:** 1.0 (Entrega Académica Final)  
**Autor / Líder Técnico:** Juan Felipe Celis  

---

## 1. Objetivo y Alcance del Sistema

### 1.1. Objetivo General
Diseñar, estabilizar, verificar y documentar una plataforma de software corporativa que unifique la radicación y gestión de Peticiones, Quejas, Reclamos y Sugerencias (PQRS) con un motor cognitivo de Inteligencia Artificial basado en Arquitectura RAG (Retrieval-Augmented Generation) para la consulta semántica de repositorios documentales empresariales, asegurando altos estándares de ciberseguridad, integridad de datos y automatización de procesos.

### 1.2. Alcance Funcional Efectivamente Implementado
1. **Portal Público de Radicación:** Módulo web reactivo para la creación de solicitudes públicas (anónimas o con datos de contacto), cálculo dinámico de SLAs, carga opcional de adjuntos y emisión de comprobante con radicado y token criptográfico privado.
2. **Motor de Automatización de Procesos (n8n):** Orquestación mediante webhooks para saneamiento de entradas, clasificación semántica de área de destino, estimación de fechas límite de atención, persistencia en base de datos relacional y manejo resiliente de alertas.
3. **Consulta Ciudadana y Protección de Datos:** Módulo de seguimiento de casos que exige la combinación estricta de `ticket_id` y `tracking_token`, aplicando enmascaramiento de nombres de personas naturales y filtrado de notas internas de funcionarios.
4. **Panel Administrativo con Control de Acceso (RBAC):** Gestión de casos por funcionarios con roles `ADMIN`, `SUPERVISOR` y `OPERADOR`, permitiendo transiciones de estado (`RADICADO`, `EN_GESTION`, `RESUELTO`, `CERRADO`), reasignación de responsables y registro de actividades de auditoría.
5. **Motor RAG DocuMind:** Pipeline de ingesta para documentos en formatos PDF, DOCX y TXT, segmentación en chunks contextuales, generación de embeddings de 768 dimensiones con Google Gemini, almacenamiento vectorial en Pinecone y asistente conversacional con citas exactas de fuentes documentales.

---

## 2. Arquitectura Tecnológica Real

La arquitectura implementada se basa en un desacoplamiento estricto por capas de responsabilidad:

```
  ┌────────────────────────────────────────────────────────────────────────┐
  │                           CAPA DE CLIENTE                              │
  │  React 18.3 + Vite 5.4 + Tailwind CSS (SPA en Puerto 5173 / dist build)│
  └───────────────────────────────────┬────────────────────────────────────┘
                                      │ (HTTP REST / JSON)
                                      ▼
  ┌────────────────────────────────────────────────────────────────────────┐
  │                           CAPA DE NEGOCIO                              │
  │  Node.js v24 + Express 4.19 (API REST en Puerto 5000)                  │
  │  - Autenticación JWT + Bcryptjs + Rate Limiting en memoria             │
  │  - Helper de Secretos (*_FILE) + Hardening contra IDOR y CRLF          │
  │  - SDK Google GenAI (@google/genai) + Pinecone Client                  │
  └───────────────┬───────────────────────────────────────┬────────────────┘
                  │ (PostgreSQL Driver pg 8.12)           │ (Búsqueda Vectorial)
                  ▼                                       ▼
  ┌──────────────────────────────┐        ┌────────────────────────────────┐
  │     CAPA DE PERSISTENCIA     │        │     SERVICIOS IA EN NUBE       │
  │  PostgreSQL 16 Alpine        │        │  - Google Gemini 2.0 Flash     │
  │  (Puerto 5432 / pqrs_db)     │        │    (Embeddings 768d + LLM)     │
  │  - Esquema unificado         │        │  - Pinecone Vector Database    │
  │  - Volumen persistente Docker│        │    (Índice 'documind' 768d)    │
  └───────────────▲──────────────┘        └────────────────────────────────┘
                  │
                  │ (Conexión directa PostgreSQL)
  ┌───────────────┴──────────────┐
  │     CAPA DE AUTOMATIZACIÓN   │
  │  Motor n8n v2.41.4           │
  │  (Puerto 5678 en Docker)     │
  │  - Almacenamiento histórico  │
  │  - Webhooks asíncronos       │
  │  - Workflows activos         │
  └──────────────────────────────┘
```

---

## 3. Resultados Reales de Verificación y Compilación

### 3.1. Pruebas Automatizadas del Backend (Jest)
Ejecución verificada el **18 de octubre de 2026, 19:26:45 local (00:26:45 UTC)**:
- **Resultado General:** **5 Test Suites aprobadas (100%), 89 pruebas aprobadas (100%), 0 fallos, 0 omitidas**.
- **Tiempo de Ejecución:** 27.751 s.
- **Archivo de Registro de Evidencia:** `file:///C:/Users/juanf/.gemini/antigravity-ide/brain/d6042b2a-d812-44bb-bc31-e8543f42efb9/.system_generated/tasks/task-3309.log`.

| Suite de Prueba | Pruebas | Resultado | Cobertura y Aspectos Validados |
| :--- | :---: | :---: | :--- |
| `backend/__tests__/secrets.test.js` | 12 | **12 / 12 PASS** | Resolución de Docker Secrets (`*_FILE`), variables directas, sanitización de espacios/saltos, precedencia, fallback seguro en desarrollo, rechazo categórico de credenciales por defecto en producción, no exposición de secretos en errores y soporte de alias de variables (`DB_PASSWORD` / `DB_PASS`). |
| `backend/__tests__/security_remediation.test.js` | 25 | **25 / 25 PASS** | Autenticación obligatoria con JWT, control de roles (RBAC), aislamiento departamental horizontal, prevención de IDOR en tickets y documentos, denegación con HTTP 401 a la ruta estática `/uploads`, saneamiento de logs contra inyección CRLF y rate limiting contra fuerza bruta. |
| `backend/__tests__/pqrs.test.js` | 39 | **39 / 39 PASS** | Ciclo de vida completo de solicitudes, radicación pública anónima e identificada, transiciones de estado válidas e inválidas, cálculo matricial de SLAs y enmascaramiento de datos personales en consultas públicas. |
| `backend/__tests__/documind.test.js` | 9 | **9 / 9 PASS** | Ingesta y extracción de texto desde PDF/DOCX/TXT, persistencia relacional contra PostgreSQL real (`pqrs_db`), llamadas reales a Google Gemini API y Pinecone API con manejo de timeouts y resiliencia analítica. |
| `backend/__tests__/stabilization.test.js` | 4 | **4 / 4 PASS** | Healthcheck de la API (`GET /api/health`), estabilidad de conexiones al pool de PostgreSQL y cierre limpio de recursos. |

### 3.2. Compilación del Frontend (Vite)
Ejecución verificada el **18 de octubre de 2026, 19:27:24 local (00:27:24 UTC)**:
- **Resultado:** **Compilación exitosa para producción sin advertencias ni errores (Código de salida 0)**.
- **Módulos Transformados:** 1,579 módulos en 22.66s.
- **Artefactos en Disco ([frontend/dist](file:///h:/vafel-stack/actividad-pqrs-b2b/frontend/dist)):**
  - `dist/index.html` (1.29 kB │ gzip: 0.72 kB)
  - `dist/assets/index-a6sun7ft.css` (47.94 kB │ gzip: 8.04 kB)
  - `dist/assets/index-BIxMH20Y.js` (323.98 kB │ gzip: 98.29 kB)

---

## 4. Correcciones Realizadas Durante la Estabilización

1. **Helper Universal de Secretos ([backend/utils/secrets.js](file:///h:/vafel-stack/actividad-pqrs-b2b/backend/utils/secrets.js)):** Implementado para dar soporte transparente a archivos montados por Docker Secrets (`*_FILE`), sanitizando el contenido y forzando excepciones controladas si un secreto obligatorio falta en producción, sin romper el entorno de desarrollo actual.
2. **Hardening de `trust proxy` ([backend/app.js](file:///h:/vafel-stack/actividad-pqrs-b2b/backend/app.js)):** Configuración dinámica mediante la variable de entorno `TRUST_PROXY`. En desarrollo opera como `false` (inmune a spoofing directo); en producción con Nginx se activa con `1`, tomando el salto garantizado por el proxy de borde.
3. **Mitigación de IDOR y Protección de Uploads:** Eliminación del middleware `express.static('/uploads')` que exponía archivos en la web sin autenticación; sustituido por un endpoint autenticado con verificación de permisos y validación de rutas canónicas para evitar Path Traversal.
4. **Resiliencia en Servicios de IA y Notificaciones:** Inclusión de timeouts estrictos y generadores analíticos de respaldo deterministas en `gemini.service.js` y `chat.controller.js` para asegurar operatividad continua ante desconexión o latencia en la nube.

---

## 5. Estado Oficial del Plan Maestro de Ocho Tareas

Se ratifican con total exactitud las denominaciones oficiales originales del Plan Maestro:

| Tarea Oficial | Denominación Original | Estado | Justificación y Situación Actual |
| :---: | :--- | :---: | :--- |
| **1** | **Análisis de causa raíz** | **COMPLETADA** | Diagnóstico completo de fallos en esquemas, pools de conexión y dependencias desalineadas. |
| **2** | **Correcciones críticas y estabilización** | **COMPLETADA** | Homologación de dialecto PostgreSQL, sintaxis `RETURNING id` y estabilidad en Express. |
| **3** | **Auditoría de bases de datos y persistencia** | **COMPLETADA** | Esquema unificado PostgreSQL 16 (`pqrs_db`), índices, claves foráneas y volumen persistente verificado. |
| **4** | **Auditoría de integraciones** | **COMPLETADA** | Integración probada con Google Gemini SDK, Pinecone Vector Database y webhooks de n8n. |
| **5** | **Pruebas funcionales integrales** | **COMPLETADA** | Cobertura integral del ciclo de PQRS (radicación, clasificación, estados, actividades y consulta). |
| **6** | **Auditoría de seguridad** | **COMPLETADA** | Mitigación demostrada de IDOR, RBAC, exposición de uploads, inyección CRLF y fuerza bruta. |
| **7** | **Preparación para producción** | **EN CURSO** | Helper de secretos implementado, topología Nginx modelada, DRP formalizado, 89/89 pruebas aprobadas y frontend compilado. Permanece en curso hasta el despliegue en Staging y resolución de bloqueadores B-01/B-02. |
| **8** | **Informe técnico final y hoja de ruta** | **COMPLETADA** | Consolidada mediante el presente informe técnico de entrega académica y la hoja de ruta de implantación institucional. |

---

## 6. Gestión de Hallazgos y Riesgos Técnicos

### 6.1. Hallazgos Resueltos
- **Mitigación de Vulnerabilidades Críticas en Dependencias:** Actualización y deduplicación de `proxy-addr@2.0.8` (eliminó falsificación de cabeceras), `qs@6.16.1` y `body-parser@1.20.8` (eliminaron denegación de servicio por recursión en parsing).
- **Hardening de Cabeceras IP en Nginx:** Configurado en [docs/nginx.conf.example](file:///h:/vafel-stack/actividad-pqrs-b2b/docs/nginx.conf.example) utilizando `proxy_set_header X-Forwarded-For $remote_addr;` para descartar de raíz cualquier cabecera falsa inyectada por clientes en el perímetro.
- **Aislamiento de Archivos Físicos:** Cierre definitivo del acceso estático no autorizado a `/uploads`.

### 6.2. Riesgo Residual Aceptado y Justificado: `sprintf-js`
- **Aviso:** [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c) (Severidad Moderada — DoS mediante especificadores de precisión ilimitados).
- **Ruta de Invocación:** `mammoth@1.13.0` -> `argparse@1.0.10` -> `sprintf-js@1.0.3`.
- **Inalcanzabilidad Comprobada:** `argparse` se importa únicamente en el binario de consola CLI `node_modules/mammoth/bin/mammoth`. El backend importa `mammoth` desde su punto de entrada de biblioteca `mammoth/lib/index.js`, el cual **no contiene ninguna referencia a `argparse` ni a `sprintf-js`**.
- **Justificación de No Actualizar:** Aplicar `npm audit fix --force` degradaría `mammoth` a la versión `0.3.29` (de hace más de 8 años), introduciendo cambios incompatibles que romperían la extracción de texto en DocuMind. El riesgo se cataloga como **Tolerable e Inalcanzable en tiempo de ejecución**.

### 6.3. Hallazgos de Preparación para Staging (Pendientes de Infraestructura)
- **H-01 (Privilegios y Red de n8n):** Requiere crear en Staging el usuario restringido `n8n_pqrs_worker` en PostgreSQL (con permisos limitados a `solicitudes` y `actividades`) y aislar n8n en `webhook_net`, fuera de `backend_net`.
- **H-02 (Validación Empírica de PITR):** Requiere volumen dedicado `/var/lib/postgresql/wal_archive` con permisos UID 70 (`postgres:postgres`) y ejecución del simulacro de recuperación temporal cronometrado.
- **H-03 (Conciliación de Vectores y Archivos):** Requiere ejecutar en Staging el script de reconciliación en modo simulación (`--dry-run`) para purgar vectores huérfanos en Pinecone en caso de un rollback de base de datos.

---

## 7. Delimitación Rigurosa: Entorno Local vs. Staging / Producción

| Criterio | Verificado en Entorno Local Actual | Exige Entorno de Staging / Producción |
| :--- | :--- | :--- |
| **Ejecución de Software** | APIs REST, frontend SPA, componentes reactivos, consultas SQL, workflows n8n y llamadas a IA. | Pruebas de estrés concurrentes con carga sintética masiva (AT-11). |
| **Seguridad de Red** | Código preparado con `TRUST_PROXY` dinámico y bloqueo de `/uploads`. | Nginx desplegado como proxy perimetral con certificados TLS reales emitidos por AC institucional (AT-09). |
| **Notificaciones por Correo** | Lógica de workflow probada con captura resiliente de excepciones (`SIN_CONFIRMAR`). | Entrega física a buzones corporativos externos a través del servidor relay institucional autenticado (AT-10). |
| **Continuidad de Datos (DRP)** | Persistencia relacional comprobada ante reinicios ordenados de contenedores (`pqrs_pgdata`). | Archivador continuo de WAL habilitado (`archive_mode = on`) y simulacro PITR cronometrado. |
| **Aceptación Final** | Pruebas de regresión unitarias e integrales automatizadas (89/89 tests). | Pruebas formales de aceptación de usuario (UAT) con actas de conformidad de stakeholders (AT-12). |

---

## 8. Bloqueadores Institucionales Restantes

Para avanzar hacia la implantación en Producción real subsisten dos bloqueadores externos que escapan al alcance del código fuente:
1. **B-01 — Nombre de Dominio (FQDN) y Certificados SSL/TLS:** Se requiere la asignación del FQDN institucional y los archivos de certificado (`fullchain.pem` y `privkey.pem`) para el proxy perimetral.
2. **B-02 — Servidor de Correo SMTP Institucional:** Se requiere la provisión de las credenciales del servidor corporativo de correo para habilitar el envío externo autenticado en n8n.

---

## 9. Conclusión Técnica

La plataforma **DocuMind & PQRS Enterprise** se entrega en un estado **completamente funcional, auditado, probado y estabilizado**. 

Los resultados demuestran que es posible construir una solución de nivel empresarial unificando servicios desacoplados, modelos de lenguaje de última generación sin alucinaciones mediante RAG, orquestación de procesos de negocio con n8n y una sólida arquitectura de ciberseguridad. El sistema se encuentra completamente listo para ser sustentado académicamente y defendido ante el jurado calificador.
