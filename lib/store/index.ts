import * as jsonStore from "@/lib/store/json";
import * as postgresStore from "@/lib/store/postgres";
import { shouldUsePostgresStorage } from "@/lib/runtimeStorage";
import type { LeadInput, AuditRequestInput, ProjectInput, AppDashboard } from "@/lib/store/json";
import type { FindingActionName } from "@/lib/domain/findingTransitions";
import type {
  AnalysisInput,
  BillingEvent,
  BillingEventWithContext,
  BusinessDashboard,
  FindingWithContext,
  LeadStatus,
  MessageSource,
  MessageWithFinding,
  Project,
  ProjectDetail,
  Report,
  ReportType,
  SalesTemplate
} from "@/lib/types";
import type { AnalysisMetadata } from "@/lib/ai/types";

export { LocalStoreCorruptError, NotFoundError, VersionConflictError } from "@/lib/storeErrors";
export type { AppDashboard } from "@/lib/store/json";

export const PROFESSIONAL_ACTOR = "Professional";

export async function resetLocalDemoStore() {
  return jsonStore.resetLocalDemoStore();
}

export async function createLead(input: LeadInput) {
  if (shouldUsePostgresStorage()) return postgresStore.createLead(input);

  return jsonStore.createLead(input);
}

export async function updateLeadStatus(input: { lead_id: string; status: LeadStatus; note?: string | null }) {
  if (shouldUsePostgresStorage()) return postgresStore.updateLeadStatus(input);

  return jsonStore.updateLeadStatus(input);
}

export async function createAuditRequest(input: AuditRequestInput) {
  if (shouldUsePostgresStorage()) return postgresStore.createAuditRequest(input);

  return jsonStore.createAuditRequest(input);
}

export async function createProject(input: ProjectInput) {
  if (shouldUsePostgresStorage()) return postgresStore.createProject(input);

  return jsonStore.createProject(input);
}

export async function getAppDashboard(): Promise<AppDashboard> {
  if (shouldUsePostgresStorage()) return postgresStore.getAppDashboard();

  return jsonStore.getAppDashboard();
}

export async function getProjectDetail(projectId: string): Promise<ProjectDetail | null> {
  if (shouldUsePostgresStorage()) return postgresStore.getProjectDetail(projectId);

  return jsonStore.getProjectDetail(projectId);
}

export async function getFindings(): Promise<FindingWithContext[]> {
  if (shouldUsePostgresStorage()) return postgresStore.getFindings();

  return jsonStore.getFindings();
}

export async function getFindingDetail(findingId: string): Promise<
  (FindingWithContext & { events: BillingEvent[] }) | null
> {
  if (shouldUsePostgresStorage()) return postgresStore.getFindingDetail(findingId);

  return jsonStore.getFindingDetail(findingId);
}

export async function getBillingEvents(): Promise<BillingEventWithContext[]> {
  if (shouldUsePostgresStorage()) return postgresStore.getBillingEvents();

  return jsonStore.getBillingEvents();
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
  if (shouldUsePostgresStorage()) return postgresStore.saveMessageWithFinding(input);

  return jsonStore.saveMessageWithFinding(input);
}

export async function updateFindingDetails(input: {
  finding_id: string;
  expected_version: number;
  approved_hours?: number | null;
  approved_amount_cents?: number | null;
  client_facing_explanation?: string;
  internal_note?: string | null;
}) {
  if (shouldUsePostgresStorage()) return postgresStore.updateFindingDetails(input);

  return jsonStore.updateFindingDetails(input);
}

export async function performFindingAction(input: {
  finding_id: string;
  expected_version: number;
  action: FindingActionName;
  note?: string | null;
}) {
  if (shouldUsePostgresStorage()) return postgresStore.performFindingAction(input);

  return jsonStore.performFindingAction(input);
}

export async function readAuditReport(projectId: string): Promise<
  { project: Project; report: Report | null; messages: MessageWithFinding[] } | null
> {
  if (shouldUsePostgresStorage()) return postgresStore.readAuditReport(projectId);

  return jsonStore.readAuditReport(projectId);
}

export async function generateAuditReport(projectId: string, reportType: ReportType = "Internal Scope Audit") {
  if (shouldUsePostgresStorage()) return postgresStore.generateAuditReport(projectId, reportType);

  return jsonStore.generateAuditReport(projectId, reportType);
}

export async function getReportHistory(projectId: string) {
  if (shouldUsePostgresStorage()) return postgresStore.getReportHistory(projectId);

  return jsonStore.getReportHistory(projectId);
}

export async function getReportVersion(projectId: string, versionId: string) {
  if (shouldUsePostgresStorage()) return postgresStore.getReportVersion(projectId, versionId);

  return jsonStore.getReportVersion(projectId, versionId);
}

export async function exportFindingsCsv(projectId: string) {
  if (shouldUsePostgresStorage()) return postgresStore.exportFindingsCsv(projectId);

  return jsonStore.exportFindingsCsv(projectId);
}

export async function getBusinessDashboard(): Promise<BusinessDashboard> {
  if (shouldUsePostgresStorage()) return postgresStore.getBusinessDashboard();

  return jsonStore.getBusinessDashboard();
}

export async function getSalesTemplates(): Promise<SalesTemplate[]> {
  if (shouldUsePostgresStorage()) return postgresStore.getSalesTemplates();

  return jsonStore.getSalesTemplates();
}
