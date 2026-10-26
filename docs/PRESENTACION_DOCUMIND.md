# PRESENTACIÓN ACADÉMICA — DOCUMIND & PQRS ENTERPRISE
## Diapositivas Estructuradas para Sustentación Final
**Duración Estimada:** 12 a 15 minutos  
**Formato:** Diapositiva Ejecutiva (Bullet points visuales) + Notas de Orador en Lenguaje Natural  

---

### DIAPOSITIVA 1: Portada
**Título:** DOCUMIND & PQRS ENTERPRISE  
**Subtítulo:** Plataforma Integral de Atención Ciudadana, Automatización de Procesos y Asistente Cognitivo RAG con IA  
**Presentado por:** Juan Felipe Celis — Líder Técnico y Desarrollador  
**Proyecto:** `JuanFe28/actividad-pqrs-n8n`  
**Fecha:** Octubre 2026  

> 🎙️ **Notas del Orador:**  
> *"Muy buenos días a todos los miembros del jurado y profesor. Hoy tengo el gusto de presentar DocuMind & PQRS Enterprise, una solución de ingeniería de software diseñada para transformar la gestión documental y la atención ciudadana mediante la integración de Inteligencia Artificial Generativa, automatización de flujos empresariales y altos estándares de ciberseguridad."*

---

### DIAPOSITIVA 2: Problema y Justificación
**Título:** El Desafío de la Información en las Organizaciones  
**Puntos Clave en Pantalla:**
- **Silos de Información:** Documentos desestructurados (manuales, contratos, políticas) dispersos e inaccesibles en tiempo real.
- **Lentitud en PQRS:** Clasificación manual de peticiones, quejas y reclamos con riesgo de vencimiento de plazos legales (SLAs).
- **Alucinaciones de la IA:** Uso riesgoso de chatbots convencionales que inventan datos sobre normativas corporativas.
- **Brechas de Seguridad:** Fugas de información sensible por falta de controles de acceso y exposición de archivos.

> 🎙️ **Notas del Orador:**  
> *"En cualquier organización moderna nos encontramos con dos dolores principales: la atención al cliente o ciudadano suele ser lenta y burocrática, y los repositorios documentales son cementerios de PDFs donde encontrar una cláusula o política toma horas. Además, si intentamos usar inteligencia artificial tradicional, los modelos alucinan inventando respuestas. DocuMind nace para resolver este problema unificando radicación rápida, automatización y búsqueda exacta con citas de fuentes."*

---

### DIAPOSITIVA 3: Objetivos del Proyecto
**Título:** Metas y Propósito del Sistema  
**Objetivo General:**
- Desarrollar una plataforma unificada y segura que optimice la radicación de PQRS, automatice la gestión operativa y habilite un motor de búsqueda semántica fundamentado en documentos corporativos mediante RAG.
**Objetivos Específicos:**
- **Portal Público:** Facilitar la radicación ciudadana con validación y seguimiento transparente con token privado.
- **Orquestación con n8n:** Automatizar la clasificación de solicitudes, cálculo de SLAs y persistencia en base de datos.
- **Motor RAG Confiable:** Implementar embeddings de 768d y búsqueda vectorial en Pinecone citando página y documento.
- **Hardening de Seguridad:** Aplicar control de acceso RBAC, mitigar IDOR y proteger descargas de archivos físicos.

> 🎙️ **Notas del Orador:**  
> *"Nos propusimos metas claras y medibles: darle al ciudadano un canal intuitivo de radicación, liberar al personal operativo de clasificar manualmente los casos mediante n8n, proveer un motor de consulta con IA que garantice respuestas con citas exactas y blindar la plataforma contra las vulnerabilidades más comunes de la web."*

---

### DIAPOSITIVA 4: Alcance Funcional
**Título:** Módulos de la Plataforma  
**Puntos Clave en Pantalla:**
- **Portal Ciudadano:** Formulario de radicación pública (anónima/identificada), generación de radicado y consulta con token privado.
- **Panel Administrativo:** Gestión del ciclo de vida de PQRS (`RADICADO`, `EN_GESTION`, `RESUELTO`, `CERRADO`), reasignación y auditoría.
- **Gestión Documental:** Ingesta de archivos PDF, DOCX y TXT, extracción de texto plano y segmentación en chunks.
- **Asistente Cognitivo DocuMind:** Chat conversacional que responde consultas semánticas utilizando fragmentos recuperados en tiempo real.

> 🎙️ **Notas del Orador:**  
> *"El alcance cubre el ciclo completo: desde el momento en que un ciudadano radica una solicitud en la web, pasando por el funcionario que la gestiona en un panel con métricas, hasta el consultor que utiliza el asistente de IA para resolver inquietudes técnicas o normativas complejas en segundos."*

---

