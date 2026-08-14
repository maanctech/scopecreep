import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { query } from "@/lib/db/client";
import { withSystemAccess } from "@/lib/db/tenantContext";
import type { AuthContext } from "@/lib/auth/types";
import { startTestDatabase, stopTestDatabase, type TestDatabase } from "./support/testDatabase";

vi.mock("@/lib/auth/current", () => ({
  currentAuthContext: vi.fn()
}));

import { currentAuthContext } from "@/lib/auth/current";
import { listBillingEvents, listFindings } from "@/lib/store/postgres/dashboard";

const ORGANIZATION = "a0000000-0000-4000-8000-000000000001";
const OTHER_ORGANIZATION = "a0000000-0000-4000-8000-000000000002";
const USER = "a0000000-0000-4000-8000-000000000011";
const NORTHWIND = "a0000000-0000-4000-8000-0000000000a1";
const CONTOSO = "a0000000-0000-4000-8000-0000000000a2";
const RIVAL_PROJECT = "a0000000-0000-4000-8000-0000000000a3";
const SAME_INSTANT = "a0000000-0000-4000-8000-0000000000a4";

const AUTH: AuthContext = {
  sessionId: "a0000000-0000-4000-8000-000000000021",
  userId: USER,
  organizationId: ORGANIZATION,
  organizationName: "Meridian Partners",
  email: "mara@example.com",
  displayName: "Mara Iqbal",
  role: "Owner",
  expiresAt: "2099-01-01T00:00:00.000Z"
};

let database: TestDatabase;

/**
 * Twelve findings across two projects, each one day apart so the order a page
 * boundary has to preserve is unambiguous, plus two recorded at the same instant
 * for the tie a cursor still has to break. The rival organization holds one of
 * its own, which no page may ever reach.
 */
async function seedFinding(input: { organizationId: string; projectId: string; dayOffset: number; at?: string; classification: string; decision: string }) {
  const messageId = randomUUID();
  const findingId = randomUUID();
  const day = String(input.dayOffset).padStart(2, "0");
  const createdAt = input.at ?? `2026-07-${day}T00:00:00Z`;

  await query(
    "INSERT INTO client_messages (id,organization_id,project_id,source,sender,message_text,created_at) VALUES ($1,$2,$3,'Manual','client@example.com',$4,$5)",
    [messageId, input.organizationId, input.projectId, `Request from day ${day}`, createdAt]
  );
  await query(
    `INSERT INTO scope_findings
     (id,organization_id,project_id,client_message_id,classification,confidence_score,reasoning,request_type,
      estimated_hours,estimated_revenue_cents,suggested_change_order,billing_decision,workflow_status,
      client_facing_explanation,internal_note,created_at)
     VALUES ($1,$2,$3,$4,$5,0.9,'Reasoning.','Engineering',4,100000,'Change order.',$6,'Needs Review','Explanation.','Note.',$7)`,
    [findingId, input.organizationId, input.projectId, messageId, input.classification, input.decision, createdAt]
  );
  await query(
    `INSERT INTO billing_events (id,organization_id,project_id,scope_finding_id,event_type,new_status,actor_label,created_at)
     VALUES ($1,$2,$3,$4,'Finding Created','Pending Review','AI Analysis',$5)`,
    [randomUUID(), input.organizationId, input.projectId, findingId, createdAt]
  );

  return findingId;
}

beforeAll(async () => {
  database = await startTestDatabase();
  vi.mocked(currentAuthContext).mockResolvedValue(AUTH);

  await withSystemAccess("diagnostics", async () => {
    await query(
      "INSERT INTO organizations (id,name,slug) VALUES ($1,$2,$3), ($4,$5,$6)",
      [ORGANIZATION, "Meridian Partners", "meridian-partners", OTHER_ORGANIZATION, "Rival Group", "rival-group"]
    );
    await query(
      "INSERT INTO users (id,email,normalized_email,display_name) VALUES ($1,$2,$3,$4)",
      [USER, "mara@example.com", "mara@example.com", "Mara Iqbal"]
    );
    await query("INSERT INTO organization_memberships (organization_id,user_id,role) VALUES ($1,$2,'Owner')", [ORGANIZATION, USER]);

    for (const [projectId, organizationId, clientName, projectName] of [
      [NORTHWIND, ORGANIZATION, "Northwind", "Alpha Rebuild"],
      [CONTOSO, ORGANIZATION, "Contoso", "Beta Retainer"],
      [RIVAL_PROJECT, OTHER_ORGANIZATION, "Rival Client", "Rival Project"],
      [SAME_INSTANT, ORGANIZATION, "Fabrikam", "Same Instant"]
    ]) {
      await query(
        "INSERT INTO projects (id,organization_id,client_name,project_name,hourly_rate_cents,legacy_sow_text) VALUES ($1,$2,$3,$4,20000,'Scope text.')",
        [projectId, organizationId, clientName, projectName]
      );
    }

    for (let day = 1; day <= 8; day += 1) {
      await seedFinding({ organizationId: ORGANIZATION, projectId: NORTHWIND, dayOffset: day, classification: "Out of Scope", decision: "Undecided" });
    }

    for (let day = 9; day <= 12; day += 1) {
      await seedFinding({ organizationId: ORGANIZATION, projectId: CONTOSO, dayOffset: day, classification: "In Scope", decision: "Bill Separately" });
    }

    await seedFinding({ organizationId: OTHER_ORGANIZATION, projectId: RIVAL_PROJECT, dayOffset: 20, classification: "Out of Scope", decision: "Undecided" });

    for (let twin = 0; twin < 2; twin += 1) {
      await seedFinding({
        organizationId: ORGANIZATION, projectId: SAME_INSTANT, dayOffset: 0, at: "2026-06-30T00:00:00Z",
        classification: "Out of Scope", decision: "Undecided"
      });
    }
  });
});

