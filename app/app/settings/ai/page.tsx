import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/Page";
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
    <Page>
      {firstRun ? (
        <section className="
          rounded-md border border-signal/25 bg-signal/5 p-5 text-signal
        ">
          <h1 className="text-lg font-semibold">Secure workspace created</h1>
          <p className="mt-2 text-sm/6">
            Confirm the analysis provider below. When it is ready, create a project or review the installation diagnostics.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link className="sl-button-primary" href="/app/projects/new">Create first project</Link>
            <Link className="sl-button-secondary" href="/app/settings/system">Review system checks</Link>
          </div>
        </section>
      ) : null}
      <PageHeader eyebrow="Analysis provider" title="AI diagnostics" description="ScopeLedger uses the configured provider only for evidence-based SOW comparison. Provider configuration does not replace live validation, and every result requires professional review." />

      <section className="sl-panel p-6">
        <div className="flex items-start gap-3">
          <StatusIcon className={`
            mt-0.5 size-5
            ${health.available ? `text-signal` : `text-critical`}
          `} aria-hidden="true" />
          <div>
            <h2 className="text-xl font-semibold capitalize">{health.provider}</h2>
            <p className="mt-1 text-sm text-audit-body">{health.message}</p>
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
        rounded-md border border-audit-amber/30 bg-audit-amber/5 p-4 text-sm/6
        text-audit-amber
      ">
        Provider output is never a billing authorization. ScopeLedger recalculates revenue from hours and the project rate, requires SOW evidence for definitive decisions, and falls back to Needs Human Review when output is unavailable or invalid.
      </p>
    </Page>
  );
}
