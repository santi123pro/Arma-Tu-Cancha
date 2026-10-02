const express = require('express');
const cors = require('cors');
const db = require('./config/db'); 

// Solo las rutas web principales van aquí:
const canchasRoutes = require('./routes/canchas'); 
const reservasRoutes = require('./routes/reservas'); 
const authRoutes = require('./routes/auth');
const partidosRoutes = require('./routes/partidos');
const torneosRoutes = require('./routes/torneos'); 
const dashboardRoutes = require('./routes/dashboard'); 

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// === RUTAS DEL SISTEMA ===
app.use('/api/canchas', canchasRoutes);
app.use('/api/reservas', reservasRoutes); 
app.use('/api/auth', authRoutes);
app.use('/api/partidos', partidosRoutes);
app.use('/api/torneos', torneosRoutes); 
app.use('/api/dashboard', dashboardRoutes); 

app.get('/', (req, res) => {
  res.send('¡Backend del Complejo Wembley activo y rodando!');
});

app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});