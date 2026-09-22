const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'wembley_db',
  password: '1234', // Contraseña directa para probar
  port: 5432,
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('Error conectando a PostgreSQL, bro:', err.stack);
  } else {
    console.log('¡Conectado a la base de datos PostgreSQL exitosamente!');
  }
});

module.exports = pool;