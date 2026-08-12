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
          className="sl-field text-sm"
        >
          {REPORT_TYPES.map((type) => <option key={type}>{type}</option>)}
        </select>
      </label>
      <button
        type="button"
        onClick={generate}
        disabled={isSubmitting}
        className="sl-button-primary"
      >
        {isSubmitting
          ? "Generating report..."
          : hasExistingReport
            ? "Generate a fresh report"
            : "Generate report"}
      </button>
      <div aria-live="polite" role="status">
        {error ? <p className="text-sm text-critical">{error}</p> : null}
      </div>
    </div>
  );
}
