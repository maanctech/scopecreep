# Row-Level Security

Every organization-scoped table enforces tenant isolation in PostgreSQL itself. Application code still filters by organization ID, but that filtering is convenience: the database policy is the guarantee. A query that forgets its `WHERE organization_id` clause returns nothing rather than another organization's rows.

## The Connection Role Must Not Be a Superuser

PostgreSQL exempts superusers from row-level security, and `FORCE ROW LEVEL SECURITY` does **not** change that. A superuser connection reads and writes past every policy, so an installation that connects as one has no tenant isolation at all — while appearing to work normally.

The official PostgreSQL Docker image creates its bootstrap user as a superuser, so the default `POSTGRES_USER` is exactly the wrong account to point `DATABASE_URL` at.

Create a dedicated login role that owns nothing and holds neither `SUPERUSER` nor `BYPASSRLS`:

```sql
CREATE ROLE scopeledger_app LOGIN PASSWORD 'use-a-generated-secret';
GRANT USAGE ON SCHEMA public TO scopeledger_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO scopeledger_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO scopeledger_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO scopeledger_app;
```

Then point `DATABASE_URL` at `scopeledger_app`. Migrations still run as the owning role, since creating tables requires privileges the application account deliberately lacks.

## Startup Refuses an Unsafe Configuration

`npm run rls:check` runs after migrations in `docker-entrypoint.sh`. It fails the start when the connected role is a superuser, when it holds `BYPASSRLS`, or when any table is missing enabled-and-forced row-level security. This is deliberate: a silently unprotected installation is worse than one that will not boot.

Run it by hand at any time:

```bash
npm run rls:check
```

## How a Request Gets Its Tenant

Policies read `app.organization_id`, applied as a transaction-scoped setting on each statement. A connection-scoped setting would survive being returned to the pool and serve one organization's rows to whichever request borrowed it next.

Services open that scope through `withAuthenticatedTenant`, which resolves the session and opens the scope together. Resolving a session without opening a scope is not possible by construction, and that matters: a helper that merely returned the session would leave every following statement with no tenant, and therefore no rows.

Two escapes exist and both are explicit:

- `withTenant(organizationId, work)` — for work that already knows its organization, such as a background analysis job or an unauthenticated webhook whose connection record names the owner.
- `withSystemAccess(work)` — for work that legitimately precedes or spans tenant identity: resolving a session token, migrations, and whole-installation backups. Widening its use widens the security boundary.

## Verification

`tests/rowLevelSecurity.test.ts` asserts the policies themselves, and `tests/serviceTenantScope.test.ts` asserts that each service opens a scope. Both connect as an ordinary role — a suite left on a superuser connection would pass with every policy removed.
