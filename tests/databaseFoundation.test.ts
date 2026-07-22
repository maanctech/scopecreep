import { promises as fs } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildDemoStore } from "@/lib/demoData";
import { executeJsonImport, prepareJsonImport } from "@/lib/db/jsonImport";

const ORGANIZATION_ID = "10000000-0000-4000-8000-000000000001";
let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  const directory = path.join(process.cwd(), "db", "migrations");
  const migrations = (await fs.readdir(directory)).filter((name) => name.endsWith(".sql")).sort();
  for (const filename of migrations) {
    await db.exec(await fs.readFile(path.join(directory, filename), "utf8"));
  }
  await db.query(
    "INSERT INTO organizations (id, name, slug) VALUES ($1, $2, $3)",
    [ORGANIZATION_ID, "ScopeLedger Test", "scopeledger-test"]
  );
});

afterAll(async () => {
  await db.close();
});

describe("commercial PostgreSQL foundation", () => {
  it("creates the complete normalized schema", async () => {
    const result = await db.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
    );
    const tables = new Set(result.rows.map((row) => row.table_name));
    expect(tables.has("organizations")).toBe(true);
    expect(tables.has("sow_versions")).toBe(true);
    expect(tables.has("communication_connections")).toBe(true);
    expect(tables.has("analysis_jobs")).toBe(true);
    expect(tables.has("scope_findings")).toBe(true);
    expect(tables.has("sow_risk_reviews")).toBe(true);
    expect(tables.has("sow_risk_items")).toBe(true);
    expect(tables.has("billing_events")).toBe(true);
    expect(tables.has("report_versions")).toBe(true);
    expect(tables.size).toBeGreaterThanOrEqual(32);
  });

  it("validates and imports the Northstar demo without changing its revenue total", async () => {
    const plan = prepareJsonImport(buildDemoStore());
    expect(plan.summary.demoPotentialRevenueCents).toBe(1_347_500);
    expect(plan.summary.messages).toBe(12);
    expect(plan.summary.findings).toBe(12);

    await db.transaction(async (transaction) => {
      await executeJsonImport(transaction as never, ORGANIZATION_ID, plan);
    });

    const totals = await db.query<{ total: number; count: number }>(
      `SELECT COALESCE(sum(estimated_revenue_cents), 0)::int AS total, count(*)::int AS count
       FROM scope_findings WHERE organization_id = $1 AND classification <> 'In Scope'`,
      [ORGANIZATION_ID]
    );
    expect(totals.rows[0]).toEqual({ total: 1_347_500, count: 8 });

    const sow = await db.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM sow_versions WHERE organization_id = $1",
      [ORGANIZATION_ID]
    );
    expect(sow.rows[0].count).toBe(1);
    const workspace = await db.query<{ active: boolean; sections: number }>(
      `SELECT (p.active_sow_version_id = v.id) AS active,
              (SELECT count(*)::int FROM sow_sections s WHERE s.sow_version_id = v.id) AS sections
       FROM projects p JOIN sow_versions v ON v.id = p.active_sow_version_id
       WHERE p.organization_id = $1`,
      [ORGANIZATION_ID]
    );
    expect(workspace.rows[0].active).toBe(true);
    expect(workspace.rows[0].sections).toBeGreaterThan(0);
  });

  it("is deterministic and idempotent for the same organization", async () => {
    const plan = prepareJsonImport(buildDemoStore());
    await db.transaction(async (transaction) => {
      await executeJsonImport(transaction as never, ORGANIZATION_ID, plan);
    });
    const result = await db.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM scope_findings WHERE organization_id = $1",
      [ORGANIZATION_ID]
    );
    expect(result.rows[0].count).toBe(12);
  });

  it("namespaces imported records by organization", async () => {
    const secondOrganization = "10000000-0000-4000-8000-000000000002";
    await db.query(
      "INSERT INTO organizations (id, name, slug) VALUES ($1, 'Second Workspace', 'second-workspace')",
      [secondOrganization]
    );
    const plan = prepareJsonImport(buildDemoStore());
    await db.transaction(async (transaction) => {
      await executeJsonImport(transaction as never, secondOrganization, plan);
    });
    const ids = await db.query<{ organization_id: string; id: string }>(
      "SELECT organization_id, id FROM projects ORDER BY organization_id"
    );
    expect(ids.rows).toHaveLength(2);
    expect(ids.rows[0].id).not.toBe(ids.rows[1].id);
  });

  it("rejects cross-organization relationships at the database boundary", async () => {
    const projects = await db.query<{ organization_id: string; id: string }>(
      "SELECT organization_id, id FROM projects ORDER BY organization_id"
    );
    const firstOrganization = projects.rows[0].organization_id;
    const secondOrganizationProject = projects.rows[1].id;
    await expect(
      db.query(
        `INSERT INTO client_messages
         (id, organization_id, project_id, source, message_text)
         VALUES ('10000000-0000-4000-8000-000000000099', $1, $2, 'Other', 'cross organization')`,
        [firstOrganization, secondOrganizationProject]
      )
    ).rejects.toThrow();
  });

  it("rolls back every imported row when the transaction fails", async () => {
    const rollbackOrganization = "10000000-0000-4000-8000-000000000003";
    await db.query(
      "INSERT INTO organizations (id, name, slug) VALUES ($1, 'Rollback Workspace', 'rollback-workspace')",
      [rollbackOrganization]
    );
    const plan = prepareJsonImport(buildDemoStore());
    await expect(
      db.transaction(async (transaction) => {
        await executeJsonImport(transaction as never, rollbackOrganization, plan);
        throw new Error("forced rollback");
      })
    ).rejects.toThrow("forced rollback");
    const result = await db.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM projects WHERE organization_id = $1",
      [rollbackOrganization]
    );
    expect(result.rows[0].count).toBe(0);
  });

  it("enforces append-only billing events in the database", async () => {
    const event = await db.query<{ id: string }>(
      "SELECT id FROM billing_events WHERE organization_id = $1 LIMIT 1",
      [ORGANIZATION_ID]
    );
    await expect(
      db.query("UPDATE billing_events SET note = 'tampered' WHERE id = $1", [event.rows[0].id])
    ).rejects.toThrow(/append-only/);
  });
});
