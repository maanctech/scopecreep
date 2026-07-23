# Known Limitations

Last updated: 2026-07-22 during Milestone 9. Branch `commercial-beta-local-first`; committed HEAD `1028c1b`.

- The current verification host does not have Docker, so the image build, Compose startup, and real containerized restore drill are not yet evidenced.
- No real Ollama model run is evidenced on this host; provider behavior and structured output are covered through controlled mock services.
- Slack, Google, Microsoft, and IMAP are implemented but not live-verified without customer credentials. Provider and tenant approval may be required.
- Image-only PDFs are not OCR'd. Paste text or provide a text-based PDF, TXT, or DOCX.
- Rate limits are process-local. A reverse proxy must add installation-level controls for broader deployment.
- Public lead and audit submissions are not idempotent across independent HTTP retries; an operator may need to merge an obvious duplicate intake.
- Organization switching and browser member management are not implemented.
- There is no client login, approval link, notification, automatic email, automatic change order, invoice integration, payment collection, or accounting integration.
- There is no independent penetration test, formal legal privacy approval, production monitoring service, or public support SLA.
- Backups require compatible PostgreSQL client tools and operator-managed encrypted off-host storage.
- AI estimates can be wrong. Every scope and billing decision requires professional evidence review.

## Current Test Evidence

- 142 automated tests pass; one Docker-only Compose validation test is skipped because Docker is unavailable.
- The production build and public lead-to-intake browser flow pass.
- Mocked connector/provider tests do not prove live third-party or real-model behavior.

## Exact Next Objective

Commit the reviewed Milestone 9 changes, then run the consolidated Milestone 10 release audit. The highest-priority unresolved gates are a real Ollama model fixture, Docker image/Compose startup, and a real disposable backup/restore drill.
