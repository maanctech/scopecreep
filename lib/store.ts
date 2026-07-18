import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { buildDemoStore } from "@/lib/demoData";
import type {
  AnalysisInput,
  AuditRequest,
  BusinessDashboard,
  ClientMessage,
  Company,
  Lead,
  LeadStatus,
  LeadStatusHistory,
  MessageSource,
  MessageWithAnalysis,
  Project,
  ProjectDetail,
  ProjectSummary,
  Report,
  SalesTemplate,
  ScopeAnalysis,
  User
} from "@/lib/types";

type BusinessStore = {
  users: User[];
  companies: Company[];
  leads: Lead[];
  leadStatusHistory: LeadStatusHistory[];
  auditRequests: AuditRequest[];
  projects: Project[];
  clientMessages: ClientMessage[];
  scopeAnalyses: ScopeAnalysis[];
  reports: Report[];
  salesTemplates: SalesTemplate[];
};

type LeadInput = {
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

type AuditRequestInput = {
  lead_id?: string | null;
  client_name: string;
  project_value?: number | null;
  hourly_rate: number;
  sow_text: string;
  message_export_text: string;
  suspected_scope_creep_notes?: string | null;
};

type ProjectInput = {
  company_id?: string | null;
  lead_id?: string | null;
  audit_request_id?: string | null;
  client_name: string;
  project_name: string;
  hourly_rate: number;
  project_value?: number | null;
  sow_text: string;
};

const dataDir = path.join(process.cwd(), "data");
const dataFile = path.join(dataDir, "demo-store.json");
let mutationQueue: Promise<void> = Promise.resolve();

class LocalStoreFormatError extends Error {}

function now() {
  return new Date().toISOString();
}

function seedStore(): BusinessStore {
  return buildDemoStore();
}

function normalizeStore(value: Partial<BusinessStore>): BusinessStore {
  const seed = seedStore();

  return {
    users: Array.isArray(value.users) ? value.users : seed.users,
    companies: Array.isArray(value.companies) ? value.companies : seed.companies,
    leads: Array.isArray(value.leads) ? value.leads : seed.leads,
    leadStatusHistory: Array.isArray(value.leadStatusHistory)
      ? value.leadStatusHistory
      : seed.leadStatusHistory,
    auditRequests: Array.isArray(value.auditRequests) ? value.auditRequests : seed.auditRequests,
    projects: Array.isArray(value.projects) ? value.projects : seed.projects,
    clientMessages: Array.isArray(value.clientMessages) ? value.clientMessages : seed.clientMessages,
    scopeAnalyses: Array.isArray(value.scopeAnalyses) ? value.scopeAnalyses : seed.scopeAnalyses,
    reports: Array.isArray(value.reports) ? value.reports : seed.reports,
    salesTemplates: Array.isArray(value.salesTemplates) ? value.salesTemplates : seed.salesTemplates
  };
}

async function readLocalStore(): Promise<BusinessStore> {
  try {
    const raw = await fs.readFile(dataFile, "utf8");
    const parsed = JSON.parse(raw) as Partial<BusinessStore>;

    if (!parsed || typeof parsed !== "object") {
      throw new LocalStoreFormatError("Local store must be an object.");
    }

    return normalizeStore(parsed);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      const seed = seedStore();
      await writeLocalStore(seed);
      return seed;
    }

    if (error instanceof SyntaxError || error instanceof LocalStoreFormatError) {
      await fs.mkdir(dataDir, { recursive: true });
      const backupFile = path.join(dataDir, `demo-store.corrupt-${Date.now()}.json`);
      await fs.rename(dataFile, backupFile).catch(() => undefined);
      const seed = seedStore();
      await writeLocalStore(seed);
      return seed;
    }

    throw error;
  }
}

async function writeLocalStore(store: BusinessStore) {
  await fs.mkdir(dataDir, { recursive: true });
  const tempFile = path.join(dataDir, `demo-store.${process.pid}.${Date.now()}.${randomUUID()}.tmp`);
  await fs.writeFile(tempFile, JSON.stringify(store, null, 2));
  await fs.rename(tempFile, dataFile);
}

async function mutateLocalStore<T>(mutator: (store: BusinessStore) => T | Promise<T>) {
  const operation = mutationQueue.then(async () => {
    const store = await readLocalStore();
    const result = await mutator(store);
    await writeLocalStore(store);
    return result;
  });

  mutationQueue = operation.then(
    () => undefined,
    () => undefined
  );

  return operation;
}

