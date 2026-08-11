import type { PoolClient } from "pg";
import { assertPermission } from "@/lib/auth/authorization";
import { withAuthenticatedTenant } from "@/lib/auth/scope";
import type { AuthContext } from "@/lib/auth/types";
import { query } from "@/lib/db/client";
import type { AnalysisJobRow, AnalysisMessageRow, Row } from "@/lib/analysisJobs/types";

declare global {
  var __scopeLedgerAnalysisControllers:
    Map<string, AbortController> | undefined;
}

export const activeControllers =
  global.__scopeLedgerAnalysisControllers || new Map<string, AbortController>();

global.__scopeLedgerAnalysisControllers = activeControllers;

export function asReviewer<T>(work: (auth: AuthContext) => Promise<T>) {
  return withAuthenticatedTenant((auth) => {
    assertPermission(auth.role, "findings:review");

    return work(auth);
  });
}

export function jobMaxAttempts() {
  const value = Number(process.env.ANALYSIS_JOB_MAX_ATTEMPTS || 3);

  return Number.isFinite(value)
    ? Math.min(3, Math.max(1, Math.trunc(value)))
    : 2;
}

export function boundaryText(items: Row[]) {
  return items
    .map(
      (item, index) =>
        `${index + 1}. [${String(item.boundary_type)} / ${String(item.category)}] ${String(item.description)}\n   SOW evidence: ${String(item.evidence || "No evidence recorded")}`,
    )
    .join("\n");
}

export async function approvedContext(
  organizationId: string,
  projectId: string,
  client?: PoolClient,
) {
  const run = <T extends Row>(text: string, values: unknown[]) =>
    client ? client.query<T>(text, values) : query<T>(text, values);
  const project = await run<Row>(
    `SELECT p.id,p.client_name,p.project_name,p.hourly_rate_cents,p.is_demo,
            p.active_sow_version_id,p.active_boundary_map_id,v.content,v.content_sha256
     FROM projects p
     LEFT JOIN sow_versions v ON v.id=p.active_sow_version_id AND v.organization_id=p.organization_id
     LEFT JOIN scope_boundary_maps m ON m.id=p.active_boundary_map_id AND m.organization_id=p.organization_id
     WHERE p.id=$1 AND p.organization_id=$2 AND m.status='Active' AND m.approved_at IS NOT NULL
       AND m.sow_version_id=p.active_sow_version_id`,
    [projectId, organizationId],
  );

  if (!project.rows[0])
    throw new Error(
      "Approve a Scope Boundary Map for the active SOW before analyzing communications.",
    );

  const row = project.rows[0];
  const items = await run<Row>(
    "SELECT boundary_type,category,description,evidence FROM scope_boundary_items WHERE organization_id=$1 AND boundary_map_id=$2 ORDER BY ordinal,id",
    [organizationId, row.active_boundary_map_id],
  );

  if (!items.rows.length)
    throw new Error("The approved Scope Boundary Map has no boundary items.");

  return {
    projectId,
    clientName: String(row.client_name),
    projectName: String(row.project_name),
    hourlyRateCents: Number(row.hourly_rate_cents),
    isDemo: Boolean(row.is_demo),
    sowVersionId: String(row.active_sow_version_id),
    boundaryMapId: String(row.active_boundary_map_id),
    sowText: String(row.content),
    sowHash: String(row.content_sha256),
    boundaryMapText: boundaryText(items.rows),
    boundaryItemCount: items.rows.length,
  };
}

export async function approvedAnalysisContext(projectId: string) {
  return asReviewer(async (auth) => {

    return approvedContext(auth.organizationId, projectId);
  });
}

export async function analysisWorkspace(projectId: string) {
  return asReviewer(async (auth) => {
    const project = await query<Row>(
      "SELECT id,client_name,project_name,active_sow_version_id,active_boundary_map_id FROM projects WHERE id=$1 AND organization_id=$2",
      [projectId, auth.organizationId],
    );

    if (!project.rows[0]) throw new Error("Project not found.");

    let context: Awaited<ReturnType<typeof approvedContext>> | null = null;
    let boundaryError: string | null = null;

    try {
      context = await approvedContext(auth.organizationId, projectId);
    } catch (error) {
      boundaryError =
        error instanceof Error ? error.message : "Boundary approval required.";
    }

    const [messages, jobs] = await Promise.all([
      query<AnalysisMessageRow>(
        `SELECT m.id,m.source,m.sender,m.sender_email,m.subject,left(m.message_text,2000) AS message_text,
                length(m.message_text)::int AS character_count,m.message_date,m.created_at,
                f.id AS finding_id,j.id AS active_job_id,j.status AS active_job_status
         FROM client_messages m
         LEFT JOIN scope_findings f ON f.organization_id=m.organization_id AND f.client_message_id=m.id
         LEFT JOIN LATERAL (
           SELECT id,status FROM analysis_jobs aj
           WHERE aj.organization_id=m.organization_id AND aj.client_message_id=m.id
           ORDER BY aj.created_at DESC LIMIT 1
         ) j ON true
         WHERE m.organization_id=$1 AND m.project_id=$2 AND m.deleted_at IS NULL
         ORDER BY COALESCE(m.message_date,m.created_at) DESC LIMIT 250`,
        [auth.organizationId, projectId],
      ),
      query<AnalysisJobRow>(
        `SELECT id,batch_id,client_message_id,status,provider,model,prompt_version,progress,attempt_count,max_attempts,
                error_message,result,cancel_requested_at,created_at,started_at,completed_at
         FROM analysis_jobs WHERE organization_id=$1 AND project_id=$2
         ORDER BY created_at DESC LIMIT 100`,
        [auth.organizationId, projectId],
      ),
    ]);

    return {
      project: project.rows[0],
      approvedContext: context
        ? {
            sowVersionId: context.sowVersionId,
            boundaryMapId: context.boundaryMapId,
            boundaryItemCount: context.boundaryItemCount,
          }
        : null,
      boundaryError,
      messages: messages.rows,
      jobs: jobs.rows,
    };
  });
}
