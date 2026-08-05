import { randomUUID } from "node:crypto";
import { z } from "zod";
import { assertPermission } from "@/lib/auth/authorization";
import { currentAuthContext } from "@/lib/auth/current";
import { query, transaction } from "@/lib/db/client";
import type { ProjectAutomation } from "@/lib/automation/types";

const updateSchema = z
  .object({
    enabled: z.boolean(),
    sync_interval_minutes: z.number().int().min(5).max(1440).default(15),
  })
  .strict();

async function manager() {
  const auth = await currentAuthContext();

  if (!auth) throw new Error("A valid organization session is required.");

  assertPermission(auth.role, "integrations:write");

  return auth;
}

export async function projectAutomationForOrganization(
  organizationId: string,
  projectId: string,
) {
  const result = await query<ProjectAutomation>(
    `SELECT s.*,
       EXISTS(SELECT 1 FROM automation_runs r
              WHERE r.organization_id=s.organization_id AND r.project_id=s.project_id AND r.status='Running') AS running,
       (SELECT count(*)::int FROM communication_connections c
        WHERE c.organization_id=s.organization_id
          AND c.configuration->>'projectId'=s.project_id::text
          AND c.provider IN ('Slack','Google','Microsoft','IMAP')
          AND c.status='Connected') AS connected_sources
     FROM project_automation_settings s
     WHERE s.organization_id=$1 AND s.project_id=$2`,
    [organizationId, projectId],
  );

  return result.rows[0] || null;
}

export async function getProjectAutomation(projectId: string) {
  const auth = await currentAuthContext();

  if (!auth) throw new Error("A valid organization session is required.");

  assertPermission(auth.role, "projects:read");

  const project = await query(
    "SELECT id FROM projects WHERE id=$1 AND organization_id=$2",
    [projectId, auth.organizationId],
  );

  if (!project.rows[0]) throw new Error("Project not found.");

  return projectAutomationForOrganization(auth.organizationId, projectId);
}

export async function updateProjectAutomation(
  projectId: string,
  raw: unknown,
) {
  const auth = await manager();
  const input = updateSchema.parse(raw);

  return transaction(async (client) => {
    const project = await client.query<{
      active_sow_version_id: string | null;
      active_boundary_map_id: string | null;
    }>(
      `SELECT active_sow_version_id,active_boundary_map_id
       FROM projects WHERE id=$1 AND organization_id=$2 FOR UPDATE`,
      [projectId, auth.organizationId],
    );

    if (!project.rows[0]) throw new Error("Project not found.");

    if (input.enabled) {
      const boundary = await client.query(
        `SELECT 1 FROM scope_boundary_maps
         WHERE id=$1 AND organization_id=$2 AND project_id=$3
           AND sow_version_id=$4 AND status='Active' AND approved_at IS NOT NULL`,
        [
          project.rows[0].active_boundary_map_id,
          auth.organizationId,
          projectId,
          project.rows[0].active_sow_version_id,
        ],
      );
      const connections = await client.query(
        `SELECT 1 FROM communication_connections
         WHERE organization_id=$1 AND configuration->>'projectId'=$2
           AND provider IN ('Slack','Google','Microsoft','IMAP') AND status='Connected'`,
        [auth.organizationId, projectId],
      );

      if (!boundary.rows[0])
        throw new Error(
          "Approve the current SOW boundary before enabling monitoring.",
        );

      if (!connections.rows[0])
        throw new Error(
          "Connect and test at least one communication source before enabling monitoring.",
        );
    }

    const status = input.enabled ? "Active" : "Paused";
    const result = await client.query<ProjectAutomation>(
      `INSERT INTO project_automation_settings
       (id,organization_id,project_id,status,sync_interval_minutes,next_run_at,enabled_by_user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (organization_id,project_id) DO UPDATE SET
         status=EXCLUDED.status,
         sync_interval_minutes=EXCLUDED.sync_interval_minutes,
         next_run_at=EXCLUDED.next_run_at,
         enabled_by_user_id=EXCLUDED.enabled_by_user_id,
         last_error=NULL,
         version=project_automation_settings.version+1,
         updated_at=now()
       RETURNING *,false AS running,0::int AS connected_sources`,
      [
        randomUUID(),
        auth.organizationId,
        projectId,
        status,
        input.sync_interval_minutes,
        input.enabled ? new Date().toISOString() : null,
        auth.userId,
      ],
    );

    await client.query(
      "INSERT INTO audit_logs (id,organization_id,actor_user_id,action,resource_type,resource_id,metadata) VALUES ($1,$2,$3,$4,'project_automation',$5,$6::jsonb)",
      [
        randomUUID(),
        auth.organizationId,
        auth.userId,
        input.enabled ? "automation.enabled" : "automation.paused",
        projectId,
        JSON.stringify({ intervalMinutes: input.sync_interval_minutes }),
      ],
    );

    return result.rows[0];
  });
}
