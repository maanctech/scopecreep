# Autonomous Work State

Last updated: 2026-08-05 during Private Beta Monitoring Milestone 5.

## Repository State

- Branch: `codex/private-beta-monitoring`
- Current implementation: the Milestone 5 commit containing this file on `codex/private-beta-monitoring`; use `git rev-parse HEAD` as the authoritative hash.
- `codex/integrity-release` is pushed to GitHub at the same commit. PR/CI merge verification is unavailable because this host has no GitHub CLI or authenticated browser session.
- Exact next objective: execute Docker startup, real PostgreSQL backup/restore, protected browser, live provider/SMTP, and three-agency pilot gates on authorized infrastructure.

## Private Beta Monitoring Milestone 5

- Change-order drafts now include amounts and effort only when a professional chose `Bill Separately` and entered an approved integer-cent amount. AI estimates never appear as client-facing commercial values.
- Findings under discussion remain available in a separate, explicit `UNAPPROVED` section with no authorized price or effort.
- Invoice-support summaries exclude findings without a professional-approved amount instead of rendering missing approval as `$0.00`.
- Added a versioned Weekly Monitoring Summary with seven-day message/finding activity, AI potential clearly separated from mutually exclusive approved/invoiced/paid/retainer buckets, and current project automation/connector health.
- Weekly summaries support in-app copy and Markdown download only. Current and historical CSV routes reject that report type and the UI does not present CSV or print controls.
- Added migration 012 to extend the immutable report-version type constraint and expanded the fresh/idempotent migration test through 012.
- Added a founder-operated pilot runbook for three agencies, including onboarding, backup ownership, calibration, success metrics, incident handling, and evidence requirements.

### Milestone 5 Tests and Skeptical Review

- Focused commercial-report, API, revenue-total, and migration suite passes 40 tests.
- Full gates pass: typecheck, lint, and 207 tests with one Docker-only skip.
- Production build passes and compiles all application/API routes with Next.js webpack.
- Financial correctness: approved/invoiced/paid output uses only integer cents in exclusive workflow buckets; potential AI dollars remain separately labeled and are never substituted.
- Authorization/isolation: weekly monitoring health is queried only after organization-scoped project lookup and every settings/connection query includes the authenticated organization and project.
- Export integrity: weekly CSV is rejected in both current and historical APIs, preventing the generic report surface from claiming unsupported output.
- Data continuity: migration 012 only replaces the report-type check; it does not rewrite reports, findings, approved amounts, or historical bodies.
- External blockers: Docker/restore, live connector credentials, live SMTP delivery, and actual agency recruitment cannot be completed from this development host.

## Private Beta Monitoring Milestone 4

- Added migration 011 for notification idempotency and an automation-enabler trigger that preserves organization membership validation without blocking later member removal.
- Added user-scoped professional notifications for finding readiness, analysis failure, changed source evidence, connector failure, and paused automation.
- Added a Reviewer-capable review inbox, unread navigation count, exact project/finding/job links, mark-one/read-all actions, and a clear empty state.
- Added Owner/Admin project monitoring controls with tested-source and approved-boundary gates, explicit Active/Paused/Needs Attention states, and 15/30/60-minute intervals.
- Added opt-in, professional-only daily SMTP digests using Nodemailer. Recipients come only from active organization user accounts; arbitrary client addresses are not accepted.
- Digest bodies include counts, project names, exclusive revenue summaries, and a protected inbox link. They exclude SOW and communication bodies and reiterate human approval.
- Digest delivery is unique per user/local date, catches up after the configured hour, recovers stale sends, retries failures at bounded intervals, and exposes the latest failure in-app.

### Milestone 4 Tests and Skeptical Review

- Focused notification/worker/migration/installation/navigation suite passes 18 tests with one Docker-only skip.
- Full gates pass: typecheck, lint, and 203 tests with one Docker-only skip.
- Authorization: inbox APIs require `findings:review`; every mutation matches organization and user; Read Only users see neither inbox navigation nor notification records.
- Notification leakage: SMTP recipients are active opted-in members; tests prove client-message and SOW evidence bodies never enter email.
- Duplicate delivery: notification dedupe keys and one delivery per member/date prevent repeat alerts and digests across worker retries.
- Failure safety: inbox insertion is secondary and cannot roll back a persisted finding; SMTP failures are redacted, bounded, stored, and visible without exposing provider diagnostics.
- Financial correctness: digest potential uses AI cents while approved/invoiced/paid use mutually exclusive professional-approved cents; deleted source messages are excluded.
- UX integrity: review navigation waits for mark-read success, bulk read refreshes the shell count, and no action implies a client was contacted.
- External blocker: SMTP has no live credentialed delivery evidence on this host.

