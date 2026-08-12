import Link from "next/link";
import { Download, ShieldCheck } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/current";
import { auditLog, systemDiagnostics } from "@/lib/operations/diagnostics";
import { listBackups } from "@/lib/backups/service";
import { BackupPanel } from "@/components/operations/BackupPanel";
import { hasPermission } from "@/lib/auth/authorization";
import { PublicIntakeSettingsForm } from "@/components/operations/PublicIntakeSettingsForm";
import { Page, PageHeader } from "@/components/ui/Page";
import { getPublicIntakeSetting } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function SystemSettingsPage() {
  const auth = await requirePagePermission("settings:read");
  const canReadBackups = hasPermission(auth.role, "backups:read");
  const [diagnostics, events, backups, publicIntakeEnabled] = await Promise.all([
    systemDiagnostics(),
    auditLog(100),
    canReadBackups ? listBackups() : Promise.resolve([]),
    getPublicIntakeSetting(),
  ]);
  const failedJobs = [...diagnostics.analysisJobs, ...diagnostics.ingestionJobs].filter(
    (row) => row.status === "Failed"
  );

  return (
    <Page>
      <PageHeader
        eyebrow="System operations"
        title="Diagnostics and audit log"
        description="Review application, worker, migration, integration, and backup state. Support exports redact business content and credentials, but operators must inspect them before sharing."
        actions={<Link href="/api/diagnostics/support-bundle" className="
          sl-button-secondary
        "><Download className="size-4" aria-hidden="true" /> Download support bundle</Link>}
      />

      {hasPermission(auth.role, "settings:write") ? (
        <PublicIntakeSettingsForm initialEnabled={publicIntakeEnabled} />
      ) : null}

      <section className="border-y border-ink bg-bright-paper" aria-label="System status register">
        <div className="
          grid divide-y divide-audit-border
          sm:grid-cols-2 sm:divide-x sm:divide-y-0
          lg:grid-cols-5
        ">
          <div className="p-4"><div className="sl-metadata text-audit-muted">SYS-01 / APPLICATION</div><div className="
            mt-3 text-lg font-semibold capitalize
          ">{diagnostics.application.status}</div><p className="mt-1 text-sm">v{diagnostics.application.version}</p></div>
          <div className="p-4"><div className="sl-metadata text-audit-muted">SYS-02 / DATABASE</div><div className="
            mt-3 text-lg font-semibold capitalize
          ">{diagnostics.application.database}</div><p className="mt-1 text-sm">{diagnostics.application.latencyMs} ms check</p></div>
          <div className="p-4"><div className="sl-metadata text-audit-muted">SYS-03 / WORKER</div><div className="
            mt-3 text-lg font-semibold capitalize
          ">{diagnostics.monitoringWorker.status}</div><p className="
            mt-1 text-sm
          ">
            {diagnostics.monitoringWorker.lastSeenAt
              ? `Last seen ${new Date(diagnostics.monitoringWorker.lastSeenAt).toLocaleString()}`
              : "No heartbeat recorded"}
          </p></div>
          <div className="p-4"><div className="sl-metadata text-audit-muted">SYS-04 / MIGRATIONS</div><div className="
            mt-3 text-lg font-semibold
          ">{diagnostics.migrations.applied}/{diagnostics.migrations.expected}</div><p className="
            mt-1 text-sm
          ">{diagnostics.migrations.pending.length ? `${diagnostics.migrations.pending.length} pending` : "Current"}</p></div>
          <div className="p-4"><div className="sl-metadata text-critical">SYS-05 / FAILED JOBS</div><div className="
            mt-3 text-lg font-semibold
          ">{failedJobs.reduce((sum, row) => sum + Number(row.count), 0)}</div><p className="
            mt-1 text-sm
          ">Analysis and ingestion</p></div>
        </div>
      </section>

      <section className="
        grid gap-6
        lg:grid-cols-2
      ">
        <div>
          <h2 className="text-xl font-semibold">Configuration checks</h2>
          <div className="
            mt-4 divide-y divide-audit-border border-y border-audit-border
          ">
            {diagnostics.configuration.map((check) => (
              <div key={check.name} className="flex gap-3 p-4">
                <ShieldCheck className={`
                  mt-0.5 size-5
                  ${check.ok ? `text-signal` : `text-audit-amber`}
                `} aria-hidden="true" />
                <div><div className="font-semibold">{check.name}</div><p className="
                  mt-1 text-sm text-audit-body
                ">{check.message}</p></div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-xl font-semibold">AI provider</h2>
          <div className="mt-4 border-y border-audit-border bg-bright-paper p-5">
            <div className="text-lg font-semibold capitalize">{diagnostics.ai.provider}</div>
            <p className="mt-2 text-sm text-audit-body">{diagnostics.ai.message}</p>
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
        <h2 className="text-xl font-semibold">Installation backups</h2>
        <p className="mt-2 max-w-3xl text-sm/6 text-audit-body">
          A complete backup contains a PostgreSQL dump, encrypted integration-secret records, required local documents, migration metadata, and SHA-256 checksums. Restore is deliberately command-line only and requires explicit confirmation.
        </p>
        <div className="mt-4"><BackupPanel canCreate={auth.isSystemAdmin && hasPermission(auth.role, "backups:write")} /></div>
        <div className="mt-4 overflow-x-auto border-y border-audit-border">
          <table className="min-w-full text-left text-sm">
            <caption className="sr-only">Installation backup history</caption>
            <thead className="bg-audit-soft"><tr><th className="p-3">Created</th><th className="
              p-3
            ">Status</th><th className="p-3">Coverage</th><th className="p-3">Size</th><th className="
              p-3
            ">Filesystem path</th></tr></thead>
            <tbody className="divide-y divide-audit-border">
              {backups.length ? backups.map((backup) => (
                <tr key={backup.id}><td className="p-3 whitespace-nowrap">{new Date(backup.created_at).toLocaleString()}</td><td className="
                  p-3 font-semibold
                ">{backup.status}</td><td className="p-3">{backup.includes_database && backup.includes_documents && backup.includes_encrypted_secrets ? "Database + documents + encrypted secrets" : "Incomplete"}</td><td className="
                  p-3
                ">{backup.byte_size == null ? "-" : `${(backup.byte_size / 1024 / 1024).toFixed(1)} MB`}</td><td className="
                  max-w-md p-3 font-mono text-xs break-all
                ">{backup.storage_path || backup.error_message || "In progress"}</td></tr>
              )) : <tr><td colSpan={5} className="p-6 text-audit-muted">No installation backups have been recorded.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold">Append-only audit log</h2>
        <p className="mt-2 text-sm text-audit-body">Recent organization-scoped events. Sensitive metadata is redacted before display.</p>
        <div className="mt-4 overflow-x-auto border-y border-audit-border">
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
              )) : <tr><td colSpan={4} className="p-6 text-audit-muted">No audit events have been recorded yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </Page>
  );
}