afterAll(async () => {
  await stopTestDatabase(database);
});

describe("paging through findings", () => {
  it("returns a bounded page newest first with a cursor for the next one", async () => {
    const page = await listFindings({}, { limit: 5 });

    expect(page.rows).toHaveLength(5);
    expect(page.rows.map((row) => row.message?.message_text)).toEqual([
      "Request from day 12", "Request from day 11", "Request from day 10", "Request from day 09", "Request from day 08"
    ]);
    expect(page.nextCursor).toBeTruthy();
  });

  it("continues from the cursor without repeating or skipping a row", async () => {
    const first = await listFindings({}, { limit: 5 });
    const second = await listFindings({}, { limit: 5, cursor: first.nextCursor! });
    const third = await listFindings({}, { limit: 5, cursor: second.nextCursor! });

    expect(second.rows.map((row) => row.message?.message_text)).toEqual([
      "Request from day 07", "Request from day 06", "Request from day 05", "Request from day 04", "Request from day 03"
    ]);
    expect(third.rows.map((row) => row.message?.message_text)).toEqual([
      "Request from day 02", "Request from day 01", "Request from day 00", "Request from day 00"
    ]);
    expect(third.nextCursor).toBeNull();

    const seen = [...first.rows, ...second.rows, ...third.rows].map((row) => row.finding.id);

    expect(new Set(seen).size).toBe(14);
  });

  it("filters by client without loading the findings it filters out", async () => {
    const page = await listFindings({ client: "Contoso" }, { limit: 50 });

    expect(page.rows).toHaveLength(4);
    expect(page.rows.every((row) => row.project?.client_name === "Contoso")).toBe(true);
  });

  it("filters by project, classification, and decision together", async () => {
    const page = await listFindings(
      { project: NORTHWIND, classification: "Out of Scope", decision: "Undecided" },
      { limit: 50 }
    );

    expect(page.rows).toHaveLength(8);
    expect(page.rows.every((row) => row.finding.classification === "Out of Scope")).toBe(true);
  });

  it("filters by the dates a firm typed, inclusive at both ends", async () => {
    const page = await listFindings({ from: "2026-07-03", to: "2026-07-05" }, { limit: 50 });

    expect(page.rows.map((row) => row.message?.message_text)).toEqual([
      "Request from day 05", "Request from day 04", "Request from day 03"
    ]);
  });

  it("reaches nothing belonging to another organization", async () => {
    const page = await listFindings({}, { limit: 50 });

    expect(page.rows).toHaveLength(14);
    expect(page.rows.map((row) => row.project?.id)).not.toContain(RIVAL_PROJECT);
  });

  it("ignores a cursor that did not come from it rather than failing the page", async () => {
    const page = await listFindings({}, { limit: 5, cursor: "not-a-cursor" });

    expect(page.rows).toHaveLength(5);
    expect(page.rows[0].message?.message_text).toBe("Request from day 12");
  });

  it("does not repeat or skip two findings recorded at the same instant", async () => {
    const first = await listFindings({ project: SAME_INSTANT }, { limit: 1 });
    const second = await listFindings({ project: SAME_INSTANT }, { limit: 1, cursor: first.nextCursor! });

    expect(first.rows).toHaveLength(1);
    expect(second.rows).toHaveLength(1);
    expect(second.rows[0].finding.id).not.toBe(first.rows[0].finding.id);
    expect(second.nextCursor).toBeNull();
  });

  it("refuses to let a caller ask for an unbounded page", async () => {
    const page = await listFindings({}, { limit: 100_000 });

    expect(page.rows.length).toBeLessThanOrEqual(100);
  });
});

describe("paging through billing events", () => {
  it("returns a bounded page newest first with the finding and project each refers to", async () => {
    const page = await listBillingEvents({}, { limit: 5 });

    expect(page.rows).toHaveLength(5);
    expect(page.rows[0].project?.client_name).toBe("Contoso");
    expect(page.rows[0].finding).toBeTruthy();
    expect(page.nextCursor).toBeTruthy();
  });

  it("continues from the cursor without repeating a row", async () => {
    const first = await listBillingEvents({}, { limit: 5 });
    const second = await listBillingEvents({}, { limit: 5, cursor: first.nextCursor! });

    expect(new Set([...first.rows, ...second.rows].map((row) => row.event.id)).size).toBe(10);
  });

  it("filters by client and event type", async () => {
    const page = await listBillingEvents({ client: "Northwind", type: "Finding Created" }, { limit: 50 });

    expect(page.rows).toHaveLength(8);
    expect(page.rows.every((row) => row.project?.client_name === "Northwind")).toBe(true);
  });

  it("reaches nothing belonging to another organization", async () => {
    const page = await listBillingEvents({}, { limit: 50 });

    expect(page.rows).toHaveLength(14);
    expect(page.rows.map((row) => row.project?.id)).not.toContain(RIVAL_PROJECT);
  });
});
