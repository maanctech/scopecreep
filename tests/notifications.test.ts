import { promises as fs } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import type { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  currentAuthContext: vi.fn(),
  sendMail: vi.fn(),
}));

vi.mock("@/lib/auth/current", () => ({
  currentAuthContext: mocks.currentAuthContext,
}));
vi.mock("nodemailer", () => ({
  default: {
    createTransport: () => ({ sendMail: mocks.sendMail }),
  },
}));

import { resetPoolForTesting, setPoolForTesting } from "@/lib/db/client";
import { deliverDueDigests } from "@/lib/notifications/digest";
import {
  createProfessionalNotification,
  listProfessionalNotifications,
  markNotificationRead,
} from "@/lib/notifications/service";

const ids = {
  organization: "82000000-0000-4000-8000-000000000001",
  user: "82000000-0000-4000-8000-000000000002",
  otherUser: "82000000-0000-4000-8000-000000000003",
  project: "82000000-0000-4000-8000-000000000004",
  message: "82000000-0000-4000-8000-000000000005",
  finding: "82000000-0000-4000-8000-000000000006",
};

function adapter(db: PGlite): Pool {
  const client = {
    query: async (text: string, values: unknown[] = []) => {
      const result = await db.query(text, values);

      return { rows: result.rows, rowCount: result.rows.length };
    },
    release: () => {},
  };

  return {
    query: client.query,
    connect: async () => client,
    end: async () => {},
  } as unknown as Pool;
}

