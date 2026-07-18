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

      router.push(`/app/projects/${encodeURIComponent(json.project.id)}?created=project`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to create project.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5 rounded-md border border-audit-border bg-white p-6 shadow-audit">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium">Client name</span>
          <input name="client_name" className="mt-2 w-full rounded-md border border-audit-border px-3 py-2" required />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Project name</span>
          <input name="project_name" className="mt-2 w-full rounded-md border border-audit-border px-3 py-2" required />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Hourly or blended rate</span>
          <input
            name="hourly_rate"
            inputMode="decimal"
            className="mt-2 w-full rounded-md border border-audit-border px-3 py-2"
            required
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Project value</span>
          <input
            name="project_value"
            inputMode="decimal"
            className="mt-2 w-full rounded-md border border-audit-border px-3 py-2"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-medium">Statement of Work</span>
        <textarea
          name="sow_text"
          rows={10}
          className="mt-2 w-full rounded-md border border-audit-border px-3 py-2"
          required
        />
      </label>

      {error ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex h-11 items-center justify-center rounded-md bg-ink px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Creating project..." : "Create project"}
      </button>
    </form>
  );
}
