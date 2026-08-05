import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { query } from "@/lib/db/client";
import { iso } from "@/lib/store/postgres/client";
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
import type {
  AuditRequest,
  BillingEvent,
  BillingEventWithContext,
  ClientMessage,
  Company,
  FindingWithContext,
  Lead,
  MessageWithFinding,
  Project,
  ProjectSummary,
  Report,
  SalesTemplate,
  ScopeFinding
} from "@/lib/types";

type Snapshot = {
  companies: Company[];
  leads: Lead[];
  auditRequests: AuditRequest[];
  projects: Project[];
  messages: ClientMessage[];
  findings: ScopeFinding[];
  events: BillingEvent[];
  reports: Report[];
  salesTemplates: SalesTemplate[];
};

export async function snapshot(organizationId: string): Promise<Snapshot> {
  const [companies, leads, audits, projects, messages, findings, events, reports, templates] = await Promise.all([
    query("SELECT * FROM companies WHERE organization_id = $1", [organizationId]),
    query("SELECT * FROM leads WHERE organization_id = $1 ORDER BY created_at DESC", [organizationId]),
    query("SELECT * FROM audit_requests WHERE organization_id = $1 ORDER BY created_at DESC", [organizationId]),
    query(`SELECT p.*, COALESCE(sv.content, p.legacy_sow_text) AS sow_text
           FROM projects p
           LEFT JOIN sow_documents sd ON sd.project_id = p.id AND sd.organization_id = p.organization_id AND sd.status = 'Active'
           LEFT JOIN sow_versions sv ON sv.id = sd.current_version_id AND sv.organization_id = sd.organization_id
           WHERE p.organization_id = $1 AND p.archived_at IS NULL ORDER BY p.created_at DESC`, [organizationId]),
    query("SELECT * FROM client_messages WHERE organization_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC", [organizationId]),
    query(`SELECT f.* FROM scope_findings f
           JOIN client_messages m ON m.id=f.client_message_id AND m.organization_id=f.organization_id
           WHERE f.organization_id = $1 AND m.deleted_at IS NULL ORDER BY f.created_at DESC`, [organizationId]),
    query(`SELECT e.* FROM billing_events e
           JOIN scope_findings f ON f.id=e.scope_finding_id AND f.organization_id=e.organization_id
           JOIN client_messages m ON m.id=f.client_message_id AND m.organization_id=f.organization_id
           WHERE e.organization_id = $1 AND m.deleted_at IS NULL ORDER BY e.created_at DESC, e.id DESC`, [organizationId]),
    query(`SELECT r.*, p.client_name, rv.id AS version_id, rv.version_number, rv.report_type, rv.markdown,
                  rv.total_revenue_leakage_cents, rv.analyzed_messages_count, rv.out_of_scope_count,
                  rv.sow_version_id, rv.source_finding_ids, rv.analysis_references, rv.content_sha256,
                  rv.csv_content,rv.csv_sha256,
                  rv.created_at AS version_created_at
           FROM reports r JOIN projects p ON p.id=r.project_id AND p.organization_id=r.organization_id
           JOIN report_versions rv ON rv.id = r.current_version_id AND rv.organization_id=r.organization_id
           WHERE r.organization_id = $1 ORDER BY rv.created_at DESC`, [organizationId]),
    query("SELECT * FROM sales_templates WHERE organization_id = $1 ORDER BY created_at", [organizationId])
  ]);

  return {
    companies: companies.rows.map(mapCompany),
    leads: leads.rows.map(mapLead),
    auditRequests: audits.rows.map(mapAuditRequest),
    projects: projects.rows.map(mapProject),
    messages: messages.rows.map(mapMessage),
    findings: findings.rows.map(mapFinding),
    events: events.rows.map(mapEvent),
    reports: reports.rows.map(mapReport),
    salesTemplates: templates.rows.map((row) => ({
      id: String(row.id), template_type: row.template_type as SalesTemplate["template_type"],
      title: String(row.title), body: String(row.body), created_at: iso(row.created_at), updated_at: iso(row.updated_at)
    }))
  };
}

export function rowsForProject(projectId: string, data: Snapshot): MessageWithFinding[] {
  const findings = new Map(data.findings.map((finding) => [finding.client_message_id, finding]));

  return data.messages.filter((message) => message.project_id === projectId).map((message) => ({
    message, finding: findings.get(message.id) ?? null
  }));
}

export function contextFinding(finding: ScopeFinding, data: Snapshot): FindingWithContext {
  return {
    finding,
    message: data.messages.find((row) => row.id === finding.client_message_id) ?? null,
    project: data.projects.find((row) => row.id === finding.project_id) ?? null
  };
}

export function contextEvent(event: BillingEvent, data: Snapshot): BillingEventWithContext {
  return {
    event,
    finding: data.findings.find((row) => row.id === event.scope_finding_id) ?? null,
    project: data.projects.find((row) => row.id === event.project_id) ?? null
  };
}

export function projectSummary(project: Project, data: Snapshot): ProjectSummary {
  const rows = rowsForProject(project.id, data);

  return {
    ...project,
    messages_analyzed: rows.filter((row) => row.finding).length,
    out_of_scope_count: rows.filter((row) => row.finding?.classification === "Out of Scope").length,
    potential_recovered_revenue: rows.reduce(
      (sum, row) => sum + (row.finding && row.finding.classification !== "In Scope" ? row.finding.estimated_revenue : 0), 0
    )
  };
}

export async function findOrCreateCompany(client: PoolClient, organizationId: string, name: string, details?: { website?: string | null; businessType?: string | null; teamSize?: string | null }) {
  const existing = await client.query<{ id: string }>(
    "SELECT id FROM companies WHERE organization_id = $1 AND lower(name) = lower($2) LIMIT 1",
    [organizationId, name.trim()]
  );

  if (existing.rows[0]) return existing.rows[0].id;

  const id = randomUUID();

  await client.query(
    `INSERT INTO companies (id, organization_id, name, website, business_type, team_size)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [id, organizationId, name.trim(), details?.website ?? null, details?.businessType ?? null, details?.teamSize ?? null]
  );

  return id;
}
