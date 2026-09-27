// src/routes/dashboard.js — Métricas consolidadas
const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { verificarAdminOAyudante } = require('./authMiddleware');

router.get('/metricas', verificarAdminOAyudante, async (_req, res) => {
  try {
    const [rRes, rTorn, rPart, rUser] = await Promise.all([
      db.query('SELECT COUNT(*) FROM reservas'),
      db.query('SELECT COUNT(*) FROM torneos'),
      db.query('SELECT COUNT(*) FROM partidos_abiertos'),
      db.query('SELECT COUNT(*) FROM usuarios'),
    ]);

    // Top 5 torneos recientes
    const { rows: torneosInfo } = await db.query(
      `SELECT nombre, modalidad, estado, cupos_inscritos, cupos_totales
       FROM torneos ORDER BY id DESC LIMIT 5`
    );

    // Top 3 clientes por reservas
    const { rows: topClientes } = await db.query(
      `SELECT cliente, COUNT(*) AS total_reservas
       FROM reservas GROUP BY cliente
       ORDER BY total_reservas DESC LIMIT 3`
    ).catch(() => ({ rows: [] }));

    // Canchas con más reservas (reporte de ocupación)
    const { rows: ocupacion } = await db.query(
      `SELECT c.nombre, c.sede, COUNT(r.id) AS total_reservas
       FROM canchas c LEFT JOIN reservas r ON c.id = r.cancha_id
       GROUP BY c.id, c.nombre, c.sede
       ORDER BY total_reservas DESC`
    ).catch(() => ({ rows: [] }));

    res.json({
      reservas:    parseInt(rRes.rows[0].count)  || 0,
      torneos:     parseInt(rTorn.rows[0].count) || 0,
      partidos:    parseInt(rPart.rows[0].count) || 0,
      usuarios:    parseInt(rUser.rows[0].count) || 0,
      torneosInfo,
      topClientes,
      ocupacion,
    });
  } catch (err) {
    console.error('[DASHBOARD] GET /metricas:', err.message);
    res.status(500).json({ error: 'Error al calcular métricas.' });
  }
});

module.exports = router;
