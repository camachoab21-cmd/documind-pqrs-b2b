-- ==============================================================================
-- DOCUMIND & PQRS INTEGRATION SCHEMA (PostgreSQL 16)
-- Tablas de gestión documental, metadatos RAG y asistentes virtuales integrados
-- ==============================================================================

-- 1. Tabla de Usuarios para DocuMind
CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    rol VARCHAR(30) NOT NULL DEFAULT 'ADMIN', -- 'ADMIN', 'LEGAL', 'FINANCIERO', 'RECLUTADOR', 'AGENTE'
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- Usuario administrador por defecto para DocuMind
INSERT INTO usuarios (nombre, email, password_hash, rol)
VALUES (
    'Administrador DocuMind',
    'admin@documind.com',
    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', -- admin123
    'ADMIN'
) ON CONFLICT (email) DO NOTHING;

-- 2. Tabla de Repositorios (Carpetas lógicas de conocimiento)
CREATE TABLE IF NOT EXISTS repositorios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    departamento VARCHAR(50) NOT NULL,
    usuario_id INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- Repositorio por defecto de la empresa
INSERT INTO repositorios (id, nombre, descripcion, departamento, usuario_id)
VALUES (
    1,
    'Políticas y Manuales de Soporte',
    'Base de conocimiento oficial para resolución y auditoría de PQRS',
    'Soporte Técnico y Sistemas',
    1
) ON CONFLICT (id) DO NOTHING;

-- 3. Tabla de Documentos Ingestados (con vínculo opcional a Tickets PQRS)
CREATE TABLE IF NOT EXISTS documentos (
    id SERIAL PRIMARY KEY,
    nombre_archivo VARCHAR(255) NOT NULL,
    url_descarga TEXT NOT NULL,
    tipo_formato VARCHAR(10) NOT NULL,
    tamano_bytes BIGINT NOT NULL,
    categoria_detectada VARCHAR(50),
    score_confianza DECIMAL(5,2),
    resumen_ia TEXT,
    estado_procesamiento VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE', -- 'PENDIENTE', 'PROCESANDO', 'COMPLETADO', 'ERROR'
    repositorio_id INT NOT NULL REFERENCES repositorios(id) ON DELETE CASCADE,
    ticket_id VARCHAR(30), -- Vínculo opcional con pqrs_solicitudes
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Metadatos Extraídos por IA (JSON estructurado)
CREATE TABLE IF NOT EXISTS metadatos_extraidos (
    id SERIAL PRIMARY KEY,
    documento_id INT NOT NULL UNIQUE REFERENCES documentos(id) ON DELETE CASCADE,
    metadata_json JSONB NOT NULL,
    fecha_extraccion TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Logs de Errores y Diagnóstico TI
CREATE TABLE IF NOT EXISTS logs_errores (
    id SERIAL PRIMARY KEY,
    documento_id INT,
    severidad VARCHAR(20) NOT NULL, -- 'INFO', 'WARNING', 'ERROR', 'CRITICAL'
    mensaje_error TEXT NOT NULL,
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Logs de Consultas y Métricas de IA
CREATE TABLE IF NOT EXISTS consultas_logs (
    id SERIAL PRIMARY KEY,
    usuario_id INT,
    query_texto TEXT NOT NULL,
    tokens_utilizados INT DEFAULT 0,
    tiempo_respuesta_ms INT DEFAULT 0,
    score_confianza DECIMAL(5,2),
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Hilos de Conversación del Asistente Virtual (Chat Threads)
CREATE TABLE IF NOT EXISTS chat_threads (
    id SERIAL PRIMARY KEY,
    usuario_id INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    repositorio_id INT REFERENCES repositorios(id) ON DELETE CASCADE,
    ticket_id VARCHAR(30), -- Permite chatear en contexto de un ticket específico
    titulo VARCHAR(150) DEFAULT 'Nueva conversación',
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Mensajes del Chat RAG
CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    thread_id INT NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
    rol VARCHAR(20) NOT NULL, -- 'user', 'ia', 'system'
    contenido TEXT NOT NULL,
    fuentes JSONB,
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Fragmentos de Documentos para Búsqueda Semántica Local (Chunks)
CREATE TABLE IF NOT EXISTS documentos_chunks (
    id SERIAL PRIMARY KEY,
    documento_id INT NOT NULL REFERENCES documentos(id) ON DELETE CASCADE,
    chunk_index INT NOT NULL,
    texto_chunk TEXT NOT NULL,
    metadatos JSONB,
    creado_en TIMESTAMPTZ DEFAULT NOW()
);
