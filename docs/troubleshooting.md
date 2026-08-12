# Troubleshooting

## Application Will Not Start

Run `npm run config:check` and correct every reported production configuration error. Confirm PostgreSQL is reachable with `npm run db:wait`. ScopeLedger deliberately rejects missing encryption keys, invalid provider settings, and non-loopback HTTP origins.

## Sign-In or Setup Fails

Confirm migrations completed and the browser is using the exact `APP_URL` origin. `/setup` works only before the first user exists. Use the documented administrator reset command rather than editing password rows.

## The AI Provider Is Unavailable

Run `npm run ai:check` to confirm the configured provider answers with the credentials the installation holds. Check that the provider's API key is present and current, and that outbound HTTPS is permitted. Analysis fails to human review rather than producing a confident finding, so an unavailable provider stalls findings; it does not fabricate them.

## Import or Connector Problems

Preview manual imports and inspect the visible rejected-row reasons. For provider connections, use the Integration Hub test action and check whether the state is `Credentials Required`, `Connected`, or `Error`. Do not infer live verification from a saved credential form. Exact provider requirements are in [Integration Setup](integration-setup.md).

## Analysis Does Not Complete

Inspect AI status and the analysis job. Verify an approved SOW boundary map exists, retry only after resolving the visible provider or validation error, and do not create duplicate manual requests. Provider failure safely yields human review, not recoverable revenue.

## An Uploaded SOW Original Will Not Download

The route answers 404 when the version has no stored original, which is normal for a version that was pasted rather than uploaded. If an uploaded one is missing, confirm `BLOB_READ_WRITE_TOKEN` points at the store the file was written to. See [Backup and Restore](backup-and-restore.md).

## Support Bundle

Generate a redacted bundle from System settings. Inspect it before sharing. Never attach environment files, SOW originals, imported messages, or database dumps to a support request.
