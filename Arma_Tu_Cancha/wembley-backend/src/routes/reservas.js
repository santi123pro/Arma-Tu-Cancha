// src/routes/reservas.js
const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { verificarAdminOAyudante } = require('./authMiddleware');

// ── GET / — Reservas por sede (público, para mostrar slots ocupados) ──
router.get('/', async (req, res) => {
  const sede = req.query.sede;
  try {
    let query = `
      SELECT r.*, c.nombre AS nombre_cancha, r.cliente AS usuario_correo, c.sede
      FROM reservas r
      JOIN canchas c ON r.cancha_id = c.id`;
    const params = [];
    if (sede && sede !== 'undefined' && sede !== '') {
      query += ' WHERE c.sede ILIKE $1';
      params.push(sede);
    }
    query += ' ORDER BY r.id DESC';
    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('[RESERVAS] GET /', err.message);
    res.status(500).json({ error: 'Error al obtener reservas.' });
  }
});

// ── GET /admin/todas — Detalle completo para admin ───────────
router.get('/admin/todas', verificarAdminOAyudante, async (_req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT r.id, r.fecha, r.hora, r.cliente, c.nombre AS nombre_cancha, r.cancha_id
      FROM reservas r
      JOIN canchas c ON r.cancha_id = c.id
      ORDER BY r.id DESC`);
    res.json(rows);
  } catch (err) {
    console.error('[RESERVAS] GET /admin/todas:', err.message);
    res.status(500).json({ error: 'Error al obtener todas las reservas.' });
  }
});

// ── POST / — Crear reserva ────────────────────────────────────
router.post('/', async (req, res) => {
  const { cancha_id, fecha, hora, cliente } = req.body;

  if (!cancha_id || !fecha || !hora)
    return res.status(400).json({ error: 'cancha_id, fecha y hora son obligatorios.' });

  try {
    // Verificar que la cancha exista
    const { rows: canchaRows } = await db.query(
      'SELECT id, nombre FROM canchas WHERE id = $1', [cancha_id]
    );
    if (!canchaRows.length)
      return res.status(404).json({ error: 'La cancha seleccionada no existe.' });

    // Verificar conflicto de reserva (cancha + fecha + hora)
    const { rows: conflicto } = await db.query(
      `SELECT id FROM reservas
       WHERE cancha_id = $1 AND fecha::date = $2::date AND UPPER(hora) = UPPER($3)`,
      [cancha_id, fecha, hora]
    );
    if (conflicto.length)
      return res.status(409).json({
        error: `La ${canchaRows[0].nombre} ya está reservada de ${hora}. Elige otro horario.`
      });

    const { rows } = await db.query(
      'INSERT INTO reservas (cancha_id, fecha, hora, cliente) VALUES ($1, $2, $3, $4) RETURNING *',
      [cancha_id, fecha, hora, (cliente || 'Jugador').trim()]
    );
    res.status(201).json({ mensaje: '¡Reserva confirmada!', reserva: rows[0] });

  } catch (err) {
    console.error('[RESERVAS] POST /:', err.message);
    res.status(500).json({ error: 'Error al crear la reserva.' });
  }
});

// ── DELETE /:id — Eliminar reserva (admin / ayudante) ────────
router.delete('/:id', verificarAdminOAyudante, async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await db.query(
      'DELETE FROM reservas WHERE id = $1 RETURNING *', [id]
    );
    if (!rows.length)
      return res.status(404).json({ error: 'Reserva no encontrada.' });
    res.json({ mensaje: '¡Reserva eliminada y horario liberado!' });
  } catch (err) {
    console.error('[RESERVAS] DELETE /:id:', err.message);
    res.status(500).json({ error: 'Error al eliminar la reserva.' });
  }
});

module.exports = router;
