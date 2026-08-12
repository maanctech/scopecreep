import { formatCents } from "@/lib/domain/money";
import type { BillingEvent } from "@/lib/types";

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

/**
 * Append-only history for one finding. Events are shown newest first and can
 * never be edited or deleted from the UI.
 */
export function FindingHistory({ events }: { events: BillingEvent[] }) {
  if (!events.length) {
    return <p className="text-sm text-audit-muted">No history recorded yet.</p>;
  }

  return (
    <ol className="space-y-3">
      {events.map((event) => (
        <li key={event.id} className="
          rounded-md border border-audit-border bg-white p-3 text-sm
        ">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-semibold">{event.event_type}</span>
            <span className="text-audit-muted">{formatTimestamp(event.created_at)}</span>
          </div>
          <div className="mt-1 space-y-1 leading-6 text-audit-body">
            {event.previous_status && event.new_status && event.previous_status !== event.new_status ? (
              <div>
                Status: {event.previous_status} to {event.new_status}
              </div>
            ) : null}
            {event.previous_decision &&
            event.new_decision &&
            event.previous_decision !== event.new_decision ? (
              <div>
                Decision: {event.previous_decision} to {event.new_decision}
              </div>
            ) : null}
            {event.previous_amount_cents !== event.new_amount_cents ? (
              <div>
                Amount: {event.previous_amount_cents === null ? "none" : formatCents(event.previous_amount_cents)}{" "}
                to {event.new_amount_cents === null ? "none" : formatCents(event.new_amount_cents)}
              </div>
            ) : event.amount_cents !== null ? (
              <div>Amount: {formatCents(event.amount_cents)}</div>
            ) : null}
            {event.note ? <div>Note: {event.note}</div> : null}
            <div className="text-audit-muted">Recorded by {event.actor}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}
