import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { analyzeClientRequestDetailed } from "@/lib/analysis";
import { query, transaction } from "@/lib/db/client";
import { withTenant } from "@/lib/db/tenantContext";
import { activeControllers, boundaryText } from "@/lib/analysisJobs/context";
import { initialFindingState } from "@/lib/domain/findingTransitions";
import type { Row } from "@/lib/analysisJobs/types";

async function claimJob(organizationId: string, jobId: string) {
  return transaction(async (client) => {
    const claimed = await client.query<Row>(
      `UPDATE analysis_jobs SET status='Running',progress=5,attempt_count=attempt_count+1,started_at=COALESCE(started_at,now()),updated_at=now()
       WHERE id=$1 AND organization_id=$2 AND status='Queued' AND cancel_requested_at IS NULL
       RETURNING *`,
      [jobId, organizationId],
    );

    return claimed.rows[0] || null;
  });
}

async function failJob(organizationId: string, jobId: string, message: string) {
  await query(
    "UPDATE analysis_jobs SET status='Failed',progress=100,error_message=$1,completed_at=now(),updated_at=now() WHERE id=$2 AND organization_id=$3 AND status='Running'",
    [message, jobId, organizationId],
  );
}

async function persistFinding(
  client: PoolClient,
  input: {
    organizationId: string;
    job: Row;
    message: Row;
    project: Row;
    analysis: Awaited<ReturnType<typeof analyzeClientRequestDetailed>>;
  },
) {
  const findingId = randomUUID();
  const timestamp = new Date().toISOString();
  const finding = input.analysis.analysis;
  const estimatedRevenueCents = Math.max(
    0,
    Math.round(
      finding.estimated_hours * Number(input.project.hourly_rate_cents),
    ),
  );
  const initialState = initialFindingState(finding.classification);

  await client.query(
    `INSERT INTO scope_findings
     (id,organization_id,project_id,client_message_id,analysis_job_id,classification,confidence_score,reasoning,
      relevant_sow_sections,request_type,estimated_hours,estimated_revenue_cents,suggested_change_order,
      billing_decision,workflow_status,client_facing_explanation,internal_note,version,is_demo,created_at,updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14,$15,$16,$17,1,$18,$19,$19)`,
    [
      findingId,
      input.organizationId,
      input.job.project_id,
      input.job.client_message_id,
      input.job.id,
      finding.classification,
      finding.confidence_score,
      finding.reasoning,
      JSON.stringify(finding.relevant_sow_sections),
      finding.request_type,
      finding.estimated_hours,
      estimatedRevenueCents,
      finding.suggested_change_order,
      initialState.billing_decision,
      initialState.workflow_status,
      finding.suggested_change_order,
      finding.internal_note,
      Boolean(input.project.is_demo),
      timestamp,
    ],
  );
  const snapshot = {
    id: findingId,
    project_id: String(input.job.project_id),
    client_message_id: String(input.job.client_message_id),
    ...finding,
    estimated_revenue: estimatedRevenueCents / 100,
    ...initialState,
    approved_hours: null,
    approved_amount_cents: null,
    client_facing_explanation: finding.suggested_change_order,
    reviewed_by: null,
    reviewed_at: null,
    created_at: timestamp,
    updated_at: timestamp,
    version: 1,
    is_demo: Boolean(input.project.is_demo),
  };

  await client.query(
    "INSERT INTO scope_finding_history (id,organization_id,scope_finding_id,version,snapshot,changed_by,change_reason) VALUES ($1,$2,$3,1,$4::jsonb,NULL,'AI analysis saved')",
    [randomUUID(), input.organizationId, findingId, JSON.stringify(snapshot)],
  );
  await client.query(
    `INSERT INTO billing_events
     (id,organization_id,project_id,scope_finding_id,event_type,previous_status,new_status,previous_decision,new_decision,note,actor_label,is_demo,created_at)
     VALUES ($1,$2,$3,$4,'Finding Created',NULL,$5,NULL,$6,'AI analysis saved. Human review required before billing.','AI Analysis',$7,$8)`,
    [
      randomUUID(),
      input.organizationId,
      input.job.project_id,
      findingId,
      initialState.workflow_status,
      initialState.billing_decision,
      Boolean(input.project.is_demo),
      timestamp,
    ],
  );
  await client.query(
    `UPDATE analysis_jobs SET status='Succeeded',progress=100,provider=$1,model=$2,prompt_version=$3,input_sha256=$4,
       latency_ms=$5,input_character_count=$6,output_character_count=$7,error_message=NULL,
       result=$8::jsonb,completed_at=now(),updated_at=now()
     WHERE id=$9 AND organization_id=$10 AND status='Running'`,
    [
      input.analysis.metadata.provider,
      input.analysis.metadata.model,
      input.analysis.metadata.promptVersion,
      input.analysis.metadata.inputHash,
      input.analysis.metadata.latencyMs,
      input.analysis.metadata.inputCharacters,
      input.analysis.metadata.outputCharacters,
      JSON.stringify({
        findingId,
        classification: finding.classification,
        estimatedRevenueCents,
      }),
      input.job.id,
      input.organizationId,
    ],
  );
  await client.query(
    "INSERT INTO audit_logs (id,organization_id,action,resource_type,resource_id,metadata) VALUES ($1,$2,'analysis.finding.created','scope_finding',$3,$4::jsonb)",
    [
      randomUUID(),
      input.organizationId,
      findingId,
      JSON.stringify({
        jobId: input.job.id,
        messageId: input.job.client_message_id,
        sowVersionId: input.job.sow_version_id,
        boundaryMapId: input.job.boundary_map_id,
        provider: input.analysis.metadata.provider,
        model: input.analysis.metadata.model,
      }),
    ],
  );

  return findingId;
}

