# Known Limitations

Last updated: 2026-08-12. Branch: `backend-refactor`.

## Blocking a Hosted Launch

- **The row-level-security check in CI has never run.** `.github/workflows/ci.yml` provisions PostgreSQL 17, applies migrations as the schema owner, creates the unprivileged application role, and runs `rls:check` as that role. It is written but unverified: this machine has neither PostgreSQL nor a running Docker daemon, so the job has only ever been read, not executed. The configuration half is done and was run — `npm run build` now refuses a production deployment whose configuration would not survive, verified by running it with and without `VERCEL_ENV=production`.
- **The scheduled drain has never run on Vercel.** `/api/cron/analysis-jobs` and its ten-minute schedule in `vercel.json` are covered by tests against a real database, but no deployment has invoked them. Vercel's Hobby plan also limits cron frequency, so the schedule may need raising or the plan changing.

## Deployment

- The Docker image has never been built. Its assets are covered by `tests/installation.test.ts`, but no image exists and Compose has never started.
- Rate limits are process-local and must be supplemented at the edge for a multi-instance deployment.

## Product

- Slack, Google, Microsoft, and IMAP are implemented and contract-tested but not live-verified without customer credentials. Provider and tenant approval may be required.
- Image-only PDFs are not OCR'd. Paste text or provide a text-based PDF, TXT, or DOCX.
- Public lead and audit submissions are not idempotent across independent HTTP retries; an obvious duplicate intake may need merging by hand.
- Organization switching and browser-based member management are not implemented.
- Per-firm data export does not exist. The privacy page says so; do not promise it in a sales conversation. It is the replacement the retired installation backup pretended to be, and it is not built.
- There is no client login, approval link, notification, automatic email, automatic change order, invoice integration, payment collection, or accounting integration.
- AI estimates can be wrong. Every scope and billing decision requires professional evidence review.

## Assurance

- No independent penetration test, formal legal or privacy approval, production monitoring service, public support SLA, or trademark clearance.
- Automated accessibility regression coverage is limited.
- Long real-model calls are asynchronous but provider-dependent.

## Current Test Evidence

- 360 automated tests pass on PGlite. The 327 predating analysis job recovery also pass on real PostgreSQL 17.6; the recovery, document storage, deployment configuration, and serverless boundary suites have only been run on PGlite so far.
- Type checking, ESLint, and the production build pass.
- Tenant isolation is exercised against a connection role holding neither SUPERUSER nor BYPASSRLS, so the assertions test policies rather than privilege.
- Route handler authentication and authorization are swept from disk, so a new route is covered without being enrolled by hand.
- Mocked connector tests do not prove live third-party behavior.

## Exact Next Objective

Run the CI tenant-boundary job once against real PostgreSQL and fix whatever it finds, then build the tenant-scoped export. After that, the read path: `lib/store/postgres/projections.ts` loads every row of nine tables on every page and joins them in JavaScript, which measured 12 seconds per page load at 38,400 records.
