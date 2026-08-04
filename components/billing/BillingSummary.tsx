import { formatCents, formatDollars } from "@/lib/domain/money";
import type { RevenueTotals } from "@/lib/domain/revenueTotals";

/**
 * Renders one set of revenue totals. Potential values (AI estimates, dollars)
 * and approved values (human-approved, stored in cents) are labeled
 * separately and never added together.
 */
export function BillingSummary({ totals }: { totals: RevenueTotals }) {
  const cards: Array<{ label: string; value: string; hint: string }> = [
    {
      label: "Total potential revenue",
      value: formatDollars(totals.potential_dollars),
      hint: "AI estimate across all flagged requests"
    },
    {
      label: "Needs review",
      value: formatDollars(totals.needs_review_dollars),
      hint: `${totals.needs_review_count} finding${totals.needs_review_count === 1 ? "" : "s"} waiting for your decision`
    },
    {
      label: "Billable / approved",
      value: formatCents(totals.billable_cents),
      hint: "Approved by you, not yet invoiced"
    },
    {
      label: "Discussing with client",
      value: formatDollars(totals.discussing_dollars),
      hint: `${totals.discussing_count} finding${totals.discussing_count === 1 ? "" : "s"} in conversation`
    },
    {
      label: "Invoiced",
      value: formatCents(totals.invoiced_cents),
      hint: "You sent the invoice yourself"
    },
    {
      label: "Paid / recovered",
      value: formatCents(totals.paid_cents),
      hint: "Recorded as paid in this tracker"
    },
    {
      label: "Included in retainer",
      value: formatCents(totals.retainer_cents),
      hint: "Covered by an existing retainer"
    },
    {
      label: "Courtesy / absorbed",
      value: formatDollars(totals.absorbed_dollars),
      hint: "Work you chose not to bill"
    },
    {
      label: "Rejected",
      value: formatDollars(totals.rejected_dollars),
      hint: "Findings you rejected"
    }
  ];

  return (
    <div className="
      grid gap-4
      sm:grid-cols-2
      lg:grid-cols-3
    ">
      {cards.map((card) => (
        <div key={card.label} className="
          rounded-md border border-audit-border bg-white p-4 shadow-audit
        ">
          <div className="text-sm font-medium text-audit-muted">{card.label}</div>
          <div className="mt-1 text-2xl font-semibold">{card.value}</div>
          <div className="mt-1 text-sm text-audit-muted">{card.hint}</div>
        </div>
      ))}
    </div>
  );
}
