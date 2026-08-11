import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { query } from "@/lib/db/client";
import { withSystemAccess } from "@/lib/db/tenantContext";
import { VersionConflictError } from "@/lib/storeErrors";
import type { AuthContext } from "@/lib/auth/types";
import { startTestDatabase, stopTestDatabase, type TestDatabase } from "./support/testDatabase";

/**
 * The postgres store is imported directly rather than through the facade
 * (`@/lib/store`). The facade defaults to the JSON store under Vitest, and
 * while `SCOPELEDGER_STORAGE=postgres` now overrides that, resolving a session
 * still depends on `next/headers` `cookies()`, which only resolves inside a
 * real request scope — so the auth dependency has to be mocked either way.
 * Everything downstream of it is real: the store opens its own tenant scope
 * from whatever session this returns, exactly as it does in a request.
 */
vi.mock("@/lib/auth/current", () => ({
  currentAuthContext: vi.fn()
}));

import { currentAuthContext } from "@/lib/auth/current";
import {
  createLead,
  createProject,
  getAppDashboard,
  getBillingEvents,
  getProjectDetail,
  performFindingAction,
  saveMessageWithFinding
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

let database: TestDatabase;

beforeAll(async () => {
  database = await startTestDatabase();

  await withSystemAccess(async () => {
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
});

afterAll(async () => {
  await stopTestDatabase(database);
});

describe("PostgreSQL store", () => {
  let projectAId: string;
  let findingId: string;

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

    const persisted = await withSystemAccess(() => query<{ organization_id: string; company: string }>(
      "SELECT organization_id, company FROM leads WHERE id = $1",
      [lead.id]
    ));

    expect(persisted.rows[0]).toEqual({ organization_id: ORGANIZATION_A, company: "Northwind Devshop" });
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
      note: "Confirmed the add-on scope with the client."
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

    expect(dashboardA.projects.map((entry) => entry.id)).toEqual([projectAId]);
  });
});
