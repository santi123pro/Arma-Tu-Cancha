// ═══════════════════════════════════════════════════════════
//  Arma Tu Cancha — src/app.js  (reescrito)
// ═══════════════════════════════════════════════════════════
require('dotenv').config({ path: require('path').join(__dirname, '../../wembley.env') });

const express = require('express');
const cors    = require('cors');

const canchasRoutes   = require('./routes/canchas');
const reservasRoutes  = require('./routes/reservas');
const authRoutes      = require('./routes/auth');
const partidosRoutes  = require('./routes/partidos');
const torneosRoutes   = require('./routes/torneos');
const dashboardRoutes = require('./routes/dashboard');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ───────────────────────────────────────────────
app.use(cors({
  origin: '*',            // En prod: limitar al dominio del frontend
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));
app.use(express.json({ limit: '10mb' }));

// Log básico de peticiones (dev)
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ── Rutas ────────────────────────────────────────────────────
app.use('/api/canchas',   canchasRoutes);
app.use('/api/reservas',  reservasRoutes);
app.use('/api/auth',      authRoutes);
app.use('/api/partidos',  partidosRoutes);
app.use('/api/torneos',   torneosRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.get('/', (_req, res) => res.json({
  status: 'ok',
  app: 'Arma Tu Cancha API',
  version: '2.0.0',
}));

// ── Manejo global de errores ─────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[ERROR GLOBAL]', err);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

// 404
app.use((_req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada.' });
});

// ── Arranque ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Arma Tu Cancha API corriendo en http://localhost:${PORT}\n`);
});
