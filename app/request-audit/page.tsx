import { connection } from "next/server";
import { LeadCaptureForm } from "@/components/forms/LeadCaptureForm";
import { Page, PageHeader } from "@/components/ui/Page";
import { getPublicIntakeAvailability } from "@/lib/store";

// The nonce in the Content-Security-Policy is per request, so a page
// prerendered at build time would carry script tags the policy rejects.
export default async function RequestAuditPage() {
  await connection();
  const intake = await getPublicIntakeAvailability();

  return (
    <Page className="
      mx-auto max-w-5xl py-10
      sm:py-14
    ">
      <PageHeader
        eyebrow="Free lookback audit"
        title="Request a revenue leakage audit"
        description="Share basic agency information first. Rates, SOWs, and client communications are collected only in the secure next stage."
      />
      <div className="
        grid gap-8
        lg:grid-cols-[0.72fr_1.28fr] lg:items-start
      ">
        <aside className="
          space-y-6
          lg:sticky lg:top-24
        ">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">What happens next</h2>
            <ol className="
              mt-4 divide-y divide-audit-border border-y border-audit-border
            ">
              {[
                ["01", "Fit review", "We confirm that the engagement has written scope and enough request volume for a useful audit."],
                ["02", "Private evidence", "An authorized contact provides one SOW and a bounded communication export."],
                ["03", "Professional readout", "Every potential opportunity is reviewed before results are discussed."],
              ].map(([number, title, description]) => (
                <li key={number} className="
                  grid grid-cols-[36px_1fr] gap-3 py-4
                ">
                  <span className="sl-metadata text-signal">{number}</span>
                  <div><h3 className="text-sm font-semibold">{title}</h3><p className="
                    mt-1 text-sm/6 text-audit-muted
                  ">{description}</p></div>
                </li>
              ))}
            </ol>
          </div>
          <p className="text-xs/5 text-audit-muted">Nothing is sent to a client. No estimate becomes an approved charge without professional review.</p>
        </aside>
        {intake.enabled ? <LeadCaptureForm /> : (
        <section className="
          border-y border-audit-amber/30 bg-audit-amber/5 p-6 text-audit-amber
        ">
          <h2 className="text-xl font-semibold">Public audit requests are currently closed</h2>
          <p className="mt-2 max-w-2xl text-sm/6">
            This installation is not accepting confidential SOW or client-message submissions.
            An authorized operator must enable public intake before this form becomes available.
          </p>
        </section>
        )}
      </div>
    </Page>
  );
}
