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
    <section className="sl-panel p-6">
      <h2 className="text-xl font-semibold">2. Confirm analysis scope</h2>
      <dl className="
        mt-4 grid gap-4
        sm:grid-cols-3
      ">
        <div>
          <dt className="text-sm text-audit-muted">Selected messages</dt>
          <dd className="mt-1 text-2xl font-semibold">{selectedCount}</dd>
        </div>
        <div>
          <dt className="text-sm text-audit-muted">Input characters</dt>
          <dd className="mt-1 text-2xl font-semibold">
            {totalCharacters.toLocaleString()}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-audit-muted">External actions</dt>
          <dd className="mt-1 font-semibold">None</dd>
        </div>
      </dl>
      <p className="mt-4 text-sm/6 text-audit-body">
        Starting this job sends text only to the configured AI provider. In
        Ollama mode it remains on the configured local machine. Findings
        require human review before billing.
      </p>
      <button
        type="button"
        onClick={onStartAnalysis}
        disabled={disabled}
        className="sl-button-primary mt-5"
      >
        {busy
          ? "Working..."
          : `Start analysis for ${selectedCount} message${selectedCount === 1 ? "" : "s"}`}
      </button>
    </section>
  );
}
