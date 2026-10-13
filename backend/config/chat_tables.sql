-- ============================================================
-- DocuMind V1.0 — Tablas de Historial de Chat
-- Ejecutar en HeidiSQL o MySQL Workbench sobre documind_db
-- ============================================================

USE documind_db;

CREATE TABLE IF NOT EXISTS chat_threads (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    usuario_id BIGINT UNSIGNED NOT NULL,
    repositorio_id BIGINT UNSIGNED NULL,
    titulo VARCHAR(255) NOT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (repositorio_id) REFERENCES repositorios(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS chat_messages (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    thread_id BIGINT UNSIGNED NOT NULL,
    rol ENUM('user', 'ia') NOT NULL,
    contenido TEXT NOT NULL,
    fuentes JSON NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (thread_id) REFERENCES chat_threads(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

SELECT 'Tablas chat_threads y chat_messages creadas exitosamente.' AS resultado;
