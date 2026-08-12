"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
      business_type: "Agency",
      team_size: String(form.get("team_size") || ""),
      average_project_value: "",
      hourly_rate: "",
      pain_point: "Not collected in the public qualification form.",
      consent_to_contact: form.get("consent_to_contact") === "on"
    };

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to submit audit request. Please try again.");
      }

      router.push("/onboarding?submitted=lead");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to submit audit request.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="
      sl-panel grid gap-5 p-5
      sm:p-6
    ">
      <div className="
        grid gap-4
        sm:grid-cols-2
      ">
        <label className="block">
          <span className="text-sm font-medium">Name</span>
          <input name="name" autoComplete="name" maxLength={120} className="
            sl-field mt-2
          " required />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Work email</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            maxLength={200}
            className="sl-field mt-2"
            required
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Company</span>
          <input name="company" autoComplete="organization" maxLength={160} className="
            sl-field mt-2
          " required />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Website</span>
          <input name="website" type="url" autoComplete="url" maxLength={240} placeholder="https://" className="
            sl-field mt-2
          " required />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Agency size</span>
          <select name="team_size" className="sl-field mt-2" required defaultValue="">
            <option value="" disabled>Select agency size</option>
            {teamSizes.map((size) => (
              <option key={size}>{size}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex items-start gap-3 text-sm text-audit-body">
        <input name="consent_to_contact" type="checkbox" className="mt-1 size-4" required />
        <span>I agree to be contacted about the free scope creep revenue leakage audit.</span>
      </label>

      <div aria-live="polite">
        {error ? <div className="
          rounded-md border border-critical/25 bg-critical/5 p-3 text-sm
          text-critical
        ">{error}</div> : null}
      </div>

      <button type="submit" disabled={isSubmitting} className="
        sl-button-primary w-full
      ">
        {isSubmitting ? "Saving request..." : "Request free audit"}
      </button>
    </form>
  );
}
