import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadMigrations } from "@/lib/db/migrations";

type EnumeratedCheck = {
  constraintName: string;
  values: string[];
};

let db: PGlite;
let appliedMigrations: string[] = [];
const enumeratedChecks = new Map<string, EnumeratedCheck>();
const columnDefaults = new Map<string, string>();

function unquote(literal: string) {
  return literal.replace(/''/g, "'");
}

/**
 * Postgres rewrites `col IN ('a', 'b')` into `col::text = ANY (ARRAY[...])`,
 * so the stored definition never matches the source spelling. Both forms are
 * read here because the constraint text is what the running database enforces.
 */
function parseEnumeratedCheck(definition: string) {
  const match = definition.match(/\(?\(?([a-z_]+)\)?(?:::text)?\s*=\s*ANY\s*\(\s*\(?ARRAY\[(.+?)\]/is)
    ?? definition.match(/\(?([a-z_]+)\)?\s+IN\s+\((.+?)\)/is);

  if (!match) return null;

  const values = [...match[2].matchAll(/'((?:[^']|'')*)'/g)].map(([, value]) => unquote(value));

  return values.length ? { column: match[1], values } : null;
}

beforeAll(async () => {
  db = new PGlite();
  const migrations = await loadMigrations();

  appliedMigrations = migrations.map((migration) => migration.filename);

  for (const migration of migrations) {
    await db.exec(migration.sql);
  }

  const checks = await db.query<{ table_name: string; conname: string; definition: string }>(`
    SELECT c.relname AS table_name, con.conname, pg_get_constraintdef(con.oid) AS definition
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND con.contype = 'c'
  `);

  for (const row of checks.rows) {
    const parsed = parseEnumeratedCheck(row.definition);

    if (parsed) enumeratedChecks.set(`${row.table_name}.${parsed.column}`, { constraintName: row.conname, values: parsed.values });
  }

  const defaults = await db.query<{ table_name: string; column_name: string; column_default: string }>(`
    SELECT c.relname AS table_name, a.attname AS column_name,
           pg_get_expr(d.adbin, d.adrelid) AS column_default
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND a.attnum > 0 AND NOT a.attisdropped
  `);

  for (const row of defaults.rows) {
    const literal = row.column_default.match(/^'((?:[^']|'')*)'::/);

    if (literal) columnDefaults.set(`${row.table_name}.${row.column_name}`, unquote(literal[1]));
  }
});

afterAll(async () => {
  await db.close();
});

describe("the migrated schema is internally consistent", () => {
  it("applies every migration and exposes enumerated CHECK constraints to inspect", () => {
    expect(enumeratedChecks.size).toBeGreaterThan(15);
    expect(columnDefaults.size).toBeGreaterThan(0);
  });

  it("names every migration so the production runner will pick it up", async () => {
    const { readdirSync } = await import("node:fs");
    const onDisk = readdirSync(new URL("../db/migrations", import.meta.url)).filter((entry) => entry.endsWith(".sql")).sort();

    expect(appliedMigrations).toEqual(onDisk);
  });

  it("never defaults a column to a value its own CHECK constraint rejects", () => {
    const violations = [...columnDefaults.entries()]
      .filter(([column, value]) => {
        const check = enumeratedChecks.get(column);

        return check ? !check.values.includes(value) : false;
      })
      .map(([column, value]) => `${column} defaults to '${value}', which ${enumeratedChecks.get(column)?.constraintName} rejects`);

    expect(violations).toEqual([]);
  });

  it("accepts a communication_connections insert that leaves status to its default", async () => {
    await db.query("INSERT INTO organizations (id, name, slug) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING", [
      "20000000-0000-4000-8000-000000000001",
      "Schema Integrity Test",
      "schema-integrity-test"
    ]);

    const inserted = db.query<{ status: string }>(
      "INSERT INTO communication_connections (id, organization_id, provider, name) VALUES ($1, $2, $3, $4) RETURNING status",
      [
        "20000000-0000-4000-8000-000000000002",
        "20000000-0000-4000-8000-000000000001",
        "Manual",
        "Default status probe"
      ]
    );

    await expect(inserted.then((result) => result.rows[0].status)).resolves.toBe("Not Configured");
  });
});
