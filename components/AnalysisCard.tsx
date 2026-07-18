import { Badge } from "@/components/Badge";
import type { MessageWithAnalysis } from "@/lib/types";

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

export function AnalysisCard({ row }: { row: MessageWithAnalysis }) {
  const analysis = row.analysis;

  if (!analysis) {
    return (
      <article className="rounded-md border border-audit-border bg-white p-5 shadow-audit">
        <p className="text-sm text-audit-muted">No analysis saved for this message.</p>
        <p className="mt-2 text-sm">{row.message.message_text}</p>
      </article>
    );
  }

  return (
    <article className="rounded-md border border-audit-border bg-white p-5 shadow-audit">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge classification={analysis.classification} />
          </div>
          <p className="mt-3 text-base font-medium text-ink">{row.message.message_text}</p>
          <p className="mt-2 text-xs text-audit-muted">
            {row.message.source}
            {row.message.sender ? ` from ${row.message.sender}` : ""}
            {row.message.message_date ? ` on ${row.message.message_date}` : ""}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-right sm:min-w-72">
          <div className="rounded-md border border-audit-border p-3">
            <div className="text-xs text-audit-muted">Confidence</div>
            <div className="mt-1 text-sm font-semibold">{Math.round(analysis.confidence_score * 100)}%</div>
          </div>
          <div className="rounded-md border border-audit-border p-3">
            <div className="text-xs text-audit-muted">Hours</div>
            <div className="mt-1 text-sm font-semibold">{analysis.estimated_hours}</div>
          </div>
          <div className="rounded-md border border-audit-border p-3">
            <div className="text-xs text-audit-muted">Revenue</div>
            <div className="mt-1 text-sm font-semibold">{money(analysis.estimated_revenue)}</div>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <section>
          <h3 className="text-sm font-semibold">Reasoning</h3>
          <p className="mt-2 text-sm leading-6 text-zinc-700">{analysis.reasoning}</p>
        </section>
        <section>
          <h3 className="text-sm font-semibold">SOW Evidence</h3>
          <ul className="mt-2 space-y-2 text-sm leading-6 text-zinc-700">
            {analysis.relevant_sow_sections.length ? (
              analysis.relevant_sow_sections.map((section) => <li key={section}>{section}</li>)
            ) : (
              <li>No specific SOW section returned.</li>
            )}
          </ul>
        </section>
      </div>

      <section className="mt-5 rounded-md border border-audit-border bg-audit-soft p-4">
        <h3 className="text-sm font-semibold">Suggested Change Order Draft</h3>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-700">
          {analysis.suggested_change_order}
        </p>
      </section>

      <div className="mt-4 flex flex-wrap gap-3 text-xs text-audit-muted">
        <span>Request type: {analysis.request_type}</span>
        {analysis.internal_note ? <span>Internal note: {analysis.internal_note}</span> : null}
      </div>
    </article>
  );
}
