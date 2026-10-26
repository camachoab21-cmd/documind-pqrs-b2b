import jwt from 'jsonwebtoken';
import { getSecret } from '../utils/secrets.js';

/**
 * Obtiene la clave secreta para la firma y verificación de tokens JWT.
 * Admite variables directas (JWT_SECRET) y archivos Docker Secrets (JWT_SECRET_FILE).
 * En producción, rechaza estrictamente cualquier clave por defecto o no configurada.
 */
export function obtenerClaveSecretaJWT() {
  const secret = getSecret('JWT_SECRET', {
    defaultValue: 'uts_clavedesarrollo_secreta_documind_2026',
    disallowDefaultInProduction: true,
    mandatory: true,
  });
  if (!secret) {
    throw new Error('Configuración de seguridad incompleta: JWT_SECRET no está definido en el entorno ni por archivo de secretos.');
  }
  return secret;
}

/**
 * Middleware de autenticación JWT.
 * Verifica el Bearer token del header Authorization e inyecta req.user.
 */
export function authMiddleware(req, res, next) {
  let token = null;
  const authHeader = req.headers['authorization'];

  if (authHeader) {
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ ok: false, mensaje: 'Formato de token de autenticación inválido.' });
    }
    token = authHeader.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ ok: false, mensaje: 'Token de autenticación requerido.' });
  }

  try {
    const secret = obtenerClaveSecretaJWT();
    const decoded = jwt.verify(token, secret);
    req.user = decoded; // { id, nombre, email, rol }
    next();
  } catch (err) {
    if (err.message && err.message.includes('JWT_SECRET no está definido')) {
      console.error('[Seguridad Auth]', err.message);
      return res.status(500).json({ ok: false, mensaje: 'Error interno en la configuración de autenticación.' });
    }
    return res.status(401).json({ ok: false, mensaje: 'Token inválido o expirado.' });
  }
}

export const verificarToken = authMiddleware;

/**
 * Middleware de autenticación opcional.
 * Si se envía header Authorization:
 *   - Valida el token JWT: inyecta req.user si es válido.
 *   - Si es inválido, malformado o expirado, retorna HTTP 401.
 * Si NO se envía header Authorization:
 *   - Permite continuar como consulta pública sin autenticar (req.user = null).
 */
export function verificarTokenOpcional(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    req.user = null;
    return next();
  }

  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, mensaje: 'Formato de token de autenticación inválido.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const secret = obtenerClaveSecretaJWT();
    const decoded = jwt.verify(token, secret);
    req.user = decoded; // { id, nombre, email, rol }
    next();
  } catch (err) {
    if (err.message && err.message.includes('JWT_SECRET no está definido')) {
      console.error('[Seguridad Auth]', err.message);
      return res.status(500).json({ ok: false, mensaje: 'Error interno en la configuración de autenticación.' });
    }
    return res.status(401).json({ ok: false, mensaje: 'Token inválido o expirado.' });
  }
}

/**
 * Middleware de autorización por rol.
 * @param {...string} roles - Roles permitidos (ej: 'ADMIN', 'LEGAL')
 */
export function requireRol(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.rol)) {
      return res.status(403).json({
        ok: false,
        mensaje: `Acceso denegado. Se requiere rol: ${roles.join(' o ')}.`,
      });
    }
    next();
  };
}
