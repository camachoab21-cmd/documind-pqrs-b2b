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
        id BIGSERIAL PRIMARY KEY,
        usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        repositorio_id BIGINT REFERENCES repositorios(id) ON DELETE SET NULL,
        titulo VARCHAR(255) NOT NULL,
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id BIGSERIAL PRIMARY KEY,
        thread_id BIGINT NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
        rol VARCHAR(20) NOT NULL,
        contenido TEXT NOT NULL,
        fuentes JSONB,
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
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