## Private Beta Monitoring Milestone 3

- Platform connector synchronization now uses the same organization/connection advisory serialization as IMAP.
- Slack, Google, and Microsoft jobs older than the configured ingestion threshold are conditionally failed and move only genuinely stale connections to Needs Attention.
- Recovery runs before connection-status validation and before each scheduled project run, eliminating the prior permanent `Syncing` state.
- A recovered platform worker must reacquire its Running ingestion-job row before writing messages or advancing the provider checkpoint.
- Platform and IMAP results return newly inserted IDs for automatic analysis; edited platform evidence marks the original finding stale without creating another finding.
- Integration cards display connector state separately from project monitoring state, including next run and monitoring errors.

### Milestone 3 Tests and Skeptical Review

- Full gates pass: typecheck, lint, and 198 tests with one Docker-only skip.
- Authorization/isolation: worker execution remains organization-scoped; connection credentials remain Owner/Admin-only; no automation endpoint exposes internal execution.
- Duplicate/concurrency: advisory locks serialize starts, external IDs/content hashes preserve idempotency, and a recovered worker cannot persist or advance checkpoints.
- Stuck jobs: fresh platform and IMAP jobs remain untouched; stale jobs fail conditionally before state validation and cannot leave a permanent Syncing label.
- Evidence integrity: provider edits retain the original finding and set explicit staleness timestamps; soft-deleted messages remain excluded from active reports and financial totals.
- Financial integrity: no connector path writes approved cents or billing events.
- External blocker: live Slack, Google, Microsoft, and IMAP behavior remains unverified without authorized test tenants and credentials.

## Private Beta Monitoring Milestone 2

- Added checksum migration 010 with project automation settings, leased automation runs, professional notifications, notification preferences/deliveries, analysis trigger provenance, and source-evidence staleness fields.
- Added an organization-scoped analysis queue used by both authenticated manual requests and the internal worker. Automated jobs record `trigger_source=Automation` and pin the approved SOW and boundary at queue time.
- Added a standalone PostgreSQL-backed worker with atomic due-project claims, bounded leases, expired-run recovery, lease renewal during long work, and deterministic batches of at most 100 messages.
- Added Owner/Admin-only project automation API controls. Enabling requires a tested connector and current approved boundary; role downgrade pauses future execution.
- Refactored platform and IMAP synchronization for explicit internal organization/actor execution without a browser session.
- Connector persistence now returns inserted IDs, records provider edits against analyzed evidence, and never queues unchanged records.
- Added the worker service to Docker Compose and disabled the inherited HTTP health check for the non-HTTP process.

### Milestone 2 Tests and Skeptical Review

- Targeted migration, connector, ingestion, analysis, and worker tests pass.
- Full gates pass: typecheck, lint, and 196 tests with one Docker-only skip. The focused worker/migration/connector suite passes 23 tests.
- Authorization: only a current Owner/Admin can enable or remain the actor for monitoring; organization/project composite foreign keys constrain all new records.
- Duplicate safety: connection syncs are serialized; external IDs/content hashes remain authoritative; inserted IDs are deduplicated and split into controlled batches; analysis keeps one job per message.
- Stale workers: expired automation leases fail the abandoned run and make the active project immediately retryable; fresh leases are untouched.
- Financial safety: automated execution creates internal findings only and never sets approved hours/cents, transitions billing, sends client material, or records invoices/payments.
- Data-loss review: checkpoints and persisted messages remain transactional; a lost automation lease cannot be finalized by the displaced worker.
- Remaining gap: review notifications and SMTP delivery are represented in schema only and must not be presented as active until Milestone 4.

## Private Beta Monitoring Milestone 1

- Pushed the complete integrity release to `origin/codex/integrity-release`.
- Created `codex/private-beta-monitoring` from the exact verified integrity release commit.
- Re-ran typecheck, lint, all tests, and the production build before beginning monitoring work.
- Confirmed this host has no Docker/Podman runtime, `pg_dump`, `pg_restore`, or GitHub CLI; no unavailable gate is represented as passing.
- Selected one founder-managed, single-tenant Docker installation per agency as the supported private-beta deployment model.
- Selected Slack, Google, Microsoft, and IMAP as credential-gated beta connectors, with manual import as the operational fallback.
- Selected an in-app review inbox plus one professional-only SMTP digest; client communication remains manual.

