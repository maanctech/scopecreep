import { createHash, randomUUID } from "node:crypto";
import { configuredProviderName } from "@/lib/ai/providers";
import { AI_PROMPT_VERSION } from "@/lib/aiPrompt";
import { query, transaction } from "@/lib/db/client";
import {
  activeControllers,
  analysisStaleMinutes,
  approvedContext,
  configuredModel,
  jobMaxAttempts,
  reviewer,
} from "@/lib/analysisJobs/context";
import type { Row } from "@/lib/analysisJobs/types";

export async function cancelAnalysisJob(jobId: string) {
  const auth = await reviewer();
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
}

export async function retryAnalysisJob(jobId: string) {
  const auth = await reviewer();
  const provider = configuredProviderName();
  const result = await query<Row>(
    `UPDATE analysis_jobs j SET status='Queued',progress=0,error_message=NULL,cancel_requested_at=NULL,
       started_at=NULL,completed_at=NULL,updated_at=now(),batch_id=$1,provider=$2,model=$3
     WHERE j.id=$4 AND j.organization_id=$5 AND j.status IN ('Failed','Cancelled')
       AND j.attempt_count < j.max_attempts
       AND NOT EXISTS (SELECT 1 FROM scope_findings f WHERE f.organization_id=j.organization_id AND f.client_message_id=j.client_message_id)
     RETURNING id,batch_id`,
    [randomUUID(), provider, configuredModel(provider), jobId, auth.organizationId],
  );

  if (!result.rows[0]) throw new Error("This analysis job cannot be retried.");

  return {
    organizationId: auth.organizationId,
    jobId: String(result.rows[0].id),
    batchId: String(result.rows[0].batch_id),
  };
}

export async function startOverAnalysisJob(jobId: string) {
  const auth = await reviewer();
  const provider = configuredProviderName();

  return transaction(async (client) => {
    const selected = await client.query<Row>(
      `SELECT j.*,m.message_text,m.content_sha256
       FROM analysis_jobs j
       JOIN client_messages m ON m.id=j.client_message_id AND m.organization_id=j.organization_id
       WHERE j.id=$1 AND j.organization_id=$2 AND m.deleted_at IS NULL
       FOR UPDATE OF j`,
      [jobId, auth.organizationId],
    );
    const job = selected.rows[0];

    if (
      !job ||
      !["Failed", "Cancelled"].includes(String(job.status)) ||
      Number(job.attempt_count) < Number(job.max_attempts) ||
      Number(
        (job.input_references as { startOverCount?: number } | null)
          ?.startOverCount || 0,
      ) >= 1
    )
      throw new Error("This analysis job cannot be started over.");

    const finding = await client.query(
      "SELECT 1 FROM scope_findings WHERE organization_id=$1 AND client_message_id=$2",
      [auth.organizationId, job.client_message_id],
    );

    if (finding.rows[0])
      throw new Error("A finding already exists for this communication.");

    await client.query(
      "SELECT id FROM projects WHERE id=$1 AND organization_id=$2 FOR UPDATE",
      [job.project_id, auth.organizationId],
    );

    const context = await approvedContext(
      auth.organizationId,
      String(job.project_id),
      client,
    );
    const batchId = randomUUID();
    const inputHash = createHash("sha256")
      .update(
        [
          AI_PROMPT_VERSION,
          context.sowHash,
          context.boundaryMapId,
          job.content_sha256 ||
            createHash("sha256")
              .update(String(job.message_text))
              .digest("hex"),
        ].join("\n"),
      )
      .digest("hex");
    const references = {
      messageId: job.client_message_id,
      sowVersionId: context.sowVersionId,
      boundaryMapId: context.boundaryMapId,
      startOverCount: 1,
    };
    const updated = await client.query<Row>(
      `UPDATE analysis_jobs SET status='Queued',progress=0,error_message=NULL,raw_output=NULL,result=NULL,
         cancel_requested_at=NULL,attempt_count=0,max_attempts=$1,started_at=NULL,completed_at=NULL,
         latency_ms=NULL,input_character_count=NULL,output_character_count=NULL,updated_at=now(),batch_id=$2,
         requested_by=$3,provider=$4,model=$5,prompt_version=$6,input_sha256=$7,input_references=$8::jsonb,
         sow_version_id=$9,boundary_map_id=$10
       WHERE id=$11 AND organization_id=$12
       RETURNING id,batch_id`,
      [
        jobMaxAttempts(),
        batchId,
        auth.userId,
        provider,
        configuredModel(provider),
        AI_PROMPT_VERSION,
        inputHash,
        JSON.stringify(references),
        context.sowVersionId,
        context.boundaryMapId,
        jobId,
        auth.organizationId,
      ],
    );

    await client.query(
      "INSERT INTO audit_logs (id,organization_id,actor_user_id,action,resource_type,resource_id,metadata) VALUES ($1,$2,$3,'analysis.job.started_over','analysis_job',$4,$5::jsonb)",
      [
        randomUUID(),
        auth.organizationId,
        auth.userId,
        jobId,
        JSON.stringify({
          previousSowVersionId: job.sow_version_id,
          previousBoundaryMapId: job.boundary_map_id,
          sowVersionId: context.sowVersionId,
          boundaryMapId: context.boundaryMapId,
          batchId,
        }),
      ],
    );

    return {
      organizationId: auth.organizationId,
      jobId: String(updated.rows[0].id),
      batchId: String(updated.rows[0].batch_id),
    };
  });
}

export async function recoverAnalysisJob(jobId: string) {
  const auth = await reviewer();
  const message =
    "Analysis worker stopped before completion. Retry this job using its pinned evidence.";

  await transaction(async (client) => {
    const recovered = await client.query<Row>(
      `UPDATE analysis_jobs j SET status='Failed',progress=100,error_message=$1,completed_at=now(),updated_at=now()
       WHERE j.id=$2 AND j.organization_id=$3 AND j.status='Running'
         AND j.started_at < now() - make_interval(mins => $4::int)
         AND NOT EXISTS (
           SELECT 1 FROM scope_findings f
           WHERE f.organization_id=j.organization_id AND f.client_message_id=j.client_message_id
         )
       RETURNING id,status`,
      [message, jobId, auth.organizationId, analysisStaleMinutes()],
    );

    if (!recovered.rows[0])
      throw new Error("Only a stale running analysis job can be recovered.");

    await client.query(
      "INSERT INTO audit_logs (id,organization_id,actor_user_id,action,resource_type,resource_id,metadata) VALUES ($1,$2,$3,'analysis.job.recovered','analysis_job',$4,$5::jsonb)",
      [
        randomUUID(),
        auth.organizationId,
        auth.userId,
        jobId,
        JSON.stringify({ staleThresholdMinutes: analysisStaleMinutes() }),
      ],
    );
  });

  activeControllers.get(jobId)?.abort();

  return { status: "Failed" };
}
