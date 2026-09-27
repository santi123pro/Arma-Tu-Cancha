// src/routes/partidos.js
const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { verificarAdminOAyudante } = require('./authMiddleware');

// ── GET / — Partidos abiertos ─────────────────────────────────
router.get('/', async (req, res) => {
  const sede = req.query.sede;
  try {
    let query = `
      SELECT p.*, c.nombre AS nombre_cancha
      FROM partidos_abiertos p
      JOIN canchas c ON p.cancha_id = c.id`;
    const params = [];
    if (sede && sede !== 'undefined' && sede !== '') {
      query += ' WHERE p.sede ILIKE $1';
      params.push(sede);
    }
    query += ' ORDER BY p.id DESC';
    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('[PARTIDOS] GET /:', err.message);
    res.status(500).json({ error: 'Error al obtener partidos.' });
  }
});

// ── POST / — Crear partido ────────────────────────────────────
router.post('/', async (req, res) => {
  const { creador_id, cancha_id, fecha, hora, modalidad,
          nivel, posicion_requerida, cupos_totales, sede } = req.body;

  if (!creador_id || !cancha_id || !fecha || !hora || !modalidad || !nivel || !cupos_totales)
    return res.status(400).json({ error: 'Faltan campos obligatorios.' });
  if (cupos_totales < 2 || cupos_totales > 22)
    return res.status(400).json({ error: 'Los cupos deben ser entre 2 y 22.' });

  try {
    const { rows } = await db.query(
      `INSERT INTO partidos_abiertos
         (creador_id, cancha_id, fecha, hora, modalidad, nivel,
          posicion_requerida, cupos_totales, cupos_disponibles, sede)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8,$9) RETURNING *`,
      [creador_id, cancha_id, fecha, hora, modalidad, nivel,
       posicion_requerida || null, cupos_totales, sede || 'Wembley']
    );
    res.status(201).json({ mensaje: '¡Partido publicado!', partido: rows[0] });
  } catch (err) {
    console.error('[PARTIDOS] POST /:', err.message);
    res.status(500).json({ error: 'Error al publicar el partido.' });
  }
});

// ── PUT /:id/unirse — Restar cupo (transacción atómica) ──────
router.put('/:id/unirse', async (req, res) => {
  const { id } = req.params;
  try {
    // UPDATE atómico: solo descuenta si quedan cupos > 0
    const { rows } = await db.query(
      `UPDATE partidos_abiertos
       SET cupos_disponibles = cupos_disponibles - 1
       WHERE id = $1 AND cupos_disponibles > 0
       RETURNING cupos_disponibles`,
      [id]
    );
    if (!rows.length) {
      // Verificar si el partido existe o si no hay cupos
      const { rows: chk } = await db.query(
        'SELECT id, cupos_disponibles FROM partidos_abiertos WHERE id = $1', [id]
      );
      if (!chk.length) return res.status(404).json({ error: 'Partido no encontrado.' });
      return res.status(400).json({ error: '¡Llegaste tarde! Ya no hay cupos disponibles.' });
    }
    res.json({
      mensaje: '¡Te uniste al partido!',
      cupos_restantes: rows[0].cupos_disponibles
    });
  } catch (err) {
    console.error('[PARTIDOS] PUT /unirse:', err.message);
    res.status(500).json({ error: 'Error al unirse al partido.' });
  }
});

// ── DELETE /:id — Eliminar partido (admin / ayudante) ─────────
router.delete('/:id', verificarAdminOAyudante, async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await db.query(
      'DELETE FROM partidos_abiertos WHERE id = $1 RETURNING *', [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Partido no encontrado.' });
    res.json({ mensaje: '¡Partido eliminado!' });
  } catch (err) {
    console.error('[PARTIDOS] DELETE /:id:', err.message);
    res.status(500).json({ error: 'Error al eliminar el partido.' });
  }
});

module.exports = router;