### Milestone 1 Skeptical Review

- Release provenance: the implementation branch is based on the pushed, locally verified integrity commit, not an older remote baseline.
- Data safety: no migration, runtime data, customer data, credential, or application behavior changed in this milestone.
- Evidence integrity: Docker, restore, protected PostgreSQL browser flow, PR merge, and live connectors remain explicit external blockers.
- Financial integrity: the existing integer-cent approval and exclusive revenue buckets passed unchanged.
- Exact next objective: add checksum migration 010, worker leases, project automation settings, and organization-scoped internal execution services.

## Completed Work

- Fast-forwarded to the current commercial baseline and synchronized installed dependencies to the committed lockfile.
- Added Reviewer-capable manual communication import without granting connector credential control.
- Added migration 009 for hashed, expiring, one-time audit intake credentials.
- Public lead capture now defaults off, has an Owner/Admin control, and fails closed unless exactly one organization enables it.
- Lead capture returns no identifiers and stores the opaque continuation in an HttpOnly cookie.
- Audit intake resolves the lead from the credential, creates the project/SOW, imports deduplicated messages with provenance, and consumes the credential atomically.
- Public responses expose no project or lead identifiers; the Admin dashboard links operators to the created audit and SOW.
- Forwarded IP headers are ignored unless an exact trusted-proxy hop count is configured.
- New projects now enter the SOW workspace and analysis controls remain unavailable until a professional approves a boundary map.
- Approved and regenerated draft boundary maps are represented separately; regeneration never hides or replaces the authoritative approved map.
- Approved maps are immutable, obsolete drafts cannot be approved, and a SOW change during AI review rejects the stale output.
- AI estimates never populate professional-approved hours or cents.
- Finding review edits and billing actions now persist atomically with one version increment and billing event; invoicing requires an explicit amount.
- Version conflicts return the current organization-scoped finding and the form adopts it before another action.
- Analysis results deep-link to the exact finding instead of an incompatible filter.
- Stale analysis jobs can be atomically recovered; retry preserves pinned evidence, while one exhausted-job restart repins the current approved SOW and boundary.
- Stale IMAP jobs fail after a configurable threshold, set the connection to Needs Attention only when no newer sync is active, and cannot resume writing after recovery.
- Concurrent IMAP sync starts for one organization connection are serialized.
- Required AI fields are strict, every client-message provider request carries the JSON Schema, and invalid responses create no finding.
- Prompt capacity is checked before provider access using a conservative estimate; SOW evidence is never silently truncated. Ollama defaults to a validated 32,768-token context.
- Soft-deleted communications and their findings/events are excluded from active snapshots, regenerated reports/exports, and financial summaries.
- Normal projections load only each report's current version. Report history lists metadata without Markdown/CSV bodies, and one authorized historical body is fetched by exact organization/project/version.
- Internal navigation is permission-filtered, stale local-file recovery advice is removed, and an empty workspace presents the SOW-to-import-to-analysis checklist.

## Tests and Evidence

- Baseline: `npm run typecheck`, `npm run lint`, and `npm test` passed with 172 passed and one Docker-only skip.
- Milestone targeted tests: 40 passed across public funnel, import, local migration, authorization, and PostgreSQL store coverage.
- Full gates: `npm run typecheck`, `npm run lint`, and `npm test` passed; 178 tests passed and one Docker-only test was skipped.
- PostgreSQL integration evidence confirms two onboarding messages are imported, no analysis job is started, and the token cannot be replayed.
- The rollback test confirms a failed audit transaction creates no audit and does not consume the credential.
- Milestone 2 focused tests: 60 passed across transitions, APIs, cents totals, PostgreSQL, and SOW behavior.
- Milestone 2 full gates: typecheck and lint passed; 179 tests passed with one Docker-only skip.
- Milestone 3 focused tests: 35 passed with one Docker-only skip across analysis lifecycle, strict AI parsing, context limits, IMAP recovery, and runtime validation.
- Milestone 3 full gates: typecheck and lint passed; 185 tests passed with one Docker-only skip.
- Milestone 4 focused tests: 50 existing report/store/security tests plus 15 deletion, history isolation, and role-navigation tests passed.
- Milestone 4 full gates: typecheck and lint passed; 189 tests passed with one Docker-only skip.
- Final migration runner gate applies migrations 001-009 to a fresh PGlite PostgreSQL-compatible database and proves an idempotent second run.
- Final automated gates: typecheck and lint passed; 190 tests passed with one Docker-only skip.
- `npm run build` passes through Next.js's supported webpack production builder; all 55 application/API routes compile.
- Browser evidence: marketing page, disabled confidential-intake state, and ROI recalculation from 175 x 10 x 3 to $5,250 passed.

