# PLAN DE RECUPERACIÓN ANTE DESASTRES (DRP) — DOCUMIND & PQRS
**Versión:** 1.0 (Preparación para Producción — Tarea 7)  
**Fecha:** 16 de octubre de 2026  
**Alcance:** Base de datos PostgreSQL (`pqrs_db`), almacenamiento histórico de n8n, documentos físicos (`/uploads`), índices vectoriales Pinecone y servicios de backend/frontend.

---

## 1. Definición y Delimitación de Objetivos de Continuidad (RPO y RTO)

> [!IMPORTANT]
> **Distinción Crítica:** Los valores presentados a continuación constituyen **metas de diseño arquitectónico para Staging y Producción**. En el entorno actual de desarrollo local, la persistencia se verificó ante reinicios ordenados de contenedores, pero los tiempos de recuperación (RTO) y límites de pérdida (RPO) bajo fallo catastrófico no han sido cronometrados empíricamente y permanecen pendientes de validación en Staging.

| Métrica | Definición Operativa | Meta de Diseño (Staging) | Meta de Diseño (Producción) | Estado Actual Demostrado |
| :--- | :--- | :--- | :--- | :--- |
| **RPO** (Recovery Point Objective) | Pérdida máxima admisible de transacciones ante un fallo catastrófico. | <= 24 horas (respaldo lógico nocturno). | **<= 15 minutos** (con WAL Archiving / PITR continuo). | **No medido formalmente** (el contenedor actual opera con `archive_mode: off`). |
| **RTO** (Recovery Time Objective) | Tiempo máximo transcurrido desde la contingencia hasta el restablecimiento total del servicio. | <= 4 horas. | **<= 45 minutos** (despliegue automatizado y restauración). | **No medido formalmente** (requiere simulacro cronometrado en Staging). |

---

## 2. Metodología de Restauración Segura en Sandbox

> [!CAUTION]
> **REGLA DE ORO:** Jamás ejecutar `pg_restore --clean` ni `DROP DATABASE` directamente sobre la base activa de producción. Todo proceso de recuperación debe validarse previamente en un entorno de sandbox efímero.

### Protocolo de Validación en Sandbox:
1. **Creación de base sandbox efímera:**
   ```bash
   docker exec -i pqrs-postgres psql -U pqrs_user -d postgres -c "CREATE DATABASE pqrs_db_sandbox;"
   ```
2. **Restauración del volcado de prueba:**
   ```bash
   docker exec -i pqrs-postgres pg_restore -U pqrs_user -d pqrs_db_sandbox /backups/pqrs_db_snapshot.dump
   ```
3. **Auditoría de integridad referencial y conteo:**
   ```sql
   -- Ejecutar en pqrs_db_sandbox
   SELECT count(*) FROM solicitudes;
   SELECT count(*) FROM actividades;
   SELECT count(*) FROM documentos;
   SELECT count(*) FROM usuarios;
   -- Validar consistencia de claves foráneas
   SELECT a.id FROM actividades a LEFT JOIN solicitudes s ON a.solicitud_id = s.id WHERE s.id IS NULL;
   ```
4. **Destrucción segura de la base sandbox tras verificación:**
   ```bash
   docker exec -i pqrs-postgres psql -U pqrs_user -d postgres -c "DROP DATABASE pqrs_db_sandbox;"
   ```

---

## 3. Delimitación y Alcance de la Extracción Delta Post-Respaldo

> [!WARNING]
> **Limitación Técnica Explícita:** La exportación o volcado en CSV/SQL de tablas selectivas (`solicitudes`, `actividades`) constituye una **medida paliativa de rescate forense**, pero **NO garantiza la reconstrucción integral ni consistente de todos los expedientes**.
> No preserva automáticamente:
> - Archivos binarios físicos en `/uploads` o tablas de adjuntos desincronizados.
> - Vectores y chunks indexados en Pinecone.
> - Secuencias de claves primarias (`solicitudes_id_seq`), lo que provocaría colisiones de IDs al reinsertar.
> - Registros cruzados de auditoría (`logs_auditoria`) ni integridad referencial con usuarios o repositorios creados posteriormente.

