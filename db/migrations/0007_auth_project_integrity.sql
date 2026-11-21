-- Security and workflow consistency hardening, additive and safe for existing data.
ALTER TABLE users ADD COLUMN IF NOT EXISTS revoked_at timestamptz;
CREATE INDEX IF NOT EXISTS users_revoked_at_idx ON users(revoked_at) WHERE revoked_at IS NOT NULL;

-- A request ID lets clients retry project creation without creating duplicates.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS creation_request_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS projects_creation_request_idx
  ON projects(creation_request_id) WHERE creation_request_id IS NOT NULL;

-- Preserve project-state invariants independently of the API.
ALTER TABLE projects ADD CONSTRAINT projects_not_started_zero
  CHECK (status <> 'not_started' OR progress=0);
ALTER TABLE projects ADD CONSTRAINT projects_progress_100_completed
  CHECK (progress <> 100 OR status='completed');
