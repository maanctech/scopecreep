import Link from "next/link";
import { notFound } from "next/navigation";
import { Disclaimer } from "@/components/ui/Disclaimer";
import { FindingCard } from "@/components/findings/FindingCard";
import { MessageAnalysisForm } from "@/components/forms/MessageAnalysisForm";
import { findingDisplayLabel } from "@/lib/domain/findingTransitions";
import { formatDollars } from "@/lib/domain/money";
import { computeRevenueTotals } from "@/lib/domain/revenueTotals";
import { BillingSummary } from "@/components/billing/BillingSummary";
import { getBillingEvents, getProjectDetail } from "@/lib/store";
import type { ScopeFinding } from "@/lib/types";
import { currentAuthContext } from "@/lib/auth/current";
import { hasPermission } from "@/lib/auth/authorization";
import { projectAutomationForOrganization } from "@/lib/automation/service";
import { ProjectAutomationControl } from "@/components/automation/ProjectAutomationControl";

export const dynamic = "force-dynamic";

type ProjectPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; show?: string; finding?: string }>;
};

const REVIEW_FILTERS = [
  { key: "all", label: "All requests" },
  { key: "needs-review", label: "Needs review" },
  { key: "decided", label: "Decided" },
  { key: "in-scope", label: "In scope" }
] as const;

function matchesFilter(finding: ScopeFinding | null, filter: string) {
  if (filter === "all") return true;

  if (!finding) return filter === "all";

  const label = findingDisplayLabel(finding);

  if (filter === "needs-review") return label === "Needs Review";

  if (filter === "in-scope") return finding.classification === "In Scope";

  if (filter === "decided") {
    return label !== "Needs Review" && finding.classification !== "In Scope";
  }

  return true;
}

