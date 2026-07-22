# Backup and Restore

ScopeLedger installation backups are operator-controlled filesystem archives. They include a PostgreSQL custom-format dump, all document originals under `SCOPELEDGER_DOCUMENT_DIR`, encrypted integration-secret records stored in PostgreSQL, checksums, application version, and migration compatibility metadata.

The master encryption key is intentionally **not** copied into the archive. Store `SCOPELEDGER_MASTER_KEY` separately in the installation's secret manager. A database restore without the original key preserves encrypted records but cannot decrypt them.

## Prerequisites

- A PostgreSQL account that can read the entire ScopeLedger database.
- `pg_dump` and `pg_restore` from a PostgreSQL release compatible with the server.
- `tar` on the application host.
- Read/write access to `SCOPELEDGER_BACKUP_DIR`.
- Read access to every file under `SCOPELEDGER_DOCUMENT_DIR` referenced by the database.

Set explicit client paths when they are not on `PATH`:

```bash
PG_DUMP_PATH=/absolute/path/to/pg_dump
PG_RESTORE_PATH=/absolute/path/to/pg_restore
```

## Create a Backup

From the application directory:

```bash
npm run backup
```

A system administrator can also use **Settings > System > Create installation backup**. The UI records successful and failed attempts but does not expose database credentials or document contents.

The command reports the archive path, byte count, SHA-256 checksum, and completeness flag. Move completed archives to encrypted, access-controlled storage. Do not treat the local backup directory as an off-host recovery copy.

ScopeLedger refuses to mark a backup complete when a database-referenced SOW original or communication attachment is missing. Partial archives and working directories are removed after failure.

## Inspect Before Restore

Before a restore:

1. Stop the application and all workers that can write to PostgreSQL.
2. Preserve the current database and document directory independently.
3. Confirm that the target installation has migration support for the backup manifest.
4. Confirm that `SCOPELEDGER_MASTER_KEY` is the key used by the source installation.
5. Confirm the target `DATABASE_URL` and `SCOPELEDGER_DOCUMENT_DIR` twice.

The restore command validates the outer archive paths, rejects links and unexpected files, validates the manifest, verifies database and document checksums, validates the nested document archive, and checks migration compatibility before invoking `pg_restore`.

## Restore

Restore is deliberately gated by an explicit confirmation flag:

```bash
npm run restore -- /absolute/path/to/scopeledger-backup.tar.gz --confirm-restore
```

The database is restored with `pg_restore --clean --if-exists --no-owner`. Documents are extracted to a temporary sibling directory and swapped into place; the previous directory is restored if that swap fails.

After restore:

1. Run `npm run db:migrate` to apply any migrations newer than the backup.
2. Run `npm run config:check` with production environment values.
3. Start the application and inspect **Settings > System**.
4. Sign in and verify one project, its active SOW, findings, billing history, and report history.
5. Test one integration connection without starting an unrestricted sync.
6. Create a new backup after validation.

## Docker Restore

Stop the application while leaving PostgreSQL running, then restore from a path inside the backup volume:

```bash
docker compose stop app
docker compose run --rm \
  -e SCOPELEDGER_SKIP_MIGRATIONS=true \
  app npm run restore -- /app/backups/<backup-file>.tar.gz --confirm-restore
docker compose run --rm app npm run db:migrate
docker compose up -d app
```

Then complete the validation checklist above. Do not run restore while the normal application container can write to the database.

## Verification Status

Archive integrity, tamper rejection, cleanup, migration compatibility, and document replacement are automated tests. The PostgreSQL restore command is exercised with a controlled mock executable in the host test suite. The current development Mac does not have `pg_dump` or `pg_restore`, so a real native database dump/restore was not claimed there. A real PostgreSQL-tool drill remains required on a host with Docker or compatible native client tools.
