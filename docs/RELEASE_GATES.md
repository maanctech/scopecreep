# Release Gates and Evidence

## Private Beta Monitoring Milestone 4 (2026-08-05)

| Gate | State | Evidence or blocker |
| --- | --- | --- |
| Notification organization/user isolation | Pass | Service and PostgreSQL-compatible tests reject another member's alert and constrain enablers |
| Notification deduplication | Pass | Repeated finding key produces one alert |
| Review inbox and unread state | Pass in implementation/navigation tests | Reviewer route, exact deep links, read-one/read-all, empty state, role-filtered navigation |
| Professional-only recipients | Pass | Delivery query joins active users, memberships, roles, and explicit preference |
| Digest privacy | Pass | Test fixture client/SOW secrets are absent from SMTP text |
| Daily delivery idempotency | Pass | First same-day execution sends once; second has zero attempts |
| SMTP failure behavior | Pass | Redacted stored failure, no immediate retry, maximum three attempts, visible state |
| Revenue summary units | Pass in query/test | Potential and professional-approved cent buckets remain distinct and exclusive |
| Milestone 4 full gates | Pass | Typecheck, lint, 203 tests passed; one Docker-only skip |
| Live SMTP delivery | External blocker | No authorized SMTP server credentials are available |

## Private Beta Monitoring Milestone 3 (2026-08-05)

| Gate | State | Evidence or blocker |
| --- | --- | --- |
| Platform sync serialization | Pass in implementation/tests | Organization/connection advisory lock plus active-job guard |
| Platform stale recovery | Pass | Stale Running jobs fail; fresh jobs remain; newer active work prevents connection-state clobbering |
| Lost-worker write prevention | Pass in implementation review | Persistence/checkpoint transaction locks and requires the original Running job |
| Inserted-ID queue contract | Pass | Platform and IMAP return inserted IDs; worker deduplicates before queueing |
| Edited evidence handling | Pass in PostgreSQL-compatible test | Existing message/finding retained and marked stale; no duplicate finding created |
| Deleted evidence exclusion | Pass from integrity gates | Provider tombstones set `deleted_at`; current reports and money projections exclude deleted sources |
| Truthful integration state | Pass in UI/code review | Connection state and monitoring state are displayed independently |
| Milestone 3 full gates | Pass | Typecheck, lint, 198 tests passed; one Docker-only skip |
| Live provider smoke tests | External blocker | Authorized tenants and credentials are unavailable |

## Private Beta Monitoring Milestone 2 (2026-08-05)

| Gate | State | Evidence or blocker |
| --- | --- | --- |
| Fresh/repeated migrations 001-010 | Pass | Checksum runner applies ten files and no work on rerun |
| Durable worker lease | Pass in PostgreSQL-compatible tests | One due project is claimed; fresh work is exclusive; expired work fails and becomes retryable |
| Paused and invalid projects | Pass | Paused projects are ignored; missing boundary or downgraded enabler moves to Needs Attention |
| Approved evidence pinning | Pass | Automated job records approved SOW/boundary IDs and `trigger_source=Automation` |
| Duplicate queue protection | Pass | Connector IDs are deduplicated and analysis retains one job per message |
| Controlled batch size | Pass in implementation review | Worker splits newly inserted IDs into groups of at most 100 |
| Worker Compose service | Implemented, runtime blocked | Non-HTTP worker uses the same private database/network and has no inherited app health check |
| No autonomous billing/client action | Pass in code review | Worker calls ingestion, queue, and private analysis only; no finding review, billing, report send, or client API path |

## Private Beta Monitoring Milestone 1 (2026-08-05)

| Gate | State | Evidence or blocker |
| --- | --- | --- |
| Integrity branch published | Pass | `origin/codex/integrity-release` points to `202d7ce` |
| Monitoring branch provenance | Pass | `codex/private-beta-monitoring` created from `202d7ce` |
| Local baseline | Pass | Typecheck, lint, 190 tests passed with one Docker-only skip, and production build passed |
| GitHub PR/CI merge | External blocker | GitHub CLI and authenticated browser state are unavailable on this host; no merge is claimed |
| Docker image and Compose | External blocker | Docker, Podman, and Colima are unavailable |
| Real PostgreSQL backup/restore | External blocker | `pg_dump` and `pg_restore` are unavailable |
| Live connector smoke tests | External blocker | No authorized Slack, Google, Microsoft, or IMAP test credentials are available |

Current private-beta monitoring classification: **implementation in progress**. The product remains Internal Alpha until the deployment and restore blockers pass.

## Integrity Release Milestone 1 (2026-08-05)

