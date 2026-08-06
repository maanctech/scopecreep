import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyMarkdownButton } from "@/components/reports/CopyMarkdownButton";
import { Disclaimer } from "@/components/ui/Disclaimer";
import { GenerateReportButton } from "@/components/forms/GenerateReportButton";
import { PrintReportButton } from "@/components/reports/PrintReportButton";
import { formatDollars } from "@/lib/domain/money";
import { getReportHistory, readAuditReport } from "@/lib/store";
import { currentAuthContext } from "@/lib/auth/current";
import { hasPermission } from "@/lib/auth/authorization";
import { reportSupportsCsv } from "@/lib/types";

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
  const auth = await currentAuthContext();
  const canGenerate = Boolean(auth && hasPermission(auth.role, "reports:write"));
  const result = await readAuditReport(id);

  if (!result) notFound();

  const history = await getReportHistory(id);

  return (
    <div className="space-y-8">
      <section className="
        flex flex-col gap-4 border-b border-audit-border pb-7
        lg:flex-row lg:items-end lg:justify-between
      ">
        <div>
          <div className="text-sm text-audit-muted">
            {result.project.client_name}
            {result.project.is_demo ? " - Fictional demonstration data" : ""}
          </div>
          <h1 className="mt-2 text-3xl font-semibold">
            {result.report?.title ?? `${result.project.client_name} Scope Creep Audit`}
          </h1>
          <p className="mt-3 max-w-2xl text-base/7 text-zinc-700">
            Plain markdown report for audit reveal calls, proposals, or manual export. Viewing this
            page never changes your data.
          </p>
        </div>
        <Link
          href={`/app/projects/${result.project.id}`}
          className="
            inline-flex h-11 items-center justify-center rounded-md border
            border-audit-border px-4 text-sm font-semibold
            hover:bg-audit-soft
          "
        >
          Back to project
        </Link>
      </section>

      <Disclaimer />

      {result.report ? (
        <>
          <section className="
            grid gap-4
            md:grid-cols-3
          ">
            <div className="
              rounded-md border border-audit-border bg-white p-5 shadow-audit
            ">
              <div className="text-sm text-audit-muted">Potential leakage (AI estimate)</div>
              <div className="mt-2 text-2xl font-semibold">
                {formatDollars(result.report.total_revenue_leakage)}
              </div>
            </div>
            <div className="
              rounded-md border border-audit-border bg-white p-5 shadow-audit
            ">
              <div className="text-sm text-audit-muted">Analyzed messages</div>
              <div className="mt-2 text-2xl font-semibold">{result.report.analyzed_messages_count}</div>
            </div>
            <div className="
              rounded-md border border-audit-border bg-white p-5 shadow-audit
            ">
              <div className="text-sm text-audit-muted">Out-of-scope requests</div>
              <div className="mt-2 text-2xl font-semibold">{result.report.out_of_scope_count}</div>
            </div>
          </section>

          <section className="
            rounded-md border border-audit-border bg-white p-5 shadow-audit
          ">
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
                  className="
                    inline-flex h-11 items-center rounded-md border
                    border-audit-border px-4 text-sm font-semibold
                    hover:bg-audit-soft
                  "
                >
                  Download Markdown
                </Link>
                {reportSupportsCsv(result.report.report_type) ? (
                  <>
                    <Link
                      href={`/api/projects/${result.project.id}/report?format=csv`}
                      className="
                        inline-flex h-11 items-center rounded-md border
                        border-audit-border px-4 text-sm font-semibold
                        hover:bg-audit-soft
                      "
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
                min-h-[620px] w-full rounded-md border border-audit-border
                bg-audit-soft p-4 font-mono text-sm/6
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
            <p className="mt-2 text-sm text-zinc-700">
              Every explicit generation is preserved with its source findings, SOW version, model references, and checksums.
            </p>
            <div className="
              mt-4 overflow-x-auto rounded-md border border-audit-border
            ">
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
          rounded-md border border-audit-border bg-white p-8 text-center
          shadow-audit
        ">
          <h2 className="text-xl font-semibold">No report yet</h2>
          <p className="mx-auto mt-2 max-w-xl text-base/7 text-zinc-700">
            Reports are only created when you ask for one. Generate a report to get a markdown
            summary of this project&apos;s findings and billing review status.
          </p>
          {canGenerate ? (
            <div className="mt-5 flex justify-center">
              <GenerateReportButton projectId={result.project.id} hasExistingReport={false} />
            </div>
          ) : (
            <p className="mt-4 text-sm text-audit-muted">A Reviewer, Admin, or Owner must generate the first report.</p>
          )}
        </section>
      )}
    </div>
  );
}
