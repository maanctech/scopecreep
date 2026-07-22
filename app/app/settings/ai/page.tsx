import { Activity, CheckCircle2, XCircle } from "lucide-react";
import { configuredProviderHealth } from "@/lib/ai/providers";

export const dynamic = "force-dynamic";

export default async function AiSettingsPage() {
  const health = await configuredProviderHealth();
  const StatusIcon = health.available ? CheckCircle2 : XCircle;
  return (
    <div className="space-y-8">
      <section className="border-b border-audit-border pb-7">
        <div className="flex items-center gap-2 text-sm font-medium text-audit-muted">
          <Activity className="h-4 w-4" aria-hidden="true" />
          Analysis provider
        </div>
        <h1 className="mt-2 text-3xl font-semibold">AI diagnostics</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-zinc-700">
          ScopeLedger uses the selected provider only for evidence-based SOW comparison. Every result still requires professional review.
        </p>
      </section>

      <section className="rounded-md border border-audit-border bg-white p-6 shadow-audit">
        <div className="flex items-start gap-3">
          <StatusIcon className={`mt-0.5 h-5 w-5 ${health.available ? "text-emerald-700" : "text-red-700"}`} aria-hidden="true" />
          <div>
            <h2 className="text-xl font-semibold capitalize">{health.provider}</h2>
            <p className="mt-1 text-sm text-zinc-700">{health.message}</p>
          </div>
        </div>
        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <div><dt className="text-sm text-audit-muted">Selected model</dt><dd className="mt-1 font-semibold">{health.selectedModel ?? "Unavailable"}</dd></div>
          <div><dt className="text-sm text-audit-muted">Configured model</dt><dd className="mt-1 font-semibold">{health.configuredModel ?? "Automatic discovery"}</dd></div>
        </dl>
        {health.models.length ? (
          <div className="mt-6">
            <h3 className="text-sm font-semibold">Available models</h3>
            <ul className="mt-2 divide-y divide-audit-border rounded-md border border-audit-border">
              {health.models.map((model) => <li className="px-3 py-2 text-sm" key={model}>{model}</li>)}
            </ul>
          </div>
        ) : null}
      </section>

      <p className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
        Provider output is never a billing authorization. ScopeLedger recalculates revenue from hours and the project rate, requires SOW evidence for definitive decisions, and falls back to Needs Human Review when output is unavailable or invalid.
      </p>
    </div>
  );
}
