import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { transaction } from "@/lib/db/client";
import { cents, requireContext, type Context, type DbRow } from "@/lib/store/postgres/client";
import { mapFinding } from "@/lib/store/postgres/mappers";
import { applyFindingAction, TransitionError, type FindingActionName } from "@/lib/domain/findingTransitions";
import { assertIntegerCents } from "@/lib/domain/money";
import { NotFoundError, VersionConflictError } from "@/lib/storeErrors";
import type { AnalysisInput, BillingEvent, ClientMessage, MessageSource, ScopeFinding } from "@/lib/types";
import type { AnalysisMetadata } from "@/lib/ai/types";

async function insertFindingHistory(client: PoolClient, organizationId: string, finding: ScopeFinding, userId: string | null, reason: string) {
  await client.query(
    `INSERT INTO scope_finding_history
     (id, organization_id, scope_finding_id, version, snapshot, changed_by, change_reason)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7)`,
    [randomUUID(), organizationId, finding.id, finding.version, JSON.stringify(finding), userId, reason]
  );
}

async function insertBillingEvent(client: PoolClient, organizationId: string, event: BillingEvent, userId: string | null) {
  await client.query(
    `INSERT INTO billing_events
     (id, organization_id, project_id, scope_finding_id, event_type, amount_cents, previous_amount_cents,
      new_amount_cents, previous_status, new_status, previous_decision, new_decision, note,
      actor_user_id, actor_label, is_demo, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
    [event.id, organizationId, event.project_id, event.scope_finding_id, event.event_type, event.amount_cents,
     event.previous_amount_cents, event.new_amount_cents, event.previous_status, event.new_status,
     event.previous_decision, event.new_decision, event.note, userId, event.actor, event.is_demo, event.created_at]
  );
}

export async function saveMessageWithFinding(input: {
  project_id: string; source: MessageSource; sender?: string | null; message_text: string;
  message_date?: string | null; analysis: AnalysisInput; analysis_metadata?: AnalysisMetadata;
  sow_version_id?: string; boundary_map_id?: string;
}) {
  const context = await requireContext();

  return transaction(async (client) => {
    const projectResult = await client.query<DbRow>(
      "SELECT * FROM projects WHERE id = $1 AND organization_id = $2", [input.project_id, context.organizationId]
    );

    if (!projectResult.rows[0]) throw new NotFoundError("Project not found.");

    const timestamp = new Date().toISOString();
    const message: ClientMessage = {
      id: randomUUID(), project_id: input.project_id, source: input.source, sender: input.sender?.trim() || null,
      message_text: input.message_text.trim(), message_date: input.message_date || null, created_at: timestamp
    };

    await client.query(
      `INSERT INTO client_messages
       (id, organization_id, project_id, source, sender, message_text, message_date, content_sha256, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [message.id, context.organizationId, message.project_id, message.source, message.sender, message.message_text,
       message.message_date, createHash("sha256").update(message.message_text).digest("hex"), timestamp]
    );
    const analysisJobId = input.analysis_metadata ? randomUUID() : null;

    if (input.analysis_metadata && analysisJobId) {
      await client.query(
        `INSERT INTO analysis_jobs
         (id, organization_id, project_id, client_message_id, provider, model, prompt_version,
          status, input_sha256, error_message, attempt_count, latency_ms, input_character_count,
          sow_version_id, boundary_map_id,
          output_character_count, started_at, completed_at, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$17,$17,$17)`,
        [analysisJobId, context.organizationId, input.project_id, message.id, input.analysis_metadata.provider,
         input.analysis_metadata.model, input.analysis_metadata.promptVersion, input.analysis_metadata.status,
         input.analysis_metadata.inputHash,
         input.analysis_metadata.errorMessage, input.analysis_metadata.attempts, input.analysis_metadata.latencyMs,
         input.analysis_metadata.inputCharacters, input.sow_version_id || null, input.boundary_map_id || null,
         input.analysis_metadata.outputCharacters, timestamp]
      );
    }

    const finding: ScopeFinding = {
      id: randomUUID(), project_id: input.project_id, client_message_id: message.id, ...input.analysis,
      billing_decision: "Undecided", workflow_status: input.analysis.classification === "In Scope" ? "New" : "Needs Review",
      approved_hours: null, approved_amount_cents: null, client_facing_explanation: input.analysis.suggested_change_order,
      reviewed_by: null, reviewed_at: null, created_at: timestamp, updated_at: timestamp, version: 1,
      is_demo: Boolean(projectResult.rows[0].is_demo)
    };

    await client.query(
      `INSERT INTO scope_findings
       (id, organization_id, project_id, client_message_id, analysis_job_id, classification, confidence_score, reasoning,
        relevant_sow_sections, request_type, estimated_hours, estimated_revenue_cents, suggested_change_order,
        billing_decision, workflow_status, approved_hours, approved_amount_cents, client_facing_explanation,
        internal_note, version, is_demo, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)`,
      [finding.id, context.organizationId, finding.project_id, finding.client_message_id, analysisJobId, finding.classification,
       finding.confidence_score, finding.reasoning, JSON.stringify(finding.relevant_sow_sections), finding.request_type,
       finding.estimated_hours, cents(finding.estimated_revenue), finding.suggested_change_order, finding.billing_decision,
       finding.workflow_status, finding.approved_hours, finding.approved_amount_cents, finding.client_facing_explanation,
       finding.internal_note, finding.version, finding.is_demo, timestamp, timestamp]
    );
    await insertFindingHistory(client, context.organizationId, finding, context.userId, "AI analysis saved");
    await insertBillingEvent(client, context.organizationId, {
      id: randomUUID(), project_id: finding.project_id, scope_finding_id: finding.id, event_type: "Finding Created",
      amount_cents: null, previous_amount_cents: null, new_amount_cents: null, previous_status: null,
      new_status: finding.workflow_status, previous_decision: null, new_decision: finding.billing_decision,
      note: "AI analysis saved. Human review required before billing.", actor: "AI Analysis",
      created_at: timestamp, is_demo: finding.is_demo
    }, null);

    return { message, finding };
  });
}

