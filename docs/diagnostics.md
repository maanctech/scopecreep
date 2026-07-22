# Diagnostics and Support Bundles

Signed-in professionals can inspect **Settings > System** for application and database health, expected and applied migrations, AI provider status, integration states, analysis jobs, ingestion jobs, configuration checks, backup history, and recent audit events.

## Endpoints

- `GET /api/health` is public and reports only application version, database reachability, and latency. It does not expose configuration or business records.
- `GET /api/diagnostics` requires the settings-read permission and returns organization-scoped operational diagnostics.
- `GET /api/diagnostics/support-bundle` requires the settings-read permission and downloads redacted JSON for support review.

Every non-static request receives an `X-Correlation-Id`. Supply that ID when reporting an operational failure so the installation operator can match the request to structured logs.

## Safe Logging

Structured logging redacts fields whose names indicate passwords, secrets, tokens, keys, authorization values, cookies, SOW content, message bodies, or email addresses. Do not put sensitive values into generic field names to bypass this convention.

Support bundles exclude raw prompts, SOW text, communication bodies, integration credentials, session tokens, and user email addresses. Review the JSON before sharing it outside the organization.

## Startup Validation

Run:

```bash
npm run config:check
```

Production startup validates PostgreSQL configuration, the public application URL, storage mode, and canonical 32-byte base64 encryption keys. The command reports configuration names and corrective actions, never secret values.
