-- Convert the legacy two-person workspace into an invitation-only team.
-- Existing Kabir/Naushad accounts are mapped once, no names are used by runtime authorization.
ALTER TABLE users ADD COLUMN IF NOT EXISTS role varchar(12) NOT NULL DEFAULT 'member';
ALTER TABLE users ADD COLUMN IF NOT EXISTS removed_at timestamptz;
UPDATE users SET role=CASE WHEN display_name='Kabir' THEN 'admin'
                           WHEN display_name='Naushad' THEN 'founder' ELSE 'member' END
  WHERE is_active=true;
ALTER TABLE users ADD CONSTRAINT users_team_role_check CHECK(role IN ('admin','founder','member'));
DROP INDEX IF EXISTS users_one_active_founder_role;

-- Project assignments reference stable Clerk user IDs. 'All' means all Admins and Founders.
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_owner;
ALTER TABLE projects ALTER COLUMN owner_selection TYPE varchar(255);
UPDATE projects p SET owner_selection=u.id
  FROM users u WHERE p.owner_selection=u.display_name AND p.owner_selection<>'Both';
UPDATE projects SET owner_selection='All' WHERE owner_selection='Both';
ALTER TABLE projects ALTER COLUMN owner_selection SET DEFAULT 'All';
ALTER TABLE projects ADD CONSTRAINT projects_team_owner_check
  CHECK(owner_selection='All' OR owner_selection ~ '^user_[A-Za-z0-9]{8,80}$');

-- Historical financial identity labels become stable Clerk IDs. Records remain intact.
ALTER TABLE client_receipts DROP CONSTRAINT IF EXISTS client_receipts_received_by_check;
ALTER TABLE founder_transfers DROP CONSTRAINT IF EXISTS founder_transfers_from_founder_check;
ALTER TABLE founder_transfers DROP CONSTRAINT IF EXISTS founder_transfers_to_founder_check;
UPDATE client_receipts r SET received_by=u.id FROM users u WHERE r.received_by=u.display_name;
UPDATE founder_transfers t SET from_founder=u.id FROM users u WHERE t.from_founder=u.display_name;
UPDATE founder_transfers t SET to_founder=u.id FROM users u WHERE t.to_founder=u.display_name;
ALTER TABLE client_receipts ADD CONSTRAINT client_receipts_receiver_user_fk
  FOREIGN KEY(received_by) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE founder_transfers ADD CONSTRAINT founder_transfers_sender_user_fk
  FOREIGN KEY(from_founder) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE founder_transfers ADD CONSTRAINT founder_transfers_receiver_user_fk
  FOREIGN KEY(to_founder) REFERENCES users(id) ON DELETE RESTRICT;

-- Invitation records are the sole entry point for future team accounts.
CREATE TABLE IF NOT EXISTS team_invitations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 email varchar(320) NOT NULL UNIQUE,
 display_name varchar(120) NOT NULL,
 role varchar(12) NOT NULL CHECK(role IN ('admin','founder','member')),
 expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
 status varchar(12) NOT NULL DEFAULT 'pending'
   CHECK(status IN ('pending','sent','accepted','failed','revoked')),
 clerk_invitation_id varchar(255),
 invited_by_id varchar(255) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 accepted_by_id varchar(255) REFERENCES users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS team_invitations_status_idx ON team_invitations(status,created_at DESC);

-- Preserve the old explicit memberships while establishing role-driven All assignments.
INSERT INTO project_members(project_id,user_id)
 SELECT p.id,u.id FROM projects p CROSS JOIN users u
 WHERE p.is_private=false AND p.owner_selection='All'
   AND u.role IN ('admin','founder') AND u.is_active=true AND u.revoked_at IS NULL
 ON CONFLICT DO NOTHING;
