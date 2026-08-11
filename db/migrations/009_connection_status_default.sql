-- Migration 005 replaced the communication_connections status vocabulary and
-- rewrote existing rows, mapping 'Not Connected' to 'Not Configured', but left
-- the column default at the retired value. Every current insert names a status
-- explicitly, so the mismatch has never fired; any insert that omits status
-- would violate communication_connections_status_check.
ALTER TABLE communication_connections
  ALTER COLUMN status SET DEFAULT 'Not Configured';
