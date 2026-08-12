import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyMarkdownButton } from "@/components/reports/CopyMarkdownButton";
import { Disclaimer } from "@/components/ui/Disclaimer";
import { GenerateReportButton } from "@/components/forms/GenerateReportButton";
import { PrintReportButton } from "@/components/reports/PrintReportButton";
import { Page, PageHeader } from "@/components/ui/Page";
import { formatDollars } from "@/lib/domain/money";
import { getReportHistory, readAuditReport } from "@/lib/store";
import { currentAuthContext } from "@/lib/auth/current";
import { hasPermission } from "@/lib/auth/authorization";
import { reportSupportsCsv } from "@/lib/types";

export const dynamic = "force-dynamic";

type ReportPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ReportPage({ params }: ReportPageProps) {
  const { id } = await params;
  const auth = await currentAuthContext();
  const canGenerate = Boolean(auth && hasPermission(auth.role, "reports:write"));
  const result = await readAuditReport(id);

  if (!result) notFound();

  const history = await getReportHistory(id);

  return (
    <Page>
      <PageHeader
        eyebrow={`${result.project.client_name}${result.project.is_demo ? " · Fictional demonstration data" : ""}`}
        title={result.report?.title ?? `${result.project.client_name} Scope Creep Audit`}
        description="Versioned audit record for professional review and manual export. Viewing this page never regenerates a report or changes project data."
        actions={<Link href={`/app/projects/${result.project.id}`} className="
          sl-button-secondary
        ">Back to project</Link>}
      />

      <Disclaimer />

      {result.report ? (
        <>
          <section className="border-y border-ink bg-bright-paper" aria-label="Report ledger totals">
            <div className="
              grid divide-y divide-audit-border
              md:grid-cols-3 md:divide-x md:divide-y-0
            ">
              <div className="bg-audit-amber/5 p-5">
                <div className="sl-metadata text-audit-amber">R-01 / AI ESTIMATE</div>
                <div className="
                  mt-4 text-xs font-semibold text-audit-amber uppercase
                ">Potential leakage</div>
                <div data-financial-value className="
                  sl-editorial mt-1 text-3xl tabular-nums
                ">
                  {formatDollars(result.report.total_revenue_leakage)}
                </div>
              </div>
              <div className="p-5">
                <div className="sl-metadata text-audit-muted">R-02 / EVIDENCE</div>
                <div className="
                  mt-4 text-xs font-semibold text-audit-muted uppercase
                ">Analyzed messages</div>
                <div className="sl-editorial mt-1 text-3xl tabular-nums">{result.report.analyzed_messages_count}</div>
              </div>
              <div className="p-5">
                <div className="sl-metadata text-audit-muted">R-03 / CLASSIFIED</div>
                <div className="
                  mt-4 text-xs font-semibold text-audit-muted uppercase
                ">Out-of-scope requests</div>
                <div className="sl-editorial mt-1 text-3xl tabular-nums">{result.report.out_of_scope_count}</div>
              </div>
            </div>
          </section>

          <section className="sl-panel p-5">
            <div className="
              mb-4 flex flex-col gap-3
              sm:flex-row sm:items-center sm:justify-between
            ">
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
                <Link
                  href={`/api/projects/${result.project.id}/report?format=markdown`}
                  className="sl-button-secondary"
                >
                  Download Markdown
                </Link>
                {reportSupportsCsv(result.report.report_type) ? (
                  <>
                    <Link
                      href={`/api/projects/${result.project.id}/report?format=csv`}
                      className="sl-button-secondary"
                    >
                      Download CSV
                    </Link>
                    <PrintReportButton />
                  </>
                ) : null}
                {canGenerate ? (
                  <GenerateReportButton
                    projectId={result.project.id}
                    hasExistingReport
                    initialReportType={result.report.report_type}
                  />
                ) : null}
              </div>
            </div>
            <dl className="
              mb-4 grid gap-3 border-y border-audit-border py-4 text-sm
              sm:grid-cols-4
            ">
              <div><dt className="text-audit-muted">Report type</dt><dd className="
                mt-1 font-semibold
              ">{result.report.report_type || "Internal Scope Audit"}</dd></div>
              <div><dt className="text-audit-muted">Version</dt><dd className="
                mt-1 font-semibold
              ">v{result.report.version_number || 1}</dd></div>
              <div><dt className="text-audit-muted">Source findings</dt><dd className="
                mt-1 font-semibold
              ">{result.report.source_finding_ids?.length || result.report.analyzed_messages_count}</dd></div>
              <div><dt className="text-audit-muted">Content checksum</dt><dd className="
                mt-1 font-mono text-xs break-all
              ">{result.report.content_sha256?.slice(0, 16) || "Legacy report"}</dd></div>
            </dl>
            <textarea
              readOnly
              aria-label="Report markdown"
              value={result.report.markdown}
              className="
                min-h-[620px] w-full border-x border-y-2 border-audit-border
                bg-bright-paper p-5 font-mono text-sm/6
                print:hidden
              "
            />
            <pre className="
              hidden text-sm/6 whitespace-pre-wrap
              print:block
            ">{result.report.markdown}</pre>
          </section>

          <section>
            <h2 className="text-xl font-semibold">Report history</h2>
            <p className="mt-2 text-sm text-audit-body">
              Every explicit generation is preserved with its source findings, SOW version, model references, and checksums.
            </p>
            <div className="mt-4 overflow-x-auto border-y border-audit-border">
              <table className="min-w-full text-left text-sm">
                <caption className="sr-only">Saved report versions</caption>
                <thead className="bg-audit-soft"><tr><th className="p-3">Version</th><th className="
                  p-3
                ">Type</th><th className="p-3">Generated</th><th className="p-3">Sources</th><th className="
                  p-3
                ">Exports</th></tr></thead>
                <tbody className="divide-y divide-audit-border">
                  {history.map((version) => (
                    <tr key={version.id}>
                      <td className="p-3 font-semibold">v{version.version_number || 1}</td>
                      <td className="p-3">{version.report_type || "Internal Scope Audit"}</td>
                      <td className="p-3">{new Date(version.created_at).toLocaleString()}</td>
                      <td className="p-3">{version.source_finding_ids?.length || version.analyzed_messages_count} findings</td>
                      <td className="p-3">
                        <div className="flex gap-3">
                          <Link className="font-semibold underline" href={`/api/projects/${id}/report/versions/${version.id}?format=markdown`}>Markdown</Link>
                          {reportSupportsCsv(version.report_type) ? (
                            <Link className="font-semibold underline" href={`/api/projects/${id}/report/versions/${version.id}?format=csv`}>CSV</Link>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <section className="
          border-y border-dashed border-audit-border bg-bright-paper px-6 py-10
        ">
          <p className="sl-coordinate">REPORT / NOT GENERATED</p>
          <h2 className="mt-4 text-xl font-semibold">No report yet</h2>
          <p className="mt-2 max-w-xl text-base/7 text-audit-body">
            Reports are only created when you ask for one. Generate a report to get a markdown
            summary of this project&apos;s findings and billing review status.
          </p>
          {canGenerate ? (
            <div className="mt-5 flex">
              <GenerateReportButton projectId={result.project.id} hasExistingReport={false} />
            </div>
          ) : (
            <p className="mt-4 text-sm text-audit-muted">A Reviewer, Admin, or Owner must generate the first report.</p>
          )}
        </section>
      )}
    </Page>
  );
}
