import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { query } from "@/lib/db/client";
import { withSystemAccess, withTenant } from "@/lib/db/tenantContext";
import { startTestDatabase, stopTestDatabase, type TestDatabase } from "./support/testDatabase";

const ACME = "30000000-0000-4000-8000-00000000000a";
const RIVAL = "30000000-0000-4000-8000-00000000000b";

let database: TestDatabase;

beforeAll(async () => {
  database = await startTestDatabase();

  await withSystemAccess(async () => {
    for (const [id, slug] of [[ACME, "acme"], [RIVAL, "rival"]]) {
      await query("INSERT INTO organizations (id, name, slug) VALUES ($1, $2, $3)", [id, `${slug} co`, slug]);
      await query("INSERT INTO companies (id, organization_id, name) VALUES (gen_random_uuid(), $1, $2)", [id, `${slug} client`]);
    }
  });
});

afterAll(async () => {
  await stopTestDatabase(database);
});

describe("row-level security isolates organizations in the database", () => {
  it("enables and forces row-level security on every organization-scoped table", async () => {
    const unprotected = await withSystemAccess(() => query<{ relname: string }>(`
      SELECT c.relname FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname <> 'schema_migrations'
        AND (c.relrowsecurity = false OR c.relforcerowsecurity = false)
      ORDER BY c.relname
    `));

    expect(unprotected.rows.map((row) => row.relname)).toEqual([]);
  });

  it("gives every protected table a policy rather than enabling security with no rule", async () => {
    const policyless = await withSystemAccess(() => query<{ relname: string }>(`
      SELECT c.relname FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
        AND NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid)
      ORDER BY c.relname
    `));

    expect(policyless.rows.map((row) => row.relname)).toEqual([]);
  });

  it("returns only the tenant's own rows even when the query has no organization predicate", async () => {
    const visible = await withTenant(ACME, () => query<{ name: string }>("SELECT name FROM companies"));

    expect(visible.rows.map((row) => row.name)).toEqual(["acme client"]);
  });

  it("hides the other tenant's row from a query that names its id directly", async () => {
    const stolen = await withTenant(ACME, () => query("SELECT name FROM companies WHERE organization_id = $1", [RIVAL]));

    expect(stolen.rows).toEqual([]);
  });

  it("reads nothing when no tenant context was established", async () => {
    const withoutContext = await query("SELECT name FROM companies");

    expect(withoutContext.rows).toEqual([]);
  });

  it("refuses to write a row belonging to another organization", async () => {
    const forged = withTenant(ACME, () => query(
      "INSERT INTO companies (id, organization_id, name) VALUES (gen_random_uuid(), $1, $2)",
      [RIVAL, "planted by acme"]
    ));

    await expect(forged).rejects.toThrow(/row-level security/i);
  });

  it("refuses to move an existing row into another organization", async () => {
    const moved = withTenant(ACME, () => query("UPDATE companies SET organization_id = $1", [RIVAL]));

    await expect(moved).rejects.toThrow(/row-level security/i);
  });

  it("confines a tenant scope to its callback so a loader cannot leak one to its caller", async () => {
    const loadSomethingAndReturn = () => withTenant(ACME, () => query("SELECT name FROM companies"));

    await loadSomethingAndReturn();

    const afterTheLoaderReturned = await query("SELECT name FROM companies");

    expect(afterTheLoaderReturned.rows).toEqual([]);
  });

  it("lets an explicit system-access scope span organizations for backups and migrations", async () => {
    const everything = await withSystemAccess(() => query<{ name: string }>("SELECT name FROM companies ORDER BY name"));

    expect(everything.rows.map((row) => row.name)).toEqual(["acme client", "rival client"]);
  });
});
