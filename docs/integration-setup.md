# ScopeLedger Integration Setup

ScopeLedger runs integrations with customer-controlled credentials. Saving a form leaves a connection at **Credentials Required**. Only a successful request to the provider changes it to **Connected**. Imported communications remain private and are not analyzed or sent automatically.

## Verification Status

| Method                    | Product status             | Verification                                                           |
| ------------------------- | -------------------------- | ---------------------------------------------------------------------- |
| Manual text/CSV/JSON      | Available                  | Verified locally                                                       |
| VTT/SRT transcript import | Available                  | Verified locally                                                       |
| Signed webhook            | Available                  | Verified locally with HMAC and replay tests                            |
| IMAP                      | Bring Your Own Credentials | Contract-tested; live mailbox credentials required                     |
| Slack                     | Bring Your Own Credentials | Mocked contract tests; customer Slack app required                     |
| Google Gmail              | Bring Your Own Credentials | Mocked contract tests; customer Google OAuth app required              |
| Microsoft 365             | Bring Your Own Credentials | Mocked contract tests; customer Entra app and tenant approval required |

No repository test claims live Slack, Google, Microsoft, or IMAP connectivity without customer credentials.

## Manual and Transcript Import

Open `/app/import`, select a project, choose the format, and preview the recognized records before confirming. Text messages use a line containing `---` as a separator. Transcript mode accepts WebVTT (`.vtt`), SubRip (`.srt`), or pasted cues and recognizes `Speaker: message` lines.

Limits are 5 MB, 5,000 records per import, and 100,000 characters per message. Repeating an identical import does not create duplicate messages.

## Signed Webhook

Create a webhook in `/app/integrations` and store the one-time signing secret immediately. Send JSON accepted by the manual JSON importer to the displayed endpoint with:

- `X-ScopeLedger-Timestamp`: current Unix time in seconds
- `X-ScopeLedger-Delivery-Id`: a unique identifier for this delivery
- `X-ScopeLedger-Signature`: `sha256=` followed by HMAC-SHA256 of `<timestamp>.<raw-body>`

Requests outside the five-minute signature window, invalid signatures, payloads over 1 MB, and reused delivery IDs with different content are rejected. The connection becomes Connected only after its first valid delivery.

## IMAP

Create a dedicated read-only mailbox account where the mail service supports it. In the Integration Hub, enter the host, TLS port (normally 993), username, password, folder, project route, and optional allowed sender domains.

ScopeLedger requires certificate-validated TLS by default, reads plain-text bodies, stores attachment metadata rather than attachment bodies, and advances a UID checkpoint only after persistence succeeds. Private network hosts are blocked unless the installation operator explicitly sets `ALLOW_PRIVATE_INTEGRATION_HOSTS=true`. Insecure IMAP additionally requires `ALLOW_INSECURE_IMAP=true` and is intended only for a trusted test server.

## Slack

Create a Slack app in the customer's workspace and install it with a bot token. Required bot scopes for the selected channel types are:

- `channels:history` and `channels:read` for public channels
- `groups:history` and `groups:read` for private channels the app has joined
- `users:read` and `users:read.email` for sender names and internal-domain exclusion

Invite the bot to every selected channel. Enter channel IDs, not display names. ScopeLedger reads channel history and thread replies incrementally and does not post messages. Slack app creation, workspace approval, and token issuance are external customer steps.

## Google Gmail

Create a Google Cloud OAuth web application, enable the Gmail API, and add this redirect URI exactly:

`<APP_URL>/api/integrations/oauth/google/callback`

The adapter requests OpenID identity and `gmail.readonly`. Enter the client ID and client secret, save, then choose **Authorize**. Optional Gmail search syntax and label IDs limit the mailbox scope. OAuth state and PKCE are validated; refresh and access tokens are encrypted. Google consent-screen configuration, test-user access, and production verification are external customer steps.

## Microsoft 365

Create a Microsoft Entra app registration and add this web redirect URI exactly:

`<APP_URL>/api/integrations/oauth/microsoft/callback`

Configure delegated permissions:

- `User.Read`
- `Mail.Read`
- `ChannelMessage.Read.All` only when Teams channels are selected
- `offline_access`

Enter the application client ID, client secret, tenant ID (or `common` where permitted), Outlook folder, and optional Teams rows in `team ID | channel ID | label` format. Save, then choose **Authorize**. Tenant admin consent may be required, especially for Teams. App registration and tenant approval are external customer steps.

## Disconnecting

Disconnect removes encrypted local credentials and sync checkpoints, marks the connection Disabled, and retains previously imported audit records. Google token revocation is attempted before local removal. Other providers may still require an administrator to revoke the app or token in the provider console.
