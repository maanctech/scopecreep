import { promises as fs } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import type { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  claimDueAutomation,
  executeAutomationRun,
  recoverExpiredAutomationRuns,
} from "@/lib/automation/worker";
import { resetPoolForTesting, setPoolForTesting } from "@/lib/db/client";

const ids = {
  organization: "81000000-0000-4000-8000-000000000001",
  user: "81000000-0000-4000-8000-000000000002",
  project: "81000000-0000-4000-8000-000000000003",
  document: "81000000-0000-4000-8000-000000000004",
  version: "81000000-0000-4000-8000-000000000005",
  map: "81000000-0000-4000-8000-000000000006",
  connection: "81000000-0000-4000-8000-000000000007",
  message: "81000000-0000-4000-8000-000000000008",
  setting: "81000000-0000-4000-8000-000000000009",
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

describe("durable automation worker", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = new PGlite();
    const directory = path.join(process.cwd(), "db", "migrations");

    for (const filename of (await fs.readdir(directory)).filter((name) => name.endsWith(".sql")).sort())
      await db.exec(await fs.readFile(path.join(directory, filename), "utf8"));

    setPoolForTesting(adapter(db));
    process.env.AI_PROVIDER = "demo";
  });

  beforeEach(async () => {
    await db.exec(`
      TRUNCATE users,organizations CASCADE;
      INSERT INTO organizations (id,name,slug) VALUES ('${ids.organization}','Worker Test','worker-test');
      INSERT INTO users (id,email,normalized_email,password_hash,display_name)
        VALUES ('${ids.user}','owner@example.test','owner@example.test','not-used','Test Owner');
      INSERT INTO organization_memberships (organization_id,user_id,role)
        VALUES ('${ids.organization}','${ids.user}','Owner');
      INSERT INTO projects (id,organization_id,client_name,project_name,hourly_rate_cents,legacy_sow_text)
        VALUES ('${ids.project}','${ids.organization}','Client','Project',17500,'Agreement');
      INSERT INTO sow_documents (id,organization_id,project_id,title,status,created_by)
        VALUES ('${ids.document}','${ids.organization}','${ids.project}','Agreement','Active','${ids.user}');
      INSERT INTO sow_versions (id,organization_id,sow_document_id,version_number,content,content_sha256,created_by)
        VALUES ('${ids.version}','${ids.organization}','${ids.document}',1,'Five pages only','sow-hash','${ids.user}');
      UPDATE sow_documents SET current_version_id='${ids.version}' WHERE id='${ids.document}';
      INSERT INTO scope_boundary_maps
        (id,organization_id,project_id,sow_version_id,name,status,created_by,approved_by,approved_at)
        VALUES ('${ids.map}','${ids.organization}','${ids.project}','${ids.version}','Approved','Active','${ids.user}','${ids.user}',now());
      INSERT INTO scope_boundary_items
        (id,organization_id,boundary_map_id,boundary_type,category,description,evidence,ordinal)
        VALUES ('81000000-0000-4000-8000-000000000010','${ids.organization}','${ids.map}','Limit','Pages','Five pages','Five pages only',0);
      UPDATE projects SET active_sow_version_id='${ids.version}',active_boundary_map_id='${ids.map}' WHERE id='${ids.project}';
      INSERT INTO communication_connections
        (id,organization_id,provider,name,status,configuration)
        VALUES ('${ids.connection}','${ids.organization}','Slack','Client Slack','Connected','{"projectId":"${ids.project}"}');
      INSERT INTO client_messages
        (id,organization_id,project_id,source,message_text,content_sha256)
        VALUES ('${ids.message}','${ids.organization}','${ids.project}','Slack','Please add a portal','message-hash');
      INSERT INTO project_automation_settings
        (id,organization_id,project_id,status,sync_interval_minutes,next_run_at,enabled_by_user_id)
        VALUES ('${ids.setting}','${ids.organization}','${ids.project}','Active',15,now()-interval '1 minute','${ids.user}');
    `);
  });

  afterAll(async () => {
    delete process.env.AI_PROVIDER;
    resetPoolForTesting();
    await db.close();
  });

  it("claims one due project and pins automated analysis to approved evidence", async () => {
    const run = await claimDueAutomation("worker-a");

    expect(run).not.toBeNull();
    expect(await claimDueAutomation("worker-b")).toBeNull();

    const result = await executeAutomationRun(run!, {
      syncConnection: async () => ({
        insertedMessageIds: [ids.message, ids.message],
      }),
      processJob: async () => ({ processed: true, findingId: "finding" }),
    });

    expect(result).toMatchObject({ inserted: 1, queued: 1, findings: 1 });
    const job = await db.query<{
      trigger_source: string;
      sow_version_id: string;
      boundary_map_id: string;
      requested_by: string;
    }>(
      "SELECT trigger_source,sow_version_id,boundary_map_id,requested_by FROM analysis_jobs",
    );
    const persistedRun = await db.query<{ status: string; jobs_queued: number }>(
      "SELECT status,jobs_queued FROM automation_runs",
    );

    expect(job.rows[0]).toEqual({
      trigger_source: "Automation",
      sow_version_id: ids.version,
      boundary_map_id: ids.map,
      requested_by: ids.user,
    });
    expect(persistedRun.rows[0]).toEqual({ status: "Succeeded", jobs_queued: 1 });
  });

  it("deduplicates connector results before applying the controlled queue limit", async () => {
    const run = await claimDueAutomation("worker-a");
    const repeatedIds = Array.from({ length: 150 }, () => ids.message);
    const result = await executeAutomationRun(run!, {
      syncConnection: async () => ({ insertedMessageIds: repeatedIds }),
      processJob: async () => ({ processed: true, findingId: "finding" }),
    });

    expect(result).toMatchObject({ inserted: 1, queued: 1, findings: 1 });
  });

  it("does not claim paused projects", async () => {
    await db.query(
      "UPDATE project_automation_settings SET status='Paused' WHERE id=$1",
      [ids.setting],
    );

    expect(await claimDueAutomation("worker-a")).toBeNull();
  });

  it("rejects a cross-organization automation actor at the database boundary", async () => {
    const otherOrganization = "81000000-0000-4000-8000-000000000020";
    const otherUser = "81000000-0000-4000-8000-000000000021";

    await db.query(
      "INSERT INTO organizations (id,name,slug) VALUES ($1,'Other','other')",
      [otherOrganization],
    );
    await db.query(
      "INSERT INTO users (id,email,normalized_email,password_hash,display_name) VALUES ($1,'other@example.test','other@example.test','unused','Other User')",
      [otherUser],
    );
    await db.query(
      "INSERT INTO organization_memberships (organization_id,user_id,role) VALUES ($1,$2,'Owner')",
      [otherOrganization, otherUser],
    );

    await expect(
      db.query(
        "UPDATE project_automation_settings SET enabled_by_user_id=$1 WHERE id=$2",
        [otherUser, ids.setting],
      ),
    ).rejects.toThrow(/project organization/);
  });

  it("pauses monitoring when the enabling professional loses management authority", async () => {
    await db.query(
      "UPDATE organization_memberships SET role='Reviewer' WHERE organization_id=$1 AND user_id=$2",
      [ids.organization, ids.user],
    );

    expect(await claimDueAutomation("worker-a")).toBeNull();
    const setting = await db.query<{ status: string; last_error: string }>(
      "SELECT status,last_error FROM project_automation_settings WHERE id=$1",
      [ids.setting],
    );

    expect(setting.rows[0].status).toBe("Needs Attention");
    expect(setting.rows[0].last_error).toContain("Owner or Admin");
  });

  it("moves an active project to Needs Attention when approved evidence disappears", async () => {
    await db.query(
      "UPDATE projects SET active_boundary_map_id=NULL WHERE id=$1",
      [ids.project],
    );

    expect(await claimDueAutomation("worker-a")).toBeNull();
    const setting = await db.query<{ status: string; last_error: string }>(
      "SELECT status,last_error FROM project_automation_settings WHERE id=$1",
      [ids.setting],
    );

    expect(setting.rows[0].status).toBe("Needs Attention");
    expect(setting.rows[0].last_error).toContain("approved current SOW boundary");
  });

  it("recovers only expired worker leases and schedules a retry", async () => {
    const run = await claimDueAutomation("worker-a");

    await db.query(
      "UPDATE automation_runs SET lease_expires_at=now()-interval '1 minute' WHERE id=$1",
      [run!.runId],
    );
    expect(await recoverExpiredAutomationRuns()).toBe(1);
    const recovered = await db.query<{ status: string }>(
      "SELECT status FROM automation_runs WHERE id=$1",
      [run!.runId],
    );

    expect(recovered.rows[0].status).toBe("Failed");
    expect(await claimDueAutomation("worker-b")).not.toBeNull();
  });
});
