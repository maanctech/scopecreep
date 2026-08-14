import { PGlite } from "@electric-sql/pglite";
import { Pool, type PoolClient } from "pg";
import { resetPoolForTesting, setPoolForTesting } from "@/lib/db/client";
import { loadMigrations, type Migration } from "@/lib/db/migrations";

const APPLICATION_ROLE = "scopeledger_test_app";
const APPLICATION_PASSWORD = "scopeledger-test-app";

export type TestDatabase = { close: () => Promise<void> };

const PURPOSE_ROLES = [
  "scopeledger_provisioning",
  "scopeledger_directory_sync",
  "scopeledger_webhook_routing",
  "scopeledger_job_recovery",
  "scopeledger_bootstrap"
];

const GRANTS = [
  `GRANT USAGE ON SCHEMA public TO ${APPLICATION_ROLE}`,
  `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${APPLICATION_ROLE}`,
  `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${APPLICATION_ROLE}`,
  `GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ${APPLICATION_ROLE}`,
  ...PURPOSE_ROLES.map((role) => `GRANT ${role} TO ${APPLICATION_ROLE}`)
];

/**
 * Adapts one PGlite instance to the part of the node-postgres `Pool` API the
 * store uses: `query()` for single statements and `connect()` for
 * `transaction()`. PGlite is single-connection, so BEGIN, COMMIT, and ROLLBACK
 * issued through `.query()` behave as they would on a dedicated connection.
 */
function createPgliteAdapter(instance: PGlite): Pool {
  const client = {
    query: async (text: string, values: unknown[] = []) => {
      const result = await instance.query(text, values);

      return { rows: result.rows, rowCount: result.rows.length };
    },
    release: () => {}
  };

  return {
    query: (text: string, values: unknown[] = []) => client.query(text, values),
    connect: async () => client,
    end: async () => {}
  } as unknown as Pool;
}

/**
 * The production loader cannot be used here because it needs the pool this
 * function is preparing, so the ledger it maintains is written by hand.
 * Leaving it out would give the tests a schema that production never has, and
 * anything reading `schema_migrations` would fail only in the suite.
 */
async function applyMigrations(runner: {
  execute: (sql: string) => Promise<unknown>;
  record: (migration: Migration) => Promise<unknown>;
}) {
  await runner.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version text PRIMARY KEY,
      filename text NOT NULL UNIQUE,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  for (const migration of await loadMigrations()) {
    await runner.execute(migration.sql);
    await runner.record(migration);
  }
}

const RECORD_MIGRATION = "INSERT INTO schema_migrations (version, filename, checksum) VALUES ($1, $2, $3)";

function migrationValues(migration: Migration) {
  return [migration.version, migration.filename, migration.checksum];
}

async function startPglite(): Promise<TestDatabase> {
  const instance = new PGlite();

  await applyMigrations({
    execute: (sql) => instance.exec(sql),
    record: (migration) => instance.query(RECORD_MIGRATION, migrationValues(migration))
  });
  await instance.exec(`
    CREATE ROLE ${APPLICATION_ROLE};
    ${GRANTS.join(";\n    ")};
    SET ROLE ${APPLICATION_ROLE};
  `);
  setPoolForTesting(createPgliteAdapter(instance));

  return {
    close: async () => {
      resetPoolForTesting();
      await instance.close();
    }
  };
}

function applicationUrl(administratorUrl: string) {
  const url = new URL(administratorUrl);

  url.username = APPLICATION_ROLE;
  url.password = APPLICATION_PASSWORD;

  return url.toString();
}

/**
 * The administrator connection owns the schema and is expected to hold rights
 * the application account deliberately lacks, so it is used only to rebuild
 * the schema and mint the unprivileged role the tests actually run as.
 */
async function startRealPostgres(administratorUrl: string): Promise<TestDatabase> {
  const administrator = new Pool({ connectionString: administratorUrl });

  try {
    await administrator.query("DROP SCHEMA IF EXISTS public CASCADE");
    await administrator.query("CREATE SCHEMA public");
    await applyMigrations({
      execute: (sql) => administrator.query(sql),
      record: (migration) => administrator.query(RECORD_MIGRATION, migrationValues(migration))
    });
    await administrator.query(
      `DO $$ BEGIN
         IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${APPLICATION_ROLE}') THEN
           CREATE ROLE ${APPLICATION_ROLE} LOGIN PASSWORD '${APPLICATION_PASSWORD}';
         END IF;
       END $$`
    );
    const attributes = await administrator.query<{ rolsuper: boolean; rolbypassrls: boolean }>(
      `SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = '${APPLICATION_ROLE}'`
    );
    const { rolsuper, rolbypassrls } = attributes.rows[0];

    if (rolsuper || rolbypassrls) {
      throw new Error(
        `${APPLICATION_ROLE} holds SUPERUSER or BYPASSRLS, so it would read past every tenant policy and these assertions would prove nothing. Drop the role and let this harness recreate it.`
      );
    }

    for (const grant of GRANTS) await administrator.query(grant);
  } finally {
    await administrator.end();
  }

  const application = new Pool({ connectionString: applicationUrl(administratorUrl), max: 4 });

  setPoolForTesting(application);

  return {
    close: async () => {
      resetPoolForTesting();
      await application.end();
    }
  };
}

/**
 * Migrations run through the production loader, and the connection then drops
 * to an ordinary role. PostgreSQL exempts superusers from row-level security
 * and FORCE does not override that, so a suite left on the bootstrap user
 * would pass with every tenant policy removed.
 *
 * Set `SCOPELEDGER_TEST_DATABASE_URL` to an administrator connection to run
 * against a real server instead of PGlite. The URL's database is rebuilt from
 * scratch, so it must never point at anything worth keeping.
 */
export function startTestDatabase(): Promise<TestDatabase> {
  const administratorUrl = process.env.SCOPELEDGER_TEST_DATABASE_URL;

  return administratorUrl ? startRealPostgres(administratorUrl) : startPglite();
}

export function stopTestDatabase(database: TestDatabase | undefined) {
  return database ? database.close() : Promise.resolve();
}

export type { PoolClient };
