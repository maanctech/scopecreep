import { OnboardingForm } from "@/components/forms/OnboardingForm";

type OnboardingPageProps = {
  searchParams: Promise<{ leadId?: string; submitted?: string }>;
};

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const params = await searchParams;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <section className="border-b border-audit-border pb-6">
        <h1 className="text-3xl font-semibold">Audit onboarding</h1>
        <p className="mt-3 max-w-2xl text-sm/6 text-zinc-700">
          Paste the source material for a private, manual lookback audit. ScopeLedger does not
          contact clients, send change orders, or make billing decisions.
        </p>
      </section>
      {params.submitted === "audit" ? (
        <section className="
          rounded-md border border-emerald-300 bg-emerald-50 p-6
          text-emerald-950
        ">
          <h2 className="text-xl font-semibold">Audit materials received</h2>
          <p className="mt-2 max-w-2xl text-sm/6">
            Your intake was saved to the private professional workspace. A human reviewer will
            validate the SOW, messages, effort, and potential recovery before discussing results.
            ScopeLedger does not send an automatic client message or invoice.
          </p>
        </section>
      ) : null}
      {params.submitted === "lead" ? (
        <div className="
          rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm
          text-emerald-800
        ">
          Audit request saved. Add the SOW and message export below to create the audit workspace.
        </div>
      ) : null}
      {params.submitted !== "audit" ? <OnboardingForm leadId={params.leadId} /> : null}
    </div>
  );
}
