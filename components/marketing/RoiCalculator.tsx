"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

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
    const rate = toNumber(hourlyRate);
    const hours = toNumber(unbilledHours);
    const projects = toNumber(activeProjects);
    const value = toNumber(projectValue);
    const monthlyLeakage = rate * hours * projects;
    const annualLeakage = monthlyLeakage * 12;
    const low = Math.max(750, Math.round(monthlyLeakage * 0.1));
    const high = Math.max(1500, Math.round(monthlyLeakage * 0.2));

    return {
      monthlyLeakage,
      annualLeakage,
      serviceRange: `${money(low)}-${money(high)}/month`,
      projectRisk: value ? Math.round((monthlyLeakage / value) * 100) : 0
    };
  }, [activeProjects, hourlyRate, projectValue, unbilledHours]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_0.85fr]">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium">Average hourly or blended rate</span>
          <input
            className="mt-2 w-full rounded-md border border-audit-border px-3 py-2"
            inputMode="decimal"
            value={hourlyRate}
            onChange={(event) => setHourlyRate(event.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Unbilled hours per project/month</span>
          <input
            className="mt-2 w-full rounded-md border border-audit-border px-3 py-2"
            inputMode="decimal"
            value={unbilledHours}
            onChange={(event) => setUnbilledHours(event.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Active projects</span>
          <input
            className="mt-2 w-full rounded-md border border-audit-border px-3 py-2"
            inputMode="numeric"
            value={activeProjects}
            onChange={(event) => setActiveProjects(event.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Typical retainer or project value</span>
          <input
            className="mt-2 w-full rounded-md border border-audit-border px-3 py-2"
            inputMode="decimal"
            value={projectValue}
            onChange={(event) => setProjectValue(event.target.value)}
          />
        </label>
      </div>

      <div className="rounded-md border border-audit-border bg-white p-5 shadow-audit">
        <div className="text-sm text-audit-muted">Estimated monthly leakage</div>
        <div className="mt-2 text-3xl font-semibold">{money(result.monthlyLeakage)}</div>
        <div className="mt-5 grid gap-3 text-sm">
          <div className="flex justify-between border-b border-audit-border pb-2">
            <span>Annualized leakage</span>
            <strong>{money(result.annualLeakage)}</strong>
          </div>
          <div className="flex justify-between border-b border-audit-border pb-2">
            <span>Suggested service range</span>
            <strong>{result.serviceRange}</strong>
          </div>
          <div className="flex justify-between">
            <span>Monthly leakage vs. project value</span>
            <strong>{result.projectRisk}%</strong>
          </div>
        </div>
        <Link
          href="/request-audit"
          className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-md bg-ink px-4 text-sm font-semibold text-white hover:bg-zinc-800"
        >
          Request free audit
        </Link>
      </div>
    </div>
  );
}
