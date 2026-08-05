# Autonomous Work State

Last updated: 2026-08-05 during Integrity Release Milestone 1.

## Repository State

- Branch: `codex/integrity-release`
- Baseline commit: `0e2c412`
- Milestone 1 changes passed the skeptical review and are awaiting the milestone commit.
- Exact next objective: complete the skeptical review, commit Milestone 1, then implement SOW and financial workflow integrity.

## Completed Work

- Fast-forwarded to the current commercial baseline and synchronized installed dependencies to the committed lockfile.
- Added Reviewer-capable manual communication import without granting connector credential control.
- Added migration 009 for hashed, expiring, one-time audit intake credentials.
- Public lead capture now defaults off, has an Owner/Admin control, and fails closed unless exactly one organization enables it.
- Lead capture returns no identifiers and stores the opaque continuation in an HttpOnly cookie.
- Audit intake resolves the lead from the credential, creates the project/SOW, imports deduplicated messages with provenance, and consumes the credential atomically.
- Public responses expose no project or lead identifiers; the Admin dashboard links operators to the created audit and SOW.
- Forwarded IP headers are ignored unless an exact trusted-proxy hop count is configured.

## Tests and Evidence

- Baseline: `npm run typecheck`, `npm run lint`, and `npm test` passed with 172 passed and one Docker-only skip.
- Milestone targeted tests: 40 passed across public funnel, import, local migration, authorization, and PostgreSQL store coverage.
- Full gates: `npm run typecheck`, `npm run lint`, and `npm test` passed; 178 tests passed and one Docker-only test was skipped.
- PostgreSQL integration evidence confirms two onboarding messages are imported, no analysis job is started, and the token cannot be replayed.
- The rollback test confirms a failed audit transaction creates no audit and does not consume the credential.

## Milestone 1 Skeptical Review

- Authorization: Reviewer gains only manual communication write; connector credential writes remain denied.
- Organization isolation: token lookup joins organization-scoped lead and token records; a second public organization cannot be enabled.
- Data loss: audit, project, SOW, messages, lead transition, import provenance, and token consumption share one transaction.
- Duplicate ingestion: the shared importer retains idempotency and content/provider deduplication; onboarding does not queue analysis.
- Security: public responses expose no IDs, unexpected settings errors are redacted, malformed cookies fail closed, and spoofed forwarding headers are ignored by default.
- Migration safety: local v2 data migrates to v3 with empty credentials and disabled intake; fresh PostgreSQL migrations pass in the full test suite.

## Unresolved Failures and External Blockers

- No known Milestone 1 failure remains.
- Docker and live backup/restore evidence remain unavailable on this host.
- Live third-party connector verification still requires customer credentials.
