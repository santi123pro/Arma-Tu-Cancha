const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verificarAdminOAyudante } = require('./authMiddleware');

// 1. OBTENER PARTIDOS ABIERTOS
// OBTENER PARTIDOS (Filtrados por sede)
router.get('/', async (req, res) => {
    const sedeSeleccionada = req.query.sede;
    try {
        let query = `
            SELECT p.*, c.nombre AS nombre_cancha, p.sede 
            FROM partidos_abiertos p 
            JOIN canchas c ON p.cancha_id = c.id
        `;
        let params = [];

        if (sedeSeleccionada && sedeSeleccionada !== 'undefined' && sedeSeleccionada !== '') {
            query += ` WHERE p.sede ILIKE $1`;
            params.push(sedeSeleccionada);
        }

        query += ` ORDER BY p.id DESC`;
        const resultado = await db.query(query, params);
        res.json(resultado.rows);
    } catch (error) {
        console.error("Error al obtener partidos:", error);
        res.status(500).json({ error: 'Error al obtener los partidos.' });
    }
});

// CREAR PARTIDO (Guardando la sede actual)
router.post('/', async (req, res) => {
    const { creador_id, cancha_id, fecha, hora, modalidad, nivel, posicion_requerida, cupos_totales, sede } = req.body;
    try {
        const nuevoPartido = await db.query(
            `INSERT INTO partidos_abiertos (creador_id, cancha_id, fecha, hora, modalidad, nivel, posicion_requerida, cupos_totales, cupos_disponibles, sede) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9) RETURNING *`,
            [creador_id, cancha_id, fecha, hora, modalidad, nivel, posicion_requerida, cupos_totales, sede || 'Wembley']
        );
        res.status(201).json({ mensaje: '¡Partido publicado con éxito, bro!', partido: nuevoPartido.rows[0] });
    } catch (error) {
        console.error("Error al crear partido:", error);
        res.status(500).json({ error: 'Error al publicar el partido.' });
    }
});

// 3. UNIRSE A UN PARTIDO (Restar un cupo)
router.put('/:id/unirse', async (req, res) => {
    const partidoId = req.params.id;

    try {
        const check = await db.query('SELECT cupos_disponibles FROM partidos_abiertos WHERE id = $1', [partidoId]);
        
        if (check.rows.length === 0) return res.status(404).json({ error: 'Partido no encontrado.' });
        if (check.rows[0].cupos_disponibles <= 0) return res.status(400).json({ error: '¡Llegaste tarde, bro! Ya no hay cupos.' });

        const actualizado = await db.query(
            'UPDATE partidos_abiertos SET cupos_disponibles = cupos_disponibles - 1 WHERE id = $1 RETURNING *',
            [partidoId]
        );
        
        res.json({ mensaje: '¡Te uniste al partido!', cupos_restantes: actualizado.rows[0].cupos_disponibles });
    } catch (error) {
        console.error("Error en PUT /unirse:", error);
        res.status(500).json({ error: 'Error al unirse al partido.' });
    }
});

// 4. ELIMINAR PARTIDO ABIERTO (Exclusivo Administrador / Ayudante)
router.delete('/:id', verificarAdminOAyudante, async (req, res) => {
    const partidoId = req.params.id;
    try {
        const resultado = await db.query('DELETE FROM partidos_abiertos WHERE id = $1 RETURNING *', [partidoId]);
        
        if (resultado.rows.length === 0) {
            return res.status(404).json({ error: 'Partido no encontrado.' });
        }

        res.json({ mensaje: '¡Partido eliminado del sistema con éxito!' });
    } catch (error) {
        console.error('Error al eliminar partido:', error);
        res.status(500).json({ error: 'Error interno en el servidor.' });
    }
});

module.exports = router;