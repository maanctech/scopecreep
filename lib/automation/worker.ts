import { randomUUID } from "node:crypto";
import { processAnalysisJob } from "@/lib/analysisJobs/processing";
import { queueAnalysisJobsForActor } from "@/lib/analysisJobs/queue";
import type {
  ClaimedAutomationRun,
  ConnectorSyncSummary,
} from "@/lib/automation/types";
import {
  recoverStalePlatformJobs,
  syncPlatformConnectionForActor,
} from "@/lib/connectors/service";
import { query, transaction } from "@/lib/db/client";
import {
  recoverStaleEmailJobs,
  syncEmailConnectionForActor,
} from "@/lib/ingestion/email";
import { createProfessionalNotification } from "@/lib/notifications/service";

type Row = Record<string, unknown>;

type WorkerDependencies = {
  syncConnection?: (
    actor: { organizationId: string; userId: string },
    connectionId: string,
    provider: string,
  ) => Promise<ConnectorSyncSummary>;
  processJob?: typeof processAnalysisJob;
};

function leaseMinutes() {
  const value = Number(process.env.AUTOMATION_LEASE_MINUTES || 30);

  return Number.isSafeInteger(value) && value >= 5 && value <= 240
    ? value
    : 30;
}

async function safeNotify(
  client: Parameters<typeof createProfessionalNotification>[0],
  input: Parameters<typeof createProfessionalNotification>[1],
) {
  return createProfessionalNotification(client, input).catch(() => false);
}

async function defaultSyncConnection(
  actor: { organizationId: string; userId: string },
  connectionId: string,
  provider: string,
) {
  if (provider === "IMAP")
    return syncEmailConnectionForActor(actor, connectionId);

  return syncPlatformConnectionForActor(actor, connectionId);
}

export async function recoverExpiredAutomationRuns() {
  return transaction(async (client) => {
    const recovered = await client.query<{
      organization_id: string;
      project_id: string;
    }>(
      `UPDATE automation_runs SET status='Failed',
         error_message='Monitoring worker stopped before completing this run.',
         completed_at=now(),updated_at=now()
       WHERE status='Running' AND lease_expires_at < now()
       RETURNING organization_id,project_id`,
    );

    for (const row of recovered.rows)
      await client.query(
        `UPDATE project_automation_settings
         SET next_run_at=now(),last_error='A monitoring run stopped unexpectedly and will be retried.',updated_at=now()
         WHERE organization_id=$1 AND project_id=$2 AND status='Active'`,
        [row.organization_id, row.project_id],
      );

    return recovered.rowCount || 0;
  });
}

export async function claimDueAutomation(
  leaseOwner: string,
): Promise<ClaimedAutomationRun | null> {
  return transaction(async (client) => {
    const unauthorized = await client.query<{
      organization_id: string;
      project_id: string;
      enabled_by_user_id: string | null;
    }>(
      `UPDATE project_automation_settings s SET status='Needs Attention',
         last_error='Monitoring paused because the enabling professional is no longer an Owner or Admin.',updated_at=now()
       WHERE s.status='Active' AND s.next_run_at <= now()
         AND NOT EXISTS (
           SELECT 1 FROM organization_memberships membership
           WHERE membership.organization_id=s.organization_id
             AND membership.user_id=s.enabled_by_user_id
             AND membership.role IN ('Owner','Admin')
         )
       RETURNING organization_id,project_id,enabled_by_user_id`,
    );

    for (const row of unauthorized.rows)
      await safeNotify(client, {
        organizationId: row.organization_id,
        userId: row.enabled_by_user_id,
        type: "Automation Paused",
        title: "Monitoring authorization needs review",
        detail: "Monitoring stopped because the enabling professional is no longer an Owner or Admin.",
        dedupeKey: `automation-authorization:${row.project_id}`,
        projectId: row.project_id,
      });

    const due = await client.query<Row>(
      `SELECT s.id,s.organization_id,s.project_id,s.enabled_by_user_id,
              s.sync_interval_minutes,s.next_run_at
       FROM project_automation_settings s
       JOIN organization_memberships membership
         ON membership.organization_id=s.organization_id
        AND membership.user_id=s.enabled_by_user_id
       WHERE s.status='Active' AND s.next_run_at <= now()
         AND membership.role IN ('Owner','Admin')
       ORDER BY s.next_run_at,s.id
       FOR UPDATE OF s SKIP LOCKED LIMIT 1`,
    );
    const setting = due.rows[0];

    if (!setting) return null;

    const boundary = await client.query(
      `SELECT 1 FROM projects p
       JOIN scope_boundary_maps m
         ON m.organization_id=p.organization_id AND m.id=p.active_boundary_map_id
       WHERE p.organization_id=$1 AND p.id=$2
         AND p.active_sow_version_id=m.sow_version_id
         AND m.status='Active' AND m.approved_at IS NOT NULL`,
      [setting.organization_id, setting.project_id],
    );

    if (!boundary.rows[0]) {
      await client.query(
        `UPDATE project_automation_settings SET status='Needs Attention',
           last_error='Monitoring paused because the project has no approved current SOW boundary.',updated_at=now()
         WHERE id=$1 AND organization_id=$2`,
        [setting.id, setting.organization_id],
      );
      await safeNotify(client, {
        organizationId: String(setting.organization_id),
        userId: String(setting.enabled_by_user_id),
        type: "Automation Paused",
        title: "Monitoring paused for SOW approval",
        detail: "Approve the current SOW boundary before monitoring can analyze new communications.",
        dedupeKey: `automation-boundary:${String(setting.project_id)}:${String(setting.next_run_at)}`,
        projectId: String(setting.project_id),
      });

      return null;
    }

    const runId = randomUUID();
    const scheduledFor = setting.next_run_at;

    await client.query(
      `INSERT INTO automation_runs
       (id,organization_id,project_id,status,lease_owner,lease_expires_at,scheduled_for)
       VALUES ($1,$2,$3,'Running',$4,now()+make_interval(mins => $5::int),$6)`,
      [
        runId,
        setting.organization_id,
        setting.project_id,
        leaseOwner,
        leaseMinutes(),
        scheduledFor,
      ],
    );
    await client.query(
      `UPDATE project_automation_settings SET last_started_at=now(),
         next_run_at=now()+make_interval(mins => sync_interval_minutes),updated_at=now()
       WHERE id=$1 AND organization_id=$2`,
      [setting.id, setting.organization_id],
    );

    return {
      runId,
      organizationId: String(setting.organization_id),
      projectId: String(setting.project_id),
      actorUserId: String(setting.enabled_by_user_id),
      leaseOwner,
    };
  });
}