## Milestone 1 Skeptical Review

- Authorization: Reviewer gains only manual communication write; connector credential writes remain denied.
- Organization isolation: token lookup joins organization-scoped lead and token records; a second public organization cannot be enabled.
- Data loss: audit, project, SOW, messages, lead transition, import provenance, and token consumption share one transaction.
- Duplicate ingestion: the shared importer retains idempotency and content/provider deduplication; onboarding does not queue analysis.
- Security: public responses expose no IDs, unexpected settings errors are redacted, malformed cookies fail closed, and spoofed forwarding headers are ignored by default.
- Migration safety: local v2 data migrates to v3 with empty credentials and disabled intake; fresh PostgreSQL migrations pass in the full test suite.

## Milestone 2 Skeptical Review

- Financial totals: AI estimates remain potential-only; approved/invoiced/paid buckets use only explicit integer cents supplied by a professional.
- Transactionality: dirty hours, cents, draft text, notes, transition, history, and event are committed together after one version check.
- Authorization and isolation: stale responses include only the finding obtained under the caller's organization lock; approved SOW maps reject crafted edits.
- Migration/data loss: no schema migration is required for the action contract; existing null and professional-approved values retain their meaning.
- Concurrency: obsolete SOW drafts cannot be activated, and AI review output is discarded if the active SOW changed during generation.
- UX truthfulness: project creation leads to approval, analysis buttons are gated, and exact finding links cannot land on an empty classification filter.

## Unresolved Failures and External Blockers

- No known Milestone 1 failure remains.
- Docker and live backup/restore evidence remain unavailable on this host.
- Live third-party connector verification still requires customer credentials.
- The protected browser walkthrough is blocked on this host because no PostgreSQL server/client or container runtime is installed. Authentication intentionally does not run against legacy JSON storage.

## Final Skeptical Review

- Migration safety: the actual checksum migration runner, not only raw SQL fixtures, applies exactly 001-009 and returns no work on rerun.
- Build reproducibility: dependency versions and lockfile are unchanged; the build script explicitly selects supported webpack because Turbopack's CSS helper cannot bind its internal port under this host policy.
- Security/data: no live lead, SOW, communication, credential, token, or secret was created during browser validation; only fictional local demo data was read.
- Release evidence: protected flow remains an explicit external blocker rather than being represented as passed through test-mode authentication.

## Milestone 3 Skeptical Review

- Authorization/isolation: all recovery and restart mutations remain Reviewer-gated and organization-scoped; restart locks the project before resolving current approved evidence.
- Duplicate prevention: the one-job-per-message index remains authoritative; restart reuses the existing row, and IMAP starts are serialized by an organization/connection advisory lock.
- Stale workers: analysis recovery aborts an in-process local controller; recovered IMAP workers must reacquire a Running lease before any message persistence.
- Integration truthfulness: stale IMAP recovery changes connection state only when no other Running sync exists.
- AI integrity: missing required fields, ungrounded evidence, and oversized prompts fail the job without creating a finding or truncating agreement text.
- Auditability: analysis restart and recovery append organization-scoped audit events; restart is limited to one reset after the original attempt budget is exhausted.

## Milestone 4 Skeptical Review

- Financial correctness: deleting a source communication removes its finding from active potential/approved/invoiced/paid calculations; a PostgreSQL regression proves a removed $4,000 estimate becomes zero.
- Report privacy: regenerated Markdown and CSV inputs contain only non-deleted messages; history indexes contain no report body, while exact body lookup requires matching organization, project, and version.
- Report continuity: prior generated versions remain immutable and explicitly retrievable rather than being silently rewritten after source deletion.
- Authorization: navigation reflects server-resolved role permissions, but route/API permission checks remain authoritative; cross-organization historical report access returns no body.
- Data loading: current-version joins use both version ID and organization, preventing duplicate historical rows in dashboard/project snapshots.
- UX truthfulness: first-run guidance follows the actual enforced SOW approval, import, selection, and professional review sequence.
