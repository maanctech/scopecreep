"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function GenerateReportButton({
  projectId,
  hasExistingReport
}: {
  projectId: string;
  hasExistingReport: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function generate() {
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/report`, {
        method: "POST"
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
