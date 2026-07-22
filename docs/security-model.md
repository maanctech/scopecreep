# Security Model

ScopeLedger is a self-hosted, professional-only revenue review system. It assumes the installation operator controls the host, database, encryption key, backups, and network boundary.

## Trust Boundaries

- Browser sessions authenticate a professional user into one organization and one role.
- PostgreSQL is the durable commercial store. Organization-owned records are filtered by organization ID.
- Uploaded SOW originals and future attachment files remain in the private local document directory.
- Ollama is the default AI provider. OpenAI is optional and only receives content when an operator explicitly configures it.
- Integration credentials are encrypted with `SCOPELEDGER_MASTER_KEY` before database storage.
- Client-facing drafts remain private until a professional deliberately copies or exports them.

## Current Controls

- Argon2id password hashing and hashed random session tokens.
- HttpOnly, SameSite session cookies and session revocation.
- Owner, Admin, Reviewer, and Read Only authorization checks on pages and APIs.
- Same-origin checks and bounded in-memory mutation rate limits.
- Zod validation for mutation bodies and strict structured AI-output validation.
- Security response headers, correlation IDs, structured redacted logs, and no stack traces in API responses.
- Append-only billing events and audit logs enforced in PostgreSQL.
- HMAC-signed inbound webhooks with timestamp and replay protection.
- TLS-first IMAP configuration and private-host protections.
- Formula-neutralized CSV exports.
- Versioned reports with source IDs, SOW provenance, model references when available, and SHA-256 checksums.
- Installation backups with document coverage and checksum validation.

## Human-Control Guarantees

AI values are estimates, not approved charges. ScopeLedger never automatically sends a client message, change order, invoice, payment request, or notification. A professional must review evidence, choose a billing decision, set approved values, and deliberately export any client-facing draft.

## Secrets and Private Data

Never commit `.env*`, the local JSON store, document originals, imports, support data, logs, or backup archives. Keep the database and document directory on encrypted storage with host-level access controls. Store the master encryption key outside PostgreSQL and outside backup archives.

Support bundles redact credentials, tokens, authorization material, email addresses, SOW content, message bodies, and other business text. They contain health, migration, job, integration-state, and redacted audit metadata only.

## Known Private-Beta Limits

- Rate limits are process-local and must be replaced or supplemented at the reverse proxy for multi-instance deployment.
- There is no browser-based organization switcher or member administration.
- The application has not received an independent penetration test.
- External OAuth connectors require customer-owned provider applications and production verification.
- Host compromise, database-superuser compromise, or loss of the master key is outside application-level recovery guarantees.

See [Backup and Restore](backup-and-restore.md) and [Integration Setup](integration-setup.md) for operator procedures.