### DIAPOSITIVA 5: Arquitectura Tecnológica
**Título:** Ecosistema Tecnológico Desacoplado  
**Capas de la Solución:**
- **Frontend SPA:** React 18 + Vite + Tailwind CSS (Carga ultrarrápida, diseño responsivo).
- **Backend API REST:** Node.js + Express (Arquitectura modular, seguridad con JWT y RBAC).
- **Base de Datos Unificada:** PostgreSQL 16 (Esquema relacional unificado `pqrs_db`, integridad referencial).
- **Motor de Flujos:** n8n v2.41.4 (Webhooks asíncronos y reglas empresariales).
- **Inteligencia Artificial:** Google Gemini (`gemini-2.0-flash` para embeddings y LLM) + Pinecone Vector Database.

> 🎙️ **Notas del Orador:**  
> *"Elegimos una arquitectura desacoplada y robusta. En el frontend, React con Vite nos permite una interfaz moderna y veloz. En el backend, Node.js orquesta la seguridad y la lógica de negocio. Para la persistencia unificamos todo en PostgreSQL 16, aprovechando su robustez transaccional. Y delegamos los flujos complejos a n8n y la búsqueda vectorial a Pinecone y Google Gemini."*

---

### DIAPOSITIVA 6: Ciclo de Vida y Flujo PQRS
**Título:** Radicación, Clasificación y Seguimiento  
**Flujo Operativo:**
1. **Radicación:** Ciudadano ingresa petición con adjunto opcional.
2. **Webhook n8n:** Recepción de payload, saneamiento de entradas y validación UUID v4.
3. **Clasificación y SLA:** Detección automática del área responsable y cálculo de horas límite (2h a 48h).
4. **Persistencia Dual:** Registro simultáneo en `pqrs_solicitudes` y `pqrs_actividades` de PostgreSQL.
5. **Seguimiento Seguro:** Consulta con `ticket_id` y `tracking_token`; notas internas ocultas y nombre enmascarado.

> 🎙️ **Notas del Orador:**  
> *"El flujo de una PQRS es completamente trazable. Cuando el usuario envía su solicitud, n8n analiza el texto, detecta si es un reclamo urgente o una sugerencia, calcula el plazo máximo legal de respuesta y guarda el registro. El ciudadano puede consultar el estado en cualquier momento con su clave privada, garantizando la privacidad de sus datos personales bajo la ley de Habeas Data."*

---

### DIAPOSITIVA 7: Motor RAG (Retrieval-Augmented Generation)
**Título:** Inteligencia Artificial con Citas y Sin Alucinaciones  
**Pipeline de Procesamiento:**
```
[ Documento PDF/DOCX ] ──► [ Extracción Texto ] ──► [ Chunks 1000 chars ]
                                                          │
[ Respuesta con Citas ] ◄── [ Google Gemini LLM ] ◄── [ Embeddings 768d ]
                                      ▲                   │
                              [ Contexto Relevante ]      ▼
                                      └───────────── [ Pinecone Index ]
```
- **Similitud de Coseno:** Búsqueda vectorial `topK` para extraer los 3 fragmentos más relevantes.
- **Resiliencia Fail-Safe:** Timeout estricto y generador analítico determinista de respaldo ante fallos de red.

> 🎙️ **Notas del Orador:**  
> *"El componente estrella de DocuMind es el motor RAG. Tomamos un documento extenso, lo dividimos en fragmentos manejables y los convertimos en vectores numéricos de 768 dimensiones. Cuando el usuario pregunta algo, Pinecone calcula matemáticamente cuáles son los fragmentos más pertinentes y se los entrega a Gemini como único contexto. El modelo formula la respuesta indicando: 'Fuente: Manual de Calidad, Página 4'. Y si la API externa falla, nuestro backend tiene un generador analítico de respaldo para no dejar al usuario sin servicio."*

---

### DIAPOSITIVA 8: Automatización de Procesos con n8n
**Título:** Orquestación Empresarial Asíncrona  
**Aspectos Destacados:**
- **Workflows Activos:** `PQRS2026Soporte1` (Gestión PQRS) y `5H2fywJsM0SmC2JF` (Vafel Sweet).
- **Manejo de Errores Resiliente:** Directiva `onError: continueRegularOutput` en el nodo SMTP.
- **Trazabilidad en Base de Datos:** Cada evento queda registrado en la tabla relacional `pqrs_actividades`.
- **Independencia Operativa:** Cambios en reglas de enrutamiento o áreas no requieren modificar el código de la aplicación web.

> 🎙️ **Notas del Orador:**  
> *"La incorporación de n8n nos da agilidad empresarial. Si la organización decide cambiar los plazos de respuesta o las áreas de destino, no tenemos que alterar ni una sola línea de código en Express ni redesplegar. Además, el flujo es tolerante a fallos: si el servidor de correo se cae, el registro de la solicitud no se pierde; se persiste y se marca como pendiente de reintento."*

