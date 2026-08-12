import { connection } from "next/server";
import Link from "next/link";
import { Page, PageHeader } from "@/components/ui/Page";

// The nonce in the Content-Security-Policy is per request, so a page
// prerendered at build time would carry script tags the policy rejects.
export default async function PrivacyPage() {
  await connection();

  return (
    <Page className="
      mx-auto max-w-4xl py-10
      sm:py-14
    ">
      <PageHeader eyebrow="Private-beta privacy overview" title="Customer-controlled records. Explicit processing." description="ScopeLedger is designed for a professional-only workflow. This overview describes current product behavior and is not a substitute for a customer-specific privacy review or legal agreement." />

      <section className="
        grid gap-8
        md:grid-cols-2
      ">
        <div>
          <h2 className="text-xl font-semibold">Where records live</h2>
          <p className="mt-3 text-sm/6 text-audit-body">
            Project records, SOW originals, imported communications, findings, reports, and encrypted connector credentials remain in the isolated PostgreSQL and document volumes for that installation.
          </p>
        </div>
        <div>
          <h2 className="text-xl font-semibold">Where analysis runs</h2>
          <p className="mt-3 text-sm/6 text-audit-body">
            Analysis uses the provider configured for the installation. OpenAI receives bounded analysis content only after customer authorization. Ollama remains available for an approved local-processing deployment.
          </p>
        </div>
        <div>
          <h2 className="text-xl font-semibold">Who controls billing</h2>
          <p className="mt-3 text-sm/6 text-audit-body">
            AI values are estimates. A professional reviews the evidence and chooses every billing action.
            ScopeLedger does not contact clients, send change orders, alter invoices, or collect payment.
          </p>
        </div>
        <div>
          <h2 className="text-xl font-semibold">What the operator controls</h2>
          <p className="mt-3 text-sm/6 text-audit-body">
            The customer controls host access, retention, backups, deletion, integration credentials,
            network exposure, TLS, and any optional cloud-AI configuration.
          </p>
        </div>
      </section>

      <section className="border-y border-audit-border py-8">
        <h2 className="text-xl font-semibold">Private-beta limits</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm/6 text-audit-body">
          <li>No independent penetration test or legal privacy review is claimed.</li>
          <li>Support bundles are designed to redact business text and credentials, but operators must inspect them before sharing.</li>
          <li>Third-party connectors are subject to the selected provider&apos;s terms and customer-owned approval process.</li>
          <li>Backups contain confidential records and must be stored on encrypted, access-controlled media.</li>
        </ul>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link href="/request-audit" className="sl-button-primary">
          Request a private-beta audit
        </Link>
        <Link href="/" className="sl-button-secondary">
          Return to overview
        </Link>
      </div>
    </Page>
  );
}
