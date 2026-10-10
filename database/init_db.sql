-- Proyecto académico PQRS. Ejecutar completo con ON_ERROR_STOP en una base dedicada.
BEGIN;
-- ==============================================================================
-- PROYECTO ACADEMICO: GESTION DE PQRS, MESA DE AYUDA Y SEGUIMIENTO DE PLAZOS
-- Modulo: Definicion de Datos (DDL) y Semilla Inicial Idempotente
-- Base de Datos: PostgreSQL local. Instalación documentada con PostgreSQL 16.
-- ==============================================================================

-- 1. Habilitar extension de identificadores unicos universales (UUID)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Enumeraciones tipadas de negocio
DO $$ BEGIN
    CREATE TYPE enum_ticket_estado AS ENUM (
        'NUEVO', 
        'ASIGNADO', 
        'EN_GESTION', 
        'ESPERANDO_CLIENTE', 
        'RESUELTO', 
        'CERRADO'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE enum_ticket_prioridad AS ENUM (
        'BAJA', 
        'MEDIA', 
        'ALTA', 
        'CRITICA'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE enum_solicitud_tipo AS ENUM (
        'PETICION', 
        'QUEJA', 
        'RECLAMO', 
        'SOPORTE_TECNICO', 
        'SUGERENCIA'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 3. Tabla de Agentes Operativos y Supervisores
CREATE TABLE IF NOT EXISTS usuarios_agentes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(120) NOT NULL,
    email VARCHAR(180) UNIQUE NOT NULL,
    departamento VARCHAR(100) NOT NULL,
    rol VARCHAR(40) DEFAULT 'AGENTE', -- 'SUPERVISOR', 'AGENTE', 'ADMIN'
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabla Principal de PQRS con Soporte Redundante Dual para Compatibilidad
CREATE TABLE IF NOT EXISTS pqrs_solicitudes (
    id SERIAL PRIMARY KEY,
    ticket_id VARCHAR(30) UNIQUE NOT NULL,
    
    -- Campos con compatibilidad dual
    nombre_solicitante VARCHAR(150),
    cliente_nombre VARCHAR(150),
    email_solicitante VARCHAR(180),
    cliente_email VARCHAR(180),
    telefono VARCHAR(40),
    cliente_telefono VARCHAR(40),
    tipo_solicitud VARCHAR(50),
    tipo VARCHAR(50),
    
    -- Metadata operativa
    prioridad VARCHAR(20) NOT NULL DEFAULT 'Media',
    departamento VARCHAR(100) NOT NULL,
    asunto VARCHAR(250) NOT NULL,
    descripcion TEXT NOT NULL,
    estado VARCHAR(30) NOT NULL DEFAULT 'NUEVO',
    es_urgente BOOLEAN DEFAULT false,
    agente_asignado_id UUID REFERENCES usuarios_agentes(id) ON DELETE SET NULL,
    
    -- Metricas de Acuerdo de Nivel de Servicio (SLA)
    sla_horas INT NOT NULL DEFAULT 24,
    sla_fecha_limite TIMESTAMPTZ NOT NULL,
    sla_alerta_enviada BOOLEAN DEFAULT false,
    
    -- Marcas de tiempo de ciclo de vida
    fecha_radicacion TIMESTAMPTZ DEFAULT NOW(),
    fecha_resolucion TIMESTAMPTZ,
    satisfaccion_score INT CHECK (satisfaccion_score BETWEEN 1 AND 5),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Asegurar columnas en caso de tablas preexistentes (Migracion Idempotente)
DO $$ BEGIN
    ALTER TABLE pqrs_solicitudes ADD COLUMN IF NOT EXISTS cliente_nombre VARCHAR(150);
    ALTER TABLE pqrs_solicitudes ADD COLUMN IF NOT EXISTS nombre_solicitante VARCHAR(150);
    ALTER TABLE pqrs_solicitudes ADD COLUMN IF NOT EXISTS cliente_email VARCHAR(180);
    ALTER TABLE pqrs_solicitudes ADD COLUMN IF NOT EXISTS email_solicitante VARCHAR(180);
    ALTER TABLE pqrs_solicitudes ADD COLUMN IF NOT EXISTS cliente_telefono VARCHAR(40);
    ALTER TABLE pqrs_solicitudes ADD COLUMN IF NOT EXISTS telefono VARCHAR(40);
    ALTER TABLE pqrs_solicitudes ADD COLUMN IF NOT EXISTS tipo VARCHAR(50);
    ALTER TABLE pqrs_solicitudes ADD COLUMN IF NOT EXISTS tipo_solicitud VARCHAR(50);
    ALTER TABLE pqrs_solicitudes ADD COLUMN IF NOT EXISTS fecha_resolucion TIMESTAMPTZ;
    ALTER TABLE pqrs_solicitudes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
END $$;

-- 6. Trigger para sincronizar campos duales automaticamente
CREATE OR REPLACE FUNCTION fn_sync_pqrs_columns()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF NEW.nombre_solicitante IS DISTINCT FROM OLD.nombre_solicitante AND NEW.cliente_nombre IS NOT DISTINCT FROM OLD.cliente_nombre THEN NEW.cliente_nombre := NEW.nombre_solicitante; END IF;
        IF NEW.email_solicitante IS DISTINCT FROM OLD.email_solicitante AND NEW.cliente_email IS NOT DISTINCT FROM OLD.cliente_email THEN NEW.cliente_email := NEW.email_solicitante; END IF;
        IF NEW.telefono IS DISTINCT FROM OLD.telefono AND NEW.cliente_telefono IS NOT DISTINCT FROM OLD.cliente_telefono THEN NEW.cliente_telefono := NEW.telefono; END IF;
        IF NEW.tipo_solicitud IS DISTINCT FROM OLD.tipo_solicitud AND NEW.tipo IS NOT DISTINCT FROM OLD.tipo THEN NEW.tipo := NEW.tipo_solicitud; END IF;
    END IF;
    NEW.cliente_nombre := COALESCE(NEW.cliente_nombre, NEW.nombre_solicitante);
    NEW.cliente_email := COALESCE(NEW.cliente_email, NEW.email_solicitante);
    NEW.cliente_telefono := COALESCE(NEW.cliente_telefono, NEW.telefono, '');
    NEW.tipo := COALESCE(NEW.tipo, NEW.tipo_solicitud, 'Petición');
    NEW.nombre_solicitante := NEW.cliente_nombre;
    NEW.email_solicitante := NEW.cliente_email;
    NEW.telefono := NEW.cliente_telefono;
    NEW.tipo_solicitud := NEW.tipo;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_pqrs_columns ON pqrs_solicitudes;
CREATE TRIGGER trg_sync_pqrs_columns
    BEFORE INSERT OR UPDATE ON pqrs_solicitudes
    FOR EACH ROW
    EXECUTE FUNCTION fn_sync_pqrs_columns();

-- 7. Trigger para actualizacion automatica de updated_at
CREATE OR REPLACE FUNCTION fn_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_pqrs_solicitudes_timestamp ON pqrs_solicitudes;
CREATE TRIGGER trg_update_pqrs_solicitudes_timestamp
    BEFORE UPDATE ON pqrs_solicitudes
    FOR EACH ROW
    EXECUTE FUNCTION fn_update_timestamp();

-- 8. Tabla de Historial de Actividades y Mensajes (Auditoria y Notas Internas)
CREATE TABLE IF NOT EXISTS pqrs_actividades (
    id SERIAL PRIMARY KEY,
    ticket_id VARCHAR(30) NOT NULL REFERENCES pqrs_solicitudes(ticket_id) ON DELETE CASCADE,
    autor_nombre VARCHAR(120) NOT NULL,
    autor_tipo VARCHAR(20) NOT NULL, -- 'CLIENTE', 'AGENTE', 'SISTEMA'
    es_nota_interna BOOLEAN DEFAULT false,
    mensaje TEXT NOT NULL,
    estado_anterior VARCHAR(30),
    estado_nuevo VARCHAR(30),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Indices de Alto Rendimiento para Operaciones y Filtros Frecuentes
CREATE INDEX IF NOT EXISTS idx_pqrs_ticket_id ON pqrs_solicitudes(ticket_id);
CREATE INDEX IF NOT EXISTS idx_pqrs_estado ON pqrs_solicitudes(estado);
CREATE INDEX IF NOT EXISTS idx_pqrs_prioridad ON pqrs_solicitudes(prioridad);
CREATE INDEX IF NOT EXISTS idx_pqrs_es_urgente ON pqrs_solicitudes(es_urgente);
CREATE INDEX IF NOT EXISTS idx_pqrs_sla_limite ON pqrs_solicitudes(sla_fecha_limite);
CREATE INDEX IF NOT EXISTS idx_pqrs_departamento ON pqrs_solicitudes(departamento);
CREATE INDEX IF NOT EXISTS idx_pqrs_actividades_ticket ON pqrs_actividades(ticket_id);


-- Campos de control: reintentos, seguimiento privado y resultado de correo.
ALTER TABLE pqrs_solicitudes ADD COLUMN IF NOT EXISTS request_id UUID DEFAULT uuid_generate_v4();
ALTER TABLE pqrs_solicitudes ADD COLUMN IF NOT EXISTS tracking_token UUID DEFAULT uuid_generate_v4();
ALTER TABLE pqrs_solicitudes ADD COLUMN IF NOT EXISTS payload_original JSONB;
ALTER TABLE pqrs_solicitudes ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE pqrs_solicitudes ADD COLUMN IF NOT EXISTS confirmacion_estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE';
ALTER TABLE pqrs_solicitudes ADD COLUMN IF NOT EXISTS alerta_estado VARCHAR(20) NOT NULL DEFAULT 'NO_APLICA';
ALTER TABLE pqrs_solicitudes ADD COLUMN IF NOT EXISTS confirmacion_error VARCHAR(1000);
ALTER TABLE pqrs_solicitudes ADD COLUMN IF NOT EXISTS alerta_error VARCHAR(1000);
ALTER TABLE pqrs_actividades ADD COLUMN IF NOT EXISTS operation_id UUID;
ALTER TABLE pqrs_actividades ADD COLUMN IF NOT EXISTS datos_operacion JSONB;
ALTER TABLE pqrs_actividades ADD COLUMN IF NOT EXISTS version_resultante INTEGER;
UPDATE pqrs_solicitudes SET request_id=uuid_generate_v4() WHERE request_id IS NULL;
UPDATE pqrs_solicitudes SET tracking_token=uuid_generate_v4() WHERE tracking_token IS NULL;
ALTER TABLE pqrs_solicitudes ALTER COLUMN request_id SET NOT NULL;
ALTER TABLE pqrs_solicitudes ALTER COLUMN tracking_token SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_pqrs_request ON pqrs_solicitudes(request_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pqrs_tracking ON pqrs_solicitudes(tracking_token);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pqrs_operation ON pqrs_actividades(operation_id) WHERE operation_id IS NOT NULL;
CREATE SEQUENCE IF NOT EXISTS pqrs_radicado_seq;
-- Evita solaparse con radicados importados y nunca retrocede la secuencia.
SELECT setval('pqrs_radicado_seq', GREATEST((SELECT last_value FROM pqrs_radicado_seq),
    COALESCE((SELECT MAX(substring(ticket_id from '([0-9]+)$')::bigint)
    FROM pqrs_solicitudes WHERE ticket_id ~ '^PQRS-[0-9]{4}-[0-9]{1,12}$'),0)), true);
UPDATE pqrs_solicitudes SET tipo=CASE tipo WHEN 'Peticion' THEN 'Petición' WHEN 'Soporte Tecnico' THEN 'Soporte Técnico' ELSE tipo END,
    prioridad=CASE prioridad WHEN 'Critica' THEN 'Crítica' ELSE prioridad END
WHERE tipo IN ('Peticion','Soporte Tecnico') OR prioridad='Critica';

DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='pqrs_estado_valido' AND conrelid='pqrs_solicitudes'::regclass) THEN
  ALTER TABLE pqrs_solicitudes ADD CONSTRAINT pqrs_estado_valido CHECK(estado IN ('NUEVO','ASIGNADO','EN_GESTION','ESPERANDO_CLIENTE','RESUELTO','CERRADO'));
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='pqrs_prioridad_valida' AND conrelid='pqrs_solicitudes'::regclass) THEN
  ALTER TABLE pqrs_solicitudes ADD CONSTRAINT pqrs_prioridad_valida CHECK(prioridad IN ('Baja','Media','Alta','Crítica'));
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='pqrs_tipo_valido' AND conrelid='pqrs_solicitudes'::regclass) THEN
  ALTER TABLE pqrs_solicitudes ADD CONSTRAINT pqrs_tipo_valido CHECK(tipo IN ('Petición','Queja','Reclamo','Soporte Técnico','Sugerencia'));
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='pqrs_correo_estados' AND conrelid='pqrs_solicitudes'::regclass) THEN
  ALTER TABLE pqrs_solicitudes ADD CONSTRAINT pqrs_correo_estados CHECK(
   confirmacion_estado IN ('PENDIENTE','ENVIANDO','ENVIADA','ERROR','SIN_CONFIRMAR') AND
   alerta_estado IN ('NO_APLICA','ENVIANDO','ENVIADA','ERROR','SIN_CONFIRMAR'));
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='pqrs_version_valida' AND conrelid='pqrs_solicitudes'::regclass) THEN
  ALTER TABLE pqrs_solicitudes ADD CONSTRAINT pqrs_version_valida CHECK(version>=1);
 END IF;
END $$;

-- Agentes de ejemplo del proyecto original. Son responsables de notas, no cuentas de acceso.
INSERT INTO usuarios_agentes(id,nombre,email,departamento,rol) VALUES
('a0000000-0000-0000-0000-000000000001','Andrea Silva','andrea@example.com','Soporte Técnico y Sistemas','SUPERVISOR'),
('a0000000-0000-0000-0000-000000000002','Carlos Restrepo','carlos@example.com','Facturación y Cobranzas','AGENTE'),
('a0000000-0000-0000-0000-000000000003','Valeria Gómez','valeria@example.com','Control de Calidad y Garantías','AGENTE')
ON CONFLICT(id) DO NOTHING;
-- No se insertan solicitudes simuladas. Los ejemplos siguen disponibles en el formulario.

CREATE OR REPLACE FUNCTION pqrs_radicar(p JSONB) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE s pqrs_solicitudes%ROWTYPE; canon JSONB; horas INTEGER; urgente BOOLEAN;
BEGIN
 IF p->>'request_id' IS NULL THEN RAISE EXCEPTION 'request_id requerido'; END IF;
 canon := p - 'request_id';
 PERFORM pg_advisory_xact_lock(hashtextextended(p->>'request_id',0));
 SELECT * INTO s FROM pqrs_solicitudes WHERE request_id=(p->>'request_id')::uuid FOR UPDATE;
 IF FOUND THEN
  IF s.payload_original IS DISTINCT FROM canon THEN RETURN jsonb_build_object('creada',false,'coincide',false); END IF;
  RETURN jsonb_build_object('creada',false,'coincide',true,'solicitud',to_jsonb(s));
 END IF;
 IF p->>'tipo' NOT IN ('Petición','Queja','Reclamo','Soporte Técnico','Sugerencia') OR p->>'prioridad' NOT IN ('Baja','Media','Alta','Crítica') THEN RAISE EXCEPTION 'Tipo o prioridad inválidos'; END IF;
 IF COALESCE(length(trim(p->>'cliente_nombre')),0) NOT BETWEEN 2 AND 150 OR
    COALESCE(length(trim(p->>'cliente_email')),0) NOT BETWEEN 3 AND 180 OR
    COALESCE(length(trim(p->>'asunto')),0) NOT BETWEEN 3 AND 250 OR
    COALESCE(length(trim(p->>'descripcion')),0) NOT BETWEEN 5 AND 5000 THEN RAISE EXCEPTION 'Longitudes inválidas'; END IF;
 urgente := p->>'prioridad' IN ('Alta','Crítica') OR p->>'tipo'='Reclamo';
 horas := CASE WHEN p->>'prioridad'='Crítica' THEN 2 WHEN p->>'prioridad'='Alta' OR p->>'tipo'='Reclamo' THEN 4 WHEN p->>'prioridad'='Baja' THEN 48 ELSE 24 END;
 INSERT INTO pqrs_solicitudes(ticket_id,request_id,payload_original,cliente_nombre,cliente_email,cliente_telefono,
 tipo,prioridad,departamento,asunto,descripcion,estado,es_urgente,sla_horas,sla_fecha_limite,confirmacion_estado,alerta_estado)
 VALUES('PQRS-'||to_char(CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota','YYYY')||'-'||lpad(nextval('pqrs_radicado_seq')::text,12,'0'),
 (p->>'request_id')::uuid,canon,p->>'cliente_nombre',p->>'cliente_email',p->>'cliente_telefono',p->>'tipo',p->>'prioridad',
 p->>'departamento',p->>'asunto',p->>'descripcion','NUEVO',urgente,horas,NOW()+make_interval(hours=>horas),'ENVIANDO',CASE WHEN urgente THEN 'ENVIANDO' ELSE 'NO_APLICA' END)
 RETURNING * INTO s;
 INSERT INTO pqrs_actividades(ticket_id,autor_nombre,autor_tipo,es_nota_interna,mensaje,estado_nuevo)
 VALUES(s.ticket_id,'Sistema n8n','SISTEMA',false,'Solicitud registrada. Plazo de atención: '||horas||' horas corridas.','NUEVO');
 RETURN jsonb_build_object('creada',true,'coincide',true,'solicitud',to_jsonb(s));
END $$;

CREATE OR REPLACE FUNCTION pqrs_registrar_correo(p UUID, canal TEXT, estado_correo TEXT, detalle TEXT) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE s pqrs_solicitudes%ROWTYPE;
BEGIN
 IF canal NOT IN ('confirmacion','alerta') OR estado_correo NOT IN ('ENVIADA','ERROR','SIN_CONFIRMAR') THEN RAISE EXCEPTION 'Estado de correo inválido'; END IF;
 IF canal='confirmacion' THEN
  UPDATE pqrs_solicitudes SET confirmacion_estado=estado_correo,confirmacion_error=left(detalle,1000)
  WHERE request_id=p AND confirmacion_estado='ENVIANDO' RETURNING * INTO s;
 ELSE
  UPDATE pqrs_solicitudes SET alerta_estado=estado_correo,alerta_error=left(detalle,1000),sla_alerta_enviada=(estado_correo='ENVIADA')
  WHERE request_id=p AND alerta_estado='ENVIANDO' RETURNING * INTO s;
 END IF;
 RETURN jsonb_build_object('actualizada',FOUND);
END $$;

CREATE OR REPLACE FUNCTION pqrs_listar() RETURNS JSONB LANGUAGE sql STABLE AS $$
 SELECT jsonb_build_object('status','success','total',COUNT(*),'urgentes',COUNT(*) FILTER(WHERE es_urgente),
 'estandar',COUNT(*) FILTER(WHERE NOT es_urgente),'resueltos',COUNT(*) FILTER(WHERE estado IN ('RESUELTO','CERRADO')),
 'en_gestion',COUNT(*) FILTER(WHERE estado IN ('ASIGNADO','EN_GESTION')),'activos',COUNT(*) FILTER(WHERE estado NOT IN ('RESUELTO','CERRADO')),
 'cumplimiento_pct',CASE WHEN COUNT(*)=0 THEN NULL ELSE round(100.0*COUNT(*) FILTER(WHERE
 (estado IN ('RESUELTO','CERRADO') AND fecha_resolucion IS NOT NULL AND fecha_resolucion<=sla_fecha_limite) OR
 (estado NOT IN ('RESUELTO','CERRADO') AND NOW()<=sla_fecha_limite))/COUNT(*)) END,
 'satisfaccion_promedio',CASE WHEN COUNT(satisfaccion_score)=0 THEN NULL ELSE round(AVG(satisfaccion_score)::numeric,1) END,
 'total_listado',LEAST(COUNT(*),100),'limite_listado',100,
 'tickets',COALESCE((SELECT jsonb_agg(to_jsonb(x)-'payload_original'-'request_id'-'confirmacion_error'-'alerta_error' ORDER BY x.id DESC) FROM (
  SELECT s.*,s.cliente_email AS email,COALESCE((SELECT jsonb_agg(jsonb_build_object('autor',a.autor_nombre,'tipo',a.autor_tipo,'mensaje',a.mensaje,'fecha',a.created_at,
   'es_nota_interna',a.es_nota_interna,'estado_anterior',a.estado_anterior,'estado_nuevo',a.estado_nuevo) ORDER BY a.id)
   FROM pqrs_actividades a WHERE a.ticket_id=s.ticket_id),'[]'::jsonb) actividades
  FROM pqrs_solicitudes s ORDER BY s.id DESC LIMIT 100) x),'[]'::jsonb),
 'agentes',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'nombre',nombre,'departamento',departamento,'rol',rol) ORDER BY nombre)
  FROM usuarios_agentes WHERE activo),'[]'::jsonb)) FROM pqrs_solicitudes;
