import { LeadCaptureForm } from "@/components/forms/LeadCaptureForm";

export default function RequestAuditPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <section className="border-b border-audit-border pb-6">
        <h1 className="text-3xl font-semibold">Request a free Scope Creep Audit</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-700">
          Submit the business context first. After this step, you can paste a SOW and
          client message exports for the lookback audit.
        </p>
      </section>
      <LeadCaptureForm />
    </div>
  );
}
