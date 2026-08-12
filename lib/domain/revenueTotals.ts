import type { ScopeFinding } from "@/lib/types";

/**
 * Deterministic dashboard money rules.
 *
 * Every finding lands in EXACTLY ONE financial bucket, decided by its
 * (billing_decision, workflow_status) pair, so nothing is ever counted in two
 * incompatible categories. Buckets based on human-approved amounts are summed
 * in INTEGER CENTS; buckets that only have an AI estimate are summed in
 * legacy DOLLARS. The two units are reported separately and never added
 * together.
 *
 * Calculation rules (one per total):
 * - potential_dollars: sum of estimated_revenue (dollars) over every flagged
 *   (non "In Scope") finding regardless of decision. This is the historical
 *   audit metric and stays at $13,475 for the Northstar demo.
 * - needs_review_dollars: estimated_revenue of flagged findings still
 *   Undecided (status New or Needs Review).
 * - discussing_dollars: estimated_revenue of findings the professional chose
 *   to discuss with the client (decision Discuss With Client).
 * - billable_cents: approved_amount_cents of findings decided Bill Separately
 *   that are not yet invoiced (status Decided).
 * - invoiced_cents: approved_amount_cents of findings with status Invoiced.
 * - paid_cents: approved_amount_cents of findings with status Paid.
 * - retainer_cents: approved_amount_cents of findings decided Include In
 *   Retainer (tracked value, never invoiceable).
 * - absorbed_dollars: estimated_revenue of courtesy-absorbed findings.
 * - rejected_dollars: estimated_revenue of rejected findings.
 * - In-scope findings with no decision are informational and appear in no
 *   revenue bucket.
 */

export type FindingBucket =
  | "needs_review"
  | "discussing"
  | "billable"
  | "invoiced"
  | "paid"
  | "retainer"
  | "absorbed"
  | "rejected"
  | "none";

/**
 * Only these fields decide a bucket or a total. Naming them lets the store load
 * six columns for a dashboard instead of every column of every finding, without
 * a second copy of the rules living in SQL.
 */
export type RevenueRelevantFinding = Pick<
  ScopeFinding,
  "classification" | "estimated_revenue" | "billing_decision" | "workflow_status" | "approved_amount_cents" | "is_demo"
>;

export function findingBucket(finding: RevenueRelevantFinding): FindingBucket {
  switch (finding.billing_decision) {
    case "Undecided":
      return finding.classification === "In Scope" ? "none" : "needs_review";
    case "Discuss With Client":
      return "discussing";
    case "Bill Separately":
      if (finding.workflow_status === "Invoiced") return "invoiced";

      if (finding.workflow_status === "Paid") return "paid";

      return "billable";
    case "Include In Retainer":
      return "retainer";
    case "Absorb Courtesy":
      return "absorbed";
    case "Reject Finding":
      return "rejected";
  }
}

export type RevenueTotals = {
  /** Legacy dollars. Historical audit metric across all flagged findings. */
  potential_dollars: number;
  needs_review_count: number;
  needs_review_dollars: number;
  discussing_dollars: number;
  /** Integer cents. Approved, not yet invoiced. */
  billable_cents: number;
  /** Integer cents. Invoiced, awaiting payment. */
  invoiced_cents: number;
  /** Integer cents. Recorded as paid in this internal tracker. */
  paid_cents: number;
  /** Integer cents. Value delivered under an existing retainer. */
  retainer_cents: number;
  discussing_count: number;
  absorbed_dollars: number;
  rejected_dollars: number;
};

export function emptyRevenueTotals(): RevenueTotals {
  return {
    potential_dollars: 0,
    needs_review_count: 0,
    needs_review_dollars: 0,
    discussing_dollars: 0,
    billable_cents: 0,
    invoiced_cents: 0,
    paid_cents: 0,
    retainer_cents: 0,
    discussing_count: 0,
    absorbed_dollars: 0,
    rejected_dollars: 0
  };
}

export function computeRevenueTotals(findings: RevenueRelevantFinding[]): RevenueTotals {
  const totals = emptyRevenueTotals();

  for (const finding of findings) {
    if (finding.classification !== "In Scope") {
      totals.potential_dollars += finding.estimated_revenue;
    }

    const approvedCents = finding.approved_amount_cents ?? 0;

    switch (findingBucket(finding)) {
      case "needs_review":
        totals.needs_review_count += 1;
        totals.needs_review_dollars += finding.estimated_revenue;
        break;
      case "discussing":
        totals.discussing_count += 1;
        totals.discussing_dollars += finding.estimated_revenue;
        break;
      case "billable":
        totals.billable_cents += approvedCents;
        break;
      case "invoiced":
        totals.invoiced_cents += approvedCents;
        break;
      case "paid":
        totals.paid_cents += approvedCents;
        break;
      case "retainer":
        totals.retainer_cents += approvedCents;
        break;
      case "absorbed":
        totals.absorbed_dollars += finding.estimated_revenue;
        break;
      case "rejected":
        totals.rejected_dollars += finding.estimated_revenue;
        break;
      case "none":
        break;
    }
  }

  return totals;
}

/**
 * Fictional demo records and future real records are totaled separately and
 * never merged, per the Phase 1 requirements.
 */
export function computeSplitRevenueTotals(findings: RevenueRelevantFinding[]): {
  demo: RevenueTotals;
  real: RevenueTotals;
} {
  return {
    demo: computeRevenueTotals(findings.filter((finding) => finding.is_demo)),
    real: computeRevenueTotals(findings.filter((finding) => !finding.is_demo))
  };
}
