import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { PoolClient } from "pg";
import { transaction } from "@/lib/db/client";

export type Migration = {
  version: string;
  filename: string;
  checksum: string;
  sql: string;
};

export async function loadMigrations(directory = path.join(process.cwd(), "db", "migrations")) {
  const filenames = (await fs.readdir(directory))
    .filter((filename) => /^\d+_[a-z0-9_]+\.sql$/.test(filename))
    .sort();

  return Promise.all(
    filenames.map(async (filename): Promise<Migration> => {
      const sql = await fs.readFile(path.join(directory, filename), "utf8");
      return {
        version: filename.split("_")[0],
        filename,
        checksum: createHash("sha256").update(sql).digest("hex"),
        sql
      };
    })
  );
}

async function ensureMigrationTable(client: Pick<PoolClient, "query">) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version text PRIMARY KEY,
      filename text NOT NULL UNIQUE,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

export async function runMigrations() {
  const migrations = await loadMigrations();
  return transaction(async (client) => {
    await ensureMigrationTable(client);
    const applied = await client.query<{ version: string; checksum: string }>(
      "SELECT version, checksum FROM schema_migrations ORDER BY version"
    );
    const appliedByVersion = new Map(applied.rows.map((row) => [row.version, row.checksum]));
    const newlyApplied: string[] = [];

    for (const migration of migrations) {
      const existingChecksum = appliedByVersion.get(migration.version);
      if (existingChecksum && existingChecksum !== migration.checksum) {
        throw new Error(`Migration ${migration.filename} changed after it was applied.`);
      }
      if (existingChecksum) continue;

      await client.query(migration.sql);
      await client.query(
        "INSERT INTO schema_migrations (version, filename, checksum) VALUES ($1, $2, $3)",
        [migration.version, migration.filename, migration.checksum]
      );
      newlyApplied.push(migration.filename);
    }

    return newlyApplied;
  });
}