export async function processAnalysisJob(
  organizationId: string,
  jobId: string,
) {
  return withTenant(organizationId, () => processClaimedAnalysisJob(organizationId, jobId));
}

/**
 * Background processing has no session to inherit a tenant from, so the job's
 * own organization becomes the context for every statement it runs.
 */
async function processClaimedAnalysisJob(
  organizationId: string,
  jobId: string,
) {
  const job = await claimJob(organizationId, jobId);

  if (!job) return { processed: false };

  const controller = new AbortController();

  activeControllers.set(jobId, controller);

  try {
    const input = await query<Row>(
      `SELECT m.message_text,m.content_sha256,p.hourly_rate_cents,p.is_demo,v.content,
              EXISTS(SELECT 1 FROM scope_findings f WHERE f.organization_id=j.organization_id AND f.client_message_id=j.client_message_id) AS already_analyzed
       FROM analysis_jobs j
       JOIN client_messages m ON m.id=j.client_message_id AND m.organization_id=j.organization_id
       JOIN projects p ON p.id=j.project_id AND p.organization_id=j.organization_id
       JOIN sow_versions v ON v.id=j.sow_version_id AND v.organization_id=j.organization_id
       WHERE j.id=$1 AND j.organization_id=$2`,
      [jobId, organizationId],
    );
    const row = input.rows[0];

    if (!row)
      throw new Error("Pinned analysis inputs are no longer available.");

    if (row.already_analyzed) {
      await failJob(
        organizationId,
        jobId,
        "A finding already exists for this communication.",
      );

      return { processed: false };
    }

    const items = await query<Row>(
      "SELECT boundary_type,category,description,evidence FROM scope_boundary_items WHERE organization_id=$1 AND boundary_map_id=$2 ORDER BY ordinal,id",
      [organizationId, job.boundary_map_id],
    );
    const analyzed = await analyzeClientRequestDetailed({
      sowText: String(row.content),
      boundaryMapText: boundaryText(items.rows),
      messageText: String(row.message_text),
      hourlyRate: Number(row.hourly_rate_cents) / 100,
      signal: controller.signal,
    });

    if (controller.signal.aborted) {
      await query(
        "UPDATE analysis_jobs SET status='Cancelled',progress=100,completed_at=now(),updated_at=now() WHERE id=$1 AND organization_id=$2 AND status='Running'",
        [jobId, organizationId],
      );

      return { processed: false, cancelled: true };
    }

    if (analyzed.metadata.status === "Failed") {
      await failJob(
        organizationId,
        jobId,
        "AI analysis did not return a valid evidence-based result. Check AI diagnostics and retry.",
      );

      return { processed: false };
    }

    return transaction(async (client) => {
      const current = await client.query<Row>(
        "SELECT status,cancel_requested_at FROM analysis_jobs WHERE id=$1 AND organization_id=$2 FOR UPDATE",
        [jobId, organizationId],
      );

      if (
        current.rows[0]?.status !== "Running" ||
        current.rows[0]?.cancel_requested_at ||
        controller.signal.aborted
      ) {
        await client.query(
          "UPDATE analysis_jobs SET status='Cancelled',progress=100,completed_at=now(),updated_at=now() WHERE id=$1 AND organization_id=$2 AND status='Running'",
          [jobId, organizationId],
        );

        return { processed: false, cancelled: true };
      }

      const findingId = await persistFinding(client, {
        organizationId,
        job,
        message: row,
        project: row,
        analysis: analyzed,
      });

      return { processed: true, findingId };
    });
  } catch (error) {
    const cancelled = controller.signal.aborted;

    if (cancelled)
      await query(
        "UPDATE analysis_jobs SET status='Cancelled',progress=100,completed_at=now(),updated_at=now() WHERE id=$1 AND organization_id=$2 AND status='Running'",
        [jobId, organizationId],
      );
    else
      await failJob(
        organizationId,
        jobId,
        error instanceof Error && /Pinned analysis inputs/.test(error.message)
          ? error.message
          : "Analysis failed. Check AI diagnostics and retry.",
      );

    return { processed: false, cancelled };
  } finally {
    activeControllers.delete(jobId);
  }
}

export async function processAnalysisBatch(
  organizationId: string,
  batchId: string,
) {
  const jobs = await withTenant(organizationId, () => query<{ id: string }>(
    "SELECT id FROM analysis_jobs WHERE organization_id=$1 AND batch_id=$2 AND status='Queued' ORDER BY created_at,id",
    [organizationId, batchId],
  ));
  const results = [];

  for (const job of jobs.rows)
    results.push(await processAnalysisJob(organizationId, job.id));

  return results;
}
