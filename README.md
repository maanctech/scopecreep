# ScopeLedger

## Project Overview

ScopeLedger is a local-first revenue recovery workspace for B2B service firms. It compares Statements of Work against client requests, identifies likely unbilled out-of-scope work, and gives the professional a controlled workflow for review, change-order drafting, invoicing status, and recovered-revenue tracking.

The product helps professional service firms compare Statements of Work against client requests, identify likely unbilled out-of-scope work, estimate recoverable revenue, and draft polite change order language for a project manager to review.

## Current Product Positioning

We help service businesses recover unbilled revenue by detecting out-of-scope client requests before they become free work.

This is a forensic revenue audit tool for agencies, software development shops, consultancies, law firms, and other service firms. It is not a chatbot and does not send invoices, emails, or change orders automatically.

## Commercial Foundation

The commercial runtime now uses PostgreSQL by default. The database migration provides organization-scoped projects, versioned SOWs, communication sources, normalized messages, analysis jobs, findings, immutable billing events, versioned reports, audit logs, encrypted-secret records, and backup records.

Local authentication includes:

- One-time owner setup at `/setup` or with `npm run db:create-admin`.
- Email/password sign-in with Argon2id password hashing.
- Random session tokens stored only as SHA-256 hashes in PostgreSQL.
- HttpOnly, SameSite session cookies, logout, password change, and one-time reset links.
- Owner, Admin, Reviewer, and Read Only organization roles.
- Page and API authorization for projects, findings, billing, reports, exports, integrations, members, settings, and backups.
- Same-origin checks for mutations, login/intake rate limits, secure response headers, and organization filtering in the PostgreSQL store.

## Current MVP Features

- Public marketing landing page for the revenue leakage audit offer.
- Lead capture form for a free Scope Creep Audit.
- ROI calculator for monthly and annual revenue leakage estimates.
- Founder/admin dashboard for reviewing leads, audit requests, projects, and estimated recovered revenue.
- Lead status updates: New, Contacted, Audit Running, Proposal Sent, Closed Won, Closed Lost.
- Client onboarding form for pasted SOW text, pasted client message exports, hourly rate, project value, client name, and notes.
- Internal audit console for creating projects, pasting SOWs, submitting client messages, and running AI scope analysis.
- Professional SOW workspace with immutable versions, paste/TXT/DOCX/text-PDF intake, safe local originals, extracted sections, AI-assisted risk review, and a human-approved Scope Boundary Map.
- Preview-first text/CSV/JSON communication imports with normalized records, provider/content deduplication, visible ingestion jobs, and no automatic analysis.
- Signed generic inbound webhooks with one-time secrets, encrypted storage, timestamp validation, replay protection, and truthful connection verification.
- Credential-ready self-hosted IMAP ingestion with TLS, sender-domain routing, UID checkpoints, thread reconstruction, and attachment metadata.
- Reviewable Scope Findings: every AI analysis becomes a finding card with classification, confidence, SOW evidence, estimated hours, estimated potential revenue, an editable client-facing draft, an internal note, and full history.
- Professional-only billing workflow: Mark as Billable, Include in Retainer, Discuss With Client, Mark as Courtesy, Reject Finding, Mark as Invoiced, Mark as Paid, and Reopen Finding, all validated by a central transition service.
- Approved hours and approved amounts tracked in integer cents, separate from AI-estimated potential revenue.
- Append-only billing event history with CSV export.
- Global findings review page (`/app/findings`) and billing history page (`/app/billing`) with filters.
- Markdown audit report generator (explicit generate action; viewing a report never changes data).
- Sales asset templates for cold email, LinkedIn DM, discovery calls, audit reveal calls, proposals, follow-up, and objection handling.
- Ollama-first structured analysis with conservative validation and an explicit test-only demo analyzer.
- Basic tests for AI JSON parsing, validation, API behavior, and local analysis safety cases.

## Current Routes and Pages

