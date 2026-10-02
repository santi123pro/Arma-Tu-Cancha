const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verificarAdminOAyudante } = require('./authMiddleware');

router.get('/metricas', verificarAdminOAyudante, async (req, res) => {
    try {
        // Contar reservas de forma segura
        const resReservas = await db.query('SELECT COUNT(*) FROM reservas');
        const totalReservas = parseInt(resReservas.rows[0].count) || 0;

        // Contar torneos de forma segura
        const resTorneos = await db.query('SELECT COUNT(*) FROM torneos');
        const totalTorneos = parseInt(resTorneos.rows[0].count) || 0;

        // Contar usuarios de forma segura
        const resUsuarios = await db.query('SELECT COUNT(*) FROM usuarios');
        const totalUsuarios = parseInt(resUsuarios.rows[0].count) || 0;

        // Listar torneos para el dashboard
        let torneosInfo = [];
        try {
            const tQuery = await db.query('SELECT * FROM torneos ORDER BY id DESC LIMIT 5');
            torneosInfo = tQuery.rows.map(t => ({
                nombre: t.nombre,
                modalidad: t.modalidad || 'General',
                estado: t.estado || 'abierto',
                ganador: t.ganador || 'Por definir'
            }));
        } catch (e) {
            console.log("Aviso: La tabla torneos puede requerir ajustes menores.");
        }

        // Top clientes
        let topClientes = [];
        try {
            const cQuery = await db.query(`
                SELECT cliente AS cliente, COUNT(*) AS total_reservas 
                FROM reservas 
                GROUP BY cliente 
                ORDER BY total_reservas DESC 
                LIMIT 3
            `);
            topClientes = cQuery.rows;
        } catch (e) {
            topClientes = [];
        }

        res.json({
            reservas: totalReservas,
            torneos: totalTorneos,
            usuarios: totalUsuarios,
            torneosInfo,
            topClientes
        });

    } catch (error) {
        console.error("Error crítico en métricas del dashboard:", error);
        res.status(500).json({ error: 'Error interno al calcular las métricas del sistema.' });
    }
});

module.exports = router;