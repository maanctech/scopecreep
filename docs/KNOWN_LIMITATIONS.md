# Known Limitations

## Private Beta Monitoring Milestone 1 (2026-08-05)

- The integrity branch is pushed, but its private GitHub PR, CI result, and merge cannot be inspected from this host because GitHub CLI and an authenticated GitHub browser session are unavailable.
- The monitoring branch is based on the exact pushed integrity commit, not a merged target-branch commit.
- Docker/Compose, real `pg_dump`/`pg_restore`, protected PostgreSQL browser validation, and live connector credentials remain external release blockers.
- The durable worker is implemented and covered by PostgreSQL-compatible tests, but cannot be started in Compose on this host because no container runtime is available.
- Review-inbox notification creation and SMTP digest delivery are not implemented yet; their migration tables alone do not constitute a working notification feature.
- Live provider behavior remains credential-gated. Mocked adapters and worker tests cannot prove provider tenant permissions, OAuth approval, mailbox policy, or API quotas.
- Exact next objective: finish evidence-change/connector-failure notifications, review inbox APIs/UI, and professional-only SMTP digest delivery.
- IMAP is append-oriented and does not discover arbitrary remote deletions or edits after a UID has passed its checkpoint. Slack, Gmail history, and Microsoft delta tombstones provide stronger change visibility where their APIs emit it.
- A provider failure moves the project automation state to Needs Attention. The private beta requires a professional to test/fix the connection and deliberately re-enable monitoring.

## Integrity Release Notes (2026-08-05)

- Public intake rate limits remain process-local. With `TRUSTED_PROXY_HOPS=0`, all public callers intentionally share one conservative bucket.
- Independent lead-capture retries can still create duplicate leads; the one-time credential prevents audit workspace replay, not duplicate lead submissions.
- Public intake supports pasted text separated by a line containing `---`; complex export formats still use the authenticated manual import workflow.
- Historical IMAP messages skipped by sender filters are not recovered if those filters are widened later. Filter changes apply to future syncs in this release.
- Installation backups remain installation-wide and are restricted to system administrators; organization-scoped export is deferred.
- Local JSON compatibility mode records atomic finding state and billing events but does not maintain the PostgreSQL `scope_finding_history` table.
- Analysis restart is intentionally available only once after an exhausted attempt budget. Further failure requires correcting provider/input conditions rather than repeatedly resetting the same job.
- Stale recovery uses installation-configured time thresholds, not a distributed worker heartbeat. Operators should size thresholds above expected model and mailbox execution time.
- Historical report versions are immutable and can retain text from a communication later soft-deleted at the source. Authorized professionals must treat historical exports as retained audit records; newly generated reports exclude that communication.
- The current verification host has no PostgreSQL server/client or container runtime, so the final protected browser walkthrough could not be repeated for this release. Automated PostgreSQL-compatible integration tests pass, but they do not replace that deployment-host walkthrough.

Last updated: 2026-07-22 after Milestone 10 commit `bd5ec5f`. Branch: `commercial-beta-local-first`.

- Docker, Podman, and Colima are unavailable on the verification host. Image build and Compose startup are not directly evidenced.
- `pg_dump` and `pg_restore` are unavailable. Real database backup and destructive restore are not evidenced; controlled orchestration/checksum tests do not replace that release drill.
- Slack, Google, Microsoft, and IMAP are implemented but not live-verified without customer credentials. Provider and tenant approval may be required.
- Image-only PDFs are not OCR'd. Paste text or provide a text-based PDF, TXT, or DOCX.
- Rate limits are process-local. A reverse proxy must add installation-level controls for broader deployment.
- Public lead and audit submissions are not idempotent across independent HTTP retries; an operator may need to merge an obvious duplicate intake.
- Organization switching and browser member management are not implemented.
- There is no client login, approval link, notification, automatic email, automatic change order, invoice integration, payment collection, or accounting integration.
- There is no independent penetration test, formal legal/privacy approval, production monitoring service, public support SLA, or trademark clearance.
- The repository has no lint script or automated accessibility/browser runner. Type checking, semantic production-browser inspection, and the full manual browser workflow pass, but automated a11y regression coverage remains limited.
- Long real-model calls are asynchronous but hardware-dependent. The verified communication fixture took about 26 seconds; the SOW review took about 90 seconds on this host.
- AI estimates can be wrong. Every scope and billing decision requires professional evidence review.

## Current Test Evidence

- 144 automated tests pass; one Docker-only Compose validation test is skipped.
- Type checking, production build, dependency audit, fresh/repeated migrations, real Ollama health, real structured analysis, and the full production-browser workflow pass.
- Mocked connector tests do not prove live third-party behavior.

## Exact Next Objective

Use a Docker-capable disposable host with compatible PostgreSQL client tools to build/start the release stack and complete a real backup/restore drill. Rerun the final workflow there before considering a paid private beta.
