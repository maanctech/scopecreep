# Signed Webhook Setup

Status: **Available and verified locally.**

1. Create a webhook connection in the Integration Hub and store the one-time secret.
2. Send supported JSON to `/api/webhooks/<connection-id>`.
3. Set `X-ScopeLedger-Timestamp`, a unique `X-ScopeLedger-Delivery-Id`, and `X-ScopeLedger-Signature`.
4. Compute the signature as `sha256=` plus HMAC-SHA256 of `<timestamp>.<raw-body>`.
5. Confirm the first valid delivery changes the connection to `Connected`.

The receiver rejects stale timestamps, bad signatures, conflicting replay IDs, and oversized payloads. Retries with the same delivery and content are idempotent. See [Integration Setup](integration-setup.md#signed-webhook).
