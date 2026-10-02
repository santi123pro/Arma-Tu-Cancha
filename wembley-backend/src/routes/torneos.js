const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verificarAdminOAyudante, verificarAdmin } = require('./authMiddleware');

// OBTENER TODOS LOS TORNEOS
router.get('/', async (req, res) => {
    const sedeSeleccionada = req.query.sede;
    try {
        let query = `SELECT * FROM torneos`;
        let params = [];

        if (sedeSeleccionada && sedeSeleccionada !== 'undefined' && sedeSeleccionada !== '') {
            query += ` WHERE sede ILIKE $1`;
            params.push(sedeSeleccionada);
        }

        query += ` ORDER BY id DESC`;
        const resultado = await db.query(query, params);
        res.json(resultado.rows);
    } catch (error) {
        console.error("Error al obtener torneos:", error);
        res.status(500).json({ error: 'Error al obtener los torneos.' });
    }
});

// CREAR TORNEO (Guardando la sede actual)
router.post('/', async (req, res) => {
    const { nombre, descripcion, modalidad, cupos_totales, sede } = req.body;
    try {
        const nuevoTorneo = await db.query(
            `INSERT INTO torneos (nombre, descripcion, modalidad, cupos_totales, cupos_inscritos, estado, sede) 
             VALUES ($1, $2, $3, $4, 0, 'abierto', $5) RETURNING *`,
            [nombre, descripcion, modalidad, cupos_totales, sede || 'Wembley']
        );
        res.status(201).json({ mensaje: '¡Torneo creado con éxito, bro!', torneo: nuevoTorneo.rows[0] });
    } catch (error) {
        console.error("Error al crear torneo:", error);
        res.status(500).json({ error: 'Error al crear el torneo.' });
    }
});
// MODIFICAR / ACTUALIZAR UN TORNEO (Solo Admin / Ayudante)
router.put('/:id', verificarAdminOAyudante, async (req, res) => {
    const torneoId = req.params.id;
    const { nombre, descripcion, modalidad, cupos_totales, estado } = req.body;

    try {
        const torneoModificado = await db.query(
            `UPDATE torneos 
             SET nombre = COALESCE($1, nombre), 
                 descripcion = COALESCE($2, descripcion), 
                 modalidad = COALESCE($3, modalidad), 
                 cupos_totales = COALESCE($4, cupos_totales), 
                 estado = COALESCE($5, estado) 
             WHERE id = $6 RETURNING *`,
            [nombre, descripcion, modalidad, cupos_totales, estado, torneoId]
        );

        if (torneoModificado.rows.length === 0) {
            return res.status(404).json({ error: 'Torneo no encontrado.' });
        }

        res.json({ mensaje: '✅ Torneo actualizado con éxito.', torneo: torneoModificado.rows[0] });
    } catch (error) {
        console.error('Error al actualizar torneo:', error);
        res.status(500).json({ error: 'Error interno al modificar el torneo.' });
    }
});

router.delete('/:id', verificarAdminOAyudante, async (req, res) => {
    const torneoId = req.params.id;
    try {
        // 1. Borramos usando el nombre exacto de la tabla en singular
        await db.query('DELETE FROM inscripciones_torneo WHERE torneo_id = $1', [torneoId]);
        
        // 2. Borramos el torneo
        const resultado = await db.query('DELETE FROM torneos WHERE id = $1 RETURNING *', [torneoId]);

        if (resultado.rows.length === 0) {
            return res.status(404).json({ error: 'Torneo no encontrado.' });
        }

        res.json({ mensaje: '¡Torneo eliminado con éxito del sistema!' });
    } catch (error) {
        console.error("❌ ERROR REAL:", error.message);
        res.status(500).json({ error: 'Error interno: ' + error.message });
    }
});

// INSCRIBIR EQUIPO AL TORNEO
router.post('/:id/inscribir', async (req, res) => {
    const torneoId = req.params.id;
    const { capitan_id, nombre_equipo } = req.body;

    try {
        const torneoCheck = await db.query('SELECT * FROM torneos WHERE id = $1', [torneoId]);
        if (torneoCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Torneo no encontrado.' });
        }

        const torneo = torneoCheck.rows[0];

        if (torneo.estado === 'cerrado' || torneo.cupos_inscritos >= torneo.cupos_totales) {
            return res.status(400).json({ error: '⚠️ Este torneo ya completó sus cupos y está cerrado.' });
        }

        await db.query(
            'INSERT INTO inscripciones_torneos (torneo_id, capitan_id, nombre_equipo) VALUES ($1, $2, $3)',
            [torneoId, capitan_id, nombre_equipo]
        );

        const nuevosInscritos = torneo.cupos_inscritos + 1;
        const nuevoEstado = nuevosInscritos >= torneo.cupos_totales ? 'cerrado' : 'abierto';

        await db.query(
            'UPDATE torneos SET cupos_inscritos = $1, estado = $2 WHERE id = $3',
            [nuevosInscritos, nuevoEstado, torneoId]
        );

        res.json({ 
            mensaje: nuevoEstado === 'cerrado' 
                ? '¡Inscripción exitosa! El torneo se ha completado y cerrado oficialmente 🏆' 
                : '¡Equipo inscrito exitosamente!', 
            estado: nuevoEstado 
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al inscribir el equipo.' });
    }
});

module.exports = router;