# Backup and Restore

ScopeLedger is hosted. ScopeLedger operates the database and the document store, and is responsible for their backups and recovery. A customer firm runs nothing, installs nothing, and has no backup command to forget.

There is no longer a customer-facing installation backup. The one that existed took a `pg_dump` of the whole database, which on a shared multi-tenant database meant any one firm's system administrator could obtain every firm's records. It has been retired to `legacy/backups/` along with the container it was built for.

## Where durability comes from now

- **The database.** Point-in-time recovery from the managed PostgreSQL provider. Retention and recovery point are properties of that plan, not of application code.
- **Document originals.** Uploaded SOW files live in a private Vercel Blob store, written under `sow/<organization>/<project>/<version>/<filename>`. They have no public URL. The only way to read one is `GET /api/projects/{projectId}/sow/versions/{versionId}/file`, which resolves the row under the acting tenant first, so the database decides who may read the file.
- **Integration credentials.** Stored encrypted under `SCOPELEDGER_MASTER_KEY`. That key is held in the deployment's secret store and is deliberately not part of any database backup. A database recovered without the original key preserves encrypted records but cannot decrypt them.

## What a customer can take with them

Nothing yet. Per-firm data export is not built. Until it is, a firm that wants its records out has to ask, and an operator produces the extract by hand. `docs/KNOWN_LIMITATIONS.md` records this rather than letting the gap sit unmentioned.

The export is a tenant-scoped job, not a database dump: one organization's rows, no shell commands, delivered through a short-lived authenticated download. It is the replacement the retired backup pretended to be.

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
