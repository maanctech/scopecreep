"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  AnalysisJobRow,
  AnalysisMessageRow,
} from "@/lib/analysisJobs/service";

type Workspace = {
  project: Record<string, unknown>;
  approvedContext: {
    sowVersionId: string;
    boundaryMapId: string;
    boundaryItemCount: number;
  } | null;
  boundaryError: string | null;
  messages: AnalysisMessageRow[];
  jobs: AnalysisJobRow[];
};

function displayDate(value: string | Date | null) {
  return value ? new Date(value).toLocaleString() : "Date not provided";
}

export function AnalysisWorkspaceClient({
  projectId,
  workspace,
}: {
  projectId: string;
  workspace: Workspace;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [source, setSource] = useState("All");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ error?: string; success?: string }>(
    {},
  );
  const activeJobs = workspace.jobs.some((job) =>
    ["Queued", "Running"].includes(job.status),
  );
  useEffect(() => {
    if (!activeJobs) return;
    const timer = window.setTimeout(() => router.refresh(), 2500);
    return () => window.clearTimeout(timer);
  }, [activeJobs, router, workspace.jobs]);

  const sources = useMemo(
    () => [
      "All",
      ...new Set(workspace.messages.map((message) => message.source)),
    ],
    [workspace.messages],
  );
  const visible = useMemo(
    () =>
      workspace.messages.filter((message) => {
        const date = new Date(message.message_date || message.created_at);
        return (
          (source === "All" || message.source === source) &&
          (!startDate || date >= new Date(`${startDate}T00:00:00`)) &&
          (!endDate || date <= new Date(`${endDate}T23:59:59.999`))
        );
      }),
    [workspace.messages, source, startDate, endDate],
  );
  const selectedRows = workspace.messages.filter((message) =>
    selected.has(message.id),
  );
  const eligible = (message: AnalysisMessageRow) =>
    !message.finding_id && !message.active_job_id && workspace.approvedContext;

  function toggle(id: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function request(url: string, body: unknown) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json()) as Record<string, unknown>;
    if (!response.ok)
      throw new Error(String(data.error || "The action failed."));
    return data;
  }

  async function startAnalysis() {
    if (!selected.size) return;
    setBusy(true);
    setNotice({});
    try {
      const data = await request("/api/analysis/jobs", {
        projectId,
        messageIds: [...selected],
      });
      const batch = data.batch as { queued: number; skipped: number };
      setSelected(new Set());
      setNotice({
        success: `${batch.queued} analysis job(s) queued; ${batch.skipped} item(s) with an existing finding or prior job skipped. Results remain private for professional review.`,
      });
      router.refresh();
    } catch (error) {
      setNotice({
        error:
          error instanceof Error ? error.message : "Analysis could not start.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function jobAction(jobId: string, action: "cancel" | "retry") {
    setBusy(true);
    setNotice({});
    try {
      await request(`/api/analysis/jobs/${jobId}`, { action });
      setNotice({
        success:
          action === "cancel"
            ? "Cancellation recorded. A running model response will be discarded."
            : "Analysis queued for retry using the same pinned SOW and boundary map.",
      });
      router.refresh();
    } catch (error) {
      setNotice({
        error:
          error instanceof Error
            ? error.message
            : "Job action could not complete.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="border-b border-audit-border pb-7">
        <p className="text-sm font-medium text-audit-muted">
          Controlled scope comparison
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Analyze communications</h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-zinc-700">
          Select only the client communications you want compared with the
          approved agreement. AI creates private draft findings; it never makes
          a billing decision or contacts a client.
        </p>
        <Link
          href={`/app/projects/${projectId}`}
          className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold underline"
        >
          Return to project
        </Link>
      </section>

      {workspace.approvedContext ? (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950">
          Approved boundary map ready with{" "}
          {workspace.approvedContext.boundaryItemCount} evidence-linked items.
          Every job is pinned to this map and its SOW version.
        </div>
      ) : (
        <div
          role="alert"
          className="rounded-md border border-amber-300 bg-amber-50 p-5 text-amber-950"
        >
          <p className="font-semibold">Agreement approval required</p>
          <p className="mt-2 text-sm">{workspace.boundaryError}</p>
          <Link
            href={`/app/projects/${projectId}/sow`}
            className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold underline"
          >
            Review and approve the SOW boundary map
          </Link>
        </div>
      )}

      {notice.error ? (
        <div
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 p-4 text-red-900"
        >
          {notice.error}
        </div>
      ) : null}
      {notice.success ? (
        <div
          role="status"
          className="rounded-md border border-emerald-300 bg-emerald-50 p-4 text-emerald-900"
        >
          {notice.success}
        </div>
      ) : null}

      <section>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">1. Choose communications</h2>
            <p className="mt-2 text-sm text-zinc-700">
              Showing the 250 most recent source records. Existing findings and
              prior jobs cannot be selected again; retry failed jobs below.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <label>
              <span className="block text-sm font-medium">Source</span>
              <select
                value={source}
                onChange={(event) => setSource(event.target.value)}
                className="mt-1 min-h-11 rounded-md border border-audit-border px-3"
              >
                {sources.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="block text-sm font-medium">From</span>
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="mt-1 min-h-11 rounded-md border border-audit-border px-3"
              />
            </label>
            <label>
              <span className="block text-sm font-medium">Through</span>
              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="mt-1 min-h-11 rounded-md border border-audit-border px-3"
              />
            </label>
          </div>
        </div>
        <div className="mt-4 overflow-x-auto rounded-md border border-audit-border">
          <table className="min-w-full text-left text-sm">
            <caption className="sr-only">
              Imported communications available for controlled analysis
            </caption>
            <thead className="bg-audit-soft">
              <tr>
                <th className="p-3">Select</th>
                <th className="p-3">Date and source</th>
                <th className="p-3">Communication preview</th>
                <th className="p-3">State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-audit-border">
              {visible.length ? (
                visible.map((message) => (
                  <tr key={message.id}>
                    <td className="p-3 align-top">
                      <input
                        type="checkbox"
                        aria-label={`Select communication from ${message.sender || message.sender_email || "unknown sender"}`}
                        checked={selected.has(message.id)}
                        disabled={!eligible(message)}
                        onChange={(event) =>
                          toggle(message.id, event.target.checked)
                        }
                        className="h-5 w-5"
                      />
                    </td>
                    <td className="whitespace-nowrap p-3 align-top">
                      <div className="font-medium">{message.source}</div>
                      <div className="mt-1 text-zinc-600">
                        {displayDate(
                          message.message_date || message.created_at,
                        )}
                      </div>
                    </td>
                    <td className="max-w-2xl p-3 align-top">
                      <div className="font-medium">
                        {message.sender ||
                          message.sender_email ||
                          "Sender not provided"}
                        {message.subject ? ` - ${message.subject}` : ""}
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-zinc-700">
                        {message.message_text}
                      </p>
                      {message.character_count > message.message_text.length ? (
                        <p className="mt-1 text-xs text-zinc-600">
                          Preview shortened from{" "}
                          {message.character_count.toLocaleString()} characters.
                        </p>
                      ) : null}
                    </td>
                    <td className="p-3 align-top font-medium">
                      {message.finding_id
                        ? "Finding created"
                        : message.active_job_status || "Ready"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="p-6 text-zinc-600">
                    No communications match this source and date range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-md border border-audit-border bg-white p-6 shadow-audit">
        <h2 className="text-xl font-semibold">2. Confirm analysis scope</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-sm text-zinc-600">Selected messages</dt>
            <dd className="mt-1 text-2xl font-semibold">
              {selectedRows.length}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-zinc-600">Input characters</dt>
            <dd className="mt-1 text-2xl font-semibold">
              {selectedRows
                .reduce((sum, row) => sum + row.character_count, 0)
                .toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-zinc-600">External actions</dt>
            <dd className="mt-1 font-semibold">None</dd>
          </div>
        </dl>
        <p className="mt-4 text-sm leading-6 text-zinc-700">
          Starting this job sends text only to the configured AI provider. In
          Ollama mode it remains on the configured local machine. Findings
          require human review before billing.
        </p>
        <button
          type="button"
          onClick={startAnalysis}
          disabled={busy || !selected.size || !workspace.approvedContext}
          className="mt-5 min-h-11 rounded-md bg-ink px-5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy
            ? "Working..."
            : `Start analysis for ${selected.size} message${selected.size === 1 ? "" : "s"}`}
        </button>
      </section>

      <section>
        <h2 className="text-xl font-semibold">Analysis jobs</h2>
        <p className="mt-2 text-sm text-zinc-700">
          Jobs keep their original SOW and boundary references. Failed jobs can
          be retried; canceling a running job discards its result.
        </p>
        <div className="mt-4 overflow-x-auto rounded-md border border-audit-border">
          <table className="min-w-full text-left text-sm">
            <caption className="sr-only">
              Analysis job progress and errors
            </caption>
            <thead className="bg-audit-soft">
              <tr>
                <th className="p-3">Created</th>
                <th className="p-3">Status</th>
                <th className="p-3">Provider</th>
                <th className="p-3">Progress</th>
                <th className="p-3">Result or error</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-audit-border">
              {workspace.jobs.length ? (
                workspace.jobs.map((job) => (
                  <tr key={job.id}>
                    <td className="p-3">{displayDate(job.created_at)}</td>
                    <td className="p-3 font-semibold">
                      {job.cancel_requested_at && job.status === "Running"
                        ? "Cancel requested"
                        : job.status}
                    </td>
                    <td className="p-3">
                      {job.provider} / {job.model}
                    </td>
                    <td className="p-3">{job.progress}%</td>
                    <td className="max-w-md p-3">
                      {job.error_message ||
                        job.result?.classification ||
                        (job.status === "Cancelled"
                          ? "No result was saved."
                          : "Waiting")}
                    </td>
                    <td className="p-3">
                      {["Queued", "Running"].includes(job.status) ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => jobAction(job.id, "cancel")}
                          className="min-h-10 font-semibold text-red-800 underline disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      ) : ["Failed", "Cancelled"].includes(job.status) &&
                        job.attempt_count < job.max_attempts ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => jobAction(job.id, "retry")}
                          className="min-h-10 font-semibold underline disabled:opacity-50"
                        >
                          Retry
                        </button>
                      ) : ["Failed", "Cancelled"].includes(job.status) ? (
                        <span className="text-zinc-600">
                          Retry limit reached
                        </span>
                      ) : job.result?.findingId ? (
                        <Link
                          href={`/app/projects/${projectId}?show=needs-review`}
                          className="font-semibold underline"
                        >
                          Review finding
                        </Link>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-6 text-zinc-600">
                    No analysis jobs for this project yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
