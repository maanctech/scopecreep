import { randomUUID } from "node:crypto";
import { mutateLocalStore, now } from "@/lib/store/json/persistence";
import { applyFindingAction, TransitionError, type FindingActionName } from "@/lib/domain/findingTransitions";
import { assertIntegerCents } from "@/lib/domain/money";
import { NotFoundError, VersionConflictError } from "@/lib/storeErrors";
import type { AnalysisInput, BillingEvent, ClientMessage, MessageSource, ScopeFinding } from "@/lib/types";
import type { AnalysisMetadata } from "@/lib/ai/types";

const PROFESSIONAL_ACTOR = "Professional";

export async function saveMessageWithFinding(input: {
  project_id: string;
  source: MessageSource;
  sender?: string | null;
  message_text: string;
  message_date?: string | null;
  analysis: AnalysisInput;
  analysis_metadata?: AnalysisMetadata;
  sow_version_id?: string;
  boundary_map_id?: string;
}) {
  return mutateLocalStore((store) => {
    const project = store.projects.find((item) => item.id === input.project_id);

    if (!project) throw new NotFoundError("Project not found.");

    const timestamp = now();
    const message: ClientMessage = {
      id: randomUUID(),
      project_id: project.id,
      source: input.source,
      sender: input.sender?.trim() || null,
      message_text: input.message_text.trim(),
      message_date: input.message_date || null,
      created_at: timestamp
    };

    const finding: ScopeFinding = {
      id: randomUUID(),
      project_id: project.id,
      client_message_id: message.id,
      ...input.analysis,
      billing_decision: "Undecided",
      workflow_status: input.analysis.classification === "In Scope" ? "New" : "Needs Review",
      approved_hours: null,
      approved_amount_cents: null,
      client_facing_explanation: input.analysis.suggested_change_order,
      reviewed_by: null,
      reviewed_at: null,
      created_at: timestamp,
      updated_at: timestamp,
      version: 1,
      is_demo: project.is_demo
    };

    const event: BillingEvent = {
      id: randomUUID(),
      project_id: project.id,
      scope_finding_id: finding.id,
      event_type: "Finding Created",
      amount_cents: null,
      previous_amount_cents: null,
      new_amount_cents: null,
      previous_status: null,
      new_status: finding.workflow_status,
      previous_decision: null,
      new_decision: finding.billing_decision,
      note: "AI analysis saved. Human review required before billing.",
      actor: "AI Analysis",
      created_at: timestamp,
      is_demo: project.is_demo
    };

    store.clientMessages.unshift(message);
    store.scopeFindings.unshift(finding);
    store.billingEvents.push(event);

    return { message, finding };
  });
}

/**
 * Edits the professional-owned fields of a finding.
 * Approved hours/amount may only change while the finding is in the Decided
 * state; invoiced and paid amounts stay stable unless the finding is
 * intentionally reopened. Every amount change appends an Estimate Updated
 * event. Stale versions are rejected.
 */
export async function updateFindingDetails(input: {
  finding_id: string;
  expected_version: number;
  approved_hours?: number | null;
  approved_amount_cents?: number | null;
  client_facing_explanation?: string;
  internal_note?: string | null;
}) {
  return mutateLocalStore((store) => {
    const index = store.scopeFindings.findIndex((item) => item.id === input.finding_id);

    if (index === -1) throw new NotFoundError("Finding not found.");

    const finding = store.scopeFindings[index];

    if (finding.version !== input.expected_version) {
      throw new VersionConflictError();
    }

    const wantsAmountChange =
      input.approved_hours !== undefined || input.approved_amount_cents !== undefined;

    if (wantsAmountChange && finding.workflow_status !== "Decided") {
      throw new TransitionError(
        finding.workflow_status === "Invoiced" || finding.workflow_status === "Paid"
          ? "Reopen this finding before changing amounts that were already invoiced."
          : "Make a billing decision (for example Mark as Billable) before setting approved amounts.",
        "invalid_action"
      );
    }

    const timestamp = now();
    const previousAmount = finding.approved_amount_cents;
    const updated: ScopeFinding = {
      ...finding,
      approved_hours:
        input.approved_hours !== undefined ? input.approved_hours : finding.approved_hours,
      approved_amount_cents:
        input.approved_amount_cents !== undefined
          ? input.approved_amount_cents === null
            ? null
            : assertIntegerCents(input.approved_amount_cents, "approved_amount_cents")
          : finding.approved_amount_cents,
      client_facing_explanation:
        input.client_facing_explanation !== undefined
          ? input.client_facing_explanation
          : finding.client_facing_explanation,
      internal_note:
        input.internal_note !== undefined ? input.internal_note : finding.internal_note,
      reviewed_by: PROFESSIONAL_ACTOR,
      reviewed_at: timestamp,
      updated_at: timestamp,
      version: finding.version + 1
    };

    store.scopeFindings[index] = updated;

    if (wantsAmountChange && previousAmount !== updated.approved_amount_cents) {
      store.billingEvents.push({
        id: randomUUID(),
        project_id: finding.project_id,
        scope_finding_id: finding.id,
        event_type: "Estimate Updated",
        amount_cents: updated.approved_amount_cents,
        previous_amount_cents: previousAmount,
        new_amount_cents: updated.approved_amount_cents,
        previous_status: finding.workflow_status,
        new_status: updated.workflow_status,
        previous_decision: finding.billing_decision,
        new_decision: updated.billing_decision,
        note: "Approved amount edited by the professional.",
        actor: PROFESSIONAL_ACTOR,
        created_at: timestamp,
        is_demo: finding.is_demo
      });
    }

    return updated;
  });
}

/**
 * Performs a validated workflow action through the central transition
 * service, appends the matching billing event, and rejects stale versions.
 */
export async function performFindingAction(input: {
  finding_id: string;
  expected_version: number;
  action: FindingActionName;
  note?: string | null;
}) {
  return mutateLocalStore((store) => {
    const index = store.scopeFindings.findIndex((item) => item.id === input.finding_id);

    if (index === -1) throw new NotFoundError("Finding not found.");

    const finding = store.scopeFindings[index];

    if (finding.version !== input.expected_version) {
      throw new VersionConflictError();
    }

    const timestamp = now();
    const applied = applyFindingAction(finding, input.action, {
      now: timestamp,
      actor: PROFESSIONAL_ACTOR
    });

    store.scopeFindings[index] = applied.finding;
    store.billingEvents.push({
      id: randomUUID(),
      project_id: finding.project_id,
      scope_finding_id: finding.id,
      ...applied.event,
      note: input.note?.trim() || null,
      actor: PROFESSIONAL_ACTOR,
      created_at: timestamp,
      is_demo: finding.is_demo
    });

    return applied.finding;
  });
}
