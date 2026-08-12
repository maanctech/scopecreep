"use client";

import { useState } from "react";

export function PublicIntakeSettingsForm({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  async function update(nextEnabled: boolean) {
    if (nextEnabled && !window.confirm("Enable public lead capture and allow prospects to submit confidential SOW and message text after a one-time lead request?")) return;

    setBusy(true);
    setMessage(null);

    try {
      const response = await fetch("/api/settings/public-intake", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: nextEnabled }),
      });
      const data = (await response.json()) as { enabled?: boolean; error?: string };

      if (!response.ok || typeof data.enabled !== "boolean") {
        throw new Error(data.error || "Could not update public intake.");
      }

      setEnabled(data.enabled);
      setMessage({
        kind: "success",
        text: data.enabled
          ? "Public intake enabled. Prospects must still complete lead capture before uploading audit text."
          : "Public intake disabled. Outstanding intake links can no longer be used.",
      });
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Could not update public intake." });
    } finally {
      setBusy(false);
    }
  }

  const buttonTone = enabled
    ? "border-critical/25 text-critical"
    : "border-signal bg-signal text-white";

  return (
    <div className="sl-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Public audit intake</h2>
          <p className="mt-2 max-w-2xl text-sm/6 text-audit-body">
            Controls whether the public request form accepts leads and confidential audit material.
            Submission credentials expire after 24 hours and can be used once.
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => update(!enabled)}
          aria-pressed={enabled}
          className={`
            h-11 rounded-md border px-4 text-sm font-semibold
            disabled:opacity-60
            ${buttonTone}
          `}
        >
          {busy ? "Saving..." : enabled ? "Disable intake" : "Enable intake"}
        </button>
      </div>
      <p className="mt-4 text-sm font-semibold">Status: {enabled ? "Enabled" : "Disabled"}</p>
      {message ? (
        <div role="status" aria-live="polite" className={`
          mt-4 rounded-md border p-3 text-sm
          ${message.kind === "success" ? `
            border-signal/25 bg-signal/5 text-signal
          ` : `border-critical/25 bg-critical/5 text-critical`}
        `}>
          {message.text}
        </div>
      ) : null}
    </div>
  );
}
