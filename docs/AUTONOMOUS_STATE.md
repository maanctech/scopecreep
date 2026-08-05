# Autonomous Work State

Last updated: 2026-08-05 during Integrity Release Milestone 2.

## Repository State

- Branch: `codex/integrity-release`
- Current commit: `aff081e` (`Secure audit intake and restore import continuity`)
- Milestone 2 changes passed focused tests and are awaiting final gates and the milestone commit.
- Exact next objective: complete Milestone 2 gates and commit, then implement recoverable analysis and ingestion jobs.

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

## Tests and Evidence

- Baseline: `npm run typecheck`, `npm run lint`, and `npm test` passed with 172 passed and one Docker-only skip.
- Milestone targeted tests: 40 passed across public funnel, import, local migration, authorization, and PostgreSQL store coverage.
- Full gates: `npm run typecheck`, `npm run lint`, and `npm test` passed; 178 tests passed and one Docker-only test was skipped.
- PostgreSQL integration evidence confirms two onboarding messages are imported, no analysis job is started, and the token cannot be replayed.
- The rollback test confirms a failed audit transaction creates no audit and does not consume the credential.
- Milestone 2 focused tests: 60 passed across transitions, APIs, cents totals, PostgreSQL, and SOW behavior.
- Milestone 2 full gates: typecheck and lint passed; 179 tests passed with one Docker-only skip.

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
