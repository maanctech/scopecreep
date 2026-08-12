import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  FileCheck2,
  FileSearch,
  HandCoins,
  LockKeyhole,
  MessageSquareText,
  ReceiptText,
  ScanSearch,
  ShieldCheck,
} from "lucide-react";
import { EvidenceTrace } from "@/components/marketing/EvidenceTrace";
import { MissedRequestInvestigation } from "@/components/marketing/MissedRequestInvestigation";
import { RoiCalculator } from "@/components/marketing/RoiCalculator";

const workflow = [
  [FileCheck2, "Approve the boundary", "Version the governing SOW and approve the evidence map used for analysis."],
  [MessageSquareText, "Capture the request", "Bring selected Slack or email communications into a bounded project record."],
  [ScanSearch, "Trace the evidence", "Place the request beside the exact clause supporting the classification."],
  [HandCoins, "Make the decision", "A professional enters any approved hours and amount independently of the estimate."],
  [ReceiptText, "Record the outcome", "Approved, invoiced, and recovered values remain separate ledger states."],
] as const;

const questions = [
  ["Does ScopeLedger decide what we should bill?", "No. ScopeLedger prepares an evidence-linked finding. A professional validates the interpretation and independently decides whether to bill, discuss, absorb, or reject it."],
  ["Is estimated revenue treated as recovered revenue?", "Never. AI-estimated potential, professional-approved value, invoiced value, and paid value are distinct financial states. They are never combined into one success number."],
  ["What information is needed for the free audit?", "The public form asks only for basic agency information. If there is a fit, the secure second stage collects one governing SOW and a bounded communication export."],
  ["Where does analysis run?", "The private beta uses the configured provider only after customer authorization. OpenAI is the recommended pilot provider for predictable structured output; customer-hosted Ollama remains an optional deployment path."],
  ["How much Slack access is required?", "The pilot uses a customer-authorized connection limited to agreed channels and dates. ScopeLedger reads selected evidence and never posts into Slack or contacts a client."],
  ["What happens when the analysis is wrong?", "The finding remains in professional review. The reviewer can correct the commercial decision without changing the source message or approved SOW evidence."],
] as const;

