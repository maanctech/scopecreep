import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Calculator,
  CheckCircle2,
  FileSearch,
  HardDrive,
  Landmark,
  LockKeyhole,
  Scale,
  ShieldCheck,
  XCircle
} from "lucide-react";
import { RoiCalculator } from "@/components/marketing/RoiCalculator";

const useCases = [
  ["Agencies", "Pages, revisions, copy, campaign asks, integrations, and post-launch support."],
  ["Software shops", "Portals, dashboards, exports, integrations, and engineering requests outside the build scope."],
  ["Consultancies", "New strategy, research, implementation, workshops, and stakeholder-management requests."],
  ["Law firms", "Additional drafting, review, advisory work, and matter requests against engagement terms."]
];

const connections = [
  ["Text, CSV, and JSON import", "Available", "Previewed, validated, deduplicated, and locally verified."],
  ["Signed inbound webhook", "Available", "HMAC verification and replay protection are locally verified."],
  ["Self-hosted IMAP", "Bring Your Own Credentials", "Implemented and contract-tested; mailbox verification depends on customer credentials."],
  ["Slack, Gmail, Microsoft 365", "Private Beta", "Adapters are contract-tested; customer-owned provider apps and live approval are required."],
  ["Call and meeting summaries", "Available", "Paste or import transcript summaries; no meeting bot joins calls."]
];

const faqs = [
  ["Is ScopeLedger a chatbot?", "No. It is an internal evidence and revenue-control workflow. Requests are compared with the approved SOW and become reviewable findings."],
  ["Does it contact clients or send invoices?", "No. ScopeLedger never sends a client message, change order, invoice, payment request, or notification automatically."],
  ["Where does analysis run?", "Ollama is the default provider and can run on the firm's Mac, workstation, or protected LAN server. OpenAI is optional and only used when explicitly configured."],
  ["What is needed for a free audit?", "One SOW, representative message exports or summaries, the hourly or blended rate, project value, and notes on suspected scope drift."],
  ["Is estimated leakage an approved charge?", "No. AI estimates remain separate from professional-approved hours and amounts. Every billing decision requires human review."],
  ["What is actually live today?", "Manual imports and signed webhooks are locally verified. IMAP and provider connectors require customer credentials; Slack, Google, and Microsoft are not represented as live without them."]
];

