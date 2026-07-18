import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyMarkdownButton } from "@/components/CopyMarkdownButton";
import { Disclaimer } from "@/components/Disclaimer";
import { getAuditReport } from "@/lib/store";

export const dynamic = "force-dynamic";

type ReportPageProps = {
  params: Promise<{ id: string }>;
};

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

export default async function ReportPage({ params }: ReportPageProps) {
  const { id } = await params;
  const result = await getAuditReport(id);
  if (!result) notFound();

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 border-b border-audit-border pb-7 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-sm text-audit-muted">{result.project.client_name}</div>
          <h1 className="mt-2 text-3xl font-semibold">{result.report.title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-700">
            Plain markdown report for audit reveal calls, proposals, or manual export.
          </p>
        </div>
        <Link
          href={`/app/projects/${result.project.id}`}
          className="inline-flex h-11 items-center justify-center rounded-md border border-audit-border px-4 text-sm font-semibold hover:bg-audit-soft"
        >
          Back to project
        </Link>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-md border border-audit-border bg-white p-5 shadow-audit">
          <div className="text-sm text-audit-muted">Potential leakage</div>
          <div className="mt-2 text-2xl font-semibold">{money(result.report.total_revenue_leakage)}</div>
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

      <Disclaimer />

      <section className="rounded-md border border-audit-border bg-white p-5 shadow-audit">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Markdown export</h2>
            <p className="mt-1 text-sm text-audit-muted">
              Use this for the audit reveal call, proposal notes, or manual delivery.
            </p>
          </div>
          <CopyMarkdownButton markdown={result.report.markdown} />
        </div>
        <textarea
          readOnly
          value={result.report.markdown}
          className="min-h-[620px] w-full rounded-md border border-audit-border bg-audit-soft p-4 font-mono text-sm leading-6"
        />
      </section>
    </div>
  );
}
