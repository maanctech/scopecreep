# Administrator Guide

## First Run

Apply migrations, open `/setup`, and create the first owner. Setup disables itself after the first user exists. Verify AI status before importing customer material.

## Routine Administration

- Use `/app/settings/system` for health, migration state, job failures, configuration checks, backups, and redacted audit activity.
- Use `/app/settings/ai` to verify provider reachability and the selected model.
- Use `/admin` for lead status, audit requests, projects, and leakage summaries.
- Provision additional users with `npm run db:create-user`; there is no browser member manager.
- Generate one-time password reset links with `npm run db:password-reset`.
- Review failed ingestion and analysis jobs before retrying. Idempotency controls prevent normal retries from duplicating imported messages or billing events.

## Access Roles

Owner and Admin can perform system and organization administration. Reviewer can operate the professional review workflow. Read Only can inspect permitted records without mutation. Use the least privilege appropriate to the operator.

## Durability

ScopeLedger operates the database and the document store. Recovery is a provider action, not an application command, and there is no backup for an administrator to run. Keep `SCOPELEDGER_MASTER_KEY` in the deployment secret store and out of any database copy. See [Backup and Restore](backup-and-restore.md).

## Incident Response

If credentials or a host may be compromised, stop external access, revoke sessions and provider tokens, preserve logs, rotate affected secrets, and inspect the redacted support bundle. Do not share SOWs, messages, environment files, database dumps, or unreviewed logs with support.
