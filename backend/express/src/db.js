const { Pool } = require('pg');

function createPool() {
  if (process.env.DATABASE_URL) {
    return new Pool({ connectionString: process.env.DATABASE_URL });
  }

  return new Pool({
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || 'carpool',
    password: process.env.PGPASSWORD || 'carpool',
    database: process.env.PGDATABASE || 'carpool',
  });
}

const pool = createPool();

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL client error', err);
});

async function query(text, params) {
  return pool.query(text, params);
}

module.exports = {
  pool,
  query,
};
