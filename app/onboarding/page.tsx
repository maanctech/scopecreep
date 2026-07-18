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
        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-700">
          Paste the source material for the manual lookback audit. Version 1 stores
          text only so the founder can run analysis directly inside the product console.
        </p>
      </section>
      {params.submitted === "lead" ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          Audit request saved. Add the SOW and message export below to create the audit workspace.
        </div>
      ) : null}
      <OnboardingForm leadId={params.leadId} />
    </div>
  );
}
