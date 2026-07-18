import type { Classification } from "@/lib/types";

const tones: Record<Classification, string> = {
  "In Scope": "border-emerald-200 bg-emerald-50 text-emerald-800",
  "Possibly In Scope": "border-amber-200 bg-amber-50 text-amber-800",
  "Out of Scope": "border-red-200 bg-red-50 text-red-800",
  "Needs Human Review": "border-zinc-300 bg-zinc-100 text-zinc-800"
};

export function Badge({ classification }: { classification: Classification }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold ${tones[classification]}`}
    >
      {classification}
    </span>
  );
}
