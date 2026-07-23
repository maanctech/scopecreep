import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <header className="border-b border-audit-border pb-8">
        <p className="text-sm font-semibold text-audit-muted">Private-beta privacy overview</p>
        <h1 className="mt-2 text-4xl font-semibold">Customer-controlled data, explicit processing.</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-zinc-700">
          ScopeLedger is designed for a self-hosted, professional-only workflow. This page describes
          the current product behavior; it is not a substitute for a customer-specific privacy review
          or legal agreement.
        </p>
      </header>

      <section className="grid gap-8 md:grid-cols-2">
        <div>
          <h2 className="text-xl font-semibold">Where records live</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-700">
            Project records, SOW originals, imported communications, findings, reports, and encrypted
            connector credentials remain in the customer-operated PostgreSQL and document volumes.
          </p>
        </div>
        <div>
          <h2 className="text-xl font-semibold">Where analysis runs</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-700">
            Ollama is the default and can run on the customer&apos;s own machine or protected network.
            OpenAI is optional and receives analysis content only when an operator explicitly configures it.
          </p>
        </div>
        <div>
          <h2 className="text-xl font-semibold">Who controls billing</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-700">
            AI values are estimates. A professional reviews the evidence and chooses every billing action.
            ScopeLedger does not contact clients, send change orders, alter invoices, or collect payment.
          </p>
        </div>
        <div>
          <h2 className="text-xl font-semibold">What the operator controls</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-700">
            The customer controls host access, retention, backups, deletion, integration credentials,
            network exposure, TLS, and any optional cloud-AI configuration.
          </p>
        </div>
      </section>

      <section className="border-y border-audit-border py-8">
        <h2 className="text-xl font-semibold">Private-beta limits</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-zinc-700">
          <li>No independent penetration test or legal privacy review is claimed.</li>
          <li>Support bundles are designed to redact business text and credentials, but operators must inspect them before sharing.</li>
          <li>Third-party connectors are subject to the selected provider&apos;s terms and customer-owned approval process.</li>
          <li>Backups contain confidential records and must be stored on encrypted, access-controlled media.</li>
        </ul>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link href="/request-audit" className="inline-flex h-11 items-center rounded-md bg-ink px-5 text-sm font-semibold text-white hover:bg-zinc-800">
          Request a private-beta audit
        </Link>
        <Link href="/" className="inline-flex h-11 items-center rounded-md border border-audit-border px-5 text-sm font-semibold hover:bg-audit-soft">
          Return to overview
        </Link>
      </div>
    </div>
  );
}
