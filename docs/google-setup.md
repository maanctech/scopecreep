# Google Gmail Setup

Status: **Private Beta / Bring Your Own Credentials.** The adapter is covered by mocked contract tests; a customer Google Cloud OAuth app and consent configuration are required.

1. Enable the Gmail API in the customer's Google Cloud project.
2. Create an OAuth web application.
3. Register `<APP_URL>/api/integrations/oauth/google/callback` exactly.
4. Configure the OpenID identity and `gmail.readonly` scopes and any required test users or approval.
5. Save the client ID and secret in the Integration Hub, authorize, limit search/labels, and run a real connection test.

Tokens are encrypted locally. ScopeLedger does not send email. See [Integration Setup](integration-setup.md#google-gmail).
