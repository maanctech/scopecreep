import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { currentAuthContext } from "@/lib/auth/current";
import { applyFindingAction, TransitionError, type FindingActionName } from "@/lib/domain/findingTransitions";
import { assertIntegerCents } from "@/lib/domain/money";
import { computeRevenueTotals, emptyRevenueTotals, type RevenueTotals } from "@/lib/domain/revenueTotals";
import { query, transaction } from "@/lib/db/client";
import { NotFoundError, VersionConflictError } from "@/lib/storeErrors";
import type {
  AnalysisInput,
  AuditRequest,
  BillingEvent,
  BillingEventWithContext,
  BusinessDashboard,
  ClientMessage,
  Company,
  FindingWithContext,
  Lead,
  LeadStatus,
  MessageSource,
  MessageWithFinding,
  Project,
  ProjectDetail,
  ProjectSummary,
  Report,
  ReportType,
  SalesTemplate,
  ScopeFinding
} from "@/lib/types";
import type { AppDashboard } from "@/lib/store";
import type { AnalysisMetadata } from "@/lib/ai/types";
import { splitSowSections } from "@/lib/sow/extraction";
import { generateFindingsCsv, generateReportDocument } from "@/lib/reports/generator";

type Context = { organizationId: string; userId: string; actor: string };
type DbRow = Record<string, unknown>;

function number(value: unknown) {
  return value === null || value === undefined ? null : Number(value);
}