- `/` - Public marketing website.
- `/calculator` - ROI calculator.
- `/request-audit` - Free audit lead capture form.
- `/onboarding` - Manual client onboarding flow for pasted audit materials.
- `/app` - Internal revenue workflow dashboard (totals, attention list, recent decisions and events, revenue by project and client).
- `/app/findings` - All scope findings across projects, with filters.
- `/app/billing` - Append-only billing event history, summary totals, filters, and CSV export.
- `/app/import` - Preview manual communication imports and review ingestion job outcomes.
- `/app/projects/new` - Create a project and paste the SOW.
- `/app/projects/[id]` - Project detail, message submission, and finding review (decisions, amounts, notes, history).
- `/app/projects/[id]/sow` - Agreement versions, extracted sections, risk review, evidence-linked boundaries, and professional approval.
- `/app/projects/[id]/report` - Markdown audit report view (read-only; generation is an explicit button).
- `/admin` - Founder/admin dashboard.
- `/sales-assets` - Sales templates and scripts.
- `/login` - Professional sign-in.
- `/setup` - One-time first-owner setup after database migration.
- `/account` - Current organization, role, sign-out, and password change.
- `/app/settings/ai` - Current AI provider, selected model, installed model inventory, and health status.
- `/reset-password` - One-time self-hosted password reset completion.

## API Routes

- `POST /api/leads` - Save a lead.
- `POST /api/leads/[id]/status` - Update lead status.
- `POST /api/audit-requests` - Save onboarding audit request data.
- `POST /api/projects` - Create a project.
- `GET /api/projects/[id]` - Fetch project detail.
- `POST /api/messages/analyze` - Analyze one client message against the project SOW and save it as a Scope Finding.
- `GET|POST /api/projects/[id]/sow` - Read the SOW workspace or add a pasted/uploaded agreement version.
- `POST /api/projects/[id]/sow/analyze` - Generate a private draft risk review and boundary map.
- `PUT /api/projects/[id]/sow/boundary` - Save or explicitly approve a reviewed boundary map.
- `POST /api/ingestion/manual` - Preview or transactionally import normalized text, CSV, or JSON messages.
- `GET /api/ingestion/jobs` - Read recent organization-scoped ingestion outcomes.
- `POST /api/ingestion/webhook` - Create a signed webhook connection and return its secret once.
- `POST /api/webhooks/[connectionId]` - Receive timestamped HMAC-verified webhook deliveries with replay protection.
- `POST /api/ingestion/email` - Configure, test, or incrementally sync a self-hosted IMAP connection.
- `GET /api/findings` - List all findings with client/project context.
- `GET /api/findings/[id]` - Read one finding with its full history.
- `PATCH /api/findings/[id]` - Update approved hours/amount (integer cents), client-facing explanation, or internal note. Requires `expected_version`; stale versions get 409.
- `POST /api/findings/[id]/actions` - Perform a validated workflow action (see Billing Workflow below). Requires `expected_version`; invalid transitions get 400.
- `GET /api/findings/[id]/billing-events` - Read the append-only history for one finding.
- `GET /api/billing-events` - Read all billing events; `?format=csv` returns a CSV export.
- `GET /api/projects/[id]/report` - Read the latest saved report. Read-only: it never creates or regenerates a report.
- `POST /api/projects/[id]/report` - Explicitly generate a new report snapshot. Older reports are kept as history.
- `POST /api/auth/setup` - Create the first organization owner; disabled after setup.
- `POST /api/auth/login` - Authenticate and issue a secure session cookie.
- `POST /api/auth/logout` - Revoke the current session.
- `POST /api/auth/change-password` - Change the signed-in user's password and revoke other sessions.
- `POST /api/auth/reset-password` - Consume a one-time administrator-generated reset token.
- `GET /api/ai/health` - Authenticated provider/model health and discovery result.

All mutation bodies are validated with Zod. Errors return plain messages without stack traces: 400 for invalid payloads or invalid transitions, 404 for missing records, 409 for stale versions.

## Demo Case Study

The seed data creates a realistic sales-call demo case:

- Agency: Northstar Digital Studio
- Client/project: ApertureOps B2B SaaS website redesign
- Project value: $48,000
- Hourly rate: $175/hour
- Demo result: $13,475 in potential recovered revenue

The seeded case includes a realistic website redesign SOW, 12 client messages, 5 out-of-scope requests, 4 in-scope requests, 2 needs-human-review requests, and 1 possibly-in-scope request. It includes a request that sounds small but is expensive: an interactive ROI calculator estimated at 28 hours and $4,900.

The seed also demonstrates the billing workflow: the ROI calculator is invoiced, the HubSpot workflow is approved for billing, the SEO articles are being discussed with the client, the Spanish localization is absorbed as a courtesy, and the customer login area is paid. The remaining flagged findings still need review. These seeded states never change the $13,475 potential total.

All demo records carry `is_demo: true`, are labeled "Fictional demonstration data" in the UI, and their totals are never merged with totals from real (non-demo) records.

Run the seed command to reset local demo data:

```bash
npm run seed
```

## Tech Stack

