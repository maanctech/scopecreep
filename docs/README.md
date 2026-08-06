# Documentation Index

One line per document in `docs/`, grouped by topic.

## Architecture

- [Product Overview](product-overview.md) - current MVP features, routes and pages, and API routes, moved out of the top-level README.
- [Architecture Overview](architecture.md) - the self-hosted Next.js/PostgreSQL/Ollama system shape and component responsibilities.
- [Product and Architecture Decisions](DECISIONS.md) - standing decisions on control/money, storage/tenancy/recovery, AI/evidence, ingestion, and deployment.
- [Implementation and Verification Status](status-matrix.md) - the status labels used across product, setup, sales, and release discussions.

## Operating

- [Self-Hosted Installation](installation.md) - the supported Docker/PostgreSQL/Ollama install path, with a macOS quick start.
- [Administrator Guide](admin-guide.md) - first-run and ongoing administrative operations.
- [Backup and Restore](backup-and-restore.md) - what an installation backup archive contains and how to restore one.
- [Diagnostics and Support Bundles](diagnostics.md) - reading Settings > System health and generating redacted support bundles.
- [Migration and Update Guide](migration-guide.md) - what to do before and after updating an installation.
- [Model Selection Guide](model-selection.md) - how ScopeLedger picks an Ollama model and how to validate one before real use.
- [Ollama Setup](ollama-setup.md) - installing and configuring the default local AI provider.
- [Security Model](security-model.md) - trust boundaries and current security controls.
- [Security Audit](security-audit.md) - whole-repository review of authentication, tenancy, credentials, and dependencies, with what was fixed and what remains open.
- [Privacy Model](privacy-model.md) - product data-handling behavior (not a legal privacy policy).
- [Troubleshooting](troubleshooting.md) - fixes for common startup and runtime problems.
- [Professional User Guide](user-guide.md) - the end-to-end audit workflow for a signed-in professional.
- [Known Limitations](KNOWN_LIMITATIONS.md) - current product gaps and the automated-test evidence behind them.

## Integrations

- [ScopeLedger Integration Setup](integration-setup.md) - connection states and the verification-status table across every provider.
- [Google Gmail Setup](google-setup.md) - the Bring-Your-Own-Credentials Gmail adapter.
- [Microsoft 365 Setup](microsoft-setup.md) - the Bring-Your-Own-Credentials Microsoft 365 adapter.
- [Slack Setup](slack-setup.md) - the Bring-Your-Own-Credentials Slack adapter.
- [Email and IMAP Setup](imap-setup.md) - the self-hosted IMAP connector.
- [Signed Webhook Setup](webhook-setup.md) - the HMAC-signed inbound webhook, available and verified locally.

## Business

- [Release Gates and Evidence](RELEASE_GATES.md) - the release-readiness evidence log.
- [Private-Beta Release Checklist](release-checklist.md) - the dated, evidenced checklist completed before private beta.
- [Change Log](changelog.md) - milestone-by-milestone change history.
- [Private-Beta Sales Guide](private-beta-sales-guide.md) - positioning and sales guidance for the private beta.
- [Private-Beta Pilot Runbook](private-beta-pilot-runbook.md) - founder onboarding, weekly operation, evidence, and exit criteria for three agency pilots.

---

`history/AUTONOMOUS_STATE.md` holds scaffolding from an autonomous agent run. It is superseded by git history and is kept for reference only, not as active documentation.
