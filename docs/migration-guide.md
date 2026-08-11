# Migration and Update Guide

## Before Updating

1. Create an installation backup and copy it to encrypted off-host storage.
2. Record the current application commit or release, migration list, configured AI model, and health result.
3. Review the change log and known limitations.
4. Stop connector sync and avoid billing changes during the maintenance window.

## Apply an Update

For the retired Compose path, rebuild and start the new release as described in [Self-Hosted Installation](../legacy/docker/installation.md). Startup validates configuration, waits for PostgreSQL, and applies pending migrations. Applied migration checksums cannot change.

After startup, verify `/api/health`, sign-in, one approved SOW, one finding, report history, AI diagnostics, and connector state. Do not delete the prior backup until these checks pass.

## Legacy JSON Import

Use `npm run db:import-json -- --file=<path>` to preview. Add `--apply --organization=<uuid>` only after reviewing counts and totals. The importer validates relationships, creates a logical safety copy, namespaces identifiers, and runs transactionally. It does not replace PostgreSQL with JSON mode.

## Rollback

Application rollback is safe only when the prior release understands the current schema. If a migration is not backward-compatible, stop the application and follow [Backup and Restore](backup-and-restore.md). Never edit an applied migration or restore over an active database.
