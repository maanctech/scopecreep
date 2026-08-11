# Product Overview

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
- Six versioned audit/report formats with Markdown, formula-safe CSV, print output, source provenance, and content checksums. Generation is explicit; viewing never changes data.
- System diagnostics, redacted support bundles, correlation IDs, structured safe logs, startup configuration validation, and installation backup controls.
- Sales asset templates for cold email, LinkedIn DM, discovery calls, audit reveal calls, proposals, follow-up, and objection handling.
- Provider-agnostic structured analysis with conservative validation and an explicit test-only demo analyzer. Anthropic is the default; OpenAI and a local Ollama model are alternatives.
- Basic tests for AI JSON parsing, validation, API behavior, and local analysis safety cases.

## Current Routes and Pages

- `/` - Public marketing website.
- `/calculator` - ROI calculator.
- `/request-audit` - Free audit lead capture form.
- `/onboarding` - Manual client onboarding flow for pasted audit materials.
- `/privacy` - Public private-beta data handling and operator-responsibility overview.
- `/app` - Internal revenue workflow dashboard (totals, attention list, recent decisions and events, revenue by project and client).
- `/app/findings` - All scope findings across projects, with filters.
- `/app/billing` - Append-only billing event history, summary totals, filters, and CSV export.
- `/app/import` - Preview manual communication imports and review ingestion job outcomes.
- `/app/integrations` - Configure, test, sync, and disconnect private communication sources with truthful connection states.
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
- `/app/settings/system` - Health, migrations, AI and job diagnostics, configuration checks, backups, and redacted audit activity.
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
- `GET /api/health` - Minimal public application/database health check.
- `GET /api/diagnostics` - Authenticated organization-scoped operational diagnostics.
- `GET /api/diagnostics/support-bundle` - Download a redacted support bundle.
- `GET|POST /api/backups` - List installation backup attempts or create a complete backup as a system administrator.

All mutation bodies are validated with Zod. Errors return plain messages without stack traces: 400 for invalid payloads or invalid transitions, 404 for missing records, 409 for stale versions.
