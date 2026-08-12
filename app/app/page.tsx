import Link from "next/link";
import { Plus } from "lucide-react";
import { BillingSummary } from "@/components/billing/BillingSummary";
import { Disclaimer } from "@/components/ui/Disclaimer";
import { Page, PageHeader, SectionHeader } from "@/components/ui/Page";
import { formatCents, formatDollars } from "@/lib/domain/money";
import { getAppDashboard } from "@/lib/store";
import { currentAuthContext } from "@/lib/auth/current";
import { hasPermission } from "@/lib/auth/authorization";

export const dynamic = "force-dynamic";

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

export default async function ProductDashboardPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const query = await searchParams;
  const auth = await currentAuthContext();
  const canCreateProject = Boolean(auth && hasPermission(auth.role, "projects:write"));
  const dashboard = await getAppDashboard();

  return (
    <Page>
      {query.notice === "permission-denied" ? (
        <div role="alert" className="
          rounded-md border border-audit-amber/30 bg-audit-amber/5 p-4 text-sm
          text-audit-amber
        ">
          Your role does not allow access to that page. No data was changed.
        </div>
      ) : null}
      <PageHeader
        eyebrow="Revenue control"
        title="Revenue workflow"
        description="Review evidence-linked findings, make explicit billing decisions, and track potential, approved, invoiced, and recovered value without combining those stages."
        actions={
          <>
          <Link
            href="/app/findings"
            className="sl-button-secondary"
          >
            All findings
          </Link>
          {canCreateProject ? (
            <Link
              href="/app/projects/new"
              className="sl-button-primary"
            >
              <Plus className="size-4" aria-hidden="true" />
              New project
            </Link>
          ) : null}
          </>
        }
      />

      <Disclaimer />

      {!dashboard.projects.length ? (
        <section className="border-y border-audit-border py-6">
          <h2 className="text-xl font-semibold tracking-tight">Start the first revenue audit</h2>
          <ol className="
            mt-4 grid gap-4 text-sm
            sm:grid-cols-3
          ">
            <li><span className="font-semibold">1. Add the engagement.</span><p className="
              mt-1 text-audit-body
            ">Create a project and paste the signed SOW.</p></li>
            <li><span className="font-semibold">2. Approve scope boundaries.</span><p className="
              mt-1 text-audit-body
            ">Review the SOW map before any communication can be analyzed.</p></li>
            <li><span className="font-semibold">3. Import and review.</span><p className="
              mt-1 text-audit-body
            ">Import client requests, run selected analyses, then make each billing decision.</p></li>
          </ol>
          {canCreateProject ? (
            <Link className="
              mt-5 inline-block font-semibold underline underline-offset-4
            " href="/app/projects/new">
              Create the first project
            </Link>
          ) : null}
        </section>
      ) : null}

      {dashboard.hasRealFindings ? (
        <section className="space-y-4">
          <SectionHeader title="Your live totals" description="Potential and professional-entered financial stages are reported separately." />
          <BillingSummary totals={dashboard.realTotals} />
        </section>
      ) : null}

      {dashboard.hasDemoFindings ? (
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Demo totals</h2>
            <p className="
              mt-1 inline-flex rounded-md border border-audit-amber/30
              bg-audit-amber/5 px-2.5 py-1 text-sm font-semibold
              text-audit-amber
            ">
              Fictional demonstration data
            </p>
            <p className="mt-2 text-sm text-audit-muted">
              These totals come only from the fictional Northstar Digital Studio / ApertureOps demo
              and are never mixed with your real totals.
            </p>
          </div>
          <BillingSummary totals={dashboard.demoTotals} />
        </section>
      ) : null}

      <section className="
        grid gap-6
        lg:grid-cols-2
      ">
        <div className="sl-panel">
          <div className="border-b border-audit-border px-5 py-4">
            <h2 className="text-xl font-semibold">Findings needing your attention</h2>
            <p className="mt-1 text-sm text-audit-muted">
              Flagged requests without a billing decision yet, largest first.
            </p>
          </div>
          <ul className="divide-y divide-audit-border">
            {dashboard.attention.length ? (
              dashboard.attention.map(({ finding, message, project }) => (
                <li key={finding.id} className="px-5 py-4">
                  <div className="
                    flex flex-wrap items-baseline justify-between gap-2
                  ">
                    <span className="font-semibold">{formatDollars(finding.estimated_revenue)}</span>
                    <span className="text-sm text-audit-muted">
                      {project?.client_name ?? "Unknown client"}
                      {finding.is_demo ? " (demo)" : ""}
                    </span>
                  </div>
                  <p className="mt-1 text-sm/6 text-audit-body">
                    {message?.message_text ?? finding.reasoning}
                  </p>
                  {project ? (
                    <Link
                      className="
                        mt-2 inline-block text-sm font-semibold underline
                        underline-offset-4
                      "
                      href={`/app/projects/${project.id}?show=needs-review`}
                    >
                      Review this finding
                    </Link>
                  ) : null}
                </li>
              ))
            ) : (
              <li className="px-5 py-6 text-sm text-audit-muted">
                Nothing is waiting for review right now.
              </li>
            )}
          </ul>
        </div>

        <div className="space-y-6">
          <div className="sl-panel">
            <div className="border-b border-audit-border px-5 py-4">
              <h2 className="text-xl font-semibold">Recent decisions</h2>
            </div>
            <ul className="divide-y divide-audit-border">
              {dashboard.recentDecisions.length ? (
                dashboard.recentDecisions.map(({ event, project }) => (
                  <li key={event.id} className="px-5 py-3 text-sm">
                    <div className="
                      flex flex-wrap items-baseline justify-between gap-2
                    ">
                      <span className="font-semibold">{event.event_type}</span>
                      <span className="text-audit-muted">{formatTimestamp(event.created_at)}</span>
                    </div>
                    <p className="mt-1 text-audit-body">
                      {project?.client_name ?? "Unknown client"}
                      {event.amount_cents !== null ? ` - ${formatCents(event.amount_cents)}` : ""}
                      {event.is_demo ? " (demo)" : ""}
                    </p>
                  </li>
                ))
              ) : (
                <li className="px-5 py-6 text-sm text-audit-muted">No decisions recorded yet.</li>
              )}
            </ul>
          </div>

          <div className="sl-panel">
            <div className="
              flex items-center justify-between border-b border-audit-border
              px-5 py-4
            ">
              <h2 className="text-xl font-semibold">Recent billing events</h2>
              <Link className="
                text-sm font-semibold underline underline-offset-4
              " href="/app/billing">
                View all
              </Link>
            </div>
            <ul className="divide-y divide-audit-border">
              {dashboard.recentEvents.length ? (
                dashboard.recentEvents.map(({ event, project }) => (
                  <li key={event.id} className="px-5 py-3 text-sm">
                    <div className="
                      flex flex-wrap items-baseline justify-between gap-2
                    ">
                      <span className="font-semibold">{event.event_type}</span>
                      <span className="text-audit-muted">{formatTimestamp(event.created_at)}</span>
                    </div>
                    <p className="mt-1 text-audit-body">
                      {project?.client_name ?? "Unknown client"} - by {event.actor}
                      {event.is_demo ? " (demo)" : ""}
                    </p>
                  </li>
                ))
              ) : (
                <li className="px-5 py-6 text-sm text-audit-muted">No billing events yet.</li>
              )}
            </ul>
          </div>
        </div>
      </section>

      <section className="sl-panel">
        <div className="border-b border-audit-border px-5 py-4">
          <h2 className="text-xl font-semibold">Revenue by project</h2>
          <p className="mt-1 text-sm text-audit-muted">
            Potential values are AI estimates. Approved, invoiced, and paid values are amounts you
            approved yourself.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-sm">
            <caption className="sr-only">
              Revenue totals for each project: potential, approved, invoiced, and paid amounts.
            </caption>
            <thead className="bg-audit-soft text-audit-muted">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium">Client</th>
                <th scope="col" className="px-5 py-3 font-medium">Project</th>
                <th scope="col" className="px-5 py-3 font-medium">Potential (AI)</th>
                <th scope="col" className="px-5 py-3 font-medium">Approved</th>
                <th scope="col" className="px-5 py-3 font-medium">Invoiced</th>
                <th scope="col" className="px-5 py-3 font-medium">Paid</th>
                <th scope="col" className="px-5 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.revenueByProject.length ? (
                dashboard.revenueByProject.map(({ project, totals }) => (
                  <tr key={project.id} className="border-t border-audit-border">
                    <td className="px-5 py-4 font-medium">
                      {project.client_name}
                      {project.is_demo ? (
                        <span className="
                          ml-2 rounded-sm border border-audit-border
                          bg-audit-soft px-1.5 py-0.5 text-xs font-semibold
                          text-audit-body
                        ">
                          Demo
                        </span>
                      ) : null}
                    </td>
                    <td className="px-5 py-4">{project.project_name}</td>
                    <td className="px-5 py-4">{formatDollars(totals.potential_dollars)}</td>
                    <td className="px-5 py-4">{formatCents(totals.billable_cents)}</td>
                    <td className="px-5 py-4">{formatCents(totals.invoiced_cents)}</td>
                    <td className="px-5 py-4 font-semibold">{formatCents(totals.paid_cents)}</td>
                    <td className="px-5 py-4">
                      <Link
                        className="font-semibold underline underline-offset-4"
                        href={`/app/projects/${project.id}`}
                      >
                        Open project
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr className="border-t border-audit-border">
                  <td className="px-5 py-8 text-center text-audit-muted" colSpan={7}>
                    No projects yet. Create a project to start a scope audit.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="sl-panel">
        <div className="border-b border-audit-border px-5 py-4">
          <h2 className="text-xl font-semibold">Revenue by client</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <caption className="sr-only">
              Revenue totals grouped by client: potential, approved, invoiced, and paid amounts.
            </caption>
            <thead className="bg-audit-soft text-audit-muted">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium">Client</th>
                <th scope="col" className="px-5 py-3 font-medium">Potential (AI)</th>
                <th scope="col" className="px-5 py-3 font-medium">Approved</th>
                <th scope="col" className="px-5 py-3 font-medium">Invoiced</th>
                <th scope="col" className="px-5 py-3 font-medium">Paid</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.revenueByClient.length ? (
                dashboard.revenueByClient.map((row) => (
                  <tr key={`${row.client_name}-${row.is_demo}`} className="
                    border-t border-audit-border
                  ">
                    <td className="px-5 py-4 font-medium">
                      {row.client_name}
                      {row.is_demo ? (
                        <span className="
                          ml-2 rounded-sm border border-audit-border
                          bg-audit-soft px-1.5 py-0.5 text-xs font-semibold
                          text-audit-body
                        ">
                          Demo
                        </span>
                      ) : null}
                    </td>
                    <td className="px-5 py-4">{formatDollars(row.totals.potential_dollars)}</td>
                    <td className="px-5 py-4">{formatCents(row.totals.billable_cents)}</td>
                    <td className="px-5 py-4">{formatCents(row.totals.invoiced_cents)}</td>
                    <td className="px-5 py-4 font-semibold">{formatCents(row.totals.paid_cents)}</td>
                  </tr>
                ))
              ) : (
                <tr className="border-t border-audit-border">
                  <td className="px-5 py-8 text-center text-audit-muted" colSpan={5}>
                    No clients yet.
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
