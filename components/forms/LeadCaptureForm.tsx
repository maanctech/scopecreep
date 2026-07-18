"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const businessTypes = ["Agency", "Software shop", "Consultancy", "Law firm", "Other service firm"];
const teamSizes = ["1-5", "6-10", "11-25", "26-50", "51-100", "100+"];

export function LeadCaptureForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get("name") || ""),
      email: String(form.get("email") || ""),
      company: String(form.get("company") || ""),
      website: String(form.get("website") || ""),
      business_type: String(form.get("business_type") || ""),
      team_size: String(form.get("team_size") || ""),
      average_project_value: String(form.get("average_project_value") || ""),
      hourly_rate: String(form.get("hourly_rate") || ""),
      pain_point: String(form.get("pain_point") || ""),
      consent_to_contact: form.get("consent_to_contact") === "on"
    };

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = (await response.json()) as { lead?: { id: string }; error?: string };
      if (!response.ok || !json.lead) {
        throw new Error(json.error || "Failed to submit audit request.");
      }

      router.push(`/onboarding?leadId=${encodeURIComponent(json.lead.id)}&submitted=lead`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to submit audit request.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5 rounded-md border border-audit-border bg-white p-6 shadow-audit">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium">Name</span>
          <input name="name" className="mt-2 w-full rounded-md border border-audit-border px-3 py-2" required />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Email</span>
          <input
            name="email"
            type="email"
            className="mt-2 w-full rounded-md border border-audit-border px-3 py-2"
            required
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Company</span>
          <input name="company" className="mt-2 w-full rounded-md border border-audit-border px-3 py-2" required />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Website</span>
          <input name="website" className="mt-2 w-full rounded-md border border-audit-border px-3 py-2" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Type of business</span>
          <select name="business_type" className="mt-2 w-full rounded-md border border-audit-border px-3 py-2" required>
            {businessTypes.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Team size</span>
          <select name="team_size" className="mt-2 w-full rounded-md border border-audit-border px-3 py-2" required>
            {teamSizes.map((size) => (
              <option key={size}>{size}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Average project value</span>
          <input
            name="average_project_value"
            inputMode="decimal"
            className="mt-2 w-full rounded-md border border-audit-border px-3 py-2"
            placeholder="45000"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Hourly or blended rate</span>
          <input
            name="hourly_rate"
            inputMode="decimal"
            className="mt-2 w-full rounded-md border border-audit-border px-3 py-2"
            placeholder="150"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-medium">Biggest scope creep pain point</span>
        <textarea
          name="pain_point"
          rows={5}
          className="mt-2 w-full rounded-md border border-audit-border px-3 py-2"
          required
        />
      </label>

      <label className="flex items-start gap-3 text-sm text-zinc-700">
        <input name="consent_to_contact" type="checkbox" className="mt-1 h-4 w-4" required />
        <span>I agree to be contacted about the free scope creep revenue leakage audit.</span>
      </label>

      {error ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex h-11 items-center justify-center rounded-md bg-ink px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Saving request..." : "Request free audit"}
      </button>
    </form>
  );
}
