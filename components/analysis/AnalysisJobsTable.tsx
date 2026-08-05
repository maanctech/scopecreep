"use client";

import Link from "next/link";
import type { AnalysisJobRow } from "@/lib/analysisJobs/service";
import { displayDate } from "@/components/analysis/dateFormat";

export function AnalysisJobsTable({
  jobs,
  busy,
  projectId,
  onJobAction,
}: {
  jobs: AnalysisJobRow[];
  busy: boolean;
  projectId: string;
  onJobAction: (
    jobId: string,
    action: "cancel" | "retry" | "start-over" | "recover",
  ) => void;
}) {
  return (
    <section>
      <h2 className="text-xl font-semibold">Analysis jobs</h2>
      <p className="mt-2 text-sm text-zinc-700">
        Jobs keep their original SOW and boundary references. Failed jobs can
        be retried; canceling a running job discards its result.
      </p>
      <div className="
        mt-4 overflow-x-auto rounded-md border border-audit-border
      ">
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
            {jobs.length ? (
              jobs.map((job) => (
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
                    {job.status === "Running" && job.can_recover ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onJobAction(job.id, "recover")}
                        className="
                          min-h-10 font-semibold text-red-800 underline
                          disabled:opacity-50
                        "
                      >
                        Recover
                      </button>
                    ) : ["Queued", "Running"].includes(job.status) ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onJobAction(job.id, "cancel")}
                        className="
                          min-h-10 font-semibold text-red-800 underline
                          disabled:opacity-50
                        "
                      >
                        Cancel
                      </button>
                    ) : ["Failed", "Cancelled"].includes(job.status) &&
                      job.attempt_count < job.max_attempts ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onJobAction(job.id, "retry")}
                        className="
                          min-h-10 font-semibold underline
                          disabled:opacity-50
                        "
                      >
                        Retry
                      </button>
                    ) : ["Failed", "Cancelled"].includes(job.status) &&
                      job.attempt_count >= job.max_attempts &&
                      job.start_over_count < 1 ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onJobAction(job.id, "start-over")}
                        className="
                          min-h-10 font-semibold underline
                          disabled:opacity-50
                        "
                      >
                        Start over
                      </button>
                    ) : ["Failed", "Cancelled"].includes(job.status) ? (
                      <span className="text-zinc-600">No actions available</span>
                    ) : job.result?.findingId ? (
                      <Link
                        href={`/app/projects/${projectId}?finding=${job.result.findingId}#finding-${job.result.findingId}`}
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
  );
}
