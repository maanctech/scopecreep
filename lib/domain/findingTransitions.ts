import type {
  BillingDecision,
  BillingEventType,
  Classification,
  ScopeFinding,
  WorkflowStatus
} from "@/lib/types";

/**
 * Single source of truth for the Scope Finding state machine.
 *
 * Design: the billing decision and the workflow status are never edited
 * directly. The professional performs one of the named ACTIONS below, and the
 * action sets both fields atomically. Because every (decision, status) pair
 * can only be produced by an action in this file, the two fields can never
 * contradict each other. The compatibility matrix is exported so tests can
 * verify the invariant.
 *
 * Guarantees encoded here:
 * - Rejected findings can never become invoiced or paid while rejected.
 * - Courtesy-absorbed findings can never become invoiced or paid.
 * - Included-in-retainer findings can never become invoiced or paid.
 * - "Mark as Invoiced" requires an explicit Bill Separately decision first.
 * - "Mark as Paid" requires the finding to be Invoiced first.
 * - Reopening is an explicit action that resets the finding to Needs Review
 *   with an Undecided decision, so a previously rejected finding must go
 *   through the full decision flow again before it can ever be paid.
 */

export const FINDING_ACTIONS = [
  "Mark as Billable",
  "Include in Retainer",
  "Discuss With Client",
  "Mark as Courtesy",
  "Reject Finding",
  "Mark as Invoiced",
  "Mark as Paid",
  "Reopen Finding"
] as const;

export type FindingActionName = (typeof FINDING_ACTIONS)[number];

export type FindingReviewChanges = {
  approved_hours?: number | null;
  approved_amount_cents?: number | null;
  client_facing_explanation?: string;
  internal_note?: string | null;
};

/** Which workflow statuses are legal for each billing decision. */
export const COMPATIBLE_STATUSES: Record<BillingDecision, readonly WorkflowStatus[]> = {
  Undecided: ["New", "Needs Review"],
  "Bill Separately": ["Decided", "Invoiced", "Paid"],
  "Include In Retainer": ["Decided"],
  "Discuss With Client": ["Discussing"],
  "Absorb Courtesy": ["Closed"],
  "Reject Finding": ["Closed"]
};

/** Statuses from which the professional may still make or change a billing decision. */
const DECISION_OPEN_STATUSES: readonly WorkflowStatus[] = [
  "New",
  "Needs Review",
  "Decided",
  "Discussing"
];

/** Statuses that can be intentionally reopened back to Needs Review. */
const REOPENABLE_STATUSES: readonly WorkflowStatus[] = ["Invoiced", "Paid", "Closed"];

export class TransitionError extends Error {
  constructor(
    message: string,
    public readonly code: "invalid_action" | "missing_amount"
  ) {
    super(message);
  }
}

/**
 * The state a newly analyzed finding starts in. Creating a finding is not one
 * of the ACTIONS above, so it cannot go through applyFindingAction — but the
 * pair it produces still has to be one COMPATIBLE_STATUSES permits, and three
 * separate writers need it (both stores and the analysis job). Deriving it here
 * is what keeps them from drifting apart from the state machine.
 */
export function initialFindingState(classification: Classification): {
  billing_decision: BillingDecision;
  workflow_status: WorkflowStatus;
} {
  return {
    billing_decision: "Undecided",
    workflow_status: classification === "In Scope" ? "New" : "Needs Review"
  };
}

export function isDecisionStatusConsistent(
  decision: BillingDecision,
  status: WorkflowStatus
): boolean {
  return COMPATIBLE_STATUSES[decision].includes(status);
}

export function availableActions(finding: ScopeFinding): FindingActionName[] {
  const actions: FindingActionName[] = [];

  if (DECISION_OPEN_STATUSES.includes(finding.workflow_status)) {
    actions.push(
      "Mark as Billable",
      "Include in Retainer",
      "Discuss With Client",
      "Mark as Courtesy",
      "Reject Finding"
    );
  }

  if (
    finding.billing_decision === "Bill Separately" &&
    finding.workflow_status === "Decided"
  ) {
    actions.push("Mark as Invoiced");
  }

  if (finding.workflow_status === "Invoiced") {
    actions.push("Mark as Paid");
  }

  if (REOPENABLE_STATUSES.includes(finding.workflow_status)) {
    actions.push("Reopen Finding");
  }

  return actions;
}

/** Plain-English label shown in the UI, derived from the canonical state. */
export function findingDisplayLabel(finding: ScopeFinding): string {
  if (finding.workflow_status === "Invoiced") return "Invoiced";

  if (finding.workflow_status === "Paid") return "Paid";

  switch (finding.billing_decision) {
    case "Bill Separately":
      return "Billable";
    case "Include In Retainer":
      return "Included in Retainer";
    case "Discuss With Client":
      return "Discuss With Client";
    case "Absorb Courtesy":
      return "Courtesy / Not Billing";
    case "Reject Finding":
      return "Rejected";
    default:
      return finding.classification === "In Scope"
        ? "In Scope - No Action Needed"
        : "Needs Review";
  }
}

