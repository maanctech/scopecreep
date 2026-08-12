import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { query } from "@/lib/db/client";
import { withSystemAccess } from "@/lib/db/tenantContext";
import type { AuthContext } from "@/lib/auth/types";
import { startTestDatabase, stopTestDatabase, type TestDatabase } from "./support/testDatabase";

/**
 * Every read path used to load nine whole tables and join them in JavaScript.
 * Replacing that is a rewrite of every page's data, so these pin what the old
 * implementation returned before it was touched: they were written against it,
 * watched pass, and only then was anything changed. A difference in what a page
 * receives shows up here rather than in front of a customer.
 */
vi.mock("@/lib/auth/current", () => ({
  currentAuthContext: vi.fn()
}));

import { currentAuthContext } from "@/lib/auth/current";
import {
  getAppDashboard,
  getBillingEvents,
  getFindingDetail,
  getFindings,
  getProjectDetail,
  getProjectFindingEvents
} from "@/lib/store/postgres/dashboard";
import {
  exportFindingsCsv,
  getBusinessDashboard,
  getSalesTemplates,
  readAuditReport
} from "@/lib/store/postgres/reports";

const ORGANIZATION = "90000000-0000-4000-8000-000000000001";
const OTHER_ORGANIZATION = "90000000-0000-4000-8000-000000000002";
const USER = "90000000-0000-4000-8000-000000000011";
const OTHER_USER = "90000000-0000-4000-8000-000000000012";

const AUTH: AuthContext = {
  sessionId: "90000000-0000-4000-8000-000000000021",
  userId: USER,
  organizationId: ORGANIZATION,
  organizationName: "Meridian Partners",
  email: "mara@example.com",
  displayName: "Mara Iqbal",
  role: "Owner",
  isSystemAdmin: false,
  expiresAt: "2099-01-01T00:00:00.000Z"
};

const OTHER_AUTH: AuthContext = { ...AUTH, sessionId: "90000000-0000-4000-8000-000000000022", userId: OTHER_USER, organizationId: OTHER_ORGANIZATION, organizationName: "Rival Group", email: "rival@example.com", displayName: "Rival Owner" };

const ALPHA_PROJECT = "90000000-0000-4000-8000-0000000000a1";
const BETA_PROJECT = "90000000-0000-4000-8000-0000000000a2";
const RIVAL_PROJECT = "90000000-0000-4000-8000-0000000000a3";
const OUT_OF_SCOPE_FINDING = "90000000-0000-4000-8000-0000000000b1";
const IN_SCOPE_FINDING = "90000000-0000-4000-8000-0000000000b2";
const REVIEW_FINDING = "90000000-0000-4000-8000-0000000000b3";

let database: TestDatabase;

async function seedProject(input: { organizationId: string; projectId: string; clientName: string; projectName: string }) {
  await query(
    `INSERT INTO projects (id,organization_id,client_name,project_name,hourly_rate_cents,legacy_sow_text)
     VALUES ($1,$2,$3,$4,20000,'Five pages of design and one revision round.')`,
    [input.projectId, input.organizationId, input.clientName, input.projectName]
  );
}

async function seedFinding(input: {
  organizationId: string;
  projectId: string;
  findingId: string;
  text: string;
  classification: string;
  revenueCents: number;
  decision: string;
}) {
  const messageId = randomUUID();

  await query(
    "INSERT INTO client_messages (id,organization_id,project_id,source,sender,message_text) VALUES ($1,$2,$3,'Manual','client@example.com',$4)",
    [messageId, input.organizationId, input.projectId, input.text]
  );
  await query(
    `INSERT INTO scope_findings
     (id,organization_id,project_id,client_message_id,classification,confidence_score,reasoning,request_type,
      estimated_hours,estimated_revenue_cents,suggested_change_order,billing_decision,workflow_status,
      client_facing_explanation,internal_note)
     VALUES ($1,$2,$3,$4,$5,0.88,'Model reasoning.','Engineering',4,$6,'Change order text.',$7,'Needs Review','Explanation.','Note.')`,
    [input.findingId, input.organizationId, input.projectId, messageId, input.classification, input.revenueCents, input.decision]
  );
  await query(
    `INSERT INTO billing_events (id,organization_id,project_id,scope_finding_id,event_type,new_status,actor_label)
     VALUES ($1,$2,$3,$4,'Finding Created','Pending Review','AI Analysis')`,
    [randomUUID(), input.organizationId, input.projectId, input.findingId]
  );
}

