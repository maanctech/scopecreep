"use client";

import { useState } from "react";
import {
  ArrowDown,
  Check,
  FileText,
  MessageSquareText,
  ScanSearch,
} from "lucide-react";

const evidence = [
  {
    reference: "E-01 / CLIENT REQUEST",
    coordinate: "SLACK · MAR 14 · 10:42 AM",
    title: "Request received",
    content:
      "Could we also add role-based permissions before launch? It should be a quick extension of the existing login.",
    icon: MessageSquareText,
  },
  {
    reference: "E-02 / CONTRACT BOUNDARY",
    coordinate: "SOW v2 · § 3.2 / EXCLUSIONS",
    title: "Clause located",
    content:
      "Authentication includes one standard user role. Administrative permissions and role-based access controls are excluded.",
    icon: FileText,
  },
] as const;

export function EvidenceTrace() {
  const [focus, setFocus] = useState(0);

  return (
    <div className="
      border border-ink/20 bg-bright-paper
      shadow-[8px_8px_0_rgba(16,18,20,0.06)]
    ">
      <div className="
        flex items-center justify-between border-b border-audit-border
        bg-audit-soft px-4 py-3
      ">
        <div className="flex items-center gap-3">
          <span className="size-2 bg-audit-amber" aria-hidden="true" />
          <span className="sl-metadata font-semibold text-ink">CASE SL-2048</span>
        </div>
        <span className="sl-review-stamp text-audit-amber">Review required</span>
      </div>

      <div className="
        relative p-4
        sm:p-5
      ">
        <div className="
          absolute top-5 bottom-38 left-[2.15rem] w-px origin-top bg-signal
          motion-safe:animate-[audit-trace_400ms_ease-out]
          sm:left-[2.4rem]
        " aria-hidden="true" />

        <div className="space-y-3">
          {evidence.map((item, index) => {
            const Icon = item.icon;
            const active = focus === index;

            return (
              <button
                key={item.reference}
                type="button"
                onClick={() => setFocus(index)}
                aria-pressed={active}
                className={`
                  relative grid w-full grid-cols-[2.25rem_minmax(0,1fr)] gap-3
                  border p-3 text-left transition-all duration-200 ease-out
                  sm:grid-cols-[2.75rem_minmax(0,1fr)] sm:p-4
                  ${active ? `translate-x-1 border-signal bg-signal/5` : `
                    border-audit-border bg-bright-paper
                    hover:border-audit-border
                  `}
                `}
              >
                <span className="
                  relative z-10 flex size-7 items-center justify-center border
                  border-audit-border bg-bright-paper text-signal
                ">
                  <Icon className="size-3.5" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="sl-metadata block text-signal">{item.reference}</span>
                  <span className="mt-2 block text-sm font-semibold text-ink">{item.title}</span>
                  <span className="mt-1 block text-sm/6 text-audit-body">“{item.content}”</span>
                  <span className="sl-metadata mt-3 block text-audit-muted">{item.coordinate}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="
          relative ml-[1.05rem] h-7 border-l border-signal
          sm:ml-[1.3rem]
        " aria-hidden="true">
          <ArrowDown className="absolute -bottom-1 -left-2 size-4 text-signal" />
        </div>

        <section className="
          ml-0 border border-signal/25 bg-signal/5 p-4 text-ink
          motion-safe:animate-[audit-reveal_250ms_ease-out]
          sm:ml-9 sm:p-5
        ">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="sl-metadata text-audit-muted">F-01 / SCOPE FINDING</p>
              <div className="mt-3 flex items-center gap-2">
                <ScanSearch className="size-4 text-audit-amber" aria-hidden="true" />
                <h3 className="text-lg font-semibold">Out of scope</h3>
              </div>
            </div>
            <span className="sl-review-stamp text-audit-amber">Awaiting professional review</span>
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-px bg-audit-border">
            <div className="bg-bright-paper py-3 pr-3">
              <dt className="sl-metadata text-audit-muted">ESTIMATED EXPOSURE</dt>
              <dd data-financial-value className="
                sl-editorial mt-1 text-3xl text-audit-amber
              ">$4,900</dd>
            </div>
            <div className="bg-bright-paper py-3 pl-3">
              <dt className="sl-metadata text-audit-muted">EVIDENCE CONFIDENCE</dt>
              <dd data-financial-value className="sl-editorial mt-1 text-3xl">94%</dd>
            </div>
          </dl>
          <p className="mt-4 flex items-start gap-2 text-xs/5 text-audit-muted">
            <Check className="mt-0.5 size-3.5 shrink-0 text-approved" aria-hidden="true" />
            No client action taken. A professional decides whether any amount is billable.
          </p>
        </section>
      </div>
    </div>
  );
}
