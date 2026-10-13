import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../config/db.js';

/**
 * POST /api/auth/login
 * Autentica un usuario y devuelve un JWT válido por 24 horas.
 */
export async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ ok: false, mensaje: 'Email y contraseña son requeridos.' });
  }

  try {
    const rows = await db.query('SELECT * FROM usuarios WHERE email = ?', [email]);

    if (rows.length === 0) {
      return res.status(401).json({ ok: false, mensaje: 'Credenciales incorrectas.' });
    }

    const usuario = rows[0];
    const passwordValida = await bcrypt.compare(password, usuario.password_hash);

    if (!passwordValida) {
      return res.status(401).json({ ok: false, mensaje: 'Credenciales incorrectas.' });
    }

    const token = jwt.sign(
      { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.status(200).json({
      ok: true,
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
      },
    });
  } catch (error) {
    console.error('Error en login:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error interno del servidor.' });
  }
}

/**
 * POST /api/auth/register
 * Crea un nuevo usuario. Solo accesible por rol ADMIN.
 */
export async function register(req, res) {
  const { nombre, email, password, rol } = req.body;

  const rolesValidos = ['ADMIN', 'LEGAL', 'FINANCIERO', 'RECLUTADOR'];

  if (!nombre || !email || !password || !rol) {
    return res.status(400).json({ ok: false, mensaje: 'Todos los campos son requeridos: nombre, email, password, rol.' });
  }

  if (!rolesValidos.includes(rol)) {
    return res.status(400).json({ ok: false, mensaje: `Rol inválido. Debe ser uno de: ${rolesValidos.join(', ')}.` });
  }

  try {
    const existente = await db.query('SELECT id FROM usuarios WHERE email = ?', [email]);
    if (existente.length > 0) {
      return res.status(409).json({ ok: false, mensaje: 'El email ya está registrado.' });
    }

    const saltRounds = 12;
    const password_hash = await bcrypt.hash(password, saltRounds);

    const result = await db.query(
      'INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (?, ?, ?, ?)',
      [nombre, email, password_hash, rol]
    );

    return res.status(201).json({
      ok: true,
      mensaje: 'Usuario creado exitosamente.',
      usuario: { id: result.insertId, nombre, email, rol },
    });
  } catch (error) {
    console.error('Error en registro:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error interno del servidor.' });
  }
}

/**
 * GET /api/auth/me
 * Devuelve la información del usuario autenticado.
 */
export async function me(req, res) {
  return res.status(200).json({ ok: true, usuario: req.user });
}
