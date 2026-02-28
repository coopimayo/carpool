CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('driver', 'passenger')),
  location_lat DOUBLE PRECISION NOT NULL,
  location_lng DOUBLE PRECISION NOT NULL,
  capacity INTEGER,
  seats_required INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth_accounts (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS optimization_results (
  id UUID PRIMARY KEY,
  account_id UUID,
  created_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL,
  routes JSONB NOT NULL,
  unassigned_passenger_ids JSONB NOT NULL
);

ALTER TABLE optimization_results
  ADD COLUMN IF NOT EXISTS account_id UUID;

CREATE TABLE IF NOT EXISTS optimization_jobs (
  id UUID PRIMARY KEY,
  account_id UUID,
  status TEXT NOT NULL CHECK (status IN ('queued', 'in_progress', 'completed', 'failed')),
  payload JSONB NOT NULL,
  result_id UUID,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);

ALTER TABLE optimization_jobs
  ADD COLUMN IF NOT EXISTS account_id UUID;

CREATE INDEX IF NOT EXISTS optimization_results_created_at_idx
  ON optimization_results (created_at DESC);

CREATE INDEX IF NOT EXISTS optimization_results_account_created_at_idx
  ON optimization_results (account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS optimization_jobs_status_created_at_idx
  ON optimization_jobs (status, created_at ASC);

CREATE INDEX IF NOT EXISTS optimization_jobs_account_created_at_idx
  ON optimization_jobs (account_id, created_at DESC);
