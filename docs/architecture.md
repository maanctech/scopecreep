# Architecture Overview

ScopeLedger is a Next.js application for professional-controlled scope and revenue review. The private-beta deployment is one application instance, one PostgreSQL 15 database, and private document and backup volumes. Analysis is performed by a third-party AI provider.

## Runtime Boundaries

1. The browser renders public lead pages and authenticated professional workspaces.
2. Next.js route handlers validate requests, authenticate sessions, enforce organization roles, and call domain services.
3. Domain services own SOW approval, communication ingestion, analysis jobs, finding transitions, and reporting.
4. PostgreSQL is the durable commercial store. Uploaded SOW originals are held in a private Vercel Blob store and served only through an authenticated route.
5. AI providers implement one structured contract. Anthropic is the default and OpenAI is the alternative; both are third parties.
6. Connector credentials are encrypted with `SCOPELEDGER_MASTER_KEY` before database storage.

## Important Ownership Rules

- Every commercial record is organization-scoped.
- An approved SOW version and approved boundary map are required for controlled analysis.
- Communication import never starts analysis automatically.
- AI estimates never become approved amounts automatically.
- Finding state changes go through `lib/domain/findingTransitions.ts` and append billing history.
- Report generation is explicit and versioned; reads never regenerate a report.

## Analysis Job Recovery

An analysis job is a persisted row, not an in-flight promise, so a worker that stops mid-batch leaves it recoverable rather than lost. `processAnalysisBatch` stops drawing new work once its time budget is spent, leaving the rest `Queued`, and the request handlers that run it declare a `maxDuration` above that budget so the platform does not kill a job in flight.

`/api/cron/analysis-jobs` runs on a schedule and closes the remaining gap. It first returns any job left at `Running` past `staleJobMinutes` to the queue, or fails it if no attempts remain, then drains the queue within its own budget. It is the one route authenticated by `CRON_SECRET` rather than a session; the secret is required at startup, and an unset one refuses every caller.

Enumerating the queue crosses organizations and therefore runs with system access, but it returns only job identity. Each job is processed inside its own organization's tenant scope, which is what keeps the finding it writes on the correct side of the boundary.

## Data and Recovery

Migrations in `db/migrations` are ordered, transactional, and checksum-protected after application. The legacy JSON store is an explicit import source, not the default commercial runtime. Installation backups combine a PostgreSQL custom-format dump, document originals, manifest metadata, and checksums. The encryption key is deliberately excluded.

## Deployment Boundary

ScopeLedger is deployed and operated by ScopeLedger; customers install nothing. The retired Compose configuration in `legacy/docker` remains available for a single-tenant deployment. ScopeLedger does not provision customer identity providers or third-party OAuth applications.

See [Security Model](security-model.md), [Privacy Model](privacy-model.md), and [Status Matrix](status-matrix.md).
