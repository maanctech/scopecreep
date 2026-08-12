import { connection } from "next/server";
import { RoiCalculator } from "@/components/marketing/RoiCalculator";
import { Page, PageHeader } from "@/components/ui/Page";

// The nonce in the Content-Security-Policy is per request, so a page
// prerendered at build time would carry script tags the policy rejects.
export default async function CalculatorPage() {
  await connection();

  return (
    <Page className="
      mx-auto max-w-5xl py-10
      sm:py-14
    ">
      <PageHeader eyebrow="Illustrative economics" title="Revenue leakage calculator" description="Estimate how much margin may disappear when out-of-scope work is handled without an explicit commercial decision." />
      <RoiCalculator />
      <p className="text-xs/5 text-audit-muted">These outputs are illustrative planning estimates. They are not validated findings, approved charges, invoices, recovered revenue, or a guarantee.</p>
    </Page>
  );
}