- Next.js 16
- React 18
- TypeScript
- Tailwind CSS
- Node.js runtime for API routes
- Zod for validation
- Ollama with `gemma3:12b-it-qat` as the recommended default local model
- OpenAI as an optional explicitly configured provider or fallback
- PostgreSQL 14+ as the primary durable runtime store
- Explicit local JSON compatibility mode and transactional JSON-to-PostgreSQL import
- Vitest for tests

## PostgreSQL And Legacy JSON

PostgreSQL is the default runtime. Configure `DATABASE_URL`, apply migrations, and create the first owner before starting the app.

The previous MVP data file remains supported as an import source:

```text
data/demo-store.json
```

That file is generated by the legacy app or by `npm run seed`. It and all import backups are ignored by Git because they can contain private prospect, client, project, SOW, and audit data.

The source seed logic lives in:

```text
lib/demoData.ts
scripts/seed-demo.mjs
```

## Billing Workflow (Phase 1)

Every saved AI analysis is a reviewable Scope Finding. A finding carries two related fields that are always changed together through one central transition service (`lib/domain/findingTransitions.ts`), so they can never contradict each other:

- Billing decision: `Undecided`, `Bill Separately`, `Include In Retainer`, `Absorb Courtesy`, `Discuss With Client`, `Reject Finding`.
- Workflow status: `New`, `Needs Review`, `Decided`, `Discussing`, `Invoiced`, `Paid`, `Closed`. (The suggested `Archived` status was deferred: no Phase 1 action produces it, and the model only contains reachable states.)

Only these (decision, status) pairs are valid:

- `Undecided` with `New` (in-scope, informational) or `Needs Review` (flagged, waiting for a human decision).
- `Bill Separately` with `Decided`, `Invoiced`, or `Paid`.
- `Include In Retainer` with `Decided`.
- `Discuss With Client` with `Discussing`.
- `Absorb Courtesy` or `Reject Finding` with `Closed`.

The professional acts through named actions, never by editing raw states:

- `Mark as Billable`, `Include in Retainer`, `Discuss With Client`, `Mark as Courtesy`, `Reject Finding` - allowed while the finding is `New`, `Needs Review`, `Decided`, or `Discussing`.
- `Mark as Invoiced` - only from `Bill Separately` + `Decided`, and only with an approved amount set.
- `Mark as Paid` - only from `Invoiced`.
- `Reopen Finding` - only from `Invoiced`, `Paid`, or `Closed`; resets the finding to `Undecided` + `Needs Review` and clears approved amounts.

Consequences of this design:

- Rejected findings can never become invoiced or paid while rejected.
- Courtesy-absorbed findings can never be invoiced.
- Included-in-retainer findings can never be invoiced or paid.
- Paid always requires invoiced first, and invoicing always requires an explicit billing decision.
- Reopening is intentional and forces a fresh decision before any billing can happen.

Every successful action, and every approved-amount edit, appends an event to an append-only billing history (`billingEvents`). Events are never edited or deleted by the UI. Stale updates are rejected: every mutation must send the finding's current `version` and receives 409 if the finding changed in the meantime.

## Money Rules (Phase 1)

Two money units exist and are never mixed:

- Potential revenue (`estimated_revenue` and older lead/project figures) is a legacy AI estimate stored in dollars. It is display-only and never billable as-is.
- Approved values (`approved_hours`, `approved_amount_cents`) are set by the professional. Amounts are stored as integer cents ($1,200.50 = 120050 cents), so stored totals never use floating-point arithmetic. Dollars convert to cents exactly once using `Math.round` (documented in `lib/domain/money.ts`); formatting back to dollars happens only at the UI boundary.

Dashboard totals are deterministic: every finding lands in exactly one financial bucket based on its (decision, status) pair (`lib/domain/revenueTotals.ts`), so nothing is double-counted. Cents-based buckets (approved, invoiced, paid, retainer) and dollar-based buckets (needs review, discussing, absorbed, rejected potential) are reported separately. Demo totals and real totals are computed and displayed separately and never merged.

## Local Store Migration

The local JSON store is versioned with `schema_version` (currently 2). Files written by the previous MVP (no `schema_version`, AI-only `scopeAnalyses`) are migrated automatically on first read:

