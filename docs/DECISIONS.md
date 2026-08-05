# Product and Architecture Decisions

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
