import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { query } from "@/lib/db/client";
import { withSystemAccess, withTenant } from "@/lib/db/tenantContext";
import type { AuthContext } from "@/lib/auth/types";
import { startTestDatabase, stopTestDatabase, type TestDatabase } from "./support/testDatabase";

vi.mock("@/lib/auth/current", () => ({
  currentAuthContext: vi.fn()
}));

import { currentAuthContext } from "@/lib/auth/current";
import { WITHHELD_FROM_EXPORT, exportableTables, organizationScopedTables } from "@/lib/exports/tables";
import { downloadDataExport, listDataExports, requestDataExport } from "@/lib/exports/service";

const ORGANIZATION_A = "70000000-0000-4000-8000-000000000001";
const ORGANIZATION_B = "70000000-0000-4000-8000-000000000002";
const USER_A = "70000000-0000-4000-8000-000000000011";
const USER_B = "70000000-0000-4000-8000-000000000012";

const AUTH_CONTEXT_A: AuthContext = {
  sessionId: "70000000-0000-4000-8000-000000000021",
  userId: USER_A,
  organizationId: ORGANIZATION_A,
  organizationName: "Harbour Consulting",
  email: "hana@example.com",
  displayName: "Hana Ortiz",
  role: "Owner",
  expiresAt: "2099-01-01T00:00:00.000Z"
};

const AUTH_CONTEXT_B: AuthContext = { ...AUTH_CONTEXT_A, sessionId: "70000000-0000-4000-8000-000000000022", userId: USER_B, organizationId: ORGANIZATION_B, organizationName: "Kestrel Works", email: "kai@example.com", displayName: "Kai Lindqvist" };

function actingAs(context: AuthContext) {
  vi.mocked(currentAuthContext).mockResolvedValue(context);
}

async function exportedPayload(exportId: string) {
  const download = await downloadDataExport(exportId);

  return JSON.parse(Buffer.from(await new Response(download!.stream).arrayBuffer()).toString()) as {
    manifest: { organizationId: string; withheldTables: string[]; tableCount: number; rowCount: number };
    members: Array<Record<string, unknown>>;
    tables: Record<string, Array<Record<string, unknown>>>;
  };
}

let database: TestDatabase;

beforeAll(async () => {
  database = await startTestDatabase();

  await withSystemAccess("diagnostics", async () => {
    await query(
      "INSERT INTO organizations (id, name, slug) VALUES ($1,$2,$3), ($4,$5,$6)",
      [ORGANIZATION_A, "Harbour Consulting", "harbour-consulting", ORGANIZATION_B, "Kestrel Works", "kestrel-works"]
    );
    await query(
      "INSERT INTO users (id, email, normalized_email, display_name) VALUES ($1,$2,$3,$4), ($5,$6,$7,$8)",
      [USER_A, "hana@example.com", "hana@example.com", "Hana Ortiz",
       USER_B, "kai@example.com", "kai@example.com", "Kai Lindqvist"]
    );
    await query(
      "INSERT INTO organization_memberships (organization_id, user_id, role) VALUES ($1,$2,'Owner'), ($3,$4,'Owner')",
      [ORGANIZATION_A, USER_A, ORGANIZATION_B, USER_B]
    );

    for (const [organizationId, marker] of [
      [ORGANIZATION_A, "Harbour Client"],
      [ORGANIZATION_B, "Kestrel Client"]
    ]) {
      await query(
        "INSERT INTO companies (id, organization_id, name) VALUES ($1,$2,$3)",
        [randomUUID(), organizationId, marker]
      );
      await query(
        "INSERT INTO communication_connections (id, organization_id, provider, name, status) VALUES ($1,$2,'Slack',$3,'Connected')",
        [randomUUID(), organizationId, `${marker} Slack`]
      );
    }

    const connections = await query<{ id: string; organization_id: string }>(
      "SELECT id, organization_id FROM communication_connections"
    );

    for (const connection of connections.rows) {
      await query(
        `INSERT INTO encrypted_secrets (id, organization_id, connection_id, name, ciphertext, initialization_vector, auth_tag)
         VALUES ($1,$2,$3,'access_token','ciphertext-that-must-never-be-exported','iv-value','auth-tag-value')`,
        [randomUUID(), connection.organization_id, connection.id]
      );
    }
  });
});

afterAll(async () => {
  await stopTestDatabase(database);
});