- Each `scopeAnalysis` becomes a Scope Finding: flagged findings start at `Needs Review` / `Undecided`, in-scope findings at `New` / `Undecided`, approved amounts start null, and the AI change-order draft seeds the editable client-facing explanation.
- One `Finding Created` history event is added per migrated finding.
- Findings belonging to the fictional Northstar demo project are marked `is_demo: true`; everything else is real data.
- The migration is deterministic and repeatable, and it preserves all messages, reports, leads, projects, and audit requests, including the $13,475 Northstar potential total.
- Before writing the migrated file, the original is backed up to `data/demo-store.pre-migration-backup-<timestamp>.json`.
- If the file is corrupt or unreadable, it is backed up and the app fails with a visible error. Real data is never silently replaced with demo data. Run `npm run seed` only if you explicitly want to start over.

## Security Status

The app has local authentication, organization scoping, role-based authorization, secure password/session handling, same-origin mutation checks, security headers, encrypted integration credentials, signed webhooks, SSRF-aware mail host validation, and append-only database protections for billing events and audit logs. It is still a private-beta build: deployment hardening, restore drills, and external security review remain release gates before use with high-risk confidential data.

The older `supabase/schema.sql` is retained as historical MVP material. The active commercial schema is the versioned migration in `db/migrations` and does not require Supabase.

## Environment Variables

Create a local `.env.local` file based on `.env.example` when needed.

```bash
DATABASE_URL=postgresql://scopeledger:change-me@127.0.0.1:5432/scopeledger
DATABASE_POOL_SIZE=10
DATABASE_SSL=disable
APP_URL=http://127.0.0.1:3000
SCOPELEDGER_DOCUMENT_DIR=./data/documents
SCOPELEDGER_MASTER_KEY=<base64-encoded-32-byte-key>
```

Notes:

- `DATABASE_URL` is required for the commercial runtime.
- Use `DATABASE_SSL=require` only when the database server has a certificate trusted by the host.
- `SCOPELEDGER_STORAGE=json` is an explicit legacy/demo escape hatch, not the commercial default.
- The owner/user password environment variables are consumed only by administrative setup commands.
- Ollama is the default AI provider. OpenAI is used only when explicitly selected or configured as a fallback.
- `SCOPELEDGER_DOCUMENT_DIR` stores private source documents locally. Include it in installation backups and restrict host access.
- Generate `SCOPELEDGER_MASTER_KEY` with `openssl rand -base64 32` before saving any integration secret. Losing this key makes stored credentials unrecoverable.
- Do not commit `.env`, `.env.local`, API keys, private SOWs, private message exports, or local JSON data.

## How to Run Locally

Install dependencies only if they are not already installed:

```bash
npm install
```

Create the database, then apply the schema:

```bash
npm run db:migrate
```

Create the first owner either at `http://127.0.0.1:3000/setup` after migration, or with the variables in `.env.example` and:

```bash
npm run db:create-admin
```

