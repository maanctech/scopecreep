import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { assertPermission } from "@/lib/auth/authorization";
import { currentAuthContext } from "@/lib/auth/current";
import { configuredProviderName } from "@/lib/ai/providers";
import { AI_PROMPT_VERSION } from "@/lib/aiPrompt";
import { analyzeClientRequestDetailed } from "@/lib/analysis";
import { query, transaction } from "@/lib/db/client";

type Row = Record<string, unknown>;

export type AnalysisMessageRow = {
  id: string;
  source: string;
  sender: string | null;
  sender_email: string | null;
  subject: string | null;
  message_text: string;
  character_count: number;
  message_date: Date | null;
  created_at: Date;
  finding_id: string | null;
  active_job_id: string | null;
  active_job_status: string | null;
};

export type AnalysisJobRow = {
  id: string;
  client_message_id: string | null;
  status: string;
  provider: string;
  model: string;
  progress: number;
  attempt_count: number;
  max_attempts: number;
  error_message: string | null;
  result: { findingId?: string; classification?: string } | null;
  cancel_requested_at: Date | null;
  created_at: Date;
};

declare global {
  var __scopeLedgerAnalysisControllers:
    Map<string, AbortController> | undefined;
}

const activeControllers =
  global.__scopeLedgerAnalysisControllers || new Map<string, AbortController>();
global.__scopeLedgerAnalysisControllers = activeControllers;

async function reviewer() {
  const auth = await currentAuthContext();
  if (!auth) throw new Error("A valid organization session is required.");
  assertPermission(auth.role, "findings:review");
  return auth;
}

function configuredModel(provider: string) {
  if (provider === "demo") return "deterministic";
  if (provider === "openai")
    return process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini";
  return process.env.OLLAMA_MODEL?.trim() || "Automatic model selection";
}

function jobMaxAttempts() {
  const value = Number(process.env.ANALYSIS_JOB_MAX_ATTEMPTS || 3);
  return Number.isFinite(value)
    ? Math.min(3, Math.max(1, Math.trunc(value)))
    : 2;
}

function boundaryText(items: Row[]) {
  return items
    .map(
      (item, index) =>
        `${index + 1}. [${String(item.boundary_type)} / ${String(item.category)}] ${String(item.description)}\n   SOW evidence: ${String(item.evidence || "No evidence recorded")}`,
    )
    .join("\n");
}

async function approvedContext(
  organizationId: string,
  projectId: string,
  client?: PoolClient,
) {
  const run = <T extends Row>(text: string, values: unknown[]) =>
    client ? client.query<T>(text, values) : query<T>(text, values);
  const project = await run<Row>(
    `SELECT p.id,p.client_name,p.project_name,p.hourly_rate_cents,p.is_demo,
            p.active_sow_version_id,p.active_boundary_map_id,v.content,v.content_sha256
     FROM projects p
     LEFT JOIN sow_versions v ON v.id=p.active_sow_version_id AND v.organization_id=p.organization_id
     LEFT JOIN scope_boundary_maps m ON m.id=p.active_boundary_map_id AND m.organization_id=p.organization_id
     WHERE p.id=$1 AND p.organization_id=$2 AND m.status='Active' AND m.approved_at IS NOT NULL
       AND m.sow_version_id=p.active_sow_version_id`,
    [projectId, organizationId],
  );
  if (!project.rows[0])
    throw new Error(
      "Approve a Scope Boundary Map for the active SOW before analyzing communications.",
    );
  const row = project.rows[0];
  const items = await run<Row>(
    "SELECT boundary_type,category,description,evidence FROM scope_boundary_items WHERE organization_id=$1 AND boundary_map_id=$2 ORDER BY ordinal,id",
    [organizationId, row.active_boundary_map_id],
  );
  if (!items.rows.length)
    throw new Error("The approved Scope Boundary Map has no boundary items.");
  return {
    projectId,
    clientName: String(row.client_name),
    projectName: String(row.project_name),
    hourlyRateCents: Number(row.hourly_rate_cents),
    isDemo: Boolean(row.is_demo),
    sowVersionId: String(row.active_sow_version_id),
    boundaryMapId: String(row.active_boundary_map_id),
    sowText: String(row.content),
    sowHash: String(row.content_sha256),
    boundaryMapText: boundaryText(items.rows),
    boundaryItemCount: items.rows.length,
  };
}