export default async function ProjectPage({ params, searchParams }: ProjectPageProps) {
  const { id } = await params;
  const query = await searchParams;
  const auth = await currentAuthContext();
  const canReview = Boolean(auth && hasPermission(auth.role, "findings:review"));
  const canManageAutomation = Boolean(
    auth && hasPermission(auth.role, "integrations:write"),
  );
  const detail = await getProjectDetail(id);

  if (!detail) notFound();

  const automation = canManageAutomation && auth
    ? await projectAutomationForOrganization(auth.organizationId, id).catch(() => null)
    : null;

  const allEvents = await getBillingEvents();
  const findings = detail.messages
    .map((row) => row.finding)
    .filter((finding): finding is ScopeFinding => Boolean(finding));
  const totals = computeRevenueTotals(findings);
  const boundaryApproved = Boolean(detail.project.active_boundary_map_id);
  const filter = REVIEW_FILTERS.some((item) => item.key === query.show) ? query.show! : "all";
  const selectedFindingExists = Boolean(
    query.finding && detail.messages.some((row) => row.finding?.id === query.finding)
  );
  const visibleRows = selectedFindingExists
    ? detail.messages.filter((row) => row.finding?.id === query.finding)
    : detail.messages.filter((row) => matchesFilter(row.finding, filter));

  return (
    <div className="space-y-8">
      <section className="
        flex flex-col gap-4 border-b border-audit-border pb-7
        lg:flex-row lg:items-end lg:justify-between
      ">
        <div>
          <div className="text-sm text-audit-muted">
            {detail.project.client_name}
            {detail.project.is_demo ? " - Fictional demonstration data" : ""}
          </div>
          <h1 className="mt-2 text-3xl font-semibold">{detail.project.project_name}</h1>
          <p className="mt-3 max-w-2xl text-base/7 text-zinc-700">
            Hourly rate: {formatDollars(detail.project.hourly_rate)}
            {detail.project.project_value
              ? ` | Project value: ${formatDollars(detail.project.project_value)}`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {boundaryApproved ? <Link href={`/app/projects/${detail.project.id}/analysis`} className="
            inline-flex h-11 items-center justify-center rounded-md border
            border-ink px-4 text-sm font-semibold
            hover:bg-audit-soft
          ">Analyze imported messages</Link> : null}
          <Link href={`/app/projects/${detail.project.id}/sow`} className="
            inline-flex h-11 items-center justify-center rounded-md border
            border-ink px-4 text-sm font-semibold
            hover:bg-audit-soft
          ">Review SOW</Link>
          <Link href={`/app/projects/${detail.project.id}/report`} className="
            inline-flex h-11 items-center justify-center rounded-md bg-ink px-4
            text-sm font-semibold text-white
            hover:bg-zinc-800
          ">View audit report</Link>
        </div>
      </section>

      {query.created === "audit" ? (
        <div className="
          rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm
          text-emerald-800
        ">
          Audit workspace created. Analyze individual client requests below, then review each
          finding.
        </div>
      ) : null}
      {query.created === "project" ? (
        <div className="
          rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm
          text-emerald-800
        ">
          Project saved. Review and approve the SOW boundary before analyzing client requests.
        </div>
      ) : null}

      <Disclaimer />

      {canManageAutomation ? (
        <ProjectAutomationControl
          projectId={detail.project.id}
          initialAutomation={automation}
        />
      ) : null}

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Where this project&apos;s money stands</h2>
        <BillingSummary totals={totals} />
      </section>

      <section className="
        rounded-md border border-audit-border bg-audit-soft p-5
      ">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="
          text-xl font-semibold
        ">Current SOW text</h2><Link href={`/app/projects/${detail.project.id}/sow`} className="
          text-sm font-semibold underline
        ">Open version and boundary workspace</Link></div>
        <p className="
          mt-3 max-h-44 overflow-auto text-sm/6 whitespace-pre-wrap
          text-zinc-700
        ">
          {detail.project.sow_text}
        </p>
      </section>

      {canReview && boundaryApproved ? (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Analyze a new client message</h2>
          <MessageAnalysisForm projectId={detail.project.id} />
        </section>
      ) : canReview ? (
        <section className="
          rounded-md border border-amber-300 bg-amber-50 p-5 text-amber-950
        ">
          <h2 className="text-xl font-semibold">Approve the scope boundary before analysis</h2>
          <p className="mt-2 max-w-2xl text-sm/6">
            The SOW is saved, but no boundary map has professional approval yet. Analysis remains
            unavailable so findings cannot be based on an unreviewed contract interpretation.
          </p>
          <Link className="
            mt-4 inline-block font-semibold underline underline-offset-4
          " href={`/app/projects/${detail.project.id}/sow`}>
            Review and approve the SOW
          </Link>
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Review findings</h2>
          <span className="text-sm text-audit-muted">
            Showing {visibleRows.length} of {detail.messages.length}
          </span>
        </div>
        <nav aria-label="Filter findings" className="flex flex-wrap gap-2">
          {REVIEW_FILTERS.map((item) => (
            <Link
              key={item.key}
              href={
                item.key === "all"
                  ? `/app/projects/${detail.project.id}`
                  : `/app/projects/${detail.project.id}?show=${item.key}`
              }
              aria-current={filter === item.key ? "page" : undefined}
              className={`
                inline-flex h-10 items-center rounded-md border px-4 text-sm
                font-medium
                ${
                filter === item.key
                  ? "border-ink bg-ink text-white"
                  : `
                    border-audit-border bg-white
                    hover:bg-audit-soft
                  `
              }
              `}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="grid gap-5">
          {visibleRows.length ? (
            visibleRows.map((row) => (
              <div key={row.message.id} id={row.finding ? `finding-${row.finding.id}` : undefined}>
                <FindingCard
                  row={row}
                  events={
                    row.finding
                      ? allEvents
                          .filter((item) => item.event.scope_finding_id === row.finding!.id)
                          .map((item) => item.event)
                      : []
                  }
                  canReview={canReview}
                />
              </div>
            ))
          ) : (
            <div className="
              rounded-md border border-audit-border bg-white p-6 text-sm
              text-audit-muted shadow-audit
            ">
              {detail.messages.length
                ? "No findings match this filter."
                : "No messages analyzed yet."}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