---

### DIAPOSITIVA 9: Seguridad, Roles y Protección de Datos
**Título:** Hardening y Ciberseguridad Aplicada  
**Medidas Verificadas:**
- **Autenticación y Roles (RBAC):** Tokens JWT con expiración de 24h y roles `ADMIN`, `SUPERVISOR`, `OPERADOR`.
- **Aislamiento Horizontal (Anti-IDOR):** Restricción de consultas por departamento y validación obligatoria de tokens en tickets públicos.
- **Protección de Archivos:** Denegación con HTTP 401 a la ruta estática `/uploads`; descargas gobernadas por endpoint autenticado.
- **Helper de Secretos:** Soporte nativo para Docker Secrets (`*_FILE`), sanitización y rechazo tajante de credenciales de desarrollo en producción.

> 🎙️ **Notas del Orador:**  
> *"La seguridad no fue un añadido de última hora; fue auditada y probada rigurosamente. Resolvimos vulnerabilidades críticas de referencia directa a objetos (IDOR), bloqueamos el acceso público desprotegido a los archivos físicos de los documentos y creamos un helper de secretos que impide arrancar la aplicación en producción si alguien olvida cambiar las contraseñas por defecto de desarrollo."*

---

### DIAPOSITIVA 10: Pruebas y Resultados Verificables
**Título:** Aseguramiento de Calidad con Datos Reales  
**Métricas Comprobables:**
- **89 / 89 Pruebas Aprobadas (100% PASS) en Jest:**
  - `secrets.test.js` (12 tests) — Resolución segura de secretos.
  - `security_remediation.test.js` (25 tests) — RBAC, Auth y Hardening.
  - `pqrs.test.js` (39 tests) — Ciclo de vida y validaciones PQRS.
  - `documind.test.js` (9 tests) — Ingesta y RAG con base de datos real.
  - `stabilization.test.js` (4 tests) — Conectividad y estabilidad.
- **Compilación Frontend:** Vite v5.4.21 empaqueta 1,579 módulos en menos de 25 segundos sin errores.

> 🎙️ **Notas del Orador:**  
> *"Nuestros resultados están respaldados por código y pruebas reales. Ejecutamos una suite automatizada de 89 pruebas que cubren desde la lógica de secretos hasta la ingestión de documentos contra la base de datos real, con un 100% de éxito. Y el frontend compila limpiamente para producción en apenas 22 segundos."*

---

### DIAPOSITIVA 11: Estado del Plan y Preparación para Producción
**Título:** Delimitación Honesta: Local vs. Staging  
**Estado Oficial del Plan Maestro:**
- Tareas 1 a 6: **COMPLETADAS** (Arquitectura, persistencia, RAG, seguridad y pruebas).
- Tarea 7: **EN CURSO** (Hardening y preparación técnica lista; pendiente de Staging).
- Tarea 8: **COMPLETADA** (Informe final y hoja de ruta de entrega académica).
**Bloqueadores Externos para Producción Real:**
- **B-01:** Asignación de dominio FQDN y certificados SSL institucionales para Nginx.
- **B-02:** Credenciales del relay SMTP corporativo para entrega de correo externo.

> 🎙️ **Notas del Orador:**  
> *"Actuamos con total transparencia técnica: el software está completamente desarrollado, estabilizado y probado localmente. Sin embargo, no afirmamos falsamente que está en producción institucional, porque la puesta en marcha perimetral depende de dos requisitos institucionales externos: el dominio corporativo con certificados TLS y el servidor relay de correo institucional. Todo el diseño perimetral y el plan de recuperación ante desastres (DRP) ya están completamente especificados y listos para implementarse en Staging."*

---

### DIAPOSITIVA 12: Conclusiones y Trabajo Futuro
**Título:** Logros del Proyecto y Próximos Pasos  
**Conclusiones:**
- Se demostró la viabilidad de integrar Inteligencia Artificial generativa y búsqueda vectorial en procesos empresariales reales con cero alucinaciones.
- La combinación de React, Node.js, PostgreSQL y n8n ofrece una arquitectura flexible, segura y de bajo costo operativo.
**Trabajo Futuro (Hoja de Ruta):**
- Despliegue en entorno de Staging aislado y ejecución del simulacro PITR en PostgreSQL.
- Implementación de colas asíncronas con Redis para ingestión masiva de documentos.
- Pruebas de estrés y carga masiva concurrente (AT-11) y homologación con usuarios clave (AT-12).

> 🎙️ **Notas del Orador:**  
> *"En conclusión, DocuMind & PQRS Enterprise es un proyecto maduro que cumple a cabalidad con los objetivos académicos y técnicos propuestos, dejando una base sólida para su posterior implantación institucional. Muchas gracias por su atención y quedo atento a sus preguntas."*
