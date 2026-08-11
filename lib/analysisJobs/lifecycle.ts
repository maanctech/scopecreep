import { randomUUID } from "node:crypto";
import { configuredProviderName } from "@/lib/ai/providers";
import { query, transaction } from "@/lib/db/client";
import { displayModelFor } from "@/lib/ai/catalog";
import { activeControllers, asReviewer } from "@/lib/analysisJobs/context";
import type { Row } from "@/lib/analysisJobs/types";

export async function cancelAnalysisJob(jobId: string) {
  return asReviewer(async (auth) => {
    const result = await transaction(async (client) => {
      const job = await client.query<Row>(
        "SELECT id,status FROM analysis_jobs WHERE id=$1 AND organization_id=$2 FOR UPDATE",
        [jobId, auth.organizationId],
      );

      if (!job.rows[0]) throw new Error("Analysis job not found.");

      if (job.rows[0].status === "Queued") {
        await client.query(
          "UPDATE analysis_jobs SET status='Cancelled',progress=100,cancel_requested_at=now(),completed_at=now(),updated_at=now() WHERE id=$1 AND organization_id=$2",
          [jobId, auth.organizationId],
        );

        return "Cancelled";
      }

      if (job.rows[0].status === "Running") {
        await client.query(
          "UPDATE analysis_jobs SET status='Cancelled',progress=100,cancel_requested_at=now(),completed_at=now(),updated_at=now() WHERE id=$1 AND organization_id=$2",
          [jobId, auth.organizationId],
        );

        return "Cancelled";
      }

      throw new Error("Only queued or running analysis jobs can be cancelled.");
    });

    activeControllers.get(jobId)?.abort();

    return { status: result };
  });
}

export async function retryAnalysisJob(jobId: string) {
  return asReviewer(async (auth) => {
    const provider = configuredProviderName();
    const result = await query<Row>(
      `UPDATE analysis_jobs j SET status='Queued',progress=0,error_message=NULL,cancel_requested_at=NULL,
         started_at=NULL,completed_at=NULL,updated_at=now(),batch_id=$1,provider=$2,model=$3
       WHERE j.id=$4 AND j.organization_id=$5 AND j.status IN ('Failed','Cancelled')
         AND j.attempt_count < j.max_attempts
         AND NOT EXISTS (SELECT 1 FROM scope_findings f WHERE f.organization_id=j.organization_id AND f.client_message_id=j.client_message_id)
       RETURNING id,batch_id`,
      [randomUUID(), provider, displayModelFor(provider), jobId, auth.organizationId],
    );

    if (!result.rows[0]) throw new Error("This analysis job cannot be retried.");

    return {
      organizationId: auth.organizationId,
      jobId: String(result.rows[0].id),
      batchId: String(result.rows[0].batch_id),
    };
  });
}
