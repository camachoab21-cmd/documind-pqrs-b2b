import pg from 'pg';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getSecret } from '../utils/secrets.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });
dotenv.config({ path: join(__dirname, '../.env') });

const isMysql = process.env.DB_CLIENT === 'mysql';

let pgPool = null;
let mysqlPool = null;

if (isMysql) {
  mysqlPool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'root',
    password: getSecret('DB_PASSWORD', {
      aliases: ['DB_PASS'],
      defaultValue: '',
      disallowDefaultInProduction: false,
    }),
    database: process.env.DB_NAME || 'documind_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4',
  });
} else {
  // PostgreSQL Unificado (DocuMind + PQRS)
  pgPool = new pg.Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    user: process.env.DB_USER || 'pqrs_user',
    password: getSecret('DB_PASSWORD', {
      aliases: ['DB_PASS'],
      defaultValue: 'pqrs_password',
      disallowDefaultInProduction: true,
      mandatory: true,
    }),
    database: process.env.DB_NAME || 'pqrs_db',
    max: 15,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  pgPool.on('error', (err) => {
    console.error('[PostgreSQL Pool Error]', err.message);
  });
}

/**
 * Ejecuta una sentencia SQL parametrizada compatible con PostgreSQL y MySQL
 * @param {string} sql - Sentencia SQL con placeholders ? o $1
 * @param {Array} params - Valores de los parámetros
 * @returns {Promise<Array>} Filas resultantes con soporte de insertId y affectedRows
 */
export async function query(sql, params = []) {
  if (isMysql && mysqlPool) {
    const [rows] = await mysqlPool.execute(sql, params);
    return rows;
  }

  // Traducción transparente de placeholders MySQL (?) a PostgreSQL ($1, $2, ...)
  let paramIndex = 1;
  let translatedSql = sql.replace(/\?/g, () => `$${paramIndex++}`);

  // Compatibilidad para INSERT: obtener ID generado en PostgreSQL
  const isInsert = /^\s*INSERT\s+INTO/i.test(translatedSql);
  const hasReturning = /RETURNING\s+/i.test(translatedSql);
  if (isInsert && !hasReturning) {
    translatedSql += ' RETURNING id';
  }

  try {
    const res = await pgPool.query(translatedSql, params);
    const rows = res.rows || [];

    // Propiedades de compatibilidad estilo MySQL
    if (isInsert && rows.length > 0 && rows[0].id !== undefined) {
      rows.insertId = rows[0].id;
    }
    rows.affectedRows = res.rowCount || 0;

    return rows;
  } catch (error) {
    console.error(`[DB Error] Query: "${translatedSql.slice(0, 100)}..." ->`, error.message);
    throw error;
  }
}

/**
 * Cierra la piscina de conexiones (utilizado en testing y apagado seguro)
 */
export async function end() {
  if (mysqlPool) await mysqlPool.end();
  if (pgPool) await pgPool.end();
}

export default { query, end };
