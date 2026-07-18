import Link from "next/link";
import { notFound } from "next/navigation";
import { AnalysisCard } from "@/components/AnalysisCard";
import { Disclaimer } from "@/components/Disclaimer";
import { MessageAnalysisForm } from "@/components/forms/MessageAnalysisForm";
import { getProjectDetail } from "@/lib/store";

export const dynamic = "force-dynamic";

type ProjectPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
};

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

export default async function ProjectPage({ params, searchParams }: ProjectPageProps) {
  const { id } = await params;
  const query = await searchParams;
  const detail = await getProjectDetail(id);
  if (!detail) notFound();

  const analyzed = detail.messages.filter((row) => row.analysis);
  const leakage = analyzed.reduce((sum, row) => {
    if (!row.analysis || row.analysis.classification === "In Scope") return sum;
    return sum + row.analysis.estimated_revenue;
  }, 0);

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 border-b border-audit-border pb-7 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-sm text-audit-muted">{detail.project.client_name}</div>
          <h1 className="mt-2 text-3xl font-semibold">{detail.project.project_name}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-700">
            Hourly rate: {money(detail.project.hourly_rate)}
            {detail.project.project_value ? ` | Project value: ${money(detail.project.project_value)}` : ""}
          </p>
        </div>
        <Link
          href={`/app/projects/${detail.project.id}/report`}
          className="inline-flex h-11 items-center justify-center rounded-md bg-ink px-4 text-sm font-semibold text-white hover:bg-zinc-800"
        >
          Generate audit report
        </Link>
      </section>

      {query.created === "audit" ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          Audit workspace created. Analyze individual client requests below, then generate the report.
        </div>
      ) : null}
      {query.created === "project" ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          Project saved. Paste a client request below to start the scope audit.
        </div>
      ) : null}

      <Disclaimer />

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-md border border-audit-border bg-white p-5 shadow-audit">
          <div className="text-sm text-audit-muted">Potential leakage</div>
          <div className="mt-2 text-2xl font-semibold">{money(leakage)}</div>
        </div>
        <div className="rounded-md border border-audit-border bg-white p-5 shadow-audit">
          <div className="text-sm text-audit-muted">Messages analyzed</div>
          <div className="mt-2 text-2xl font-semibold">{analyzed.length}</div>
        </div>
        <div className="rounded-md border border-audit-border bg-white p-5 shadow-audit">
          <div className="text-sm text-audit-muted">Out of scope</div>
          <div className="mt-2 text-2xl font-semibold">
            {analyzed.filter((row) => row.analysis?.classification === "Out of Scope").length}
          </div>
        </div>
      </section>

      <section className="rounded-md border border-audit-border bg-audit-soft p-5">
        <h2 className="text-xl font-semibold">SOW summary source</h2>
        <p className="mt-3 max-h-44 overflow-auto whitespace-pre-wrap text-sm leading-6 text-zinc-700">
          {detail.project.sow_text}
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Analyze client message</h2>
        <MessageAnalysisForm projectId={detail.project.id} />
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Analyzed requests</h2>
          <span className="text-sm text-audit-muted">{detail.messages.length} total</span>
        </div>
        <div className="grid gap-4">
          {detail.messages.length ? (
            detail.messages.map((row) => <AnalysisCard key={row.message.id} row={row} />)
          ) : (
            <div className="rounded-md border border-audit-border bg-white p-6 text-sm text-audit-muted shadow-audit">
              No messages analyzed yet.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
