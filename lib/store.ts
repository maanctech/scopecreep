import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { buildDemoStore } from "@/lib/demoData";
import {
  applyFindingAction,
  TransitionError,
  type FindingActionName
} from "@/lib/domain/findingTransitions";
import { assertIntegerCents, formatCents, formatDollars } from "@/lib/domain/money";
import {
  computeRevenueTotals,
  emptyRevenueTotals,
  type RevenueTotals
} from "@/lib/domain/revenueTotals";
import {
  LocalStoreFormatError,
  migrateStoreShape,
  type BusinessStore
} from "@/lib/migrations/localStore";
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
  LeadStatusHistory,
  MessageSource,
  MessageWithFinding,
  Project,
  ProjectDetail,
  ProjectSummary,
  Report,
  SalesTemplate,
  ScopeFinding
} from "@/lib/types";
import { LocalStoreCorruptError, NotFoundError, VersionConflictError } from "@/lib/storeErrors";
import type { AnalysisMetadata } from "@/lib/ai/types";
import { usePostgresStorage } from "@/lib/runtimeStorage";
import * as postgresStore from "@/lib/postgresStore";

export { LocalStoreCorruptError, NotFoundError, VersionConflictError } from "@/lib/storeErrors";

/**
 * Single-operator local MVP: there is no authentication yet, so every human
 * change is recorded with this actor label. Real per-user attribution
 * requires the authentication work that is explicitly out of Phase 1 scope.
 */
export const PROFESSIONAL_ACTOR = "Professional";

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

/** Raised when local JSON exists but cannot be safely used. */

function now() {
  return new Date().toISOString();
}

function seedStore(): BusinessStore {
  return buildDemoStore() as BusinessStore;
}

async function backupStoreFile(prefix: string): Promise<string> {
  const backupFile = path.join(dataDir, `demo-store.${prefix}-${Date.now()}.json`);
  await fs.copyFile(dataFile, backupFile);
  return backupFile;
}

/**
 * Reads the local store, migrating older schema versions in place.
 *
 * Policies:
 * - Missing file: seed the fictional demo store (nothing is lost).
 * - Older schema: back up the original file, then persist the migrated copy.
 * - Corrupt or unusable file: back it up and throw a visible error. Real
 *   data is NEVER silently replaced with demo data.
 */
