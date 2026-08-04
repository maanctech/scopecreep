import { describe, expect, it } from "vitest";
import { demoFindings } from "@/lib/demo";
import { applyFindingAction } from "@/lib/domain/findingTransitions";
import { dollarsToCents, formatCents } from "@/lib/domain/money";
import {
  computeRevenueTotals,
  computeSplitRevenueTotals,
  findingBucket
} from "@/lib/domain/revenueTotals";
import type { ScopeFinding } from "@/lib/types";

function makeFinding(overrides: Partial<ScopeFinding> = {}): ScopeFinding {
  return {
    id: "finding-1",
    project_id: "project-1",
    client_message_id: "message-1",
    classification: "Out of Scope",
    confidence_score: 0.9,
    reasoning: "Excluded work.",
    relevant_sow_sections: [],
    request_type: "Engineering",
    estimated_hours: 10,
    estimated_revenue: 1000,
    suggested_change_order: "Change order draft.",
    billing_decision: "Undecided",
    workflow_status: "Needs Review",
    approved_hours: null,
    approved_amount_cents: null,
    client_facing_explanation: "Change order draft.",
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

describe("money rules", () => {
  it("converts dollars to integer cents with the documented rounding rule", () => {
    expect(dollarsToCents(1200.5)).toBe(120050);
    expect(dollarsToCents(0.1 + 0.2)).toBe(30);
    expect(dollarsToCents(13475)).toBe(1347500);
  });

  it("formats cents as currency only at the UI boundary", () => {
    expect(formatCents(120050)).toBe("$1,200.50");
    expect(formatCents(0)).toBe("$0.00");
  });

  it("sums approved totals in integer cents without floating-point drift", () => {
    // 0.1 + 0.2 style drift is impossible with integer cents: 10 findings of
    // $10.10 must total exactly $101.00.
    const findings = Array.from({ length: 10 }, (_, index) =>
      makeFinding({
        id: `finding-${index}`,
        billing_decision: "Bill Separately",
        workflow_status: "Decided",
        approved_amount_cents: 1010
      })
    );

    expect(computeRevenueTotals(findings).billable_cents).toBe(10100);
  });
});

describe("financial buckets", () => {
  it("puts every finding in exactly one bucket", () => {
    const variants: ScopeFinding[] = [
      makeFinding(),
      makeFinding({ classification: "In Scope", estimated_revenue: 0, workflow_status: "New" }),
      makeFinding({ billing_decision: "Discuss With Client", workflow_status: "Discussing" }),
      makeFinding({
        billing_decision: "Bill Separately",
        workflow_status: "Decided",
        approved_amount_cents: 100000
      }),
      makeFinding({
        billing_decision: "Bill Separately",
        workflow_status: "Invoiced",
        approved_amount_cents: 100000
      }),
      makeFinding({
        billing_decision: "Bill Separately",
        workflow_status: "Paid",
        approved_amount_cents: 100000
      }),
      makeFinding({
        billing_decision: "Include In Retainer",
        workflow_status: "Decided",
        approved_amount_cents: 100000
      }),
      makeFinding({ billing_decision: "Absorb Courtesy", workflow_status: "Closed" }),
      makeFinding({ billing_decision: "Reject Finding", workflow_status: "Closed" })
    ];

    const buckets = variants.map(findingBucket);

    expect(buckets).toEqual([
      "needs_review",
      "none",
      "discussing",
      "billable",
      "invoiced",
      "paid",
      "retainer",
      "absorbed",
      "rejected"
    ]);
  });

  it("never counts one finding in two incompatible categories", () => {
    const paid = makeFinding({
      billing_decision: "Bill Separately",
      workflow_status: "Paid",
      approved_amount_cents: 200000,
      estimated_revenue: 2000
    });
    const totals = computeRevenueTotals([paid]);

    expect(totals.paid_cents).toBe(200000);
    expect(totals.billable_cents).toBe(0);
    expect(totals.invoiced_cents).toBe(0);
    expect(totals.needs_review_dollars).toBe(0);
    expect(totals.rejected_dollars).toBe(0);
    // Potential is a separate historical metric, reported in dollars only.
    expect(totals.potential_dollars).toBe(2000);
  });

  it("moves a finding across buckets as the workflow advances", () => {
    let finding = makeFinding({ estimated_revenue: 1750 });

    expect(findingBucket(finding)).toBe("needs_review");

    finding = applyFindingAction(finding, "Mark as Billable", {
      now: "2026-07-21T12:00:00.000Z",
      actor: "Professional"
    }).finding;
    expect(findingBucket(finding)).toBe("billable");

    finding = applyFindingAction(finding, "Mark as Invoiced", {
      now: "2026-07-21T12:00:00.000Z",
      actor: "Professional"
    }).finding;
    expect(findingBucket(finding)).toBe("invoiced");

    finding = applyFindingAction(finding, "Mark as Paid", {
      now: "2026-07-21T12:00:00.000Z",
      actor: "Professional"
    }).finding;
    expect(findingBucket(finding)).toBe("paid");

    const totals = computeRevenueTotals([finding]);

    expect(totals.paid_cents).toBe(175000);
    expect(totals.billable_cents + totals.invoiced_cents).toBe(0);
  });
});

describe("demo data totals", () => {
  it("preserves the Northstar demo: 12 findings and $13,475 potential", () => {
    expect(demoFindings).toHaveLength(12);
    const totals = computeRevenueTotals(demoFindings);

    expect(totals.potential_dollars).toBe(13475);
  });

  it("matches the seeded demo workflow buckets exactly", () => {
    const totals = computeRevenueTotals(demoFindings);

    expect(totals.needs_review_count).toBe(3);
    expect(totals.needs_review_dollars).toBe(1225);
    expect(totals.discussing_dollars).toBe(2100);
    expect(totals.billable_cents).toBe(175000);
    expect(totals.invoiced_cents).toBe(490000);
    expect(totals.paid_cents).toBe(210000);
    expect(totals.retainer_cents).toBe(0);
    expect(totals.absorbed_dollars).toBe(1400);
    expect(totals.rejected_dollars).toBe(0);
    // Every flagged dollar is accounted for exactly once across the
    // dollar-based buckets plus the findings holding approved cents.
    expect(
      totals.needs_review_dollars +
        totals.discussing_dollars +
        totals.absorbed_dollars +
        totals.rejected_dollars +
        4900 + // invoiced finding's potential
        1750 + // billable finding's potential
        2100 // paid finding's potential
    ).toBe(totals.potential_dollars);
  });

  it("keeps demo totals separate from real totals", () => {
    const realFinding = makeFinding({
      id: "real-1",
      estimated_revenue: 999,
      billing_decision: "Bill Separately",
      workflow_status: "Paid",
      approved_amount_cents: 99900
    });

    const split = computeSplitRevenueTotals([...demoFindings, realFinding]);

    expect(split.demo.potential_dollars).toBe(13475);
    expect(split.demo.paid_cents).toBe(210000);
    expect(split.real.potential_dollars).toBe(999);
    expect(split.real.paid_cents).toBe(99900);
  });
});