export default function MarketingPage() {
  return (
    <div className="space-y-20">
      <section className="border-b border-audit-border pb-10">
        <div className="flex flex-wrap items-center gap-3 text-sm text-audit-muted">
          <span className="rounded-md border border-audit-border px-3 py-2 font-semibold text-ink">Private beta applications</span>
          <span>Self-hosted</span>
          <span aria-hidden="true">/</span>
          <span>Professional-only</span>
          <span aria-hidden="true">/</span>
          <span>Ollama-first</span>
        </div>
        <h1 className="mt-6 max-w-5xl text-4xl font-semibold leading-tight text-ink sm:text-5xl">
          ScopeLedger revenue recovery audits
        </h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-zinc-700">
          We help service businesses recover unbilled revenue by detecting out-of-scope client
          requests before they become free work.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/request-audit" className="inline-flex h-11 items-center gap-2 rounded-md bg-ink px-5 text-sm font-semibold text-white hover:bg-zinc-800">
            Request a free leakage audit <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link href="#installation" className="inline-flex h-11 items-center rounded-md border border-audit-border px-5 text-sm font-semibold hover:bg-audit-soft">
            Review setup requirements
          </Link>
        </div>
        <div className="mt-7 flex flex-wrap gap-x-7 gap-y-2 text-sm text-zinc-700">
          <span className="inline-flex items-center gap-2"><HardDrive className="h-4 w-4" aria-hidden="true" /> Local-model option</span>
          <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4" aria-hidden="true" /> Human approval required</span>
          <span className="inline-flex items-center gap-2"><XCircle className="h-4 w-4" aria-hidden="true" /> No automated billing</span>
        </div>
        <figure className="mt-9 overflow-hidden rounded-md border border-audit-border bg-audit-soft shadow-audit">
          <Image
            src="/images/scopeledger-demo-dashboard.jpg"
            alt="ScopeLedger fictional Northstar Digital Studio revenue dashboard showing 13,475 dollars in potential leakage"
            width={1280}
            height={720}
            priority
            className="max-h-[420px] w-full object-cover object-top"
          />
          <figcaption className="border-t border-audit-border px-4 py-3 text-xs text-audit-muted">
            Fictional Northstar Digital Studio / ApertureOps demonstration data. Values are AI estimates until a professional approves them.
          </figcaption>
        </figure>
      </section>

      <section className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="text-sm font-semibold text-audit-muted">The margin problem</p>
          <h2 className="mt-2 text-3xl font-semibold">Scope creep rarely arrives as a change request.</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            "Requests are scattered across email, messages, calls, and project tools.",
            "Project managers lack evidence for an awkward scope conversation.",
            "The SOW is reviewed after delivery capacity and margin are already gone."
          ].map((item) => <p key={item} className="border-l-2 border-ink pl-4 text-sm leading-6 text-zinc-700">{item}</p>)}
        </div>
      </section>

      <section id="workflow" className="scroll-mt-28 border-y border-audit-border py-12">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold text-audit-muted">Professional-controlled workflow</p>
          <h2 className="mt-2 text-3xl font-semibold">Evidence first. Billing decision second.</h2>
        </div>
        <ol className="mt-8 grid gap-4 md:grid-cols-4">
          {[
            ["1", "Approve the SOW", "Version the agreement and approve a scope boundary map."],
            ["2", "Bring in requests", "Preview imports or use a verified private connection. Nothing analyzes automatically."],
            ["3", "Review findings", "Inspect classification, SOW evidence, effort, leakage estimate, and draft language."],
            ["4", "Choose the action", "Approve, discuss, retain, absorb, reject, invoice, or close through a recorded workflow."]
          ].map(([step, title, copy]) => (
            <li key={step} className="rounded-md border border-audit-border bg-white p-5 shadow-audit">
              <div className="text-sm font-semibold text-audit-muted">Step {step}</div>
              <h3 className="mt-3 font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-700">{copy}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
        <div>
          <div className="flex items-center gap-2"><FileSearch className="h-5 w-5" aria-hidden="true" /><h2 className="text-3xl font-semibold">Example detection</h2></div>
          <p className="mt-4 text-base leading-7 text-zinc-700">
            A request can sound small while introducing design, logic, validation, QA, and another review cycle.
          </p>
        </div>
        <dl className="divide-y divide-audit-border border-y border-audit-border text-sm">
          <div className="grid gap-2 py-4 sm:grid-cols-[150px_1fr]"><dt className="font-semibold">Client request</dt><dd className="text-zinc-700">“This may be quick: can we add an interactive ROI calculator to the Pricing page?”</dd></div>
          <div className="grid gap-2 py-4 sm:grid-cols-[150px_1fr]"><dt className="font-semibold">SOW evidence</dt><dd className="text-zinc-700">Interactive calculators and pricing estimators are explicitly excluded.</dd></div>
          <div className="grid gap-2 py-4 sm:grid-cols-[150px_1fr]"><dt className="font-semibold">Audit estimate</dt><dd className="text-zinc-700">Out of Scope, 28 hours at $175/hour, or $4,900 potential leakage.</dd></div>
          <div className="grid gap-2 py-4 sm:grid-cols-[150px_1fr]"><dt className="font-semibold">Next action</dt><dd className="text-zinc-700">Professional review and a clearly labeled draft change order. Nothing is sent automatically.</dd></div>
        </dl>
      </section>

      <section id="connections" className="scroll-mt-28">
        <p className="text-sm font-semibold text-audit-muted">Connection status</p>
        <h2 className="mt-2 text-3xl font-semibold">No integration theater.</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-700">
          ScopeLedger calls a connection live only after a real provider test. Credential-dependent adapters remain labeled honestly until the customer supplies and verifies access.
        </p>
        <div className="mt-6 overflow-x-auto rounded-md border border-audit-border">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-audit-soft"><tr><th className="p-3">Source</th><th className="p-3">Status</th><th className="p-3">What that means</th></tr></thead>
            <tbody className="divide-y divide-audit-border">
              {connections.map(([source, status, detail]) => <tr key={source}><td className="p-3 font-semibold">{source}</td><td className="whitespace-nowrap p-3">{status}</td><td className="p-3 text-zinc-700">{detail}</td></tr>)}
            </tbody>
          </table>
        </div>
      </section>

      <section id="security" className="scroll-mt-28 grid gap-8 border-y border-audit-border py-12 lg:grid-cols-2">
        <div>
          <div className="flex items-center gap-2"><LockKeyhole className="h-5 w-5" aria-hidden="true" /><h2 className="text-3xl font-semibold">Private by deployment, controlled by workflow.</h2></div>
          <p className="mt-4 text-sm leading-6 text-zinc-700">
            PostgreSQL, SOW originals, reports, and encrypted connector credentials stay inside the self-hosted installation. Ollama is the default analysis provider, so no per-analysis cloud API is required.
          </p>
          <p className="mt-3 text-sm leading-6 text-zinc-700">
            OpenAI remains an explicit optional provider. Independent penetration testing, legal review, and live third-party connector approval are not claimed in the private beta.
          </p>
          <Link href="/privacy" className="mt-4 inline-flex text-sm font-semibold underline underline-offset-4">
            Read the private-beta privacy model
          </Link>
        </div>
        <div>
          <h3 className="font-semibold">ScopeLedger does not</h3>
          <ul className="mt-4 grid gap-3 text-sm text-zinc-700 sm:grid-cols-2">
            {["create client accounts", "send client notifications", "approve its own findings", "change an invoice", "charge a payment method", "pull an AI model automatically"].map((item) => <li key={item} className="flex gap-2"><XCircle className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" aria-hidden="true" />{item}</li>)}
          </ul>
        </div>
      </section>

      <section id="calculator" className="scroll-mt-28">
        <div className="mb-6 flex items-center gap-2"><Calculator className="h-5 w-5" aria-hidden="true" /><h2 className="text-3xl font-semibold">Estimate the leakage</h2></div>
        <RoiCalculator />
      </section>

      <section>
        <h2 className="text-3xl font-semibold">Built for high-ticket service delivery</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {useCases.map(([title, copy]) => <article key={title} className="rounded-md border border-audit-border bg-white p-5 shadow-audit"><h3 className="font-semibold">{title}</h3><p className="mt-3 text-sm leading-6 text-zinc-700">{copy}</p></article>)}
        </div>
      </section>

      <section id="pricing" className="scroll-mt-28">
        <p className="text-sm font-semibold text-audit-muted">Private-beta pricing</p>
        <h2 className="mt-2 text-3xl font-semibold">Start with evidence, then choose the operating model.</h2>
        <div className="mt-7 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            ["Free lookback audit", "One representative project", "Find and validate missed billing opportunities before discussing a paid engagement."],
            ["$1,500 setup + $750/month", "Monitoring pilot", "Weekly request review, monthly leakage reporting, and professional-approved draft support."],
            ["10-20% of validated recovery", "Performance option", "Available when recovered revenue can be verified and commercial terms are agreed in writing."],
            ["Custom enterprise", "Multiple delivery units", "Scope, support, deployment, and connector validation priced for the installation."]
          ].map(([title, label, copy]) => <article key={title} className="rounded-md border border-audit-border bg-white p-5 shadow-audit"><div className="text-xs font-semibold uppercase text-audit-muted">{label}</div><h3 className="mt-2 text-lg font-semibold">{title}</h3><p className="mt-3 text-sm leading-6 text-zinc-700">{copy}</p></article>)}
        </div>
        <p className="mt-4 text-sm text-zinc-600">The customer supplies local hardware, Docker, Ollama capacity, and third-party credentials. Ollama mode has no per-analysis cloud API fee; hardware and operator costs still apply.</p>
      </section>

      <section id="installation" className="scroll-mt-28 grid gap-8 border-y border-audit-border py-12 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <div className="flex items-center gap-2"><Landmark className="h-5 w-5" aria-hidden="true" /><h2 className="text-3xl font-semibold">Installation overview</h2></div>
          <p className="mt-4 text-sm leading-6 text-zinc-700">The private-beta deployment is designed to be self-hosted and is currently optimized for a Mac-first installation.</p>
        </div>
        <ul className="grid gap-3 text-sm text-zinc-700 sm:grid-cols-2">
          {["Docker Desktop or compatible Docker Engine", "Private PostgreSQL and document volumes", "Ollama on the host or a protected LAN machine", "Generated database password and encryption key", "Loopback access by default; HTTPS required beyond it", "Customer-owned credentials for provider integrations"].map((item) => <li key={item} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />{item}</li>)}
        </ul>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.7fr_1.3fr]">
        <div className="flex items-center gap-2"><Scale className="h-5 w-5" aria-hidden="true" /><h2 className="text-3xl font-semibold">FAQ</h2></div>
        <div className="space-y-3">
          {faqs.map(([question, answer]) => <details key={question} className="rounded-md border border-audit-border bg-white p-4 shadow-audit"><summary className="cursor-pointer font-semibold">{question}</summary><p className="mt-3 text-sm leading-6 text-zinc-700">{answer}</p></details>)}
        </div>
      </section>

      <section className="bg-ink px-6 py-10 text-white sm:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div><p className="text-sm text-zinc-300">Free manual lookback audit</p><h2 className="mt-2 text-3xl font-semibold">Find the revenue already hiding in client requests.</h2></div>
          <Link href="/request-audit" className="inline-flex h-11 shrink-0 items-center justify-center rounded-md bg-white px-5 text-sm font-semibold text-ink hover:bg-zinc-100">Apply for the private beta</Link>
        </div>
      </section>
    </div>
  );
}
