# BANCO DE PREGUNTAS Y RESPUESTAS PARA LA DEFENSA TÉCNICA
## Sustentación Académica del Proyecto DocuMind & PQRS Enterprise
**Dirigido a:** Jurado Calificador, Docentes y Evaluadores Técnicos  
**Fecha:** Octubre 2026 | **Versión:** 1.0  

---

### Bloque 1: Arquitectura y Decisiones Tecnológicas

#### 1. ¿Por qué eligieron una arquitectura basada en microservicios/servicios desacoplados en lugar de un monolito tradicional?
> **Respuesta:**  
> *"Separamos la solución en tres capas especializadas para optimizar la escalabilidad, la mantenibilidad y la seguridad:  
> 1. El **Frontend SPA (React + Vite)** se enfoca exclusivamente en la experiencia del usuario, cargando estáticamente y consumiendo APIs.  
> 2. El **Backend REST (Node.js + Express)** encapsula la lógica de negocio, las reglas de autenticación y la orquestación de llamadas a los modelos de IA.  
> 3. El **Motor n8n** gestiona los procesos asíncronos de negocio (clasificación de PQRS, cómputo de SLAs, alertas y webhooks). Esto evita sobrecargar el hilo principal de Node.js con tareas intensivas de integración y permite modificar flujos empresariales sin necesidad de recompilar ni redesplegar el código fuente del backend."*

#### 2. ¿Por qué migraron o unificaron la base de datos en PostgreSQL 16 en lugar de conservar MySQL?
> **Respuesta:**  
> *"La unificación en PostgreSQL 16 respondió a tres necesidades arquitectónicas concretas:  
> - **Consistencia y reducción de sobrecarga operativa:** Mantener dos motores relacionales diferentes (uno para PQRS y otro para DocuMind) duplicaba el consumo de memoria y la complejidad de respaldos.  
> - **Capacidades avanzadas nativas:** PostgreSQL ofrece un manejo superior de datos JSONB, extensiones analíticas y la capacidad futura de integrar `pgvector` para alojar embeddings vectoriales dentro de la misma base relacional si se deseara prescindir de servicios en la nube.  
> - **Integridad transaccional y compatibilidad:** PostgreSQL 16 implementa soporte nativo para la cláusula `RETURNING id`, lo que permitió estandarizar la inserción concurrente de solicitudes y actividades con total consistencia referencial."*

#### 3. ¿Qué ventajas aporta Vite sobre Create React App o Webpack en el frontend?
> **Respuesta:**  
> *"Vite utiliza **Native ES Modules (ESM)** en desarrollo, lo que reduce el tiempo de arranque de minutos a milisegundos gracias a la compilación previa con `esbuild` en lenguaje Go. Para producción, empaqueta mediante `Rollup` con Tree-Shaking agresivo. Nuestra compilación completa de más de 1,570 módulos se ejecuta en menos de 25 segundos, generando artefactos gzip altamente optimizados (menos de 100 kB para la lógica principal de la aplicación)."*

---

### Bloque 2: Inteligencia Artificial, RAG y Búsqueda Vectorial

#### 4. Explique con precisión qué es RAG y cómo mitiga las alucinaciones de los Modelos de Lenguaje (LLMs).
> **Respuesta:**  
> *"RAG significa **Retrieval-Augmented Generation** (Generación Aumentada por Recuperación). Los LLMs convencionales tienden a 'alucinar' (inventar hechos plausibles pero falsos) cuando se les pregunta sobre datos privados o corporativos que no estuvieron en su entrenamiento.  
> En DocuMind, el modelo no responde de memoria. El pipeline funciona en 3 fases:  
> 1. **Indexación:** El documento se segmenta en fragmentos semánticos (chunks de 1,000 caracteres) y se convierte en vectores numéricos de 768 dimensiones.  
> 2. **Recuperación:** La pregunta del usuario se vectoriza y Pinecone calcula los fragmentos más cercanos mediante **similitud de coseno**.  
> 3. **Generación Aumentada:** Se construye un prompt que contiene la pregunta y únicamente los fragmentos recuperados, instruyendo al modelo a responder **estrictamente con base en ese contexto** y citando la fuente y página exacta. Si el dato no está en el texto, el modelo responde que la información no está disponible, eliminando la alucinación."*

#### 5. ¿Por qué utilizan Google Gemini y vectores de 768 dimensiones?
> **Respuesta:**  
> *"Utilizamos el SDK oficial `@google/genai` con el modelo `gemini-2.0-flash`. La dimensión de 768 es el estándar óptimo de la familia de embeddings de Google (Text-Embedding-004), logrando un balance ideal entre riqueza semántica y velocidad de cómputo. Un vector de 768 números flotantes captura matices contextuales complejos (sinónimos, terminología jurídica y técnica) manteniendo un consumo de memoria muy bajo en el índice de Pinecone."*

