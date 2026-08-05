import { describe, expect, it } from "vitest";
import {
  applyFindingAction,
  availableActions,
  COMPATIBLE_STATUSES,
  FINDING_ACTIONS,
  findingDisplayLabel,
  isDecisionStatusConsistent,
  TransitionError,
  type FindingActionName
} from "@/lib/domain/findingTransitions";
import type { BillingDecision, ScopeFinding, WorkflowStatus } from "@/lib/types";

const NOW = "2026-07-21T12:00:00.000Z";
const ACTOR = "Professional";

function makeFinding(overrides: Partial<ScopeFinding> = {}): ScopeFinding {
  return {
    id: "finding-1",
    project_id: "project-1",
    client_message_id: "message-1",
    classification: "Out of Scope",
    confidence_score: 0.9,
    reasoning: "The SOW excludes this work.",
    relevant_sow_sections: ["Excluded scope includes this work."],
    request_type: "Engineering",
    estimated_hours: 10,
    estimated_revenue: 1750,
    suggested_change_order: "We can add this as a change order.",
    billing_decision: "Undecided",
    workflow_status: "Needs Review",
    approved_hours: null,
    approved_amount_cents: null,
    client_facing_explanation: "We can add this as a change order.",
    internal_note: null,
    reviewed_by: null,
    reviewed_at: null,
    created_at: "2026-06-05T12:00:00.000Z",
    updated_at: "2026-06-05T12:00:00.000Z",
    version: 1,
    is_demo: false,
    ...overrides
  };
}

function apply(
  finding: ScopeFinding,
  action: FindingActionName,
  review?: Parameters<typeof applyFindingAction>[2]["review"],
) {
  return applyFindingAction(finding, action, { now: NOW, actor: ACTOR, review });
}

function chain(finding: ScopeFinding, actions: FindingActionName[]) {
  return actions.reduce((current, action) => apply(current, action).finding, finding);
}

function approvedBillable(finding = makeFinding()) {
  return apply(finding, "Mark as Billable", {
    approved_hours: 10,
    approved_amount_cents: 175000,
  }).finding;
}

describe("valid transitions", () => {
  it("allows every decision action from Needs Review", () => {
    const expected: Array<[FindingActionName, BillingDecision, WorkflowStatus]> = [
      ["Mark as Billable", "Bill Separately", "Decided"],
      ["Include in Retainer", "Include In Retainer", "Decided"],
      ["Discuss With Client", "Discuss With Client", "Discussing"],
      ["Mark as Courtesy", "Absorb Courtesy", "Closed"],
      ["Reject Finding", "Reject Finding", "Closed"]
    ];

    for (const [action, decision, status] of expected) {
      const result = apply(makeFinding(), action);

      expect(result.finding.billing_decision).toBe(decision);
      expect(result.finding.workflow_status).toBe(status);
      expect(result.finding.version).toBe(2);
      expect(result.event.previous_status).toBe("Needs Review");
      expect(result.event.new_status).toBe(status);
    }
  });

  it("allows decision actions from New, Decided, and Discussing", () => {
    for (const status of ["New", "Decided", "Discussing"] as WorkflowStatus[]) {
      const finding = makeFinding({
        workflow_status: status,
        billing_decision:
          status === "Decided" ? "Bill Separately" : status === "Discussing" ? "Discuss With Client" : "Undecided"
      });

      expect(availableActions(finding)).toContain("Mark as Courtesy");
      expect(availableActions(finding)).toContain("Reject Finding");
    }
  });

  it("walks the full billing path: billable, invoiced, paid", () => {
    const billed = chain(approvedBillable(), ["Mark as Invoiced", "Mark as Paid"]);

    expect(billed.billing_decision).toBe("Bill Separately");
    expect(billed.workflow_status).toBe("Paid");
    expect(billed.version).toBe(4);
  });

  it("never copies AI estimates into professional-approved values", () => {
    const result = apply(makeFinding({ estimated_hours: 6, estimated_revenue: 1200.5 }), "Mark as Billable");

    expect(result.finding.approved_hours).toBeNull();
    expect(result.finding.approved_amount_cents).toBeNull();
  });

  it("applies professionally edited amounts atomically when moving to invoiced", () => {
    const decided = approvedBillable();
    const invoiced = apply(decided, "Mark as Invoiced", {
      approved_hours: 7.5,
      approved_amount_cents: 99900,
      internal_note: "Approved after client discussion.",
    });

    expect(invoiced.finding.approved_amount_cents).toBe(99900);
    expect(invoiced.finding.approved_hours).toBe(7.5);
    expect(invoiced.finding.internal_note).toBe("Approved after client discussion.");
    expect(invoiced.event.amount_cents).toBe(99900);
    expect(invoiced.event.previous_amount_cents).toBe(175000);
  });

  it("supports intentional reopen from Invoiced, Paid, and Closed", () => {
    const paid = chain(approvedBillable(), ["Mark as Invoiced", "Mark as Paid"]);
    const reopened = apply(paid, "Reopen Finding").finding;

    expect(reopened.billing_decision).toBe("Undecided");
    expect(reopened.workflow_status).toBe("Needs Review");
    expect(reopened.approved_amount_cents).toBeNull();
    expect(reopened.approved_hours).toBeNull();

    const rejected = apply(makeFinding(), "Reject Finding").finding;

    expect(apply(rejected, "Reopen Finding").finding.workflow_status).toBe("Needs Review");

    const invoiced = apply(approvedBillable(), "Mark as Invoiced").finding;

    expect(apply(invoiced, "Reopen Finding").finding.workflow_status).toBe("Needs Review");
  });
});

