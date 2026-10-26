# GUION DE DEMOSTRACIÓN EN VIVO — DOCUMIND & PQRS ENTERPRISE
**Propósito:** Guía paso a paso para la sustentación y defensa oral del proyecto ante el jurado o profesor.  
**Tiempo Estimado:** 10 a 12 minutos (Versión Completa) | 4 a 5 minutos (Versión Rápida).  
**Entorno de Demostración:** Local (`http://localhost:5173`, `http://localhost:5000`, `http://localhost:5678`).  

---

## 1. Preparación Previa a la Exposición (Checklist de 2 minutos)

Antes de iniciar la presentación, abre en pestañas del navegador:
1. Pestaña 1: `http://localhost:5173/radicar` (Portal Público de Radicación Ciudadana).
2. Pestaña 2: `http://localhost:5173/login` (Portal Administrativo / Dashboard).
3. Pestaña 3: `http://localhost:5173/chat-rag` (Asistente Inteligente DocuMind RAG).
4. Pestaña 4: `http://localhost:5678` (Editor de flujos n8n — mostrando el workflow `PQRS2026Soporte1`).
5. Terminal secundaria lista con el comando de pruebas: `npm test` en `backend/`.

---

## 2. Recorrido Paso a Paso (Versión Completa)

### Paso 1: Introducción y Portal de Radicación Ciudadana (2 minutos)
- **Dónde hacer clic:** Pestaña 1 (`http://localhost:5173/radicar`).
- **Qué mostrar en pantalla:** El formulario reactivo de radicación pública con selector de tipo de solicitud (Petición, Queja, Reclamo, Sugerencia, Soporte Técnico), campos de contacto y carga opcional de adjuntos.
- **Qué decir al jurado:**
  > *"Iniciamos la demostración en la interfaz de cara al ciudadano. Este portal permite radicar PQRS de forma ágil, con validación en tiempo real tanto en frontend como en backend. Para esta prueba radicaremos un caso de Soporte Técnico urgente."*
- **Acción a realizar:**
  - Diligenciar datos ficticios:
    - Nombre: `Carlos Mendoza (Demo)`
    - Correo: `carlos.mendoza.demo@vafel.com`
    - Tipo: `Soporte Técnico` | Prioridad: `Alta`
    - Asunto: `Falla intermitente en sincronización de inventarios B2B`
    - Descripción: `Se evidencia lentitud crítica al cargar el módulo de facturación masiva durante el cierre de jornada.`
  - Clic en el botón **"Radicar Solicitud"**.
- **Resultado en pantalla:** Modal de éxito instantáneo mostrando el **Número de Radicado** (ej. `PQRS-2026-XXXXXX`) y la **Clave Privada de Consulta (Token)**.
- **Qué decir:**
  > *"El sistema genera un identificador criptográfico único y un token de seguimiento. Detrás de escena, la petición fue enviada al webhook de n8n, clasificada con reglas de SLA y persistida en PostgreSQL."*

---

### Paso 2: Explicación de la Automatización en n8n (1.5 minutos)
- **Dónde hacer clic:** Pestaña 4 (`http://localhost:5678`).
- **Qué mostrar:** El canvas del workflow `PQRS2026Soporte1` con sus nodos: Webhook -> Procesador y Clasificador -> ¿Datos Válidos? -> Guardar en Postgres -> Comprobación de Correo -> Respuesta Webhook.
- **Qué decir al jurado:**
  > *"Aquí observamos el motor de automatización con n8n. El webhook recibe el payload, ejecuta validaciones de seguridad (como verificación de formato UUID y saneamiento de caracteres de control), asigna automáticamente el SLA (en este caso 4 horas por ser Soporte Técnico de prioridad alta) y persiste la solicitud en la tabla `pqrs_solicitudes` de PostgreSQL.*
  > *Adicionalmente, el workflow implementa un patrón de resiliencia: si el servidor SMTP corporativo no está disponible o rechaza el relay, el error es capturado limpiamente sin interrumpir el registro ni fallar de cara al usuario, catalogando la notificación como `SIN_CONFIRMAR` para posterior reintento."*

