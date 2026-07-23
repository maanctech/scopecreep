# Email and IMAP Setup

Status: **Bring Your Own Credentials.** The connector is implemented and contract-tested; live verification requires a customer mailbox.

1. Create a dedicated read-only mailbox account where the provider supports it.
2. Enter the TLS host, port, user, password, folder, project route, and optional allowed sender domains.
3. Keep certificate validation enabled. Private hosts require the explicit `ALLOW_PRIVATE_INTEGRATION_HOSTS=true` operator decision.
4. Save, test, and sync a bounded mailbox sample before production use.

ScopeLedger stores plain-text message bodies and attachment metadata, not attachment bodies, and advances its UID checkpoint only after persistence. Insecure IMAP is a test-only exception. See [Integration Setup](integration-setup.md#imap).