async function readLocalStore(): Promise<BusinessStore> {
  let raw: string;
  try {
    raw = await fs.readFile(dataFile, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      const seed = seedStore();
      await writeLocalStore(seed);
      return seed;
    }
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const backupFile = await backupStoreFile("corrupt");
    throw new LocalStoreCorruptError(
      `The local data file is not valid JSON. It was backed up to ${backupFile}. Restore it manually or run "npm run seed" to start over with demo data.`
    );
  }

  try {
    const { store, migrated } = migrateStoreShape(parsed);
    if (migrated) {
      await backupStoreFile("pre-migration-backup");
      await writeLocalStore(store);
    }
    return store;
  } catch (error) {
    if (error instanceof LocalStoreFormatError) {
      const backupFile = await backupStoreFile("unreadable");
      throw new LocalStoreCorruptError(
        `The local data file could not be read (${error.message}) It was backed up to ${backupFile}. Restore it manually or run "npm run seed" to start over with demo data.`
      );
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

/** Legacy dollars: potential revenue of one flagged finding. */
function findingPotential(finding: ScopeFinding | null) {
  if (!finding || finding.classification === "In Scope") return 0;
  return finding.estimated_revenue;
}

function rowsForProject(projectId: string, store: BusinessStore): MessageWithFinding[] {
  const findingByMessageId = new Map(
    store.scopeFindings.map((finding) => [finding.client_message_id, finding])
  );

  return store.clientMessages
    .filter((message) => message.project_id === projectId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((message) => ({
      message,
      finding: findingByMessageId.get(message.id) ?? null
    }));
}

function summarizeProject(project: Project, store: BusinessStore): ProjectSummary {
  const rows = rowsForProject(project.id, store);
  return {
    ...project,
    messages_analyzed: rows.filter((row) => row.finding).length,
    out_of_scope_count: rows.filter((row) => row.finding?.classification === "Out of Scope").length,
    potential_recovered_revenue: rows.reduce((sum, row) => sum + findingPotential(row.finding), 0)
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

/** Newest first; equal timestamps fall back to append order (later = newer). */
function sortEventsNewestFirst(events: BillingEvent[]): BillingEvent[] {
  return events
    .map((event, index) => ({ event, index }))
    .sort((a, b) => {
      const byDate = b.event.created_at.localeCompare(a.event.created_at);
      return byDate !== 0 ? byDate : b.index - a.index;
    })
    .map((item) => item.event);
}

function withFindingContext(finding: ScopeFinding, store: BusinessStore): FindingWithContext {
  return {
    finding,
    message: store.clientMessages.find((message) => message.id === finding.client_message_id) ?? null,
    project: store.projects.find((project) => project.id === finding.project_id) ?? null
  };
}

function withEventContext(event: BillingEvent, store: BusinessStore): BillingEventWithContext {
  return {
    event,
    finding: store.scopeFindings.find((finding) => finding.id === event.scope_finding_id) ?? null,
    project: store.projects.find((project) => project.id === event.project_id) ?? null
  };
}

function buildReportMarkdown(input: { project: Project; rows: MessageWithFinding[] }) {
  const analyzed = input.rows.filter((row) => row.finding);
  const findings = analyzed
    .map((row) => row.finding)
    .filter((finding): finding is ScopeFinding => Boolean(finding));
  const flagged = analyzed
    .filter((row) => row.finding && row.finding.classification !== "In Scope")
    .sort((a, b) => (b.finding?.estimated_revenue ?? 0) - (a.finding?.estimated_revenue ?? 0));
  const top = flagged.slice(0, 5);
  const total = analyzed.reduce((sum, row) => sum + findingPotential(row.finding), 0);
  const outOfScope = analyzed.filter((row) => row.finding?.classification === "Out of Scope").length;
  const totals = computeRevenueTotals(findings);

  const opportunities = top
    .map((row, index) => {
      const finding = row.finding;
      if (!finding) return "";
      const evidence = finding.relevant_sow_sections.map((item) => `  - ${item}`).join("\n") || "  - No SOW evidence returned.";
      return `### ${index + 1}. ${finding.classification}: ${row.message.message_text}

- Estimated hours: ${finding.estimated_hours}
- Potential revenue: ${formatDollars(finding.estimated_revenue)}
- Request type: ${finding.request_type}
- Review status: ${finding.billing_decision === "Undecided" ? "Needs review" : `${finding.billing_decision} (${finding.workflow_status})`}
- Reasoning: ${finding.reasoning}
- SOW evidence:
${evidence}
- Suggested change order:
${finding.suggested_change_order}`;
    })
    .filter(Boolean)
    .join("\n\n");

  return `# Scope Creep Revenue Leakage Audit

Client: ${input.project.client_name}
Project: ${input.project.project_name}
Hourly rate: $${input.project.hourly_rate}/hour

## Executive Summary

This audit reviewed ${analyzed.length} client message${analyzed.length === 1 ? "" : "s"} against the supplied Statement of Work. It found ${outOfScope} out-of-scope request${outOfScope === 1 ? "" : "s"} and an estimated ${formatDollars(total)} in potential revenue leakage.

## Totals

- Total potential revenue leakage: ${formatDollars(total)}
- Analyzed messages: ${analyzed.length}
- Out-of-scope requests: ${outOfScope}

## Billing Review Status

Potential values are AI estimates in dollars. Approved values are human-approved amounts tracked in cents and shown as currency.

- Needs review: ${formatDollars(totals.needs_review_dollars)} (${totals.needs_review_count} finding${totals.needs_review_count === 1 ? "" : "s"})
- Being discussed with client: ${formatDollars(totals.discussing_dollars)}
- Approved for billing (not yet invoiced): ${formatCents(totals.billable_cents)}
- Invoiced: ${formatCents(totals.invoiced_cents)}
- Paid: ${formatCents(totals.paid_cents)}
- Included in retainer: ${formatCents(totals.retainer_cents)}
- Absorbed as courtesy: ${formatDollars(totals.absorbed_dollars)}
- Rejected findings: ${formatDollars(totals.rejected_dollars)}

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
  if (usePostgresStorage()) return postgresStore.createLead(input);
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
  if (usePostgresStorage()) return postgresStore.updateLeadStatus(input);
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
  if (usePostgresStorage()) return postgresStore.createAuditRequest(input);
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
  if (usePostgresStorage()) return postgresStore.createProject(input);
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

const DECISION_EVENT_TYPES: BillingEvent["event_type"][] = [
  "Approved Internally",
  "Included In Retainer",
  "Discussing With Client",
  "Absorbed",
  "Rejected",
  "Reopened",
  "Decision Updated"
];

export type AppDashboard = {
  projects: ProjectSummary[];
  /** Fictional demonstration totals; never merged with real totals. */
  demoTotals: RevenueTotals;
  /** Totals over real (non-demo) findings only. */
  realTotals: RevenueTotals;
  hasDemoFindings: boolean;
  hasRealFindings: boolean;
  attention: FindingWithContext[];
  recentDecisions: BillingEventWithContext[];
  recentEvents: BillingEventWithContext[];
  revenueByProject: Array<{ project: Project; totals: RevenueTotals }>;
  revenueByClient: Array<{ client_name: string; is_demo: boolean; totals: RevenueTotals }>;
};

export async function getAppDashboard(): Promise<AppDashboard> {
  if (usePostgresStorage()) return postgresStore.getAppDashboard();
  const store = await readLocalStore();
  const projects = store.projects.map((project) => summarizeProject(project, store));
  const demoFindings = store.scopeFindings.filter((finding) => finding.is_demo);
  const realFindings = store.scopeFindings.filter((finding) => !finding.is_demo);

  const attention = store.scopeFindings
    .filter(
      (finding) =>
        finding.billing_decision === "Undecided" && finding.classification !== "In Scope"
    )
    .sort((a, b) => b.estimated_revenue - a.estimated_revenue)
    .slice(0, 6)
    .map((finding) => withFindingContext(finding, store));

  const eventsNewestFirst = sortEventsNewestFirst(store.billingEvents);
  const recentDecisions = eventsNewestFirst
    .filter((event) => DECISION_EVENT_TYPES.includes(event.event_type))
    .slice(0, 6)
    .map((event) => withEventContext(event, store));
  const recentEvents = eventsNewestFirst
    .slice(0, 8)
    .map((event) => withEventContext(event, store));

  const revenueByProject = store.projects
    .map((project) => ({
      project,
      totals: computeRevenueTotals(
        store.scopeFindings.filter((finding) => finding.project_id === project.id)
      )
    }))
    .sort((a, b) => b.totals.potential_dollars - a.totals.potential_dollars);

  const clientGroups = new Map<string, { client_name: string; is_demo: boolean; findings: ScopeFinding[] }>();
  for (const project of store.projects) {
    const key = `${project.client_name}|${project.is_demo}`;
    const group = clientGroups.get(key) ?? {
      client_name: project.client_name,
      is_demo: project.is_demo,
      findings: []
    };
    group.findings.push(
      ...store.scopeFindings.filter((finding) => finding.project_id === project.id)
    );
    clientGroups.set(key, group);
  }
  const revenueByClient = Array.from(clientGroups.values())
    .map((group) => ({
      client_name: group.client_name,
      is_demo: group.is_demo,
      totals: computeRevenueTotals(group.findings)
    }))
    .sort((a, b) => b.totals.potential_dollars - a.totals.potential_dollars);

  return {
    projects,
    demoTotals: demoFindings.length ? computeRevenueTotals(demoFindings) : emptyRevenueTotals(),
    realTotals: realFindings.length ? computeRevenueTotals(realFindings) : emptyRevenueTotals(),
    hasDemoFindings: demoFindings.length > 0,
    hasRealFindings: realFindings.length > 0,
    attention,
    recentDecisions,
    recentEvents,
    revenueByProject,
    revenueByClient
  };
}

export async function getProjectDetail(projectId: string): Promise<ProjectDetail | null> {
  if (usePostgresStorage()) return postgresStore.getProjectDetail(projectId);
  const store = await readLocalStore();
  const project = store.projects.find((item) => item.id === projectId);
  if (!project) return null;
  return { project, messages: rowsForProject(project.id, store) };
}

export async function getFindings(): Promise<FindingWithContext[]> {
  if (usePostgresStorage()) return postgresStore.getFindings();
  const store = await readLocalStore();
  return store.scopeFindings
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((finding) => withFindingContext(finding, store));
}

export async function getFindingDetail(findingId: string): Promise<
  (FindingWithContext & { events: BillingEvent[] }) | null
> {
  if (usePostgresStorage()) return postgresStore.getFindingDetail(findingId);
  const store = await readLocalStore();
  const finding = store.scopeFindings.find((item) => item.id === findingId);
  if (!finding) return null;
  return {
    ...withFindingContext(finding, store),
    events: sortEventsNewestFirst(
      store.billingEvents.filter((event) => event.scope_finding_id === finding.id)
    )
  };
}

export async function getBillingEvents(): Promise<BillingEventWithContext[]> {
  if (usePostgresStorage()) return postgresStore.getBillingEvents();
  const store = await readLocalStore();
  return sortEventsNewestFirst(store.billingEvents).map((event) => withEventContext(event, store));
}

export async function saveMessageWithFinding(input: {
  project_id: string;
  source: MessageSource;
  sender?: string | null;
  message_text: string;
  message_date?: string | null;
  analysis: AnalysisInput;
  analysis_metadata?: AnalysisMetadata;
  sow_version_id?: string;
  boundary_map_id?: string;
}) {
  if (usePostgresStorage()) return postgresStore.saveMessageWithFinding(input);
  return mutateLocalStore((store) => {
    const project = store.projects.find((item) => item.id === input.project_id);
    if (!project) throw new NotFoundError("Project not found.");

    const timestamp = now();
    const message: ClientMessage = {
      id: randomUUID(),
      project_id: project.id,
      source: input.source,
      sender: input.sender?.trim() || null,
      message_text: input.message_text.trim(),
      message_date: input.message_date || null,
      created_at: timestamp
    };

    const finding: ScopeFinding = {
      id: randomUUID(),
      project_id: project.id,
      client_message_id: message.id,
      ...input.analysis,
      billing_decision: "Undecided",
      workflow_status: input.analysis.classification === "In Scope" ? "New" : "Needs Review",
      approved_hours: null,
      approved_amount_cents: null,
      client_facing_explanation: input.analysis.suggested_change_order,
      reviewed_by: null,
      reviewed_at: null,
      created_at: timestamp,
      updated_at: timestamp,
      version: 1,
      is_demo: project.is_demo
    };

    const event: BillingEvent = {
      id: randomUUID(),
      project_id: project.id,
      scope_finding_id: finding.id,
      event_type: "Finding Created",
      amount_cents: null,
      previous_amount_cents: null,
      new_amount_cents: null,
      previous_status: null,
      new_status: finding.workflow_status,
      previous_decision: null,
      new_decision: finding.billing_decision,
      note: "AI analysis saved. Human review required before billing.",
      actor: "AI Analysis",
      created_at: timestamp,
      is_demo: project.is_demo
    };

    store.clientMessages.unshift(message);
    store.scopeFindings.unshift(finding);
    store.billingEvents.push(event);
    return { message, finding };
  });
}

/**
 * Edits the professional-owned fields of a finding.
 * Approved hours/amount may only change while the finding is in the Decided
 * state; invoiced and paid amounts stay stable unless the finding is
 * intentionally reopened. Every amount change appends an Estimate Updated
 * event. Stale versions are rejected.
 */
export async function updateFindingDetails(input: {
  finding_id: string;
  expected_version: number;
  approved_hours?: number | null;
  approved_amount_cents?: number | null;
  client_facing_explanation?: string;
  internal_note?: string | null;
}) {
  if (usePostgresStorage()) return postgresStore.updateFindingDetails(input);
  return mutateLocalStore((store) => {
    const index = store.scopeFindings.findIndex((item) => item.id === input.finding_id);
    if (index === -1) throw new NotFoundError("Finding not found.");
    const finding = store.scopeFindings[index];

    if (finding.version !== input.expected_version) {
      throw new VersionConflictError();
    }

    const wantsAmountChange =
      input.approved_hours !== undefined || input.approved_amount_cents !== undefined;

    if (wantsAmountChange && finding.workflow_status !== "Decided") {
      throw new TransitionError(
        finding.workflow_status === "Invoiced" || finding.workflow_status === "Paid"
          ? "Reopen this finding before changing amounts that were already invoiced."
          : "Make a billing decision (for example Mark as Billable) before setting approved amounts.",
        "invalid_action"
      );
    }

    const timestamp = now();
    const previousAmount = finding.approved_amount_cents;
    const updated: ScopeFinding = {
      ...finding,
      approved_hours:
        input.approved_hours !== undefined ? input.approved_hours : finding.approved_hours,
      approved_amount_cents:
        input.approved_amount_cents !== undefined
          ? input.approved_amount_cents === null
            ? null
            : assertIntegerCents(input.approved_amount_cents, "approved_amount_cents")
          : finding.approved_amount_cents,
      client_facing_explanation:
        input.client_facing_explanation !== undefined
          ? input.client_facing_explanation
          : finding.client_facing_explanation,
      internal_note:
        input.internal_note !== undefined ? input.internal_note : finding.internal_note,
      reviewed_by: PROFESSIONAL_ACTOR,
      reviewed_at: timestamp,
      updated_at: timestamp,
      version: finding.version + 1
    };

    store.scopeFindings[index] = updated;

    if (wantsAmountChange && previousAmount !== updated.approved_amount_cents) {
      store.billingEvents.push({
        id: randomUUID(),
        project_id: finding.project_id,
        scope_finding_id: finding.id,
        event_type: "Estimate Updated",
        amount_cents: updated.approved_amount_cents,
        previous_amount_cents: previousAmount,
        new_amount_cents: updated.approved_amount_cents,
        previous_status: finding.workflow_status,
        new_status: updated.workflow_status,
        previous_decision: finding.billing_decision,
        new_decision: updated.billing_decision,
        note: "Approved amount edited by the professional.",
        actor: PROFESSIONAL_ACTOR,
        created_at: timestamp,
        is_demo: finding.is_demo
      });
    }

    return updated;
  });
}

/**
 * Performs a validated workflow action through the central transition
 * service, appends the matching billing event, and rejects stale versions.
 */
export async function performFindingAction(input: {
  finding_id: string;
  expected_version: number;
  action: FindingActionName;
  note?: string | null;
}) {
  if (usePostgresStorage()) return postgresStore.performFindingAction(input);
  return mutateLocalStore((store) => {
    const index = store.scopeFindings.findIndex((item) => item.id === input.finding_id);
    if (index === -1) throw new NotFoundError("Finding not found.");
    const finding = store.scopeFindings[index];

    if (finding.version !== input.expected_version) {
      throw new VersionConflictError();
    }

    const timestamp = now();
    const applied = applyFindingAction(finding, input.action, {
      now: timestamp,
      actor: PROFESSIONAL_ACTOR
    });

    store.scopeFindings[index] = applied.finding;
    store.billingEvents.push({
      id: randomUUID(),
      project_id: finding.project_id,
      scope_finding_id: finding.id,
      ...applied.event,
      note: input.note?.trim() || null,
      actor: PROFESSIONAL_ACTOR,
      created_at: timestamp,
      is_demo: finding.is_demo
    });

    return applied.finding;
  });
}

/** Read-only report lookup. Never creates or regenerates anything. */
export async function readAuditReport(projectId: string): Promise<
  { project: Project; report: Report | null; messages: MessageWithFinding[] } | null
> {
  if (usePostgresStorage()) return postgresStore.readAuditReport(projectId);
  const store = await readLocalStore();
  const project = store.projects.find((item) => item.id === projectId);
  if (!project) return null;

  const report =
    store.reports
      .filter((item) => item.project_id === project.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;

  return { project, report, messages: rowsForProject(project.id, store) };
}

/**
 * Explicit mutation: generates a new report snapshot and prepends it to the
 * project's report history. Older reports are kept.
 */
export async function generateAuditReport(projectId: string) {
  if (usePostgresStorage()) return postgresStore.generateAuditReport(projectId);
  return mutateLocalStore((store) => {
    const project = store.projects.find((item) => item.id === projectId);
    if (!project) throw new NotFoundError("Project not found.");

    const rows = rowsForProject(project.id, store);
    const markdown = buildReportMarkdown({ project, rows });
    const analyzed = rows.filter((row) => row.finding);
    const total = analyzed.reduce((sum, row) => sum + findingPotential(row.finding), 0);
    const outOfScope = analyzed.filter((row) => row.finding?.classification === "Out of Scope").length;

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

    store.reports = [report, ...store.reports];
    return { report, project, messages: rows };
  });
}

export async function getBusinessDashboard(): Promise<BusinessDashboard> {
  if (usePostgresStorage()) return postgresStore.getBusinessDashboard();
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
  if (usePostgresStorage()) return postgresStore.getSalesTemplates();
  const store = await readLocalStore();
  return store.salesTemplates;
}