Si la base activa sufre una corrupción parcial pero aún permite lecturas, la extracción selectiva de texto permite salvar información de contacto y descripción de la PQRS para atención de contingencia:

```sql
-- Rescate de texto plano para contingencia (NO sustituto de restauración transaccional)
COPY (
  SELECT id, numero_radicado, tipo_solicitud, estado, prioridad, descripcion, created_at, updated_at
  FROM solicitudes 
  WHERE created_at >= '2026-10-16 00:00:00' OR updated_at >= '2026-10-16 00:00:00'
) TO '/tmp/rescate_contingencia_solicitudes.csv' WITH CSV HEADER;
```

---

## 4. Requisitos Verificados de WAL / PITR y Plan de Prueba en Staging

### Estado Comprobado del Contenedor Activo:
- Consulta en tiempo de ejecución: `SHOW wal_level;` -> `replica`.
- Consulta en tiempo de ejecución: `SHOW archive_mode;` -> **`off`**.
- **Conclusión técnica:** El contenedor actual de desarrollo NO archiva segmentos WAL. Por tanto, Point-In-Time-Recovery (PITR) no está activo en el entorno local y no debe simularse modificando el contenedor en producción.

### Procedimiento para Comprobación en Staging (Sin Afectar Activo):
1. **Configuración en Staging:**
   - Montar un volumen dedicado para archivado WAL: `/var/lib/postgresql/wal_archive`.
   - Iniciar PostgreSQL con flags: `-c wal_level=replica -c archive_mode=on -c "archive_command=test ! -f /var/lib/postgresql/wal_archive/%f && cp %p /var/lib/postgresql/wal_archive/%f"`.
2. **Generación de Respaldo Base:**
   - Ejecutar `pg_basebackup -D /backups/base_backup -Ft -z -P -U pqrs_user`.
3. **Simulacro de Transacciones y Punto de Recuperación:**
   - Insertar 10 solicitudes de prueba anotando la marca de tiempo exacta `T_recuperacion`.
   - Generar un fallo intencional en la base de datos de Staging a las `T_recuperacion + 5 minutos`.
4. **Verificación de PITR:**
   - Detener el contenedor de Staging, restaurar el `base_backup`.
   - Configurar `recovery.signal` y `recovery_target_time = 'T_recuperacion'`.
   - Iniciar y comprobar que exactamente las 10 solicitudes existen y no se perdió ninguna transacción anterior a `T_recuperacion`.
   - Registrar los tiempos cronometrados reales de RTO y RPO obtenidos.

---

## 5. Respaldo y Protección del Almacenamiento Histórico de n8n

1. **Directorio crítico:** `vafel-sweet/n8n_data` (contiene SQLite interno, workflows históricos `5H2fywJsM0SmC2JF` y `PQRS2026Soporte1`, clave de cifrado `encryptionKey` y credenciales).
2. **Procedimiento de respaldo seguro en frío:**
   - Crear archivo comprimido tar.gz con hash SHA-256 diario:
     ```bash
     tar -czf /backups/n8n_data_$(date +%Y%m%d).tar.gz -C H:/vafel-stack/vafel-sweet n8n_data
     sha256sum /backups/n8n_data_$(date +%Y%m%d).tar.gz > /backups/n8n_data_$(date +%Y%m%d).sha256
     ```
3. **Regla de integridad:** Prohibido sobrescribir el archivo `config` o cambiar el `encryptionKey`. La restauración exige copiar íntegramente la carpeta preservando permisos de usuario `node (1000:1000)`.

---

## 6. Procedimiento ante Desconexión o Falla de Servicios Externos de IA (Pinecone / Gemini)

1. **Gemini API:** El backend implementa respuestas analíticas de respaldo deterministas y calculadas matemáticamente si la API externa agota su timeout (`5000ms`), garantizando que la radicación y respuesta al usuario continúe sin bloqueo del servidor.
2. **Pinecone Vector Database:** Si la API de Pinecone no responde o no está disponible, el backend registra una advertencia controlada (`console.warn`) y persiste el documento y la solicitud en PostgreSQL de manera relacional, encolando la indexación vectorial para reintento asíncrono.