async function lockedFinding(client: PoolClient, context: Context, findingId: string) {
  const result = await client.query<DbRow>(
    "SELECT * FROM scope_findings WHERE id = $1 AND organization_id = $2 FOR UPDATE", [findingId, context.organizationId]
  );

  if (!result.rows[0]) throw new NotFoundError("Finding not found.");

  return mapFinding(result.rows[0]);
}

async function persistFinding(client: PoolClient, context: Context, finding: ScopeFinding) {
  await client.query(
    `UPDATE scope_findings SET billing_decision=$1, workflow_status=$2, approved_hours=$3,
     approved_amount_cents=$4, client_facing_explanation=$5, internal_note=$6, reviewed_by_user_id=$7,
     reviewed_by_label=$8, reviewed_at=$9, version=$10, updated_at=$11
     WHERE id=$12 AND organization_id=$13`,
    [finding.billing_decision, finding.workflow_status, finding.approved_hours, finding.approved_amount_cents,
     finding.client_facing_explanation, finding.internal_note, context.userId, finding.reviewed_by,
     finding.reviewed_at, finding.version, finding.updated_at, finding.id, context.organizationId]
  );
}

export async function updateFindingDetails(input: {
  finding_id: string; expected_version: number; approved_hours?: number | null;
  approved_amount_cents?: number | null; client_facing_explanation?: string; internal_note?: string | null;
}) {
  const context = await requireContext();

  return transaction(async (client) => {
    const finding = await lockedFinding(client, context, input.finding_id);

    if (finding.version !== input.expected_version) throw new VersionConflictError();

    const wantsAmountChange = input.approved_hours !== undefined || input.approved_amount_cents !== undefined;

    if (wantsAmountChange && finding.workflow_status !== "Decided") {
      throw new TransitionError(
        finding.workflow_status === "Invoiced" || finding.workflow_status === "Paid"
          ? "Reopen this finding before changing amounts that were already invoiced."
          : "Make a billing decision (for example Mark as Billable) before setting approved amounts.",
        "invalid_action"
      );
    }

    const timestamp = new Date().toISOString();
    const previousAmount = finding.approved_amount_cents;
    const updated: ScopeFinding = {
      ...finding,
      approved_hours: input.approved_hours !== undefined ? input.approved_hours : finding.approved_hours,
      approved_amount_cents: input.approved_amount_cents !== undefined
        ? input.approved_amount_cents === null ? null : assertIntegerCents(input.approved_amount_cents, "approved_amount_cents")
        : finding.approved_amount_cents,
      client_facing_explanation: input.client_facing_explanation ?? finding.client_facing_explanation,
      internal_note: input.internal_note !== undefined ? input.internal_note : finding.internal_note,
      reviewed_by: context.actor, reviewed_at: timestamp, updated_at: timestamp, version: finding.version + 1
    };

    await persistFinding(client, context, updated);
    await insertFindingHistory(client, context.organizationId, updated, context.userId, "Finding details updated");

    if (wantsAmountChange && previousAmount !== updated.approved_amount_cents) {
      await insertBillingEvent(client, context.organizationId, {
        id: randomUUID(), project_id: finding.project_id, scope_finding_id: finding.id, event_type: "Estimate Updated",
        amount_cents: updated.approved_amount_cents, previous_amount_cents: previousAmount,
        new_amount_cents: updated.approved_amount_cents, previous_status: finding.workflow_status,
        new_status: updated.workflow_status, previous_decision: finding.billing_decision,
        new_decision: updated.billing_decision, note: "Approved amount edited by the professional.",
        actor: context.actor, created_at: timestamp, is_demo: finding.is_demo
      }, context.userId);
    }

    return updated;
  });
}

export async function performFindingAction(input: {
  finding_id: string; expected_version: number; action: FindingActionName; note?: string | null;
}) {
  const context = await requireContext();

  return transaction(async (client) => {
    const finding = await lockedFinding(client, context, input.finding_id);

    if (finding.version !== input.expected_version) throw new VersionConflictError();

    const timestamp = new Date().toISOString();
    const applied = applyFindingAction(finding, input.action, { now: timestamp, actor: context.actor });

    await persistFinding(client, context, applied.finding);
    await insertFindingHistory(client, context.organizationId, applied.finding, context.userId, input.action);
    await insertBillingEvent(client, context.organizationId, {
      id: randomUUID(), project_id: finding.project_id, scope_finding_id: finding.id, ...applied.event,
      note: input.note?.trim() || null, actor: context.actor, created_at: timestamp, is_demo: finding.is_demo
    }, context.userId);

    return applied.finding;
  });
}