/** Plain-English guidance shown on each finding card. */
export function recommendedNextStep(finding: ScopeFinding): string {
  if (finding.workflow_status === "Invoiced") {
    return "When your client pays the invoice you sent, use Mark as Paid to record it here.";
  }

  if (finding.workflow_status === "Paid") {
    return "Payment recorded. Nothing else to do unless you need to reopen this finding.";
  }

  switch (finding.billing_decision) {
    case "Bill Separately":
      return "Check the approved hours and amount, send your own change order or invoice, then use Mark as Invoiced.";
    case "Include In Retainer":
      return "Tracked as retainer work. Nothing will be invoiced for this finding.";
    case "Discuss With Client":
      return "After you talk with your client, come back and record the outcome with one of the decision buttons.";
    case "Absorb Courtesy":
      return "You chose not to bill this work. Reopen the finding if you change your mind.";
    case "Reject Finding":
      return "You rejected this finding. Reopen it if that was a mistake.";
    default:
      return finding.classification === "In Scope"
        ? "This request looks covered by the agreement. No billing action is needed."
        : "Review this request against the SOW and choose a billing decision below.";
  }
}

export type AppliedAction = {
  finding: ScopeFinding;
  event: {
    event_type: BillingEventType;
    amount_cents: number | null;
    previous_amount_cents: number | null;
    new_amount_cents: number | null;
    previous_status: WorkflowStatus;
    new_status: WorkflowStatus;
    previous_decision: BillingDecision;
    new_decision: BillingDecision;
  };
};

const ACTION_EVENT_TYPES: Record<FindingActionName, BillingEventType> = {
  "Mark as Billable": "Approved Internally",
  "Include in Retainer": "Included In Retainer",
  "Discuss With Client": "Discussing With Client",
  "Mark as Courtesy": "Absorbed",
  "Reject Finding": "Rejected",
  "Mark as Invoiced": "Invoiced",
  "Mark as Paid": "Paid",
  "Reopen Finding": "Reopened"
};

/**
 * Applies a workflow action to a finding. Pure with respect to inputs: the
 * caller supplies the timestamp and persists the returned finding and event.
 * Throws TransitionError for anything the state machine does not allow.
 */
export function applyFindingAction(
  finding: ScopeFinding,
  action: FindingActionName,
  input: { now: string; actor: string; review?: FindingReviewChanges }
): AppliedAction {
  if (!availableActions(finding).includes(action)) {
    throw new TransitionError(
      `"${action}" is not allowed while this finding is ${finding.workflow_status} with the decision "${finding.billing_decision}".`,
      "invalid_action"
    );
  }

  const previous = {
    status: finding.workflow_status,
    decision: finding.billing_decision,
    amountCents: finding.approved_amount_cents
  };

  const review = input.review ?? {};
  const wantsAmountChange =
    review.approved_hours !== undefined || review.approved_amount_cents !== undefined;
  const canEditAmounts =
    finding.workflow_status === "Decided" ||
    action === "Mark as Billable" ||
    action === "Include in Retainer";

  if (wantsAmountChange && !canEditAmounts) {
    throw new TransitionError(
      "Make or retain a billing decision before setting professional-approved amounts.",
      "invalid_action"
    );
  }

  if (
    review.approved_hours !== undefined &&
    review.approved_hours !== null &&
    (!Number.isFinite(review.approved_hours) || review.approved_hours < 0)
  ) {
    throw new TransitionError("Approved hours must be a finite number of 0 or more.", "invalid_action");
  }

  if (
    review.approved_amount_cents !== undefined &&
    review.approved_amount_cents !== null &&
    (!Number.isSafeInteger(review.approved_amount_cents) || review.approved_amount_cents < 0)
  ) {
    throw new TransitionError("Approved amount must be a non-negative integer number of cents.", "invalid_action");
  }

  let decision = finding.billing_decision;
  let status = finding.workflow_status;
  let approvedHours = review.approved_hours !== undefined ? review.approved_hours : finding.approved_hours;
  let approvedAmountCents = review.approved_amount_cents !== undefined
    ? review.approved_amount_cents
    : finding.approved_amount_cents;

  switch (action) {
    case "Mark as Billable":
      decision = "Bill Separately";
      status = "Decided";
      break;
    case "Include in Retainer":
      decision = "Include In Retainer";
      status = "Decided";
      break;
    case "Discuss With Client":
      decision = "Discuss With Client";
      status = "Discussing";
      break;
    case "Mark as Courtesy":
      decision = "Absorb Courtesy";
      status = "Closed";
      // Courtesy work is intentionally not billed, so no approved amount may
      // linger and leak into approved totals.
      approvedHours = null;
      approvedAmountCents = null;
      break;
    case "Reject Finding":
      decision = "Reject Finding";
      status = "Closed";
      approvedHours = null;
      approvedAmountCents = null;
      break;
    case "Mark as Invoiced":
      if (approvedAmountCents == null) {
        throw new TransitionError(
          "Set an approved amount before marking this finding as invoiced.",
          "missing_amount"
        );
      }

      status = "Invoiced";
      break;
    case "Mark as Paid":
      status = "Paid";
      break;
    case "Reopen Finding":
      decision = "Undecided";
      status = "Needs Review";
      approvedHours = null;
      approvedAmountCents = null;
      break;
  }

  const updated: ScopeFinding = {
    ...finding,
    billing_decision: decision,
    workflow_status: status,
    approved_hours: approvedHours,
    approved_amount_cents: approvedAmountCents,
    client_facing_explanation:
      review.client_facing_explanation ?? finding.client_facing_explanation,
    internal_note: review.internal_note !== undefined ? review.internal_note : finding.internal_note,
    reviewed_by: input.actor,
    reviewed_at: input.now,
    updated_at: input.now,
    version: finding.version + 1
  };

  return {
    finding: updated,
    event: {
      event_type: ACTION_EVENT_TYPES[action],
      amount_cents: approvedAmountCents,
      previous_amount_cents: previous.amountCents,
      new_amount_cents: approvedAmountCents,
      previous_status: previous.status,
      new_status: status,
      previous_decision: previous.decision,
      new_decision: decision
    }
  };
}
