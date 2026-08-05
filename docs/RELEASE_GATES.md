# Release Gates and Evidence

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