export async function approvedAnalysisContext(projectId: string) {
  const auth = await reviewer();
  return approvedContext(auth.organizationId, projectId);
}

export async function analysisWorkspace(projectId: string) {
  const auth = await reviewer();
  const project = await query<Row>(
    "SELECT id,client_name,project_name,active_sow_version_id,active_boundary_map_id FROM projects WHERE id=$1 AND organization_id=$2",
    [projectId, auth.organizationId],
  );
  if (!project.rows[0]) throw new Error("Project not found.");
  let context: Awaited<ReturnType<typeof approvedContext>> | null = null;
  let boundaryError: string | null = null;
  try {
    context = await approvedContext(auth.organizationId, projectId);
  } catch (error) {
    boundaryError =
      error instanceof Error ? error.message : "Boundary approval required.";
  }
  const [messages, jobs] = await Promise.all([
    query<AnalysisMessageRow>(
      `SELECT m.id,m.source,m.sender,m.sender_email,m.subject,left(m.message_text,2000) AS message_text,
              length(m.message_text)::int AS character_count,m.message_date,m.created_at,
              f.id AS finding_id,j.id AS active_job_id,j.status AS active_job_status
       FROM client_messages m
       LEFT JOIN scope_findings f ON f.organization_id=m.organization_id AND f.client_message_id=m.id
       LEFT JOIN LATERAL (
         SELECT id,status FROM analysis_jobs aj
         WHERE aj.organization_id=m.organization_id AND aj.client_message_id=m.id
         ORDER BY aj.created_at DESC LIMIT 1
       ) j ON true
       WHERE m.organization_id=$1 AND m.project_id=$2 AND m.deleted_at IS NULL
       ORDER BY COALESCE(m.message_date,m.created_at) DESC LIMIT 250`,
      [auth.organizationId, projectId],
    ),
    query<AnalysisJobRow>(
      `SELECT id,batch_id,client_message_id,status,provider,model,prompt_version,progress,attempt_count,max_attempts,
              error_message,result,cancel_requested_at,created_at,started_at,completed_at
       FROM analysis_jobs WHERE organization_id=$1 AND project_id=$2
       ORDER BY created_at DESC LIMIT 100`,
      [auth.organizationId, projectId],
    ),
  ]);
  return {
    project: project.rows[0],
    approvedContext: context
      ? {
          sowVersionId: context.sowVersionId,
          boundaryMapId: context.boundaryMapId,
          boundaryItemCount: context.boundaryItemCount,
        }
      : null,
    boundaryError,
    messages: messages.rows,
    jobs: jobs.rows,
  };
}

