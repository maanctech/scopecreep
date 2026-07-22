import Link from "next/link";
import { CommunicationImportForm } from "@/components/ingestion/CommunicationImportForm";
import { currentAuthContext } from "@/lib/auth/current";
import { hasPermission } from "@/lib/auth/authorization";
import { listIngestionJobs } from "@/lib/ingestion/service";
import { getAppDashboard } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const [dashboard, jobs, auth] = await Promise.all([
    getAppDashboard(),
    listIngestionJobs(),
    currentAuthContext(),
  ]);
  const canImport = Boolean(
    auth && hasPermission(auth.role, "integrations:write"),
  );
  return (
    <div className="space-y-8">
      <section className="border-b border-audit-border pb-7">
        <p className="text-sm font-medium text-audit-muted">
          Private communication intake
        </p>
        <h1 className="mt-2 text-3xl font-semibold">
          Import client communications
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-zinc-700">
          Preview pasted text, CSV, or JSON before saving it to a project.
          Importing does not run AI analysis and never contacts a client.
        </p>
      </section>
      {canImport && dashboard.projects.length ? (
        <CommunicationImportForm
          projects={dashboard.projects.map((project) => ({
            id: project.id,
            label: `${project.client_name} / ${project.project_name}`,
          }))}
        />
      ) : canImport ? (
        <section className="rounded-md border border-audit-border bg-white p-6 shadow-audit">
          <h2 className="text-xl font-semibold">Create a project first</h2>
          <p className="mt-2 max-w-2xl text-zinc-700">
            Communications must be routed to a client project so every source
            record has a clear audit trail. Nothing will be analyzed or sent.
          </p>
          <Link
            href="/app/projects/new"
            className="mt-5 inline-flex min-h-11 items-center rounded-md bg-ink px-5 text-sm font-semibold text-white"
          >
            Create project
          </Link>
        </section>
      ) : (
        <div className="rounded-md border border-audit-border bg-white p-5 text-sm">
          Your role can review import history but cannot add communications.
        </div>
      )}
      <section>
        <h2 className="text-xl font-semibold">Recent import jobs</h2>
        <p className="mt-2 text-sm text-zinc-700">
          Completed and failed jobs remain visible for diagnosis.
        </p>
        <div className="mt-4 overflow-x-auto rounded-md border border-audit-border">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-audit-soft">
              <tr>
                <th className="p-3">Created</th>
                <th className="p-3">Type</th>
                <th className="p-3">Status</th>
                <th className="p-3">Progress</th>
                <th className="p-3">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-audit-border">
              {jobs.length ? (
                jobs.map((job) => (
                  <tr key={String(job.id)}>
                    <td className="p-3">
                      {new Date(String(job.created_at)).toLocaleString()}
                    </td>
                    <td className="p-3">{String(job.job_type)}</td>
                    <td className="p-3 font-medium">{String(job.status)}</td>
                    <td className="p-3">{String(job.progress)}%</td>
                    <td className="p-3">
                      {job.error_message
                        ? String(job.error_message)
                        : job.result
                          ? `${String((job.result as { inserted?: number }).inserted ?? 0)} inserted`
                          : "Pending"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="p-5 text-zinc-600" colSpan={5}>
                    No communication imports yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
