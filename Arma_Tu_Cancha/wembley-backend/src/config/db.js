// src/config/db.js — Pool con variables de entorno
const { Pool } = require('pg');

const pool = new Pool({
  user:     process.env.DB_USER     || 'postgres',
  host:     process.env.DB_HOST     || 'localhost',
  database: process.env.DB_NAME     || 'wembley_db',
  password: process.env.DB_PASSWORD || '1234',
  port:     parseInt(process.env.DB_PORT) || 5432,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[DB] Error inesperado en el pool:', err.message);
});

pool.connect()
  .then(client => {
    console.log('[DB] Conexión a PostgreSQL exitosa.');
    client.release();
  })
  .catch(err => console.error('[DB] Error al conectar:', err.message));

module.exports = pool;
