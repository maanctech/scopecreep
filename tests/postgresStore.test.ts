import { promises as fs } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { query, resetPoolForTesting, setPoolForTesting } from "@/lib/db/client";
import { VersionConflictError } from "@/lib/storeErrors";
import type { AuthContext } from "@/lib/auth/types";
import { getSowWorkspace, saveBoundaryMap } from "@/lib/sow/service";

/**
 * The postgres store is imported directly rather than through the facade
 * (`@/lib/store`). The facade defaults to the JSON store under Vitest, and
 * while `SCOPELEDGER_STORAGE=postgres` now overrides that, `requireContext()`
 * still depends on `next/headers` `cookies()`, which only resolves inside a
 * real request scope — so the auth dependency has to be mocked either way.
 */
vi.mock("@/lib/auth/current", () => ({
  currentAuthContext: vi.fn()
}));

import { currentAuthContext } from "@/lib/auth/current";
import {
  createAuditRequest,
  createLead,
  createProject,
  generateAuditReport,
  getAppDashboard,
  getBillingEvents,
  getProjectDetail,
  getPublicIntakeAvailability,
  getReportHistory,
  getReportVersion,
  performFindingAction,
  saveMessageWithFinding,
  setPublicIntakeSetting,
} from "@/lib/store/postgres";

const ORGANIZATION_A = "40000000-0000-4000-8000-000000000001";
const ORGANIZATION_B = "40000000-0000-4000-8000-000000000002";
const USER_A = "40000000-0000-4000-8000-000000000011";
const USER_B = "40000000-0000-4000-8000-000000000012";

const AUTH_CONTEXT_A: AuthContext = {
  sessionId: "40000000-0000-4000-8000-000000000021",
  userId: USER_A,
  organizationId: ORGANIZATION_A,
  organizationName: "Aperture Consulting",
  email: "alice@example.com",
  displayName: "Alice Rivera",
  role: "Owner",
  isSystemAdmin: false,
  expiresAt: "2099-01-01T00:00:00.000Z"
};

const AUTH_CONTEXT_B: AuthContext = {
  sessionId: "40000000-0000-4000-8000-000000000022",
  userId: USER_B,
  organizationId: ORGANIZATION_B,
  organizationName: "Beacon Studio",
  email: "bob@example.com",
  displayName: "Bob Chen",
  role: "Owner",
  isSystemAdmin: false,
  expiresAt: "2099-01-01T00:00:00.000Z"
};

function actingAs(context: AuthContext) {
  vi.mocked(currentAuthContext).mockResolvedValue(context);
}

/**
 * Adapts a single PGlite instance to the subset of the node-postgres `Pool`
 * API the store actually calls: `query()` for one-off statements and
 * `connect()` for `transaction()`. PGlite is single-connection, so a plain
 * `BEGIN` / `COMMIT` / `ROLLBACK` issued through `.query()` works the same
 * way it would against a real dedicated connection.
 */
