# Privacy Model

ScopeLedger is a hosted, multi-tenant service with professional-only access. This document describes product behavior, not a legal privacy policy or data-processing agreement.

## Data Categories

- User identity, organization, and role records.
- Client and project metadata.
- SOW originals, extracted text, versions, risk reviews, and approved boundaries.
- Imported communications and ingestion metadata.
- AI findings, professional decisions, reports, and audit logs.
- Encrypted connector credentials and checkpoints.
- Backup archives containing database and document records.

## Processing and Disclosure

PostgreSQL and source documents are held by ScopeLedger and scoped to the customer's organization by database row-level security. Analysis text is the exception: it is sent to the configured AI provider, and Anthropic is the default, so all SOW and message content submitted for analysis goes to a third party. OpenAI is the alternative. There is no configuration in which analysis text stays in house; local-model analysis is retired, and its provider is preserved unwired in `legacy/ollama`. Provider connectors disclose only the requests needed for configured read operations; exact scopes are in [Integration Setup](integration-setup.md).

ScopeLedger does not sell data, create client accounts, contact clients, send invoices, or collect payment. The application does not include telemetry or an operator cloud service in this repository.

## Division of Responsibility

ScopeLedger operates the host, the database, TLS, the master key, and backups, and reviews support bundles before sharing. The customer defines which projects and communications are brought in, supplies and approves third-party connector credentials, manages its own users and roles, and makes every billing decision.

Tenant isolation is enforced by PostgreSQL row-level security, and the application connects as a role holding neither SUPERUSER nor BYPASSRLS, because both read past every policy. See [Row-Level Security](row-level-security.md). Host compromise and database-superuser access remain outside application-level confidentiality guarantees.

## Support and Legal Status

Support bundles are designed to omit business text, addresses, and secrets. Independent penetration testing, privacy legal review, provider production approval, and customer-specific contracts remain external release activities.
