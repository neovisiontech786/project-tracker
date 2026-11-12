-- Only one active user can occupy either founder seat.
CREATE UNIQUE INDEX IF NOT EXISTS users_one_active_founder_role ON users (display_name) WHERE is_active = true AND display_name IN ('Kabir','Naushad');
