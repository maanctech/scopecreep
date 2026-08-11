// Generated from constants/json by `npm run constants:generate`. Do not edit.

export const CLASSIFICATIONS = [
  "In Scope",
  "Possibly In Scope",
  "Out of Scope",
  "Needs Human Review"
] as const;

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

export const MESSAGE_SOURCES = [
  "Slack",
  "Email",
  "Zoom",
  "Asana",
  "Jira",
  "Other"
] as const;

export const LEAD_STATUSES = [
  "New",
  "Contacted",
  "Audit Running",
  "Proposal Sent",
  "Closed Won",
  "Closed Lost"
] as const;

export const AUDIT_REQUEST_STATUSES = [
  "Submitted",
  "In Review",
  "Analyzed"
] as const;

export const SALES_TEMPLATE_TYPES = [
  "Cold Email",
  "LinkedIn DM",
  "Discovery Call Script",
  "Audit Reveal Call Script",
  "Proposal Template",
  "Follow-up Email",
  "Objection Handling"
] as const;

export const BILLING_DECISIONS = [
  "Undecided",
  "Bill Separately",
  "Include In Retainer",
  "Absorb Courtesy",
  "Discuss With Client",
  "Reject Finding"
] as const;

export const WORKFLOW_STATUSES = [
  "New",
  "Needs Review",
  "Decided",
  "Discussing",
  "Invoiced",
  "Paid",
  "Closed"
] as const;

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

export const REPORT_TYPES = [
  "Internal Scope Audit",
  "Finding Summary",
  "Revenue Leakage Report",
  "Client Discussion Brief",
  "Change Order Draft",
  "Invoice Support Summary"
] as const;
