"use client";

export function AnalysisScopeSummary({
  selectedCount,
  totalCharacters,
  disabled,
  busy,
  onStartAnalysis,
}: {
  selectedCount: number;
  totalCharacters: number;
  disabled: boolean;
  busy: boolean;
  onStartAnalysis: () => void;
}) {
  return (
    <section className="
      rounded-md border border-audit-border bg-white p-6 shadow-audit
    ">
      <h2 className="text-xl font-semibold">2. Confirm analysis scope</h2>
      <dl className="
        mt-4 grid gap-4
        sm:grid-cols-3
      ">
        <div>
          <dt className="text-sm text-zinc-600">Selected messages</dt>
          <dd className="mt-1 text-2xl font-semibold">{selectedCount}</dd>
        </div>
        <div>
          <dt className="text-sm text-zinc-600">Input characters</dt>
          <dd className="mt-1 text-2xl font-semibold">
            {totalCharacters.toLocaleString()}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-zinc-600">External actions</dt>
          <dd className="mt-1 font-semibold">None</dd>
        </div>
      </dl>
      <p className="mt-4 text-sm/6 text-zinc-700">
        Starting this job sends text only to the configured AI provider. In
        Ollama mode it remains on the configured local machine. Findings
        require human review before billing.
      </p>
      <button
        type="button"
        onClick={onStartAnalysis}
        disabled={disabled}
        className="
          mt-5 min-h-11 rounded-md bg-ink px-5 text-sm font-semibold text-white
          disabled:opacity-50
        "
      >
        {busy
          ? "Working..."
          : `Start analysis for ${selectedCount} message${selectedCount === 1 ? "" : "s"}`}
      </button>
    </section>
  );
}
