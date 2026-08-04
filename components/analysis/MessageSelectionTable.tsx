"use client";

import type { AnalysisMessageRow } from "@/lib/analysisJobs/service";
import { displayDate } from "@/components/analysis/dateFormat";

export function MessageSelectionTable({
  sources,
  source,
  onSourceChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  messages,
  selected,
  onToggle,
  isEligible,
}: {
  sources: string[];
  source: string;
  onSourceChange: (source: string) => void;
  startDate: string;
  onStartDateChange: (value: string) => void;
  endDate: string;
  onEndDateChange: (value: string) => void;
  messages: AnalysisMessageRow[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  isEligible: (message: AnalysisMessageRow) => unknown;
}) {
  return (
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
              onChange={(event) => onSourceChange(event.target.value)}
              className="
                mt-1 min-h-11 rounded-md border border-audit-border px-3
              "
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
              onChange={(event) => onStartDateChange(event.target.value)}
              className="
                mt-1 min-h-11 rounded-md border border-audit-border px-3
              "
            />
          </label>
          <label>
            <span className="block text-sm font-medium">Through</span>
            <input
              type="date"
              value={endDate}
              onChange={(event) => onEndDateChange(event.target.value)}
              className="
                mt-1 min-h-11 rounded-md border border-audit-border px-3
              "
            />
          </label>
        </div>
      </div>
      <div className="
        mt-4 overflow-x-auto rounded-md border border-audit-border
      ">
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
            {messages.length ? (
              messages.map((message) => (
                <tr key={message.id}>
                  <td className="p-3 align-top">
                    <input
                      type="checkbox"
                      aria-label={`Select communication from ${message.sender || message.sender_email || "unknown sender"}`}
                      checked={selected.has(message.id)}
                      disabled={!isEligible(message)}
                      onChange={() => onToggle(message.id)}
                      className="size-5"
                    />
                  </td>
                  <td className="p-3 align-top whitespace-nowrap">
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
  );
}
