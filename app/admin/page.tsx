import Link from "next/link";
import { LeadStatusForm } from "@/components/forms/LeadStatusForm";
import { getBusinessDashboard } from "@/lib/store";

export const dynamic = "force-dynamic";

function money(value: number | null) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value ?? 0);
}

export default async function AdminDashboardPage() {
  const dashboard = await getBusinessDashboard();

  return (
    <div className="space-y-8">
      <section className="border-b border-audit-border pb-7">
        <h1 className="text-3xl font-semibold">Founder dashboard</h1>
        <p className="mt-3 max-w-2xl text-sm/6 text-zinc-700">
          Manage leads, audit requests, projects, and the manual sales pipeline from
          one local operator view.
        </p>
      </section>

      <section className="
        grid gap-4
        md:grid-cols-5
      ">
        <div className="
          rounded-md border border-audit-border bg-white p-5 shadow-audit
        ">
          <div className="text-sm text-audit-muted">Leads</div>
          <div className="mt-2 text-2xl font-semibold">{dashboard.totals.leads}</div>
        </div>
        <div className="
          rounded-md border border-audit-border bg-white p-5 shadow-audit
        ">
          <div className="text-sm text-audit-muted">Audit requests</div>
          <div className="mt-2 text-2xl font-semibold">{dashboard.totals.audit_requests}</div>
        </div>
        <div className="
          rounded-md border border-audit-border bg-white p-5 shadow-audit
        ">
          <div className="text-sm text-audit-muted">Projects</div>
          <div className="mt-2 text-2xl font-semibold">{dashboard.totals.projects}</div>
        </div>
        <div className="
          rounded-md border border-audit-border bg-white p-5 shadow-audit
        ">
          <div className="text-sm text-audit-muted">Out of scope</div>
          <div className="mt-2 text-2xl font-semibold">{dashboard.totals.out_of_scope_count}</div>
        </div>
        <div className="
          rounded-md border border-audit-border bg-white p-5 shadow-audit
        ">
          <div className="text-sm text-audit-muted">Recovered potential</div>
          <div className="mt-2 text-2xl font-semibold">{money(dashboard.totals.potential_recovered_revenue)}</div>
        </div>
      </section>

      <section className="
        rounded-md border border-audit-border bg-white shadow-audit
      ">
        <div className="border-b border-audit-border px-5 py-4">
          <h2 className="text-xl font-semibold">Incoming leads</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-audit-soft text-audit-muted">
              <tr>
                <th className="px-5 py-3 font-medium">Lead</th>
                <th className="px-5 py-3 font-medium">Company</th>
                <th className="px-5 py-3 font-medium">Business</th>
                <th className="px-5 py-3 font-medium">Rate</th>
                <th className="px-5 py-3 font-medium">Pain point</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.leads.length ? (
                dashboard.leads.map((lead) => (
                  <tr key={lead.id} className="
                    border-t border-audit-border align-top
                  ">
                    <td className="px-5 py-4">
                      <div className="font-medium">{lead.name}</div>
                      <div className="text-audit-muted">{lead.email}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div>{lead.company}</div>
                      {lead.website ? <div className="text-audit-muted">{lead.website}</div> : null}
                    </td>
                    <td className="px-5 py-4">{lead.business_type}</td>
                    <td className="px-5 py-4">{lead.hourly_rate ? money(lead.hourly_rate) : "Unknown"}</td>
                    <td className="max-w-md px-5 py-4 text-zinc-700">{lead.pain_point}</td>
                    <td className="px-5 py-4">
                      <LeadStatusForm leadId={lead.id} status={lead.status} />
                    </td>
                  </tr>
                ))
              ) : (
                <tr className="border-t border-audit-border">
                  <td className="px-5 py-8 text-center text-audit-muted" colSpan={6}>
                    No leads yet. Send prospects to the request audit page.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="
        grid gap-6
        lg:grid-cols-2
      ">
        <div className="
          rounded-md border border-audit-border bg-white shadow-audit
        ">
          <div className="border-b border-audit-border px-5 py-4">
            <h2 className="text-xl font-semibold">Audit requests</h2>
          </div>
          <div className="divide-y divide-audit-border">
            {dashboard.auditRequests.length ? (
              dashboard.auditRequests.map((request) => {
                const project = dashboard.projects.find((item) => item.audit_request_id === request.id);

                return <div key={request.id} className="p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold">{request.client_name}</div>
                      <div className="text-sm text-audit-muted">
                        {money(request.project_value)} project | {money(request.hourly_rate)}/hour
                      </div>
                    </div>
                    <span className="
                      rounded-md border border-audit-border px-2 py-1 text-xs
                    ">{request.status}</span>
                  </div>
                  {request.suspected_scope_creep_notes ? (
                    <p className="mt-3 text-sm/6 text-zinc-700">{request.suspected_scope_creep_notes}</p>
                  ) : null}
                  {project ? (
                    <div className="mt-4 flex flex-wrap gap-3">
                      <Link className="
                        font-semibold underline underline-offset-4
                      " href={`/app/projects/${project.id}/sow`}>
                        Review SOW
                      </Link>
                      <Link className="
                        font-semibold underline underline-offset-4
                      " href={`/app/projects/${project.id}`}>
                        Open audit
                      </Link>
                    </div>
                  ) : null}
                </div>;
              })
            ) : (
              <div className="p-5 text-sm text-audit-muted">No audit requests submitted yet.</div>
            )}
          </div>
        </div>

        <div className="
          rounded-md border border-audit-border bg-white shadow-audit
        ">
          <div className="border-b border-audit-border px-5 py-4">
            <h2 className="text-xl font-semibold">Highest estimated leakage</h2>
          </div>
          <div className="divide-y divide-audit-border">
            {dashboard.companies.length ? (
              dashboard.companies.slice(0, 6).map((company) => (
                <div key={company.id} className="
                  flex items-center justify-between gap-3 p-5
                ">
                  <div>
                    <div className="font-semibold">{company.name}</div>
                    <div className="text-sm text-audit-muted">{company.business_type ?? "Unknown business type"}</div>
                  </div>
                  <div className="text-right font-semibold">{money(company.estimated_leakage)}</div>
                </div>
              ))
            ) : (
              <div className="p-5 text-sm text-audit-muted">No companies to rank yet.</div>
            )}
          </div>
        </div>
      </section>

      <section className="
        rounded-md border border-audit-border bg-white shadow-audit
      ">
        <div className="border-b border-audit-border px-5 py-4">
          <h2 className="text-xl font-semibold">Projects under review</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-audit-soft text-audit-muted">
              <tr>
                <th className="px-5 py-3 font-medium">Client</th>
                <th className="px-5 py-3 font-medium">Project</th>
                <th className="px-5 py-3 font-medium">Leakage</th>
                <th className="px-5 py-3 font-medium">Flagged</th>
                <th className="px-5 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.projects.length ? (
                dashboard.projects.map((project) => (
                  <tr key={project.id} className="border-t border-audit-border">
                    <td className="px-5 py-4 font-medium">{project.client_name}</td>
                    <td className="px-5 py-4">{project.project_name}</td>
                    <td className="px-5 py-4 font-semibold">{money(project.potential_recovered_revenue)}</td>
                    <td className="px-5 py-4">{project.out_of_scope_count}</td>
                    <td className="px-5 py-4">
                      <Link className="
                        font-semibold underline underline-offset-4
                      " href={`/app/projects/${project.id}`}>
                        Open audit
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr className="border-t border-audit-border">
                  <td className="px-5 py-8 text-center text-audit-muted" colSpan={5}>
                    No projects are under review yet.
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