function analysisRevenue(analysis: ScopeAnalysis | null) {
  if (!analysis || analysis.classification === "In Scope") return 0;
  return analysis.estimated_revenue;
}

function rowsForProject(projectId: string, store: BusinessStore): MessageWithAnalysis[] {
  const analysisByMessageId = new Map(
    store.scopeAnalyses.map((analysis) => [analysis.client_message_id, analysis])
  );

  return store.clientMessages
    .filter((message) => message.project_id === projectId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((message) => ({
      message,
      analysis: analysisByMessageId.get(message.id) ?? null
    }));
}

function summarizeProject(project: Project, store: BusinessStore): ProjectSummary {
  const rows = rowsForProject(project.id, store);
  return {
    ...project,
    messages_analyzed: rows.filter((row) => row.analysis).length,
    out_of_scope_count: rows.filter((row) => row.analysis?.classification === "Out of Scope").length,
    potential_recovered_revenue: rows.reduce((sum, row) => sum + analysisRevenue(row.analysis), 0)
  };
}

function findOrCreateCompany(store: BusinessStore, input: {
  name: string;
  website?: string | null;
  business_type?: string | null;
  team_size?: string | null;
}) {
  const normalizedName = input.name.trim().toLowerCase();
  const existing = store.companies.find((company) => company.name.trim().toLowerCase() === normalizedName);
  if (existing) return existing;

  const company: Company = {
    id: randomUUID(),
    name: input.name.trim(),
    website: input.website?.trim() || null,
    business_type: input.business_type?.trim() || null,
    team_size: input.team_size?.trim() || null,
    created_at: now()
  };
  store.companies.unshift(company);
  return company;
}

function buildReportMarkdown(input: { project: Project; rows: MessageWithAnalysis[] }) {
  const analyzed = input.rows.filter((row) => row.analysis);
  const flagged = analyzed
    .filter((row) => row.analysis && row.analysis.classification !== "In Scope")
    .sort((a, b) => (b.analysis?.estimated_revenue ?? 0) - (a.analysis?.estimated_revenue ?? 0));
  const top = flagged.slice(0, 5);
  const total = analyzed.reduce((sum, row) => sum + analysisRevenue(row.analysis), 0);
  const outOfScope = analyzed.filter((row) => row.analysis?.classification === "Out of Scope").length;

  const opportunities = top
    .map((row, index) => {
      const analysis = row.analysis;
      if (!analysis) return "";
      const evidence = analysis.relevant_sow_sections.map((item) => `  - ${item}`).join("\n") || "  - No SOW evidence returned.";
      return `### ${index + 1}. ${analysis.classification}: ${row.message.message_text}

- Estimated hours: ${analysis.estimated_hours}
- Potential revenue: $${analysis.estimated_revenue.toLocaleString()}
- Request type: ${analysis.request_type}
- Reasoning: ${analysis.reasoning}
- SOW evidence:
${evidence}
- Suggested change order:
${analysis.suggested_change_order}`;
    })
    .filter(Boolean)
    .join("\n\n");

  return `# Scope Creep Revenue Leakage Audit

Client: ${input.project.client_name}
Project: ${input.project.project_name}
Hourly rate: $${input.project.hourly_rate}/hour

## Executive Summary

This audit reviewed ${analyzed.length} client message${analyzed.length === 1 ? "" : "s"} against the supplied Statement of Work. It found ${outOfScope} out-of-scope request${outOfScope === 1 ? "" : "s"} and an estimated $${total.toLocaleString()} in potential revenue leakage.

## Totals

- Total potential revenue leakage: $${total.toLocaleString()}
- Analyzed messages: ${analyzed.length}
- Out-of-scope requests: ${outOfScope}

## Top Missed Billing Opportunities

${opportunities || "No missed billing opportunities were found in the analyzed messages."}

## Recommended Next Steps

1. Review each flagged request with the project manager.
2. Validate estimated hours before discussing pricing with the client.
3. Send change-order language only after internal approval.
4. Track similar requests weekly during active delivery.

## Suggested Monthly Monitoring Plan

- Weekly review of client requests from Slack, email, and project-management exports.
- Monthly leakage summary by project and request type.
- Change-order draft support for validated out-of-scope work.
- Recommended pilot: $1,500 setup + $750/month monitoring, or 10-20% of validated recovered revenue.`;
}

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
      created_at: now()
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
      created_at: now()
    };

    store.projects.unshift(project);
    return project;
  });
}

