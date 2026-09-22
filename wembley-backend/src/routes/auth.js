const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = express.Router();
const db = require('../config/db');
const { verificarAdminOAyudante } = require('./authMiddleware'); // 👈 Importamos el middleware que faltaba

// Llave secreta para los tokens
const JWT_SECRET = process.env.JWT_SECRET || 'llave_super_secreta_wembley_2026';

// 1. RUTA DE REGISTRO
router.post('/registro', async (req, res) => {
    const { nombre, correo, password } = req.body;

    try {
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const nuevoUsuario = await db.query(
            'INSERT INTO usuarios (nombre, correo, password_hash) VALUES ($1, $2, $3) RETURNING id, nombre, correo, rol',
            [nombre, correo, passwordHash]
        );

        res.status(201).json({ mensaje: '¡Jugador registrado con éxito!', usuario: nuevoUsuario.rows[0] });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Ese correo ya está en la cancha (ya existe).' });
        }
        res.status(500).json({ error: 'Error en el servidor.' });
    }
});

// 2. RUTA DE LOGIN
router.post('/login', async (req, res) => {
    const { correo, password } = req.body;

    try {
        const resultado = await db.query('SELECT * FROM usuarios WHERE correo = $1', [correo]);
        
        if (resultado.rows.length === 0) {
            return res.status(401).json({ error: 'Credenciales incorrectas.' });
        }

        const usuarioEncontrado = resultado.rows[0];

        const passwordValida = await bcrypt.compare(password, usuarioEncontrado.password_hash);
        
        if (!passwordValida) {
            return res.status(401).json({ error: 'Credenciales incorrectas.' });
        }

        const token = jwt.sign(
            { 
                id: usuarioEncontrado.id, 
                correo: usuarioEncontrado.correo, 
                rol: usuarioEncontrado.rol || 'jugador' 
            }, 
            JWT_SECRET, 
            { expiresIn: '8h' }
        );

        res.json({
            mensaje: '¡Bienvenido!',
            token,
            rol: usuarioEncontrado.rol
        });

    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ error: 'Error en el servidor.' });
    }
}); // 👈 Aquí cierra correctamente la ruta de login

// 3. OBTENER TODOS LOS USUARIOS (Para métricas del Dashboard - FUERA de login)
router.get('/usuarios', verificarAdminOAyudante, async (req, res) => {
    try {
        const usuarios = await db.query('SELECT id, nombre, correo, rol FROM usuarios ORDER BY id DESC');
        res.json(usuarios.rows);
    } catch (error) {
        console.error("Error al obtener usuarios:", error);
        res.status(500).json({ error: 'Error interno al obtener los usuarios.' });
    }
});

module.exports = router;