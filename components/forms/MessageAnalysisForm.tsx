"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MESSAGE_SOURCES } from "@/lib/types";

export function MessageAnalysisForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const payload = {
      projectId,
      source: String(form.get("source") || "Other"),
      sender: String(form.get("sender") || ""),
      messageDate: String(form.get("messageDate") || ""),
      messageText: String(form.get("messageText") || "")
    };

    try {
      const response = await fetch("/api/messages/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(json.error || "Failed to analyze message.");
      }

      formElement.reset();
      setSuccess("Analysis saved. Review the result below before using it for billing or client communication.");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to analyze message.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="
      grid gap-5 rounded-md border border-audit-border bg-white p-6 shadow-audit
    ">
      <div className="
        grid gap-4
        sm:grid-cols-3
      ">
        <label className="block">
          <span className="text-sm font-medium">Source</span>
          <select name="source" className="
            mt-2 w-full rounded-md border border-audit-border px-3 py-2
          ">
            {MESSAGE_SOURCES.map((source) => (
              <option key={source}>{source}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Sender</span>
          <input name="sender" className="
            mt-2 w-full rounded-md border border-audit-border px-3 py-2
          " />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Message date</span>
          <input
            name="messageDate"
            type="date"
            className="
              mt-2 w-full rounded-md border border-audit-border px-3 py-2
            "
          />
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-medium">Client request</span>
        <textarea
          name="messageText"
          rows={5}
          className="
            mt-2 w-full rounded-md border border-audit-border px-3 py-2
          "
          required
        />
      </label>

      {error ? <div className="
        rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700
      ">{error}</div> : null}
      {success ? (
        <div className="
          rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm
          text-emerald-800
        ">
          {success}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="
          inline-flex h-11 items-center justify-center rounded-md bg-ink px-4
          text-sm font-semibold text-white
          hover:bg-zinc-800
          disabled:cursor-not-allowed disabled:opacity-60
        "
      >
        {isSubmitting ? "Analyzing request..." : "Analyze and save request"}
      </button>
    </form>
  );
}