| Gate | State | Evidence or blocker |
| --- | --- | --- |
| Current remote baseline | Pass | Fast-forwarded to `0e2c412` and created `codex/integrity-release` |
| Secure public continuation | Pass in automated tests | No public IDs, HttpOnly credential, hashed persistence, expiry and one-time consumption |
| Onboarding-to-message import | Pass in PostgreSQL integration test | Two messages imported atomically; zero analysis jobs created |
| Reviewer manual import | Pass in authorization tests | Reviewer has `communications:write` and lacks `integrations:write` |
| Public intake default | Pass in implementation and route tests | New organizations default disabled; disabled route returns 503 |
| Migration 009 | Pass in automated gates | Fresh PGlite migration suite and full checksum/idempotency tests passed |
| Milestone 1 full gates | Pass | Typecheck, lint, 178 tests passed; one Docker-only test skipped |
| AI estimates remain unapproved | Pass | Transition and API tests assert billable actions leave approved hours/cents null |
| Dirty amount to invoice | Pass | API test records 61,234 cents and 3.5 hours atomically in the Invoiced event |
| SOW gate and draft visibility | Pass in store/UI tests | Project analysis is gated; approved and pending draft maps remain separately addressable |
| Boundary immutability | Pass | Approved map edit is rejected; approval is limited to the current SOW version |
| Milestone 2 focused tests | Pass | 60 transition, API, revenue, PostgreSQL, and SOW tests passed |
| Milestone 2 full gates | Pass | Typecheck, lint, 179 tests passed; one Docker-only test skipped |
| Analysis retry/recovery/start over | Pass | Retry preserves pinned evidence; stale Running recovery is conditional; one exhausted restart repins current approved evidence |
| IMAP stale recovery | Pass in automated tests | Fresh jobs remain untouched; stale jobs fail atomically and connection state avoids newer-job clobbering |
| AI required output and context capacity | Pass | Missing required fields fail; schema is supplied; oversized prompts make no provider call and create no finding |
| Milestone 3 full gates | Pass | Typecheck, lint, 185 tests passed; one Docker-only test skipped |
| Deleted-message exclusion | Pass in PostgreSQL test | Regenerated report omits marked content and its $4,000 estimate; active project totals become zero |
| Report version loading | Pass | Current-only snapshot join; metadata-only history; one organization/project-scoped historical body query |
| Role-aware navigation | Pass | Reviewer sees manual import but not Admin; Read Only sees findings but no import/Admin |
| First-run and error states | Pass in implementation review | Enforced three-step audit checklist; obsolete local JSON recovery instructions removed |
| Milestone 4 full gates | Pass | Typecheck, lint, 189 tests passed; one Docker-only test skipped |
| Fresh/repeated migrations 001-009 | Pass | Migration runner applied exactly nine checksum-tracked files; second run applied none |
| Local JSON migration/persistence | Pass | Full suite preserves schema v3, fictional $13,475 demo totals, atomic writes, and report history behavior |
| Final automated suite | Pass | Typecheck, lint, 190 tests passed; one Docker-only Compose test skipped |
| Production build | Pass | `npm run build` compiled all routes with Next.js webpack |
| Public browser states | Pass | Landing, closed public intake, disclaimer, and live ROI recalculation inspected |
| Protected browser workflow | Blocked on host | PostgreSQL server/client and container runtime unavailable; auth correctly refuses JSON-only mode |

Last updated: 2026-07-22 after Milestone 10 commit `bd5ec5f`. Branch: `commercial-beta-local-first`.

| Gate | State | Evidence or blocker |
| --- | --- | --- |
| Phase 1 baseline safely committed | Pass | `d9b545e`, followed by milestone commits on the commercial branch |
| Empty-database migrations | Pass | PostgreSQL migrations 001-008 passed on fresh database `scopeledger_m10_20260722`; idempotent rerun passed |
| Legacy fictional JSON import | Pass | Northstar/ApertureOps import preserves 12 findings and $13,475 potential |
| Authentication and setup | Pass | First-owner setup, lockout, login, logout, password/security tests, and protected-route redirects passed |
| Organization isolation and protected APIs | Pass | Database/authorization tests passed; unauthenticated `/api/findings` returned 401 |
| Ollama reachable with a real model | Pass | Ollama 0.32.1 with `gemma3:12b-it-qat`; discovery, health, SOW review, and structured finding analysis passed |
| SOW/version/boundary workflow | Pass | Fresh browser flow created SOW, generated evidence-linked review, and approved the boundary map |
| Communication import and deduplication | Pass | Fresh browser import inserted one message; exact repeat inserted none; automated provider/content/replay tests passed |
| Finding and billing workflow | Pass | Real finding moved through billable, invoiced, and paid; invalid transitions absent/blocked; 66 focused workflow/AI/money tests passed |
| Reports and reproducibility | Pass | Explicit v1 internal audit recorded one source finding, SOW evidence, model provenance, $9,000, Markdown/CSV exports, and private-use notices |
| Backup creation | Partial | Manifest, documents, redaction, overlap, and integrity tests pass; no real `pg_dump` run on this host |
| Destructive restore | Partial | Controlled checksum/orchestration tests pass; real disposable restore is blocked by missing `pg_restore` and container runtime |
| Docker image build | Open | Docker, Podman, and Colima are unavailable on this host |
| Docker Compose startup | Open | Container runtime unavailable; conditional Compose test remains skipped |
| Production build | Pass | `npm run build` passed after final source changes |
| Full automated test suite | Pass | 144 passed; 1 Docker-only test skipped |
| End-to-end professional workflow | Pass | Final production-browser workflow covered setup through report and logout against fresh PostgreSQL and real Ollama |
| No secrets or runtime customer data committed | Pass | Tracked-file and Git-history high-confidence scans passed; runtime data, `.env`, build output, dependencies, and model artifacts are untracked/ignored |
| No critical security findings | Pass for tested scope | Dependency audit is clean; auth, organization, CSRF/origin, SSRF, encryption, webhook, file/report sanitization, redaction, and config tests passed |
| Documentation matches implementation | Pass | Status matrix, release checklist, progress files, and limitations distinguish verified, mocked, credential-dependent, and blocked capabilities |
| Unsupported integrations are not presented as live | Pass | Platform connectors remain BYOC/private-beta with mocked-contract or credential-dependent labels |

## Current Classification

**Internal Alpha**.

The application is functionally complete for a manual, local-first professional workflow and now has real-model and end-to-end evidence. It is not `Paid Private Beta Ready` because the required Docker build/startup and real database backup/restore gates lack direct evidence. The repository must not be promoted until those installation and recovery gates pass on release hardware.
