import { AlertTriangle } from "lucide-react";

export function Disclaimer() {
  return (
    <div className="
      flex gap-3 border-y border-audit-amber/40 bg-audit-amber/5 px-4 py-3
      text-sm/6 text-ink
    ">
      <AlertTriangle className="mt-0.5 size-4 flex-none text-audit-amber" aria-hidden="true" />
      <p>
        AI-generated scope flags require human approval before billing clients, sending
        change orders, or changing invoices. This MVP never sends client messages automatically.
      </p>
    </div>
  );
}
