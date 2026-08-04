"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MAX_MESSAGE_LENGTH, MAX_SOW_LENGTH } from "@/lib/limits";

export function OnboardingForm({ leadId }: { leadId?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const form = new FormData(event.currentTarget);
    const payload = {
      lead_id: leadId || null,
      client_name: String(form.get("client_name") || ""),
      project_value: String(form.get("project_value") || ""),
      hourly_rate: String(form.get("hourly_rate") || ""),
      sow_text: String(form.get("sow_text") || ""),
      message_export_text: String(form.get("message_export_text") || ""),
      suspected_scope_creep_notes: String(form.get("suspected_scope_creep_notes") || "")
    };

    try {
      const response = await fetch("/api/audit-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to submit audit intake. Please try again.");
      }

      router.replace("/onboarding?submitted=audit");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to submit audit intake.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="
      grid gap-5 rounded-md border border-audit-border bg-white p-6 shadow-audit
    ">
      <div className="
        grid gap-4
        sm:grid-cols-3
      ">
        <label className="
          block
          sm:col-span-1
        ">
          <span className="text-sm font-medium">Client name</span>
          <input name="client_name" maxLength={160} className="
            mt-2 w-full rounded-md border border-audit-border px-3 py-2
          " required />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Hourly or blended rate</span>
          <input
            name="hourly_rate"
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            className="
              mt-2 w-full rounded-md border border-audit-border px-3 py-2
            "
            required
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Project value</span>
          <input
            name="project_value"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            className="
              mt-2 w-full rounded-md border border-audit-border px-3 py-2
            "
          />
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-medium">Statement of Work</span>
        <textarea
          name="sow_text"
          rows={8}
          maxLength={MAX_SOW_LENGTH}
          className="
            mt-2 w-full rounded-md border border-audit-border px-3 py-2
          "
          required
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium">Client message exports or summaries</span>
        <textarea
          name="message_export_text"
          rows={8}
          maxLength={MAX_MESSAGE_LENGTH * 6}
          className="
            mt-2 w-full rounded-md border border-audit-border px-3 py-2
          "
          required
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium">Notes about suspected out-of-scope work</span>
        <textarea
          name="suspected_scope_creep_notes"
          rows={4}
          maxLength={2000}
          className="
            mt-2 w-full rounded-md border border-audit-border px-3 py-2
          "
        />
      </label>

      <div aria-live="polite">
        {error ? <div className="
          rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700
        ">{error}</div> : null}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="
          inline-flex h-11 items-center justify-center rounded-md bg-ink px-4
          text-sm font-semibold text-white
          hover:bg-zinc-800
          disabled:cursor-not-allowed disabled:opacity-60
        "
      >
        {isSubmitting ? "Saving intake..." : "Create audit workspace"}
      </button>
    </form>
  );
}
