import { createHash, randomUUID } from "node:crypto";
import { query, transaction } from "@/lib/db/client";
import { cents, requireContext, type DbRow } from "@/lib/store/postgres/client";
import { projectSummary, rowsForProject, snapshot } from "@/lib/store/postgres/projections";
import { mapReport } from "@/lib/store/postgres/mappers";
import { generateFindingsCsv, generateReportDocument } from "@/lib/reports/generator";
import { NotFoundError } from "@/lib/storeErrors";
import type { BusinessDashboard, Report, ReportType } from "@/lib/types";

export async function readAuditReport(projectId: string) {
  const context = await requireContext();
  const data = await snapshot(context.organizationId);
  const project = data.projects.find((row) => row.id === projectId);

  if (!project) return null;

  return { project, report: data.reports.find((row) => row.project_id === projectId) ?? null, messages: rowsForProject(projectId, data) };
}

export async function generateAuditReport(projectId: string, reportType: ReportType = "Internal Scope Audit") {
  const context = await requireContext();
  const data = await snapshot(context.organizationId);
  const project = data.projects.find((row) => row.id === projectId);

  if (!project) throw new NotFoundError("Project not found.");

  const rows = rowsForProject(projectId, data);
  const analyzed = rows.filter((row) => row.finding);
  const total = analyzed.reduce((sum, row) => sum + (row.finding && row.finding.classification !== "In Scope" ? row.finding.estimated_revenue : 0), 0);
  const out = analyzed.filter((row) => row.finding?.classification === "Out of Scope").length;
  const markdown = generateReportDocument({ project, rows, reportType });
  const createdAt = new Date().toISOString();
  const sourceFindingIds = analyzed.flatMap((row) => row.finding ? [row.finding.id] : []);
  const provenance = await query<{
    finding_id: string;
    provider: string | null;
    model: string | null;
    prompt_version: string | null;
  }>(
    `SELECT f.id AS finding_id,aj.provider,aj.model,aj.prompt_version
     FROM scope_findings f
     LEFT JOIN analysis_jobs aj ON aj.id=f.analysis_job_id AND aj.organization_id=f.organization_id
     WHERE f.organization_id=$1 AND f.project_id=$2 AND f.id=ANY($3::uuid[])
     ORDER BY f.created_at,f.id`,
    [context.organizationId, projectId, sourceFindingIds]
  );
  const sowVersionId = project.active_sow_version_id || null;
  const analysisReferences = Array.from(
    new Map(
      provenance.rows
        .filter((row) => row.provider && row.model && row.prompt_version)
        .map((row) => {
          const reference = { provider: row.provider!, model: row.model!, promptVersion: row.prompt_version! };

          return [`${reference.provider}|${reference.model}|${reference.promptVersion}`, reference] as const;
        })
    ).values()
  );
  const contentHash = createHash("sha256").update(markdown).digest("hex");
  const csv = generateFindingsCsv(project, rows);
  const csvHash = createHash("sha256").update(csv).digest("hex");
  const report = await transaction(async (client) => {
    const existing = await client.query<{ id: string }>(
      "SELECT id FROM reports WHERE organization_id = $1 AND project_id = $2 FOR UPDATE", [context.organizationId, projectId]
    );
    const reportId = existing.rows[0]?.id ?? randomUUID();

    if (!existing.rows[0]) {
      await client.query(
        `INSERT INTO reports (id, organization_id, project_id, title, created_by, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$6)`,
        [reportId, context.organizationId, projectId, `${project.client_name} ${reportType}`, context.userId, createdAt]
      );
    }

    const versionResult = await client.query<{ next_version: number }>(
      "SELECT COALESCE(max(version_number), 0)::int + 1 AS next_version FROM report_versions WHERE report_id = $1", [reportId]
    );
    const versionId = randomUUID();

    await client.query(
      `INSERT INTO report_versions
       (id, organization_id, report_id, version_number, markdown, total_revenue_leakage_cents,
        analyzed_messages_count, out_of_scope_count, generated_by, created_at, report_type,
        sow_version_id, source_finding_ids, analysis_references, content_sha256,csv_content,csv_sha256)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$16,$17)`,
      [versionId, context.organizationId, reportId, versionResult.rows[0].next_version, markdown, cents(total),
       analyzed.length, out, context.userId, createdAt, reportType, sowVersionId, sourceFindingIds,
       JSON.stringify(analysisReferences), contentHash, csv, csvHash]
    );
    await client.query("UPDATE reports SET current_version_id=$1,title=$2,updated_at=$3 WHERE id=$4", [
      versionId, `${project.client_name} ${reportType}`, createdAt, reportId
    ]);
    await client.query(
      "INSERT INTO audit_logs (id,organization_id,actor_user_id,action,resource_type,resource_id,metadata) VALUES ($1,$2,$3,'report.generated','report_version',$4,$5::jsonb)",
      [randomUUID(), context.organizationId, context.userId, versionId,
       JSON.stringify({ projectId, reportType, versionNumber: versionResult.rows[0].next_version, contentHash })]
    );

    return { id: versionId, project_id: projectId, title: `${project.client_name} ${reportType}`, markdown,
      total_revenue_leakage: total, analyzed_messages_count: analyzed.length, out_of_scope_count: out,
      created_at: createdAt, report_type: reportType, version_number: versionResult.rows[0].next_version,
      sow_version_id: sowVersionId, source_finding_ids: sourceFindingIds,
      analysis_references: analysisReferences, content_sha256: contentHash,
      csv_content: csv, csv_sha256: csvHash } satisfies Report;
  });

  return { report, project, messages: rows };
}

