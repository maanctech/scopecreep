import nodemailer from "nodemailer";
import { formatCents } from "@/lib/domain/money";
import { query, transaction } from "@/lib/db/client";

type Delivery = {
  id: string;
  organization_id: string;
  user_id: string;
  recipient_email: string;
  digest_date: string;
};

function localDateAndHour(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: string) =>
    parts.find((part) => part.type === type)?.value || "";

  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    hour: Number(value("hour")),
  };
}

function smtpConfiguration() {
  const host = process.env.SMTP_HOST?.trim();

  if (!host) return null;

  return {
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER?.trim()
      ? {
          user: process.env.SMTP_USER.trim(),
          pass: process.env.SMTP_PASSWORD || "",
        }
      : undefined,
  };
}

async function createDueDeliveries(date: string) {
  await query(
    `UPDATE notification_deliveries delivery SET status='Cancelled',
       error_message=NULL,completed_at=now(),updated_at=now()
     WHERE delivery.status IN ('Pending','Failed')
       AND NOT EXISTS (
         SELECT 1 FROM notification_preferences preference
         JOIN organization_memberships membership
           ON membership.organization_id=preference.organization_id
          AND membership.user_id=preference.user_id
          AND membership.role IN ('Owner','Admin','Reviewer')
         JOIN users user_account ON user_account.id=preference.user_id
           AND user_account.disabled_at IS NULL
         WHERE preference.organization_id=delivery.organization_id
           AND preference.user_id=delivery.user_id
           AND preference.daily_digest_enabled
           AND user_account.email=delivery.recipient_email
       )`,
  );
  await query(
    `UPDATE notification_deliveries SET status='Failed',
       error_message='Digest worker stopped before SMTP delivery completed.',updated_at=now()
     WHERE status='Sending' AND started_at < now()-interval '10 minutes'`,
  );
  await query(
    `INSERT INTO notification_deliveries
     (id,organization_id,user_id,digest_date,recipient_email,status)
     SELECT gen_random_uuid(),preference.organization_id,preference.user_id,$1,user_account.email,'Pending'
     FROM notification_preferences preference
     JOIN users user_account ON user_account.id=preference.user_id AND user_account.disabled_at IS NULL
     JOIN organization_memberships membership
       ON membership.organization_id=preference.organization_id
      AND membership.user_id=preference.user_id
      AND membership.role IN ('Owner','Admin','Reviewer')
     WHERE preference.daily_digest_enabled
       AND EXISTS (
         SELECT 1 FROM professional_notifications notification
         WHERE notification.organization_id=preference.organization_id
           AND notification.user_id=preference.user_id
           AND notification.read_at IS NULL AND notification.digest_eligible
       )
     ON CONFLICT (organization_id,user_id,digest_date) DO NOTHING`,
    [date],
  );
}

async function claimDelivery(date: string) {
  return transaction(async (client) => {
    const selected = await client.query<Delivery>(
      `SELECT id,organization_id,user_id,recipient_email,digest_date
       FROM notification_deliveries
       WHERE digest_date=$1 AND attempt_count<3
         AND (status='Pending' OR (status='Failed' AND updated_at < now()-interval '15 minutes'))
         AND EXISTS (
           SELECT 1 FROM notification_preferences preference
           JOIN organization_memberships membership
             ON membership.organization_id=preference.organization_id
            AND membership.user_id=preference.user_id
            AND membership.role IN ('Owner','Admin','Reviewer')
           JOIN users user_account ON user_account.id=preference.user_id
             AND user_account.disabled_at IS NULL
           WHERE preference.organization_id=notification_deliveries.organization_id
             AND preference.user_id=notification_deliveries.user_id
             AND preference.daily_digest_enabled
             AND user_account.email=notification_deliveries.recipient_email
         )
       ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT 1`,
      [date],
    );
    const delivery = selected.rows[0];

    if (!delivery) return null;

    const claimed = await client.query<Delivery>(
      `UPDATE notification_deliveries SET status='Sending',attempt_count=attempt_count+1,
         started_at=now(),error_message=NULL,updated_at=now()
       WHERE id=$1 AND organization_id=$2 AND status IN ('Pending','Failed')
       RETURNING id,organization_id,user_id,recipient_email,digest_date`,
      [delivery.id, delivery.organization_id],
    );

    return claimed.rows[0] || null;
  });
}

