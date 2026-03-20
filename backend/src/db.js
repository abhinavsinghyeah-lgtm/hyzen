const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function initDb() {
  // Keep schema minimal; endpoints currently do not require persistence,
  // but we seed settings so the "Settings" page can work.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS hyzen_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      docker_socket_path TEXT,
      docker_host TEXT,
      docker_port INTEGER,
      admin_user TEXT,
      admin_password TEXT
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS hyzen_deployments (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      repo_url TEXT NOT NULL,
      branch TEXT NOT NULL,
      container_name TEXT NOT NULL,
      ram_mb INTEGER,
      cpu_cores NUMERIC,
      status TEXT,
      url TEXT,
      output TEXT
    );
  `);

  // Backfill for older installs.
  await pool.query(`
    ALTER TABLE hyzen_deployments
    ADD COLUMN IF NOT EXISTS url TEXT;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      plan TEXT NOT NULL DEFAULT 'free',
      plan_expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_containers (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      container_id TEXT NOT NULL,
      name TEXT NOT NULL,
      url TEXT,
      ram TEXT,
      cpu TEXT,
      status TEXT,
      env_vars JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Seed settings from .env if not already present.
  const current = await pool.query(`SELECT id FROM hyzen_settings WHERE id = 1;`);
  if (current.rows.length === 0) {
    const dockerSocketPath = process.env.DOCKER_SOCKET_PATH || "/var/run/docker.sock";
    const dockerHost = process.env.DOCKER_HOST || null;
    const dockerPort = Number(process.env.DOCKER_PORT || 2375);
    const adminUser = process.env.ADMIN_USER;
    const adminPassword = process.env.ADMIN_PASSWORD;

    await pool.query(
      `
      INSERT INTO hyzen_settings
        (id, docker_socket_path, docker_host, docker_port, admin_user, admin_password)
      VALUES (1, $1, $2, $3, $4, $5);
      `,
      [dockerSocketPath, dockerHost, dockerPort, adminUser, adminPassword]
    );
  }
}

function getPool() {
  return pool;
}

async function getSettings() {
  const res = await pool.query(`SELECT * FROM hyzen_settings WHERE id = 1;`);
  return res.rows[0];
}

async function updateSettings({ docker_socket_path, docker_host, docker_port, admin_user, admin_password }) {
  await pool.query(
    `
    UPDATE hyzen_settings
    SET docker_socket_path = $1,
        docker_host = $2,
        docker_port = $3,
        admin_user = $4,
        admin_password = $5
    WHERE id = 1;
    `,
    [docker_socket_path || null, docker_host || null, docker_port || null, admin_user, admin_password]
  );
}

module.exports = {
  initDb,
  getPool,
  getSettings,
  updateSettings,
};