#### 6. ¿Qué ocurre si la API de Gemini o Pinecone se cae o supera el tiempo de espera?
> **Respuesta:**  
> *"Implementamos el patrón de resiliencia **Fail-Safe / Graceful Degradation**. Todas las llamadas externas están envueltas en la función `conTimeout` (con límites de 5,000 ms en Gemini y 7,000 ms en Chat). Si la conexión agota el tiempo o falla la red, el sistema captura la excepción y activa un **generador analítico determinista de respaldo** (`generarRespuestaAnaliticaRespaldo`). Este generador analiza las palabras clave en la base de datos local y emite una respuesta estructurada al usuario, evitando que el servidor Node.js quede colgado o devuelva un error 500 no controlado."*

---

### Bloque 3: Automatización de Procesos con n8n

#### 7. ¿Cuál es el rol exacto de n8n en el flujo de una PQRS?
> **Respuesta:**  
> *"n8n actúa como el **orquestador de eventos de negocio**. Cuando el portal público emite la radicación, n8n recibe los datos mediante un webhook seguro y ejecuta de forma transparente:  
> 1. Saneamiento estricto de campos de texto y validación de identificador UUID v4.  
> 2. Clasificación automática del área responsable según palabras clave (Soporte Técnico, Facturación, Calidad, Atención General).  
> 3. Asignación de prioridad y cálculo dinámico de la fecha límite de SLA (ej. 2 horas para emergencias críticas, 4 horas para reclamos, 24 horas estándar).  
> 4. Inserción relacional simultánea en las tablas `pqrs_solicitudes` y `pqrs_actividades` de PostgreSQL.  
> 5. Disparo de alertas por correo electrónico con manejo de fallos."*

#### 8. ¿Por qué n8n registra el estado 'SIN_CONFIRMAR' en el envío de correos en el entorno local?
> **Respuesta:**  
> *"Es una decisión deliberada de diseño y seguridad. En el entorno de desarrollo local no tenemos configurado un relay SMTP institucional con dominio autenticado (SPF/DKIM) para evitar que los correos sean catalogados como spam o bloqueados.  
> En el nodo SMTP de n8n configuramos la directiva `onError: continueRegularOutput`. Si el servidor de correo local no puede entregar el mensaje a un buzón externo real, el flujo no aborta la radicación; simplemente clasifica la notificación como `SIN_CONFIRMAR` y devuelve al ciudadano su radicado exitosamente. En Staging/Producción, una vez provistas las credenciales del servidor corporativo (Bloqueador B-02), el estado pasará a `ENVIADA`."*

---

### Bloque 4: Ciberseguridad y Control de Acceso

#### 9. ¿Cómo resolvieron la vulnerabilidad IDOR (Insecure Direct Object Reference) en la gestión de tickets y documentos?
> **Respuesta:**  
> *"En la auditoría de seguridad detectamos que un usuario malicioso podía cambiar el ID en la URL para consultar documentos o solicitudes de otros clientes o departamentos.  
> La remediación se implementó en dos niveles:  
> 1. **Para ciudadanos:** La consulta pública no se realiza únicamente por ID numérico; exige obligatoriamente la combinación del `ticket_id` y un `tracking_token` criptográfico aleatorio. Si el token no coincide, se deniega el acceso.  
> 2. **Para funcionarios:** Las consultas SQL internas incorporan cláusulas `WHERE` que cruzan el `departamento` y `rol` del usuario autenticado inyectado desde el token JWT. Un operador del área Legal recibe un error HTTP 403 Forbidden si intenta consultar registros de Financiero."*

#### 10. ¿Por qué bloquearon el acceso estático directo a la carpeta `/uploads`?
> **Respuesta:**  
> *"Originalmente, la carpeta de archivos físicos se servía mediante `express.static('/uploads')`. Esto permitía que cualquier persona que adivinara o enumerara el nombre de un archivo PDF lo descargara directamente sin autenticación.  
> Removimos ese middleware público y colocamos un interceptor que retorna HTTP 401 Unauthorized ante cualquier petición directa a `/uploads`. Las descargas de archivos ahora ocurren exclusivamente a través de endpoints seguros (`GET /api/documents/:id/download`) que verifican la sesión JWT del usuario y sus permisos de visualización."*

