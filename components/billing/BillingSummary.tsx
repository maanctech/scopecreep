import { formatCents, formatDollars } from "@/lib/domain/money";
import type { RevenueTotals } from "@/lib/domain/revenueTotals";

/**
 * Renders one set of revenue totals. Potential values (AI estimates, dollars)
 * and approved values (human-approved, stored in cents) are labeled
 * separately and never added together.
 */
export function BillingSummary({ totals }: { totals: RevenueTotals }) {
  const cards: Array<{ label: string; value: string; hint: string; tone: "potential" | "approved" | "neutral" }> = [
    {
      label: "Total potential revenue",
      value: formatDollars(totals.potential_dollars),
      hint: "AI estimate across all flagged requests",
      tone: "potential",
    },
    {
      label: "Needs review",
      value: formatDollars(totals.needs_review_dollars),
      hint: `${totals.needs_review_count} finding${totals.needs_review_count === 1 ? "" : "s"} waiting for your decision`,
      tone: "potential",
    },
    {
      label: "Billable / approved",
      value: formatCents(totals.billable_cents),
      hint: "Approved by you, not yet invoiced",
      tone: "approved",
    },
    {
      label: "Discussing with client",
      value: formatDollars(totals.discussing_dollars),
      hint: `${totals.discussing_count} finding${totals.discussing_count === 1 ? "" : "s"} in conversation`,
      tone: "potential",
    },
    {
      label: "Invoiced",
      value: formatCents(totals.invoiced_cents),
      hint: "You sent the invoice yourself",
      tone: "approved",
    },
    {
      label: "Paid / recovered",
      value: formatCents(totals.paid_cents),
      hint: "Recorded as paid in this tracker",
      tone: "approved",
    },
    {
      label: "Included in retainer",
      value: formatCents(totals.retainer_cents),
      hint: "Covered by an existing retainer",
      tone: "approved",
    },
    {
      label: "Courtesy / absorbed",
      value: formatDollars(totals.absorbed_dollars),
      hint: "Work you chose not to bill",
      tone: "neutral",
    },
    {
      label: "Rejected",
      value: formatDollars(totals.rejected_dollars),
      hint: "Findings you rejected",
      tone: "neutral",
    }
  ];

  return (
    <div className="border-t border-ink bg-bright-paper">
      {cards.map((card, index) => (
        <div key={card.label} className="
          grid gap-2 border-b border-audit-border px-1 py-3
          sm:grid-cols-[3.25rem_minmax(10rem,0.8fr)_minmax(8rem,0.5fr)_minmax(12rem,1fr)]
          sm:items-baseline sm:gap-4
        ">
          <span className="sl-metadata text-audit-muted">L-{String(index + 1).padStart(2, "0")}</span>
          <div className={`
            text-xs font-semibold uppercase
            ${card.tone === "potential" ? `text-audit-amber` : card.tone === "approved" ? `
              text-approved
            ` : `text-audit-muted`}
          `}>{card.label}</div>
          <div data-financial-value className="sl-editorial text-2xl">{card.value}</div>
          <div className="text-xs/5 text-audit-muted">{card.hint}</div>
        </div>
      ))}
    </div>
  );
}