---

### Paso 3: Consulta Ciudadana y Protección de Datos Personales (2 minutos)
- **Dónde hacer clic:** En la Pestaña 1, ir a la sección inferior de **"Consultar Estado de Radicado"** (o navegar a `/consulta-radicado`).
- **Qué mostrar:** Campo para ingresar el `ticket_id` y el `token`.
- **Acción:** Copiar el número de radicado generado en el Paso 1 y consultar.
- **Resultado:** Visualización de la línea de tiempo del caso, estado actual (`RADICADO`), fecha límite de SLA y área asignada (`Soporte Técnico y Sistemas`).
- **Qué destacar enfáticamente (Punto fuerte de Seguridad):**
  > *"Fíjense en dos detalles cruciales de ciberseguridad y protección de datos implementados bajo la Ley 1581 / Habeas Data:
  > 1. El nombre del solicitante se presenta **enmascarado** (ejemplo: `C***** M******`) para evitar fugas de identidad si un tercero intercepta la pantalla.
  > 2. Las notas internas de los funcionarios o auditorías de gestión están **estrictamente filtradas a nivel de consulta SQL**; jamás viajan en el payload JSON hacia usuarios públicos sin sesión administrativa."*

---

### Paso 4: Panel Administrativo y Control de Acceso RBAC (2.5 minutos)
- **Dónde hacer clic:** Pestaña 2 (`http://localhost:5173/login`).
- **Acción:** Iniciar sesión con un usuario supervisor o administrador:
  - Email: `admin@documind.com` | Contraseña: `password_seguro_uts` | Rol: `ADMIN` (o cualquier usuario de la tabla de credenciales).
- **Qué mostrar:** Dashboard con métricas de solicitudes, gráficos de distribución por departamento, tabla paginada con filtros y gestión de estados.
- **Acción a realizar:**
  - Localizar el ticket generado en el Paso 1.
  - Abrir el detalle del caso, cambiar el estado a `EN_GESTION` y agregar una observación técnica interna.
- **Qué decir al jurado:**
  > *"Desde la perspectiva del funcionario, el sistema aplica un estricto control de acceso basado en roles (RBAC). Un operador de un departamento no puede ver ni modificar radicados de otra área (aislamiento horizontal). Solo supervisores y administradores tienen facultades de escalamiento y reasignación. Toda acción queda auditada con marca de tiempo, usuario y dirección IP del cliente en la base de datos."*

---

### Paso 5: Gestión Documental con IA y Chat RAG (3 minutos)
- **Dónde hacer clic:** Pestaña 3 (`http://localhost:5173/chat-rag`).
- **Qué mostrar:** Interfaz del asistente cognitivo DocuMind RAG, con visualizador de repositorios y panel de chat conversacional.
- **Qué decir al jurado:**
  > *"Pasamos ahora al componente central de DocuMind: el motor RAG (Retrieval-Augmented Generation). En la base de datos tenemos indexados documentos corporativos reales (manuales de calidad, políticas de garantías y procedimientos operativos).*
  > *A diferencia de un ChatGPT convencional que inventa datos, nuestro sistema realiza una búsqueda de similitud de coseno en Pinecone sobre vectores de 768 dimensiones generados con Google Gemini, inyecta los fragmentos exactos en el contexto del modelo y formula una respuesta fundamentada con cita de fuentes."*
- **Acción a realizar en el Chat:**
  - Escribir una consulta contextual:
    > *"¿Cuál es el procedimiento y plazo para escalar una queja sobre garantías de producto?"*
- **Resultado esperado en pantalla:**
  - Respuesta concisa y técnica estructurada.
  - Caja de citas debajo de la respuesta indicando: **Fuente: `Manual_Garantias_Vafel.pdf` — Página 3 / Fragmento 2**.
- **Qué decir si hay latencia externa:** (Ver sección 3 de contingencias).

---