#### 11. ¿Cómo mitigan ataques de fuerza bruta en el inicio de sesión y consulta de tickets?
> **Respuesta:**  
> *"Implementamos limitadores de tasa (*Rate Limiting*) en memoria tanto en `auth.controller.js` como en `pqrs.controller.js`.  
> Ante 5 intentos fallidos consecutivos de contraseña o de tokens de consulta en una ventana de 15 minutos, la combinación de dirección IP y cuenta queda temporalmente bloqueada, respondiendo HTTP 429 Too Many Requests e informando al usuario el tiempo exacto que debe esperar antes de reintentar."*

---

### Bloque 5: Aseguramiento de Calidad (QA) y Preparación para Producción

#### 12. ¿Qué cobertura tienen las pruebas automatizadas y qué metodologías aplicaron?
> **Respuesta:**  
> *"Implementamos una suite exhaustiva en **Jest y Supertest** compuesta por 5 suites y **89 pruebas automatizadas con 100% de aprobación**.  
> - `secrets.test.js` (12 tests): Verifica la resolución de Docker Secrets (`*_FILE`), variables directas, sanitización y rechazo estricto de credenciales de desarrollo en producción.  
> - `security_remediation.test.js` (25 tests): Valida autenticación JWT, RBAC, mitigación de IDOR y protección de uploads contra PostgreSQL real.  
> - `pqrs.test.js` (39 tests): Valida el ciclo de vida completo de solicitudes, transiciones de estado válidas e inválidas y cálculo de SLAs.  
> - `documind.test.js` (9 tests): Prueba el pipeline de ingesta, parseo de texto y búsqueda RAG con servicios reales.  
> - `stabilization.test.js` (4 tests): Comprueba resiliencia de conexión y estabilidad del servidor."*

#### 13. ¿Qué es el helper de secretos (`backend/utils/secrets.js`) y por qué es indispensable para producción?
> **Respuesta:**  
> *"En desarrollo comúnmente se leen secretos desde archivos `.env` o variables planas en memoria. En producción corporativa (Docker Swarm o Kubernetes), las buenas prácticas prohíben inyectar contraseñas en variables de entorno porque quedan visibles en comandos como `docker inspect` o volcados de memoria.  
> El helper `getSecret` implementa el estándar `*_FILE`: si detecta `DB_PASSWORD_FILE`, lee el secreto directamente desde el volumen seguro en memoria (`/run/secrets/`). Además, cuenta con un guardián de entorno: si `NODE_ENV === 'production'`, **falla en el arranque si detecta contraseñas por defecto de desarrollo**, impidiendo que el sistema suba desprotegido."*

#### 14. ¿Qué diferencia hay entre lo que está probado hoy localmente y lo que exige el paso a Staging y Producción?
> **Respuesta:**  
> *"Fuimos totalmente rigurosos y honestos en la delimitación:  
> - **Verificado hoy localmente (AT-01 a AT-08):** La lógica de negocio, el frontend compilado, las APIs REST, la persistencia en PostgreSQL, los workflows en n8n, el RAG con Gemini/Pinecone y las 89 pruebas de seguridad y estabilidad.  
> - **Pendiente de Staging/Producción (AT-09 a AT-12):**  
>   1. La terminación TLS real en Nginx (requiere el dominio institucional y certificados SSL válidos — Bloqueador B-01).  
>   2. El handshake y entrega de correos a buzones externos reales (requiere el relay SMTP corporativo — Bloqueador B-02).  
>   3. Pruebas de estrés y carga masiva concurrente (AT-11).  
>   4. Homologación formal de usuarios clave UAT (AT-12)."*

#### 15. ¿Cómo garantizan la recuperación de datos ante un desastre (DRP) considerando que tienen datos en PostgreSQL, archivos en disco y vectores en Pinecone?
> **Respuesta:**  
> *"En el documento técnico `docs/DRP_PLAN_RECUPERACION.md` diseñamos un protocolo de **recuperación coordinada**:  
> 1. **Base de Datos:** Para producción especificamos Point-In-Time-Recovery (PITR) con archivado continuo de WALs, permitiendo restaurar transacciones hasta el segundo exacto del fallo.  
> 2. **Archivos Físicos:** Se mantiene un almacenamiento persistente sincronizado con los metadatos de la tabla `documentos`.  
> 3. **Consistencia Vectorial con Pinecone:** Dado que Pinecone es una base vectorial externa en la nube que no tiene rollback automático, diseñamos un procedimiento de reconciliación con modo simulación (`--dry-run`). Si la base de datos se restaura a un punto temporal anterior, el script identifica y purga en Pinecone los vectores huérfanos cuyos documentos ya no existen en PostgreSQL, y reajusta la secuencia de IDs para evitar colisiones semánticas futuras."*
