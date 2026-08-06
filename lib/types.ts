export const CLASSIFICATIONS = [
  "In Scope",
  "Possibly In Scope",
  "Out of Scope",
  "Needs Human Review"
] as const;

export type Classification = (typeof CLASSIFICATIONS)[number];

export const REQUEST_TYPES = [
  "New Deliverable",
  "Revision",
  "Support",
  "Strategy",
  "Design",
  "Engineering",
  "Admin",
  "Other"
] as const;

export type RequestType = (typeof REQUEST_TYPES)[number];

export const MESSAGE_SOURCES = [
  "Slack",
  "Email",
  "Zoom",
  "Asana",
  "Jira",
  "Other"
] as const;

export type MessageSource = (typeof MESSAGE_SOURCES)[number];

export const LEAD_STATUSES = [
  "New",
  "Contacted",
  "Audit Running",
  "Proposal Sent",
  "Closed Won",
  "Closed Lost"
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const SALES_TEMPLATE_TYPES = [
  "Cold Email",
  "LinkedIn DM",
  "Discovery Call Script",
  "Audit Reveal Call Script",
  "Proposal Template",
  "Follow-up Email",
  "Objection Handling"
] as const;

export type SalesTemplateType = (typeof SALES_TEMPLATE_TYPES)[number];

export type User = {
  id: string;
  email: string;
  company_name: string | null;
  created_at: string;
};

export type Company = {
  id: string;
  name: string;
  website: string | null;
  business_type: string | null;
  team_size: string | null;
  created_at: string;
};

export type Lead = {
  id: string;
  company_id: string | null;
  name: string;
  email: string;
  company: string;
  website: string | null;
  business_type: string;
  team_size: string;
  average_project_value: number | null;
  hourly_rate: number | null;
  pain_point: string;
  consent_to_contact: boolean;
  status: LeadStatus;
  created_at: string;
};

export type LeadStatusHistory = {
  id: string;
  lead_id: string;
  from_status: LeadStatus | null;
  to_status: LeadStatus;
  note: string | null;
  created_at: string;
};

export type AuditRequest = {
  id: string;
  lead_id: string | null;
  company_id: string | null;
  client_name: string;
  project_value: number | null;
  hourly_rate: number;
  sow_text: string;
  message_export_text: string;
  suspected_scope_creep_notes: string | null;
  status: "Submitted" | "In Review" | "Analyzed";
  created_at: string;
};

export type AuditIntakeToken = {
  id: string;
  lead_id: string;
  token_sha256: string;
  expires_at: string;
  consumed_at: string | null;
  created_at: string;
};

export type BusinessSettings = {
  publicLeadCapture: boolean;
};

export type Project = {
  id: string;
  company_id: string | null;
  lead_id: string | null;
  audit_request_id: string | null;
  client_name: string;
  project_name: string;
  hourly_rate: number;
  project_value: number | null;
  sow_text: string;
  active_sow_version_id?: string | null;
  active_boundary_map_id?: string | null;
  created_at: string;
  /** True for the fictional Northstar/ApertureOps demonstration project. */
  is_demo: boolean;
};

export type ClientMessage = {
  id: string;
  project_id: string;
  source: MessageSource;
  sender: string | null;
  message_text: string;
  message_date: string | null;
  created_at: string;
};

export const BILLING_DECISIONS = [
  "Undecided",
  "Bill Separately",
  "Include In Retainer",
  "Absorb Courtesy",
  "Discuss With Client",
  "Reject Finding"
] as const;

export type BillingDecision = (typeof BILLING_DECISIONS)[number];

/**
 * Internal workflow statuses. The status can never contradict the billing
 * decision because both are only ever changed together through the single
 * transition service in lib/domain/findingTransitions.ts.
 *
 * - New: finding just created, not yet surfaced for review (in-scope findings stay here).
 * - Needs Review: flagged finding waiting for a human billing decision.
 * - Decided: a billing decision was made (Bill Separately or Include In Retainer).
 * - Discussing: the professional chose to discuss the finding with the client first.
 * - Invoiced: the professional recorded that they invoiced the client themselves.
 * - Paid: the professional recorded that the invoice was paid. Internal tracking only.
 * - Closed: terminal state for rejected or courtesy-absorbed findings.
 *
 * "Archived" from the Phase 1 suggestion list was intentionally deferred: no
 * Phase 1 action produces it, and keeping unreachable states in the model
 * would make the transition table dishonest.
 */
export const WORKFLOW_STATUSES = [
  "New",
  "Needs Review",
  "Decided",
  "Discussing",
  "Invoiced",
  "Paid",
  "Closed"
] as const;

export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];

