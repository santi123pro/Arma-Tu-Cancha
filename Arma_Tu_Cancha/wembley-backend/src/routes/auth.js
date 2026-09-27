// src/routes/auth.js
const express = require('express');
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const router  = express.Router();
const db      = require('../config/db');
const { verificarAdminOAyudante } = require('./authMiddleware');

const JWT_SECRET = process.env.JWT_SECRET || 'llave_super_secreta_wembley_2026';

// ── Validaciones básicas ──────────────────────────────────────
function validarCorreo(correo) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
}

// ── REGISTRO ─────────────────────────────────────────────────
router.post('/registro', async (req, res) => {
  const { nombre, correo, password } = req.body;

  if (!nombre?.trim() || !correo?.trim() || !password)
    return res.status(400).json({ error: 'Nombre, correo y contraseña son obligatorios.' });
  if (!validarCorreo(correo))
    return res.status(400).json({ error: 'El correo no tiene un formato válido.' });
  if (password.length < 6)
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });

  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await db.query(
      'INSERT INTO usuarios (nombre, correo, password_hash) VALUES ($1, $2, $3) RETURNING id, nombre, correo, rol',
      [nombre.trim(), correo.trim().toLowerCase(), hash]
    );
    res.status(201).json({ mensaje: '¡Cuenta creada con éxito!', usuario: rows[0] });
  } catch (err) {
    if (err.code === '23505')
      return res.status(409).json({ error: 'Ese correo ya está registrado.' });
    console.error('[AUTH] Registro:', err.message);
    res.status(500).json({ error: 'Error interno al registrar.' });
  }
});

// ── LOGIN ─────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { correo, password } = req.body;

  if (!correo?.trim() || !password)
    return res.status(400).json({ error: 'Correo y contraseña son obligatorios.' });

  try {
    const { rows } = await db.query(
      'SELECT * FROM usuarios WHERE correo = $1',
      [correo.trim().toLowerCase()]
    );
    if (!rows.length)
      return res.status(401).json({ error: 'Credenciales incorrectas.' });

    const usuario = rows[0];
    const valida  = await bcrypt.compare(password, usuario.password_hash);
    if (!valida)
      return res.status(401).json({ error: 'Credenciales incorrectas.' });

    const token = jwt.sign(
      { id: usuario.id, correo: usuario.correo, rol: usuario.rol || 'jugador' },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({ mensaje: '¡Bienvenido!', token, rol: usuario.rol || 'jugador' });
  } catch (err) {
    console.error('[AUTH] Login:', err.message);
    res.status(500).json({ error: 'Error interno al iniciar sesión.' });
  }
});

// ── LISTAR USUARIOS (admin / ayudante) ───────────────────────
router.get('/usuarios', verificarAdminOAyudante, async (_req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, nombre, correo, rol FROM usuarios ORDER BY id DESC'
    );
    res.json(rows);
  } catch (err) {
    console.error('[AUTH] Usuarios:', err.message);
    res.status(500).json({ error: 'Error al obtener usuarios.' });
  }
});

module.exports = router;
