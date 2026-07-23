# Release Gates and Evidence

Last updated: 2026-07-22 after Milestone 9 commit `5092d37`, at the start of Milestone 10. Branch: `commercial-beta-local-first`. `Pass` requires direct current evidence; `Open` is not a failure concealment.

| Gate | State | Evidence or blocker |
| --- | --- | --- |
| Phase 1 baseline safely committed | Pass | `d9b545e`, followed by milestone commits through `1028c1b` |
| Empty-database migrations | Pass | PostgreSQL migrations 001-008 applied on fresh local PostgreSQL during Milestone 8 |
| Legacy fictional JSON import | Pass | Northstar/ApertureOps import produced the expected $13,475 potential total |
| Authentication and setup | Pass | Automated auth/security tests plus production first-owner setup and lockout check |
| Organization isolation and protected APIs | Pass | Database and authorization regression tests; final M10 audit still required |
| Ollama reachable with a real model | Open | No real Ollama model installed on this host; mock provider checks are not sufficient |
| SOW/version/boundary workflow | Pass | Unit/integration tests and browser workflow evidence from Milestones 3 and 6 |
| Communication import and deduplication | Pass | Manual, webhook, email, connector, and idempotency tests |
| Finding and billing workflow | Pass | Transition/API/totals tests and production-browser workflow evidence |
| Reports and reproducibility | Pass | Version/history/hash/read-only generation tests and browser verification |
| Backup creation | Partial | Service, manifest, document coverage, and failure tests pass; native container run is open |
| Destructive restore | Partial | Controlled mock orchestration passes; real disposable container restore is open |
| Docker image build | Open | Docker runtime unavailable on this host |
| Docker Compose startup | Open | Docker runtime unavailable on this host |
| Production build | Pass | Next.js production build passed after Milestone 9 changes |
| Full automated test suite | Pass | 142 passed, 1 Docker-only skipped |
| End-to-end professional workflow | Partial | Major browser flows verified by milestone; final consolidated M10 rerun remains |
| Public lead and onboarding funnel | Pass | Production-browser lead/intake receipt plus focused route tests |
| No secrets or runtime customer data committed | Pending final audit | Milestone 9 candidate-file scan passed; final staged and full-history M10 audit remain |
| No critical security findings | Pending final audit | Milestone 9 skeptical review fixed fail-open tenant selection and response/artifact/ROI issues; M10 audit remains |
| Documentation matches implementation | Pending final audit | Status matrix and setup guides added; requirement-level M10 cross-check remains |
| Unsupported integrations are not presented as live | Pass | Public table and docs explicitly identify verified, credential-dependent, mocked, and external-approval states |

## Current Classification

Provisional classification: **Internal Alpha**. The repository must not be called `Paid Private Beta Ready` until the real Ollama model, Docker build/startup, and real backup/restore gates have direct evidence or the final audit explicitly establishes a narrower supported installation path that satisfies the original release requirements.
