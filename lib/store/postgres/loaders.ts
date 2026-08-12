import { query } from "@/lib/db/client";
import { dollars, iso, number, type DbRow } from "@/lib/store/postgres/client";
import {
  mapAuditRequest,
  mapCompany,
  mapEvent,
  mapFinding,
  mapLead,
  mapMessage,
  mapProject,
  mapReport
} from "@/lib/store/postgres/mappers";
import type { RevenueRelevantFinding } from "@/lib/domain/revenueTotals";
import type {
  AuditRequest,
  BillingEvent,
  ClientMessage,
  Company,
  Lead,
  MessageWithFinding,
  Project,
  Report,
  SalesTemplate,
  ScopeFinding
} from "@/lib/types";

/**
 * A project's SOW text comes from its active version, falling back to the text
 * pasted before versions existed. Every read of a project needs it, so the join
 * lives here once rather than in each caller.
 */
const PROJECT_SELECT = `
  SELECT p.*, COALESCE(sv.content, p.legacy_sow_text) AS sow_text
  FROM projects p
  LEFT JOIN sow_documents sd ON sd.project_id = p.id AND sd.organization_id = p.organization_id AND sd.status = 'Active'
  LEFT JOIN sow_versions sv ON sv.id = sd.current_version_id AND sv.organization_id = sd.organization_id
`;

/**
 * A finding row carries the model's reasoning, its client-facing draft and its
 * internal note. A dashboard totals money and counts classifications, so it
 * reads none of them. Loading the whole row to add up six fields is most of
 * what a page used to spend its time on.
 */
export type DashboardFinding = RevenueRelevantFinding & {
  id: string;
  project_id: string;
  client_message_id: string;
  created_at: string;
};

export async function loadProjects(organizationId: string): Promise<Project[]> {
  const rows = await query<DbRow>(
    `${PROJECT_SELECT} WHERE p.organization_id = $1 AND p.archived_at IS NULL ORDER BY p.created_at DESC`,
    [organizationId]
  );

  return rows.rows.map(mapProject);
}

export async function loadProject(organizationId: string, projectId: string): Promise<Project | null> {
  const rows = await query<DbRow>(
    `${PROJECT_SELECT} WHERE p.organization_id = $1 AND p.id = $2 AND p.archived_at IS NULL`,
    [organizationId, projectId]
  );

  return rows.rows[0] ? mapProject(rows.rows[0]) : null;
}

export async function loadProjectsByIds(organizationId: string, projectIds: string[]) {
  if (!projectIds.length) return new Map<string, Project>();

  const rows = await query<DbRow>(
    `${PROJECT_SELECT} WHERE p.organization_id = $1 AND p.id = ANY($2::uuid[])`,
    [organizationId, [...new Set(projectIds)]]
  );

  return new Map(rows.rows.map((row) => [String(row.id), mapProject(row)]));
}

export async function loadMessagesByIds(organizationId: string, messageIds: string[]) {
  if (!messageIds.length) return new Map<string, ClientMessage>();

  const rows = await query<DbRow>(
    "SELECT * FROM client_messages WHERE organization_id = $1 AND id = ANY($2::uuid[])",
    [organizationId, [...new Set(messageIds)]]
  );

  return new Map(rows.rows.map((row) => [String(row.id), mapMessage(row)]));
}

export async function loadFindingsByIds(organizationId: string, findingIds: string[]) {
  if (!findingIds.length) return new Map<string, ScopeFinding>();

  const rows = await query<DbRow>(
    "SELECT * FROM scope_findings WHERE organization_id = $1 AND id = ANY($2::uuid[])",
    [organizationId, [...new Set(findingIds)]]
  );

  return new Map(rows.rows.map((row) => [String(row.id), mapFinding(row)]));
}

export async function loadDashboardFindings(organizationId: string): Promise<DashboardFinding[]> {
  const rows = await query<DbRow>(
    `SELECT id, project_id, client_message_id, classification, estimated_revenue_cents,
            billing_decision, workflow_status, approved_amount_cents, is_demo, created_at
     FROM scope_findings WHERE organization_id = $1 ORDER BY created_at DESC`,
    [organizationId]
  );

  return rows.rows.map((row) => ({
    id: String(row.id),
    project_id: String(row.project_id),
    client_message_id: String(row.client_message_id),
    classification: row.classification as ScopeFinding["classification"],
    estimated_revenue: dollars(row.estimated_revenue_cents),
    billing_decision: row.billing_decision as ScopeFinding["billing_decision"],
    workflow_status: row.workflow_status as ScopeFinding["workflow_status"],
    approved_amount_cents: number(row.approved_amount_cents),
    is_demo: Boolean(row.is_demo),
    created_at: iso(row.created_at)
  }));
}

