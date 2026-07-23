# Autonomous Work State

Last updated: 2026-07-22 after Milestone 9 commit `5092d37`, at the start of Milestone 10.

## Repository State

- Branch: `commercial-beta-local-first`
- Latest completed milestone commit: `5092d37` (`Add private-beta business and release documentation`)
- State checkpoint: this document update immediately follows `5092d37`; use `git rev-parse HEAD` to resolve its containing checkpoint commit
- Main branch: intentionally untouched
- Remote actions: no push, merge, or pull request
- Worktree: Milestone 9 is committed; this progress update begins Milestone 10

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
- Milestone 9 (`5092d37`): public positioning, pricing, bounded ROI, fictional screenshot, private-beta lead and intake funnel, fail-closed tenant selection, public privacy overview, sales/operations docs, response minimization, and skeptical-review regressions.

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

Execute Milestone 10's requirement-by-requirement release audit. Re-derive the requirements from the original goal, map each to direct evidence, rerun the complete professional browser workflow and all automated/static/security checks, attempt every container/restore/model gate available on this host, fix any newly discovered defect, perform a separate skeptical reviewer pass, update all four progress files, and commit the final verified state.
