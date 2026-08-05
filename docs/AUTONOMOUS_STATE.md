# Autonomous Work State

Last updated: 2026-08-05 during Integrity Release Milestone 4.

## Repository State

- Branch: `codex/integrity-release`
- Current commit: `b4c9c98` (`Recover stalled jobs and enforce strict AI output`)
- Milestone 4 changes passed focused and full gates and are awaiting the milestone commit.
- Exact next objective: commit Milestone 4, run fresh/repeated migrations and all final automated gates, then complete the manual browser workflow and production build.

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
