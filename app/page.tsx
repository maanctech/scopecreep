import Link from "next/link";
import { ArrowRight, Calculator, FileSearch, Landmark, Scale, ShieldCheck } from "lucide-react";
import { RoiCalculator } from "@/components/marketing/RoiCalculator";

const useCases = [
  {
    title: "Agencies",
    copy: "Catch unpaid pages, campaign asks, copywriting, revision rounds, and post-launch support before PMs absorb the work."
  },
  {
    title: "Software shops",
    copy: "Flag portals, dashboards, integrations, data exports, and engineering requests that were not in the build scope."
  },
  {
    title: "Consultancies",
    copy: "Separate included advisory work from new strategy, research, implementation, and stakeholder-management requests."
  },
  {
    title: "Law firms",
    copy: "Review client requests against engagement terms so additional drafting, review, and advisory work is documented."
  }
];

const faqs = [
  {
    question: "Is this a chatbot?",
    answer:
      "No. The product is a forensic review workflow. It compares client requests against the SOW, records evidence, estimates leakage, and drafts client-facing change-order language for human approval."
  },
  {
    question: "Do you send invoices or change orders automatically?",
    answer:
      "No. Version 1 creates evidence and drafts. A project manager or founder approves every client communication."
  },
  {
    question: "What do you need for a free audit?",
    answer:
      "One SOW, pasted message exports or summaries, hourly or blended rate, project value, and notes on where the team suspects scope drift."
  },
  {
    question: "How is recovered revenue estimated?",
    answer:
      "The audit estimates extra hours and multiplies by the supplied rate. The output is a review queue, not a final invoice."
  }
];

