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

/**
 * Only the decision and the status choose a bucket. Naming that separately lets
 * a grouped total reuse the rules rather than restate them.
 */
export type BucketDeciding = Pick<ScopeFinding, "classification" | "billing_decision" | "workflow_status">;

export function findingBucket(finding: BucketDeciding): FindingBucket {
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

/**
 * One row per distinct combination of the columns that decide a bucket, with
 * the members already counted and summed. A firm with tens of thousands of
 * findings still produces a few dozen of these, so the totals for a page can be
 * built without carrying every finding out of the database.
 */
export type RevenueGroup = BucketDeciding & {
  is_demo: boolean;
  finding_count: number;
  estimated_revenue: number;
  approved_amount_cents: number;
};

export function computeRevenueTotalsFromGroups(groups: RevenueGroup[]): RevenueTotals {
  const totals = emptyRevenueTotals();

  for (const group of groups) {
    if (group.classification !== "In Scope") {
      totals.potential_dollars += group.estimated_revenue;
    }

    switch (findingBucket(group)) {
      case "needs_review":
        totals.needs_review_count += group.finding_count;
        totals.needs_review_dollars += group.estimated_revenue;
        break;
      case "discussing":
        totals.discussing_count += group.finding_count;
        totals.discussing_dollars += group.estimated_revenue;
        break;
      case "billable":
        totals.billable_cents += group.approved_amount_cents;
        break;
      case "invoiced":
        totals.invoiced_cents += group.approved_amount_cents;
        break;
      case "paid":
        totals.paid_cents += group.approved_amount_cents;
        break;
      case "retainer":
        totals.retainer_cents += group.approved_amount_cents;
        break;
      case "absorbed":
        totals.absorbed_dollars += group.estimated_revenue;
        break;
      case "rejected":
        totals.rejected_dollars += group.estimated_revenue;
        break;
      case "none":
        break;
    }
  }

  return totals;
}

export function computeSplitRevenueTotalsFromGroups(groups: RevenueGroup[]): {
  demo: RevenueTotals;
  real: RevenueTotals;
} {
  return {
    demo: computeRevenueTotalsFromGroups(groups.filter((group) => group.is_demo)),
    real: computeRevenueTotalsFromGroups(groups.filter((group) => !group.is_demo))
  };
}
