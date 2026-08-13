import { Pool } from "pg";
import { closePool } from "../lib/db/client";
import { applyMigrations, runMigrations } from "../lib/db/migrations";

/**
 * The application account cannot create tables, and giving it that right to
 * run a migration would also let any request read past every tenant policy.
 * `DATABASE_MIGRATION_URL` therefore holds the owner connection, kept apart
 * from the URL the running application uses so the two cannot be confused.
 */
async function migrateAsOwner(connectionString: string) {
  const pool = new Pool({ connectionString, max: 1 });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const applied = await applyMigrations(client);

    await client.query("COMMIT");

    return applied;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

function warnAboutPooledHost(connectionString: string) {
  if (!new URL(connectionString).hostname.includes("-pooler")) return;

  console.warn(
    "DATABASE_MIGRATION_URL points at a pooled host. Migrations need session state a transaction pooler does not keep; use the direct host instead."
  );
}

async function main() {
  const ownerUrl = process.env.DATABASE_MIGRATION_URL?.trim();

  try {
    if (ownerUrl) warnAboutPooledHost(ownerUrl);

    const applied = ownerUrl ? await migrateAsOwner(ownerUrl) : await runMigrations();

    console.log(applied.length ? `Applied: ${applied.join(", ")}` : "Database is up to date.");
  } finally {
    if (!ownerUrl) await closePool();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
