ALTER TABLE communication_connections DROP CONSTRAINT communication_connections_status_check;
UPDATE communication_connections SET status = CASE status
  WHEN 'Not Connected' THEN 'Not Configured'
  WHEN 'Paused' THEN 'Disabled'
  WHEN 'Error' THEN 'Needs Attention'
  ELSE status END;
ALTER TABLE communication_connections
  ADD CONSTRAINT communication_connections_status_check
  CHECK (status IN ('Not Configured', 'Credentials Required', 'Connected', 'Syncing', 'Needs Attention', 'Disabled')),
  ADD COLUMN last_tested_at timestamptz,
  ADD COLUMN connection_verified_at timestamptz,
  ADD COLUMN sync_scope text,
  ADD COLUMN data_permissions jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE client_messages
  ADD COLUMN recipients jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN subject text,
  ADD COLUMN edited_at timestamptz,
  ADD COLUMN ingested_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX client_messages_content_dedup_idx
  ON client_messages(organization_id, project_id, source, content_sha256)
  WHERE external_id IS NULL AND content_sha256 IS NOT NULL;

ALTER TABLE ingestion_jobs
  ADD COLUMN progress integer NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  ADD COLUMN max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 10),
  ADD COLUMN idempotency_key text,
  ADD COLUMN cancelled_at timestamptz,
  ADD CONSTRAINT ingestion_jobs_org_idempotency_unique UNIQUE (organization_id, idempotency_key);

CREATE TABLE webhook_deliveries (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES communication_connections(id) ON DELETE CASCADE,
  delivery_id text NOT NULL,
  payload_sha256 text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, connection_id, delivery_id),
  UNIQUE (organization_id, id)
);

ALTER TABLE webhook_deliveries
  ADD CONSTRAINT webhook_deliveries_connection_org_fk
  FOREIGN KEY (organization_id, connection_id) REFERENCES communication_connections(organization_id, id) ON DELETE CASCADE;

CREATE INDEX ingestion_jobs_org_status_idx ON ingestion_jobs(organization_id, status, created_at DESC);
CREATE INDEX client_messages_ingested_idx ON client_messages(organization_id, project_id, ingested_at DESC);
