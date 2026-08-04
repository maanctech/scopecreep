import type { AuditRequest, Company, Lead, LeadStatusHistory, Project, User } from "@/lib/types";
import {
  DEMO_AUDIT_REQUEST_ID,
  DEMO_COMPANY_ID,
  DEMO_LEAD_ID,
  DEMO_PROJECT_ID,
  DEMO_USER_ID,
  SAMPLE_SOW,
  createdAt
} from "@/lib/demo/constants";
import { messageExportText } from "@/lib/demo/messages";

export const demoUser: User = {
  id: DEMO_USER_ID,
  email: "founder@scopeaudit.test",
  company_name: "Scope Creep Revenue Recovery",
  created_at: createdAt
};

export const demoCompany: Company = {
  id: DEMO_COMPANY_ID,
  name: "Northstar Digital Studio",
  website: "https://northstardigital.studio",
  business_type: "Agency",
  team_size: "11-25",
  created_at: createdAt
};

export const demoLead: Lead = {
  id: DEMO_LEAD_ID,
  company_id: DEMO_COMPANY_ID,
  name: "Maya Chen",
  email: "maya@northstardigital.studio",
  company: "Northstar Digital Studio",
  website: "https://northstardigital.studio",
  business_type: "Agency",
  team_size: "11-25",
  average_project_value: 48000,
  hourly_rate: 175,
  pain_point:
    "Senior clients add small-sounding website requests during delivery, and PMs struggle to decide what needs a change order before the team starts building.",
  consent_to_contact: true,
  status: "Audit Running",
  created_at: createdAt
};

export const demoLeadStatusHistory: LeadStatusHistory[] = [
  {
    id: "99999999-1111-4111-8111-111111111111",
    lead_id: DEMO_LEAD_ID,
    from_status: null,
    to_status: "New",
    note: "Seed lead created.",
    created_at: createdAt
  },
  {
    id: "99999999-2222-4222-8222-222222222222",
    lead_id: DEMO_LEAD_ID,
    from_status: "New",
    to_status: "Audit Running",
    note: "Demo audit in progress.",
    created_at: createdAt
  }
];

export const demoAuditRequest: AuditRequest = {
  id: DEMO_AUDIT_REQUEST_ID,
  lead_id: DEMO_LEAD_ID,
  company_id: DEMO_COMPANY_ID,
  client_name: "ApertureOps",
  project_value: 48000,
  hourly_rate: 175,
  sow_text: SAMPLE_SOW,
  message_export_text: messageExportText,
  suspected_scope_creep_notes:
    "The ROI calculator, HubSpot workflow, SEO content, localization, and login area were all requested casually after the fixed-fee SOW was approved.",
  status: "Analyzed",
  created_at: createdAt
};

export const demoProject: Project = {
  id: DEMO_PROJECT_ID,
  company_id: DEMO_COMPANY_ID,
  lead_id: DEMO_LEAD_ID,
  audit_request_id: DEMO_AUDIT_REQUEST_ID,
  client_name: "ApertureOps",
  project_name: "$48,000 B2B SaaS Website Redesign",
  hourly_rate: 175,
  project_value: 48000,
  sow_text: SAMPLE_SOW,
  created_at: createdAt,
  is_demo: true
};
