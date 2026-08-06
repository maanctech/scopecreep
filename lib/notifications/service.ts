import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { z } from "zod";
import { assertPermission } from "@/lib/auth/authorization";
import { currentAuthContext } from "@/lib/auth/current";
import { query } from "@/lib/db/client";
import type { ProfessionalNotification } from "@/lib/notifications/types";

type NotificationType =
  | "Finding Ready"
  | "Analysis Failed"
  | "Evidence Changed"
  | "Connector Failed"
  | "Automation Paused";

export async function createProfessionalNotification(
  client: Pick<PoolClient, "query"> | { query: typeof query },
  input: {
    organizationId: string;
    userId: string | null;
    type: NotificationType;
    title: string;
    detail: string;
    dedupeKey: string;
    projectId?: string | null;
    findingId?: string | null;
    analysisJobId?: string | null;
    connectionId?: string | null;
  },
) {
  if (!input.userId) return false;

  const runQuery = client.query as typeof query;
  const result = await runQuery(
    `INSERT INTO professional_notifications
     (id,organization_id,user_id,notification_type,project_id,finding_id,
      analysis_job_id,connection_id,title,detail,dedupe_key)
     SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11
     WHERE EXISTS (
       SELECT 1 FROM organization_memberships membership
       WHERE membership.organization_id=$2 AND membership.user_id=$3
         AND membership.role IN ('Owner','Admin','Reviewer')
     )
     ON CONFLICT (organization_id,user_id,dedupe_key)
       WHERE dedupe_key IS NOT NULL DO NOTHING
     RETURNING id`,
    [
      randomUUID(),
      input.organizationId,
      input.userId,
      input.type,
      input.projectId || null,
      input.findingId || null,
      input.analysisJobId || null,
      input.connectionId || null,
      input.title.slice(0, 200),
      input.detail.slice(0, 1000),
      input.dedupeKey.slice(0, 500),
    ],
  );

  return Boolean(result.rows[0]);
}

function href(row: Omit<ProfessionalNotification, "href">) {
  if (row.finding_id && row.project_id)
    return `/app/projects/${row.project_id}/analysis?finding=${row.finding_id}#finding-${row.finding_id}`;

  if (row.analysis_job_id && row.project_id)
    return `/app/projects/${row.project_id}/analysis#job-${row.analysis_job_id}`;

  if (row.connection_id) return "/app/integrations";

  return row.project_id ? `/app/projects/${row.project_id}` : "/app";
}

async function professional() {
  const auth = await currentAuthContext();

  if (!auth) throw new Error("A valid organization session is required.");

  assertPermission(auth.role, "findings:review");

  return auth;
}

export async function listProfessionalNotifications(limit = 100) {
  const auth = await professional();
  const safeLimit = Math.min(200, Math.max(1, Math.trunc(limit)));
  const result = await query<Omit<ProfessionalNotification, "href">>(
    `SELECT notification.id,notification.notification_type,notification.project_id,
            notification.finding_id,notification.analysis_job_id,notification.connection_id,
            notification.title,notification.detail,notification.read_at,notification.created_at,
            project.project_name,project.client_name
     FROM professional_notifications notification
     LEFT JOIN projects project
       ON project.organization_id=notification.organization_id AND project.id=notification.project_id
     WHERE notification.organization_id=$1 AND notification.user_id=$2
     ORDER BY notification.created_at DESC,notification.id DESC LIMIT $3`,
    [auth.organizationId, auth.userId, safeLimit],
  );

  return result.rows.map((row) => ({ ...row, href: href(row) }));
}

export async function unreadNotificationCountFor(
  organizationId: string,
  userId: string,
) {
  const result = await query<{ count: number }>(
    `SELECT count(*)::int AS count FROM professional_notifications
     WHERE organization_id=$1 AND user_id=$2 AND read_at IS NULL`,
    [organizationId, userId],
  );

  return Number(result.rows[0]?.count || 0);
}

export async function markNotificationRead(notificationId: string) {
  const auth = await professional();
  const result = await query(
    `UPDATE professional_notifications SET read_at=COALESCE(read_at,now())
     WHERE id=$1 AND organization_id=$2 AND user_id=$3 RETURNING id`,
    [notificationId, auth.organizationId, auth.userId],
  );

  if (!result.rows[0]) throw new Error("Notification not found.");

  return { read: true };
}

export async function markAllNotificationsRead() {
  const auth = await professional();
  const result = await query(
    `UPDATE professional_notifications SET read_at=now()
     WHERE organization_id=$1 AND user_id=$2 AND read_at IS NULL`,
    [auth.organizationId, auth.userId],
  );

  return { updated: result.rowCount || 0 };
}

export async function getNotificationPreference() {
  const auth = await professional();
  const result = await query<{
    daily_digest_enabled: boolean;
    delivery_status: string | null;
    delivery_error: string | null;
    delivery_completed_at: string | null;
  }>(
    `SELECT COALESCE(preference.daily_digest_enabled,false) AS daily_digest_enabled,
            delivery.status AS delivery_status,delivery.error_message AS delivery_error,
            delivery.completed_at AS delivery_completed_at
     FROM organization_memberships membership
     LEFT JOIN notification_preferences preference
       ON preference.organization_id=membership.organization_id AND preference.user_id=membership.user_id
     LEFT JOIN LATERAL (
       SELECT status,error_message,completed_at FROM notification_deliveries
       WHERE organization_id=membership.organization_id AND user_id=membership.user_id
       ORDER BY digest_date DESC,created_at DESC LIMIT 1
     ) delivery ON true
     WHERE membership.organization_id=$1 AND membership.user_id=$2`,
    [auth.organizationId, auth.userId],
  );
  const row = result.rows[0];

  return {
    daily_digest_enabled: Boolean(row?.daily_digest_enabled),
    last_delivery: row?.delivery_status
      ? {
          status: row.delivery_status,
          error: row.delivery_error,
          completed_at: row.delivery_completed_at,
        }
      : null,
  };
}

export async function updateNotificationPreference(raw: unknown) {
  const auth = await professional();
  const input = z
    .object({ daily_digest_enabled: z.boolean() })
    .strict()
    .parse(raw);

  if (input.daily_digest_enabled && !process.env.SMTP_HOST?.trim())
    throw new Error(
      "Daily email is unavailable until the installation administrator configures SMTP.",
    );

  await query(
    `INSERT INTO notification_preferences
     (organization_id,user_id,daily_digest_enabled)
     VALUES ($1,$2,$3)
     ON CONFLICT (organization_id,user_id) DO UPDATE SET
       daily_digest_enabled=EXCLUDED.daily_digest_enabled,updated_at=now()`,
    [auth.organizationId, auth.userId, input.daily_digest_enabled],
  );

  return input;
}