async function renewLease(run: ClaimedAutomationRun) {
  const renewed = await query(
    `UPDATE automation_runs
     SET lease_expires_at=now()+make_interval(mins => $1::int),updated_at=now()
     WHERE id=$2 AND organization_id=$3 AND status='Running' AND lease_owner=$4
     RETURNING id`,
    [leaseMinutes(), run.runId, run.organizationId, run.leaseOwner],
  );

  if (!renewed.rows[0])
    throw new Error("Monitoring run lease was lost before completion.");
}

async function finishRun(
  run: ClaimedAutomationRun,
  result: {
    connections: number;
    inserted: number;
    queued: number;
    findings: number;
    error?: string;
  },
) {
  await transaction(async (client) => {
    const completed = await client.query(
      `UPDATE automation_runs SET status=$1,connections_attempted=$2,
         messages_inserted=$3,jobs_queued=$4,findings_created=$5,error_message=$6,
         completed_at=now(),updated_at=now()
       WHERE id=$7 AND organization_id=$8 AND status='Running' AND lease_owner=$9
       RETURNING id`,
      [
        result.error ? "Failed" : "Succeeded",
        result.connections,
        result.inserted,
        result.queued,
        result.findings,
        result.error || null,
        run.runId,
        run.organizationId,
        run.leaseOwner,
      ],
    );

    if (!completed.rows[0])
      throw new Error("Monitoring run lease was lost before completion.");

    await client.query(
      `UPDATE project_automation_settings SET
         status=$1,last_succeeded_at=CASE WHEN $1='Active' THEN now() ELSE last_succeeded_at END,
         last_error=$2,updated_at=now()
       WHERE organization_id=$3 AND project_id=$4`,
      [
        result.error ? "Needs Attention" : "Active",
        result.error || null,
        run.organizationId,
        run.projectId,
      ],
    );
  });
}

