const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verificarAdmin } = require('./authMiddleware');

// OBTENER TODAS LAS CANCHAS (Con filtro flexible por sede)
router.get('/', async (req, res) => {
    const sedeSeleccionada = req.query.sede; 
    try {
        let canchas;
        // Si mandan una sede válida y no está vacía
        if (sedeSeleccionada && sedeSeleccionada !== 'undefined' && sedeSeleccionada !== 'null' && sedeSeleccionada !== '') {
            // Usamos ILIKE para que no importa si escriben 'wembley' o 'Wembley', coincida igual
            canchas = await db.query('SELECT * FROM canchas WHERE sede ILIKE $1 ORDER BY id ASC', [sedeSeleccionada]);
            
            // Si filtrando por sede no devolvió nada (porque aún no le has asignado sede a las canchas en la BD), 
            // devolvemos todas temporalmente para que no se te quede la pantalla en blanco
            if (canchas.rows.length === 0) {
                canchas = await db.query('SELECT * FROM canchas ORDER BY id ASC');
            }
        } else {
            // Si no viene ninguna sede, trae todo por defecto
            canchas = await db.query('SELECT * FROM canchas ORDER BY id ASC');
        }
        res.json(canchas.rows);
    } catch (error) {
        console.error("Error al obtener canchas:", error);
        res.status(500).json({ error: 'Error al obtener las canchas.' });
    }
});

// CREAR CANCHA (Solo Admin) - Ahora recibe y guarda la sede
router.post('/', verificarAdmin, async (req, res) => {
    const { nombre, tipo, precio, sede } = req.body; // Añadimos 'sede' del body
    try {
        const nuevaCancha = await db.query(
            'INSERT INTO canchas (nombre, tipo, precio, sede) VALUES ($1, $2, $3, $4) RETURNING *',
            [nombre, tipo, precio, sede || 'Wembley'] // Si no mandan sede, por defecto le asigna Wembley
        );
        res.status(201).json({ mensaje: 'Cancha creada con éxito', cancha: nuevaCancha.rows[0] });
    } catch (error) {
        console.error("Error al crear cancha:", error);
        res.status(500).json({ error: 'Error al crear la cancha.' });
    }
});

// ELIMINAR CANCHA (Solo Admin) -> Esta se queda exactamente igual, no cambia nada
router.delete('/:id', verificarAdmin, async (req, res) => {
    const canchaId = req.params.id;
    try {
        await db.query('DELETE FROM reservas WHERE cancha_id = $1', [canchaId]);
        await db.query('DELETE FROM partidos_abiertos WHERE cancha_id = $1', [canchaId]);
        const resultado = await db.query('DELETE FROM canchas WHERE id = $1 RETURNING *', [canchaId]);

        if (resultado.rows.length === 0) {
            return res.status(404).json({ error: 'Cancha no encontrada.' });
        }

        res.json({ mensaje: '¡Cancha y sus registros asociados eliminados con éxito!' });
    } catch (error) {
        console.error("Error al eliminar cancha:", error);
        res.status(500).json({ error: 'Error interno al eliminar la cancha.' });
    }
});

module.exports = router;