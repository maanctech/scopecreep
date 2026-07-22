import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyMarkdownButton } from "@/components/CopyMarkdownButton";
import { Disclaimer } from "@/components/Disclaimer";
import { GenerateReportButton } from "@/components/forms/GenerateReportButton";
import { formatDollars } from "@/lib/domain/money";
import { readAuditReport } from "@/lib/store";

export const dynamic = "force-dynamic";

type ReportPageProps = {
  params: Promise<{ id: string }>;
};

/**
 * Viewing this page is read-only: it never creates or regenerates a report.
 * Reports are only created by the explicit "Generate report" action, which
 * calls POST /api/projects/[id]/report. Older reports are kept in history.
 */
export default async function ReportPage({ params }: ReportPageProps) {
  const { id } = await params;
  const result = await readAuditReport(id);
  if (!result) notFound();

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 border-b border-audit-border pb-7 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-sm text-audit-muted">
            {result.project.client_name}
            {result.project.is_demo ? " - Fictional demonstration data" : ""}
          </div>
          <h1 className="mt-2 text-3xl font-semibold">
            {result.report?.title ?? `${result.project.client_name} Scope Creep Audit`}
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-zinc-700">
            Plain markdown report for audit reveal calls, proposals, or manual export. Viewing this
            page never changes your data.
          </p>
        </div>
        <Link
          href={`/app/projects/${result.project.id}`}
          className="inline-flex h-11 items-center justify-center rounded-md border border-audit-border px-4 text-sm font-semibold hover:bg-audit-soft"
        >
          Back to project
        </Link>
      </section>

      <Disclaimer />

      {result.report ? (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <div className="rounded-md border border-audit-border bg-white p-5 shadow-audit">
              <div className="text-sm text-audit-muted">Potential leakage (AI estimate)</div>
              <div className="mt-2 text-2xl font-semibold">
                {formatDollars(result.report.total_revenue_leakage)}
              </div>
            </div>
            <div className="rounded-md border border-audit-border bg-white p-5 shadow-audit">
              <div className="text-sm text-audit-muted">Analyzed messages</div>
              <div className="mt-2 text-2xl font-semibold">{result.report.analyzed_messages_count}</div>
            </div>
            <div className="rounded-md border border-audit-border bg-white p-5 shadow-audit">
              <div className="text-sm text-audit-muted">Out-of-scope requests</div>
              <div className="mt-2 text-2xl font-semibold">{result.report.out_of_scope_count}</div>
            </div>
          </section>

          <section className="rounded-md border border-audit-border bg-white p-5 shadow-audit">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Markdown export</h2>
                <p className="mt-1 text-sm text-audit-muted">
                  Generated{" "}
                  {new Date(result.report.created_at).toLocaleString("en-US", {
                    dateStyle: "medium",
                    timeStyle: "short"
                  })}
                  . Generate a fresh report after making new billing decisions.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <CopyMarkdownButton markdown={result.report.markdown} />
                <GenerateReportButton projectId={result.project.id} hasExistingReport />
              </div>
            </div>
            <textarea
              readOnly
              aria-label="Report markdown"
              value={result.report.markdown}
              className="min-h-[620px] w-full rounded-md border border-audit-border bg-audit-soft p-4 font-mono text-sm leading-6"
            />
          </section>
        </>
      ) : (
        <section className="rounded-md border border-audit-border bg-white p-8 text-center shadow-audit">
          <h2 className="text-xl font-semibold">No report yet</h2>
          <p className="mx-auto mt-2 max-w-xl text-base leading-7 text-zinc-700">
            Reports are only created when you ask for one. Generate a report to get a markdown
            summary of this project's findings and billing review status.
          </p>
          <div className="mt-5 flex justify-center">
            <GenerateReportButton projectId={result.project.id} hasExistingReport={false} />
          </div>
        </section>
      )}
    </div>
  );
}
