-- The sweeper and the drain both read the queue across every organization, so
-- neither can use analysis_jobs_org_status_idx, which leads on organization_id.
-- Both are partial: outstanding jobs are a small and self-clearing fraction of
-- the table, while finished ones accumulate forever.
CREATE INDEX analysis_jobs_stale_running_idx
  ON analysis_jobs(updated_at)
  WHERE status = 'Running';

CREATE INDEX analysis_jobs_queued_idx
  ON analysis_jobs(created_at, id)
  WHERE status = 'Queued';
