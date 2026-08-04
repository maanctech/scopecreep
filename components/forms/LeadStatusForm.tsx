"use client";

import { useState } from "react";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/types";

export function LeadStatusForm({ leadId, status }: { leadId: string; status: LeadStatus }) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onChange(event: React.ChangeEvent<HTMLSelectElement>) {
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/leads/${encodeURIComponent(leadId)}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: event.target.value })
      });
      const json = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(json.error || "Failed to update status.");
      }

      setSuccess("Saved");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to update status.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-1">
      <select
        aria-label="Lead status"
        defaultValue={status}
        onChange={onChange}
        disabled={isSubmitting}
        className="
          w-full rounded-md border border-audit-border px-2 py-1 text-sm
        "
      >
        {LEAD_STATUSES.map((item) => (
          <option key={item}>{item}</option>
        ))}
      </select>
      {success ? <div className="text-xs text-emerald-700">{success}</div> : null}
      {error ? <div className="text-xs text-red-700">{error}</div> : null}
    </div>
  );
}
