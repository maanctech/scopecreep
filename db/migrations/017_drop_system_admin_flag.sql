-- is_system_admin was read on every sign-in, carried through the
-- authentication context, and consulted by nothing. No permission check read
-- it and no policy referenced it: row-level security reads app.system_access,
-- which only the system-access scope writes. A column named like a standing
-- privilege is the first thing set during an incident and the last unset.

ALTER TABLE users DROP COLUMN is_system_admin;
