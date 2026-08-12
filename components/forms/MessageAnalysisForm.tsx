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
      sl-panel grid gap-5 p-5
      sm:p-6
    ">
      <div className="
        grid gap-4
        sm:grid-cols-3
      ">
        <label className="block">
          <span className="text-sm font-medium">Source</span>
          <select name="source" className="sl-field mt-2">
            {MESSAGE_SOURCES.map((source) => (
              <option key={source}>{source}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Sender</span>
          <input name="sender" className="sl-field mt-2" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Message date</span>
          <input
            name="messageDate"
            type="date"
            className="sl-field mt-2"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-medium">Client request</span>
        <textarea
          name="messageText"
          rows={5}
          className="sl-field mt-2"
          required
        />
      </label>

      {error ? <div className="
        rounded-md border border-critical/25 bg-critical/5 p-3 text-sm
        text-critical
      ">{error}</div> : null}
      {success ? (
        <div className="
          rounded-md border border-signal/25 bg-signal/5 p-3 text-sm text-signal
        ">
          {success}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="sl-button-primary"
      >
        {isSubmitting ? "Analyzing request..." : "Analyze and save request"}
      </button>
    </form>
  );
}
