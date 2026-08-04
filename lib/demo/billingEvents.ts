import type { BillingDecision, BillingEvent, ScopeFinding, WorkflowStatus } from "@/lib/types";
import { createdAt } from "@/lib/demo/constants";
import { demoFindingByMessageId, demoFindings, demoReviewedAt } from "@/lib/demo/findings";

let demoEventSequence = 0;

function demoEvent(
  finding: ScopeFinding,
  input: Pick<
    BillingEvent,
    | "event_type"
    | "amount_cents"
    | "previous_amount_cents"
    | "new_amount_cents"
    | "previous_status"
    | "new_status"
    | "previous_decision"
    | "new_decision"
    | "note"
    | "actor"
    | "created_at"
  >
): BillingEvent {
  demoEventSequence += 1;

  return {
    id: `88888888-8888-4888-8888-8888888888${String(demoEventSequence).padStart(2, "0")}`,
    project_id: finding.project_id,
    scope_finding_id: finding.id,
    is_demo: true,
    ...input
  };
}

function demoCreatedEvent(finding: ScopeFinding): BillingEvent {
  return demoEvent(finding, {
    event_type: "Finding Created",
    amount_cents: null,
    previous_amount_cents: null,
    new_amount_cents: null,
    previous_status: null,
    new_status: finding.classification === "In Scope" ? "New" : "Needs Review",
    previous_decision: null,
    new_decision: "Undecided",
    note: "Seeded demo finding.",
    actor: "Demo Seed",
    created_at: createdAt
  });
}

function demoDecisionChain(
  messageId: string,
  steps: Array<{
    event_type: BillingEvent["event_type"];
    previous_status: WorkflowStatus;
    new_status: WorkflowStatus;
    previous_decision: BillingDecision;
    new_decision: BillingDecision;
    amount_cents: number | null;
  }>
): BillingEvent[] {
  const finding = demoFindingByMessageId.get(messageId)!;

  return steps.map((step) =>
    demoEvent(finding, {
      ...step,
      previous_amount_cents: null,
      new_amount_cents: step.amount_cents,
      note: "Seeded demo billing decision.",
      actor: "Professional",
      created_at: demoReviewedAt
    })
  );
}

export const demoBillingEvents: BillingEvent[] = [
  ...demoFindings.map(demoCreatedEvent),
  ...demoDecisionChain("33333333-3333-4333-8333-333333333334", [
    {
      event_type: "Approved Internally",
      previous_status: "Needs Review",
      new_status: "Decided",
      previous_decision: "Undecided",
      new_decision: "Bill Separately",
      amount_cents: 490000
    },
    {
      event_type: "Invoiced",
      previous_status: "Decided",
      new_status: "Invoiced",
      previous_decision: "Bill Separately",
      new_decision: "Bill Separately",
      amount_cents: 490000
    }
  ]),
  ...demoDecisionChain("33333333-3333-4333-8333-333333333335", [
    {
      event_type: "Approved Internally",
      previous_status: "Needs Review",
      new_status: "Decided",
      previous_decision: "Undecided",
      new_decision: "Bill Separately",
      amount_cents: 175000
    }
  ]),
  ...demoDecisionChain("33333333-3333-4333-8333-333333333336", [
    {
      event_type: "Discussing With Client",
      previous_status: "Needs Review",
      new_status: "Discussing",
      previous_decision: "Undecided",
      new_decision: "Discuss With Client",
      amount_cents: null
    }
  ]),
  ...demoDecisionChain("33333333-3333-4333-8333-333333333337", [
    {
      event_type: "Absorbed",
      previous_status: "Needs Review",
      new_status: "Closed",
      previous_decision: "Undecided",
      new_decision: "Absorb Courtesy",
      amount_cents: null
    }
  ]),
  ...demoDecisionChain("33333333-3333-4333-8333-333333333338", [
    {
      event_type: "Approved Internally",
      previous_status: "Needs Review",
      new_status: "Decided",
      previous_decision: "Undecided",
      new_decision: "Bill Separately",
      amount_cents: 210000
    },
    {
      event_type: "Invoiced",
      previous_status: "Decided",
      new_status: "Invoiced",
      previous_decision: "Bill Separately",
      new_decision: "Bill Separately",
      amount_cents: 210000
    },
    {
      event_type: "Paid",
      previous_status: "Invoiced",
      new_status: "Paid",
      previous_decision: "Bill Separately",
      new_decision: "Bill Separately",
      amount_cents: 210000
    }
  ])
];
