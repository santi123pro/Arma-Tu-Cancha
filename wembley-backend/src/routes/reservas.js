const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verificarAdminOAyudante } = require('./authMiddleware');

// 1. OBTENER TODAS LAS RESERVAS (Filtradas por sede para los botones del frontend)
router.get('/', async (req, res) => {
    const sedeSeleccionada = req.query.sede;
    try {
        let query = `
            SELECT r.*, c.nombre AS nombre_cancha, r.cliente AS usuario_correo, c.sede 
            FROM reservas r 
            JOIN canchas c ON r.cancha_id = c.id
        `;
        let params = [];

        if (sedeSeleccionada && sedeSeleccionada !== 'undefined' && sedeSeleccionada !== '') {
            query += ` WHERE c.sede ILIKE $1`;
            params.push(sedeSeleccionada);
        }

        query += ` ORDER BY r.id DESC`;

        const reservas = await db.query(query, params);
        res.json(reservas.rows);
    } catch (error) {
        console.error("Error al obtener reservas:", error);
        res.status(500).json({ error: 'Error al obtener las reservas.' });
    }
});

// 2. OBTENER TODAS LAS RESERVAS DETALLADAS PARA EL ADMIN
router.get('/admin/todas', verificarAdminOAyudante, async (req, res) => {
    try {
        const query = `
            SELECT r.id, r.fecha, r.hora, r.cliente, c.nombre AS nombre_cancha, r.cancha_id
            FROM reservas r
            JOIN canchas c ON r.cancha_id = c.id
            ORDER BY r.id DESC
        `;
        const resultado = await db.query(query);
        res.json(resultado.rows);
    } catch (error) {
        console.error("Error al traer todas las reservas del admin:", error);
        res.status(500).json({ error: 'Error al obtener la lista completa de reservas.' });
    }
});

router.post('/', async (req, res) => {
    const { cancha_id, fecha, hora, cliente } = req.body;

    try {
        // 1. Averiguar a qué sede pertenece la cancha que intentan reservar
        const canchaInfo = await db.query('SELECT sede FROM canchas WHERE id = $1', [cancha_id]);
        if (canchaInfo.rows.length === 0) {
            return res.status(404).json({ error: '❌ La cancha seleccionada no existe.' });
        }
        const sedeDeLaCancha = canchaInfo.rows[0].sede;

        // 2. Validar si ESA HORA Y FECHA ya está ocupada, pero EXCLUSIVAMENTE dentro de las canchas de ESA MISMA SEDE
        const checkReservaSede = await db.query(
            `SELECT r.* FROM reservas r 
             JOIN canchas c ON r.cancha_id = c.id 
             WHERE c.sede ILIKE $1 AND r.fecha::text = $2 AND r.hora = $3`,
            [sedeDeLaCancha, fecha, hora]
        );

        // Ojo aquí: Si quieres que una misma sede no repita hora en NINGUNA de sus canchas, o si es por cancha específica:
        // Si es por CANCHA específica de esa sede, usa esta de abajo:
        const checkReservaCancha = await db.query(
            'SELECT * FROM reservas WHERE cancha_id = $1 AND fecha::text = $2 AND hora = $3',
            [cancha_id, fecha, hora]
        );

        if (checkReservaCancha.rows.length > 0) {
            return res.status(400).json({ error: '❌ ¡Jugada anulada! Esta cancha ya está reservada en este horario.' });
        }

        // 3. Insertar la reserva limpia
        const nuevaReserva = await db.query(
            'INSERT INTO reservas (cancha_id, fecha, hora, cliente) VALUES ($1, $2, $3, $4) RETURNING *',
            [cancha_id, fecha, hora, cliente || 'Socio']
        );

        res.status(201).json({ 
            mensaje: '¡Reserva confirmada con éxito, bro!', 
            reserva: nuevaReserva.rows[0] 
        });

    } catch (error) {
        console.error('❌ Error guardando la reserva en BD:', error);
        res.status(500).json({ error: 'Error interno en el servidor.' });
    }
});

// 4. ELIMINAR RESERVA POR ID (Admin / Ayudante)
router.delete('/:id', verificarAdminOAyudante, async (req, res) => {
    const reservaId = req.params.id;

    try {
        const resultado = await db.query('DELETE FROM reservas WHERE id = $1 RETURNING *', [reservaId]);
        
        if (resultado.rows.length === 0) {
            return res.status(404).json({ error: 'Reserva no encontrada.' });
        }

        res.json({ mensaje: '¡Reserva eliminada y horario liberado con éxito!' });
    } catch (error) {
        console.error('Error al eliminar reserva:', error);
        res.status(500).json({ error: 'Error interno en el servidor.' });
    }
});

module.exports = router;