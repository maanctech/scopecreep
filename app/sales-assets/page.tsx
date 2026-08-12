import { getSalesTemplates } from "@/lib/store";
import { Page, PageHeader } from "@/components/ui/Page";

export const dynamic = "force-dynamic";

export default async function SalesAssetsPage() {
  const templates = await getSalesTemplates();

  return (
    <Page>
      <PageHeader eyebrow="Founder operations" title="Sales assets" description="Private scripts and templates for qualifying an audit, revealing evidence, and proposing professional-controlled monitoring." />

      <div className="
        grid gap-5
        lg:grid-cols-2
      ">
        {templates.map((template) => (
          <article key={template.id} className="sl-panel p-5">
            <div className="
              text-xs font-semibold tracking-[0.14em] text-audit-muted uppercase
            ">
              {template.template_type}
            </div>
            <h2 className="mt-2 text-xl font-semibold">{template.title}</h2>
            <pre className="
              mt-4 rounded-md border border-audit-border bg-audit-soft p-4
              text-sm/6 whitespace-pre-wrap text-ink
            ">
              {template.body}
            </pre>
          </article>
        ))}
      </div>
    </Page>
  );
}
