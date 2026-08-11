import { PGlite } from "@electric-sql/pglite";
import type { Pool } from "pg";
import { resetPoolForTesting, setPoolForTesting } from "@/lib/db/client";
import { loadMigrations } from "@/lib/db/migrations";

const APPLICATION_ROLE = "scopeledger_app";

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
 * Migrations run through the production loader, and the connection then drops
 * to an ordinary role. PostgreSQL exempts superusers from row-level security
 * and FORCE does not override that, so a suite left on the bootstrap user
 * would pass with every tenant policy removed.
 */
export async function startTestDatabase() {
  const database = new PGlite();

  for (const migration of await loadMigrations()) await database.exec(migration.sql);

  await database.exec(`
    CREATE ROLE ${APPLICATION_ROLE};
    GRANT USAGE ON SCHEMA public TO ${APPLICATION_ROLE};
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${APPLICATION_ROLE};
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${APPLICATION_ROLE};
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ${APPLICATION_ROLE};
    SET ROLE ${APPLICATION_ROLE};
  `);

  setPoolForTesting(createPgliteAdapter(database));

  return database;
}

export async function stopTestDatabase(database: PGlite) {
  resetPoolForTesting();
  await database.close();
}
