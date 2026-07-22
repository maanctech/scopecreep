ALTER TABLE analysis_jobs
  ADD COLUMN batch_id uuid,
  ADD COLUMN requested_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN progress integer NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  ADD COLUMN max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 10),
  ADD COLUMN cancel_requested_at timestamptz,
  ADD COLUMN input_references jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN result jsonb;

CREATE UNIQUE INDEX analysis_jobs_message_unique_idx
  ON analysis_jobs(organization_id, client_message_id)
  WHERE client_message_id IS NOT NULL;

CREATE INDEX analysis_jobs_org_status_idx
  ON analysis_jobs(organization_id, status, created_at DESC);

CREATE INDEX analysis_jobs_batch_idx
  ON analysis_jobs(organization_id, batch_id, created_at);
