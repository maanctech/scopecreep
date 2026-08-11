# Known Limitations

Last updated: 2026-08-11. Branch: `backend-refactor`.

## Blocking a Hosted Launch

- **Installation backup is not tenant-scoped and must not ship as-is.** `POST /api/backups` is reachable by any organization's system administrator, `is_system_admin` is a per-user column set during first-user setup, and `createInstallationBackup` runs `pg_dump` over the whole database under `withSystemAccess`. In a hosted multi-tenant deployment that hands one customer every other customer's data. `restoreInstallationBackup` is worse: it runs `pg_restore --clean` against the entire database, so one customer's restore destroys everyone's. This was correct for a single-tenant self-hosted installation and is a breach path under hosting. Remove it from customer reach and replace it with tenant-scoped export before any customer is onboarded.
- **The startup safety checks have no home on serverless.** `config:check` and `rls:check` run in the retired container entrypoint and refuse to boot an unsafe configuration. A serverless deployment has no boot step, so they must move to CI or deploy-time or the guarantee is silently lost.
- **The scheduled drain has never run on Vercel.** `/api/cron/analysis-jobs` and its ten-minute schedule in `vercel.json` are covered by tests against a real database, but no deployment has invoked them. Vercel's Hobby plan also limits cron frequency, so the schedule may need raising or the plan changing.

## Deployment

- The Docker image has never been built. Its assets are covered by `tests/installation.test.ts`, but no image exists and Compose has never started.
- Backups shell out to `pg_dump`, `pg_restore`, and `tar`, and documents are written to a local directory. None of that works on serverless without replacing the storage layer and the backup strategy.
- Rate limits are process-local and must be supplemented at the edge for a multi-instance deployment.

## Product

- Slack, Google, Microsoft, and IMAP are implemented and contract-tested but not live-verified without customer credentials. Provider and tenant approval may be required.
- Image-only PDFs are not OCR'd. Paste text or provide a text-based PDF, TXT, or DOCX.
- Public lead and audit submissions are not idempotent across independent HTTP retries; an obvious duplicate intake may need merging by hand.
- Organization switching and browser-based member management are not implemented.
- Per-firm data export does not exist. The privacy page says so; do not promise it in a sales conversation.
- There is no client login, approval link, notification, automatic email, automatic change order, invoice integration, payment collection, or accounting integration.
- AI estimates can be wrong. Every scope and billing decision requires professional evidence review.

## Assurance

- No independent penetration test, formal legal or privacy approval, production monitoring service, public support SLA, or trademark clearance.
- Automated accessibility regression coverage is limited.
- Long real-model calls are asynchronous but provider-dependent.

## Current Test Evidence

- 342 automated tests pass on PGlite. The 327 predating analysis job recovery also pass on real PostgreSQL 17.6; the recovery suite has only been run on PGlite so far.
- Type checking, ESLint, and the production build pass.
- Tenant isolation is exercised against a connection role holding neither SUPERUSER nor BYPASSRLS, so the assertions test policies rather than privilege.
- Route handler authentication and authorization are swept from disk, so a new route is covered without being enrolled by hand.
- Mocked connector tests do not prove live third-party behavior.

## Exact Next Objective

Remove installation backup from customer reach, then make analysis jobs resumable with a stale-job sweeper. Neither depends on the deployment target being settled.
