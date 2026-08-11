# Implementation and Verification Status

Use these labels in product, setup, sales, and release discussions.

- **Verified locally:** exercised against local application infrastructure or deterministic protocol tests.
- **Credential-dependent:** implemented, but a customer-controlled account or server is required for a live check.
- **Mocked contract:** provider request/response behavior is tested without a live customer tenant.
- **External approval required:** a provider, tenant administrator, domain owner, legal reviewer, or certificate authority must complete an external step.
- **Planned:** not implemented and must not be sold as available.

| Capability | Product label | Evidence status |
| --- | --- | --- |
| Manual text, CSV, JSON, VTT, and SRT import | Available | Verified locally |
| Signed inbound webhook | Available | Verified locally with HMAC, replay, size, and deduplication tests |
| SOW paste, TXT, DOCX, and text-PDF extraction | Available | Verified locally; image-only PDF OCR is not included |
| Scope findings and billing decisions | Available | Verified locally with domain, API, and browser workflow checks |
| Versioned reports and exports | Available | Verified locally |
| Anthropic analysis | Bring Your Own Credentials | Default provider; adapter contract-tested, live use requires an explicit customer key |
| OpenAI analysis | Bring Your Own Credentials | Adapter tested; live use requires an explicit customer key |
| Installation backup | Single-tenant only | Covers the whole database; must be replaced with tenant-scoped export before hosting. See Known Limitations |
| Local-model analysis | Retired | The Ollama provider is preserved unwired in `legacy/ollama`; no configuration keeps analysis text in house |
| IMAP | Bring Your Own Credentials | Implemented and contract-tested; live mailbox verification is credential-dependent |
| Slack | Private Beta / BYOC | Mocked contract only; customer Slack app and workspace approval required |
| Google Gmail | Private Beta / BYOC | Mocked contract only; customer OAuth app and Google approval may be required |
| Microsoft 365 | Private Beta / BYOC | Mocked contract only; customer Entra app and tenant approval may be required |
| Docker image and Compose startup | Private Beta | Packaging and automated conditional smoke test exist; no Docker runtime was available on the current verification host |
| Client portal, automatic notifications, invoicing, payments | Not available | Deliberately excluded |
| QuickBooks, WhatsApp, Telegram, Zoom bot | Planned | Not implemented |
