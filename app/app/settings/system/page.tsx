import Link from "next/link";
import { Activity, Download, ShieldCheck } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/current";
import { auditLog, systemDiagnostics } from "@/lib/operations/diagnostics";

export const dynamic = "force-dynamic";

export default async function SystemSettingsPage() {
  await requirePagePermission("settings:read");
  const [diagnostics, events] = await Promise.all([
    systemDiagnostics(),
    auditLog(100)
  ]);
  const failedJobs = [...diagnostics.analysisJobs, ...diagnostics.ingestionJobs].filter(
    (row) => row.status === "Failed"
  );

  return (
    <div className="space-y-8">
      <section className="border-b border-audit-border pb-7">
        <div className="
          flex items-center gap-2 text-sm font-medium text-audit-muted
        ">
          <Activity className="size-4" aria-hidden="true" /> System operations
        </div>
        <h1 className="mt-2 text-3xl font-semibold">Diagnostics and audit log</h1>
        <p className="mt-3 max-w-3xl text-base/7 text-zinc-700">
          Review local service health, migrations, job failures, integration state, and append-only operational events. Support exports redact sensitive business content and credentials.
        </p>
        <Link
          href="/api/diagnostics/support-bundle"
          className="
            mt-5 inline-flex h-11 items-center gap-2 rounded-md border
            border-ink px-4 text-sm font-semibold
            hover:bg-audit-soft
          "
        >
          <Download className="size-4" aria-hidden="true" /> Download redacted support bundle
        </Link>
      </section>

      <section className="
        grid gap-4
        sm:grid-cols-2
        lg:grid-cols-4
      ">
        <div className="rounded-md border border-audit-border p-5"><div className="
          text-sm text-audit-muted
        ">Application</div><div className="
          mt-2 text-xl font-semibold capitalize
        ">{diagnostics.application.status}</div><p className="mt-1 text-sm">v{diagnostics.application.version}</p></div>
        <div className="rounded-md border border-audit-border p-5"><div className="
          text-sm text-audit-muted
        ">Database</div><div className="mt-2 text-xl font-semibold capitalize">{diagnostics.application.database}</div><p className="
          mt-1 text-sm
        ">{diagnostics.application.latencyMs} ms check</p></div>
        <div className="rounded-md border border-audit-border p-5"><div className="
          text-sm text-audit-muted
        ">Migrations</div><div className="mt-2 text-xl font-semibold">{diagnostics.migrations.applied}/{diagnostics.migrations.expected}</div><p className="
          mt-1 text-sm
        ">{diagnostics.migrations.pending.length ? `${diagnostics.migrations.pending.length} pending` : "Current"}</p></div>
        <div className="rounded-md border border-audit-border p-5"><div className="
          text-sm text-audit-muted
        ">Failed jobs</div><div className="mt-2 text-xl font-semibold">{failedJobs.reduce((sum, row) => sum + Number(row.count), 0)}</div><p className="
          mt-1 text-sm
        ">Analysis and ingestion</p></div>
      </section>

      <section className="
        grid gap-6
        lg:grid-cols-2
      ">
        <div>
          <h2 className="text-xl font-semibold">Configuration checks</h2>
          <div className="
            mt-4 divide-y divide-audit-border rounded-md border
            border-audit-border
          ">
            {diagnostics.configuration.map((check) => (
              <div key={check.name} className="flex gap-3 p-4">
                <ShieldCheck className={`
                  mt-0.5 size-5
                  ${check.ok ? `text-emerald-700` : `text-amber-700`}
                `} aria-hidden="true" />
                <div><div className="font-semibold">{check.name}</div><p className="
                  mt-1 text-sm text-zinc-700
                ">{check.message}</p></div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-xl font-semibold">AI provider</h2>
          <div className="mt-4 rounded-md border border-audit-border p-5">
            <div className="text-lg font-semibold capitalize">{diagnostics.ai.provider}</div>
            <p className="mt-2 text-sm text-zinc-700">{diagnostics.ai.message}</p>
            <dl className="
              mt-4 grid gap-3
              sm:grid-cols-2
            "><div><dt className="text-sm text-audit-muted">Selected model</dt><dd className="
              font-semibold
            ">{diagnostics.ai.selectedModel || "Unavailable"}</dd></div><div><dt className="
              text-sm text-audit-muted
            ">Available models</dt><dd className="font-semibold">{diagnostics.ai.models.length}</dd></div></dl>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold">Backups</h2>
        <p className="mt-2 max-w-3xl text-sm/6 text-zinc-700">
          ScopeLedger operates the database and is responsible for its backups and
          recovery. There is nothing here for a firm to run, and no firm can reach
          another firm&rsquo;s records through this page.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">Append-only audit log</h2>
        <p className="mt-2 text-sm text-zinc-700">Recent organization-scoped events. Sensitive metadata is redacted before display.</p>
        <div className="
          mt-4 overflow-x-auto rounded-md border border-audit-border
        ">
          <table className="min-w-full text-left text-sm">
            <caption className="sr-only">Recent append-only audit events</caption>
            <thead className="bg-audit-soft"><tr><th className="p-3">Time</th><th className="
              p-3
            ">Action</th><th className="p-3">Resource</th><th className="p-3">Reference</th></tr></thead>
            <tbody className="divide-y divide-audit-border">
              {events.length ? events.map((event) => (
                <tr key={event.id}><td className="p-3 whitespace-nowrap">{new Date(event.createdAt).toLocaleString()}</td><td className="
                  p-3 font-semibold
                ">{event.action}</td><td className="p-3">{event.resourceType}</td><td className="
                  p-3 font-mono text-xs
                ">{event.resourceId || "-"}</td></tr>
              )) : <tr><td colSpan={4} className="p-6 text-zinc-600">No audit events have been recorded yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
