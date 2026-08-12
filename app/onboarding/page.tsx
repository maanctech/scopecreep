import { OnboardingForm } from "@/components/forms/OnboardingForm";
import { Page, PageHeader } from "@/components/ui/Page";

type OnboardingPageProps = {
  searchParams: Promise<{ submitted?: string }>;
};

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const params = await searchParams;

  return (
    <Page className="
      mx-auto max-w-5xl py-10
      sm:py-14
    ">
      <PageHeader eyebrow="Secure second stage" title="Audit evidence intake" description="Provide the bounded source material for a private, manual lookback audit. ScopeLedger does not contact clients, send change orders, or make billing decisions." />
      {params.submitted === "audit" ? (
        <section className="
          rounded-md border border-signal/25 bg-signal/5 p-6 text-signal
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
          rounded-md border border-signal/25 bg-signal/5 p-4 text-sm text-signal
        ">
          Audit request saved. Add the SOW and message export below to create the audit workspace.
        </div>
      ) : null}
      {params.submitted !== "audit" ? <OnboardingForm /> : null}
    </Page>
  );
}
