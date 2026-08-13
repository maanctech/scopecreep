# Backup and Restore

ScopeLedger is hosted. ScopeLedger operates the database and the document store, and is responsible for their backups and recovery. A customer firm runs nothing, installs nothing, and has no backup command to forget.

There is no longer a customer-facing installation backup. The one that existed took a `pg_dump` of the whole database, which on a shared multi-tenant database meant any one firm's system administrator could obtain every firm's records. It has been retired to `legacy/backups/` along with the container it was built for.

## Where durability comes from now

- **The database.** Point-in-time recovery from the managed PostgreSQL provider. Retention and recovery point are properties of that plan, not of application code.
- **Document originals.** Uploaded SOW files live in a private Vercel Blob store, written under `sow/<organization>/<project>/<version>/<filename>`. They have no public URL. The only way to read one is `GET /api/projects/{projectId}/sow/versions/{versionId}/file`, which resolves the row under the acting tenant first, so the database decides who may read the file.
- **Integration credentials.** Stored encrypted under `SCOPELEDGER_MASTER_KEY`. That key is held in the deployment's secret store and is deliberately not part of any database backup. A database recovered without the original key preserves encrypted records but cannot decrypt them.

## What a customer can take with them

Their own records, as a single JSON file. `POST /api/exports` produces one and the download link stays valid for seven days.

It is a tenant-scoped read, not a database dump: every table carrying `organization_id`, queried under that organization's tenant scope, with no shell command anywhere. Tables join it because they carry that column, not because anyone listed them, so a table added later is included without being enrolled by hand.

Two are withheld deliberately, each with its reason recorded in `lib/exports/tables.ts` and repeated in the file's own manifest: `encrypted_secrets` (ciphertext under ScopeLedger's master key, useless to the firm and a target inside a downloaded file) and `oauth_authorization_requests` (in-flight PKCE verifiers). A test fails when an organization-scoped table arrives that nobody has decided about.

The firm's own people are added explicitly, since `users` carries no `organization_id` and the sweep cannot reach it. What identifies them to Clerk is selected; nothing that would authenticate as them is, because this application holds no such thing.

Uploaded SOW originals are not inside the file. Each is downloaded from its own version while the account is active.

## Restoring

Restoring the database is an operator action against the managed provider, not an application command. Before one:

1. Stop the scheduled analysis drain so no worker writes during recovery.
2. Confirm the recovery target time and the target database twice.
3. Confirm `SCOPELEDGER_MASTER_KEY` matches the key the encrypted credentials were written under.

After one:

1. Run `npm run db:migrate` to apply any migrations newer than the recovery point.
2. Run `npm run config:check` against production values.
3. Run `npm run rls:check` — a recovered database that came back with a privileged role has no tenant boundary.
4. Sign in and verify one project, its active SOW, findings, billing history, and report history.

Blob storage is versioned independently of the database. A database recovered to an earlier point can reference a `storage_path` for a version that no longer exists in the row set, or vice versa; the download route answers 404 rather than guessing.

## Reviving the retired path

`legacy/README.md` describes what the installation backup did and what it would take to bring back. It is kept because it worked when it was retired, not because it is a fallback. Anything that revives it has to answer the cross-tenant problem that retired it.
