# Architecture Overview

ScopeLedger is a Next.js application for professional-controlled scope and revenue review. The private-beta deployment is one application instance, one PostgreSQL 15 database, and private document and backup volumes. Analysis is performed by a third-party AI provider.

## Runtime Boundaries

1. The browser renders public lead pages and authenticated professional workspaces.
2. Next.js route handlers validate requests, authenticate sessions, enforce organization roles, and call domain services.
3. Domain services own SOW approval, communication ingestion, analysis jobs, finding transitions, reporting, and backup orchestration.
4. PostgreSQL is the durable commercial store. Private source documents are held under `SCOPELEDGER_DOCUMENT_DIR`.
5. AI providers implement one structured contract. Anthropic is the default and OpenAI is the alternative; both are third parties.
6. Connector credentials are encrypted with `SCOPELEDGER_MASTER_KEY` before database storage.

## Important Ownership Rules

- Every commercial record is organization-scoped.
- An approved SOW version and approved boundary map are required for controlled analysis.
- Communication import never starts analysis automatically.
- AI estimates never become approved amounts automatically.
- Finding state changes go through `lib/domain/findingTransitions.ts` and append billing history.
- Report generation is explicit and versioned; reads never regenerate a report.

## Data and Recovery

Migrations in `db/migrations` are ordered, transactional, and checksum-protected after application. The legacy JSON store is an explicit import source, not the default commercial runtime. Installation backups combine a PostgreSQL custom-format dump, document originals, manifest metadata, and checksums. The encryption key is deliberately excluded.

## Deployment Boundary

The retired Compose configuration in `legacy/docker` binds the application to host loopback and does not publish PostgreSQL. Remote access requires an operator-managed HTTPS reverse proxy. ScopeLedger does not provision TLS, customer identity providers, or third-party OAuth applications.

See [Security Model](security-model.md), [Privacy Model](privacy-model.md), and [Status Matrix](status-matrix.md).
