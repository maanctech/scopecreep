# Autonomous Work State

Last updated: 2026-07-22 after the Milestone 9 skeptical review, before its commit.

## Repository State

- Branch: `commercial-beta-local-first`
- Current committed HEAD: `1028c1b` (`Add self-hosted installation and first-run setup`)
- Main branch: intentionally untouched
- Remote actions: no push, merge, or pull request
- Worktree: reviewed Milestone 9 changes are intentionally uncommitted pending explicit staging and commit

## Completed Milestones

- Milestone 0: secured, tested, and committed the existing professional revenue workflow baseline.
- Milestone 1: PostgreSQL migrations, organizations, authentication, roles, session security, and legacy JSON import.
- Milestone 2: Ollama-first provider abstraction, model discovery, health, structured validation, retries, and optional OpenAI.
- Milestone 3: SOW originals, extraction, immutable versions, risk review, and professional-approved boundary maps.
- Milestone 4: normalized communications, preview-first imports, ingestion jobs, signed webhooks, IMAP, deduplication, and checkpoints.
- Milestone 5: Integration Hub and contract-tested Slack, Google, and Microsoft adapters with honest credential states.
- Milestone 6: approved-SOW analysis jobs producing reviewable findings without automatic billing actions.
- Milestone 7: six versioned report formats, exports, backups/restores, diagnostics, redacted support bundles, audit logs, and hardening.
- Milestone 8: Docker/Compose packaging, startup validation and migration, first-owner setup, persistent volumes, and installation docs.
- Milestone 9 implementation: public positioning, pricing, ROI, fictional screenshot, private-beta lead and intake funnel, public privacy overview, sales/operations docs, and public response minimization.

## Current Evidence

- `npm test`: 21 files passed, 142 tests passed, 1 Docker-only test skipped.
- `npm run build`: successful Next.js production build with 29 static pages generated and `/privacy` included.
- `npx tsc --noEmit`: passed.
- Production-browser verification: landing page rendered with public-only navigation and a real 1280x720 fictional dashboard image.
- Production-browser funnel: a fictional lead submission created a UUID continuation; audit intake then ended at `/onboarding?submitted=audit` with a public receipt and no protected project identifier or private SOW/message response.
- Public route tests prove HTTP(S)-only website validation, UUID continuation validation, minimized lead response, and minimized audit receipt.

## Milestone 9 Skeptical Review

- Security/authorization: changed public organization selection from oldest-match routing to an exactly-one fail-closed rule; every lead continuation is now constrained to that organization. Invalid/expired continuations fail consistently in PostgreSQL and JSON modes.
- Privacy/data exposure: public responses return only a lead continuation ID or `{ ok: true }`; the receipt contains no project ID, SOW, message text, or internal route.
- Data loss/persistence: audit request, project, and first SOW version remain in one PostgreSQL transaction. Local JSON writes retain atomic temp-file replacement. Independent public HTTP retries can still create duplicates and are documented.
- Financial correctness: moved ROI arithmetic into bounded tests, floors project count, proves the $7,200/$86,400 default, and no longer recommends a price at zero leakage. Core finding totals and the $13,475 demo remain covered independently.
- Duplicate ingestion: existing provider/content uniqueness, idempotency-key, edited-message, webhook replay, and billing-event retry tests pass.
- Integration claims: public and operator docs distinguish available, credential-dependent, mocked-contract, and external-approval states. The premature `Paid private beta` claim was removed while release gates remain open.
- Artifact integrity: corrected a JPEG dashboard capture that had a `.png` filename; a regression test verifies JPEG magic bytes and the referenced path.
- Test gaps: added public funnel, tenant-selection, ROI, image-format, and Markdown-link tests. Full suite, build, dependency audit, secret scan, and production browser checks pass.

## Unresolved Failures and External Blockers

- Docker is not installed on the verification host. Image build, Compose startup, and a real containerized destructive restore drill remain unverified.
- No installed real Ollama model is available on this host. The provider and structured-output behavior are mock-tested, but the real-model release gate remains open.
- Live Slack, Google, Microsoft, and IMAP checks require customer-controlled credentials and external provider or tenant approval.
- TLS/domain, legal agreements, privacy legal approval, external penetration testing, and customer contracts are external activities.

## Exact Next Objective

Stage only the reviewed Milestone 9 files, inspect the staged list and secret/private-data surface, and commit. Then begin Milestone 10's requirement-by-requirement release audit, including the complete professional browser workflow and every release gate that can be exercised without Docker, real Ollama, or customer credentials.
