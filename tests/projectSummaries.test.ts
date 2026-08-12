import { describe, expect, it } from "vitest";
import { summariseProjects } from "@/lib/store/postgres/summaries";
import type { DashboardFinding } from "@/lib/store/postgres/loaders";
import type { Project } from "@/lib/types";

/**
 * These two rules decide every number a firm sees on both dashboards, and
 * neither is visible in a query plan. A database fixture happens to hide them:
 * one finding per message makes superseding indistinguishable from counting,
 * and an in-scope finding worth nothing makes excluding it indistinguishable
 * from including it. So they are pinned here, against explicit inputs.
 */
const PROJECT: Project = {
  id: "project-1",
  company_id: null,
  lead_id: null,
  audit_request_id: null,
  client_name: "Northwind",
  project_name: "Alpha Rebuild",
  hourly_rate: 200,
  project_value: null,
  sow_text: "Five pages of design.",
  active_sow_version_id: null,
  created_at: "2026-08-01T00:00:00.000Z",
  is_demo: false
};

function finding(overrides: Partial<DashboardFinding> & Pick<DashboardFinding, "id" | "client_message_id" | "created_at">): DashboardFinding {
  return {
    project_id: "project-1",
    classification: "Out of Scope",
    estimated_revenue: 1000,
    billing_decision: "Undecided",
    workflow_status: "Needs Review",
    approved_amount_cents: null,
    is_demo: false,
    ...overrides
  };
}

describe("summarising a project by its findings", () => {
  it("counts a message once, however many times it has been analysed", () => {
    const [summary] = summariseProjects([PROJECT], [
      finding({ id: "newer", client_message_id: "message-1", created_at: "2026-08-03T00:00:00.000Z", estimated_revenue: 300 }),
      finding({ id: "older", client_message_id: "message-1", created_at: "2026-08-02T00:00:00.000Z", estimated_revenue: 1200 })
    ]);

    expect(summary.messages_analyzed).toBe(1);
    expect(summary.out_of_scope_count).toBe(1);
    expect(summary.potential_recovered_revenue).toBe(300);
  });

  it("reports what a re-analysis now says, not what it used to say", () => {
    const [summary] = summariseProjects([PROJECT], [
      finding({ id: "newer", client_message_id: "message-1", created_at: "2026-08-03T00:00:00.000Z", classification: "In Scope", estimated_revenue: 0 }),
      finding({ id: "older", client_message_id: "message-1", created_at: "2026-08-02T00:00:00.000Z", classification: "Out of Scope", estimated_revenue: 1200 })
    ]);

    expect(summary.out_of_scope_count).toBe(0);
    expect(summary.potential_recovered_revenue).toBe(0);
  });

  it("leaves work that was always in scope out of recoverable revenue", () => {
    const [summary] = summariseProjects([PROJECT], [
      finding({ id: "in-scope", client_message_id: "message-1", created_at: "2026-08-02T00:00:00.000Z", classification: "In Scope", estimated_revenue: 500 }),
      finding({ id: "out-of-scope", client_message_id: "message-2", created_at: "2026-08-02T00:00:00.000Z", classification: "Out of Scope", estimated_revenue: 1200 })
    ]);

    expect(summary.messages_analyzed).toBe(2);
    expect(summary.out_of_scope_count).toBe(1);
    expect(summary.potential_recovered_revenue).toBe(1200);
  });

  it("counts a review that could not decide as recoverable, because it is not yet in scope", () => {
    const [summary] = summariseProjects([PROJECT], [
      finding({ id: "review", client_message_id: "message-1", created_at: "2026-08-02T00:00:00.000Z", classification: "Needs Human Review", estimated_revenue: 600 })
    ]);

    expect(summary.out_of_scope_count).toBe(0);
    expect(summary.potential_recovered_revenue).toBe(600);
  });

  it("reports a project with no findings at all rather than omitting it", () => {
    const [summary] = summariseProjects([PROJECT], []);

    expect(summary.messages_analyzed).toBe(0);
    expect(summary.out_of_scope_count).toBe(0);
    expect(summary.potential_recovered_revenue).toBe(0);
    expect(summary.project_name).toBe("Alpha Rebuild");
  });

  it("attributes each finding to the project it belongs to", () => {
    const other: Project = { ...PROJECT, id: "project-2", project_name: "Beta Retainer" };
    const summaries = summariseProjects([PROJECT, other], [
      finding({ id: "alpha", client_message_id: "message-1", created_at: "2026-08-02T00:00:00.000Z", estimated_revenue: 1200 }),
      finding({ id: "beta", client_message_id: "message-2", created_at: "2026-08-02T00:00:00.000Z", project_id: "project-2", estimated_revenue: 600 })
    ]);

    expect(summaries.map((summary) => summary.potential_recovered_revenue)).toEqual([1200, 600]);
  });
});
