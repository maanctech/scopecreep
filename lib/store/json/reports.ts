import { createHash, randomUUID } from "node:crypto";
import { mutateLocalStore, now, readLocalStore } from "@/lib/store/json/persistence";
import { findingPotential, rowsForProject, summarizeProject } from "@/lib/store/json/projections";
import { generateFindingsCsv, generateReportDocument } from "@/lib/reports/generator";
import { NotFoundError } from "@/lib/storeErrors";
import type {
  BusinessDashboard,
  MessageWithFinding,
  Project,
  Report,
  ReportType,
  SalesTemplate
} from "@/lib/types";

/** Read-only report lookup. Never creates or regenerates anything. */
export async function readAuditReport(projectId: string): Promise<
  { project: Project; report: Report | null; messages: MessageWithFinding[] } | null
> {
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
export async function generateAuditReport(projectId: string, reportType: ReportType = "Internal Scope Audit") {
  return mutateLocalStore((store) => {
    const project = store.projects.find((item) => item.id === projectId);

    if (!project) throw new NotFoundError("Project not found.");

    const rows = rowsForProject(project.id, store);
    const markdown = generateReportDocument({ project, rows, reportType });
    const csv = generateFindingsCsv(project, rows);
    const analyzed = rows.filter((row) => row.finding);
    const total = analyzed.reduce((sum, row) => sum + findingPotential(row.finding), 0);
    const outOfScope = analyzed.filter((row) => row.finding?.classification === "Out of Scope").length;

    const report: Report = {
      id: randomUUID(),
      project_id: project.id,
      title: `${project.client_name} ${reportType}`,
      markdown,
      total_revenue_leakage: total,
      analyzed_messages_count: analyzed.length,
      out_of_scope_count: outOfScope,
      created_at: now(),
      report_type: reportType,
      version_number: store.reports.filter((item) => item.project_id === project.id).length + 1,
      sow_version_id: null,
      source_finding_ids: analyzed.flatMap((row) => row.finding ? [row.finding.id] : []),
      analysis_references: [],
      content_sha256: createHash("sha256").update(markdown).digest("hex"),
      csv_content: csv,
      csv_sha256: createHash("sha256").update(csv).digest("hex")
    };

    store.reports = [report, ...store.reports];

    return { report, project, messages: rows };
  });
}

export async function getReportHistory(projectId: string) {
  const store = await readLocalStore();

  if (!store.projects.some((item) => item.id === projectId)) throw new NotFoundError("Project not found.");

  return store.reports
    .filter((item) => item.project_id === projectId)
    .sort((a, b) => (b.version_number || 0) - (a.version_number || 0))
    .map((report) => ({ ...report, markdown: "", csv_content: "" }));
}

export async function getReportVersion(projectId: string, versionId: string) {
  const store = await readLocalStore();

  if (!store.projects.some((item) => item.id === projectId))
    throw new NotFoundError("Project not found.");

  return store.reports.find(
    (version) =>
      version.project_id === projectId && version.id === versionId,
  ) || null;
}

export async function exportFindingsCsv(projectId: string) {
  const store = await readLocalStore();
  const project = store.projects.find((item) => item.id === projectId);

  if (!project) throw new NotFoundError("Project not found.");

  return generateFindingsCsv(project, rowsForProject(projectId, store));
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