export default function MarketingPage() {
  return (
    <div className="bg-paper text-ink">
      <section id="product" className="
        relative overflow-hidden border-b border-audit-border
      ">
        <div className="
          mx-auto grid min-h-[calc(88svh-4rem)] max-w-[1240px] gap-10 px-5 pt-12
          pb-10
          sm:px-6 sm:pt-16
          md:grid-cols-[0.84fr_1.16fr] md:items-center md:gap-8 md:pt-12
          lg:gap-14 lg:pt-10 lg:pb-7
        ">
          <div className="relative z-10">
            <p className="sl-coordinate">Revenue control for client work</p>
            <h1 className="
              sl-editorial mt-7 max-w-[13ch] text-4xl/none text-ink
              sm:text-5xl/none
            ">
              Find the work your agency delivered but never billed.
            </h1>
            <p className="mt-6 max-w-lg text-base/7 text-audit-body">
              Follow each client request back to the contract boundary, quantify the exposure, and keep the commercial decision in professional hands.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link href="/request-audit" className="sl-button-primary">
                Request a free audit
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link href="#finding-demo" className="
                inline-flex min-h-11 items-center gap-2 border-b border-ink
                text-sm font-semibold
                hover:border-signal hover:text-signal
              ">
                Inspect a finding
              </Link>
            </div>
            <dl className="
              mt-10 hidden border-y border-audit-border
              sm:block
            ">
              <div className="sl-ledger-row">
                <dt className="sl-metadata text-signal">CONTROL 01</dt>
                <dd className="text-sm text-audit-body">Nothing reaches your client without your approval.</dd>
                <Check className="size-4 text-approved" aria-hidden="true" />
              </div>
              <div className="sl-ledger-row">
                <dt className="sl-metadata text-signal">CONTROL 02</dt>
                <dd className="text-sm text-audit-body">AI estimates never become approved amounts.</dd>
                <Check className="size-4 text-approved" aria-hidden="true" />
              </div>
            </dl>
          </div>
          <div id="finding-demo" className="
            scroll-mt-24
            lg:pt-5
          ">
            <EvidenceTrace />
          </div>
        </div>
        <p className="
          sl-metadata absolute right-4 bottom-3 hidden text-audit-muted
          lg:block
        ">PLATE 01 / REQUEST → CLAUSE → DECISION</p>
      </section>

      <section aria-label="Industry evidence" className="
        border-y border-signal/15 bg-signal/5 text-ink
      ">
        <div className="
          mx-auto grid max-w-[1240px] divide-y divide-audit-border px-5
          sm:px-6
          md:grid-cols-3 md:divide-x md:divide-y-0
        ">
          <a href="https://prometheanresearch.com/digital-agency-industry-report/" target="_blank" rel="noreferrer" className="
            group py-5
            md:px-5
            md:first:pl-0
          ">
            <span data-financial-value className="
              sl-editorial text-3xl text-signal
            ">13%</span>
            <span className="ml-3 text-sm text-audit-body">average agency net margin in 2025</span>
            <span className="
              sl-metadata mt-2 block text-audit-muted
              group-hover:text-signal
            ">PROMETHEAN RESEARCH / 2026 REPORT ↗</span>
          </a>
          <a href="https://www.deltek.com/resources/articles/professional-services-benchmarks/" target="_blank" rel="noreferrer" className="
            group py-5
            md:px-5
          ">
            <span data-financial-value className="
              sl-editorial text-3xl text-signal
            ">66.4%</span>
            <span className="ml-3 text-sm text-audit-body">billable utilization in 2025</span>
            <span className="
              sl-metadata mt-2 block text-audit-muted
              group-hover:text-signal
            ">SPI / DELTEK 2026 BENCHMARK ↗</span>
          </a>
          <a href="https://prometheanresearch.com/digital-agency-industry-report/" target="_blank" rel="noreferrer" className="
            group py-5
            md:px-5
            md:last:pr-0
          ">
            <span data-financial-value className="
              sl-editorial text-3xl text-signal
            ">29%</span>
            <span className="ml-3 text-sm text-audit-body">of agencies charge $175–$199/hour</span>
            <span className="
              sl-metadata mt-2 block text-audit-muted
              group-hover:text-signal
            ">PROMETHEAN RESEARCH / 2026 REPORT ↗</span>
          </a>
        </div>
      </section>

      <section>
        <div className="
          sl-scroll-reveal mx-auto max-w-[1240px] px-5 py-16
          sm:px-6 sm:py-20
        ">
          <div className="
            grid gap-8
            lg:grid-cols-[0.68fr_1.32fr] lg:gap-16
          ">
            <div>
              <p className="sl-coordinate">Investigation / MR-028</p>
              <h2 className="
                sl-editorial mt-5 text-3xl
                sm:text-4xl
              ">Anatomy of a missed request.</h2>
            </div>
            <div className="
              max-w-2xl
              lg:pt-8
            ">
              <p className="text-base/7 text-audit-body">One request. One contract boundary. One commercial decision. Move through the evidence trail to see how “quick” work becomes measurable exposure.</p>
              <p className="sl-metadata mt-3 text-audit-muted">HORIZONTAL RECORD / SCROLL TO INSPECT ALL SEVEN EVENTS</p>
            </div>
          </div>
          <div className="mt-10"><MissedRequestInvestigation /></div>
        </div>
      </section>

      <section className="border-y border-audit-border">
        <div className="
          sl-scroll-reveal mx-auto max-w-[1240px] px-5 py-16
          sm:px-6 sm:py-20
        ">
          <div className="
            mb-8 grid gap-6
            lg:grid-cols-[0.75fr_1.25fr] lg:items-end
          ">
            <div>
              <p className="sl-coordinate">Exposure worksheet / illustrative</p>
              <h2 className="
                sl-editorial mt-5 text-3xl
                sm:text-4xl
              ">Put a number beside the invisible work.</h2>
            </div>
            <p className="max-w-2xl text-sm/6 text-audit-body">This calculator models possible leakage. It does not classify a request, validate a contract boundary, or create an approved billing amount.</p>
          </div>
          <RoiCalculator />
        </div>
      </section>

      <section id="workflow" className="scroll-mt-20">
        <div className="
          sl-scroll-reveal mx-auto max-w-[1240px] px-5 py-16
          sm:px-6 sm:py-20
        ">
          <div className="
            flex flex-col gap-5 border-b border-ink pb-7
            lg:flex-row lg:items-end lg:justify-between
          ">
            <div>
              <p className="sl-coordinate">Operating ledger / 01–05</p>
              <h2 className="
                sl-editorial mt-5 text-3xl
                sm:text-4xl
              ">From request to recorded outcome.</h2>
            </div>
            <p className="max-w-xl text-sm/6 text-audit-body">Every finding starts with evidence. Every external action stays with the professional.</p>
          </div>
          <ol className="
            divide-y divide-audit-border border-b border-audit-border
          ">
            {workflow.map(([Icon, title, description], index) => (
              <li key={title} className="
                sl-scroll-reveal-row grid gap-4 py-5
                sm:grid-cols-[4rem_2rem_15rem_minmax(0,1fr)] sm:items-center
              ">
                <span className="sl-metadata text-signal">0{index + 1}</span>
                <Icon className="size-5 text-audit-muted" aria-hidden="true" />
                <h3 className="font-semibold">{title}</h3>
                <p className="text-sm/6 text-audit-body">{description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-y border-ink bg-paper">
        <div className="
          sl-scroll-reveal mx-auto max-w-[1240px] px-5 py-16
          sm:px-6 sm:py-20
        ">
          <header className="
            grid gap-8 border-b border-ink pb-8
            lg:grid-cols-[0.72fr_1.28fr]
          ">
            <div>
              <p className="sl-coordinate">Case report / NS-AP-048</p>
              <span className="sl-review-stamp mt-5 text-critical">Fictional demonstration</span>
            </div>
            <div>
              <p className="sl-eyebrow">Northstar Digital Studio / ApertureOps</p>
              <h2 className="sl-editorial mt-3 text-4xl">A $48,000 website redesign, reconstructed request by request.</h2>
            </div>
          </header>

          <div className="
            grid border-b border-ink
            lg:grid-cols-[0.74fr_1.26fr]
          ">
            <div className="
              border-b border-audit-border py-8
              lg:border-r lg:border-b-0 lg:pr-8
            ">
              <dl>
                {[
                  ["PROJECT VALUE", "$48,000"],
                  ["BLENDED RATE", "$175 / HR"],
                  ["MESSAGES REVIEWED", "12"],
                  ["FLAGGED REQUESTS", "7"],
                ].map(([label, value]) => <div key={label} className="
                  sl-ledger-row
                "><dt className="sl-metadata text-audit-muted">{label}</dt><dd data-financial-value className="
                  font-semibold
                  sm:col-span-2
                ">{value}</dd></div>)}
              </dl>
              <div className="mt-8 border-l-2 border-audit-amber pl-5">
                <p className="sl-metadata text-audit-amber">AI-ESTIMATED POTENTIAL</p>
                <p data-financial-value className="sl-editorial mt-2 text-5xl">$13,475</p>
                <p className="mt-2 text-xs/5 text-audit-muted">Illustrative potential only. Not approved, invoiced, or recovered.</p>
              </div>
            </div>
            <div className="
              py-8
              lg:pl-8
            ">
              <p className="sl-metadata text-audit-muted">PROFESSIONAL FINANCIAL STATES / MUTUALLY EXCLUSIVE</p>
              <div className="
                mt-5 grid gap-px bg-audit-border
                sm:grid-cols-3
              ">
                <div className="bg-bright-paper p-5"><p className="
                  sl-metadata text-approved
                ">APPROVED / NOT INVOICED</p><p data-financial-value className="
                  sl-editorial mt-3 text-3xl
                ">$1,750</p></div>
                <div className="bg-bright-paper p-5"><p className="
                  sl-metadata text-approved
                ">INVOICED</p><p data-financial-value className="
                  sl-editorial mt-3 text-3xl
                ">$4,900</p></div>
                <div className="bg-bright-paper p-5"><p className="
                  sl-metadata text-approved
                ">PAID / RECOVERED</p><p data-financial-value className="
                  sl-editorial mt-3 text-3xl
                ">$2,100</p></div>
              </div>
              <div className="
                mt-8 grid gap-4 border-t border-audit-border pt-6
                sm:grid-cols-[7rem_minmax(0,1fr)]
              ">
                <p className="sl-metadata text-signal">EVIDENCE E-04</p>
                <div><p className="font-semibold">Interactive ROI calculator request</p><p className="
                  mt-2 text-sm/6 text-audit-body
                ">The SOW expressly excluded interactive calculators. The request required custom UX, calculation logic, validation, QA, and stakeholder review: 28 hours × $175 = $4,900.</p></div>
              </div>
            </div>
          </div>

          <figure className="
            sl-scroll-reveal mt-8 grid gap-4
            lg:grid-cols-[11rem_minmax(0,1fr)]
          ">
            <figcaption className="sl-coordinate self-start">Exhibit / dashboard record</figcaption>
            <Image src="/images/scopeledger-demo-dashboard.jpg" alt="Fictional Northstar Digital Studio ScopeLedger dashboard separating potential, approved, invoiced, and recovered revenue" width={1280} height={720} sizes="(min-width: 1024px) 970px, 100vw" className="
              h-auto w-full border border-audit-border
            " />
          </figure>
        </div>
      </section>

      <section id="security" className="scroll-mt-20">
        <div className="
          sl-scroll-reveal mx-auto grid max-w-[1240px] gap-10 px-5 py-16
          sm:px-6 sm:py-20
          lg:grid-cols-[0.7fr_1.3fr] lg:gap-16
        ">
          <div>
            <p className="sl-coordinate">Control record / HC-04</p>
            <h2 className="
              sl-editorial mt-5 text-3xl
              sm:text-4xl
            ">AI identifies the risk. A professional decides what is billable.</h2>
            <p className="mt-5 text-sm/6 text-audit-body">ScopeLedger is an internal revenue-control workflow, not an autonomous client agent.</p>
          </div>
          <div className="border-t border-ink">
            {[
              [LockKeyhole, "Customer-controlled records", "Commercial deployments keep project, SOW, message, finding, and audit history in an isolated PostgreSQL installation."],
              [FileSearch, "Explicit provider authorization", "Client evidence is sent only to the configured analysis provider after customer authorization. Provider failures create no financial finding."],
              [ShieldCheck, "Bounded source access", "Connections are limited to agreed sources and dates. Saved credentials are not presented as verified connectivity."],
              [HandCoins, "Human financial authority", "Only professional-entered integer cents can become approved, invoiced, or recovered values. Nothing is sent externally."],
            ].map(([Icon, title, description], index) => (
              <div key={title as string} className="
                sl-scroll-reveal-row grid gap-4 border-b border-audit-border
                py-5
                sm:grid-cols-[3rem_2rem_12rem_minmax(0,1fr)] sm:items-start
              ">
                <span className="sl-metadata text-signal">0{index + 1}</span><Icon className="
                  size-5 text-audit-muted
                " aria-hidden="true" /><h3 className="font-semibold">{title as string}</h3><p className="
                  text-sm/6 text-audit-body
                ">{description as string}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pilot" className="
        scroll-mt-20 border-y border-signal/15 bg-signal/5 text-ink
      ">
        <div className="
          sl-scroll-reveal mx-auto grid max-w-[1240px] gap-10 px-5 py-16
          sm:px-6 sm:py-20
          lg:grid-cols-[0.8fr_1.2fr] lg:gap-16
        ">
          <div>
            <p className="sl-coordinate text-audit-muted">Private beta / design partner</p>
            <h2 className="sl-editorial mt-5 text-4xl">Start with one bounded lookback audit.</h2>
            <p className="mt-5 max-w-lg text-sm/6 text-audit-body">We test the evidence workflow on representative client work before asking your team to change operations or connect an ongoing source.</p>
            <Link href="/request-audit" className="sl-button-primary mt-7">Request the free audit <ArrowRight className="
              size-4
            " aria-hidden="true" /></Link>
          </div>
          <ol className="border-t border-audit-border">
            {[
              ["01", "Qualify", "Confirm written SOWs, meaningful project value, and an internal professional reviewer."],
              ["02", "Calibrate", "Review one SOW and a bounded historical communication set together."],
              ["03", "Operate in shadow mode", "Monitor findings internally while every billing action remains with your team."],
              ["04", "Measure", "Track professionally approved incremental revenue, review time, false positives, and support load."],
            ].map(([number, title, description]) => <li key={number} className="
              sl-scroll-reveal-row grid gap-3 border-b border-audit-border py-5
              sm:grid-cols-[3rem_10rem_minmax(0,1fr)]
            "><span className="sl-metadata text-signal">{number}</span><h3 className="
              font-semibold
            ">{title}</h3><p className="text-sm/6 text-audit-body">{description}</p></li>)}
          </ol>
        </div>
      </section>

      <section>
        <div className="
          sl-scroll-reveal mx-auto max-w-[1000px] px-5 py-16
          sm:px-6 sm:py-20
        ">
          <p className="sl-coordinate">Objection record / FAQ</p>
          <h2 className="
            sl-editorial mt-5 max-w-2xl text-3xl
            sm:text-4xl
          ">Questions a careful operator should ask.</h2>
          <div className="mt-10 border-t border-ink">
            {questions.map(([question, answer], index) => (
              <details key={question} className="
                sl-scroll-reveal-row group border-b border-audit-border py-5
              ">
                <summary className="
                  grid cursor-pointer list-none
                  grid-cols-[2rem_minmax(0,1fr)_1.5rem] gap-3 font-semibold
                ">
                  <span className="sl-metadata text-signal">{String(index + 1).padStart(2, "0")}</span><span>{question}</span><span className="
                    text-xl font-normal text-audit-muted transition-transform
                    duration-150
                    group-open:rotate-45
                  " aria-hidden="true">+</span>
                </summary>
                <p className="mt-4 max-w-3xl pl-11 text-sm/6 text-audit-body">{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-ink bg-paper">
        <div className="
          sl-scroll-reveal mx-auto max-w-[1240px] px-5 py-16
          sm:px-6 sm:py-20
        ">
          <div className="
            grid gap-8 border-b border-ink pb-14
            lg:grid-cols-[0.7fr_1.3fr] lg:items-end
          ">
            <p className="sl-coordinate">Next action / free audit</p>
            <div>
              <h2 className="
                sl-editorial max-w-3xl text-4xl
                sm:text-5xl
              ">Find unpriced work before it disappears into delivery.</h2>
              <div className="mt-7 flex flex-wrap items-center gap-5"><Link href="/request-audit" className="
                sl-button-primary
              ">Request a free audit <ArrowRight className="size-4" aria-hidden="true" /></Link><p className="
                text-xs/5 text-audit-muted
              ">Basic firm information first. Confidential evidence only in the secure second stage.</p></div>
            </div>
          </div>
          <footer className="
            flex flex-col gap-4 pt-6 text-xs text-audit-muted
            sm:flex-row sm:items-center sm:justify-between
          "><p className="sl-metadata">SCOPELEDGER / FOLLOW THE MONEY BACK TO THE REQUEST</p><div className="
            flex gap-5
          "><Link href="/privacy" className="hover:text-ink">Privacy</Link><Link href="/login" className="
            hover:text-ink
          ">Professional sign in</Link></div></footer>
        </div>
      </section>
    </div>
  );
}
