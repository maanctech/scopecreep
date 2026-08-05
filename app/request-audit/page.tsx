import { connection } from "next/server";
import { LeadCaptureForm } from "@/components/forms/LeadCaptureForm";
import { getPublicIntakeAvailability } from "@/lib/store";

// The nonce in the Content-Security-Policy is per request, so a page
// prerendered at build time would carry script tags the policy rejects.
export default async function RequestAuditPage() {
  await connection();
  const intake = await getPublicIntakeAvailability();

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <section className="border-b border-audit-border pb-6">
        <p className="text-sm font-semibold text-audit-muted">Free lookback audit / private-beta application</p>
        <h1 className="mt-2 text-3xl font-semibold">Request a ScopeLedger revenue leakage audit</h1>
        <p className="mt-3 max-w-2xl text-sm/6 text-zinc-700">
          Tell us about the firm and the scope problem. After this step, you can securely paste
          one SOW and representative client-message exports for a manual review.
        </p>
      </section>
      <section className="
        grid gap-4 border-b border-audit-border pb-8 text-sm/6 text-zinc-700
        sm:grid-cols-3
      ">
        <div><strong className="block text-ink">1. Business context</strong>Project economics, team size, and the margin problem.</div>
        <div><strong className="block text-ink">2. Private intake</strong>SOW text and representative messages saved to the professional workspace.</div>
        <div><strong className="block text-ink">3. Human review</strong>Evidence and estimates are validated before any findings are discussed.</div>
      </section>
      {intake.enabled ? (
        <LeadCaptureForm />
      ) : (
        <section className="
          rounded-md border border-amber-300 bg-amber-50 p-6 text-amber-950
        ">
          <h2 className="text-xl font-semibold">Public audit requests are currently closed</h2>
          <p className="mt-2 max-w-2xl text-sm/6">
            This installation is not accepting confidential SOW or client-message submissions.
            An authorized operator must enable public intake before this form becomes available.
          </p>
        </section>
      )}
      <p className="text-xs/5 text-zinc-600">
        This form does not subscribe you to automated marketing or contact a client. Submitted
        materials may contain confidential business information and should only be provided when
        you are authorized to share them for the audit.
      </p>
    </div>
  );
}
