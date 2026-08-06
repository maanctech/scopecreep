# Product and Architecture Decisions

## Private Beta Monitoring Decisions (2026-08-05)

- Build the monitoring release from integrity commit `202d7ce`; do not wait on an unverifiable GitHub merge to begin local implementation.
- Support one founder-managed, single-tenant Docker installation per agency for the private beta.
- Treat Slack, Google, Microsoft, and IMAP as credential-gated beta connectors. Manual import remains the fallback and does not become autonomous.
- Run scheduled ingestion and analysis in a separate PostgreSQL-backed worker, never in a public worker endpoint or only in a Next.js request callback.
- Project automation is Owner/Admin controlled and requires a current approved SOW boundary before any automatic analysis is queued.
- Automated jobs may prepare internal findings only. They never approve scope, set approved amounts, contact clients, create invoices, or record payment.
- Notifications are professional-only: an in-app inbox plus one opt-in daily SMTP digest. Digests exclude SOW and communication bodies.
- Continue using the existing professional-approved integer-cent workflow and correct commercial exports instead of creating new financial states.
- Worker leases default to 30 minutes and are renewed between connector and analysis operations. Expired runs fail visibly and retry only while the project remains Active.
- Automatic ingestion queues only connector-returned inserted IDs. Existing edited evidence is marked stale for professional review rather than silently creating a replacement finding.
- If the enabling user is no longer an Owner/Admin, monitoring moves to Needs Attention and does not continue under stale authority.
- Connector stale recovery must run before status validation. A prior worker may leave `Syncing`; requiring `Connected` first would make recovery unreachable.
- Provider checkpoints advance only in the same transaction that proves the ingestion job is still Running and persists the corresponding source changes.
- Connection state describes provider credential/sync health; project automation state separately describes scheduled monitoring health.
- Review alerts are scoped to current Owner/Admin/Reviewer members. Read Only users do not receive or navigate to operational review alerts.
- Notification writes are idempotent and secondary to the underlying finding/job state; an alert failure never rolls back a valid finding.
- SMTP recipients are derived only from opted-in active user accounts. Digest APIs accept no destination address, and message/SOW bodies are never emailed.
- One digest is created per organization member and local calendar date. Failed delivery retries at most three times and never stores raw provider errors.
- Nodemailer is the only dependency added for this release and is confined to server-side worker delivery.

## Integrity Release Decisions (2026-08-05)

- Public audit intake is opt-in and disabled for newly created organizations.
- A public lead receives a random 256-bit continuation credential in an HttpOnly, SameSite cookie. Only its SHA-256 hash is stored, it expires after 24 hours, and it is consumed in the audit-creation transaction.
- Public APIs never return lead, organization, project, SOW, or message identifiers or content.
- Manual communication import uses `communications:write`; Reviewer may import, while connector configuration remains restricted by `integrations:write`.
- Audit onboarding uses the same normalization and persistence primitive as authenticated manual import and never triggers analysis.
- `TRUSTED_PROXY_HOPS=0` is the fail-closed default; forwarded addresses are trusted only at an explicitly configured right-hand boundary.
- Local JSON schema version 3 retains intake token and public-intake setting parity, while PostgreSQL remains the commercial runtime.
- AI-proposed hours and revenue are never defaults for professional-approved fields. Null remains null until explicit human input.
- Consequential finding actions accept review edits in the same optimistic-concurrency transaction; no client-side save-then-action sequence is authoritative.
- An approved SOW boundary remains active while a regenerated draft is reviewed. Approval atomically archives the prior active map.
- A boundary draft belongs permanently to one SOW version and cannot reactivate superseded agreement text.
- An analysis job remains the unique lifecycle record for one communication. Retry preserves its pinned evidence; one exhausted-job start-over resets the attempt budget and explicitly repins current approved evidence.
- Running analysis and IMAP jobs are recoverable only after configurable 30-minute stale thresholds and conditional database updates.
- A recovered IMAP worker must prove its job is still Running inside the message-persistence transaction; otherwise it writes nothing.
- Required client-message AI output fields have no parser defaults. Provider failure, invalid JSON, missing fields, weak evidence, and context overflow create no finding.
- Prompt capacity uses three characters per estimated token plus output and safety reserves. Evidence is rejected intact rather than truncated.
- Ollama's context defaults to `OLLAMA_NUM_CTX=32768`; OpenAI client-message analysis receives the same strict JSON Schema contract.
- Soft-deleted communications are absent from active snapshots and all calculations generated from them. Their linked findings and billing events do not contribute to current financial views.
- Saved report versions are immutable audit artifacts. Deletion affects all newly generated reports, while prior versions remain available only through an explicit authorized historical-version request.
- Report history is metadata-only; Markdown and CSV bodies are selected one version at a time. Normal projections join only `reports.current_version_id`.
- Navigation visibility mirrors role permissions for usability, while server route and API authorization remain the security boundary.
- `npm run build` explicitly uses Next.js's supported webpack builder on this host. Turbopack remains a development option but its CSS worker cannot bind an internal port under the release host's process policy.

Last updated: 2026-07-22 after Milestone 10 commit `bd5ec5f`. Branch: `commercial-beta-local-first`.

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

- Ollama is the default provider; OpenAI is optional and explicit.
- ScopeLedger never downloads a model automatically.
- Real local verification uses `gemma3:12b-it-qat`; model choice remains configurable.
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
