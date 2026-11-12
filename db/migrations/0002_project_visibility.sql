-- All existing projects remain shared. A private project is visible only to its creator.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS projects_private_creator_idx ON projects (is_private, created_by_id);