describe("a firm can take its own records with it", () => {
  it("carries every organization-scoped table that is not deliberately withheld", async () => {
    actingAs(AUTH_CONTEXT_A);

    const created = await requestDataExport();
    const payload = await exportedPayload(created.id);
    const expected = (await withTenant(ORGANIZATION_A, organizationScopedTables))
      .filter((table) => !WITHHELD_FROM_EXPORT.has(table));

    expect(Object.keys(payload.tables).sort()).toEqual(expected.sort());
    expect(payload.manifest.withheldTables.sort()).toEqual([...WITHHELD_FROM_EXPORT.keys()].sort());
  });

  it("carries the acting organization's rows and none of another firm's", async () => {
    actingAs(AUTH_CONTEXT_A);

    const created = await requestDataExport();
    const payload = await exportedPayload(created.id);
    const serialized = JSON.stringify(payload);

    expect(payload.tables.companies.map((row) => row.name)).toEqual(["Harbour Client"]);
    expect(serialized).toContain("Harbour Client");
    expect(serialized).not.toContain("Kestrel Client");
    expect(serialized).not.toContain(ORGANIZATION_B);
  });

  it("names the firm's own people, who no organization-scoped table records", async () => {
    actingAs(AUTH_CONTEXT_A);

    const created = await requestDataExport();
    const payload = await exportedPayload(created.id);

    expect(payload.members.map((member) => member.email)).toEqual(["hana@example.com"]);
    expect(payload.members[0].display_name).toBe("Hana Ortiz");
    expect(payload.members[0].role).toBe("Owner");
  });

  it("carries no credential material a downloaded copy would turn into a key", async () => {
    actingAs(AUTH_CONTEXT_A);

    const created = await requestDataExport();
    const serialized = JSON.stringify(await exportedPayload(created.id));

    expect(serialized).not.toContain("ciphertext-that-must-never-be-exported");
    expect(serialized).not.toContain("session-token-hash-that-must-never-be-exported");
    expect(serialized).not.toContain("not-a-real-hash");
  });

  it("refuses to hand one firm another firm's export", async () => {
    actingAs(AUTH_CONTEXT_A);

    const created = await requestDataExport();

    actingAs(AUTH_CONTEXT_B);

    expect(await downloadDataExport(created.id)).toBeNull();
    expect((await listDataExports()).map((row) => row.id)).not.toContain(created.id);
  });

  it("refuses an export whose download window has closed", async () => {
    actingAs(AUTH_CONTEXT_A);

    const created = await requestDataExport();

    await withTenant(ORGANIZATION_A, () => query(
      "UPDATE data_exports SET expires_at = now() - interval '1 minute' WHERE id = $1",
      [created.id]
    ));

    expect(await downloadDataExport(created.id)).toBeNull();
  });

  it("records what it withheld rather than withholding it silently", async () => {
    actingAs(AUTH_CONTEXT_A);

    const created = await requestDataExport();
    const listed = (await listDataExports()).find((row) => row.id === created.id);

    expect(listed?.status).toBe("Succeeded");
    expect(listed?.withheldTables.sort()).toEqual([...WITHHELD_FROM_EXPORT.keys()].sort());
  });
});

const REVIEWED_AS_HARMLESS = new Map<string, string>([
  ["backup_records.includes_encrypted_secrets", "a boolean recording whether a backup covered that table, holding no secret itself"]
]);

describe("the withheld list", () => {
  it("names tables that still exist, so it cannot rot into a list of nothing", async () => {
    const present = await withTenant(ORGANIZATION_A, organizationScopedTables);

    expect([...WITHHELD_FROM_EXPORT.keys()].filter((table) => !present.includes(table))).toEqual([]);
  });

  /**
   * A table added later joins the export automatically, which is the point. If
   * it holds something a firm should not be handed, this is where that has to
   * be decided rather than discovered in a downloaded file.
   */
  /**
   * The withheld list is decided per table, but the export selects every column
   * a table has. A credential added to a table that is already exported would
   * therefore leave in the next download without anything being decided about
   * it, which the per-table review cannot see.
   *
   * A name that reads like a credential and is not one belongs below, with the
   * reason, so that clearing it stays a decision somebody made rather than a
   * pattern somebody loosened.
   */
  it("carries no column whose name says it holds credential material", async () => {
    const exportable = await withTenant(ORGANIZATION_A, exportableTables);
    const columns = await withTenant(ORGANIZATION_A, () =>
      query<{ table_name: string; column_name: string }>(
        `SELECT table_name, column_name
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
        [exportable]
      )
    );
    const credentialish = /token|secret|password|ciphertext|cipher|credential|private_key|auth_tag|verifier|signature/i;
    const offending = columns.rows
      .filter((row) => credentialish.test(row.column_name))
      .map((row) => `${row.table_name}.${row.column_name}`)
      .filter((column) => !REVIEWED_AS_HARMLESS.has(column));

    expect(offending).toEqual([]);
  });

  it("accounts for every organization-scoped table, so a new one cannot arrive unreviewed", async () => {
    const present = await withTenant(ORGANIZATION_A, organizationScopedTables);

    expect(present).toHaveLength(34);
    expect([...WITHHELD_FROM_EXPORT.keys()].sort())
      .toEqual(["encrypted_secrets", "oauth_authorization_requests"]);
  });
});
