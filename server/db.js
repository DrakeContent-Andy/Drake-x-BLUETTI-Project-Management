import './env.js';
import pg from 'pg';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error('FATAL: DATABASE_URL is not set. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export function query(text, params) {
  return pool.query(text, params);
}

// Create tables if they don't exist. Safe to run on every boot.
export async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id            SERIAL PRIMARY KEY,
      name          TEXT NOT NULL,
      subject       TEXT DEFAULT '',
      product       TEXT DEFAULT '',
      category      TEXT DEFAULT 'Other',
      month         TEXT DEFAULT '',
      status        TEXT DEFAULT 'Planning',
      value         NUMERIC DEFAULT 0,
      drive_link    TEXT DEFAULT '',
      deliverables  JSONB DEFAULT '[]'::jsonb,
      note          TEXT DEFAULT '',
      show_client   BOOLEAN DEFAULT TRUE,
      sort_order    INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id          SERIAL PRIMARY KEY,
      task        TEXT NOT NULL,
      project_id  INTEGER,
      assignee    TEXT DEFAULT '',
      start_date  DATE,
      due_date    DATE,
      status      TEXT DEFAULT 'To Do',
      priority    TEXT DEFAULT 'Medium',
      drive_link  TEXT DEFAULT '',
      note        TEXT DEFAULT '',
      next_steps  TEXT DEFAULT '',
      log         JSONB DEFAULT '[]'::jsonb
    );

    CREATE TABLE IF NOT EXISTS goals (
      id          SERIAL PRIMARY KEY,
      month       TEXT NOT NULL,
      category    TEXT DEFAULT 'General',
      description TEXT NOT NULL,
      target      TEXT DEFAULT ''
    );

    -- Monthly Plan brainstorm: a planned (free-text) project per month, each
    -- with multiple proposed approaches (Plan A/B/C) stored in options JSONB
    -- as [{ label, description, recommended }].
    CREATE TABLE IF NOT EXISTS plans (
      id            SERIAL PRIMARY KEY,
      month         TEXT NOT NULL,
      project_name  TEXT NOT NULL,
      note          TEXT DEFAULT '',
      options       JSONB DEFAULT '[]'::jsonb,
      sort_order    INTEGER DEFAULT 0
    );

    -- Reports & Results: outcome updates tied to a project + month, each with
    -- multiple sub-results stored in results JSONB as [{ text, link }].
    CREATE TABLE IF NOT EXISTS reports (
      id            SERIAL PRIMARY KEY,
      project_id    INTEGER,
      month         TEXT DEFAULT '',
      title         TEXT DEFAULT '',
      results       JSONB DEFAULT '[]'::jsonb,
      show_client   BOOLEAN DEFAULT TRUE,
      sort_order    INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value JSONB NOT NULL
    );

    CREATE TABLE IF NOT EXISTS slack_log (
      id        SERIAL PRIMARY KEY,
      kind      TEXT NOT NULL,
      period    TEXT NOT NULL,
      posted_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE (kind, period)
    );

    -- Tasks are now a project-centric progress board: drop the old category,
    -- add an expected start date, next-steps, and a timestamped activity log.
    ALTER TABLE tasks DROP COLUMN IF EXISTS category;
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS start_date DATE;
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS next_steps TEXT DEFAULT '';
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS log JSONB DEFAULT '[]'::jsonb;
  `);

  // One-time clear of legacy tasks (disposable) — guarded so it runs exactly once.
  const reset = await pool.query(`SELECT 1 FROM settings WHERE key = 'tasks_reset_v1'`);
  if (!reset.rowCount) {
    await pool.query(`DELETE FROM tasks`);
    await pool.query(`INSERT INTO settings (key, value) VALUES ('tasks_reset_v1', 'true'::jsonb)`);
  }
}