async function digestBody(delivery: Delivery) {
  const [identity, notifications, totals] = await Promise.all([
    query<{ organization_name: string; display_name: string }>(
      `SELECT organization.name AS organization_name,user_account.display_name
       FROM organizations organization
       JOIN organization_memberships membership ON membership.organization_id=organization.id
       JOIN users user_account ON user_account.id=membership.user_id
       WHERE organization.id=$1 AND user_account.id=$2`,
      [delivery.organization_id, delivery.user_id],
    ),
    query<{
      notification_type: string;
      count: number;
      projects: string[];
    }>(
      `SELECT notification.notification_type,count(*)::int AS count,
              array_remove(array_agg(DISTINCT project.project_name),NULL) AS projects
       FROM professional_notifications notification
       LEFT JOIN projects project
         ON project.organization_id=notification.organization_id AND project.id=notification.project_id
       WHERE notification.organization_id=$1 AND notification.user_id=$2
         AND notification.read_at IS NULL AND notification.digest_eligible
       GROUP BY notification.notification_type ORDER BY notification.notification_type`,
      [delivery.organization_id, delivery.user_id],
    ),
    query<{
      potential_cents: number;
      approved_cents: number;
      invoiced_cents: number;
      paid_cents: number;
      needs_review_count: number;
    }>(
      `SELECT
         COALESCE(sum(CASE WHEN finding.classification<>'In Scope' THEN finding.estimated_revenue_cents ELSE 0 END),0)::bigint AS potential_cents,
         COALESCE(sum(CASE WHEN finding.billing_decision='Bill Separately' AND finding.workflow_status='Decided' THEN finding.approved_amount_cents ELSE 0 END),0)::bigint AS approved_cents,
         COALESCE(sum(CASE WHEN finding.billing_decision='Bill Separately' AND finding.workflow_status='Invoiced' THEN finding.approved_amount_cents ELSE 0 END),0)::bigint AS invoiced_cents,
         COALESCE(sum(CASE WHEN finding.billing_decision='Bill Separately' AND finding.workflow_status='Paid' THEN finding.approved_amount_cents ELSE 0 END),0)::bigint AS paid_cents,
         count(*) FILTER (WHERE finding.billing_decision='Undecided' AND finding.classification<>'In Scope')::int AS needs_review_count
       FROM scope_findings finding
       JOIN client_messages message
         ON message.organization_id=finding.organization_id AND message.id=finding.client_message_id
       WHERE finding.organization_id=$1 AND message.deleted_at IS NULL`,
      [delivery.organization_id],
    ),
  ]);
  const person = identity.rows[0];
  const money = totals.rows[0];
  const appUrl = process.env.APP_URL || "http://127.0.0.1:3000";
  const summary = notifications.rows
    .map(
      (row) =>
        `- ${row.notification_type}: ${row.count}${row.projects.length ? ` (${row.projects.join(", ")})` : ""}`,
    )
    .join("\n");

  return {
    subject: `ScopeLedger review digest - ${person?.organization_name || "workspace"}`,
    text: `Hello ${person?.display_name || "there"},

ScopeLedger has professional review items waiting. No client was contacted and no billing action was taken.

Review inbox
${summary || "- No unread review items."}

Current revenue position
- Potential leakage (AI estimate): ${formatCents(Number(money?.potential_cents || 0))}
- Approved, not invoiced: ${formatCents(Number(money?.approved_cents || 0))}
- Invoiced: ${formatCents(Number(money?.invoiced_cents || 0))}
- Paid / recovered: ${formatCents(Number(money?.paid_cents || 0))}
- Findings awaiting review: ${Number(money?.needs_review_count || 0)}

Open the professional review inbox: ${new URL("/app/notifications", appUrl).toString()}

AI findings require professional evidence review before any client discussion or billing decision.`,
  };
}

export async function deliverDueDigests(now = new Date()) {
  const configuration = smtpConfiguration();

  if (!configuration) return { attempted: 0, sent: 0 };

  const zone = process.env.APP_TIMEZONE || "UTC";
  const local = localDateAndHour(now, zone);
  const digestHour = Number(process.env.DAILY_DIGEST_HOUR || 8);

  if (local.hour < digestHour) return { attempted: 0, sent: 0 };

  await createDueDeliveries(local.date);
  const transport = nodemailer.createTransport({
    ...configuration,
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  });
  let attempted = 0;
  let sent = 0;

  for (;;) {
    const delivery = await claimDelivery(local.date);

    if (!delivery) break;

    attempted += 1;

    try {
      const body = await digestBody(delivery);
      const result = await transport.sendMail({
        from: process.env.SMTP_FROM,
        to: delivery.recipient_email,
        subject: body.subject,
        text: body.text,
      });

      await query(
        `UPDATE notification_deliveries SET status='Succeeded',provider_response=$1,
           completed_at=now(),updated_at=now()
         WHERE id=$2 AND organization_id=$3 AND status='Sending'`,
        [String(result.messageId || "Accepted").slice(0, 500), delivery.id, delivery.organization_id],
      );
      sent += 1;
    } catch {
      await query(
        `UPDATE notification_deliveries SET status='Failed',
           error_message='SMTP delivery failed. Verify server credentials, sender policy, and network access.',
           completed_at=now(),updated_at=now()
         WHERE id=$1 AND organization_id=$2 AND status='Sending'`,
        [delivery.id, delivery.organization_id],
      );
    }
  }

  return { attempted, sent };
}