beforeAll(async () => {
  database = await startTestDatabase();
  vi.mocked(currentAuthContext).mockResolvedValue(AUTH);

  await withSystemAccess(async () => {
    await query(
      "INSERT INTO organizations (id,name,slug) VALUES ($1,$2,$3), ($4,$5,$6)",
      [ORGANIZATION, "Meridian Partners", "meridian-partners", OTHER_ORGANIZATION, "Rival Group", "rival-group"]
    );
    await query(
      "INSERT INTO users (id,email,normalized_email,password_hash,display_name) VALUES ($1,$2,$3,$4,$5), ($6,$7,$8,$9,$10)",
      [USER, "mara@example.com", "mara@example.com", "not-a-real-hash", "Mara Iqbal",
       OTHER_USER, "rival@example.com", "rival@example.com", "not-a-real-hash", "Rival Owner"]
    );
    await query(
      "INSERT INTO organization_memberships (organization_id,user_id,role) VALUES ($1,$2,'Owner'), ($3,$4,'Owner')",
      [ORGANIZATION, USER, OTHER_ORGANIZATION, OTHER_USER]
    );

    await seedProject({ organizationId: ORGANIZATION, projectId: ALPHA_PROJECT, clientName: "Northwind", projectName: "Alpha Rebuild" });
    await seedProject({ organizationId: ORGANIZATION, projectId: BETA_PROJECT, clientName: "Northwind", projectName: "Beta Retainer" });
    await seedProject({ organizationId: OTHER_ORGANIZATION, projectId: RIVAL_PROJECT, clientName: "Rival Client", projectName: "Rival Project" });

    await seedFinding({ organizationId: ORGANIZATION, projectId: ALPHA_PROJECT, findingId: OUT_OF_SCOPE_FINDING, text: "Please also add a booking calendar.", classification: "Out of Scope", revenueCents: 120000, decision: "Undecided" });
    await seedFinding({ organizationId: ORGANIZATION, projectId: ALPHA_PROJECT, findingId: IN_SCOPE_FINDING, text: "Can you change the header colour?", classification: "In Scope", revenueCents: 0, decision: "Undecided" });
    await seedFinding({ organizationId: ORGANIZATION, projectId: BETA_PROJECT, findingId: REVIEW_FINDING, text: "We need a second language.", classification: "Needs Human Review", revenueCents: 60000, decision: "Undecided" });
    await seedFinding({ organizationId: OTHER_ORGANIZATION, projectId: RIVAL_PROJECT, findingId: randomUUID(), text: "Rival client request.", classification: "Out of Scope", revenueCents: 999900, decision: "Undecided" });

    await query(
      "INSERT INTO sales_templates (id,organization_id,template_type,title,body) VALUES ($1,$2,'Outreach','Follow up','Body text.')",
      [randomUUID(), ORGANIZATION]
    );
  });
});

afterAll(async () => {
  await stopTestDatabase(database);
});

describe("the application dashboard", () => {
  it("summarises each project by what its findings say", async () => {
    const dashboard = await getAppDashboard();
    const alpha = dashboard.projects.find((project) => project.id === ALPHA_PROJECT);
    const beta = dashboard.projects.find((project) => project.id === BETA_PROJECT);

    expect(dashboard.projects).toHaveLength(2);
    expect(alpha?.messages_analyzed).toBe(2);
    expect(alpha?.out_of_scope_count).toBe(1);
    expect(alpha?.potential_recovered_revenue).toBe(1200);
    expect(beta?.messages_analyzed).toBe(1);
    expect(beta?.out_of_scope_count).toBe(0);
    expect(beta?.potential_recovered_revenue).toBe(600);
  });

  it("ranks the findings needing a decision by what they are worth", async () => {
    const dashboard = await getAppDashboard();

    expect(dashboard.attention.map((row) => row.finding.id)).toEqual([OUT_OF_SCOPE_FINDING, REVIEW_FINDING]);
    expect(dashboard.attention[0].message?.message_text).toBe("Please also add a booking calendar.");
    expect(dashboard.attention[0].project?.project_name).toBe("Alpha Rebuild");
  });

  it("totals revenue by project and by client", async () => {
    const dashboard = await getAppDashboard();

    expect(dashboard.revenueByProject.map((row) => row.project.id)).toEqual([ALPHA_PROJECT, BETA_PROJECT]);
    expect(dashboard.revenueByProject[0].totals.potential_dollars).toBe(1200);
    expect(dashboard.revenueByClient).toHaveLength(1);
    expect(dashboard.revenueByClient[0].client_name).toBe("Northwind");
    expect(dashboard.revenueByClient[0].totals.potential_dollars).toBe(1800);
  });

  it("reports the most recent events newest first", async () => {
    const dashboard = await getAppDashboard();

    expect(dashboard.recentEvents).toHaveLength(3);
    expect(dashboard.recentEvents.every((row) => row.event.event_type === "Finding Created")).toBe(true);
    expect(dashboard.recentEvents[0].project?.id).toBeTruthy();
  });

  it("separates demonstration figures from real ones", async () => {
    const dashboard = await getAppDashboard();

    expect(dashboard.hasRealFindings).toBe(true);
    expect(dashboard.hasDemoFindings).toBe(false);
    expect(dashboard.realTotals.potential_dollars).toBe(1800);
  });
});