$$;

CREATE OR REPLACE FUNCTION pqrs_tracking(codigo TEXT, clave UUID) RETURNS JSONB LANGUAGE plpgsql STABLE AS $$
DECLARE t JSONB;
BEGIN
 SELECT jsonb_build_object('ticket_id',s.ticket_id,'cliente_nombre',s.cliente_nombre,'tipo',s.tipo,'prioridad',s.prioridad,
 'departamento',s.departamento,'asunto',s.asunto,'descripcion',s.descripcion,'estado',s.estado,'sla_horas',s.sla_horas,
 'sla_fecha_limite',s.sla_fecha_limite,'fecha_radicacion',s.fecha_radicacion,'fecha_resolucion',s.fecha_resolucion,
 'satisfaccion_score',s.satisfaccion_score,
 'timeline',COALESCE((SELECT jsonb_agg(jsonb_build_object('autor',a.autor_nombre,'tipo',a.autor_tipo,'mensaje',a.mensaje,'fecha',a.created_at) ORDER BY a.id)
 FROM pqrs_actividades a WHERE a.ticket_id=s.ticket_id AND NOT a.es_nota_interna),'[]'::jsonb)) INTO t
 FROM pqrs_solicitudes s WHERE s.ticket_id=codigo AND s.tracking_token=clave;
 IF t IS NULL THEN RETURN jsonb_build_object('status','error','codigo',404,'mensaje','Radicado o clave de consulta incorrectos'); END IF;
 RETURN jsonb_build_object('status','success','codigo',200,'ticket',t);
