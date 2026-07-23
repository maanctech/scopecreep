# Slack Setup

Status: **Private Beta / Bring Your Own Credentials.** The adapter is covered by mocked contract tests; live use requires a customer-created Slack app and workspace approval.

1. Create a Slack app in the customer's workspace and install a bot token.
2. Grant `channels:history`, `channels:read`, `groups:history`, `groups:read`, `users:read`, and `users:read.email` only for the channel types in scope.
3. Invite the bot to each selected channel.
4. Enter channel IDs in the Integration Hub, save, and run the connection test.
5. Confirm a successful real provider request before calling the connection `Connected`.

ScopeLedger reads channel history and thread replies incrementally. It does not post messages. See [Integration Setup](integration-setup.md#slack) for operational detail.
