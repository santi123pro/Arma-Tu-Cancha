// src/routes/torneos.js
const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { verificarAdminOAyudante } = require('./authMiddleware');

// ── GET / ─────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const sede = req.query.sede;
  try {
    let query = 'SELECT * FROM torneos';
    const params = [];
    if (sede && sede !== 'undefined' && sede !== '') {
      query += ' WHERE sede ILIKE $1'; params.push(sede);
    }
    query += ' ORDER BY id DESC';
    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('[TORNEOS] GET /:', err.message);
    res.status(500).json({ error: 'Error al obtener torneos.' });
  }
});

// ── POST / — Crear torneo ─────────────────────────────────────
router.post('/', async (req, res) => {
  const { nombre, descripcion, modalidad, cupos_totales, sede } = req.body;
  if (!nombre?.trim() || !modalidad?.trim() || !cupos_totales)
    return res.status(400).json({ error: 'Nombre, modalidad y cupos son obligatorios.' });
  if (cupos_totales < 2 || cupos_totales > 32)
    return res.status(400).json({ error: 'El torneo debe tener entre 2 y 32 equipos.' });

  try {
    const { rows } = await db.query(
      `INSERT INTO torneos (nombre, descripcion, modalidad, cupos_totales, cupos_inscritos, estado, sede)
       VALUES ($1,$2,$3,$4,0,'abierto',$5) RETURNING *`,
      [nombre.trim(), descripcion?.trim() || '', modalidad.trim(), cupos_totales, sede || 'Wembley']
    );
    res.status(201).json({ mensaje: '¡Torneo creado!', torneo: rows[0] });
  } catch (err) {
    console.error('[TORNEOS] POST /:', err.message);
    res.status(500).json({ error: 'Error al crear el torneo.' });
  }
});

// ── PUT /:id — Editar torneo ──────────────────────────────────
router.put('/:id', verificarAdminOAyudante, async (req, res) => {
  const { id } = req.params;
  const { nombre, descripcion, modalidad, cupos_totales, estado } = req.body;
  try {
    const { rows } = await db.query(
      `UPDATE torneos
       SET nombre = COALESCE($1, nombre),
           descripcion = COALESCE($2, descripcion),
           modalidad = COALESCE($3, modalidad),
           cupos_totales = COALESCE($4, cupos_totales),
           estado = COALESCE($5, estado)
       WHERE id = $6 RETURNING *`,
      [nombre||null, descripcion||null, modalidad||null,
       cupos_totales||null, estado||null, id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Torneo no encontrado.' });
    res.json({ mensaje: 'Torneo actualizado.', torneo: rows[0] });
  } catch (err) {
    console.error('[TORNEOS] PUT /:id:', err.message);
    res.status(500).json({ error: 'Error al actualizar el torneo.' });
  }
});

// ── DELETE /:id ───────────────────────────────────────────────
router.delete('/:id', verificarAdminOAyudante, async (req, res) => {
  const { id } = req.params;
  try {
    // Borrar inscripciones primero (ambas tablas por inconsistencia en la BD)
    await db.query('DELETE FROM inscripciones_torneo  WHERE torneo_id = $1', [id]);
    await db.query('DELETE FROM inscripciones_torneos WHERE torneo_id = $1', [id]).catch(()=>{});
    const { rows } = await db.query(
      'DELETE FROM torneos WHERE id = $1 RETURNING *', [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Torneo no encontrado.' });
    res.json({ mensaje: '¡Torneo eliminado!' });
  } catch (err) {
    console.error('[TORNEOS] DELETE /:id:', err.message);
    res.status(500).json({ error: 'Error al eliminar el torneo.' });
  }
});

// ── POST /:id/inscribir ───────────────────────────────────────
router.post('/:id/inscribir', async (req, res) => {
  const torneoId = req.params.id;
  const { capitan_id, nombre_equipo } = req.body;

  if (!capitan_id || !nombre_equipo?.trim())
    return res.status(400).json({ error: 'capitan_id y nombre_equipo son obligatorios.' });

  try {
    const { rows: tRows } = await db.query(
      'SELECT * FROM torneos WHERE id = $1', [torneoId]
    );
    if (!tRows.length) return res.status(404).json({ error: 'Torneo no encontrado.' });

    const t = tRows[0];
    if (t.estado === 'cerrado' || t.cupos_inscritos >= t.cupos_totales)
      return res.status(400).json({ error: 'Este torneo ya completó sus cupos y está cerrado.' });

    // Insertar en la tabla correcta (inscripciones_torneos)
    await db.query(
      'INSERT INTO inscripciones_torneos (torneo_id, capitan_id, nombre_equipo) VALUES ($1,$2,$3)',
      [torneoId, capitan_id, nombre_equipo.trim()]
    );

    const nuevosInscritos = t.cupos_inscritos + 1;
    const nuevoEstado     = nuevosInscritos >= t.cupos_totales ? 'cerrado' : 'abierto';

    await db.query(
      'UPDATE torneos SET cupos_inscritos = $1, estado = $2 WHERE id = $3',
      [nuevosInscritos, nuevoEstado, torneoId]
    );

    res.json({
      mensaje: nuevoEstado === 'cerrado'
        ? '¡Inscripción exitosa! El torneo se completó. 🏆'
        : '¡Equipo inscrito correctamente!',
      estado: nuevoEstado,
      cupos_restantes: t.cupos_totales - nuevosInscritos
    });
  } catch (err) {
    console.error('[TORNEOS] POST /inscribir:', err.message);
    res.status(500).json({ error: 'Error al inscribir el equipo.' });
  }
});

module.exports = router;
