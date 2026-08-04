import Link from "next/link";
import { Activity, CheckCircle2, XCircle } from "lucide-react";
import { configuredProviderHealth } from "@/lib/ai/providers";
import { requirePagePermission } from "@/lib/auth/current";

export const dynamic = "force-dynamic";

export default async function AiSettingsPage({
  searchParams
}: {
  searchParams: Promise<{ setup?: string }>;
}) {
  await requirePagePermission("settings:read");
  const firstRun = (await searchParams).setup === "complete";
  const health = await configuredProviderHealth();
  const StatusIcon = health.available ? CheckCircle2 : XCircle;

  return (
    <div className="space-y-8">
      {firstRun ? (
        <section className="
          rounded-md border border-emerald-300 bg-emerald-50 p-5
          text-emerald-950
        ">
          <h1 className="text-lg font-semibold">Secure workspace created</h1>
          <p className="mt-2 text-sm/6">
            Confirm the analysis provider below. When it is ready, create a project or review the installation diagnostics.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link className="
              inline-flex h-11 items-center rounded-md bg-ink px-4 text-sm
              font-semibold text-white
            " href="/app/projects/new">Create first project</Link>
            <Link className="
              inline-flex h-11 items-center rounded-md border border-emerald-800
              px-4 text-sm font-semibold
            " href="/app/settings/system">Review system checks</Link>
          </div>
        </section>
      ) : null}
      <section className="border-b border-audit-border pb-7">
        <div className="
          flex items-center gap-2 text-sm font-medium text-audit-muted
        ">
          <Activity className="size-4" aria-hidden="true" />
          Analysis provider
        </div>
        <h1 className="mt-2 text-3xl font-semibold">AI diagnostics</h1>
        <p className="mt-3 max-w-2xl text-base/7 text-zinc-700">
          ScopeLedger uses the selected provider only for evidence-based SOW comparison. Every result still requires professional review.
        </p>
      </section>

      <section className="
        rounded-md border border-audit-border bg-white p-6 shadow-audit
      ">
        <div className="flex items-start gap-3">
          <StatusIcon className={`
            mt-0.5 size-5
            ${health.available ? `text-emerald-700` : `text-red-700`}
          `} aria-hidden="true" />
          <div>
            <h2 className="text-xl font-semibold capitalize">{health.provider}</h2>
            <p className="mt-1 text-sm text-zinc-700">{health.message}</p>
          </div>
        </div>
        <dl className="
          mt-6 grid gap-4
          sm:grid-cols-2
        ">
          <div><dt className="text-sm text-audit-muted">Selected model</dt><dd className="
            mt-1 font-semibold
          ">{health.selectedModel ?? "Unavailable"}</dd></div>
          <div><dt className="text-sm text-audit-muted">Configured model</dt><dd className="
            mt-1 font-semibold
          ">{health.configuredModel ?? "Automatic discovery"}</dd></div>
        </dl>
        {health.models.length ? (
          <div className="mt-6">
            <h3 className="text-sm font-semibold">Available models</h3>
            <ul className="
              mt-2 divide-y divide-audit-border rounded-md border
              border-audit-border
            ">
              {health.models.map((model) => <li className="px-3 py-2 text-sm" key={model}>{model}</li>)}
            </ul>
          </div>
        ) : null}
      </section>

      <p className="
        rounded-md border border-amber-300 bg-amber-50 p-4 text-sm/6
        text-amber-900
      ">
        Provider output is never a billing authorization. ScopeLedger recalculates revenue from hours and the project rate, requires SOW evidence for definitive decisions, and falls back to Needs Human Review when output is unavailable or invalid.
      </p>
    </div>
  );
}
