import { describe, expect, it } from "vitest";
import {
  computeSplitRevenueTotals,
  computeSplitRevenueTotalsFromGroups,
  type RevenueGroup,
  type RevenueRelevantFinding
} from "@/lib/domain/revenueTotals";

const DECISIONS = [
  "Undecided", "Discuss With Client", "Bill Separately", "Include In Retainer", "Absorb Courtesy", "Reject Finding"
] as const;

const STATUSES = ["New", "Needs Review", "Decided", "Invoiced", "Paid"] as const;
const CLASSIFICATIONS = ["In Scope", "Possibly In Scope", "Out of Scope", "Needs Human Review"] as const;

/**
 * Every combination that can decide a bucket appears, so a rule the grouped
 * version forgets cannot hide in a case the fixture never produces.
 */
function everyCombination(): RevenueRelevantFinding[] {
  const findings: RevenueRelevantFinding[] = [];
  let seed = 0;

  for (const classification of CLASSIFICATIONS) {
    for (const billingDecision of DECISIONS) {
      for (const workflowStatus of STATUSES) {
        for (const isDemo of [true, false]) {
          seed += 1;

          findings.push({
            classification,
            billing_decision: billingDecision,
            workflow_status: workflowStatus,
            estimated_revenue: seed * 25,
            approved_amount_cents: seed * 1_100,
            is_demo: isDemo
          });
        }
      }
    }
  }

  return findings;
}

/**
 * Stands in for the GROUP BY the store issues: the same rows, reduced to one
 * entry per distinct combination with the members counted and summed.
 */
function groupsOf(findings: RevenueRelevantFinding[]): RevenueGroup[] {
  const groups = new Map<string, RevenueGroup>();

  for (const finding of findings) {
    const key = [finding.classification, finding.billing_decision, finding.workflow_status, finding.is_demo].join("|");
    const existing = groups.get(key);

    if (existing) {
      existing.finding_count += 1;
      existing.estimated_revenue += finding.estimated_revenue;
      existing.approved_amount_cents += finding.approved_amount_cents ?? 0;
      continue;
    }

    groups.set(key, {
      classification: finding.classification,
      billing_decision: finding.billing_decision,
      workflow_status: finding.workflow_status,
      is_demo: finding.is_demo,
      finding_count: 1,
      estimated_revenue: finding.estimated_revenue,
      approved_amount_cents: finding.approved_amount_cents ?? 0
    });
  }

  return [...groups.values()];
}

describe("totalling revenue from grouped rows", () => {
  it("reaches the same totals as counting every finding one at a time", () => {
    const findings = everyCombination();

    expect(computeSplitRevenueTotalsFromGroups(groupsOf(findings))).toEqual(computeSplitRevenueTotals(findings));
  });

  it("still agrees when several findings share a combination", () => {
    const findings = [...everyCombination(), ...everyCombination(), ...everyCombination()];

    expect(computeSplitRevenueTotalsFromGroups(groupsOf(findings))).toEqual(computeSplitRevenueTotals(findings));
  });

  it("keeps demonstration money out of the real totals", () => {
    const findings: RevenueRelevantFinding[] = [
      {
        classification: "Out of Scope",
        billing_decision: "Bill Separately",
        workflow_status: "Paid",
        estimated_revenue: 400,
        approved_amount_cents: 40_000,
        is_demo: true
      },
      {
        classification: "Out of Scope",
        billing_decision: "Bill Separately",
        workflow_status: "Paid",
        estimated_revenue: 900,
        approved_amount_cents: 90_000,
        is_demo: false
      }
    ];
    const totals = computeSplitRevenueTotalsFromGroups(groupsOf(findings));

    expect(totals.demo.paid_cents).toBe(40_000);
    expect(totals.real.paid_cents).toBe(90_000);
  });

  it("totals nothing when a firm has no findings at all", () => {
    expect(computeSplitRevenueTotalsFromGroups([])).toEqual(computeSplitRevenueTotals([]));
  });
});
