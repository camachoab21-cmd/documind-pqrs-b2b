# RESUMEN EJECUTIVO — PLATAFORMA DOCUMIND & PQRS ENTERPRISE
**Fecha de Entrega:** Octubre 2026 | **Versión:** 1.0 (Entrega Académica Final)  
**Proyecto:** `JuanFe28/actividad-pqrs-n8n` (`H:\vafel-stack\actividad-pqrs-b2b`)  
**Autor / Responsable:** Juan Felipe Celis — Líder Técnico y Desarrollador  

---

## 1. ¿Qué es DocuMind & PQRS?
**DocuMind & PQRS Enterprise** es una solución corporativa integral que unifica:
1. **Atención al Ciudadano y Gestión de PQRS:** Portal web reactivo para radicación pública de peticiones, quejas, reclamos y sugerencias (anónimas o identificadas) con asignación de SLAs automatizados y consulta ciudadana segura con token privado.
2. **Motor de Inteligencia Artificial Documental (RAG):** Repositorio centralizado que procesa documentos no estructurados (PDF, DOCX, TXT), fragmenta su contenido en chunks vectoriales mediante Google Gemini (`gemini-2.0-flash`), almacena embeddings de 768 dimensiones en Pinecone y permite consultas semánticas en lenguaje natural sin alucinaciones, citando fuentes exactas y números de página.
3. **Automatización Empresarial con n8n:** Orquestador de eventos que clasifica peticiones, calcula áreas responsables y fechas límite de atención, persiste trazabilidad en PostgreSQL y gestiona notificaciones por correo electrónico.

---

## 2. Arquitectura Tecnológica en Producción

```
  [ Ciudadano / Funcionario ]
              │ (HTTP / HTTPS)
              ▼
    [ Nginx Reverse Proxy ] ─── (Terminación TLS / Cabeceras IP Limpias)
              │
       ┌──────┴────────────────────────────────┐
       ▼                                       ▼
 [ Frontend SPA React + Vite ]       [ Backend Node.js / Express ]
   (Port 5173 / dist compilada)         (Port 5000 / API REST)
                                               │
                       ┌───────────────────────┼────────────────────────┐
                       ▼                       ▼                        ▼
             [ PostgreSQL 16 ]         [ Google Gemini ]       [ Pinecone DB ]
             (Port 5432 / pqrs_db)     (Embeddings 768d)       (Búsqueda Vectorial)
                       ▲
                       │ (Persistencia y Webhooks)
             [ Motor n8n v2.41.4 ] ─── (SMTP Relay) ─── [ Bandeja de Correo ]
             (Port 5678 / SQLite)
```

---

## 3. Estado Real de Verificación y Pruebas

| Componente | Estado Demostrado | Evidencia Concreta |
| :--- | :---: | :--- |
| **Suite Backend (Jest)** | **100% Aprobada** | **89/89 pruebas aprobadas** en 5 suites unitarias y de integración (18-oct-2026). |
| **Compilación Frontend** | **100% Aprobada** | Vite v5.4.21: 1,579 módulos transformados en 22.66s. Build en `frontend/dist/`. |
| **Control de Acceso (RBAC)** | **Verificado** | Aislamiento departamental vertical y horizontal (`ADMIN`, `SUPERVISOR`, `OPERADOR`). |
| **Seguridad de Archivos** | **Verificado** | Acceso directo a `/uploads` bloqueado con 401; descargas gobernadas con control de permisos. |
| **Protección Ciudadana** | **Verificado** | Ocultamiento de notas internas y enmascaramiento de nombres en consultas públicas. |
| **Persistencia de Datos** | **Verificado** | Volumen `actividad-pqrs-b2b_pqrs_pgdata` intacto con 3 PQRS, 5 usuarios y 7 documentos. |
| **Flujos de Automatización** | **Verificado** | Workflows históricos `5H2fywJsM0SmC2JF` y `PQRS2026Soporte1` operativos en n8n. |

---

## 4. Limitaciones Actuales y Transparencia Técnica

1. **Entorno de Demostración Local:** El sistema opera actualmente en entorno de desarrollo local auditado. La base de datos y n8n corren sobre Docker, mientras que el backend y frontend operan en daemons locales enlazados.
2. **Entrega de Correos SMTP:** El workflow de n8n maneja de forma resiliente la ausencia de relay externo (`onError: continueRegularOutput`), marcando las alertas como `SIN_CONFIRMAR` sin abortar el registro de la PQRS. La entrega a bandejas externas reales exige la provisión de credenciales corporativas (Bloqueador **B-02**).
3. **Terminación TLS en Nginx:** La configuración perimetral de Nginx está totalmente especificada y endurecida en [docs/nginx.conf.example](file:///h:/vafel-stack/actividad-pqrs-b2b/docs/nginx.conf.example), pero su puesta en marcha requiere FQDN corporativo y certificados SSL institucionales (Bloqueador **B-01**).

---

## 5. Valor Aportado y Conclusión
DocuMind & PQRS demuestra que es viable integrar Inteligencia Artificial generativa, búsqueda vectorial en la nube, automatización de procesos empresariales y estrictos controles de ciberseguridad en un producto modular, escalable y listo para ser defendido técnica y académicamente.
