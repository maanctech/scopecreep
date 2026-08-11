import { DRAIN_JOB_LIMIT, JOB_BUDGET_MS, STALE_JOB_MINUTES } from "@/constants/typescript/analysis";
import { query } from "@/lib/db/client";
import { withSystemAccess } from "@/lib/db/tenantContext";
import { processAnalysisJob } from "@/lib/analysisJobs/processing";

const REQUEUED_MESSAGE =
  "The worker stopped before this job finished. It was returned to the queue for another attempt.";

const ABANDONED_MESSAGE =
  "The worker stopped before this job finished and no attempts remained.";

/**
 * A claimed job records its progress in the same row it is working on, so a
 * worker that dies leaves the row at Running with a frozen `updated_at`.
 * Nothing else can distinguish that from work still underway, which is why
 * staleness is measured rather than inferred.
 */
export async function recoverStaleAnalysisJobs(options: { staleAfterMinutes?: number } = {}) {
  const staleAfterMinutes = options.staleAfterMinutes ?? STALE_JOB_MINUTES;

  return withSystemAccess(async () => {
    const requeued = await query<{ id: string }>(
      `UPDATE analysis_jobs
       SET status='Queued',progress=0,started_at=NULL,error_message=$1,updated_at=now()
       WHERE status='Running' AND attempt_count < max_attempts
         AND updated_at < now() - make_interval(mins => $2)
       RETURNING id`,
      [REQUEUED_MESSAGE, staleAfterMinutes],
    );
    const abandoned = await query<{ id: string }>(
      `UPDATE analysis_jobs
       SET status='Failed',progress=100,error_message=$1,completed_at=now(),updated_at=now()
       WHERE status='Running' AND attempt_count >= max_attempts
         AND updated_at < now() - make_interval(mins => $2)
       RETURNING id`,
      [ABANDONED_MESSAGE, staleAfterMinutes],
    );

    return { requeued: requeued.rows.length, failed: abandoned.rows.length };
  });
}

/**
 * Enumerating the queue spans organizations, so it runs with system access and
 * returns nothing but job identity. Every job is then processed inside its own
 * organization's tenant scope, which is what keeps the finding it writes on the
 * right side of the boundary.
 *
 * Two overlapping drains need no lock of their own: claiming a job is a
 * conditional update off `status='Queued'`, so the second one finds nothing to
 * claim and moves on.
 */
export async function drainQueuedAnalysisJobs(options: { budgetMs?: number; limit?: number } = {}) {
  const budgetMs = options.budgetMs ?? JOB_BUDGET_MS;
  const limit = options.limit ?? DRAIN_JOB_LIMIT;
  const queued = await withSystemAccess(() => query<{ id: string; organization_id: string }>(
    `SELECT id,organization_id FROM analysis_jobs
     WHERE status='Queued' AND cancel_requested_at IS NULL
     ORDER BY created_at,id LIMIT $1`,
    [limit],
  ));
  const startedAt = Date.now();
  let processed = 0;

  for (const [index, job] of queued.rows.entries()) {
    if (index > 0 && Date.now() - startedAt >= budgetMs)
      return { processed, remaining: queued.rows.length - index };

    await processAnalysisJob(job.organization_id, job.id);
    processed += 1;
  }

  return { processed, remaining: 0 };
}
