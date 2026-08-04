import {
  CheckCircle2,
  CircleDollarSign,
  CircleSlash,
  Eye,
  FileCheck,
  HandCoins,
  MessagesSquare,
  RotateCcw
} from "lucide-react";
import { findingDisplayLabel } from "@/lib/domain/findingTransitions";
import type { ScopeFinding } from "@/lib/types";

/**
 * Status is communicated with BOTH a text label and an icon, never color
 * alone, so it stays readable for color-blind and older users.
 */
const tones: Record<string, { className: string; Icon: typeof Eye }> = {
  "Needs Review": { className: "border-amber-300 bg-amber-50 text-amber-900", Icon: Eye },
  Billable: { className: "border-sky-300 bg-sky-50 text-sky-900", Icon: CircleDollarSign },
  "Included in Retainer": {
    className: "border-teal-300 bg-teal-50 text-teal-900",
    Icon: HandCoins
  },
  "Discuss With Client": {
    className: "border-violet-300 bg-violet-50 text-violet-900",
    Icon: MessagesSquare
  },
  Invoiced: { className: "border-blue-300 bg-blue-50 text-blue-900", Icon: FileCheck },
  Paid: { className: "border-emerald-300 bg-emerald-50 text-emerald-900", Icon: CheckCircle2 },
  "Courtesy / Not Billing": {
    className: "border-zinc-300 bg-zinc-100 text-zinc-800",
    Icon: RotateCcw
  },
  Rejected: { className: "border-red-300 bg-red-50 text-red-900", Icon: CircleSlash },
  "In Scope - No Action Needed": {
    className: "border-emerald-200 bg-emerald-50 text-emerald-900",
    Icon: CheckCircle2
  }
};

export function FindingStatusBadge({ finding }: { finding: ScopeFinding }) {
  const label = findingDisplayLabel(finding);
  const tone = tones[label] ?? tones["Needs Review"];
  const Icon = tone.Icon;

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm
        font-semibold
        ${tone.className}
      `}
    >
      <Icon className="size-4" aria-hidden="true" />
      {label}
    </span>
  );
}
