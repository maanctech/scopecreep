import Link from "next/link";
import { CommunicationImportForm } from "@/components/ingestion/CommunicationImportForm";
import { Page, PageHeader, SectionHeader } from "@/components/ui/Page";
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
    auth && hasPermission(auth.role, "communications:write"),
  );

  return (
    <Page>
      <PageHeader eyebrow="Private communication intake" title="Import client requests" description="Preview pasted text, CSV, or JSON before saving it to a project. Importing never runs AI analysis and never contacts a client." />
      {canImport && dashboard.projects.length ? (
        <CommunicationImportForm
          projects={dashboard.projects.map((project) => ({
            id: project.id,
            label: `${project.client_name} / ${project.project_name}`,
          }))}
        />
      ) : canImport ? (
        <section className="sl-panel p-6">
          <h2 className="text-xl font-semibold">Create a project first</h2>
          <p className="mt-2 max-w-2xl text-audit-body">
            Communications must be routed to a client project so every source
            record has a clear audit trail. Nothing will be analyzed or sent.
          </p>
          <Link href="/app/projects/new" className="sl-button-primary mt-5">
            Create project
          </Link>
        </section>
      ) : (
        <div className="sl-panel p-5 text-sm">
          Your role can review import history but cannot add communications.
        </div>
      )}
      <section>
        <SectionHeader title="Recent import jobs" description="Completed and failed jobs remain visible for diagnosis." />
        <div className="
          mt-4 overflow-x-auto rounded-md border border-audit-border
        ">
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
                  <td className="p-5 text-audit-muted" colSpan={5}>
                    No communication imports yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </Page>
  );
}