describe("the findings list", () => {
  it("carries each finding with the message and project it belongs to", async () => {
    const findings = await getFindings();
    const outOfScope = findings.find((row) => row.finding.id === OUT_OF_SCOPE_FINDING);

    expect(findings).toHaveLength(3);
    expect(outOfScope?.message?.message_text).toBe("Please also add a booking calendar.");
    expect(outOfScope?.project?.project_name).toBe("Alpha Rebuild");
    expect(findings.map((row) => row.finding.project_id)).not.toContain(RIVAL_PROJECT);
  });

  it("returns one finding with its own billing history", async () => {
    const detail = await getFindingDetail(OUT_OF_SCOPE_FINDING);

    expect(detail?.finding.classification).toBe("Out of Scope");
    expect(detail?.message?.message_text).toBe("Please also add a booking calendar.");
    expect(detail?.project?.id).toBe(ALPHA_PROJECT);
    expect(detail?.events.map((event) => event.event_type)).toEqual(["Finding Created"]);
  });

  it("reports another organization's finding as absent", async () => {
    expect(await getFindingDetail("90000000-0000-4000-8000-0000000000ff")).toBeNull();
  });
});

describe("the billing events list", () => {
  it("carries each event with the finding and project it refers to", async () => {
    const events = await getBillingEvents();
    const forOutOfScope = events.find((row) => row.event.scope_finding_id === OUT_OF_SCOPE_FINDING);

    expect(events).toHaveLength(3);
    expect(forOutOfScope?.finding?.id).toBe(OUT_OF_SCOPE_FINDING);
    expect(forOutOfScope?.project?.project_name).toBe("Alpha Rebuild");
  });
});

describe("one project's own page", () => {
  it("carries the project with every message and the finding on each", async () => {
    const detail = await getProjectDetail(ALPHA_PROJECT);

    expect(detail?.project.project_name).toBe("Alpha Rebuild");
    expect(detail?.project.sow_text).toContain("Five pages of design");
    expect(detail?.messages).toHaveLength(2);
    expect(detail?.messages.every((row) => row.finding)).toBe(true);
    expect(detail?.messages.map((row) => row.message.project_id)).toEqual([ALPHA_PROJECT, ALPHA_PROJECT]);
  });

  it("reports another organization's project as absent", async () => {
    expect(await getProjectDetail(RIVAL_PROJECT)).toBeNull();
  });

  it("carries each finding's own history without reading the whole organization's", async () => {
    const byFinding = await getProjectFindingEvents(ALPHA_PROJECT);

    expect([...byFinding.keys()].sort()).toEqual([IN_SCOPE_FINDING, OUT_OF_SCOPE_FINDING].sort());
    expect(byFinding.get(OUT_OF_SCOPE_FINDING)?.map((event) => event.event_type)).toEqual(["Finding Created"]);
    expect(byFinding.has(REVIEW_FINDING)).toBe(false);
  });

  it("exports that project's findings and no other project's", async () => {
    const csv = await exportFindingsCsv(ALPHA_PROJECT);

    expect(csv).toContain("Please also add a booking calendar.");
    expect(csv).not.toContain("We need a second language.");
  });

  it("reads the audit report for a project that has none yet", async () => {
    const audit = await readAuditReport(ALPHA_PROJECT);

    expect(audit?.project.id).toBe(ALPHA_PROJECT);
    expect(audit?.report).toBeNull();
    expect(audit?.messages).toHaveLength(2);
  });
});

describe("the business dashboard", () => {
  it("totals the organization's projects and leakage", async () => {
    const business = await getBusinessDashboard();

    expect(business.totals.projects).toBe(2);
    expect(business.totals.potential_recovered_revenue).toBe(1800);
    expect(business.totals.out_of_scope_count).toBe(1);
    expect(business.leads).toEqual([]);
    expect(business.auditRequests).toEqual([]);
  });
});

describe("sales templates", () => {
  it("returns the organization's own templates", async () => {
    const templates = await getSalesTemplates();

    expect(templates.map((template) => template.title)).toEqual(["Follow up"]);
  });

  it("returns nothing for an organization that has none", async () => {
    vi.mocked(currentAuthContext).mockResolvedValue(OTHER_AUTH);

    expect(await getSalesTemplates()).toEqual([]);

    vi.mocked(currentAuthContext).mockResolvedValue(AUTH);
  });
});