export async function getReportHistory(projectId: string) {
  const context = await requireContext();
  const project = await query<DbRow>(
    "SELECT id FROM projects WHERE id=$1 AND organization_id=$2",
    [projectId, context.organizationId]
  );

  if (!project.rows[0]) throw new NotFoundError("Project not found.");

  const versions = await query<DbRow>(
    `SELECT r.project_id,r.title,p.client_name,rv.id AS version_id,rv.version_number,rv.report_type,''::text AS markdown,
            rv.total_revenue_leakage_cents,rv.analyzed_messages_count,rv.out_of_scope_count,
            rv.sow_version_id,rv.source_finding_ids,rv.analysis_references,rv.content_sha256,
            ''::text AS csv_content,rv.csv_sha256,
            rv.created_at AS version_created_at
     FROM reports r JOIN projects p ON p.id=r.project_id AND p.organization_id=r.organization_id
     JOIN report_versions rv ON rv.report_id=r.id AND rv.organization_id=r.organization_id
     WHERE r.organization_id=$1 AND r.project_id=$2 ORDER BY rv.version_number DESC`,
    [context.organizationId, projectId]
  );

  return versions.rows.map(mapReport);
}

export async function getReportVersion(projectId: string, versionId: string) {
  const context = await requireContext();
  const version = await query<DbRow>(
    `SELECT r.project_id,r.title,p.client_name,rv.id AS version_id,rv.version_number,rv.report_type,rv.markdown,
            rv.total_revenue_leakage_cents,rv.analyzed_messages_count,rv.out_of_scope_count,
            rv.sow_version_id,rv.source_finding_ids,rv.analysis_references,rv.content_sha256,
            rv.csv_content,rv.csv_sha256,rv.created_at AS version_created_at
     FROM reports r
     JOIN projects p ON p.id=r.project_id AND p.organization_id=r.organization_id
     JOIN report_versions rv ON rv.report_id=r.id AND rv.organization_id=r.organization_id
     WHERE r.organization_id=$1 AND r.project_id=$2 AND rv.id=$3`,
    [context.organizationId, projectId, versionId]
  );

  return version.rows[0] ? mapReport(version.rows[0]) : null;
}

export async function exportFindingsCsv(projectId: string) {
  const context = await requireContext();
  const data = await snapshot(context.organizationId);
  const project = data.projects.find((row) => row.id === projectId);

  if (!project) throw new NotFoundError("Project not found.");

  return generateFindingsCsv(project, rowsForProject(projectId, data));
}

export async function getBusinessDashboard(): Promise<BusinessDashboard> {
  const context = await requireContext();
  const data = await snapshot(context.organizationId);
  const projects = data.projects.map((project) => projectSummary(project, data));
  const leakage = new Map<string, number>();

  projects.forEach((project) => {
    if (project.company_id) leakage.set(project.company_id, (leakage.get(project.company_id) ?? 0) + project.potential_recovered_revenue);
  });

  return {
    leads: data.leads,
    auditRequests: data.auditRequests,
    projects,
    companies: data.companies.map((company) => ({ ...company, estimated_leakage: leakage.get(company.id) ?? 0 }))
      .sort((a, b) => b.estimated_leakage - a.estimated_leakage),
    totals: {
      leads: data.leads.length, audit_requests: data.auditRequests.length, projects: projects.length,
      potential_recovered_revenue: projects.reduce((sum, project) => sum + project.potential_recovered_revenue, 0),
      out_of_scope_count: projects.reduce((sum, project) => sum + project.out_of_scope_count, 0)
    }
  };
}

export async function getSalesTemplates() {
  const context = await requireContext();

  return (await snapshot(context.organizationId)).salesTemplates;
}
