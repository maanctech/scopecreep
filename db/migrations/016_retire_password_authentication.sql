DROP TABLE IF EXISTS password_reset_tokens;
DROP TABLE IF EXISTS user_sessions;

ALTER TABLE users DROP COLUMN IF EXISTS password_hash;
ALTER TABLE users DROP COLUMN IF EXISTS password_changed_at;
