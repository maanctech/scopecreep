"use client";

import { Pause, Play, RefreshCw } from "lucide-react";
import { useState } from "react";
import type { ProjectAutomation } from "@/lib/automation/types";

export function ProjectAutomationControl({
  projectId,
  initialAutomation,
}: {
  projectId: string;
  initialAutomation: ProjectAutomation | null;
}) {
  const [automation, setAutomation] = useState(initialAutomation);
  const [intervalMinutes, setIntervalMinutes] = useState(
    initialAutomation?.sync_interval_minutes || 15,
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const enabled = automation?.desired_state === "Enabled";
  const needsAttention = automation?.health_status === "Needs Attention";

  async function update(enabled: boolean) {
    setBusy(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/automation`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, sync_interval_minutes: intervalMinutes }),
      });
      const data = (await response.json()) as {
        automation?: ProjectAutomation;
        error?: string;
      };

      if (!response.ok) throw new Error(data.error || "Monitoring update failed.");

      setAutomation(data.automation || null);
      setMessage(
        enabled
          ? "Monitoring enabled. New communications will be analyzed against the approved boundary."
          : "Monitoring paused. Manual import and analysis remain available.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Monitoring update failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="border-y border-audit-border py-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-audit-muted">Private monitoring worker</p>
          <h2 className="mt-1 text-xl font-semibold">Project monitoring</h2>
          <p className="mt-2 max-w-2xl text-sm/6 text-audit-body">
            Synchronizes tested sources and prepares internal findings. It never contacts
            clients or makes billing decisions.
          </p>
        </div>
        <span className="
          rounded-sm border border-audit-border bg-white px-2 py-1 text-xs
          font-semibold
        ">
          {automation?.running
            ? "Running"
            : automation
              ? `${automation.desired_state} / ${automation.health_status}`
              : "Not enabled"}
        </span>
      </div>
      <div className="mt-5 flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium">
          Check every
          <select
            value={intervalMinutes}
            onChange={(event) => setIntervalMinutes(Number(event.target.value))}
            disabled={busy || enabled}
            className="
              ml-2 min-h-11 rounded-md border border-audit-border bg-white px-3
            "
          >
            <option value={15}>15 minutes</option>
            <option value={30}>30 minutes</option>
            <option value={60}>60 minutes</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => void update(needsAttention ? true : !enabled)}
          disabled={busy}
          className={needsAttention || !enabled ? "sl-button-primary" : `
            sl-button-secondary
          `}
        >
          {busy ? (
            <RefreshCw className="size-4 animate-spin" aria-hidden="true" />
          ) : enabled && !needsAttention ? (
            <Pause className="size-4" aria-hidden="true" />
          ) : (
            <Play className="size-4" aria-hidden="true" />
          )}
          {needsAttention
            ? "Retry monitoring"
            : enabled
              ? "Pause monitoring"
              : "Enable monitoring"}
        </button>
        {enabled && needsAttention ? (
          <button
            type="button"
            onClick={() => void update(false)}
            disabled={busy}
            className="sl-button-secondary"
          >
            <Pause className="size-4" aria-hidden="true" />
            Pause monitoring
          </button>
        ) : null}
      </div>
      {automation?.next_run_at && enabled && !needsAttention ? (
        <p className="mt-3 text-xs text-audit-muted">
          Next scheduled check: {new Date(automation.next_run_at).toLocaleString()}
        </p>
      ) : null}
      {automation?.last_error ? (
        <p className="
          mt-3 rounded-sm border border-audit-amber/30 bg-audit-amber/5 p-3
          text-sm text-audit-amber
        ">
          {automation.last_error}
        </p>
      ) : null}
      {message ? <p className="mt-3 text-sm text-audit-body" role="status">{message}</p> : null}
    </section>
  );
}