END $$;

CREATE OR REPLACE FUNCTION pqrs_actualizar(p JSONB) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE s pqrs_solicitudes%ROWTYPE; a usuarios_agentes%ROWTYPE; previo pqrs_actividades%ROWTYPE; destino TEXT; old_estado TEXT;
BEGIN
 destino:=p->>'nuevo_estado';
 IF destino IS NULL OR destino NOT IN ('NUEVO','ASIGNADO','EN_GESTION','ESPERANDO_CLIENTE','RESUELTO','CERRADO') OR
   COALESCE(length(trim(p->>'mensaje_resolucion')),0) NOT BETWEEN 1 AND 2000 OR COALESCE((p->>'version')::int,0)<1 OR
   p->>'operation_id' IS NULL OR p->>'agente_id' IS NULL OR jsonb_typeof(p->'es_nota_interna') IS DISTINCT FROM 'boolean'
 THEN RETURN jsonb_build_object('status','error','codigo',400,'mensaje','Datos de actualización inválidos'); END IF;
 SELECT * INTO s FROM pqrs_solicitudes WHERE ticket_id=p->>'ticket_id' FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('status','error','codigo',404,'mensaje','Radicado no encontrado'); END IF;
 SELECT * INTO previo FROM pqrs_actividades WHERE operation_id=(p->>'operation_id')::uuid;
 IF FOUND THEN
  IF previo.datos_operacion IS DISTINCT FROM p THEN RETURN jsonb_build_object('status','error','codigo',409,'mensaje','Identificador de operación utilizado con otros datos'); END IF;
  RETURN jsonb_build_object('status','success','codigo',200,'duplicada',true,'ticket_id',s.ticket_id,'estado',previo.estado_nuevo,'version',previo.version_resultante,'mensaje','Esta actualización ya fue registrada');
 END IF;
 IF s.version<>(p->>'version')::int THEN RETURN jsonb_build_object('status','error','codigo',409,'mensaje','El ticket cambió. Actualiza el listado antes de editarlo'); END IF;
 SELECT * INTO a FROM usuarios_agentes WHERE id=(p->>'agente_id')::uuid AND activo;
 IF NOT FOUND THEN RETURN jsonb_build_object('status','error','codigo',400,'mensaje','Agente no disponible'); END IF;
 old_estado:=s.estado;
 UPDATE pqrs_solicitudes SET estado=destino,agente_asignado_id=a.id,version=version+1,
 fecha_resolucion=CASE WHEN destino IN ('RESUELTO','CERRADO') THEN COALESCE(fecha_resolucion,NOW()) ELSE NULL END
 WHERE id=s.id RETURNING * INTO s;
 INSERT INTO pqrs_actividades(ticket_id,autor_nombre,autor_tipo,es_nota_interna,mensaje,estado_anterior,estado_nuevo,operation_id,datos_operacion,version_resultante)
 VALUES(s.ticket_id,a.nombre,'AGENTE',(p->>'es_nota_interna')::boolean,p->>'mensaje_resolucion',old_estado,destino,(p->>'operation_id')::uuid,p,s.version);
 RETURN jsonb_build_object('status','success','codigo',200,'duplicada',false,'ticket_id',s.ticket_id,'estado',s.estado,'version',s.version,'mensaje','Ticket actualizado correctamente',
   'cliente_email',s.cliente_email,'cliente_nombre',s.cliente_nombre,'asunto',s.asunto,'agente_nombre',a.nombre);
