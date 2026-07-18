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
  created_at: string;
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

export type ScopeAnalysis = {
  id: string;
  client_message_id: string;
  classification: Classification;
  confidence_score: number;
  reasoning: string;
  relevant_sow_sections: string[];
  request_type: RequestType;
  estimated_hours: number;
  estimated_revenue: number;
  suggested_change_order: string;
  internal_note: string | null;
  created_at: string;
};

export type AnalysisInput = Omit<ScopeAnalysis, "id" | "client_message_id" | "created_at">;

export type Report = {
  id: string;
  project_id: string;
  title: string;
  markdown: string;
  total_revenue_leakage: number;
  analyzed_messages_count: number;
  out_of_scope_count: number;
  created_at: string;
};

export type SalesTemplate = {
  id: string;
  template_type: SalesTemplateType;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
};

export type MessageWithAnalysis = {
  message: ClientMessage;
  analysis: ScopeAnalysis | null;
};

export type ProjectDetail = {
  project: Project;
  messages: MessageWithAnalysis[];
};

export type ProjectSummary = Project & {
  messages_analyzed: number;
  out_of_scope_count: number;
  potential_recovered_revenue: number;
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
