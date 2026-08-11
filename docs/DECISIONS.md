# Product and Architecture Decisions

Last updated: 2026-08-10 after commit `d0cb078`. Branch: `backend-refactor`.

## Control and Money

- ScopeLedger is a professional-only evidence and revenue-control workflow, not a chatbot or autonomous billing agent.
- Professional-approved amounts use integer cents. AI supplies effort suggestions, but application code calculates revenue and professionals approve billing values.
- An `Out of Scope` result must estimate positive additional effort. Zero-effort output is structurally contradictory and is retried or downgraded to `Needs Human Review`.
- Every decision and status change goes through one state machine, uses optimistic version checks, and appends immutable history.
- No client account, notification, change order, invoice mutation, payment, or email send occurs automatically.

## Storage, Tenancy, and Recovery

- PostgreSQL is the commercial runtime; local JSON is only explicit demo/import compatibility mode.
- Organization scoping is enforced at store/API and database relationship boundaries, with role checks before protected actions.
- Public intake is enabled only when exactly one organization opts in; zero or multiple eligible organizations fail closed.
- SOW originals and attachments use a private document directory. A complete operational backup must cover PostgreSQL and documents.
- The master encryption key remains outside PostgreSQL and backups. Losing it makes connector credentials unrecoverable.
- Ordered SQL migrations are checksum-protected and never rewritten after release.

## AI and Evidence

- Anthropic is the default provider; OpenAI and a local Ollama model are explicit alternatives. A default installation therefore sends analysis text to a third party, and an installation that cannot do that runs Ollama.
- Providers are described by one data-only catalog, so adding or switching a provider is a configuration change rather than a code change.
- ScopeLedger never downloads a model automatically.
- Real local verification used `gemma3:12b-it-qat`; model choice remains configurable.
- Definitive classification requires supplied-SOW evidence. Invalid or unavailable provider output becomes conservative human review with zero recoverable revenue.
- Analysis requires an approved boundary map and an explicit professional-selected job.
- The finding review form adopts the versioned API response immediately, while server refresh reconciles summaries and audit history.

## Ingestion and Integrations

- Imports are preview-first and never trigger analysis automatically.
- Provider IDs, content hashes, idempotency keys, replay keys, and one-job-per-message constraints prevent duplicate messages, jobs, findings, and billing events.
- Saved credentials never imply connectivity. Only a successful provider request can set `Connected`.
- Ollama is verified locally. Slack, Google, Microsoft, and IMAP remain BYOC/private-beta until customer credentials verify them.

## Deployment and Commercial Model

- Supported target: self-hosted Next.js, private PostgreSQL, private persistent documents, and Ollama on the host or protected LAN.
- Loopback is the default bind. Non-loopback deployment requires HTTPS and operator-managed network controls.
- Docker Compose remains the documented installation target, but this repository stays **Internal Alpha** until image/startup and real restore evidence exists.
- Public pricing remains a free lookback audit, $1,500 setup plus $750/month, a written 10-20% validated-recovery option, and custom enterprise scope.
- ScopeLedger is a working commercial name pending trademark and market validation.
