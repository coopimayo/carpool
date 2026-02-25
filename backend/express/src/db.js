const { Pool } = require('pg');

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function createPool() {
  if (process.env.DATABASE_URL) {
    return new Pool({ connectionString: process.env.DATABASE_URL });
  }

  return new Pool({
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT || 5432),
    user: requireEnv('PGUSER'),
    password: requireEnv('PGPASSWORD'),
    database: requireEnv('PGDATABASE'),
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
