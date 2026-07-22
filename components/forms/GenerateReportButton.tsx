"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { REPORT_TYPES, type ReportType } from "@/lib/types";

export function GenerateReportButton({
  projectId,
  hasExistingReport,
  initialReportType = "Internal Scope Audit"
}: {
  projectId: string;
  hasExistingReport: boolean;
  initialReportType?: ReportType;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reportType, setReportType] = useState<ReportType>(initialReportType);

  async function generate() {
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportType })
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(json.error || "The report could not be generated.");
      }
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "The report could not be generated."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-2">
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Report type</span>
        <select
          value={reportType}
          onChange={(event) => setReportType(event.target.value as ReportType)}
          disabled={isSubmitting}
          className="min-h-11 w-full rounded-md border border-audit-border bg-white px-3 text-sm"
        >
          {REPORT_TYPES.map((type) => <option key={type}>{type}</option>)}
        </select>
      </label>
      <button
        type="button"
        onClick={generate}
        disabled={isSubmitting}
        className="inline-flex h-11 items-center justify-center rounded-md bg-ink px-5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting
          ? "Generating report..."
          : hasExistingReport
            ? "Generate a fresh report"
            : "Generate report"}
      </button>
      <div aria-live="polite" role="status">
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
      </div>
    </div>
  );
}
