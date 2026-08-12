import Link from "next/link";
import { Disclaimer } from "@/components/ui/Disclaimer";
import { Page, PageHeader } from "@/components/ui/Page";
import { findingDisplayLabel } from "@/lib/domain/findingTransitions";
import { formatCents, formatDollars } from "@/lib/domain/money";
import { getFindings } from "@/lib/store";
import {
  BILLING_DECISIONS,
  CLASSIFICATIONS,
  WORKFLOW_STATUSES,
  type FindingWithContext
} from "@/lib/types";

export const dynamic = "force-dynamic";

type FindingsPageProps = {
  searchParams: Promise<{
    client?: string;
    project?: string;
    classification?: string;
    decision?: string;
    status?: string;
    from?: string;
    to?: string;
  }>;
};

function matchesFilters(
  row: FindingWithContext,
  filters: Awaited<FindingsPageProps["searchParams"]>
) {
  const { finding, project } = row;

  if (filters.client && project?.client_name !== filters.client) return false;

  if (filters.project && project?.id !== filters.project) return false;

  if (filters.classification && finding.classification !== filters.classification) return false;

  if (filters.decision && finding.billing_decision !== filters.decision) return false;

  if (filters.status && finding.workflow_status !== filters.status) return false;

  const createdDate = finding.created_at.slice(0, 10);

  if (filters.from && createdDate < filters.from) return false;

  if (filters.to && createdDate > filters.to) return false;

  return true;
}

export default async function FindingsPage({ searchParams }: FindingsPageProps) {
  const filters = await searchParams;
  const allFindings = await getFindings();
  const rows = allFindings.filter((row) => matchesFilters(row, filters));

  const clients = Array.from(
    new Set(allFindings.map((row) => row.project?.client_name).filter(Boolean))
  ) as string[];
  const projects = Array.from(
    new Map(
      allFindings
        .filter((row) => row.project)
        .map((row) => [row.project!.id, row.project!])
    ).values()
  );

  return (
    <Page>
      <PageHeader eyebrow="Revenue evidence" title="All findings" description="Compare every evidence-linked request across projects. Potential estimates and professional-entered financial values remain separate." />

      <Disclaimer />

      <form
        method="GET"
        className="
          sl-panel grid gap-4 p-5
          sm:grid-cols-2
          lg:grid-cols-4
        "
      >
        <label className="block">
          <span className="text-sm font-medium">Client</span>
          <select
            name="client"
            defaultValue={filters.client ?? ""}
            className="sl-field mt-2"
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
            className="sl-field mt-2"
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
            className="sl-field mt-2"
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
            className="sl-field mt-2"
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
            className="sl-field mt-2"
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
            className="sl-field mt-2"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Created on or before</span>
          <input
            type="date"
            name="to"
            defaultValue={filters.to ?? ""}
            className="sl-field mt-2"
          />
        </label>
        <div className="flex items-end gap-3">
          <button
            type="submit"
            className="sl-button-primary"
          >
            Apply filters
          </button>
          <Link
            href="/app/findings"
            className="sl-button-secondary"
          >
            Clear
          </Link>
        </div>
      </form>

      <section className="sl-panel">
        <div className="border-b border-audit-border px-5 py-4">
          <h2 className="text-xl font-semibold">
            {rows.length} finding{rows.length === 1 ? "" : "s"}
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
                          mt-1 inline-block rounded-sm border
                          border-audit-border bg-audit-soft px-1.5 py-0.5
                          text-xs font-semibold text-audit-body
                        ">
                          Fictional demo data
                        </span>
                      ) : null}
                    </td>
                    <td className="px-5 py-4">{project?.client_name ?? "Unknown"}</td>
                    <td className="px-5 py-4">{project?.project_name ?? "Unknown"}</td>
                    <td data-financial-value className="
                      px-5 py-4 font-semibold text-audit-amber
                    ">{formatDollars(finding.estimated_revenue)}</td>
                    <td data-financial-value className="
                      px-5 py-4 font-semibold text-approved
                    ">
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
      </section>
    </Page>
  );
}
