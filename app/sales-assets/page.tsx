import { getSalesTemplates } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function SalesAssetsPage() {
  const templates = await getSalesTemplates();

  return (
    <div className="space-y-8">
      <section className="border-b border-audit-border pb-7">
        <h1 className="text-3xl font-semibold">Sales assets</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-700">
          Stored founder scripts and templates for selling the audit, revealing findings,
          and closing monthly monitoring.
        </p>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        {templates.map((template) => (
          <article key={template.id} className="rounded-md border border-audit-border bg-white p-5 shadow-audit">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-audit-muted">
              {template.template_type}
            </div>
            <h2 className="mt-2 text-xl font-semibold">{template.title}</h2>
            <pre className="mt-4 whitespace-pre-wrap rounded-md border border-audit-border bg-audit-soft p-4 text-sm leading-6 text-zinc-800">
              {template.body}
            </pre>
          </article>
        ))}
      </div>
    </div>
  );
}
