"use client";

import { useState } from "react";
import {
  Calculator,
  Check,
  FileSearch,
  FileText,
  HandCoins,
  MessageSquareText,
  ShieldCheck,
} from "lucide-react";

const stages = [
  {
    reference: "01 / 10:42",
    title: "Quick request received",
    detail: "Add role-based permissions before launch. The client frames it as an extension of existing login work.",
    icon: MessageSquareText,
  },
  {
    reference: "02 / E-02",
    title: "Relevant exclusion located",
    detail: "§ 3.2 includes one standard role and expressly excludes administrative permissions and role-based access controls.",
    icon: FileSearch,
  },
  {
    reference: "03 / LABOR",
    title: "28 hours estimated",
    detail: "Permission model, interface states, authorization logic, migration, QA, and stakeholder review are included in the estimate.",
    icon: Calculator,
  },
  {
    reference: "04 / EXPOSURE",
    title: "$4,900 potential",
    detail: "Twenty-eight estimated hours multiplied by the project’s $175 blended rate. This is not an approved amount.",
    icon: HandCoins,
  },
  {
    reference: "05 / AUTHORITY",
    title: "Professional decision required",
    detail: "The project lead validates the evidence and decides whether to bill, discuss, absorb, or reject the finding.",
    icon: ShieldCheck,
  },
  {
    reference: "06 / DRAFT",
    title: "Change-order language prepared",
    detail: "A client-facing explanation cites the agreed boundary and can use only professional-approved hours and amounts.",
    icon: FileText,
  },
  {
    reference: "07 / CONTROL",
    title: "Nothing sent automatically",
    detail: "The finding remains an internal audit record until the professional chooses what to do outside ScopeLedger.",
    icon: Check,
  },
] as const;

export function MissedRequestInvestigation() {
  const [activeStage, setActiveStage] = useState(0);
  const active = stages[activeStage];

  return (
    <div className="border-y border-ink/20">
      <div className="overflow-x-auto" aria-label="Anatomy of a missed client request">
        <ol className="grid min-w-[1050px] grid-cols-7">
          {stages.map((stage, index) => {
            const Icon = stage.icon;
            const activeItem = activeStage === index;

            return (
              <li key={stage.reference} className="
                border-r border-audit-border
                last:border-r-0
              ">
                <button
                  type="button"
                  onClick={() => setActiveStage(index)}
                  onFocus={() => setActiveStage(index)}
                  aria-pressed={activeItem}
                  className={`
                    relative flex min-h-52 w-full flex-col items-start p-4
                    text-left transition-all duration-200 ease-out
                    ${activeItem ? `
                      bg-signal/5 text-ink ring-1 ring-signal ring-inset
                    ` : `
                      bg-bright-paper
                      hover:bg-audit-soft
                    `}
                  `}
                >
                  <span className={`
                    sl-metadata
                    ${activeItem ? `text-signal` : `text-audit-muted`}
                  `}>
                    {stage.reference}
                  </span>
                  <Icon className={`
                    mt-8 size-5
                    ${activeItem ? `text-audit-amber` : `text-audit-muted`}
                  `} aria-hidden="true" />
                  <span className="mt-auto pt-6 text-sm font-semibold">{stage.title}</span>
                  {activeItem ? <span className="
                    absolute inset-x-0 bottom-0 h-0.5 bg-signal
                  " /> : null}
                </button>
              </li>
            );
          })}
        </ol>
      </div>
      <div key={active.reference} className="
        grid gap-5 bg-audit-soft p-5
        motion-safe:animate-[audit-reveal_200ms_ease-out]
        sm:grid-cols-[9rem_minmax(0,1fr)] sm:p-6
      ">
        <p className="sl-coordinate">Selected evidence</p>
        <div>
          <h3 className="sl-editorial text-2xl text-ink">{active.title}</h3>
          <p className="mt-2 max-w-3xl text-sm/6 text-audit-body">{active.detail}</p>
        </div>
      </div>
    </div>
  );
}