export default function MarketingPage() {
  return (
    <div className="space-y-16">
      <section className="grid gap-8 border-b border-audit-border pb-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-md border border-audit-border px-3 py-2 text-sm text-audit-muted">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Financial audit workflow for client delivery teams
          </div>
          <h1 className="mt-6 max-w-4xl text-4xl font-semibold leading-tight tracking-normal text-ink sm:text-5xl">
            Recover unbilled revenue before scope creep becomes free work.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-700">
            We help service businesses recover unbilled revenue by detecting out-of-scope
            client requests before they become free work.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/request-audit"
              className="inline-flex h-11 items-center gap-2 rounded-md bg-ink px-5 text-sm font-semibold text-white hover:bg-zinc-800"
            >
              Request a free revenue leakage audit
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/app"
              className="inline-flex h-11 items-center rounded-md border border-audit-border px-5 text-sm font-semibold hover:bg-audit-soft"
            >
              Open audit console
            </Link>
          </div>
        </div>

        <div className="rounded-md border border-audit-border bg-white p-5 shadow-audit">
          <div className="flex items-center justify-between border-b border-audit-border pb-3">
            <div>
              <div className="text-xs uppercase tracking-[0.14em] text-audit-muted">Audit finding</div>
              <div className="mt-1 font-semibold">ApertureOps B2B SaaS website redesign</div>
            </div>
            <div className="rounded-md border border-audit-border px-3 py-1 text-sm font-semibold">$13,475</div>
          </div>
          <div className="mt-4 space-y-3">
            {[
              ["Out of Scope", "Interactive ROI calculator", "$4,900"],
              ["Out of Scope", "SEO articles and comparison page", "$2,100"],
              ["Out of Scope", "HubSpot workflow and Slack alert", "$1,750"],
              ["Needs Review", "Security page placement", "$525"]
            ].map(([status, request, value]) => (
              <div key={request} className="grid grid-cols-[110px_1fr_auto] gap-3 rounded-md border border-audit-border p-3 text-sm">
                <span className="font-medium">{status}</span>
                <span className="text-zinc-700">{request}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-md bg-audit-soft p-4 text-sm leading-6 text-zinc-700">
            SOW evidence: "Excluded scope includes interactive calculators, SEO content,
            CRM workflows, Slack alerts, localization, and customer login portals."
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div>
          <h2 className="text-2xl font-semibold">Scope creep is a margin leak.</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-700">
            The problem usually starts as a harmless request. The cost appears later in
            delivery capacity, missed change orders, and client expectations.
          </p>
        </div>
        {[
          "Requests are scattered across Slack, email, calls, and project tools.",
          "PMs avoid awkward change-order conversations without clear evidence.",
          "SOW terms are reviewed too late, after the work is already done."
        ].map((item) => (
          <div key={item} className="rounded-md border border-audit-border bg-white p-5 shadow-audit">
            <p className="text-sm leading-6 text-zinc-700">{item}</p>
          </div>
        ))}
      </section>

      <section className="space-y-6">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-semibold">How the audit works</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-700">
            A practical review loop for service firms that need evidence, not another
            messaging surface.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[
            ["1", "Paste the SOW", "Start with the contractual source of truth."],
            ["2", "Paste requests", "Bring in Slack, email, Zoom, Asana, Jira, or notes."],
            ["3", "Classify scope", "Every request gets evidence, confidence, hours, and revenue."],
            ["4", "Approve action", "Use the report and drafts to recover or prevent leakage."]
          ].map(([step, title, copy]) => (
            <div key={step} className="rounded-md border border-audit-border bg-white p-5 shadow-audit">
              <div className="text-sm font-semibold text-audit-muted">{step}</div>
              <h3 className="mt-3 font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-700">{copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="calculator" className="rounded-md border border-audit-border bg-audit-soft p-6">
        <div className="mb-6 flex items-center gap-2">
          <Calculator className="h-5 w-5" aria-hidden="true" />
          <h2 className="text-2xl font-semibold">ROI calculator</h2>
        </div>
        <RoiCalculator />
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold">Built for high-ticket service delivery</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {useCases.map((item) => (
            <div key={item.title} className="rounded-md border border-audit-border bg-white p-5 shadow-audit">
              <h3 className="font-semibold">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-zinc-700">{item.copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-md border border-audit-border bg-white p-6 shadow-audit">
          <div className="mb-4 flex items-center gap-2">
            <FileSearch className="h-5 w-5" aria-hidden="true" />
            <h2 className="text-2xl font-semibold">Example detection</h2>
          </div>
          <div className="space-y-4 text-sm leading-6 text-zinc-700">
            <p>
              Client request: "This may be quick: can we add an interactive ROI
              calculator to the Pricing page so prospects can estimate savings before
              they book a demo?"
            </p>
            <p>
              Audit result: Out of Scope. The SOW excludes interactive calculators
              and pricing estimators. Estimated opportunity: 28 hours at $175/hour,
              or $4,900.
            </p>
            <p>
              Draft: "We can add the ROI calculator as a separate scope item. It
              requires custom UX, calculation logic, validation, and QA, so we estimate
              28 additional hours pending approval."
            </p>
          </div>
        </div>

        <div className="rounded-md border border-audit-border bg-white p-6 shadow-audit">
          <h2 className="text-2xl font-semibold">Pricing model</h2>
          <div className="mt-5 grid gap-3 text-sm">
            <div className="rounded-md border border-audit-border p-4">
              <strong>Free lookback audit</strong>
              <p className="mt-2 text-zinc-700">Review one project and identify missed billing opportunities.</p>
            </div>
            <div className="rounded-md border border-audit-border p-4">
              <strong>$1,500 setup + $750/month monitoring</strong>
              <p className="mt-2 text-zinc-700">Weekly request review, monthly leakage report, and change-order drafts.</p>
            </div>
            <div className="rounded-md border border-audit-border p-4">
              <strong>10-20% of validated recovered revenue</strong>
              <p className="mt-2 text-zinc-700">Performance option when validated recovery is the preferred model.</p>
            </div>
            <div className="rounded-md border border-audit-border p-4">
              <strong>Custom enterprise</strong>
              <p className="mt-2 text-zinc-700">For larger firms with multiple teams, practices, or delivery units.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="flex items-center gap-2">
          <Scale className="h-5 w-5" aria-hidden="true" />
          <h2 className="text-2xl font-semibold">FAQ</h2>
        </div>
        <div className="space-y-3">
          {faqs.map((faq) => (
            <details key={faq.question} className="rounded-md border border-audit-border bg-white p-4 shadow-audit">
              <summary className="cursor-pointer font-semibold">{faq.question}</summary>
              <p className="mt-3 text-sm leading-6 text-zinc-700">{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="rounded-md border border-audit-border bg-ink p-8 text-white">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="flex items-center gap-2 text-sm text-zinc-300">
              <Landmark className="h-4 w-4" aria-hidden="true" />
              Free lookback audit
            </div>
            <h2 className="mt-3 text-3xl font-semibold">Find the revenue already hiding in client requests.</h2>
          </div>
          <Link
            href="/request-audit"
            className="inline-flex h-11 items-center justify-center rounded-md bg-white px-5 text-sm font-semibold text-ink hover:bg-zinc-100"
          >
            Request audit
          </Link>
        </div>
      </section>
    </div>
  );
}
