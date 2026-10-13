import app from './app.js';
import db from './config/db.js';

const PORT = process.env.PORT || 5000;

/**
 * Migración automática: crea las tablas de historial de chat si no existen.
 * Se ejecuta en cada arranque del servidor sin afectar datos existentes.
 */
async function migrarTablasChatHistorial() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS chat_threads (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        usuario_id BIGINT UNSIGNED NOT NULL,
        repositorio_id BIGINT UNSIGNED NULL,
        titulo VARCHAR(255) NOT NULL,
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE ON UPDATE CASCADE,
        FOREIGN KEY (repositorio_id) REFERENCES repositorios(id) ON DELETE SET NULL ON UPDATE CASCADE
      ) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        thread_id BIGINT UNSIGNED NOT NULL,
        rol ENUM('user', 'ia') NOT NULL,
        contenido TEXT NOT NULL,
        fuentes JSON NULL,
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (thread_id) REFERENCES chat_threads(id) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

    console.log('✅ Tablas de historial de chat verificadas/creadas correctamente.');
  } catch (err) {
    console.error('❌ Error al crear tablas de historial:', err.message);
  }
}

app.listen(PORT, async () => {
  console.log(`\n🚀 DocuMind Backend corriendo en http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🌍 Entorno: ${process.env.NODE_ENV || 'development'}\n`);
  await migrarTablasChatHistorial();
});
