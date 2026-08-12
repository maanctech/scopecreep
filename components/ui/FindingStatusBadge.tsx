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

const tones: Record<string, { className: string; Icon: typeof Eye }> = {
  "Needs Review": { className: "border-audit-amber/40 bg-audit-amber/8 text-audit-amber", Icon: Eye },
  Billable: { className: "border-approved/30 bg-approved/5 text-approved", Icon: CircleDollarSign },
  "Included in Retainer": {
    className: "border-approved/30 bg-approved/5 text-approved",
    Icon: HandCoins
  },
  "Discuss With Client": {
    className: "border-audit-amber/40 bg-audit-amber/8 text-audit-amber",
    Icon: MessagesSquare
  },
  Invoiced: { className: "border-approved/30 bg-approved/5 text-approved", Icon: FileCheck },
  Paid: { className: "border-approved/30 bg-approved/5 text-approved", Icon: CheckCircle2 },
  "Courtesy / Not Billing": {
    className: "border-audit-border bg-audit-soft text-audit-muted",
    Icon: RotateCcw
  },
  Rejected: { className: "border-audit-border bg-audit-soft text-audit-muted", Icon: CircleSlash },
  "In Scope - No Action Needed": {
    className: "border-audit-border bg-audit-soft text-audit-muted",
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
        sl-metadata inline-flex items-center gap-1.5 rounded-sm border px-2.5
        py-1 font-semibold
        ${tone.className}
      `}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {label}
    </span>
  );
}
