"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ImportPreview } from "@/lib/ingestion/types";

export function CommunicationImportForm({
  projects,
}: {
  projects: Array<{ id: string; label: string }>;
}) {
  const router = useRouter();
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [payload, setPayload] = useState<{
    projectId: string;
    format: "Text" | "CSV" | "JSON" | "Transcript";
    content: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ error?: string; success?: string }>(
    {},
  );

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice({});
    setPreview(null);
    const form = new FormData(event.currentTarget);
    const file = form.get("file");
    const next = {
      projectId: String(form.get("projectId")),
      format: String(form.get("format")) as
        | "Text"
        | "CSV"
        | "JSON"
        | "Transcript",
      content:
        file instanceof File && file.size
          ? await file.text()
          : String(form.get("content") || ""),
    };

    try {
      const response = await fetch("/api/ingestion/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...next, action: "preview" }),
      });
      const data = (await response.json()) as {
        preview?: ImportPreview;
        error?: string;
      };

      if (!response.ok || !data.preview)
        throw new Error(data.error || "The import could not be previewed.");

      setPayload(next);
      setPreview(data.preview);
    } catch (error) {
      setNotice({
        error:
          error instanceof Error
            ? error.message
            : "The import could not be previewed.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function confirmImport() {
    if (!payload || !preview) return;

    setBusy(true);
    setNotice({});

    try {
      const response = await fetch("/api/ingestion/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, action: "import" }),
      });
      const data = (await response.json()) as {
        result?: { inserted: number; duplicates: number; repeated: boolean };
        error?: string;
      };

      if (!response.ok || !data.result)
        throw new Error(data.error || "The import could not be saved.");

      setNotice({
        success: data.result.repeated
          ? "This exact import was already completed; no duplicate messages were created."
          : `${data.result.inserted} messages imported; ${data.result.duplicates} duplicates skipped. No analysis was started.`,
      });
      setPreview(null);
      setPayload(null);
      router.refresh();
    } catch (error) {
      setNotice({
        error:
          error instanceof Error
            ? error.message
            : "The import could not be saved.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="sl-panel p-6">
      <h2 className="text-xl font-semibold">1. Choose and preview</h2>
      <form onSubmit={submit} className="mt-5 grid gap-4">
        <label>
          <span className="text-sm font-medium">Project</span>
          <select
            name="projectId"
            required
            className="mt-2 w-full rounded-md border border-audit-border p-3"
          >
            <option value="">Select a project</option>
            {projects.map((project) => (
              <option value={project.id} key={project.id}>
                {project.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="text-sm font-medium">Import format</span>
          <select
            name="format"
            className="mt-2 w-full rounded-md border border-audit-border p-3"
          >
            <option>Text</option>
            <option>CSV</option>
            <option>JSON</option>
            <option>Transcript</option>
          </select>
        </label>
        <label>
          <span className="text-sm font-medium">Paste communications</span>
          <textarea
            name="content"
            rows={8}
            className="mt-2 w-full rounded-md border border-audit-border p-3"
            placeholder="For multiple text messages, place --- on a separate line between messages."
          />
        </label>
        <label>
          <span className="text-sm font-medium">
            Or choose a CSV, JSON, or text file
          </span>
          <input
            name="file"
            type="file"
            accept=".csv,.json,.txt,.vtt,.srt,text/csv,application/json,text/plain,text/vtt"
            className="
              mt-2 block w-full rounded-md border border-audit-border p-3
            "
          />
        </label>
        <button
          disabled={busy}
            className="sl-button-primary"
        >
          {busy ? "Reading import..." : "Preview import"}
        </button>
      </form>
      {notice.error ? (
        <div
          role="alert"
          className="
            mt-4 rounded-md border border-critical/25 bg-critical/5 p-4 text-sm
            text-critical
          "
        >
          {notice.error}
        </div>
      ) : null}
      {notice.success ? (
        <div
          role="status"
          className="
            mt-4 rounded-md border border-signal/25 bg-signal/5 p-4 text-sm
            text-signal
          "
        >
          {notice.success}
        </div>
      ) : null}
      {preview ? (
        <div className="mt-8 border-t border-audit-border pt-6">
          <h2 className="text-xl font-semibold">
            2. Confirm recognized messages
          </h2>
          <p className="mt-2 text-sm text-audit-body">
            {preview.messages.length} valid messages recognized. Review this
            sample before saving.
          </p>
          {preview.warnings.length ? (
            <ul className="mt-3 list-disc pl-5 text-sm text-audit-amber">
              {preview.warnings.slice(0, 10).map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
          <div className="
            mt-4 divide-y divide-audit-border rounded-md border
            border-audit-border
          ">
            {preview.messages.slice(0, 5).map((message, index) => (
              <article
                className="p-4"
                key={`${message.externalId || "row"}-${index}`}
              >
                <div className="text-sm font-semibold">
                  {message.sender ||
                    message.senderEmail ||
                    "Sender not provided"}
                </div>
                <p className="mt-2 text-sm whitespace-pre-wrap text-audit-body">
                  {message.text.slice(0, 500)}
                </p>
              </article>
            ))}
          </div>
          <button
            type="button"
            onClick={confirmImport}
            disabled={busy}
            className="sl-button-primary mt-4"
          >
            {busy
              ? "Importing..."
              : `Import ${preview.messages.length} messages`}
          </button>
          <p className="mt-3 text-sm text-audit-muted">
            This saves private source records only. ScopeLedger will not analyze
            or send anything automatically.
          </p>
        </div>
      ) : null}
    </section>
  );
}
