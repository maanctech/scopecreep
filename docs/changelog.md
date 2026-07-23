# Change Log

## Milestone 10 - Release readiness audit

- Verified the complete professional workflow on fresh PostgreSQL using real local Ollama inference with `gemma3:12b-it-qat`.
- Rejected contradictory zero-effort `Out of Scope` model output and added bounded retry regressions.
- Updated finding review controls immediately from versioned API responses to prevent stale duplicate actions.
- Passed 144 automated tests, type checking, production build, dependency audit, migration rerun, protected-API probes, secret/runtime-data checks, and production-browser verification.
- Classified the build as **Internal Alpha** because Docker startup and real backup/restore remain blocked on the current host.

## Unreleased Private Beta

### Commercial foundation

- Added PostgreSQL migrations, organization scoping, password sessions, roles, JSON import, and one-time owner setup.
- Added a professional-controlled finding and billing workflow with append-only history and integer-cent approved amounts.

### Evidence and analysis

- Added versioned SOW storage, extraction, risk review, and human-approved boundary maps.
- Added Ollama-first structured analysis, optional OpenAI, bounded retries, evidence validation, and visible jobs.
- Added manual, transcript, webhook, IMAP, Slack, Google, and Microsoft ingestion adapters with explicit verification states.

### Operations

- Added versioned reports, Markdown/CSV/print exports, diagnostics, redacted support bundles, security headers, audit logs, and installation backup/restore tooling.
- Added Docker packaging, production configuration validation, health checks, first-run setup, and self-hosted installation documentation.

### Business private beta

- Added truthful public positioning, pricing, ROI calculator, free-audit lead capture, public onboarding receipt, privacy overview, fictional product imagery, and private-beta documentation.

Known unverified gates are maintained in [Release Gates](RELEASE_GATES.md), [Release Checklist](release-checklist.md), and [Known Limitations](KNOWN_LIMITATIONS.md).
