import type { Classification } from "@/lib/types";

const tones: Record<Classification, string> = {
  "In Scope": "border-approved/30 bg-approved/5 text-approved",
  "Possibly In Scope": "border-audit-amber/30 bg-audit-amber/5 text-audit-amber",
  "Out of Scope": "border-audit-amber/40 bg-audit-amber/8 text-audit-amber",
  "Needs Human Review": "border-audit-border bg-audit-soft text-audit-muted"
};

export function Badge({ classification }: { classification: Classification }) {
  return (
    <span
      className={`
        sl-metadata inline-flex items-center rounded-sm border px-2.5 py-1
        font-semibold
        ${tones[classification]}
      `}
    >
      {classification}
    </span>
  );
}
