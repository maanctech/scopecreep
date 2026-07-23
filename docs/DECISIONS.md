# Product and Architecture Decisions

Last updated: 2026-07-22 during Milestone 9.

## Control and Money

- ScopeLedger is a professional-only evidence and revenue-control workflow, not a chatbot or autonomous billing agent.
- AI values remain legacy dollar estimates. Professional-approved amounts use integer cents and never derive automatically from AI estimates.
- Every billable, retainer, discussion, courtesy, rejection, invoiced, paid, or reopened state change goes through one domain transition service and appends history.
- No client account, notification, change order, invoice mutation, payment, or email send occurs automatically.

## Storage, Tenancy, and Recovery

- PostgreSQL is the commercial runtime; local JSON is only an explicit demo/import compatibility mode.
- Organization scoping is enforced in the store/API boundary, with role checks before protected actions.
- Public intake is enabled for exactly one organization. If zero or multiple organizations enable it, prospect writes fail closed instead of being routed implicitly.
- SOW originals and attachments live in a private document directory; database and documents are backed up together.
- The master encryption key is stored outside PostgreSQL and excluded from backups. Losing it makes connector credentials unrecoverable.
- Applied SQL migrations are ordered and checksum-protected; old migrations are never rewritten.

## AI and Evidence

- Ollama is the default provider; OpenAI is an explicit optional provider or fallback.
- ScopeLedger never downloads a model automatically.
- Definitive classifications require SOW evidence. Invalid/provider-failed output becomes `Needs Human Review` with zero recoverable revenue.
- Analysis requires a professional-approved SOW boundary map and starts only by explicit action.

## Ingestion and Integrations

- All imports are preview-first and do not trigger AI analysis.
- Provider IDs and content hashes support idempotency; signed webhooks also enforce timestamp and replay controls.
- A credential form save does not mean a provider is connected. Only a successful real request can set `Connected`.
- Slack, Google, Microsoft, and IMAP remain BYOC/private-beta capabilities until real customer credentials verify them.

## Deployment and Commercial Model

- The supported target is a self-hosted app plus private PostgreSQL, private persistent volumes, and Ollama on the host or protected LAN.
- Loopback is the default bind. Any non-loopback deployment requires HTTPS and operator-managed network controls.
- Commercial options are a free lookback audit, $1,500 setup plus $750/month, a written 10-20% validated-recovery option, and custom enterprise scope.
- Public marketing invites private-beta applications but does not claim the build is a paid-private-beta release while Docker, real-model, and restore gates remain open.
- Customer hardware, Docker/Ollama capacity, credentials, TLS, backups, and operator labor are customer responsibilities unless a contract explicitly says otherwise.
- Public claims use evidence labels: verified locally, credential-dependent, mocked contract, external approval required, or planned.