export async function queueAnalysisJobs(input: {
  projectId: string;
  messageIds: string[];
}) {
  const auth = await reviewer();
  const uniqueMessageIds = [...new Set(input.messageIds)];
  if (!uniqueMessageIds.length)
    throw new Error("Select at least one communication.");
  if (uniqueMessageIds.length > 100)
    throw new Error("Analyze at most 100 communications in one batch.");
  const provider = configuredProviderName();
  const model = configuredModel(provider);
  const batchId = randomUUID();
  return transaction(async (client) => {
    const context = await approvedContext(
      auth.organizationId,
      input.projectId,
      client,
    );
    const messages = await client.query<Row>(
      `SELECT m.id,m.message_text,m.content_sha256
       FROM client_messages m
       LEFT JOIN scope_findings f ON f.organization_id=m.organization_id AND f.client_message_id=m.id
       WHERE m.organization_id=$1 AND m.project_id=$2 AND m.id=ANY($3::uuid[])
         AND m.deleted_at IS NULL AND f.id IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM analysis_jobs existing
           WHERE existing.organization_id=m.organization_id AND existing.client_message_id=m.id
         )`,
      [auth.organizationId, input.projectId, uniqueMessageIds],
    );
    let queued = 0;
    const jobIds: string[] = [];
    for (const message of messages.rows) {
      const jobId = randomUUID();
      const inputHash = createHash("sha256")
        .update(
          [
            AI_PROMPT_VERSION,
            context.sowHash,
            context.boundaryMapId,
            message.content_sha256 ||
              createHash("sha256")
                .update(String(message.message_text))
                .digest("hex"),
          ].join("\n"),
        )
        .digest("hex");
      const inserted = await client.query(
        `INSERT INTO analysis_jobs
         (id,organization_id,project_id,client_message_id,sow_version_id,boundary_map_id,batch_id,requested_by,
          provider,model,prompt_version,status,input_sha256,input_references,attempt_count,progress,max_attempts)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'Queued',$12,$13::jsonb,0,0,$14)
         ON CONFLICT DO NOTHING RETURNING id`,
        [
          jobId,
          auth.organizationId,
          input.projectId,
          message.id,
          context.sowVersionId,
          context.boundaryMapId,
          batchId,
          auth.userId,
          provider,
          model,
          AI_PROMPT_VERSION,
          inputHash,
          JSON.stringify({
            messageId: message.id,
            sowVersionId: context.sowVersionId,
            boundaryMapId: context.boundaryMapId,
          }),
          jobMaxAttempts(),
        ],
      );
      if (inserted.rowCount) {
        queued += 1;
        jobIds.push(jobId);
      }
    }
    await client.query(
      "INSERT INTO audit_logs (id,organization_id,actor_user_id,action,resource_type,resource_id,metadata) VALUES ($1,$2,$3,'analysis.batch.queued','analysis_batch',$4,$5::jsonb)",
      [
        randomUUID(),
        auth.organizationId,
        auth.userId,
        batchId,
        JSON.stringify({
          projectId: input.projectId,
          selected: uniqueMessageIds.length,
          eligible: messages.rows.length,
          queued,
          sowVersionId: context.sowVersionId,
          boundaryMapId: context.boundaryMapId,
        }),
      ],
    );
    return {
      organizationId: auth.organizationId,
      batchId,
      jobIds,
      selected: uniqueMessageIds.length,
      queued,
      skipped: uniqueMessageIds.length - queued,
    };
  });
}

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
  const workflowStatus =
    finding.classification === "In Scope" ? "New" : "Needs Review";
  await client.query(
    `INSERT INTO scope_findings
     (id,organization_id,project_id,client_message_id,analysis_job_id,classification,confidence_score,reasoning,
      relevant_sow_sections,request_type,estimated_hours,estimated_revenue_cents,suggested_change_order,
      billing_decision,workflow_status,client_facing_explanation,internal_note,version,is_demo,created_at,updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,'Undecided',$14,$15,$16,1,$17,$18,$18)`,
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
      workflowStatus,
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
    billing_decision: "Undecided",
    workflow_status: workflowStatus,
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
     VALUES ($1,$2,$3,$4,'Finding Created',NULL,$5,NULL,'Undecided','AI analysis saved. Human review required before billing.','AI Analysis',$6,$7)`,
    [
      randomUUID(),
      input.organizationId,
      input.job.project_id,
      findingId,
      workflowStatus,
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
  const jobs = await query<{ id: string }>(
    "SELECT id FROM analysis_jobs WHERE organization_id=$1 AND batch_id=$2 AND status='Queued' ORDER BY created_at,id",
    [organizationId, batchId],
  );
  const results = [];
  for (const job of jobs.rows)
    results.push(await processAnalysisJob(organizationId, job.id));
  return results;
}

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