describe("invalid transitions", () => {
  function expectRejected(finding: ScopeFinding, action: FindingActionName) {
    expect(availableActions(finding)).not.toContain(action);
    expect(() => apply(finding, action)).toThrow(TransitionError);
  }

  it("rejects paid without invoiced", () => {
    expectRejected(makeFinding(), "Mark as Paid");
    const decided = apply(makeFinding(), "Mark as Billable").finding;

    expectRejected(decided, "Mark as Paid");
  });

  it("requires a billing decision before invoicing", () => {
    expectRejected(makeFinding(), "Mark as Invoiced");
    expectRejected(makeFinding({ workflow_status: "New" }), "Mark as Invoiced");
  });

  it("prevents rejected findings from being invoiced or paid", () => {
    const rejected = apply(makeFinding(), "Reject Finding").finding;

    expectRejected(rejected, "Mark as Invoiced");
    expectRejected(rejected, "Mark as Paid");
    expectRejected(rejected, "Mark as Billable");
  });

  it("prevents absorbed findings from being invoiced or paid", () => {
    const absorbed = apply(makeFinding(), "Mark as Courtesy").finding;

    expectRejected(absorbed, "Mark as Invoiced");
    expectRejected(absorbed, "Mark as Paid");
  });

  it("prevents included-in-retainer findings from being invoiced or paid", () => {
    const retainer = apply(makeFinding(), "Include in Retainer").finding;

    expectRejected(retainer, "Mark as Invoiced");
    expectRejected(retainer, "Mark as Paid");
  });

  it("locks decision actions once invoiced or paid", () => {
    const invoiced = apply(approvedBillable(), "Mark as Invoiced").finding;

    expectRejected(invoiced, "Mark as Billable");
    expectRejected(invoiced, "Reject Finding");
    expectRejected(invoiced, "Mark as Courtesy");

    const paid = apply(invoiced, "Mark as Paid").finding;

    expectRejected(paid, "Mark as Billable");
    expectRejected(paid, "Mark as Invoiced");
  });

  it("rejects reopen while the finding is still open", () => {
    expectRejected(makeFinding(), "Reopen Finding");
    expectRejected(makeFinding({ workflow_status: "New" }), "Reopen Finding");
    const decided = apply(makeFinding(), "Mark as Billable").finding;

    expectRejected(decided, "Reopen Finding");
  });

  it("refuses invoicing without an approved amount", () => {
    const decided = apply(makeFinding(), "Mark as Billable").finding;
    const cleared = { ...decided, approved_amount_cents: null };

    expect(() => apply(cleared, "Mark as Invoiced")).toThrow(/approved amount/i);
  });
});

describe("state consistency", () => {
  it("every action result satisfies the decision/status compatibility matrix", () => {
    const seeds: ScopeFinding[] = [
      makeFinding(),
      makeFinding({ workflow_status: "New" }),
      approvedBillable(),
      apply(makeFinding(), "Discuss With Client").finding,
      apply(approvedBillable(), "Mark as Invoiced").finding,
      chain(approvedBillable(), ["Mark as Invoiced", "Mark as Paid"]),
      apply(makeFinding(), "Reject Finding").finding
    ];

    for (const seed of seeds) {
      expect(isDecisionStatusConsistent(seed.billing_decision, seed.workflow_status)).toBe(true);

      for (const action of FINDING_ACTIONS) {
        if (!availableActions(seed).includes(action)) continue;

        const result = apply(seed, action).finding;

        expect(isDecisionStatusConsistent(result.billing_decision, result.workflow_status)).toBe(true);
      }
    }
  });

  it("keeps the compatibility matrix honest for every decision", () => {
    for (const decision of Object.keys(COMPATIBLE_STATUSES) as BillingDecision[]) {
      expect(COMPATIBLE_STATUSES[decision].length).toBeGreaterThan(0);
    }

    expect(COMPATIBLE_STATUSES["Reject Finding"]).not.toContain("Paid");
    expect(COMPATIBLE_STATUSES["Absorb Courtesy"]).not.toContain("Invoiced");
    expect(COMPATIBLE_STATUSES["Include In Retainer"]).not.toContain("Invoiced");
    expect(COMPATIBLE_STATUSES["Include In Retainer"]).not.toContain("Paid");
    expect(COMPATIBLE_STATUSES.Undecided).not.toContain("Invoiced");
  });

  it("derives friendly display labels from the canonical state", () => {
    expect(findingDisplayLabel(makeFinding())).toBe("Needs Review");
    expect(findingDisplayLabel(apply(makeFinding(), "Mark as Billable").finding)).toBe("Billable");
    expect(findingDisplayLabel(apply(makeFinding(), "Include in Retainer").finding)).toBe(
      "Included in Retainer"
    );
    expect(findingDisplayLabel(apply(makeFinding(), "Mark as Courtesy").finding)).toBe(
      "Courtesy / Not Billing"
    );
    expect(findingDisplayLabel(apply(makeFinding(), "Reject Finding").finding)).toBe("Rejected");
    expect(
      findingDisplayLabel(apply(approvedBillable(), "Mark as Invoiced").finding)
    ).toBe("Invoiced");
    expect(
      findingDisplayLabel(
        makeFinding({ classification: "In Scope", workflow_status: "New", estimated_revenue: 0 })
      )
    ).toBe("In Scope - No Action Needed");
  });
});
