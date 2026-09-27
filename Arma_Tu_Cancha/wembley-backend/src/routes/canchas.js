// src/routes/canchas.js
const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { verificarAdmin } = require('./authMiddleware');

// ── GET / ─────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const sede = req.query.sede;
  try {
    let query  = 'SELECT * FROM canchas';
    const params = [];
    if (sede && sede !== 'undefined' && sede !== '') {
      query += ' WHERE sede ILIKE $1'; params.push(sede);
    }
    query += ' ORDER BY id ASC';
    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('[CANCHAS] GET /:', err.message);
    res.status(500).json({ error: 'Error al obtener canchas.' });
  }
});

// ── POST / — Crear cancha (solo admin) ───────────────────────
router.post('/', verificarAdmin, async (req, res) => {
  const { nombre, tipo, precio, sede } = req.body;
  if (!nombre?.trim() || !tipo?.trim() || !precio)
    return res.status(400).json({ error: 'Nombre, tipo y precio son obligatorios.' });

  try {
    const { rows } = await db.query(
      'INSERT INTO canchas (nombre, tipo, precio, sede) VALUES ($1,$2,$3,$4) RETURNING *',
      [nombre.trim(), tipo.trim(), precio, sede?.trim() || 'Wembley']
    );
    res.status(201).json({ mensaje: 'Cancha creada.', cancha: rows[0] });
  } catch (err) {
    console.error('[CANCHAS] POST /:', err.message);
    res.status(500).json({ error: 'Error al crear la cancha.' });
  }
});

// ── DELETE /:id (solo admin) ──────────────────────────────────
router.delete('/:id', verificarAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM reservas WHERE cancha_id = $1', [id]);
    await db.query('DELETE FROM partidos_abiertos WHERE cancha_id = $1', [id]);
    const { rows } = await db.query(
      'DELETE FROM canchas WHERE id = $1 RETURNING *', [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Cancha no encontrada.' });
    res.json({ mensaje: '¡Cancha y registros asociados eliminados!' });
  } catch (err) {
    console.error('[CANCHAS] DELETE /:id:', err.message);
    res.status(500).json({ error: 'Error al eliminar la cancha.' });
  }
});

module.exports = router;