/**
 * A Scope Finding is the reviewed, human-controlled evolution of the old
 * AI-only ScopeAnalysis record. It keeps every AI-produced field and adds the
 * professional's billing decision, workflow status, approved amounts, and
 * review metadata.
 *
 * Money units:
 * - estimated_revenue is a LEGACY value stored in DOLLARS (AI suggestion,
 *   "potential revenue"). It is never mixed with approved amounts.
 * - approved_amount_cents is stored in INTEGER CENTS and is the only value
 *   used for approved/invoiced/paid totals.
 */
export type ScopeFinding = {
  id: string;
  project_id: string;
  client_message_id: string;
  classification: Classification;
  confidence_score: number;
  reasoning: string;
  relevant_sow_sections: string[];
  request_type: RequestType;
  estimated_hours: number;
  /** Legacy AI-estimated potential revenue in DOLLARS. Not billable as-is. */
  estimated_revenue: number;
  suggested_change_order: string;
  billing_decision: BillingDecision;
  workflow_status: WorkflowStatus;
  /** Human-approved hours. Null until the professional makes a billing decision. */
  approved_hours: number | null;
  /** Human-approved amount in INTEGER CENTS. Null until a billing decision. */
  approved_amount_cents: number | null;
  /** Editable client-facing draft. Nothing is ever sent automatically. */
  client_facing_explanation: string;
  internal_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  /** Optimistic-concurrency version. Stale updates are rejected with 409. */
  version: number;
  /** True for fictional Northstar/ApertureOps demonstration records. */
  is_demo: boolean;
};

export type AnalysisInput = Pick<
  ScopeFinding,
  | "classification"
  | "confidence_score"
  | "reasoning"
  | "relevant_sow_sections"
  | "request_type"
  | "estimated_hours"
  | "estimated_revenue"
  | "suggested_change_order"
  | "internal_note"
>;

export const BILLING_EVENT_TYPES = [
  "Finding Created",
  "Estimate Updated",
  "Decision Updated",
  "Approved Internally",
  "Discussing With Client",
  "Included In Retainer",
  "Invoiced",
  "Paid",
  "Absorbed",
  "Rejected",
  "Reopened"
] as const;

export type BillingEventType = (typeof BILLING_EVENT_TYPES)[number];

/**
 * Append-only billing history. Events are only ever created; normal store
 * operations never edit or delete them.
 */
export type BillingEvent = {
  id: string;
  project_id: string;
  scope_finding_id: string;
  event_type: BillingEventType;
  /** Approved amount in cents at the time of the event, when relevant. */
  amount_cents: number | null;
  previous_amount_cents: number | null;
  new_amount_cents: number | null;
  previous_status: WorkflowStatus | null;
  new_status: WorkflowStatus | null;
  previous_decision: BillingDecision | null;
  new_decision: BillingDecision | null;
  note: string | null;
  actor: string;
  created_at: string;
  is_demo: boolean;
};

export type Report = {
  id: string;
  project_id: string;
  title: string;
  markdown: string;
  total_revenue_leakage: number;
  analyzed_messages_count: number;
  out_of_scope_count: number;
  created_at: string;
  report_type?: ReportType;
  version_number?: number;
  sow_version_id?: string | null;
  source_finding_ids?: string[];
  analysis_references?: Array<{ provider: string; model: string; promptVersion: string }>;
  content_sha256?: string | null;
  csv_content?: string;
  csv_sha256?: string | null;
};

export const REPORT_TYPES = [
  "Internal Scope Audit",
  "Finding Summary",
  "Revenue Leakage Report",
  "Client Discussion Brief",
  "Change Order Draft",
  "Invoice Support Summary",
  "Weekly Monitoring Summary"
] as const;

export type ReportType = (typeof REPORT_TYPES)[number];

export function reportSupportsCsv(reportType: ReportType | undefined) {
  return reportType !== "Weekly Monitoring Summary";
}

export type SalesTemplate = {
  id: string;
  template_type: SalesTemplateType;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
};

export type MessageWithFinding = {
  message: ClientMessage;
  finding: ScopeFinding | null;
};

export type ProjectDetail = {
  project: Project;
  messages: MessageWithFinding[];
};

export type ProjectSummary = Project & {
  messages_analyzed: number;
  out_of_scope_count: number;
  potential_recovered_revenue: number;
};

export type FindingWithContext = {
  finding: ScopeFinding;
  message: ClientMessage | null;
  project: Project | null;
};

export type BillingEventWithContext = {
  event: BillingEvent;
  finding: ScopeFinding | null;
  project: Project | null;
};

export type BusinessDashboard = {
  leads: Lead[];
  auditRequests: AuditRequest[];
  projects: ProjectSummary[];
  companies: Array<Company & { estimated_leakage: number }>;
  totals: {
    leads: number;
    audit_requests: number;
    projects: number;
    potential_recovered_revenue: number;
    out_of_scope_count: number;
  };
};