function iso(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function dollars(cents: unknown) {
  return Number(cents || 0) / 100;
}

function cents(value: number | null | undefined) {
  return value == null ? null : Math.round(value * 100);
}

async function requireContext(): Promise<Context> {
  const auth = await currentAuthContext();
  if (!auth) throw new Error("A valid organization session is required.");
  return {
    organizationId: auth.organizationId,
    userId: auth.userId,
    actor: auth.displayName
  };
}

async function publicOrganizationId() {
  const result = await query<{ id: string }>(
    `SELECT o.id FROM organizations o
     JOIN organization_settings s ON s.organization_id = o.id
     WHERE COALESCE((s.settings->>'publicLeadCapture')::boolean, false) = true
     ORDER BY o.created_at LIMIT 1`
  );
  if (!result.rows[0]) throw new Error("Public audit intake is not configured.");
  return result.rows[0].id;
}

function mapCompany(row: DbRow): Company {
  return {
    id: String(row.id),
    name: String(row.name),
    website: row.website ? String(row.website) : null,
    business_type: row.business_type ? String(row.business_type) : null,
    team_size: row.team_size ? String(row.team_size) : null,
    created_at: iso(row.created_at)
  };
}

function mapLead(row: DbRow): Lead {
  return {
    id: String(row.id),
    company_id: row.company_id ? String(row.company_id) : null,
    name: String(row.name),
    email: String(row.email),
    company: String(row.company),
    website: row.website ? String(row.website) : null,
    business_type: String(row.business_type),
    team_size: String(row.team_size),
    average_project_value: row.average_project_value_cents == null ? null : dollars(row.average_project_value_cents),
    hourly_rate: row.hourly_rate_cents == null ? null : dollars(row.hourly_rate_cents),
    pain_point: String(row.pain_point),
    consent_to_contact: Boolean(row.consent_to_contact),
    status: row.status as Lead["status"],
    created_at: iso(row.created_at)
  };
}

function mapAuditRequest(row: DbRow): AuditRequest {
  return {
    id: String(row.id),
    lead_id: row.lead_id ? String(row.lead_id) : null,
    company_id: row.company_id ? String(row.company_id) : null,
    client_name: String(row.client_name),
    project_value: row.project_value_cents == null ? null : dollars(row.project_value_cents),
    hourly_rate: dollars(row.hourly_rate_cents),
    sow_text: String(row.sow_text),
    message_export_text: String(row.message_export_text),
    suspected_scope_creep_notes: row.suspected_scope_creep_notes ? String(row.suspected_scope_creep_notes) : null,
    status: row.status as AuditRequest["status"],
    created_at: iso(row.created_at)
  };
}

function mapProject(row: DbRow): Project {
  return {
    id: String(row.id),
    company_id: row.company_id ? String(row.company_id) : null,
    lead_id: row.lead_id ? String(row.lead_id) : null,
    audit_request_id: row.audit_request_id ? String(row.audit_request_id) : null,
    client_name: String(row.client_name),
    project_name: String(row.project_name),
    hourly_rate: dollars(row.hourly_rate_cents),
    project_value: row.project_value_cents == null ? null : dollars(row.project_value_cents),
    sow_text: String(row.sow_text ?? row.legacy_sow_text ?? ""),
    active_sow_version_id: row.active_sow_version_id ? String(row.active_sow_version_id) : null,
    created_at: iso(row.created_at),
    is_demo: Boolean(row.is_demo)
  };
}

function mapMessage(row: DbRow): ClientMessage {
  return {
    id: String(row.id),
    project_id: String(row.project_id),
    source: row.source as MessageSource,
    sender: row.sender ? String(row.sender) : null,
    message_text: String(row.message_text),
    message_date: row.message_date ? iso(row.message_date) : null,
    created_at: iso(row.created_at)
  };
}

function jsonStrings(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function mapFinding(row: DbRow): ScopeFinding {
  return {
    id: String(row.id),
    project_id: String(row.project_id),
    client_message_id: String(row.client_message_id),
    classification: row.classification as ScopeFinding["classification"],
    confidence_score: Number(row.confidence_score),
    reasoning: String(row.reasoning),
    relevant_sow_sections: jsonStrings(row.relevant_sow_sections),
    request_type: row.request_type as ScopeFinding["request_type"],
    estimated_hours: Number(row.estimated_hours),
    estimated_revenue: dollars(row.estimated_revenue_cents),
    suggested_change_order: String(row.suggested_change_order),
    billing_decision: row.billing_decision as ScopeFinding["billing_decision"],
    workflow_status: row.workflow_status as ScopeFinding["workflow_status"],
    approved_hours: number(row.approved_hours),
    approved_amount_cents: number(row.approved_amount_cents),
    client_facing_explanation: String(row.client_facing_explanation),
    internal_note: row.internal_note ? String(row.internal_note) : null,
    reviewed_by: row.reviewed_by_label ? String(row.reviewed_by_label) : null,
    reviewed_at: row.reviewed_at ? iso(row.reviewed_at) : null,
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
    version: Number(row.version),
    is_demo: Boolean(row.is_demo)
  };
}

function mapEvent(row: DbRow): BillingEvent {
  return {
    id: String(row.id),
    project_id: String(row.project_id),
    scope_finding_id: String(row.scope_finding_id),
    event_type: row.event_type as BillingEvent["event_type"],
    amount_cents: number(row.amount_cents),
    previous_amount_cents: number(row.previous_amount_cents),
    new_amount_cents: number(row.new_amount_cents),
    previous_status: (row.previous_status || null) as BillingEvent["previous_status"],
    new_status: (row.new_status || null) as BillingEvent["new_status"],
    previous_decision: (row.previous_decision || null) as BillingEvent["previous_decision"],
    new_decision: (row.new_decision || null) as BillingEvent["new_decision"],
    note: row.note ? String(row.note) : null,
    actor: String(row.actor_label),
    created_at: iso(row.created_at),
    is_demo: Boolean(row.is_demo)
  };
}

function mapReport(row: DbRow): Report {
  return {
    id: String(row.version_id ?? row.id),
    project_id: String(row.project_id),
    title: row.client_name && row.report_type
      ? `${String(row.client_name)} ${String(row.report_type)}`
      : String(row.title),
    markdown: String(row.markdown),
    total_revenue_leakage: dollars(row.total_revenue_leakage_cents),
    analyzed_messages_count: Number(row.analyzed_messages_count),
    out_of_scope_count: Number(row.out_of_scope_count),
    created_at: iso(row.version_created_at ?? row.created_at),
    report_type: (row.report_type || "Internal Scope Audit") as ReportType,
    version_number: Number(row.version_number || 1),
    sow_version_id: row.sow_version_id ? String(row.sow_version_id) : null,
    source_finding_ids: Array.isArray(row.source_finding_ids) ? row.source_finding_ids.map(String) : [],
    analysis_references: Array.isArray(row.analysis_references)
      ? row.analysis_references as Report["analysis_references"]
      : [],
    content_sha256: row.content_sha256 ? String(row.content_sha256) : null,
    csv_content: String(row.csv_content || ""),
    csv_sha256: row.csv_sha256 ? String(row.csv_sha256) : null
  };
}

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

async function snapshot(organizationId: string): Promise<Snapshot> {
  const [companies, leads, audits, projects, messages, findings, events, reports, templates] = await Promise.all([
    query("SELECT * FROM companies WHERE organization_id = $1", [organizationId]),
    query("SELECT * FROM leads WHERE organization_id = $1 ORDER BY created_at DESC", [organizationId]),
    query("SELECT * FROM audit_requests WHERE organization_id = $1 ORDER BY created_at DESC", [organizationId]),
    query(`SELECT p.*, COALESCE(sv.content, p.legacy_sow_text) AS sow_text
           FROM projects p LEFT JOIN sow_documents sd ON sd.project_id = p.id AND sd.status = 'Active'
           LEFT JOIN sow_versions sv ON sv.id = sd.current_version_id
           WHERE p.organization_id = $1 AND p.archived_at IS NULL ORDER BY p.created_at DESC`, [organizationId]),
    query("SELECT * FROM client_messages WHERE organization_id = $1 ORDER BY created_at DESC", [organizationId]),
    query("SELECT * FROM scope_findings WHERE organization_id = $1 ORDER BY created_at DESC", [organizationId]),
    query("SELECT * FROM billing_events WHERE organization_id = $1 ORDER BY created_at DESC, id DESC", [organizationId]),
    query(`SELECT r.*, p.client_name, rv.id AS version_id, rv.version_number, rv.report_type, rv.markdown,
                  rv.total_revenue_leakage_cents, rv.analyzed_messages_count, rv.out_of_scope_count,
                  rv.sow_version_id, rv.source_finding_ids, rv.analysis_references, rv.content_sha256,
                  rv.csv_content,rv.csv_sha256,
                  rv.created_at AS version_created_at
           FROM reports r JOIN projects p ON p.id=r.project_id AND p.organization_id=r.organization_id
           JOIN report_versions rv ON rv.report_id = r.id
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

function rowsForProject(projectId: string, data: Snapshot): MessageWithFinding[] {
  const findings = new Map(data.findings.map((finding) => [finding.client_message_id, finding]));
  return data.messages.filter((message) => message.project_id === projectId).map((message) => ({
    message, finding: findings.get(message.id) ?? null
  }));
}

function contextFinding(finding: ScopeFinding, data: Snapshot): FindingWithContext {
  return {
    finding,
    message: data.messages.find((row) => row.id === finding.client_message_id) ?? null,
    project: data.projects.find((row) => row.id === finding.project_id) ?? null
  };
}

function contextEvent(event: BillingEvent, data: Snapshot): BillingEventWithContext {
  return {
    event,
    finding: data.findings.find((row) => row.id === event.scope_finding_id) ?? null,
    project: data.projects.find((row) => row.id === event.project_id) ?? null
  };
}

function projectSummary(project: Project, data: Snapshot): ProjectSummary {
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

async function findOrCreateCompany(client: PoolClient, organizationId: string, name: string, details?: { website?: string | null; businessType?: string | null; teamSize?: string | null }) {
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

export async function createLead(input: {
  name: string; email: string; company: string; website?: string | null; business_type: string;
  team_size: string; average_project_value?: number | null; hourly_rate?: number | null;
  pain_point: string; consent_to_contact: boolean;
}) {
  const organizationId = await publicOrganizationId();
  return transaction(async (client) => {
    const companyId = await findOrCreateCompany(client, organizationId, input.company, {
      website: input.website, businessType: input.business_type, teamSize: input.team_size
    });
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const result = await client.query(
      `INSERT INTO leads
       (id, organization_id, company_id, name, email, company, website, business_type, team_size,
        average_project_value_cents, hourly_rate_cents, pain_point, consent_to_contact, status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'New',$14,$14) RETURNING *`,
      [id, organizationId, companyId, input.name.trim(), input.email.trim().toLowerCase(), input.company.trim(),
       input.website?.trim() || null, input.business_type.trim(), input.team_size.trim(), cents(input.average_project_value),
       cents(input.hourly_rate), input.pain_point.trim(), input.consent_to_contact, createdAt]
    );
    await client.query(
      `INSERT INTO lead_status_history (id, organization_id, lead_id, from_status, to_status, note, created_at)
       VALUES ($1,$2,$3,NULL,'New','Lead submitted free audit request.',$4)`,
      [randomUUID(), organizationId, id, createdAt]
    );
    return mapLead(result.rows[0]);
  });
}

export async function updateLeadStatus(input: { lead_id: string; status: LeadStatus; note?: string | null }) {
  const context = await requireContext();
  return transaction(async (client) => {
    const current = await client.query<DbRow>(
      "SELECT * FROM leads WHERE id = $1 AND organization_id = $2 FOR UPDATE", [input.lead_id, context.organizationId]
    );
    if (!current.rows[0]) throw new Error("Lead not found.");
    await client.query("UPDATE leads SET status = $1, updated_at = now() WHERE id = $2 AND organization_id = $3", [input.status, input.lead_id, context.organizationId]);
    await client.query(
      `INSERT INTO lead_status_history
       (id, organization_id, lead_id, from_status, to_status, note, actor_user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [randomUUID(), context.organizationId, input.lead_id, current.rows[0].status, input.status, input.note?.trim() || null, context.userId]
    );
    return mapLead({ ...current.rows[0], status: input.status });
  });
}

async function insertProjectAndSow(client: PoolClient, organizationId: string, input: {
  companyId: string | null; leadId: string | null; auditRequestId: string | null; clientName: string;
  projectName: string; hourlyRate: number; projectValue: number | null; sowText: string; isDemo?: boolean;
}) {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const result = await client.query(
    `INSERT INTO projects
     (id, organization_id, company_id, lead_id, audit_request_id, client_name, project_name,
      hourly_rate_cents, project_value_cents, legacy_sow_text, is_demo, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12) RETURNING *`,
    [id, organizationId, input.companyId, input.leadId, input.auditRequestId, input.clientName.trim(), input.projectName.trim(),
     cents(input.hourlyRate), cents(input.projectValue), input.sowText.trim(), input.isDemo ?? false, createdAt]
  );
  const documentId = randomUUID();
  const versionId = randomUUID();
  await client.query(
    `INSERT INTO sow_documents (id, organization_id, project_id, title, status, created_at, updated_at)
     VALUES ($1,$2,$3,$4,'Active',$5,$5)`,
    [documentId, organizationId, id, `${input.projectName.trim()} Statement of Work`, createdAt]
  );
  await client.query(
    `INSERT INTO sow_versions
     (id, organization_id, sow_document_id, version_number, source_type, content, content_sha256, created_at)
     VALUES ($1,$2,$3,1,'Pasted Text',$4,$5,$6)`,
    [versionId, organizationId, documentId, input.sowText.trim(), createHash("sha256").update(input.sowText.trim()).digest("hex"), createdAt]
  );
  for (const section of splitSowSections(input.sowText.trim())) {
    await client.query(
      `INSERT INTO sow_sections (id, organization_id, sow_version_id, heading, body, ordinal, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [randomUUID(), organizationId, versionId, section.heading, section.body, section.ordinal, createdAt]
    );
  }
  await client.query("UPDATE sow_documents SET current_version_id = $1 WHERE id = $2", [versionId, documentId]);
  await client.query(
    "UPDATE projects SET active_sow_version_id = $1 WHERE id = $2 AND organization_id = $3",
    [versionId, id, organizationId]
  );
  return mapProject({ ...result.rows[0], sow_text: input.sowText.trim() });
}

export async function createAuditRequest(input: {
  lead_id?: string | null; client_name: string; project_value?: number | null; hourly_rate: number;
  sow_text: string; message_export_text: string; suspected_scope_creep_notes?: string | null;
}) {
  return transaction(async (client) => {
    let organizationId: string;
    let lead: DbRow | null = null;
    if (input.lead_id) {
      const found = await client.query<DbRow>("SELECT * FROM leads WHERE id = $1", [input.lead_id]);
      lead = found.rows[0] ?? null;
      if (!lead) throw new Error("Lead not found.");
      organizationId = String(lead.organization_id);
    } else {
      organizationId = await publicOrganizationId();
    }
    const companyId = lead?.company_id
      ? String(lead.company_id)
      : await findOrCreateCompany(client, organizationId, input.client_name);
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const result = await client.query(
      `INSERT INTO audit_requests
       (id, organization_id, lead_id, company_id, client_name, project_value_cents, hourly_rate_cents,
        sow_text, message_export_text, suspected_scope_creep_notes, status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'Submitted',$11,$11) RETURNING *`,
      [id, organizationId, input.lead_id ?? null, companyId, input.client_name.trim(), cents(input.project_value),
       cents(input.hourly_rate), input.sow_text.trim(), input.message_export_text.trim(),
       input.suspected_scope_creep_notes?.trim() || null, createdAt]
    );
    const project = await insertProjectAndSow(client, organizationId, {
      companyId, leadId: input.lead_id ?? null, auditRequestId: id, clientName: input.client_name,
      projectName: `${input.client_name.trim()} Audit`, hourlyRate: input.hourly_rate,
      projectValue: input.project_value ?? null, sowText: input.sow_text
    });
    if (lead) {
      await client.query("UPDATE leads SET status = 'Audit Running', updated_at = now() WHERE id = $1", [input.lead_id]);
      await client.query(
        `INSERT INTO lead_status_history
         (id, organization_id, lead_id, from_status, to_status, note)
         VALUES ($1,$2,$3,$4,'Audit Running','Onboarding intake submitted.')`,
        [randomUUID(), organizationId, input.lead_id, lead.status]
      );
    }
    return { auditRequest: mapAuditRequest(result.rows[0]), project };
  });
}

export async function createProject(input: {
  company_id?: string | null; lead_id?: string | null; audit_request_id?: string | null;
  client_name: string; project_name: string; hourly_rate: number; project_value?: number | null; sow_text: string;
}) {
  const context = await requireContext();
  return transaction((client) => insertProjectAndSow(client, context.organizationId, {
    companyId: input.company_id ?? null, leadId: input.lead_id ?? null, auditRequestId: input.audit_request_id ?? null,
    clientName: input.client_name, projectName: input.project_name, hourlyRate: input.hourly_rate,
    projectValue: input.project_value ?? null, sowText: input.sow_text
  }));
}

const decisionEvents: BillingEvent["event_type"][] = ["Approved Internally", "Included In Retainer", "Discussing With Client", "Absorbed", "Rejected", "Reopened", "Decision Updated"];

export async function getAppDashboard(): Promise<AppDashboard> {
  const context = await requireContext();
  const data = await snapshot(context.organizationId);
  const demoFindings = data.findings.filter((finding) => finding.is_demo);
  const realFindings = data.findings.filter((finding) => !finding.is_demo);
  const events = data.events.map((event) => contextEvent(event, data));
  const revenueByProject = data.projects.map((project) => ({
    project, totals: computeRevenueTotals(data.findings.filter((finding) => finding.project_id === project.id))
  })).sort((a, b) => b.totals.potential_dollars - a.totals.potential_dollars);
  const groups = new Map<string, { client_name: string; is_demo: boolean; findings: ScopeFinding[] }>();
  for (const project of data.projects) {
    const key = `${project.client_name}|${project.is_demo}`;
    const group = groups.get(key) ?? { client_name: project.client_name, is_demo: project.is_demo, findings: [] };
    group.findings.push(...data.findings.filter((finding) => finding.project_id === project.id));
    groups.set(key, group);
  }
  return {
    projects: data.projects.map((project) => projectSummary(project, data)),
    demoTotals: demoFindings.length ? computeRevenueTotals(demoFindings) : emptyRevenueTotals(),
    realTotals: realFindings.length ? computeRevenueTotals(realFindings) : emptyRevenueTotals(),
    hasDemoFindings: demoFindings.length > 0,
    hasRealFindings: realFindings.length > 0,
    attention: data.findings.filter((finding) => finding.billing_decision === "Undecided" && finding.classification !== "In Scope")
      .sort((a, b) => b.estimated_revenue - a.estimated_revenue).slice(0, 6).map((finding) => contextFinding(finding, data)),
    recentDecisions: events.filter(({ event }) => decisionEvents.includes(event.event_type)).slice(0, 6),
    recentEvents: events.slice(0, 8),
    revenueByProject,
    revenueByClient: Array.from(groups.values()).map((group) => ({
      client_name: group.client_name, is_demo: group.is_demo, totals: computeRevenueTotals(group.findings)
    })).sort((a, b) => b.totals.potential_dollars - a.totals.potential_dollars)
  };
}

export async function getProjectDetail(projectId: string): Promise<ProjectDetail | null> {
  const context = await requireContext();
  const data = await snapshot(context.organizationId);
  const project = data.projects.find((row) => row.id === projectId);
  return project ? { project, messages: rowsForProject(projectId, data) } : null;
}

export async function getFindings() {
  const context = await requireContext();
  const data = await snapshot(context.organizationId);
  return data.findings.map((finding) => contextFinding(finding, data));
}

export async function getFindingDetail(findingId: string) {
  const context = await requireContext();
  const data = await snapshot(context.organizationId);
  const finding = data.findings.find((row) => row.id === findingId);
  return finding ? {
    ...contextFinding(finding, data),
    events: data.events.filter((event) => event.scope_finding_id === finding.id)
  } : null;
}

export async function getBillingEvents() {
  const context = await requireContext();
  const data = await snapshot(context.organizationId);
  return data.events.map((event) => contextEvent(event, data));
}

async function insertFindingHistory(client: PoolClient, organizationId: string, finding: ScopeFinding, userId: string | null, reason: string) {
  await client.query(
    `INSERT INTO scope_finding_history
     (id, organization_id, scope_finding_id, version, snapshot, changed_by, change_reason)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7)`,
    [randomUUID(), organizationId, finding.id, finding.version, JSON.stringify(finding), userId, reason]
  );
}

async function insertBillingEvent(client: PoolClient, organizationId: string, event: BillingEvent, userId: string | null) {
  await client.query(
    `INSERT INTO billing_events
     (id, organization_id, project_id, scope_finding_id, event_type, amount_cents, previous_amount_cents,
      new_amount_cents, previous_status, new_status, previous_decision, new_decision, note,
      actor_user_id, actor_label, is_demo, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
    [event.id, organizationId, event.project_id, event.scope_finding_id, event.event_type, event.amount_cents,
     event.previous_amount_cents, event.new_amount_cents, event.previous_status, event.new_status,
     event.previous_decision, event.new_decision, event.note, userId, event.actor, event.is_demo, event.created_at]
  );
}

export async function saveMessageWithFinding(input: {
  project_id: string; source: MessageSource; sender?: string | null; message_text: string;
  message_date?: string | null; analysis: AnalysisInput; analysis_metadata?: AnalysisMetadata;
  sow_version_id?: string; boundary_map_id?: string;
}) {
  const context = await requireContext();
  return transaction(async (client) => {
    const projectResult = await client.query<DbRow>(
      "SELECT * FROM projects WHERE id = $1 AND organization_id = $2", [input.project_id, context.organizationId]
    );
    if (!projectResult.rows[0]) throw new NotFoundError("Project not found.");
    const timestamp = new Date().toISOString();
    const message: ClientMessage = {
      id: randomUUID(), project_id: input.project_id, source: input.source, sender: input.sender?.trim() || null,
      message_text: input.message_text.trim(), message_date: input.message_date || null, created_at: timestamp
    };
    await client.query(
      `INSERT INTO client_messages
       (id, organization_id, project_id, source, sender, message_text, message_date, content_sha256, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [message.id, context.organizationId, message.project_id, message.source, message.sender, message.message_text,
       message.message_date, createHash("sha256").update(message.message_text).digest("hex"), timestamp]
    );
    const analysisJobId = input.analysis_metadata ? randomUUID() : null;
    if (input.analysis_metadata && analysisJobId) {
      await client.query(
        `INSERT INTO analysis_jobs
         (id, organization_id, project_id, client_message_id, provider, model, prompt_version,
          status, input_sha256, error_message, attempt_count, latency_ms, input_character_count,
          sow_version_id, boundary_map_id,
          output_character_count, started_at, completed_at, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$17,$17,$17)`,
        [analysisJobId, context.organizationId, input.project_id, message.id, input.analysis_metadata.provider,
         input.analysis_metadata.model, input.analysis_metadata.promptVersion, input.analysis_metadata.status,
         input.analysis_metadata.inputHash,
         input.analysis_metadata.errorMessage, input.analysis_metadata.attempts, input.analysis_metadata.latencyMs,
         input.analysis_metadata.inputCharacters, input.sow_version_id || null, input.boundary_map_id || null,
         input.analysis_metadata.outputCharacters, timestamp]
      );
    }
    const finding: ScopeFinding = {
      id: randomUUID(), project_id: input.project_id, client_message_id: message.id, ...input.analysis,
      billing_decision: "Undecided", workflow_status: input.analysis.classification === "In Scope" ? "New" : "Needs Review",
      approved_hours: null, approved_amount_cents: null, client_facing_explanation: input.analysis.suggested_change_order,
      reviewed_by: null, reviewed_at: null, created_at: timestamp, updated_at: timestamp, version: 1,
      is_demo: Boolean(projectResult.rows[0].is_demo)
    };
    await client.query(
      `INSERT INTO scope_findings
       (id, organization_id, project_id, client_message_id, analysis_job_id, classification, confidence_score, reasoning,
        relevant_sow_sections, request_type, estimated_hours, estimated_revenue_cents, suggested_change_order,
        billing_decision, workflow_status, approved_hours, approved_amount_cents, client_facing_explanation,
        internal_note, version, is_demo, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)`,
      [finding.id, context.organizationId, finding.project_id, finding.client_message_id, analysisJobId, finding.classification,
       finding.confidence_score, finding.reasoning, JSON.stringify(finding.relevant_sow_sections), finding.request_type,
       finding.estimated_hours, cents(finding.estimated_revenue), finding.suggested_change_order, finding.billing_decision,
       finding.workflow_status, finding.approved_hours, finding.approved_amount_cents, finding.client_facing_explanation,
       finding.internal_note, finding.version, finding.is_demo, timestamp, timestamp]
    );
    await insertFindingHistory(client, context.organizationId, finding, context.userId, "AI analysis saved");
    await insertBillingEvent(client, context.organizationId, {
      id: randomUUID(), project_id: finding.project_id, scope_finding_id: finding.id, event_type: "Finding Created",
      amount_cents: null, previous_amount_cents: null, new_amount_cents: null, previous_status: null,
      new_status: finding.workflow_status, previous_decision: null, new_decision: finding.billing_decision,
      note: "AI analysis saved. Human review required before billing.", actor: "AI Analysis",
      created_at: timestamp, is_demo: finding.is_demo
    }, null);
    return { message, finding };
  });
}

async function lockedFinding(client: PoolClient, context: Context, findingId: string) {
  const result = await client.query<DbRow>(
    "SELECT * FROM scope_findings WHERE id = $1 AND organization_id = $2 FOR UPDATE", [findingId, context.organizationId]
  );
  if (!result.rows[0]) throw new NotFoundError("Finding not found.");
  return mapFinding(result.rows[0]);
}

async function persistFinding(client: PoolClient, context: Context, finding: ScopeFinding) {
  await client.query(
    `UPDATE scope_findings SET billing_decision=$1, workflow_status=$2, approved_hours=$3,
     approved_amount_cents=$4, client_facing_explanation=$5, internal_note=$6, reviewed_by_user_id=$7,
     reviewed_by_label=$8, reviewed_at=$9, version=$10, updated_at=$11
     WHERE id=$12 AND organization_id=$13`,
    [finding.billing_decision, finding.workflow_status, finding.approved_hours, finding.approved_amount_cents,
     finding.client_facing_explanation, finding.internal_note, context.userId, finding.reviewed_by,
     finding.reviewed_at, finding.version, finding.updated_at, finding.id, context.organizationId]
  );
}

export async function updateFindingDetails(input: {
  finding_id: string; expected_version: number; approved_hours?: number | null;
  approved_amount_cents?: number | null; client_facing_explanation?: string; internal_note?: string | null;
}) {
  const context = await requireContext();
  return transaction(async (client) => {
    const finding = await lockedFinding(client, context, input.finding_id);
    if (finding.version !== input.expected_version) throw new VersionConflictError();
    const wantsAmountChange = input.approved_hours !== undefined || input.approved_amount_cents !== undefined;
    if (wantsAmountChange && finding.workflow_status !== "Decided") {
      throw new TransitionError(
        finding.workflow_status === "Invoiced" || finding.workflow_status === "Paid"
          ? "Reopen this finding before changing amounts that were already invoiced."
          : "Make a billing decision (for example Mark as Billable) before setting approved amounts.",
        "invalid_action"
      );
    }
    const timestamp = new Date().toISOString();
    const previousAmount = finding.approved_amount_cents;
    const updated: ScopeFinding = {
      ...finding,
      approved_hours: input.approved_hours !== undefined ? input.approved_hours : finding.approved_hours,
      approved_amount_cents: input.approved_amount_cents !== undefined
        ? input.approved_amount_cents === null ? null : assertIntegerCents(input.approved_amount_cents, "approved_amount_cents")
        : finding.approved_amount_cents,
      client_facing_explanation: input.client_facing_explanation ?? finding.client_facing_explanation,
      internal_note: input.internal_note !== undefined ? input.internal_note : finding.internal_note,
      reviewed_by: context.actor, reviewed_at: timestamp, updated_at: timestamp, version: finding.version + 1
    };
    await persistFinding(client, context, updated);
    await insertFindingHistory(client, context.organizationId, updated, context.userId, "Finding details updated");
    if (wantsAmountChange && previousAmount !== updated.approved_amount_cents) {
      await insertBillingEvent(client, context.organizationId, {
        id: randomUUID(), project_id: finding.project_id, scope_finding_id: finding.id, event_type: "Estimate Updated",
        amount_cents: updated.approved_amount_cents, previous_amount_cents: previousAmount,
        new_amount_cents: updated.approved_amount_cents, previous_status: finding.workflow_status,
        new_status: updated.workflow_status, previous_decision: finding.billing_decision,
        new_decision: updated.billing_decision, note: "Approved amount edited by the professional.",
        actor: context.actor, created_at: timestamp, is_demo: finding.is_demo
      }, context.userId);
    }
    return updated;
  });
}

export async function performFindingAction(input: {
  finding_id: string; expected_version: number; action: FindingActionName; note?: string | null;
}) {
  const context = await requireContext();
  return transaction(async (client) => {
    const finding = await lockedFinding(client, context, input.finding_id);
    if (finding.version !== input.expected_version) throw new VersionConflictError();
    const timestamp = new Date().toISOString();
    const applied = applyFindingAction(finding, input.action, { now: timestamp, actor: context.actor });
    await persistFinding(client, context, applied.finding);
    await insertFindingHistory(client, context.organizationId, applied.finding, context.userId, input.action);
    await insertBillingEvent(client, context.organizationId, {
      id: randomUUID(), project_id: finding.project_id, scope_finding_id: finding.id, ...applied.event,
      note: input.note?.trim() || null, actor: context.actor, created_at: timestamp, is_demo: finding.is_demo
    }, context.userId);
    return applied.finding;
  });
}

export async function readAuditReport(projectId: string) {
  const context = await requireContext();
  const data = await snapshot(context.organizationId);
  const project = data.projects.find((row) => row.id === projectId);
  if (!project) return null;
  return { project, report: data.reports.find((row) => row.project_id === projectId) ?? null, messages: rowsForProject(projectId, data) };
}

export async function generateAuditReport(projectId: string, reportType: ReportType = "Internal Scope Audit") {
  const context = await requireContext();
  const data = await snapshot(context.organizationId);
  const project = data.projects.find((row) => row.id === projectId);
  if (!project) throw new NotFoundError("Project not found.");
  const rows = rowsForProject(projectId, data);
  const analyzed = rows.filter((row) => row.finding);
  const total = analyzed.reduce((sum, row) => sum + (row.finding && row.finding.classification !== "In Scope" ? row.finding.estimated_revenue : 0), 0);
  const out = analyzed.filter((row) => row.finding?.classification === "Out of Scope").length;
  const markdown = generateReportDocument({ project, rows, reportType });
  const createdAt = new Date().toISOString();
  const sourceFindingIds = analyzed.flatMap((row) => row.finding ? [row.finding.id] : []);
  const provenance = await query<{
    finding_id: string;
    provider: string | null;
    model: string | null;
    prompt_version: string | null;
  }>(
    `SELECT f.id AS finding_id,aj.provider,aj.model,aj.prompt_version
     FROM scope_findings f
     LEFT JOIN analysis_jobs aj ON aj.id=f.analysis_job_id AND aj.organization_id=f.organization_id
     WHERE f.organization_id=$1 AND f.project_id=$2 AND f.id=ANY($3::uuid[])
     ORDER BY f.created_at,f.id`,
    [context.organizationId, projectId, sourceFindingIds]
  );
  const sowVersionId = project.active_sow_version_id || null;
  const analysisReferences = Array.from(
    new Map(
      provenance.rows
        .filter((row) => row.provider && row.model && row.prompt_version)
        .map((row) => {
          const reference = { provider: row.provider!, model: row.model!, promptVersion: row.prompt_version! };
          return [`${reference.provider}|${reference.model}|${reference.promptVersion}`, reference] as const;
        })
    ).values()
  );
  const contentHash = createHash("sha256").update(markdown).digest("hex");
  const csv = generateFindingsCsv(project, rows);
  const csvHash = createHash("sha256").update(csv).digest("hex");
  const report = await transaction(async (client) => {
    const existing = await client.query<{ id: string }>(
      "SELECT id FROM reports WHERE organization_id = $1 AND project_id = $2 FOR UPDATE", [context.organizationId, projectId]
    );
    const reportId = existing.rows[0]?.id ?? randomUUID();
    if (!existing.rows[0]) {
      await client.query(
        `INSERT INTO reports (id, organization_id, project_id, title, created_by, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$6)`,
        [reportId, context.organizationId, projectId, `${project.client_name} ${reportType}`, context.userId, createdAt]
      );
    }
    const versionResult = await client.query<{ next_version: number }>(
      "SELECT COALESCE(max(version_number), 0)::int + 1 AS next_version FROM report_versions WHERE report_id = $1", [reportId]
    );
    const versionId = randomUUID();
    await client.query(
      `INSERT INTO report_versions
       (id, organization_id, report_id, version_number, markdown, total_revenue_leakage_cents,
        analyzed_messages_count, out_of_scope_count, generated_by, created_at, report_type,
        sow_version_id, source_finding_ids, analysis_references, content_sha256,csv_content,csv_sha256)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$16,$17)`,
      [versionId, context.organizationId, reportId, versionResult.rows[0].next_version, markdown, cents(total),
       analyzed.length, out, context.userId, createdAt, reportType, sowVersionId, sourceFindingIds,
       JSON.stringify(analysisReferences), contentHash, csv, csvHash]
    );
    await client.query("UPDATE reports SET current_version_id=$1,title=$2,updated_at=$3 WHERE id=$4", [
      versionId, `${project.client_name} ${reportType}`, createdAt, reportId
    ]);
    await client.query(
      "INSERT INTO audit_logs (id,organization_id,actor_user_id,action,resource_type,resource_id,metadata) VALUES ($1,$2,$3,'report.generated','report_version',$4,$5::jsonb)",
      [randomUUID(), context.organizationId, context.userId, versionId,
       JSON.stringify({ projectId, reportType, versionNumber: versionResult.rows[0].next_version, contentHash })]
    );
    return { id: versionId, project_id: projectId, title: `${project.client_name} ${reportType}`, markdown,
      total_revenue_leakage: total, analyzed_messages_count: analyzed.length, out_of_scope_count: out,
      created_at: createdAt, report_type: reportType, version_number: versionResult.rows[0].next_version,
      sow_version_id: sowVersionId, source_finding_ids: sourceFindingIds,
      analysis_references: analysisReferences, content_sha256: contentHash,
      csv_content: csv, csv_sha256: csvHash } satisfies Report;
  });
  return { report, project, messages: rows };
}

export async function getReportHistory(projectId: string) {
  const context = await requireContext();
  const project = await query<DbRow>(
    "SELECT id FROM projects WHERE id=$1 AND organization_id=$2",
    [projectId, context.organizationId]
  );
  if (!project.rows[0]) throw new NotFoundError("Project not found.");
  const versions = await query<DbRow>(
    `SELECT r.project_id,r.title,p.client_name,rv.id AS version_id,rv.version_number,rv.report_type,rv.markdown,
            rv.total_revenue_leakage_cents,rv.analyzed_messages_count,rv.out_of_scope_count,
            rv.sow_version_id,rv.source_finding_ids,rv.analysis_references,rv.content_sha256,
            rv.csv_content,rv.csv_sha256,
            rv.created_at AS version_created_at
     FROM reports r JOIN projects p ON p.id=r.project_id AND p.organization_id=r.organization_id
     JOIN report_versions rv ON rv.report_id=r.id AND rv.organization_id=r.organization_id
     WHERE r.organization_id=$1 AND r.project_id=$2 ORDER BY rv.version_number DESC`,
    [context.organizationId, projectId]
  );
  return versions.rows.map(mapReport);
}

export async function getReportVersion(projectId: string, versionId: string) {
  const versions = await getReportHistory(projectId);
  return versions.find((version) => version.id === versionId) || null;
}

export async function exportFindingsCsv(projectId: string) {
  const context = await requireContext();
  const data = await snapshot(context.organizationId);
  const project = data.projects.find((row) => row.id === projectId);
  if (!project) throw new NotFoundError("Project not found.");
  return generateFindingsCsv(project, rowsForProject(projectId, data));
}

export async function getBusinessDashboard(): Promise<BusinessDashboard> {
  const context = await requireContext();
  const data = await snapshot(context.organizationId);
  const projects = data.projects.map((project) => projectSummary(project, data));
  const leakage = new Map<string, number>();
  projects.forEach((project) => {
    if (project.company_id) leakage.set(project.company_id, (leakage.get(project.company_id) ?? 0) + project.potential_recovered_revenue);
  });
  return {
    leads: data.leads,
    auditRequests: data.auditRequests,
    projects,
    companies: data.companies.map((company) => ({ ...company, estimated_leakage: leakage.get(company.id) ?? 0 }))
      .sort((a, b) => b.estimated_leakage - a.estimated_leakage),
    totals: {
      leads: data.leads.length, audit_requests: data.auditRequests.length, projects: projects.length,
      potential_recovered_revenue: projects.reduce((sum, project) => sum + project.potential_recovered_revenue, 0),
      out_of_scope_count: projects.reduce((sum, project) => sum + project.out_of_scope_count, 0)
    }
  };
}

export async function getSalesTemplates() {
  const context = await requireContext();
  return (await snapshot(context.organizationId)).salesTemplates;
}
