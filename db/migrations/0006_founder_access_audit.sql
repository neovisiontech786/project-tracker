-- Audit founder onboarding, approval and future access-management operations.
CREATE TABLE IF NOT EXISTS founder_access_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id varchar(255) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  subject_id varchar(255) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action varchar(80) NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS founder_access_events_subject_created_idx ON founder_access_events(subject_id, created_at DESC);