describe("professional notifications and digest", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = new PGlite();
    const directory = path.join(process.cwd(), "db", "migrations");

    for (const filename of (await fs.readdir(directory)).filter((name) => name.endsWith(".sql")).sort())
      await db.exec(await fs.readFile(path.join(directory, filename), "utf8"));

    setPoolForTesting(adapter(db));
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.SMTP_HOST = "smtp.example.test";
    process.env.SMTP_PORT = "587";
    process.env.SMTP_SECURE = "false";
    process.env.SMTP_FROM = "ScopeLedger <alerts@example.test>";
    process.env.DAILY_DIGEST_HOUR = "8";
    process.env.APP_TIMEZONE = "UTC";
    process.env.APP_URL = "https://scopeledger.example.test";
    mocks.currentAuthContext.mockResolvedValue({
      sessionId: "session",
      userId: ids.user,
      organizationId: ids.organization,
      organizationName: "Agency",
      email: "owner@example.test",
      displayName: "Owner",
      role: "Owner",
      isSystemAdmin: false,
      expiresAt: "2099-01-01T00:00:00.000Z",
    });
    mocks.sendMail.mockResolvedValue({ messageId: "smtp-message-1" });
    await db.exec(`
      TRUNCATE users,organizations CASCADE;
      INSERT INTO organizations (id,name,slug) VALUES ('${ids.organization}','Agency','agency');
      INSERT INTO users (id,email,normalized_email,password_hash,display_name) VALUES
        ('${ids.user}','owner@example.test','owner@example.test','unused','Owner'),
        ('${ids.otherUser}','other@example.test','other@example.test','unused','Other');
      INSERT INTO organization_memberships (organization_id,user_id,role) VALUES
        ('${ids.organization}','${ids.user}','Owner'),
        ('${ids.organization}','${ids.otherUser}','Reviewer');
      INSERT INTO projects (id,organization_id,client_name,project_name,hourly_rate_cents)
        VALUES ('${ids.project}','${ids.organization}','ApertureOps','Website',17500);
      INSERT INTO client_messages
        (id,organization_id,project_id,source,message_text,content_sha256)
        VALUES ('${ids.message}','${ids.organization}','${ids.project}','Slack','CONFIDENTIAL CLIENT BODY','message-hash');
      INSERT INTO scope_findings
        (id,organization_id,project_id,client_message_id,classification,confidence_score,reasoning,
         relevant_sow_sections,request_type,estimated_hours,estimated_revenue_cents,suggested_change_order,
         billing_decision,workflow_status,approved_amount_cents,client_facing_explanation)
        VALUES ('${ids.finding}','${ids.organization}','${ids.project}','${ids.message}','Out of Scope',0.9,
          'Excluded','["CONFIDENTIAL SOW BODY"]','Engineering',8,140000,'Draft',
          'Bill Separately','Decided',125000,'Draft');
      INSERT INTO notification_preferences (organization_id,user_id,daily_digest_enabled)
        VALUES ('${ids.organization}','${ids.user}',true);
    `);
  });

  afterAll(async () => {
    for (const name of [
      "SMTP_HOST",
      "SMTP_PORT",
      "SMTP_SECURE",
      "SMTP_FROM",
      "DAILY_DIGEST_HOUR",
      "APP_TIMEZONE",
      "APP_URL",
    ])
      delete process.env[name];

    resetPoolForTesting();
    await db.close();
  });

  async function createFindingNotification(userId = ids.user) {
    return db.transaction((client) =>
      createProfessionalNotification(client as never, {
        organizationId: ids.organization,
        userId,
        type: "Finding Ready",
        title: "Finding ready",
        detail: "Professional review required.",
        dedupeKey: `finding-ready:${ids.finding}`,
        projectId: ids.project,
        findingId: ids.finding,
      }),
    );
  }

  it("deduplicates alerts and exposes only the signed-in professional's records", async () => {
    expect(await createFindingNotification()).toBe(true);
    expect(await createFindingNotification()).toBe(false);
    expect(await createFindingNotification(ids.otherUser)).toBe(true);
    const own = await listProfessionalNotifications();

    expect(own).toHaveLength(1);
    expect(own[0].href).toContain(ids.finding);
    await expect(markNotificationRead(own[0].id)).resolves.toEqual({ read: true });

    const other = await db.query<{ id: string }>(
      "SELECT id FROM professional_notifications WHERE user_id=$1",
      [ids.otherUser],
    );

    await expect(markNotificationRead(other.rows[0].id)).rejects.toThrow(
      "Notification not found",
    );
  });

  it("sends one text-only daily digest without client or SOW bodies", async () => {
    await createFindingNotification();
    const now = new Date("2026-08-05T08:05:00.000Z");

    await expect(deliverDueDigests(now)).resolves.toEqual({ attempted: 1, sent: 1 });
    await expect(deliverDueDigests(now)).resolves.toEqual({ attempted: 0, sent: 0 });
    expect(mocks.sendMail).toHaveBeenCalledTimes(1);
    const email = mocks.sendMail.mock.calls[0][0] as { to: string; text: string };

    expect(email.to).toBe("owner@example.test");
    expect(email.text).toContain("Approved, not invoiced: $1,250.00");
    expect(email.text).toContain("https://scopeledger.example.test/app/notifications");
    expect(email.text).not.toContain("CONFIDENTIAL CLIENT BODY");
    expect(email.text).not.toContain("CONFIDENTIAL SOW BODY");
  });

  it("records SMTP failure without immediate retry or exposing provider errors", async () => {
    await createFindingNotification();
    mocks.sendMail.mockRejectedValue(new Error("secret smtp diagnostic"));
    const now = new Date("2026-08-05T08:05:00.000Z");

    await expect(deliverDueDigests(now)).resolves.toEqual({ attempted: 1, sent: 0 });
    await expect(deliverDueDigests(now)).resolves.toEqual({ attempted: 0, sent: 0 });
    const delivery = await db.query<{
      status: string;
      attempt_count: number;
      error_message: string;
    }>("SELECT status,attempt_count,error_message FROM notification_deliveries");

    expect(delivery.rows[0]).toMatchObject({ status: "Failed", attempt_count: 1 });
    expect(delivery.rows[0].error_message).not.toContain("secret smtp diagnostic");
  });

  it("cancels a pending digest when the professional opts out before claim", async () => {
    await createFindingNotification();
    await db.query(
      `INSERT INTO notification_deliveries
       (id,organization_id,user_id,digest_date,recipient_email,status)
       VALUES ('82000000-0000-4000-8000-000000000020',$1,$2,'2026-08-05','owner@example.test','Pending')`,
      [ids.organization, ids.user],
    );
    await db.query(
      "UPDATE notification_preferences SET daily_digest_enabled=false WHERE organization_id=$1 AND user_id=$2",
      [ids.organization, ids.user],
    );

    await expect(
      deliverDueDigests(new Date("2026-08-05T08:05:00.000Z")),
    ).resolves.toEqual({ attempted: 0, sent: 0 });
    const delivery = await db.query<{ status: string }>(
      "SELECT status FROM notification_deliveries",
    );

    expect(delivery.rows[0].status).toBe("Cancelled");
    expect(mocks.sendMail).not.toHaveBeenCalled();
  });
});
