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

/**
 * The behavioural assertions above run against `companies` alone, so on their own
 * they would pass with every other table's policy replaced by `USING (true)`. That
 * was verified rather than assumed. These read each policy's own expression back
 * out of the catalogue instead, so all of them are covered and an added table with
 * an unreviewed rule fails until somebody widens the list on purpose.
 */
const SYSTEM_ACCESS = "( SELECT has_system_access() AS has_system_access)";
const TENANT = "( SELECT tenant_id() AS tenant_id)";

const ORGANIZATION_COLUMN_POLICY = `(${SYSTEM_ACCESS} OR (organization_id = ${TENANT}))`;
const OWN_IDENTIFIER_POLICY = `(${SYSTEM_ACCESS} OR (id = ${TENANT}))`;
const SYSTEM_ACCESS_ONLY_POLICY = `(${SYSTEM_ACCESS} OR false)`;
const MEMBERSHIP_POLICY =
  `(${SYSTEM_ACCESS} OR (EXISTS ( SELECT 1 FROM organization_memberships m ` +
  `WHERE ((m.user_id = users.id) AND (m.organization_id = ${TENANT})))))`;

const EXPECTED_POLICY_BY_TABLE = new Map<string, string>([
  ...[
    "analysis_jobs", "audit_logs", "audit_requests", "backup_records", "billing_events",
    "client_messages", "communication_attachments", "communication_connections",
    "communication_sources", "communication_threads", "companies", "encrypted_secrets",
    "ingestion_jobs", "lead_status_history", "leads", "oauth_authorization_requests",
    "organization_memberships", "organization_settings", "projects", "report_versions",
    "reports", "sales_templates", "scope_boundary_items", "scope_boundary_maps",
    "scope_finding_history", "scope_findings", "sow_documents", "sow_risk_items",
    "sow_risk_reviews", "sow_sections", "sow_versions", "sync_checkpoints",
    "user_sessions", "webhook_deliveries"
  ].map((table): [string, string] => [table, ORGANIZATION_COLUMN_POLICY]),
  ["organizations", OWN_IDENTIFIER_POLICY],
  ["password_reset_tokens", SYSTEM_ACCESS_ONLY_POLICY],
  ["users", MEMBERSHIP_POLICY]
]);

async function policyExpressions() {
  const policies = await withSystemAccess(() => query<{ tablename: string; qual: string | null; with_check: string | null }>(
    "SELECT tablename, qual, with_check FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename"
  ));

  return policies.rows.map((row) => ({
    table: row.tablename,
    reading: (row.qual ?? "<none>").replace(/\s+/g, " ").trim(),
    writing: (row.with_check ?? "<none>").replace(/\s+/g, " ").trim()
  }));
}

describe("every tenant policy says what it is supposed to say", () => {
  it("gives each table the reviewed rule for its shape, on reads and on writes alike", async () => {
    const mismatched = (await policyExpressions())
      .filter((policy) => {
        const expected = EXPECTED_POLICY_BY_TABLE.get(policy.table);

        return policy.reading !== expected || policy.writing !== expected;
      })
      .map((policy) => `${policy.table}: ${policy.reading}`);

    expect(mismatched).toEqual([]);
  });

  it("covers every policy in the database, so a new table cannot arrive unreviewed", async () => {
    const policies = await policyExpressions();

    expect(policies.map((policy) => policy.table).filter((table) => !EXPECTED_POLICY_BY_TABLE.has(table))).toEqual([]);
    expect(policies).toHaveLength(EXPECTED_POLICY_BY_TABLE.size);
  });

  it("evaluates the tenant lookup once per query rather than once per row", async () => {
    const perRow = (await policyExpressions())
      .filter((policy) => policy.reading.split(TENANT).join("").includes("tenant_id()"))
      .map((policy) => policy.table);

    expect(perRow).toEqual([]);
  });
});
