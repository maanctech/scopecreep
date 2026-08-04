import { randomUUID } from "node:crypto";
import { mutateLocalStore, now, seedStore, writeLocalStore } from "@/lib/store/json/persistence";
import { findOrCreateCompany } from "@/lib/store/json/projections";
import { NotFoundError } from "@/lib/storeErrors";
import type { AuditRequest, Lead, LeadStatus, LeadStatusHistory, Project } from "@/lib/types";

export type LeadInput = {
  name: string;
  email: string;
  company: string;
  website?: string | null;
  business_type: string;
  team_size: string;
  average_project_value?: number | null;
  hourly_rate?: number | null;
  pain_point: string;
  consent_to_contact: boolean;
};

export type AuditRequestInput = {
  lead_id?: string | null;
  client_name: string;
  project_value?: number | null;
  hourly_rate: number;
  sow_text: string;
  message_export_text: string;
  suspected_scope_creep_notes?: string | null;
};

export type ProjectInput = {
  company_id?: string | null;
  lead_id?: string | null;
  audit_request_id?: string | null;
  client_name: string;
  project_name: string;
  hourly_rate: number;
  project_value?: number | null;
  sow_text: string;
};

export async function resetLocalDemoStore() {
  const seed = seedStore();

  await writeLocalStore(seed);

  return seed;
}

export async function createLead(input: LeadInput) {
  return mutateLocalStore((store) => {
    const company = findOrCreateCompany(store, {
      name: input.company,
      website: input.website,
      business_type: input.business_type,
      team_size: input.team_size
    });

    const lead: Lead = {
      id: randomUUID(),
      company_id: company.id,
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      company: input.company.trim(),
      website: input.website?.trim() || null,
      business_type: input.business_type.trim(),
      team_size: input.team_size.trim(),
      average_project_value: input.average_project_value ?? null,
      hourly_rate: input.hourly_rate ?? null,
      pain_point: input.pain_point.trim(),
      consent_to_contact: input.consent_to_contact,
      status: "New",
      created_at: now()
    };

    const history: LeadStatusHistory = {
      id: randomUUID(),
      lead_id: lead.id,
      from_status: null,
      to_status: "New",
      note: "Lead submitted free audit request.",
      created_at: now()
    };

    store.leads.unshift(lead);
    store.leadStatusHistory.unshift(history);

    return lead;
  });
}

export async function updateLeadStatus(input: { lead_id: string; status: LeadStatus; note?: string | null }) {
  return mutateLocalStore((store) => {
    const lead = store.leads.find((item) => item.id === input.lead_id);

    if (!lead) throw new Error("Lead not found.");

    const fromStatus = lead.status;

    lead.status = input.status;
    store.leadStatusHistory.unshift({
      id: randomUUID(),
      lead_id: lead.id,
      from_status: fromStatus,
      to_status: input.status,
      note: input.note?.trim() || null,
      created_at: now()
    });

    return lead;
  });
}

export async function createAuditRequest(input: AuditRequestInput) {
  return mutateLocalStore((store) => {
    const lead = input.lead_id ? store.leads.find((item) => item.id === input.lead_id) : null;

    if (input.lead_id && !lead) {
      throw new NotFoundError("Audit link is invalid or expired.");
    }

    const company = lead?.company_id
      ? store.companies.find((item) => item.id === lead.company_id) ?? null
      : findOrCreateCompany(store, {
          name: input.client_name,
          website: null,
          business_type: null,
          team_size: null
        });

    const auditRequest: AuditRequest = {
      id: randomUUID(),
      lead_id: lead?.id ?? null,
      company_id: company?.id ?? null,
      client_name: input.client_name.trim(),
      project_value: input.project_value ?? null,
      hourly_rate: input.hourly_rate,
      sow_text: input.sow_text.trim(),
      message_export_text: input.message_export_text.trim(),
      suspected_scope_creep_notes: input.suspected_scope_creep_notes?.trim() || null,
      status: "Submitted",
      created_at: now()
    };

    const project: Project = {
      id: randomUUID(),
      company_id: auditRequest.company_id,
      lead_id: auditRequest.lead_id,
      audit_request_id: auditRequest.id,
      client_name: auditRequest.client_name,
      project_name: `${auditRequest.client_name} Audit`,
      hourly_rate: auditRequest.hourly_rate,
      project_value: auditRequest.project_value,
      sow_text: auditRequest.sow_text,
      created_at: now(),
      is_demo: false
    };

    store.auditRequests.unshift(auditRequest);
    store.projects.unshift(project);

    if (lead) {
      const previousStatus = lead.status;

      lead.status = "Audit Running";
      store.leadStatusHistory.unshift({
        id: randomUUID(),
        lead_id: lead.id,
        from_status: previousStatus,
        to_status: "Audit Running",
        note: "Onboarding intake submitted.",
        created_at: now()
      });
    }

    return { auditRequest, project };
  });
}

export async function createProject(input: ProjectInput) {
  return mutateLocalStore((store) => {
    const project: Project = {
      id: randomUUID(),
      company_id: input.company_id ?? null,
      lead_id: input.lead_id ?? null,
      audit_request_id: input.audit_request_id ?? null,
      client_name: input.client_name.trim(),
      project_name: input.project_name.trim(),
      hourly_rate: input.hourly_rate,
      project_value: input.project_value ?? null,
      sow_text: input.sow_text.trim(),
      created_at: now(),
      is_demo: false
    };

    store.projects.unshift(project);

    return project;
  });
}
