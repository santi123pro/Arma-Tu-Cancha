// src/routes/authMiddleware.js
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'llave_super_secreta_wembley_2026';

function extraerToken(req) {
  const h = req.headers['authorization'];
  if (!h || !h.startsWith('Bearer ')) return null;
  return h.split(' ')[1];
}

function verificarToken(req, res, next, rolesPermitidos) {
  const token = extraerToken(req);
  if (!token)
    return res.status(401).json({ error: 'Token no proporcionado. Inicia sesión.' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.usuario = decoded;
    if (rolesPermitidos && !rolesPermitidos.includes(decoded.rol))
      return res.status(403).json({ error: 'No tienes permisos para esta acción.' });
    next();
  } catch (err) {
    const msg = err.name === 'TokenExpiredError'
      ? 'La sesión expiró. Inicia sesión de nuevo.'
      : 'Token inválido.';
    res.status(401).json({ error: msg });
  }
}

const verificarAdmin = (req, res, next) =>
  verificarToken(req, res, next, ['admin']);

const verificarAdminOAyudante = (req, res, next) =>
  verificarToken(req, res, next, ['admin', 'ayudante']);

const verificarAutenticado = (req, res, next) =>
  verificarToken(req, res, next, null); // cualquier rol

module.exports = { verificarAdmin, verificarAdminOAyudante, verificarAutenticado };