export async function getAppDashboard() {
  const store = await readLocalStore();
  const projects = store.projects.map((project) => summarizeProject(project, store));
  return {
    projects,
    totals: {
      projects: projects.length,
      messages_analyzed: projects.reduce((sum, project) => sum + project.messages_analyzed, 0),
      out_of_scope_count: projects.reduce((sum, project) => sum + project.out_of_scope_count, 0),
      potential_recovered_revenue: projects.reduce(
        (sum, project) => sum + project.potential_recovered_revenue,
        0
      )
    }
  };
}

export async function getProjectDetail(projectId: string): Promise<ProjectDetail | null> {
  const store = await readLocalStore();
  const project = store.projects.find((item) => item.id === projectId);
  if (!project) return null;
  return { project, messages: rowsForProject(project.id, store) };
}

export async function saveMessageWithAnalysis(input: {
  project_id: string;
  source: MessageSource;
  sender?: string | null;
  message_text: string;
  message_date?: string | null;
  analysis: AnalysisInput;
}) {
  return mutateLocalStore((store) => {
    const project = store.projects.find((item) => item.id === input.project_id);
    if (!project) throw new Error("Project not found.");

    const message: ClientMessage = {
      id: randomUUID(),
      project_id: project.id,
      source: input.source,
      sender: input.sender?.trim() || null,
      message_text: input.message_text.trim(),
      message_date: input.message_date || null,
      created_at: now()
    };

    const analysis: ScopeAnalysis = {
      id: randomUUID(),
      client_message_id: message.id,
      created_at: now(),
      ...input.analysis
    };

    store.clientMessages.unshift(message);
    store.scopeAnalyses.unshift(analysis);
    return { message, analysis };
  });
}

export async function getAuditReport(projectId: string) {
  return mutateLocalStore((store) => {
    const project = store.projects.find((item) => item.id === projectId);
    if (!project) return null;

    const rows = rowsForProject(project.id, store);
    const markdown = buildReportMarkdown({ project, rows });
    const analyzed = rows.filter((row) => row.analysis);
    const total = analyzed.reduce((sum, row) => sum + analysisRevenue(row.analysis), 0);
    const outOfScope = analyzed.filter((row) => row.analysis?.classification === "Out of Scope").length;

    const report: Report = {
      id: randomUUID(),
      project_id: project.id,
      title: `${project.client_name} Scope Creep Audit`,
      markdown,
      total_revenue_leakage: total,
      analyzed_messages_count: analyzed.length,
      out_of_scope_count: outOfScope,
      created_at: now()
    };

    store.reports = [report, ...store.reports.filter((item) => item.project_id !== project.id)];
    return { report, project, messages: rows };
  });
}

export async function getBusinessDashboard(): Promise<BusinessDashboard> {
  const store = await readLocalStore();
  const projects = store.projects.map((project) => summarizeProject(project, store));
  const leakageByCompany = new Map<string, number>();

  for (const project of projects) {
    if (!project.company_id) continue;
    leakageByCompany.set(
      project.company_id,
      (leakageByCompany.get(project.company_id) ?? 0) + project.potential_recovered_revenue
    );
  }

  return {
    leads: store.leads.slice().sort((a, b) => b.created_at.localeCompare(a.created_at)),
    auditRequests: store.auditRequests.slice().sort((a, b) => b.created_at.localeCompare(a.created_at)),
    projects,
    companies: store.companies
      .map((company) => ({
        ...company,
        estimated_leakage: leakageByCompany.get(company.id) ?? 0
      }))
      .sort((a, b) => b.estimated_leakage - a.estimated_leakage),
    totals: {
      leads: store.leads.length,
      audit_requests: store.auditRequests.length,
      projects: store.projects.length,
      potential_recovered_revenue: projects.reduce(
        (sum, project) => sum + project.potential_recovered_revenue,
        0
      ),
      out_of_scope_count: projects.reduce((sum, project) => sum + project.out_of_scope_count, 0)
    }
  };
}

export async function getSalesTemplates(): Promise<SalesTemplate[]> {
  const store = await readLocalStore();
  return store.salesTemplates;
}