export async function executeAutomationRun(
  run: ClaimedAutomationRun,
  dependencies: WorkerDependencies = {},
) {
  const syncConnection = dependencies.syncConnection || defaultSyncConnection;
  const processJob = dependencies.processJob || processAnalysisJob;
  const actor = {
    organizationId: run.organizationId,
    userId: run.actorUserId,
  };
  let connectionCount = 0;
  let inserted = 0;
  let queued = 0;
  let findings = 0;

  try {
    await recoverStalePlatformJobs(run.organizationId);
    await recoverStaleEmailJobs(run.organizationId);
    const connections = await query<{ id: string; provider: string }>(
      `SELECT id,provider FROM communication_connections
       WHERE organization_id=$1 AND configuration->>'projectId'=$2
         AND provider IN ('Slack','Google','Microsoft','IMAP') AND status='Connected'
       ORDER BY created_at,id`,
      [run.organizationId, run.projectId],
    );

    if (!connections.rows.length)
      throw new Error(
        "Monitoring paused because no tested communication source is connected.",
      );

    const newMessageIds = new Set<string>();

    for (const connection of connections.rows) {
      await renewLease(run);
      connectionCount += 1;
      let result: ConnectorSyncSummary;

      try {
        result = await syncConnection(actor, connection.id, connection.provider);
      } catch (error) {
        await safeNotify(
          { query },
          {
            organizationId: run.organizationId,
            userId: run.actorUserId,
            type: "Connector Failed",
            title: `${connection.provider} synchronization needs attention`,
            detail: "Test the connection and review its permissions before re-enabling monitoring.",
            dedupeKey: `connector-failed:${connection.id}:${run.runId}`,
            projectId: run.projectId,
            connectionId: connection.id,
          },
        );
        throw error;
      }

      for (const messageId of result.insertedMessageIds) newMessageIds.add(messageId);

      if (result.changedMessageIds?.length) {
        const changed = await query<{ id: string }>(
          `SELECT id FROM scope_findings
           WHERE organization_id=$1 AND client_message_id=ANY($2::uuid[])`,
          [run.organizationId, result.changedMessageIds],
        );

        for (const finding of changed.rows)
          await safeNotify(
            { query },
            {
              organizationId: run.organizationId,
              userId: run.actorUserId,
              type: "Evidence Changed",
              title: "Source evidence changed after analysis",
              detail: "Review the updated or deleted source communication before relying on the existing finding.",
              dedupeKey: `evidence-changed:${finding.id}:${run.runId}`,
              projectId: run.projectId,
              findingId: finding.id,
              connectionId: connection.id,
            },
          );
      }
    }

    inserted = newMessageIds.size;

    if (newMessageIds.size) {
      const messageIds = [...newMessageIds];

      for (let index = 0; index < messageIds.length; index += 100) {
        const batch = await queueAnalysisJobsForActor(
          actor,
          { projectId: run.projectId, messageIds: messageIds.slice(index, index + 100) },
          "Automation",
        );

        queued += batch.queued;

        for (const jobId of batch.jobIds) {
          await renewLease(run);
          const result = await processJob(run.organizationId, jobId);
          const findingId = "findingId" in result ? result.findingId : null;

          if (result.processed && findingId) {
            findings += 1;
            await safeNotify(
              { query },
              {
                organizationId: run.organizationId,
                userId: run.actorUserId,
                type: "Finding Ready",
                title: "New scope finding ready for review",
                detail: "ScopeLedger prepared an evidence-backed internal finding. Professional approval is required before client use.",
                dedupeKey: `finding-ready:${findingId}`,
                projectId: run.projectId,
                findingId,
                analysisJobId: jobId,
              },
            );
          } else {
            const failed = await query<{ error_message: string | null }>(
              "SELECT error_message FROM analysis_jobs WHERE id=$1 AND organization_id=$2 AND status='Failed'",
              [jobId, run.organizationId],
            );

            if (failed.rows[0])
              await safeNotify(
                { query },
                {
                  organizationId: run.organizationId,
                  userId: run.actorUserId,
                  type: "Analysis Failed",
                  title: "A communication could not be analyzed",
                  detail: failed.rows[0].error_message || "Review the analysis job before retrying.",
                  dedupeKey: `analysis-failed:${jobId}`,
                  projectId: run.projectId,
                  analysisJobId: jobId,
                },
              );
          }
        }
      }
    }

    await finishRun(run, {
      connections: connectionCount,
      inserted,
      queued,
      findings,
    });

    return { connections: connectionCount, inserted, queued, findings };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Monitoring run failed.";

    await safeNotify(
      { query },
      {
        organizationId: run.organizationId,
        userId: run.actorUserId,
        type: "Automation Paused",
        title: "Project monitoring needs attention",
        detail: message.slice(0, 1000),
        dedupeKey: `automation-run-failed:${run.runId}`,
        projectId: run.projectId,
      },
    );
    await finishRun(run, {
      connections: connectionCount,
      inserted,
      queued,
      findings,
      error: message.slice(0, 1000),
    }).catch(() => undefined);

    return { connections: connectionCount, inserted, queued, findings, error: message };
  }
}

export async function runAutomationCycle(
  leaseOwner: string,
  dependencies: WorkerDependencies = {},
) {
  await recoverExpiredAutomationRuns();
  const run = await claimDueAutomation(leaseOwner);

  if (!run) return null;

  return executeAutomationRun(run, dependencies);
}
