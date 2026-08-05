import { dollars, iso, number, type DbRow } from "@/lib/store/postgres/client";
import type {
  AuditRequest,
  BillingEvent,
  ClientMessage,
  Company,
  Lead,
  MessageSource,
  Project,
  Report,
  ReportType,
  ScopeFinding,
} from "@/lib/types";

export function mapCompany(row: DbRow): Company {
  return {
    id: String(row.id),
    name: String(row.name),
    website: row.website ? String(row.website) : null,
    business_type: row.business_type ? String(row.business_type) : null,
    team_size: row.team_size ? String(row.team_size) : null,
    created_at: iso(row.created_at),
  };
}

export function mapLead(row: DbRow): Lead {
  return {
    id: String(row.id),
    company_id: row.company_id ? String(row.company_id) : null,
    name: String(row.name),
    email: String(row.email),
    company: String(row.company),
    website: row.website ? String(row.website) : null,
    business_type: String(row.business_type),
    team_size: String(row.team_size),
    average_project_value:
      row.average_project_value_cents == null
        ? null
        : dollars(row.average_project_value_cents),
    hourly_rate:
      row.hourly_rate_cents == null ? null : dollars(row.hourly_rate_cents),
    pain_point: String(row.pain_point),
    consent_to_contact: Boolean(row.consent_to_contact),
    status: row.status as Lead["status"],
    created_at: iso(row.created_at),
  };
}

export function mapAuditRequest(row: DbRow): AuditRequest {
  return {
    id: String(row.id),
    lead_id: row.lead_id ? String(row.lead_id) : null,
    company_id: row.company_id ? String(row.company_id) : null,
    client_name: String(row.client_name),
    project_value:
      row.project_value_cents == null ? null : dollars(row.project_value_cents),
    hourly_rate: dollars(row.hourly_rate_cents),
    sow_text: String(row.sow_text),
    message_export_text: String(row.message_export_text),
    suspected_scope_creep_notes: row.suspected_scope_creep_notes
      ? String(row.suspected_scope_creep_notes)
      : null,
    status: row.status as AuditRequest["status"],
    created_at: iso(row.created_at),
  };
}

export function mapProject(row: DbRow): Project {
  return {
    id: String(row.id),
    company_id: row.company_id ? String(row.company_id) : null,
    lead_id: row.lead_id ? String(row.lead_id) : null,
    audit_request_id: row.audit_request_id
      ? String(row.audit_request_id)
      : null,
    client_name: String(row.client_name),
    project_name: String(row.project_name),
    hourly_rate: dollars(row.hourly_rate_cents),
    project_value:
      row.project_value_cents == null ? null : dollars(row.project_value_cents),
    sow_text: String(row.sow_text ?? row.legacy_sow_text ?? ""),
    active_sow_version_id: row.active_sow_version_id
      ? String(row.active_sow_version_id)
      : null,
    active_boundary_map_id: row.active_boundary_map_id
      ? String(row.active_boundary_map_id)
      : null,
    created_at: iso(row.created_at),
    is_demo: Boolean(row.is_demo),
  };
}

export function mapMessage(row: DbRow): ClientMessage {
  return {
    id: String(row.id),
    project_id: String(row.project_id),
    source: row.source as MessageSource,
    sender: row.sender ? String(row.sender) : null,
    message_text: String(row.message_text),
    message_date: row.message_date ? iso(row.message_date) : null,
    created_at: iso(row.created_at),
  };
}

export function jsonStrings(value: unknown): string[] {
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

export function mapFinding(row: DbRow): ScopeFinding {
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
    is_demo: Boolean(row.is_demo),
  };
}

export function mapEvent(row: DbRow): BillingEvent {
  return {
    id: String(row.id),
    project_id: String(row.project_id),
    scope_finding_id: String(row.scope_finding_id),
    event_type: row.event_type as BillingEvent["event_type"],
    amount_cents: number(row.amount_cents),
    previous_amount_cents: number(row.previous_amount_cents),
    new_amount_cents: number(row.new_amount_cents),
    previous_status: (row.previous_status ||
      null) as BillingEvent["previous_status"],
    new_status: (row.new_status || null) as BillingEvent["new_status"],
    previous_decision: (row.previous_decision ||
      null) as BillingEvent["previous_decision"],
    new_decision: (row.new_decision || null) as BillingEvent["new_decision"],
    note: row.note ? String(row.note) : null,
    actor: String(row.actor_label),
    created_at: iso(row.created_at),
    is_demo: Boolean(row.is_demo),
  };
}

export function mapReport(row: DbRow): Report {
  return {
    id: String(row.version_id ?? row.id),
    project_id: String(row.project_id),
    title:
      row.client_name && row.report_type
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
    source_finding_ids: Array.isArray(row.source_finding_ids)
      ? row.source_finding_ids.map(String)
      : [],
    analysis_references: Array.isArray(row.analysis_references)
      ? (row.analysis_references as Report["analysis_references"])
      : [],
    content_sha256: row.content_sha256 ? String(row.content_sha256) : null,
    csv_content: String(row.csv_content || ""),
    csv_sha256: row.csv_sha256 ? String(row.csv_sha256) : null,
  };
}
