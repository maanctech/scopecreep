"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ProjectForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const form = new FormData(event.currentTarget);
    const payload = {
      client_name: String(form.get("client_name") || ""),
      project_name: String(form.get("project_name") || ""),
      hourly_rate: String(form.get("hourly_rate") || ""),
      project_value: String(form.get("project_value") || ""),
      sow_text: String(form.get("sow_text") || "")
    };

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = (await response.json()) as { project?: { id: string }; error?: string };

      if (!response.ok || !json.project) {
        throw new Error(json.error || "Failed to create project.");
      }

      router.push(`/app/projects/${encodeURIComponent(json.project.id)}/sow?created=project`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to create project.");
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
          <span className="text-sm font-medium">Client name</span>
          <input name="client_name" className="sl-field mt-2" required />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Project name</span>
          <input name="project_name" className="sl-field mt-2" required />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Hourly or blended rate</span>
          <input
            name="hourly_rate"
            inputMode="decimal"
            className="sl-field mt-2"
            required
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Project value</span>
          <input
            name="project_value"
            inputMode="decimal"
            className="sl-field mt-2"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-medium">Statement of Work</span>
        <textarea
          name="sow_text"
          rows={10}
          className="sl-field mt-2"
          required
        />
      </label>

      {error ? <div className="
        rounded-md border border-critical/25 bg-critical/5 p-3 text-sm
        text-critical
      ">{error}</div> : null}

      <button type="submit" disabled={isSubmitting} className="
        sl-button-primary
      ">
        {isSubmitting ? "Creating project..." : "Create project"}
      </button>
    </form>
  );
}
