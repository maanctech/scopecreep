import Link from "next/link";
import { Disclaimer } from "@/components/ui/Disclaimer";
import { PageNavigation } from "@/components/ui/PageNavigation";
import { findingDisplayLabel } from "@/lib/domain/findingTransitions";
import { formatCents, formatDollars } from "@/lib/domain/money";
import { getFilterOptions, listFindings } from "@/lib/store";
import type { FindingFilters } from "@/lib/store/filters";
import { BILLING_DECISIONS, CLASSIFICATIONS, WORKFLOW_STATUSES } from "@/lib/types";

export const dynamic = "force-dynamic";

type FindingsPageProps = {
  searchParams: Promise<FindingFilters & { cursor?: string }>;
};

export default async function FindingsPage({ searchParams }: FindingsPageProps) {
  const { cursor, ...filters } = await searchParams;
  const [page, options] = await Promise.all([listFindings(filters, { cursor }), getFilterOptions()]);
  const rows = page.rows;
  const { clients, projects } = options;

  return (
    <div className="space-y-8">
      <section className="border-b border-audit-border pb-7">
        <h1 className="text-3xl font-semibold">All scope findings</h1>
        <p className="mt-3 max-w-2xl text-base/7 text-zinc-700">
          Every AI-flagged request across all projects, with your billing decisions. Open a
          project to review and decide on a finding.
        </p>
      </section>

      <Disclaimer />

      <form
        method="GET"
        className="
          grid gap-4 rounded-md border border-audit-border bg-white p-5
          shadow-audit
          sm:grid-cols-2
          lg:grid-cols-4
        "
      >
        <label className="block">
          <span className="text-sm font-medium">Client</span>
          <select
            name="client"
            defaultValue={filters.client ?? ""}
            className="
              mt-2 w-full rounded-md border border-audit-border px-3 py-2
            "
          >
            <option value="">All clients</option>
            {clients.map((client) => (
              <option key={client}>{client}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Project</span>
          <select
            name="project"
            defaultValue={filters.project ?? ""}
            className="
              mt-2 w-full rounded-md border border-audit-border px-3 py-2
            "
          >
            <option value="">All projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.project_name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Classification</span>
          <select
            name="classification"
            defaultValue={filters.classification ?? ""}
            className="
              mt-2 w-full rounded-md border border-audit-border px-3 py-2
            "
          >
            <option value="">All classifications</option>
            {CLASSIFICATIONS.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Billing decision</span>
          <select
            name="decision"
            defaultValue={filters.decision ?? ""}
            className="
              mt-2 w-full rounded-md border border-audit-border px-3 py-2
            "
          >
            <option value="">All decisions</option>
            {BILLING_DECISIONS.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Workflow status</span>
          <select
            name="status"
            defaultValue={filters.status ?? ""}
            className="
              mt-2 w-full rounded-md border border-audit-border px-3 py-2
            "
          >
            <option value="">All statuses</option>
            {WORKFLOW_STATUSES.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Created on or after</span>
          <input
            type="date"
            name="from"
            defaultValue={filters.from ?? ""}
            className="
              mt-2 w-full rounded-md border border-audit-border px-3 py-2
            "
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Created on or before</span>
          <input
            type="date"
            name="to"
            defaultValue={filters.to ?? ""}
            className="
              mt-2 w-full rounded-md border border-audit-border px-3 py-2
            "
          />
        </label>
        <div className="flex items-end gap-3">
          <button
            type="submit"
            className="
              inline-flex h-11 items-center rounded-md bg-ink px-5 text-sm
              font-semibold text-white
              hover:bg-zinc-800
            "
          >
            Apply filters
          </button>
          <Link
            href="/app/findings"
            className="
              inline-flex h-11 items-center rounded-md border
              border-audit-border px-4 text-sm font-semibold
              hover:bg-audit-soft
            "
          >
            Clear
          </Link>
        </div>
      </form>

      <section className="
        rounded-md border border-audit-border bg-white shadow-audit
      ">
        <div className="border-b border-audit-border px-5 py-4">
          <h2 className="text-xl font-semibold">
            {rows.length} finding{rows.length === 1 ? "" : "s"} on this page
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <caption className="sr-only">
              Scope findings with client, project, potential and approved value, decision, and
              status.
            </caption>
            <thead className="bg-audit-soft text-audit-muted">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium">Request</th>
                <th scope="col" className="px-5 py-3 font-medium">Client</th>
                <th scope="col" className="px-5 py-3 font-medium">Project</th>
                <th scope="col" className="px-5 py-3 font-medium">Potential (AI)</th>
                <th scope="col" className="px-5 py-3 font-medium">Approved by you</th>
                <th scope="col" className="px-5 py-3 font-medium">Decision</th>
                <th scope="col" className="px-5 py-3 font-medium">Status</th>
                <th scope="col" className="px-5 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map(({ finding, message, project }) => (
                  <tr key={finding.id} className="
                    border-t border-audit-border align-top
                  ">
                    <td className="max-w-96 px-5 py-4">
                      <p className="leading-6">{message?.message_text ?? finding.reasoning}</p>
                      {finding.is_demo ? (
                        <span className="
                          mt-1 inline-block rounded-sm border border-zinc-300
                          bg-zinc-100 px-1.5 py-0.5 text-xs font-semibold
                          text-zinc-700
                        ">
                          Fictional demo data
                        </span>
                      ) : null}
                    </td>
                    <td className="px-5 py-4">{project?.client_name ?? "Unknown"}</td>
                    <td className="px-5 py-4">{project?.project_name ?? "Unknown"}</td>
                    <td className="px-5 py-4">{formatDollars(finding.estimated_revenue)}</td>
                    <td className="px-5 py-4">
                      {finding.approved_amount_cents === null
                        ? "Not set"
                        : formatCents(finding.approved_amount_cents)}
                    </td>
                    <td className="px-5 py-4">{finding.billing_decision}</td>
                    <td className="px-5 py-4">{findingDisplayLabel(finding)}</td>
                    <td className="px-5 py-4">
                      {project ? (
                        <Link
                          className="font-semibold underline underline-offset-4"
                          href={`/app/projects/${project.id}`}
                        >
                          Review
                        </Link>
                      ) : (
                        "Unavailable"
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr className="border-t border-audit-border">
                  <td className="px-5 py-8 text-center text-audit-muted" colSpan={8}>
                    No findings match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <PageNavigation
          basePath="/app/findings"
          filters={filters}
          cursor={cursor}
          nextCursor={page.nextCursor}
        />
      </section>
    </div>
  );
}
