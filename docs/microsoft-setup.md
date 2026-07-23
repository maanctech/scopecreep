# Microsoft 365 Setup

Status: **Private Beta / Bring Your Own Credentials.** The adapter is covered by mocked contract tests; a customer Entra application and tenant approval are required.

1. Create an Entra app registration.
2. Register `<APP_URL>/api/integrations/oauth/microsoft/callback` exactly.
3. Add delegated `User.Read`, `Mail.Read`, and `offline_access`; add `ChannelMessage.Read.All` only for Teams channels.
4. Obtain tenant consent where required.
5. Save the client ID, secret, tenant, folder, and optional Teams IDs in the Integration Hub, authorize, and run a real connection test.

Tokens are encrypted locally. ScopeLedger does not post Teams messages or send email. See [Integration Setup](integration-setup.md#microsoft-365).
