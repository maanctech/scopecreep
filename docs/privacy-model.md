# Privacy Model

ScopeLedger is designed for customer-operated infrastructure and professional-only access. This document describes product behavior, not a legal privacy policy or data-processing agreement.

## Data Categories

- User identity, organization, and role records.
- Client and project metadata.
- SOW originals, extracted text, versions, risk reviews, and approved boundaries.
- Imported communications and ingestion metadata.
- AI findings, professional decisions, reports, and audit logs.
- Encrypted connector credentials and checkpoints.
- Backup archives containing database and document records.

## Processing and Disclosure

PostgreSQL and source documents remain within the customer-operated installation. Analysis text is the exception: it is sent to the configured AI provider, and Anthropic is the default, so every installation sends SOW and message content to a third party. OpenAI is the alternative. There is no configuration in which analysis text stays in house; local-model analysis is retired, and its provider is preserved unwired in `legacy/ollama`. Provider connectors disclose only the requests needed for configured read operations; exact scopes are in [Integration Setup](integration-setup.md).

ScopeLedger does not sell data, create client accounts, contact clients, send invoices, or collect payment. The application does not include telemetry or an operator cloud service in this repository.

## Operator Responsibilities

The operator defines retention and deletion policy, controls host and database access, provides TLS for remote access, protects the master key, restricts backups, approves third-party credentials, and reviews support bundles before sharing. Host compromise and database-superuser access are outside application-level confidentiality guarantees.

## Support and Legal Status

Support bundles are designed to omit business text, addresses, and secrets. Independent penetration testing, privacy legal review, provider production approval, and customer-specific contracts remain external release activities.
