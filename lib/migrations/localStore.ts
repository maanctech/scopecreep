import { DEMO_PROJECT_ID } from "@/lib/demo";
import type {
  AuditRequest,
  BillingEvent,
  ClientMessage,
  Company,
  Lead,
  LeadStatusHistory,
  Project,
  Report,
  SalesTemplate,
  ScopeFinding,
  User
} from "@/lib/types";

/**
 * Local JSON store schema versioning.
 *
 * - Version 1 (implicit, no schema_version field): the original MVP shape
 *   with AI-only `scopeAnalyses` records.
 * - Version 2: `scopeAnalyses` become reviewable `scopeFindings`, plus an
 *   append-only `billingEvents` history and `is_demo` markers.
 *
 * The v1 -> v2 migration is deterministic and repeatable: it derives every
 * new field from existing data (no wall-clock timestamps, no random ids), so
 * migrating the same v1 file always produces the same v2 file. The store
 * layer backs up the original file before writing the migrated version.
 */
export const CURRENT_SCHEMA_VERSION = 2;

export type BusinessStore = {
  schema_version: number;
  users: User[];
  companies: Company[];
  leads: Lead[];
  leadStatusHistory: LeadStatusHistory[];
  auditRequests: AuditRequest[];
  projects: Project[];
  clientMessages: ClientMessage[];
  scopeFindings: ScopeFinding[];
  billingEvents: BillingEvent[];
  reports: Report[];
  salesTemplates: SalesTemplate[];
};

/** Shape of the v1 records this migration consumes. */
type LegacyScopeAnalysis = {
  id: string;
  client_message_id: string;
  classification: ScopeFinding["classification"];
  confidence_score: number;
  reasoning: string;
  relevant_sow_sections: string[];
  request_type: ScopeFinding["request_type"];
  estimated_hours: number;
  estimated_revenue: number;
  suggested_change_order: string;
  internal_note: string | null;
  created_at: string;
};

export class LocalStoreFormatError extends Error {}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export const MIGRATION_ACTOR = "System Migration";

/**
 * Converts one legacy AI-only analysis into a reviewable Scope Finding.
 * The professional has not looked at it yet, so:
 * - flagged findings start at Needs Review / Undecided,
 * - in-scope findings start at New / Undecided (informational),
 * - approved amounts stay null until a human decision,
 * - the AI change-order draft seeds the editable client-facing explanation.
 */
export function migrateAnalysisToFinding(
  analysis: LegacyScopeAnalysis,
  projectId: string,
  isDemo: boolean
): ScopeFinding {
  return {
    id: analysis.id,
    project_id: projectId,
    client_message_id: analysis.client_message_id,
    classification: analysis.classification,
    confidence_score: analysis.confidence_score,
    reasoning: analysis.reasoning,
    relevant_sow_sections: analysis.relevant_sow_sections,
    request_type: analysis.request_type,
    estimated_hours: analysis.estimated_hours,
    estimated_revenue: analysis.estimated_revenue,
    suggested_change_order: analysis.suggested_change_order,
    billing_decision: "Undecided",
    workflow_status: analysis.classification === "In Scope" ? "New" : "Needs Review",
    approved_hours: null,
    approved_amount_cents: null,
    client_facing_explanation: analysis.suggested_change_order,
    internal_note: analysis.internal_note,
    reviewed_by: null,
    reviewed_at: null,
    created_at: analysis.created_at,
    updated_at: analysis.created_at,
    version: 1,
    is_demo: isDemo
  };
}

function migrationCreatedEvent(finding: ScopeFinding): BillingEvent {
  return {
    // Deterministic id so re-running the migration on the same input file
    // produces byte-identical output.
    id: `migrated-created-${finding.id}`,
    project_id: finding.project_id,
    scope_finding_id: finding.id,
    event_type: "Finding Created",
    amount_cents: null,
    previous_amount_cents: null,
    new_amount_cents: null,
    previous_status: null,
    new_status: finding.workflow_status,
    previous_decision: null,
    new_decision: finding.billing_decision,
    note: "Migrated from a saved AI scope analysis.",
    actor: MIGRATION_ACTOR,
    created_at: finding.created_at,
    is_demo: finding.is_demo
  };
}

function migrateV1ToV2(raw: Record<string, unknown>): BusinessStore {
  const clientMessages = asArray<ClientMessage>(raw.clientMessages);
  const legacyAnalyses = asArray<LegacyScopeAnalysis>(raw.scopeAnalyses);
  const messageById = new Map(clientMessages.map((message) => [message.id, message]));

  const projects = asArray<Project>(raw.projects).map((project) => ({
    ...project,
    is_demo: project.is_demo ?? project.id === DEMO_PROJECT_ID
  }));
  const projectById = new Map(projects.map((project) => [project.id, project]));

  const scopeFindings = legacyAnalyses.map((analysis) => {
    const message = messageById.get(analysis.client_message_id);
    const projectId = message?.project_id ?? "";
    const project = projectId ? projectById.get(projectId) : undefined;

    return migrateAnalysisToFinding(analysis, projectId, project?.is_demo ?? false);
  });

  return {
    schema_version: CURRENT_SCHEMA_VERSION,
    users: asArray<User>(raw.users),
    companies: asArray<Company>(raw.companies),
    leads: asArray<Lead>(raw.leads),
    leadStatusHistory: asArray<LeadStatusHistory>(raw.leadStatusHistory),
    auditRequests: asArray<AuditRequest>(raw.auditRequests),
    projects,
    clientMessages,
    scopeFindings,
    billingEvents: scopeFindings.map(migrationCreatedEvent),
    reports: asArray<Report>(raw.reports),
    salesTemplates: asArray<SalesTemplate>(raw.salesTemplates)
  };
}

function normalizeV2(raw: Record<string, unknown>): BusinessStore {
  // Missing collections become EMPTY arrays. Real data is never silently
  // replaced with demo data; seeding only happens when no store file exists.
  return {
    schema_version: CURRENT_SCHEMA_VERSION,
    users: asArray<User>(raw.users),
    companies: asArray<Company>(raw.companies),
    leads: asArray<Lead>(raw.leads),
    leadStatusHistory: asArray<LeadStatusHistory>(raw.leadStatusHistory),
    auditRequests: asArray<AuditRequest>(raw.auditRequests),
    projects: asArray<Project>(raw.projects),
    clientMessages: asArray<ClientMessage>(raw.clientMessages),
    scopeFindings: asArray<ScopeFinding>(raw.scopeFindings),
    billingEvents: asArray<BillingEvent>(raw.billingEvents),
    reports: asArray<Report>(raw.reports),
    salesTemplates: asArray<SalesTemplate>(raw.salesTemplates)
  };
}

/**
 * Brings a parsed store file up to the current schema.
 * Returns whether a migration happened so the caller can back up the
 * original file before persisting the migrated version.
 */
export function migrateStoreShape(raw: unknown): { store: BusinessStore; migrated: boolean } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new LocalStoreFormatError("The local store file must contain a JSON object.");
  }

  const record = raw as Record<string, unknown>;
  const version = record.schema_version;

  if (version === undefined || version === 1) {
    return { store: migrateV1ToV2(record), migrated: true };
  }

  if (version === CURRENT_SCHEMA_VERSION) {
    return { store: normalizeV2(record), migrated: false };
  }

  throw new LocalStoreFormatError(
    `Unsupported local store schema_version ${String(version)}. This build supports up to version ${CURRENT_SCHEMA_VERSION}.`
  );
}
