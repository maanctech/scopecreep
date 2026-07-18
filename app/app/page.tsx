import Link from "next/link";
import { Plus, ShieldCheck } from "lucide-react";
import { Disclaimer } from "@/components/Disclaimer";
import { getAppDashboard } from "@/lib/store";

export const dynamic = "force-dynamic";

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

export default async function ProductDashboardPage() {
  const dashboard = await getAppDashboard();

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 border-b border-audit-border pb-7 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-audit-muted">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Audit console
          </div>
          <h1 className="mt-2 text-3xl font-semibold">Revenue leakage dashboard</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-700">
            Create projects, paste SOWs, analyze client requests, and generate markdown
            audit reports for founder-led delivery.
          </p>
        </div>
        <Link
          href="/app/projects/new"
          className="inline-flex h-11 items-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-white hover:bg-zinc-800"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          New project
        </Link>
      </section>

      <Disclaimer />

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-md border border-audit-border bg-white p-5 shadow-audit">
          <div className="text-sm text-audit-muted">Potential recovered revenue</div>
          <div className="mt-2 text-2xl font-semibold">{money(dashboard.totals.potential_recovered_revenue)}</div>
        </div>
        <div className="rounded-md border border-audit-border bg-white p-5 shadow-audit">
          <div className="text-sm text-audit-muted">Out-of-scope requests</div>
          <div className="mt-2 text-2xl font-semibold">{dashboard.totals.out_of_scope_count}</div>
        </div>
        <div className="rounded-md border border-audit-border bg-white p-5 shadow-audit">
          <div className="text-sm text-audit-muted">Messages analyzed</div>
          <div className="mt-2 text-2xl font-semibold">{dashboard.totals.messages_analyzed}</div>
        </div>
        <div className="rounded-md border border-audit-border bg-white p-5 shadow-audit">
          <div className="text-sm text-audit-muted">Projects</div>
          <div className="mt-2 text-2xl font-semibold">{dashboard.totals.projects}</div>
        </div>
      </section>

      <section className="rounded-md border border-audit-border bg-white shadow-audit">
        <div className="border-b border-audit-border px-5 py-4">
          <h2 className="text-xl font-semibold">Projects</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-audit-soft text-audit-muted">
              <tr>
                <th className="px-5 py-3 font-medium">Client</th>
                <th className="px-5 py-3 font-medium">Project</th>
                <th className="px-5 py-3 font-medium">Messages</th>
                <th className="px-5 py-3 font-medium">Out of scope</th>
                <th className="px-5 py-3 font-medium">Leakage</th>
                <th className="px-5 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.projects.length ? (
                dashboard.projects.map((project) => (
                  <tr key={project.id} className="border-t border-audit-border">
                    <td className="px-5 py-4 font-medium">{project.client_name}</td>
                    <td className="px-5 py-4">{project.project_name}</td>
                    <td className="px-5 py-4">{project.messages_analyzed}</td>
                    <td className="px-5 py-4">{project.out_of_scope_count}</td>
                    <td className="px-5 py-4 font-semibold">{money(project.potential_recovered_revenue)}</td>
                    <td className="px-5 py-4">
                      <Link className="font-semibold underline underline-offset-4" href={`/app/projects/${project.id}`}>
                        Open
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr className="border-t border-audit-border">
                  <td className="px-5 py-8 text-center text-audit-muted" colSpan={6}>
                    No projects yet. Create a project to start a scope audit.
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