function createPgliteAdapter(db: PGlite): Pool {
  const client = {
    query: async (text: string, values: unknown[] = []) => {
      const result = await db.query(text, values);

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

let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  const directory = path.join(process.cwd(), "db", "migrations");
  const migrations = (await fs.readdir(directory))
    .filter((name) => name.endsWith(".sql"))
    .sort();

  for (const filename of migrations) {
    await db.exec(await fs.readFile(path.join(directory, filename), "utf8"));
  }

  setPoolForTesting(createPgliteAdapter(db));

  await query(
    "INSERT INTO organizations (id, name, slug) VALUES ($1,$2,$3), ($4,$5,$6)",
    [ORGANIZATION_A, "Aperture Consulting", "aperture-consulting", ORGANIZATION_B, "Beacon Studio", "beacon-studio"]
  );
  await query(
    `INSERT INTO users (id, email, normalized_email, password_hash, display_name)
     VALUES ($1,$2,$3,$4,$5), ($6,$7,$8,$9,$10)`,
    [USER_A, "alice@example.com", "alice@example.com", "not-a-real-hash", "Alice Rivera",
     USER_B, "bob@example.com", "bob@example.com", "not-a-real-hash", "Bob Chen"]
  );
  await query(
    "INSERT INTO organization_settings (organization_id, settings) VALUES ($1, $2::jsonb)",
    [ORGANIZATION_A, JSON.stringify({ publicLeadCapture: true })]
  );
});

afterAll(async () => {
  resetPoolForTesting();
  await db.close();
});

describe("PostgreSQL store", () => {
  let projectAId: string;
  let findingId: string;
  let intakeToken: string;
  let intakeLeadId: string;

  it("creates a lead scoped to the public organization", async () => {
    const lead = await createLead({
      name: "  Priya Shah  ",
      email: "Priya@Example.com",
      company: "Northwind Devshop",
      website: "https://northwind.dev",
      business_type: "Agency",
      team_size: "6-10",
      average_project_value: 42_000,
      hourly_rate: 185,
      pain_point: "Clients keep adding scope without paying for it.",
      consent_to_contact: true
    });

    expect(lead.name).toBe("Priya Shah");
    expect(lead.email).toBe("priya@example.com");
    expect(lead.status).toBe("New");
    intakeToken = lead.intakeToken;
    intakeLeadId = lead.id;

    const persisted = await query<{ organization_id: string; company: string }>(
      "SELECT organization_id, company FROM leads WHERE id = $1",
      [lead.id]
    );

    expect(persisted.rows[0]).toEqual({ organization_id: ORGANIZATION_A, company: "Northwind Devshop" });
  });

  it("atomically turns public intake text into project messages and consumes the token", async () => {
    await expect(
      createAuditRequest({
        intake_token: intakeToken,
        client_name: "Northwind Client",
        hourly_rate: 185,
        sow_text: null as unknown as string,
        message_export_text: "This transaction must roll back.",
      }),
    ).rejects.toThrow();
    const afterFailure = await query<{ consumed_at: string | null }>(
      "SELECT consumed_at FROM audit_intake_tokens WHERE lead_id=$1",
      [intakeLeadId],
    );
    const failedAudits = await query<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM audit_requests WHERE lead_id=$1",
      [intakeLeadId],
    );

    expect(afterFailure.rows[0].consumed_at).toBeNull();
    expect(Number(failedAudits.rows[0].count)).toBe(0);

    const created = await createAuditRequest({
      intake_token: intakeToken,
      client_name: "Northwind Client",
      project_value: 50_000,
      hourly_rate: 185,
      sow_text: "The agency will redesign five marketing pages. Custom portals and integrations are excluded.",
      message_export_text: "Please update the approved homepage headline.\n---\nCan you also build a customer login portal?",
      suspected_scope_creep_notes: "The login portal appears excluded.",
    });
    const messages = await query<{ message_text: string }>(
      "SELECT message_text FROM client_messages WHERE project_id=$1 ORDER BY message_text",
      [created.project.id],
    );
    const analyses = await query<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM analysis_jobs WHERE project_id=$1",
      [created.project.id],
    );

    expect(created.importResult.inserted).toBe(2);
    expect(messages.rows).toHaveLength(2);
    expect(Number(analyses.rows[0].count)).toBe(0);
    await expect(
      createAuditRequest({
        intake_token: intakeToken,
        client_name: "Replay",
        hourly_rate: 185,
        sow_text: "This agreement text is deliberately long enough for intake validation.",
        message_export_text: "Replay should fail.",
      }),
    ).rejects.toThrow(/invalid or expired/i);
  });

  it("creates a project with its SOW and round-trips it through getProjectDetail", async () => {
    actingAs(AUTH_CONTEXT_A);

    const sowText = "1. Scope\nBuild and maintain the client portal.\n2. Exclusions\nMobile apps are out of scope.";
    const project = await createProject({
      client_name: "Northwind Devshop",
      project_name: "Portal Rebuild",
      hourly_rate: 185.5,
      project_value: 60_000,
      sow_text: sowText
    });

    projectAId = project.id;

    expect(project.hourly_rate).toBe(185.5);
    expect(project.sow_text).toBe(sowText);

    const detail = await getProjectDetail(project.id);

    expect(detail?.project.id).toBe(project.id);
    expect(detail?.project.sow_text).toBe(sowText);
    expect(detail?.messages).toEqual([]);
  });

  it("keeps the approved boundary authoritative while exposing a newer draft", async () => {
    actingAs(AUTH_CONTEXT_A);
    const sow = await query<{ active_sow_version_id: string }>(
      "SELECT active_sow_version_id FROM projects WHERE id=$1",
      [projectAId],
    );
    const activeMapId = "41000000-0000-4000-8000-000000000001";
    const draftMapId = "41000000-0000-4000-8000-000000000002";

    await query(
      `INSERT INTO scope_boundary_maps
       (id,organization_id,project_id,sow_version_id,name,status,created_by,approved_by,approved_at)
       VALUES ($1,$2,$3,$4,'Approved map','Active',$5,$5,now()),
              ($6,$2,$3,$4,'Regenerated draft','Draft',$5,NULL,NULL)`,
      [activeMapId, ORGANIZATION_A, projectAId, sow.rows[0].active_sow_version_id, USER_A, draftMapId],
    );
    await query(
      `INSERT INTO scope_boundary_items
       (id,organization_id,boundary_map_id,boundary_type,category,description,evidence,ordinal)
       VALUES ('41000000-0000-4000-8000-000000000011',$1,$2,'Included','Pages','Five pages','five marketing pages',0),
              ('41000000-0000-4000-8000-000000000012',$1,$3,'Excluded','Portal','No portal','portals are excluded',0)`,
      [ORGANIZATION_A, activeMapId, draftMapId],
    );
    await query(
      "UPDATE projects SET active_boundary_map_id=$1 WHERE id=$2 AND organization_id=$3",
      [activeMapId, projectAId, ORGANIZATION_A],
    );

    const workspace = await getSowWorkspace(projectAId);

    expect(workspace?.activeBoundaryMap?.id).toBe(activeMapId);
    expect(workspace?.draftBoundaryMap?.id).toBe(draftMapId);

    await saveBoundaryMap({
      projectId: projectAId,
      mapId: draftMapId,
      approve: true,
      items: [{
        boundaryType: "Excluded",
        category: "Portal",
        description: "No portal",
        evidence: "portals are excluded",
      }],
    });
    const approved = await getSowWorkspace(projectAId);

    expect(approved?.activeBoundaryMap?.id).toBe(draftMapId);
    expect(approved?.draftBoundaryMap).toBeNull();
    await expect(
      saveBoundaryMap({
        projectId: projectAId,
        mapId: activeMapId,
        approve: false,
        items: [{ boundaryType: "Included", category: "Unsafe", description: "Edit", evidence: "" }],
      }),
    ).rejects.toThrow(/no longer editable/i);
  });

  it("saves a message with its finding atomically", async () => {
    actingAs(AUTH_CONTEXT_A);

    const saved = await saveMessageWithFinding({
      project_id: projectAId,
      source: "Email",
      sender: "client@northwind.dev",
      message_text: "Can you also add a customer-facing SSO integration this sprint?",
      analysis: {
        classification: "Out of Scope",
        confidence_score: 0.87,
        reasoning: "SSO is explicitly excluded in section 2.",
        relevant_sow_sections: ["Mobile apps are out of scope."],
        request_type: "Engineering",
        estimated_hours: 8.5,
        estimated_revenue: 1234.56,
        suggested_change_order: "Add SSO integration as a $1,234.56 change order.",
        internal_note: null
      }
    });

    findingId = saved.finding.id;

    expect(saved.message.message_text).toBe("Can you also add a customer-facing SSO integration this sprint?");
    expect(saved.finding.classification).toBe("Out of Scope");
    expect(saved.finding.workflow_status).toBe("Needs Review");
    expect(saved.finding.billing_decision).toBe("Undecided");
    expect(saved.finding.version).toBe(1);

    const detail = await getProjectDetail(projectAId);
    const row = detail?.messages.find((entry) => entry.message.id === saved.message.id);

    expect(row?.message.sender).toBe("client@northwind.dev");
    expect(row?.finding?.id).toBe(findingId);
    expect(row?.finding?.estimated_hours).toBe(8.5);
  });

  it("performs a finding action, transitions its state, and appends a billing event with integer cents", async () => {
    actingAs(AUTH_CONTEXT_A);

    const updated = await performFindingAction({
      finding_id: findingId,
      expected_version: 1,
      action: "Mark as Billable",
      note: "Confirmed the add-on scope with the client.",
      review: { approved_hours: 8.5, approved_amount_cents: 123_456 },
    });

    expect(updated.billing_decision).toBe("Bill Separately");
    expect(updated.workflow_status).toBe("Decided");
    expect(updated.version).toBe(2);
    expect(updated.approved_amount_cents).toBe(123_456);
    expect(Number.isInteger(updated.approved_amount_cents)).toBe(true);

    const events = await getBillingEvents();
    const event = events.find((entry) => entry.event.scope_finding_id === findingId);

    expect(event).toBeDefined();
    expect(event?.event.event_type).toBe("Approved Internally");
    expect(event?.event.new_status).toBe("Decided");
    expect(event?.event.new_decision).toBe("Bill Separately");
    expect(event?.event.previous_amount_cents).toBeNull();
    expect(event?.event.new_amount_cents).toBe(123_456);
    expect(event?.event.note).toBe("Confirmed the add-on scope with the client.");
  });

  it("rejects a stale expected_version with VersionConflictError", async () => {
    actingAs(AUTH_CONTEXT_A);

    await expect(
      performFindingAction({
        finding_id: findingId,
        expected_version: 1,
        action: "Mark as Invoiced"
      })
    ).rejects.toThrow(VersionConflictError);
  });

  it("adds a second, still-undecided finding for dashboard aggregation", async () => {
    actingAs(AUTH_CONTEXT_A);

    await saveMessageWithFinding({
      project_id: projectAId,
      source: "Slack",
      sender: "client@northwind.dev",
      message_text: "Also please add a second SSO provider.",
      analysis: {
        classification: "Out of Scope",
        confidence_score: 0.7,
        reasoning: "A second provider is a new deliverable.",
        relevant_sow_sections: [],
        request_type: "Engineering",
        estimated_hours: 4,
        estimated_revenue: 500,
        suggested_change_order: "Add a second SSO provider as a change order.",
        internal_note: null
      }
    });
  });

  it("computes coherent dashboard totals over the inserted findings", async () => {
    actingAs(AUTH_CONTEXT_A);

    const dashboard = await getAppDashboard();

    expect(dashboard.hasRealFindings).toBe(true);
    expect(dashboard.hasDemoFindings).toBe(false);
    expect(dashboard.realTotals.billable_cents).toBe(123_456);
    expect(dashboard.realTotals.needs_review_count).toBe(1);
    expect(dashboard.realTotals.needs_review_dollars).toBe(500);
    expect(dashboard.realTotals.potential_dollars).toBeCloseTo(1734.56, 2);

    const project = dashboard.projects.find((entry) => entry.id === projectAId);

    expect(project?.out_of_scope_count).toBe(2);
    expect(project?.potential_recovered_revenue).toBeCloseTo(1734.56, 2);
  });

  it("keeps organizations isolated: org B never sees org A's project or totals", async () => {
    actingAs(AUTH_CONTEXT_B);

    const orgBProject = await createProject({
      client_name: "Beacon Studio Client",
      project_name: "Beacon Internal Tool",
      hourly_rate: 150,
      sow_text: "Build an internal reporting tool."
    });

    const dashboardB = await getAppDashboard();

    expect(dashboardB.projects.map((entry) => entry.id)).toEqual([orgBProject.id]);
    expect(dashboardB.realTotals.billable_cents).toBe(0);

    const crossOrgLookup = await getProjectDetail(projectAId);

    expect(crossOrgLookup).toBeNull();

    actingAs(AUTH_CONTEXT_A);

    const dashboardA = await getAppDashboard();

    expect(dashboardA.projects.map((entry) => entry.id)).toContain(projectAId);
    expect(dashboardA.projects.map((entry) => entry.id)).not.toContain(orgBProject.id);
    expect(dashboardA.projects).toHaveLength(2);
  });

  it("prevents two organizations from enabling public intake", async () => {
    actingAs(AUTH_CONTEXT_B);

    await expect(setPublicIntakeSetting(true)).rejects.toThrow(/another organization/i);
    await expect(getPublicIntakeAvailability()).resolves.toEqual({ enabled: true });
  });

  it("excludes soft-deleted messages from regenerated reports and financial summaries", async () => {
    actingAs(AUTH_CONTEXT_A);
    const project = await createProject({
      client_name: "Deletion Test Client",
      project_name: "Report deletion test",
      hourly_rate: 200,
      sow_text: "The work excludes a client billing portal.",
    });
    const saved = await saveMessageWithFinding({
      project_id: project.id,
      source: "Email",
      sender: "client@example.test",
      message_text: "CONFIDENTIAL-DELETED-REQUEST: build the billing portal.",
      analysis: {
        classification: "Out of Scope",
        confidence_score: 0.95,
        reasoning: "The portal is excluded.",
        relevant_sow_sections: ["The work excludes a client billing portal."],
        request_type: "Engineering",
        estimated_hours: 20,
        estimated_revenue: 4000,
        suggested_change_order: "We can scope this separately.",
        internal_note: "Human review required.",
      },
    });
    const before = await generateAuditReport(project.id);

    expect(before.report.markdown).toContain("CONFIDENTIAL-DELETED-REQUEST");
    await query(
      "UPDATE client_messages SET deleted_at=now() WHERE id=$1 AND organization_id=$2",
      [saved.message.id, ORGANIZATION_A],
    );
    const regenerated = await generateAuditReport(project.id);
    const dashboard = await getAppDashboard();
    const summary = dashboard.projects.find((item) => item.id === project.id);

    expect(regenerated.report.markdown).not.toContain(
      "CONFIDENTIAL-DELETED-REQUEST",
    );
    expect(regenerated.report.analyzed_messages_count).toBe(0);
    expect(regenerated.report.total_revenue_leakage).toBe(0);
    expect(summary?.messages_analyzed).toBe(0);
    expect(summary?.potential_recovered_revenue).toBe(0);
  });

  it("lists report history without bodies and fetches one selected body", async () => {
    actingAs(AUTH_CONTEXT_A);
    const history = await getReportHistory(projectAId);

    if (!history.length) await generateAuditReport(projectAId);

    const currentHistory = await getReportHistory(projectAId);
    const selected = currentHistory[0];

    expect(selected.markdown).toBe("");
    expect(selected.csv_content).toBe("");
    const body = await getReportVersion(projectAId, selected.id);

    expect(body?.markdown.length).toBeGreaterThan(0);

    actingAs(AUTH_CONTEXT_B);
    await expect(getReportHistory(projectAId)).rejects.toThrow(
      "Project not found.",
    );
    await expect(getReportVersion(projectAId, selected.id)).resolves.toBeNull();
  });
});
