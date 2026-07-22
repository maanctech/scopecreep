import { Badge } from "@/components/Badge";
import { FindingHistory } from "@/components/FindingHistory";
import { FindingStatusBadge } from "@/components/FindingStatusBadge";
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
      <article className="rounded-md border border-audit-border bg-white p-5 shadow-audit">
        <p className="text-sm text-audit-muted">No analysis saved for this message.</p>
        <p className="mt-2 text-base">{row.message.message_text}</p>
      </article>
    );
  }

  return (
    <article className="rounded-md border border-audit-border bg-white p-6 shadow-audit">
      <div className="flex flex-wrap items-center gap-2">
        <Badge classification={finding.classification} />
        <FindingStatusBadge finding={finding} />
        {finding.is_demo ? (
          <span className="inline-flex items-center rounded-md border border-zinc-300 bg-zinc-100 px-2.5 py-1 text-sm font-semibold text-zinc-700">
            Fictional demo data
          </span>
        ) : null}
      </div>

      <section className="mt-4">
        <h3 className="text-base font-semibold">Client request</h3>
        <p className="mt-1 text-base leading-7 text-ink">{row.message.message_text}</p>
        <p className="mt-1 text-sm text-audit-muted">
          {row.message.source}
          {row.message.sender ? ` from ${row.message.sender}` : ""}
          {row.message.message_date ? ` on ${row.message.message_date}` : ""}
        </p>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section>
          <h3 className="text-base font-semibold">Why this may be outside the agreement</h3>
          <p className="mt-2 text-sm leading-6 text-zinc-700">{finding.reasoning}</p>
          <p className="mt-2 text-sm text-audit-muted">
            AI confidence: {Math.round(finding.confidence_score * 100)}%. AI suggestions require
            human review before billing.
          </p>
        </section>
        <section>
          <h3 className="text-base font-semibold">Evidence from the SOW</h3>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-zinc-700">
            {finding.relevant_sow_sections.length ? (
              finding.relevant_sow_sections.map((section) => <li key={section}>{section}</li>)
            ) : (
              <li>No specific SOW section was returned.</li>
            )}
          </ul>
        </section>
      </div>

      <dl className="mt-5 grid gap-3 rounded-md border border-audit-border bg-audit-soft p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-sm text-audit-muted">Suggested hours (AI)</dt>
          <dd className="mt-1 text-lg font-semibold">{finding.estimated_hours}</dd>
        </div>
        <div>
          <dt className="text-sm text-audit-muted">Suggested amount (AI)</dt>
          <dd className="mt-1 text-lg font-semibold">{formatDollars(finding.estimated_revenue)}</dd>
        </div>
        <div>
          <dt className="text-sm text-audit-muted">Your approved hours</dt>
          <dd className="mt-1 text-lg font-semibold">
            {finding.approved_hours === null ? "Not set" : finding.approved_hours}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-audit-muted">Your approved amount</dt>
          <dd className="mt-1 text-lg font-semibold">
            {finding.approved_amount_cents === null
              ? "Not set"
              : formatCents(finding.approved_amount_cents)}
          </dd>
        </div>
      </dl>

      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-audit-muted">Current decision</dt>
          <dd className="mt-1 text-base font-semibold">{finding.billing_decision}</dd>
        </div>
        <div>
          <dt className="text-sm text-audit-muted">Current status</dt>
          <dd className="mt-1 text-base font-semibold">{finding.workflow_status}</dd>
        </div>
      </dl>

      <section className="mt-4 rounded-md border border-sky-200 bg-sky-50 p-4">
        <h3 className="text-base font-semibold text-sky-900">Recommended next step</h3>
        <p className="mt-1 text-sm leading-6 text-sky-900">{recommendedNextStep(finding)}</p>
      </section>

      <section className="mt-4">
        <h3 className="text-base font-semibold">Client-facing draft</h3>
        <p className="mt-1 text-sm text-audit-muted">
          Nothing is sent automatically. You copy and send this yourself if you want to.
        </p>
        <p className="mt-2 whitespace-pre-wrap rounded-md border border-audit-border bg-white p-3 text-sm leading-6 text-zinc-700">
          {finding.client_facing_explanation}
        </p>
      </section>

      {finding.internal_note ? (
        <section className="mt-4">
          <h3 className="text-base font-semibold">Internal note (private)</h3>
          <p className="mt-1 text-sm leading-6 text-zinc-700">{finding.internal_note}</p>
        </section>
      ) : null}

      {canReview ? (
        <section className="mt-6 border-t border-audit-border pt-5">
          <FindingReviewForm key={`${finding.id}-${finding.version}`} finding={finding} />
        </section>
      ) : (
        <p className="mt-6 rounded-md border border-audit-border bg-audit-soft p-4 text-sm text-audit-muted">
          Read-only access. A Reviewer, Admin, or Owner must make billing decisions or edit this finding.
        </p>
      )}

      <details className="mt-5 rounded-md border border-audit-border p-4">
        <summary className="cursor-pointer text-base font-semibold">
          History ({events.length} event{events.length === 1 ? "" : "s"})
        </summary>
        <div className="mt-3">
          <FindingHistory events={events} />
        </div>
      </details>
    </article>
  );
}
