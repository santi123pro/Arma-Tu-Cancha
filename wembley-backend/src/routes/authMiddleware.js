const jwt = require('jsonwebtoken');

// Asegúrate de usar la misma llave secreta que usas en auth.js para firmar los tokens
const JWT_SECRET = process.env.JWT_SECRET || 'llave_super_secreta_wembley_2026';

// Middleware para verificar si es Administrador
function verificarAdmin(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ error: 'Acceso denegado. Token no proporcionado.' });

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.usuario = decoded;

        if (req.usuario.rol !== 'admin') {
            return res.status(403).json({ error: 'Acceso prohibido. Se requiere rol de Administrador.' });
        }

        next();
    } catch (err) {
        res.status(401).json({ error: 'Token inválido o expirado.' });
    }
}

// Middleware para verificar si es Admin o Ayudante
function verificarAdminOAyudante(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ error: 'Acceso denegado. Token no proporcionado.' });

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.usuario = decoded;

        if (req.usuario.rol !== 'admin' && req.usuario.rol !== 'ayudante') {
            return res.status(403).json({ error: 'Acceso prohibido. Requiere privilegios de gestión.' });
        }

        next();
    } catch (err) {
        res.status(401).json({ error: 'Token inválido o expirado.' });
    }
}

module.exports = { verificarAdmin, verificarAdminOAyudante };