export async function loadProjectRows(organizationId: string, projectId: string): Promise<MessageWithFinding[]> {
  const [messages, findings] = await Promise.all([
    query<DbRow>(
      "SELECT * FROM client_messages WHERE organization_id = $1 AND project_id = $2 ORDER BY created_at DESC",
      [organizationId, projectId]
    ),
    query<DbRow>(
      "SELECT * FROM scope_findings WHERE organization_id = $1 AND project_id = $2 ORDER BY created_at DESC",
      [organizationId, projectId]
    )
  ]);
  const byMessage = new Map<string, ScopeFinding>();

  for (const row of findings.rows) {
    const finding = mapFinding(row);

    if (!byMessage.has(finding.client_message_id)) byMessage.set(finding.client_message_id, finding);
  }

  return messages.rows.map((row) => {
    const message = mapMessage(row);

    return { message, finding: byMessage.get(message.id) ?? null };
  });
}

export async function loadFindings(organizationId: string, options: { limit?: number } = {}) {
  const rows = await query<DbRow>(
    `SELECT * FROM scope_findings WHERE organization_id = $1 ORDER BY created_at DESC${options.limit ? " LIMIT $2" : ""}`,
    options.limit ? [organizationId, options.limit] : [organizationId]
  );

  return rows.rows.map(mapFinding);
}

export async function loadFindingById(organizationId: string, findingId: string) {
  const rows = await query<DbRow>(
    "SELECT * FROM scope_findings WHERE organization_id = $1 AND id = $2",
    [organizationId, findingId]
  );

  return rows.rows[0] ? mapFinding(rows.rows[0]) : null;
}

export async function loadEvents(organizationId: string, options: { limit?: number; eventTypes?: string[] } = {}) {
  const conditions = ["organization_id = $1"];
  const parameters: unknown[] = [organizationId];

  if (options.eventTypes?.length) {
    parameters.push(options.eventTypes);
    conditions.push(`event_type = ANY($${parameters.length})`);
  }

  let sql = `SELECT * FROM billing_events WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC, id DESC`;

  if (options.limit) {
    parameters.push(options.limit);
    sql += ` LIMIT $${parameters.length}`;
  }

  const rows = await query<DbRow>(sql, parameters);

  return rows.rows.map(mapEvent);
}

export async function loadEventsForProject(organizationId: string, projectId: string): Promise<BillingEvent[]> {
  const rows = await query<DbRow>(
    "SELECT * FROM billing_events WHERE organization_id = $1 AND project_id = $2 ORDER BY created_at DESC, id DESC",
    [organizationId, projectId]
  );

  return rows.rows.map(mapEvent);
}

export async function loadEventsForFinding(organizationId: string, findingId: string): Promise<BillingEvent[]> {
  const rows = await query<DbRow>(
    "SELECT * FROM billing_events WHERE organization_id = $1 AND scope_finding_id = $2 ORDER BY created_at DESC, id DESC",
    [organizationId, findingId]
  );

  return rows.rows.map(mapEvent);
}

export async function loadReportForProject(organizationId: string, projectId: string): Promise<Report | null> {
  const rows = await query<DbRow>(
    `SELECT r.*, p.client_name, rv.id AS version_id, rv.version_number, rv.report_type, rv.markdown,
            rv.total_revenue_leakage_cents, rv.analyzed_messages_count, rv.out_of_scope_count,
            rv.sow_version_id, rv.source_finding_ids, rv.analysis_references, rv.content_sha256,
            rv.csv_content, rv.csv_sha256, rv.created_at AS version_created_at
     FROM reports r
     JOIN projects p ON p.id = r.project_id AND p.organization_id = r.organization_id
     JOIN report_versions rv ON rv.report_id = r.id
     WHERE r.organization_id = $1 AND r.project_id = $2
     ORDER BY rv.created_at DESC LIMIT 1`,
    [organizationId, projectId]
  );

  return rows.rows[0] ? mapReport(rows.rows[0]) : null;
}

export async function loadLeads(organizationId: string): Promise<Lead[]> {
  const rows = await query<DbRow>(
    "SELECT * FROM leads WHERE organization_id = $1 ORDER BY created_at DESC",
    [organizationId]
  );

  return rows.rows.map(mapLead);
}

export async function loadAuditRequests(organizationId: string): Promise<AuditRequest[]> {
  const rows = await query<DbRow>(
    "SELECT * FROM audit_requests WHERE organization_id = $1 ORDER BY created_at DESC",
    [organizationId]
  );

  return rows.rows.map(mapAuditRequest);
}

export async function loadCompanies(organizationId: string): Promise<Company[]> {
  const rows = await query<DbRow>(
    "SELECT * FROM companies WHERE organization_id = $1",
    [organizationId]
  );

  return rows.rows.map(mapCompany);
}

export async function loadSalesTemplates(organizationId: string): Promise<SalesTemplate[]> {
  const rows = await query<DbRow>(
    "SELECT * FROM sales_templates WHERE organization_id = $1 ORDER BY created_at",
    [organizationId]
  );

  return rows.rows.map((row) => ({
    id: String(row.id),
    template_type: row.template_type as SalesTemplate["template_type"],
    title: String(row.title),
    body: String(row.body),
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at)
  }));
}
