import { AlertTriangle } from "lucide-react";

export function Disclaimer() {
  return (
    <div className="
      flex gap-3 rounded-md border border-audit-border bg-audit-soft p-4 text-sm
      text-zinc-700
    ">
      <AlertTriangle className="mt-0.5 size-4 flex-none text-zinc-700" aria-hidden="true" />
      <p>
        AI-generated scope flags require human approval before billing clients, sending
        change orders, or changing invoices. This MVP never sends client messages automatically.
      </p>
    </div>
  );
}
