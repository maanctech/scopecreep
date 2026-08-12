import { Badge } from "@/components/ui/Badge";
import { FindingHistory } from "@/components/findings/FindingHistory";
import { FindingStatusBadge } from "@/components/ui/FindingStatusBadge";
import { FindingReviewForm } from "@/components/forms/FindingReviewForm";
import { recommendedNextStep } from "@/lib/domain/findingTransitions";
import { formatCents, formatDollars } from "@/lib/domain/money";
import type { BillingEvent, MessageWithFinding } from "@/lib/types";

export function FindingCard({
  row,
  events,
  canReview = true
}: {
  row: MessageWithFinding;
  events: BillingEvent[];
  canReview?: boolean;
}) {
  const finding = row.finding;

  if (!finding) {
    return (
      <article className="sl-panel p-5">
        <p className="text-sm text-audit-muted">No analysis saved for this message.</p>
        <p className="mt-2 text-base">{row.message.message_text}</p>
      </article>
    );
  }

  return (
    <article className="sl-panel overflow-hidden">
      <div className="
        flex flex-wrap items-center gap-2 border-b border-audit-border
        bg-audit-soft px-5 py-4
      ">
        <span className="sl-metadata mr-auto text-audit-muted">
          FINDING / {finding.id.slice(0, 8).toUpperCase()}
        </span>
        <Badge classification={finding.classification} />
        <FindingStatusBadge finding={finding} />
        {finding.workflow_status === "Needs Review" ? (
          <span className="sl-review-stamp text-audit-amber">Professional review required</span>
        ) : null}
        {finding.is_demo ? (
          <span className="
            sl-metadata inline-flex items-center rounded-sm border
            border-audit-border bg-audit-soft px-2.5 py-1 font-semibold
            text-audit-body
          ">
            Fictional demo data
          </span>
        ) : null}
      </div>

      <div className="
        grid gap-px bg-audit-border
        lg:grid-cols-2
      ">
        <section className="
          bg-white p-5
          sm:p-6
        ">
          <p className="sl-coordinate">E-01 / Client request</p>
          <blockquote className="
            mt-3 border-l-2 border-signal pl-4 text-base/7 text-ink
          ">{row.message.message_text}</blockquote>
          <p className="sl-metadata mt-4 text-audit-muted">
            {row.message.source.toUpperCase()}
            {row.message.sender ? ` · ${row.message.sender.toUpperCase()}` : ""}
            {row.message.message_date ? ` · ${row.message.message_date}` : ""}
          </p>
        </section>
        <section className="
          bg-bright-paper p-5
          sm:p-6
        ">
          <p className="sl-coordinate text-signal">E-02 / SOW evidence</p>
          <ul className="mt-3 space-y-3 text-sm/6 text-audit-body">
            {finding.relevant_sow_sections.length ? (
              finding.relevant_sow_sections.map((section) => <li key={section} className="
                border-l-2 border-audit-border pl-3
              ">{section}</li>)
            ) : (
              <li>No specific SOW section was returned.</li>
            )}
          </ul>
        </section>
      </div>

      <div className="
        p-5
        sm:p-6
      ">
        <section>
          <p className="sl-coordinate">F-01 / Analysis rationale</p>
          <h3 className="mt-3 text-base font-semibold">Commercial interpretation</h3>
          <p className="mt-2 max-w-4xl text-sm/6 text-audit-body">{finding.reasoning}</p>
          <p className="sl-metadata mt-3 text-audit-muted">
            AI CONFIDENCE {Math.round(finding.confidence_score * 100)}% · PROFESSIONAL REVIEW REQUIRED
          </p>
        </section>

      <dl className="mt-5 border-t border-ink">
        <div className="
          grid gap-2 border-b border-audit-border py-3
          sm:grid-cols-[3rem_minmax(10rem,1fr)_auto] sm:items-baseline
        ">
          <span className="sl-metadata text-audit-muted">L-01</span>
          <dt className="text-xs font-semibold text-audit-amber">POTENTIAL HOURS / AI</dt>
          <dd data-financial-value className="sl-editorial text-2xl">{finding.estimated_hours}</dd>
        </div>
        <div className="
          grid gap-2 border-b border-audit-border py-3
          sm:grid-cols-[3rem_minmax(10rem,1fr)_auto] sm:items-baseline
        ">
          <span className="sl-metadata text-audit-muted">L-02</span>
          <dt className="text-xs font-semibold text-audit-amber">POTENTIAL EXPOSURE / AI</dt>
          <dd data-financial-value className="sl-editorial text-2xl">{formatDollars(finding.estimated_revenue)}</dd>
        </div>
        <div className="
          grid gap-2 border-b border-audit-border py-3
          sm:grid-cols-[3rem_minmax(10rem,1fr)_auto] sm:items-baseline
        ">
          <span className="sl-metadata text-audit-muted">L-03</span>
          <dt className="text-xs font-semibold text-approved">APPROVED HOURS / PROFESSIONAL</dt>
          <dd data-financial-value className="sl-editorial text-2xl">
            {finding.approved_hours === null ? "Not set" : finding.approved_hours}
          </dd>
        </div>
        <div className="
          grid gap-2 border-b border-ink py-3
          sm:grid-cols-[3rem_minmax(10rem,1fr)_auto] sm:items-baseline
        ">
          <span className="sl-metadata text-audit-muted">L-04</span>
          <dt className="text-xs font-semibold text-approved">APPROVED AMOUNT / PROFESSIONAL</dt>
          <dd data-financial-value className="sl-editorial text-2xl">
            {finding.approved_amount_cents === null
              ? "Not set"
              : formatCents(finding.approved_amount_cents)}
          </dd>
        </div>
      </dl>

      <dl className="
        mt-3 grid gap-3
        sm:grid-cols-2
      ">
        <div>
          <dt className="text-sm text-audit-muted">Current decision</dt>
          <dd className="mt-1 text-base font-semibold">{finding.billing_decision}</dd>
        </div>
        <div>
          <dt className="text-sm text-audit-muted">Current status</dt>
          <dd className="mt-1 text-base font-semibold">{finding.workflow_status}</dd>
        </div>
      </dl>

      <section className="mt-5 border-l-2 border-signal bg-signal/5 p-4">
        <p className="sl-metadata text-signal">NEXT CONTROL ACTION</p>
        <h3 className="mt-2 text-base font-semibold text-signal">Recommended next step</h3>
        <p className="mt-1 text-sm/6 text-signal">{recommendedNextStep(finding)}</p>
      </section>

      <section className="mt-4">
        <h3 className="text-base font-semibold">Client-facing draft</h3>
        <p className="mt-1 text-sm text-audit-muted">
          Nothing is sent automatically. You copy and send this yourself if you want to.
        </p>
        <p className="
          mt-2 border border-audit-border bg-white p-3 text-sm/6
          whitespace-pre-wrap text-audit-body
        ">
          {finding.client_facing_explanation}
        </p>
      </section>

      {finding.internal_note ? (
        <section className="mt-4">
          <h3 className="text-base font-semibold">Internal note (private)</h3>
          <p className="mt-1 text-sm/6 text-audit-body">{finding.internal_note}</p>
        </section>
      ) : null}

      {canReview ? (
        <section className="mt-6 border-t border-audit-border pt-5">
          <FindingReviewForm key={`${finding.id}-${finding.version}`} finding={finding} />
        </section>
      ) : (
        <p className="
          mt-6 border-y border-audit-border bg-audit-soft px-4 py-3 text-sm
          text-audit-muted
        ">
          Read-only access. A Reviewer, Admin, or Owner must make billing decisions or edit this finding.
        </p>
      )}

      <details className="mt-5 border-y border-audit-border py-4">
        <summary className="cursor-pointer text-base font-semibold">
          History ({events.length} event{events.length === 1 ? "" : "s"})
        </summary>
        <div className="mt-3">
          <FindingHistory events={events} />
        </div>
      </details>
      </div>
    </article>
  );
}
