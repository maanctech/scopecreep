import { connection } from "next/server";
import Link from "next/link";

// The nonce in the Content-Security-Policy is per request, so a page
// prerendered at build time would carry script tags the policy rejects.
export default async function PrivacyPage() {
  await connection();

  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <header className="border-b border-audit-border pb-8">
        <p className="text-sm font-semibold text-audit-muted">Private-beta privacy overview</p>
        <h1 className="mt-2 text-4xl font-semibold">Isolated data, explicit processing.</h1>
        <p className="mt-4 max-w-3xl text-base/7 text-zinc-700">
          ScopeLedger is a hosted, professional-only workflow. This page describes the current product
          behavior; it is not a substitute for a customer-specific privacy review or legal
          agreement.
        </p>
      </header>

      <section className="
        grid gap-8
        md:grid-cols-2
      ">
        <div>
          <h2 className="text-xl font-semibold">Where records live</h2>
          <p className="mt-3 text-sm/6 text-zinc-700">
            Project records, SOW originals, imported communications, findings, reports, and encrypted
            connector credentials are held in ScopeLedger&apos;s PostgreSQL database and document
            storage, scoped to your firm and unreadable by any other firm.
          </p>
        </div>
        <div>
          <h2 className="text-xl font-semibold">Where analysis runs</h2>
          <p className="mt-3 text-sm/6 text-zinc-700">
            Analysis text is sent to the configured AI provider, and Anthropic is the default. OpenAI is the
            alternative. Both are third parties, so analysis text always leaves ScopeLedger. Nothing but
            the text submitted for a given analysis does.
          </p>
        </div>
        <div>
          <h2 className="text-xl font-semibold">Who controls billing</h2>
          <p className="mt-3 text-sm/6 text-zinc-700">
            AI values are estimates. A professional reviews the evidence and chooses every billing action.
            ScopeLedger does not contact clients, send change orders, alter invoices, or collect payment.
          </p>
        </div>
        <div>
          <h2 className="text-xl font-semibold">Who controls what</h2>
          <p className="mt-3 text-sm/6 text-zinc-700">
            ScopeLedger operates the infrastructure, the database, and its backups. Your firm controls
            its own users and roles, which projects and messages are brought in, which integration
            credentials are supplied, and every billing decision. Your firm&apos;s records are isolated
            from other firms&apos; by database row-level security.
          </p>
        </div>
      </section>

      <section className="border-y border-audit-border py-8">
        <h2 className="text-xl font-semibold">Private-beta limits</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm/6 text-zinc-700">
          <li>No independent penetration test or legal privacy review is claimed.</li>
          <li>Support bundles are designed to redact business text and credentials, and are inspected before sharing.</li>
          <li>Third-party connectors are subject to the selected provider&apos;s terms and customer-owned approval process.</li>
          <li>Backups are operated by ScopeLedger. Your firm can export its own records at any time; uploaded contract originals are downloaded individually rather than inside that file.</li>
        </ul>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link href="/request-audit" className="
          inline-flex h-11 items-center rounded-md bg-ink px-5 text-sm
          font-semibold text-white
          hover:bg-zinc-800
        ">
          Request a private-beta audit
        </Link>
        <Link href="/" className="
          inline-flex h-11 items-center rounded-md border border-audit-border
          px-5 text-sm font-semibold
          hover:bg-audit-soft
        ">
          Return to overview
        </Link>
      </div>
    </div>
  );
}
