# Known Limitations

Last updated: 2026-07-22 after Milestone 10 commit `bd5ec5f`. Branch: `commercial-beta-local-first`.

- Docker, Podman, and Colima are unavailable on the verification host. Image build and Compose startup are not directly evidenced.
- `pg_dump` and `pg_restore` are unavailable. Real database backup and destructive restore are not evidenced; controlled orchestration/checksum tests do not replace that release drill.
- Slack, Google, Microsoft, and IMAP are implemented but not live-verified without customer credentials. Provider and tenant approval may be required.
- Image-only PDFs are not OCR'd. Paste text or provide a text-based PDF, TXT, or DOCX.
- Rate limits are process-local. A reverse proxy must add installation-level controls for broader deployment.
- Public lead and audit submissions are not idempotent across independent HTTP retries; an operator may need to merge an obvious duplicate intake.
- Organization switching and browser member management are not implemented.
- There is no client login, approval link, notification, automatic email, automatic change order, invoice integration, payment collection, or accounting integration.
- There is no independent penetration test, formal legal/privacy approval, production monitoring service, public support SLA, or trademark clearance.
- The repository has no lint script or automated accessibility/browser runner. Type checking, semantic production-browser inspection, and the full manual browser workflow pass, but automated a11y regression coverage remains limited.
- Long real-model calls are asynchronous but hardware-dependent. The verified communication fixture took about 26 seconds; the SOW review took about 90 seconds on this host.
- AI estimates can be wrong. Every scope and billing decision requires professional evidence review.

## Current Test Evidence

- 144 automated tests pass; one Docker-only Compose validation test is skipped.
- Type checking, production build, dependency audit, fresh/repeated migrations, real Ollama health, real structured analysis, and the full production-browser workflow pass.
- Mocked connector tests do not prove live third-party behavior.

## Exact Next Objective

Use a Docker-capable disposable host with compatible PostgreSQL client tools to build/start the release stack and complete a real backup/restore drill. Rerun the final workflow there before considering a paid private beta.
