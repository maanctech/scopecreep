import Link from "next/link";
import { BillingSummary } from "@/components/billing/BillingSummary";
import { Disclaimer } from "@/components/ui/Disclaimer";
import { Page, PageHeader, SectionHeader } from "@/components/ui/Page";
import { formatCents } from "@/lib/domain/money";
import { computeRevenueTotals } from "@/lib/domain/revenueTotals";
import { getBillingEvents, getFindings } from "@/lib/store";
import {
  BILLING_EVENT_TYPES,
  WORKFLOW_STATUSES,
  type BillingEventWithContext
} from "@/lib/types";

export const dynamic = "force-dynamic";

type BillingPageProps = {
  searchParams: Promise<{
    client?: string;
    project?: string;
    type?: string;
    status?: string;
    from?: string;
    to?: string;
  }>;
};

function matchesFilters(
  row: BillingEventWithContext,
  filters: Awaited<BillingPageProps["searchParams"]>
) {
  const { event, project } = row;

  if (filters.client && project?.client_name !== filters.client) return false;

  if (filters.project && project?.id !== filters.project) return false;

  if (filters.type && event.event_type !== filters.type) return false;

  if (filters.status && event.new_status !== filters.status) return false;

  const createdDate = event.created_at.slice(0, 10);

  if (filters.from && createdDate < filters.from) return false;

  if (filters.to && createdDate > filters.to) return false;

  return true;
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

export default async function BillingPage({ searchParams }: BillingPageProps) {
  const filters = await searchParams;
  const [allEvents, allFindings] = await Promise.all([getBillingEvents(), getFindings()]);
  const rows = allEvents.filter((row) => matchesFilters(row, filters));

  const demoFindings = allFindings.filter((row) => row.finding.is_demo).map((row) => row.finding);
  const realFindings = allFindings.filter((row) => !row.finding.is_demo).map((row) => row.finding);

  const clients = Array.from(
    new Set(allEvents.map((row) => row.project?.client_name).filter(Boolean))
  ) as string[];
  const projects = Array.from(
    new Map(
      allEvents.filter((row) => row.project).map((row) => [row.project!.id, row.project!])
    ).values()
  );

  return (
    <Page>
      <PageHeader
        eyebrow="Append-only financial record"
        title="Billing history"
        description="Every professional decision and financial transition remains auditable. ScopeLedger never charges clients, sends invoices, or marks an external payment automatically."
        actions={<a href="/api/billing-events?format=csv" className="
          sl-button-secondary
        ">Download CSV</a>}
      />

      <Disclaimer />

      {realFindings.length ? (
        <section className="space-y-4">
          <SectionHeader title="Your live totals" description="These buckets represent distinct workflow states and are never added together." />
          <BillingSummary totals={computeRevenueTotals(realFindings)} />
        </section>
      ) : null}

      {demoFindings.length ? (
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Demo totals</h2>
            <p className="
              mt-1 inline-flex rounded-md border border-audit-amber/30
              bg-audit-amber/5 px-2.5 py-1 text-sm font-semibold
              text-audit-amber
            ">
              Fictional demonstration data
            </p>
          </div>
          <BillingSummary totals={computeRevenueTotals(demoFindings)} />
        </section>
      ) : null}

      <form
        method="GET"
        className="
          sl-panel grid gap-4 p-5
          sm:grid-cols-2
          lg:grid-cols-3
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
          <span className="text-sm font-medium">Event type</span>
          <select
            name="type"
            defaultValue={filters.type ?? ""}
            className="sl-field mt-2"
          >
            <option value="">All event types</option>
            {BILLING_EVENT_TYPES.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Resulting status</span>
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
          <span className="text-sm font-medium">From date</span>
          <input
            type="date"
            name="from"
            defaultValue={filters.from ?? ""}
            className="sl-field mt-2"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">To date</span>
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
            href="/app/billing"
            className="sl-button-secondary"
          >
            Clear
          </Link>
        </div>
      </form>

      <section className="sl-panel">
        <div className="border-b border-audit-border px-5 py-4">
          <h2 className="text-xl font-semibold">
            {rows.length} event{rows.length === 1 ? "" : "s"}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <caption className="sr-only">
              Billing events with client, project, event type, amount, actor, timestamp, and note.
            </caption>
            <thead className="bg-audit-soft text-audit-muted">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium">When</th>
                <th scope="col" className="px-5 py-3 font-medium">Event</th>
                <th scope="col" className="px-5 py-3 font-medium">Client</th>
                <th scope="col" className="px-5 py-3 font-medium">Project</th>
                <th scope="col" className="px-5 py-3 font-medium">Finding</th>
                <th scope="col" className="px-5 py-3 font-medium">Amount</th>
                <th scope="col" className="px-5 py-3 font-medium">Recorded by</th>
                <th scope="col" className="px-5 py-3 font-medium">Note</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map(({ event, finding, project }) => (
                  <tr key={event.id} className="
                    border-t border-audit-border align-top
                  ">
                    <td className="px-5 py-4 whitespace-nowrap">{formatTimestamp(event.created_at)}</td>
                    <td className="px-5 py-4 font-medium">
                      {event.event_type}
                      {event.is_demo ? (
                        <span className="
                          ml-2 rounded-sm border border-audit-border
                          bg-audit-soft px-1.5 py-0.5 text-xs font-semibold
                          text-audit-body
                        ">
                          Demo
                        </span>
                      ) : null}
                    </td>
                    <td className="px-5 py-4">{project?.client_name ?? "Unknown"}</td>
                    <td className="px-5 py-4">{project?.project_name ?? "Unknown"}</td>
                    <td className="max-w-72 px-5 py-4">
                      {finding ? (
                        <span className="leading-6">
                          {finding.classification}: {finding.reasoning.slice(0, 90)}
                          {finding.reasoning.length > 90 ? "..." : ""}
                        </span>
                      ) : (
                        "Unavailable"
                      )}
                    </td>
                    <td data-financial-value className="
                      px-5 py-4 font-semibold text-approved
                    ">
                      {event.amount_cents === null ? "-" : formatCents(event.amount_cents)}
                    </td>
                    <td className="px-5 py-4">{event.actor}</td>
                    <td className="max-w-64 px-5 py-4">{event.note ?? "-"}</td>
                  </tr>
                ))
              ) : (
                <tr className="border-t border-audit-border">
                  <td className="px-5 py-8 text-center text-audit-muted" colSpan={8}>
                    No billing events match these filters.
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
