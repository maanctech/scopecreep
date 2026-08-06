import { PGlite } from "@electric-sql/pglite";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  resetPoolForTesting,
  setPoolForTesting,
} from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrations";

function adapter(db: PGlite): Pool {
  const client = {
    query: async (text: string, values: unknown[] = []) => {
      if (
        !values.length &&
        text
          .split(";")
          .filter((statement) => statement.trim()).length > 1
      ) {
        await db.exec(text);

        return { rows: [], rowCount: 0 };
      }

      const result = await db.query(text, values);

      return { rows: result.rows, rowCount: result.rows.length };
    },
    release: () => {},
  };

  return {
    query: client.query,
    connect: async () => client,
    end: async () => {},
  } as unknown as Pool;
}

describe("ordered PostgreSQL migrations", () => {
  let db: PGlite;

  beforeAll(() => {
    db = new PGlite();
    setPoolForTesting(adapter(db));
  });

  afterAll(async () => {
    resetPoolForTesting();
    await db.close();
  });

  it("applies migrations 001-012 on a fresh database and reruns idempotently", async () => {
    const first = await runMigrations();
    const second = await runMigrations();
    const applied = await db.query<{ version: string; filename: string }>(
      "SELECT version,filename FROM schema_migrations ORDER BY version",
    );

    expect(first).toHaveLength(12);
    expect(first[0]).toBe("001_commercial_foundation.sql");
    expect(first.at(-1)).toBe("012_weekly_monitoring_report.sql");
    expect(second).toEqual([]);
    expect(applied.rows.map((row) => row.version)).toEqual([
      "001",
      "002",
      "003",
      "004",
      "005",
      "006",
      "007",
      "008",
      "009",
      "010",
      "011",
      "012",
    ]);
  });
});
