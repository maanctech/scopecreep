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
  const active = automation?.status === "Active";

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
          <p className="mt-2 max-w-2xl text-sm/6 text-zinc-700">
            Synchronizes tested sources and prepares internal findings. It never contacts
            clients or makes billing decisions.
          </p>
        </div>
        <span className="
          rounded-sm border border-zinc-300 bg-white px-2 py-1 text-xs
          font-semibold
        ">
          {automation?.running ? "Running" : automation?.status || "Not enabled"}
        </span>
      </div>
      <div className="mt-5 flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium">
          Check every
          <select
            value={intervalMinutes}
            onChange={(event) => setIntervalMinutes(Number(event.target.value))}
            disabled={busy || active}
            className="
              ml-2 min-h-11 rounded-md border border-zinc-400 bg-white px-3
            "
          >
            <option value={15}>15 minutes</option>
            <option value={30}>30 minutes</option>
            <option value={60}>60 minutes</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => void update(!active)}
          disabled={busy}
          className="
            inline-flex min-h-11 items-center gap-2 rounded-md bg-ink px-4
            text-sm font-semibold text-white
            disabled:opacity-50
          "
        >
          {busy ? (
            <RefreshCw className="size-4 animate-spin" aria-hidden="true" />
          ) : active ? (
            <Pause className="size-4" aria-hidden="true" />
          ) : (
            <Play className="size-4" aria-hidden="true" />
          )}
          {active ? "Pause monitoring" : "Enable monitoring"}
        </button>
      </div>
      {automation?.next_run_at && active ? (
        <p className="mt-3 text-xs text-zinc-600">
          Next scheduled check: {new Date(automation.next_run_at).toLocaleString()}
        </p>
      ) : null}
      {automation?.last_error ? (
        <p className="
          mt-3 rounded-sm border border-amber-200 bg-amber-50 p-3 text-sm
          text-amber-950
        ">
          {automation.last_error}
        </p>
      ) : null}
      {message ? <p className="mt-3 text-sm text-zinc-700" role="status">{message}</p> : null}
    </section>
  );
}
