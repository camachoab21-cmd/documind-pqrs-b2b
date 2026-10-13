import jwt from 'jsonwebtoken';

/**
 * Middleware de autenticación JWT.
 * Verifica el Bearer token del header Authorization e inyecta req.user.
 */
export function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, mensaje: 'Token de autenticación requerido.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, nombre, email, rol }
    next();
  } catch (err) {
    return res.status(401).json({ ok: false, mensaje: 'Token inválido o expirado.' });
  }
}

export const verificarToken = authMiddleware;

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