END $$;

CREATE OR REPLACE FUNCTION pqrs_calificar(codigo TEXT, clave UUID, puntuacion INT, retroalimentacion TEXT) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE s pqrs_solicitudes%ROWTYPE;
BEGIN
 IF puntuacion NOT BETWEEN 1 AND 5 THEN
  RETURN jsonb_build_object('status','error','codigo',400,'mensaje','La calificación debe ser de 1 a 5 estrellas');
 END IF;
 SELECT * INTO s FROM pqrs_solicitudes WHERE ticket_id=codigo AND tracking_token=clave FOR UPDATE;
 IF NOT FOUND THEN
  RETURN jsonb_build_object('status','error','codigo',404,'mensaje','Radicado o clave de consulta incorrectos');
 END IF;
 IF s.estado NOT IN ('RESUELTO','CERRADO') THEN
  RETURN jsonb_build_object('status','error','codigo',400,'mensaje','Solo puede calificar solicitudes resueltas o cerradas');
 END IF;
 UPDATE pqrs_solicitudes SET satisfaccion_score=puntuacion WHERE id=s.id RETURNING * INTO s;
 INSERT INTO pqrs_actividades(ticket_id,autor_nombre,autor_tipo,es_nota_interna,mensaje)
 VALUES(s.ticket_id,s.cliente_nombre,'CLIENTE',false,
   'Calificación del solicitante: '||puntuacion||'/5 estrellas.'||CASE WHEN retroalimentacion IS NOT NULL AND length(trim(retroalimentacion))>0 THEN ' Comentario: '||left(trim(retroalimentacion),500) ELSE '' END);
 RETURN jsonb_build_object('status','success','codigo',200,'mensaje','¡Gracias por calificar la atención!','score',puntuacion,'ticket_id',s.ticket_id);
END $$;
COMMIT;
