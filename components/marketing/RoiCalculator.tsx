"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { calculateRoiEstimate } from "@/lib/marketing/roi";

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(Number.isFinite(value) ? value : 0);
}

function toNumber(value: string) {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function RoiCalculator() {
  const [hourlyRate, setHourlyRate] = useState("150");
  const [unbilledHours, setUnbilledHours] = useState("12");
  const [activeProjects, setActiveProjects] = useState("4");
  const [projectValue, setProjectValue] = useState("25000");

  const result = useMemo(() => {
    return calculateRoiEstimate({
      hourlyRate: toNumber(hourlyRate),
      unbilledHours: toNumber(unbilledHours),
      activeProjects: toNumber(activeProjects),
      projectValue: toNumber(projectValue)
    });
  }, [activeProjects, hourlyRate, projectValue, unbilledHours]);

  return (
    <div className="
      grid overflow-hidden border border-ink/20 bg-bright-paper
      lg:grid-cols-[1.15fr_0.85fr]
    ">
      <div className="
        grid gap-x-6 p-5
        sm:grid-cols-2 sm:p-6
      ">
        <label className="
          border-b border-audit-border py-4
          first:pt-0
        ">
          <span className="sl-metadata text-audit-muted">01 / BLENDED RATE</span>
          <span className="mt-1 block text-sm font-medium text-audit-body">Average hourly or blended rate</span>
          <input
            className="sl-field mt-2"
            type="number"
            inputMode="decimal"
            min="0"
            max="10000"
            step="0.01"
            value={hourlyRate}
            onChange={(event) => setHourlyRate(event.target.value)}
          />
        </label>
        <label className="
          border-b border-audit-border py-4
          first:pt-0
        ">
          <span className="sl-metadata text-audit-muted">02 / UNPRICED LABOR</span>
          <span className="mt-1 block text-sm font-medium text-audit-body">Unbilled hours per project/month</span>
          <input
            className="sl-field mt-2"
            type="number"
            inputMode="decimal"
            min="0"
            max="1000"
            step="0.25"
            value={unbilledHours}
            onChange={(event) => setUnbilledHours(event.target.value)}
          />
        </label>
        <label className="py-4">
          <span className="sl-metadata text-audit-muted">03 / ACTIVE CASES</span>
          <span className="mt-1 block text-sm font-medium text-audit-body">Active projects</span>
          <input
            className="sl-field mt-2"
            type="number"
            inputMode="numeric"
            min="0"
            max="1000"
            step="1"
            value={activeProjects}
            onChange={(event) => setActiveProjects(event.target.value)}
          />
        </label>
        <label className="py-4">
          <span className="sl-metadata text-audit-muted">04 / CONTRACT VALUE</span>
          <span className="mt-1 block text-sm font-medium text-audit-body">Typical retainer or project value</span>
          <input
            className="sl-field mt-2"
            type="number"
            inputMode="decimal"
            min="0"
            max="100000000"
            step="0.01"
            value={projectValue}
            onChange={(event) => setProjectValue(event.target.value)}
          />
        </label>
      </div>

      <div className="
        border-t border-signal/25 bg-signal/5 p-6 text-ink
        lg:border-t-0 lg:border-l
      ">
        <div className="sl-metadata text-audit-muted">CALCULATION / POTENTIAL ONLY</div>
        <div className="mt-8 text-sm text-audit-muted">Estimated monthly leakage</div>
        <div data-financial-value className="
          sl-editorial mt-1 text-5xl text-signal
        ">{money(result.monthlyLeakage)}</div>
        <div className="mt-7 grid gap-4 text-sm">
          <div className="
            flex justify-between gap-4 border-b border-audit-border pb-3
          ">
            <span className="text-audit-muted">Annualized leakage</span>
            <strong data-financial-value>{money(result.annualLeakage)}</strong>
          </div>
          <div className="
            flex justify-between gap-4 border-b border-audit-border pb-3
          ">
            <span className="text-audit-muted">Suggested service range</span>
            <strong className="text-right">
              {result.serviceLow === null || result.serviceHigh === null
                ? "Confirm leakage first"
                : `${money(result.serviceLow)}-${money(result.serviceHigh)}/month`}
            </strong>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-audit-muted">Monthly leakage vs. project value</span>
            <strong data-financial-value>{result.projectRisk}%</strong>
          </div>
        </div>
        <p className="mt-6 text-xs/5 text-audit-muted">
          Illustrative estimate only. It is not validated recovery, an approved charge, or a guarantee.
        </p>
        <Link
          href="/request-audit"
          className="sl-button-primary mt-6 w-full"
        >
          Request a free audit
        </Link>
      </div>
    </div>
  );
}