### Paso 6: Evidencia Técnica de Pruebas y Compilación (1 minuto)
- **Dónde hacer clic:** Abrir la terminal secundaria o mostrar los archivos de reporte.
- **Qué decir al jurado:**
  > *"Para respaldar que esto no es solo una interfaz visual sino un desarrollo de ingeniería maduro y estabilizado, contamos con una suite automatizada en Jest con **89 pruebas unitarias y de integración pasando al 100%**, cubriendo resolución segura de secretos, autenticación JWT, prevención de IDOR, inyecciones CRLF y lógica PQRS. Adicionalmente, el frontend compila limpiamente para producción en Vite en menos de 25 segundos."*

---

## 3. Matriz de Contingencias: ¿Qué hacer si algo falla en vivo?

> **REGLA DE ORO DEL EXPOSITOR:** Jamás mentir, jamás improvisar excusas vagas. Explicar el fenómeno técnico con madurez arquitectónica genera una excelente impresión ante jurados expertos.

| Situación Imprevista | Causa Técnica Real | Qué decir textualmente al Jurado | Acción Inmediata de Demostración |
| :--- | :--- | :--- | :--- |
| **La API de Gemini o Pinecone demora más de 7 segundos o da error de cuota.** | Conexión externa a Internet saturada o rate-limit de la API en la nube. | *"Observen cómo responde la arquitectura: ante una degradación de latencia o corte de la API en la nube, el backend dispara un mecanismo de timeout estricto a los 7 segundos y activa nuestro generador analítico determinista de respaldo, garantizando que el usuario reciba orientación basada en la base de datos sin colapsar el hilo de Node.js."* | Mostrar la respuesta de respaldo en pantalla y señalar en el código el envoltorio `conTimeout` y la función `generarRespuestaAnaliticaRespaldo`. |
| **El correo de notificación no llega a la bandeja de entrada.** | El relay SMTP externo no está instalado en localhost por restricciones de spam y seguridad perimetral. | *"Tal como está documentado en los requerimientos de producción (criterio AT-10), en este entorno local no enviamos correos a servidores externos para evitar ser bloqueados por filtros antispam. El workflow de n8n detecta la ausencia del relay y registra de manera controlada el estado `SIN_CONFIRMAR` en PostgreSQL, manteniendo intacto el radicado."* | Abrir n8n y mostrar el nodo `Comprobar correo de confirmación` con su salida clasificada. |
| **El jurado pregunta por qué Nginx no está corriendo en localhost.** | En desarrollo local el frontend y backend corren directamente para facilitar depuración en caliente; Nginx está modelado para staging/producción. | *"En esta estación de desarrollo ejecutamos los daemons directamente para tener recarga en caliente (HMR con Vite y watch en Express). La topología completa de producción con Nginx, terminación TLS, aislamiento de redes y montaje de Docker Secrets está completamente especificada en `docker-compose.prod.example.yml` y `nginx.conf.example`."* | Mostrar rápidamente el archivo `docker-compose.prod.example.yml` señalando las redes `frontend_net`, `backend_net` y `db_net`. |

---

## 4. Versión Corta de la Demostración (Cuando hay solo 3 a 5 minutos)

Si el profesor o jurado dice: *"Vaya directo al grano y muéstreme qué hace el sistema"*, sigue esta ruta express:

1. **Minuto 1 — Radicación:** Abrir `http://localhost:5173/radicar`, crear una PQRS rápida, obtener radicado y token.
2. **Minuto 2 — Automatización:** Abrir `http://localhost:5678`, mostrar el workflow activo procesando en tiempo real y persistiendo en PostgreSQL.
3. **Minuto 3 — Chat RAG:** Abrir `http://localhost:5173/chat-rag`, hacer una pregunta sobre documentos, mostrar la respuesta generada con cita de fuentes.
4. **Minuto 4 — Seguridad y Cierre:** Mostrar en terminal la salida de `npm test` con **89/89 tests pasados** y concluir destacando la arquitectura desacoplada y robusta.
