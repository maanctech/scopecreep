"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  AnalysisJobRow,
  AnalysisMessageRow,
} from "@/lib/analysisJobs/service";
import { AnalysisJobsTable } from "@/components/analysis/AnalysisJobsTable";
import { AnalysisScopeSummary } from "@/components/analysis/AnalysisScopeSummary";
import { MessageSelectionTable } from "@/components/analysis/MessageSelectionTable";
import { WorkspaceOverview } from "@/components/analysis/WorkspaceOverview";

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

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);

      if (next.has(id)) next.delete(id);
      else next.add(id);

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

  async function jobAction(
    jobId: string,
    action: "cancel" | "retry" | "start-over" | "recover",
  ) {
    setBusy(true);
    setNotice({});

    try {
      await request(`/api/analysis/jobs/${jobId}`, { action });
      setNotice({
        success: {
          cancel:
            "Cancellation recorded. A running model response will be discarded.",
          retry:
            "Analysis queued for retry using the same pinned SOW and boundary map.",
          "start-over":
            "Analysis restarted with the current approved SOW and boundary map.",
          recover:
            "The stale job was marked failed. Review its error, then retry it.",
        }[action],
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

  const totalCharacters = selectedRows.reduce(
    (sum, row) => sum + row.character_count,
    0,
  );
  const startDisabled = busy || !selected.size || !workspace.approvedContext;

  return (
    <div className="space-y-8">
      <WorkspaceOverview
        projectId={projectId}
        approvedContext={workspace.approvedContext}
        boundaryError={workspace.boundaryError}
        notice={notice}
      />

      <MessageSelectionTable
        sources={sources}
        source={source}
        onSourceChange={setSource}
        startDate={startDate}
        onStartDateChange={setStartDate}
        endDate={endDate}
        onEndDateChange={setEndDate}
        messages={visible}
        selected={selected}
        onToggle={toggle}
        isEligible={eligible}
      />

      <AnalysisScopeSummary
        selectedCount={selected.size}
        totalCharacters={totalCharacters}
        disabled={startDisabled}
        busy={busy}
        onStartAnalysis={startAnalysis}
      />

      <AnalysisJobsTable
        jobs={workspace.jobs}
        busy={busy}
        projectId={projectId}
        onJobAction={jobAction}
      />
    </div>
  );
}