Start the local server:

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:3000
```

## How to Seed Demo Data

Reset the local demo store:

```bash
npm run seed
```

This regenerates `data/demo-store.json` with the Northstar Digital Studio / ApertureOps case study.

Preview the database import without writing anything:

```bash
npm run db:import-json -- --file=data/demo-store.json
```

After reviewing the counts and totals, apply it to an organization:

```bash
npm run db:import-json -- --file=data/demo-store.json --apply --organization=<organization-uuid>
```

The importer validates source links and money fields before writing, creates a private logical backup under `data/import-backups`, deterministically namespaces imported IDs by organization, preserves billing decisions/events/reports, and commits the import in one transaction. A failed import rolls back every database row.

## User Administration

Create an additional organization user with the `SCOPELEDGER_ORGANIZATION_ID`, `SCOPELEDGER_USER_NAME`, `SCOPELEDGER_USER_EMAIL`, `SCOPELEDGER_USER_PASSWORD`, and `SCOPELEDGER_USER_ROLE` environment variables:

```bash
npm run db:create-user
```

Generate a one-time, 30-minute reset link for `SCOPELEDGER_ADMIN_EMAIL`:

```bash
npm run db:password-reset
```

## AI Provider Setup

Install and start Ollama, then ensure at least one model is available:

```bash
ollama serve
ollama pull gemma3:12b-it-qat
```

ScopeLedger discovers installed models from Ollama and selects `OLLAMA_MODEL` when configured, otherwise the recommended Gemma model, otherwise the first installed model. It never pulls a model automatically.

Every provider response is constrained to a JSON schema and validated again with Zod. ScopeLedger retries invalid output a bounded number of times, requires SOW evidence for definitive `In Scope` and `Out of Scope` decisions, forces in-scope hours to zero, and recalculates revenue from estimated hours and the project rate. Provider failures produce `Needs Human Review` with zero recoverable revenue; they do not silently become confident scope findings.

Provider, model, prompt version, attempt count, status, and a bounded internal error are saved in `analysis_jobs` for PostgreSQL-backed analyses. Raw prompts and SOW text are not written to provider diagnostics.

## Communication Ingestion

Manual import is available at `/app/import`. CSV and JSON rows accept `external_id`, `thread_id`, `sender`, `sender_email`, `recipients`, `timestamp`, `subject`, and `message_text`/`message`/`text`. Plain text uses a line containing `---` between messages. Previewing never writes data; importing never starts AI analysis.

Webhook connections return a signing secret once. Send `X-ScopeLedger-Timestamp` (Unix seconds), `X-ScopeLedger-Delivery-Id` (unique per delivery), and `X-ScopeLedger-Signature` (`sha256=` plus the HMAC-SHA256 of `<timestamp>.<raw-body>`). Connections remain `Credentials Required` until the first valid delivery.

IMAP configuration is available through the authenticated ingestion API and will be surfaced in the Integration Hub next. TLS is required by default. Private/local mail hosts require the explicit `ALLOW_PRIVATE_INTEGRATION_HOSTS=true` trust decision; insecure test servers additionally require `ALLOW_INSECURE_IMAP=true`. Credentials are encrypted and never returned after saving.

## How to Test

```bash
npm test
```

## How to Build

```bash
npm run build
```

## Available NPM Scripts

- `npm run dev` - Start Next.js locally on `127.0.0.1:3000`.
- `npm run build` - Build the Next.js app.
- `npm start` - Start the production Next.js server after a build.
- `npm test` - Run Vitest tests.
- `npm run seed` - Reset local JSON demo data.
- `npm run db:migrate` - Apply pending PostgreSQL migrations transactionally.
- `npm run db:create-admin` - Create the first organization owner from environment variables.
- `npm run db:create-user` - Create or assign an organization user and role.
- `npm run db:password-reset` - Generate a one-time self-hosted password reset link.
- `npm run db:import-json` - Validate a legacy JSON store; add `--apply` and an organization to import.

## Current Limitations

- No client login.
- No client portal.
- No client approval links.
- No client notifications.
- No automatic emails.
- No billing or invoicing automation.
- No Stripe.
- No Slack integration.
- No WhatsApp or Telegram integration.
- No QuickBooks integration.
- Text-based PDFs are supported. Scanned/image-only PDFs require manual paste or a separately configured local OCR workflow; ScopeLedger never claims OCR succeeded.
- Manual imports and signed webhooks are verified locally. IMAP is credential-ready and contract-tested but not verified against a real mailbox in this repository.
- No Docker packaging, automated PostgreSQL backup restore, or production deployment guide yet.
- Organization switching and browser-based member administration are not implemented; server administrators provision users with the documented command.
- The security controls have not received an independent penetration test.
- AI output must be reviewed by a human before any client billing decision.

## Product Decisions

- The professional service firm controls all billing decisions.
- The app should never automatically send change orders, invoices, payment links, or client notifications.
- Any future email notifications should go only to the professional, not to the client.
- The MVP is intentionally professional-only and internal-facing after lead capture.
- The product should feel like an audit and revenue control workflow, not a generic AI assistant.
- PostgreSQL is the durable commercial store. JSON remains only for explicit legacy demos and one-time import.

## Planned Next Phase

- Professional-only integration hub and notification mock mode.
- Docker packaging, backup/restore drills, and private-beta operations documentation.

## Cursor/Fable Handoff

Exact absolute project directory path:

```text
/Users/maanyachandwani/Documents/Codex/2026-05-09/you-are-my-senior-full-stack-2
```

Recommended model:

```text
Fable 5 / highest reasoning
```

Recommended mode:

```text
Planning Mode first
```

Instructions for Cursor/Fable:

- Inspect the codebase before coding.
- Do not rebuild from scratch.
- Work from the existing milestone history; do not rebuild from scratch.
- Keep PostgreSQL as the commercial runtime and JSON only as an explicit import/legacy mode.
- Do not add Stripe, client portals, client notifications, or automated billing.
- Keep the professional in control of billing decisions.
- Run `npm test` and `npm run build` after any future code changes.
- Avoid changing product logic, UI, or data model unless the approved plan calls for it.

## Directory to Give Cursor

Use this exact folder:

```text
/Users/maanyachandwani/Documents/Codex/2026-05-09/you-are-my-senior-full-stack-2
```
