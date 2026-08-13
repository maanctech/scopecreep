import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { query } from "@/lib/db/client";
import { withSystemAccess, withTenant } from "@/lib/db/tenantContext";
import type { AuthContext } from "@/lib/auth/types";
import { startTestDatabase, stopTestDatabase, type TestDatabase } from "./support/testDatabase";

vi.mock("@/lib/auth/current", () => ({
  currentAuthContext: vi.fn()
}));

import { currentAuthContext } from "@/lib/auth/current";
import { createProject } from "@/lib/store/postgres";
import { generateSowReview, saveBoundaryMap } from "@/lib/sow/service";
import { importManualMessages } from "@/lib/ingestion/service";
import { parseManualImport } from "@/lib/ingestion/manual";
import { queueAnalysisJobs } from "@/lib/analysisJobs/queue";
import { drainQueuedAnalysisJobs, recoverStaleAnalysisJobs } from "@/lib/analysisJobs/recovery";
import { processAnalysisBatch } from "@/lib/analysisJobs/processing";
import { GET as scheduledDrain } from "@/app/api/cron/analysis-jobs/route";

const ORGANIZATION_A = "70000000-0000-4000-8000-000000000001";
const ORGANIZATION_B = "70000000-0000-4000-8000-000000000002";
const USER_A = "70000000-0000-4000-8000-000000000011";
const USER_B = "70000000-0000-4000-8000-000000000012";

const AUTH_CONTEXT_A: AuthContext = {
  sessionId: "70000000-0000-4000-8000-000000000021",
  userId: USER_A,
  organizationId: ORGANIZATION_A,
  organizationName: "Harbour Consulting",
  email: "hana@example.com",
  displayName: "Hana Ortiz",
  role: "Owner",
  isSystemAdmin: false,
  expiresAt: "2099-01-01T00:00:00.000Z"
};

const AUTH_CONTEXT_B: AuthContext = {
  sessionId: "70000000-0000-4000-8000-000000000022",
  userId: USER_B,
  organizationId: ORGANIZATION_B,
  organizationName: "Kestrel Works",
  email: "kai@example.com",
  displayName: "Kai Lindqvist",
  role: "Owner",
  isSystemAdmin: false,
  expiresAt: "2099-01-01T00:00:00.000Z"
};

const SOW_TEXT = [
  "1. Scope",
  "Deliver the reporting dashboard and one round of design revisions.",
  "2. Exclusions",
  "Data migration is out of scope. Customer portals are out of scope."
].join("\n");

const MESSAGES = [
  "Please also add a customer portal for our end clients.",
  "Can you handle the data migration from the old system too?",
  "We would like a customer portal login page as well."
];

type Fixture = { organizationId: string; projectId: string; messageIds: string[] };

let database: TestDatabase;

function actingAs(context: AuthContext) {
  vi.mocked(currentAuthContext).mockResolvedValue(context);
}

const inspect: typeof query = (text, values) => withSystemAccess(() => query(text, values));

/**
 * One analysis job per communication is a database-level uniqueness rule, so a
 * test that wants a fresh queue needs fresh communications rather than a reset.
 */
async function buildFixture(context: AuthContext, clientName: string): Promise<Fixture> {
  actingAs(context);

  const organizationId = context.organizationId;
  const project = await withTenant(organizationId, () => createProject({
    client_name: clientName,
    project_name: "Reporting Dashboard",
    hourly_rate: 180,
    sow_text: SOW_TEXT
  }));
  const review = await withTenant(organizationId, () => generateSowReview(project.id));

  await withTenant(organizationId, () => saveBoundaryMap({
    projectId: project.id,
    mapId: review.mapId,
    items: [
      {
        boundaryType: "Excluded",
        category: "Functionality",
        description: "Customer portals are excluded.",
        evidence: "Customer portals are out of scope."
      },
      {
        boundaryType: "Excluded",
        category: "Data",
        description: "Data migration is excluded.",
        evidence: "Data migration is out of scope."
      }
    ],
    approve: true
  }));

  await withTenant(organizationId, () => importManualMessages({
    projectId: project.id,
    preview: parseManualImport({ format: "Text", content: MESSAGES.join("\n\n---\n\n") })
  }));

  const messages = await inspect<{ id: string }>(
    "SELECT id FROM client_messages WHERE organization_id=$1 AND project_id=$2 ORDER BY created_at,id",
    [organizationId, project.id]
  );

  return { organizationId, projectId: project.id, messageIds: messages.rows.map((row) => row.id) };
}

async function queueFor(fixture: Fixture, context: AuthContext, messageCount: number) {
  actingAs(context);

  return withTenant(fixture.organizationId, () => queueAnalysisJobs({
    projectId: fixture.projectId,
    messageIds: fixture.messageIds.slice(0, messageCount)
  }));
}

/**
 * The state a killed worker leaves behind: claimed, counted against its
 * attempts, and never updated again.
 */
async function strandAsRunning(jobId: string, options: { minutesAgo: number; attemptCount: number }) {
  await inspect(
    `UPDATE analysis_jobs
     SET status='Running',progress=5,attempt_count=$1,
         started_at=now() - make_interval(mins => $2),
         updated_at=now() - make_interval(mins => $2)
     WHERE id=$3`,
    [options.attemptCount, options.minutesAgo, jobId]
  );
}

async function statusOf(jobId: string) {
  const job = await inspect<{ status: string; attempt_count: number; error_message: string | null }>(
    "SELECT status,attempt_count,error_message FROM analysis_jobs WHERE id=$1",
    [jobId]
  );

  return job.rows[0];
}

async function outstandingJobsFor(fixture: Fixture) {
  const outstanding = await inspect<{ count: string }>(
    "SELECT count(*)::int AS count FROM analysis_jobs WHERE project_id=$1 AND status IN ('Queued','Running')",
    [fixture.projectId]
  );

  return Number(outstanding.rows[0].count);
}

/**
 * Findings and billing events are append-only by design, so isolation retires
 * the previous test's outstanding jobs instead of deleting anything. The drain
 * reads the whole queue, and leftovers would otherwise be the work it found.
 */
async function retireOutstandingJobs() {
  await inspect(
    "UPDATE analysis_jobs SET status='Cancelled',progress=100,completed_at=now(),updated_at=now() WHERE status IN ('Queued','Running')",
    []
  );
}

beforeAll(async () => {
  database = await startTestDatabase();

  await withSystemAccess(async () => {
    await query(
      "INSERT INTO organizations (id, name, slug) VALUES ($1,$2,$3), ($4,$5,$6)",
      [ORGANIZATION_A, "Harbour Consulting", "harbour-consulting", ORGANIZATION_B, "Kestrel Works", "kestrel-works"]
    );
    await query(
      `INSERT INTO users (id, email, normalized_email, display_name)
       VALUES ($1,$2,$3,$4), ($5,$6,$7,$8)`,
      [USER_A, "hana@example.com", "hana@example.com", "Hana Ortiz",
       USER_B, "kai@example.com", "kai@example.com", "Kai Lindqvist"]
    );
    await query(
      "INSERT INTO organization_memberships (organization_id, user_id, role) VALUES ($1,$2,'Owner'), ($3,$4,'Owner')",
      [ORGANIZATION_A, USER_A, ORGANIZATION_B, USER_B]
    );
  });

});

afterAll(async () => {
  await stopTestDatabase(database);
});

beforeEach(async () => {
  await retireOutstandingJobs();
});

describe("recovering analysis jobs whose worker stopped", () => {
  it("returns a job stranded in Running to the queue", async () => {
    const harbour = await buildFixture(AUTH_CONTEXT_A, "Harbour Client");
    const queued = await queueFor(harbour, AUTH_CONTEXT_A, 1);
    const [jobId] = queued.jobIds;

    await strandAsRunning(jobId, { minutesAgo: 30, attemptCount: 1 });

    await expect(recoverStaleAnalysisJobs({ staleAfterMinutes: 10 })).resolves.toMatchObject({
      requeued: 1,
      failed: 0
    });
    expect(await statusOf(jobId)).toMatchObject({ status: "Queued", attempt_count: 1 });
  });

  it("fails a stranded job that has already used its last attempt", async () => {
    const harbour = await buildFixture(AUTH_CONTEXT_A, "Harbour Client");
    const queued = await queueFor(harbour, AUTH_CONTEXT_A, 1);
    const [jobId] = queued.jobIds;

    await strandAsRunning(jobId, { minutesAgo: 30, attemptCount: 3 });

    await expect(recoverStaleAnalysisJobs({ staleAfterMinutes: 10 })).resolves.toMatchObject({
      requeued: 0,
      failed: 1
    });

    const job = await statusOf(jobId);

    expect(job.status).toBe("Failed");
    expect(job.error_message).toContain("stopped");
  });

  it("leaves a running job alone while its worker is still reporting progress", async () => {
    const harbour = await buildFixture(AUTH_CONTEXT_A, "Harbour Client");
    const queued = await queueFor(harbour, AUTH_CONTEXT_A, 1);
    const [jobId] = queued.jobIds;

    await strandAsRunning(jobId, { minutesAgo: 2, attemptCount: 1 });

    await expect(recoverStaleAnalysisJobs({ staleAfterMinutes: 10 })).resolves.toMatchObject({
      requeued: 0,
      failed: 0
    });
    expect(await statusOf(jobId)).toMatchObject({ status: "Running" });
  });

  it("leaves an already finished job untouched", async () => {
    const harbour = await buildFixture(AUTH_CONTEXT_A, "Harbour Client");
    const queued = await queueFor(harbour, AUTH_CONTEXT_A, 1);
    const [jobId] = queued.jobIds;

    await inspect(
      "UPDATE analysis_jobs SET status='Succeeded',progress=100,completed_at=now(),updated_at=now() - make_interval(mins => 90) WHERE id=$1",
      [jobId]
    );

    await recoverStaleAnalysisJobs({ staleAfterMinutes: 10 });

    expect(await statusOf(jobId)).toMatchObject({ status: "Succeeded" });
  });
});

describe("bounding how long one analysis batch runs", () => {
  it("stops starting new jobs once the time budget is spent and leaves the rest queued", async () => {
    const harbour = await buildFixture(AUTH_CONTEXT_A, "Harbour Client");
    const queued = await queueFor(harbour, AUTH_CONTEXT_A, 3);

    expect(queued.queued).toBe(3);

    const batch = await processAnalysisBatch(harbour.organizationId, queued.batchId, { budgetMs: 0 });

    expect(batch.processed).toHaveLength(1);
    expect(batch.remaining).toBe(2);

    const stillQueued = await inspect<{ count: string }>(
      "SELECT count(*)::text AS count FROM analysis_jobs WHERE batch_id=$1 AND status='Queued'",
      [queued.batchId]
    );

    expect(stillQueued.rows[0].count).toBe("2");
  });

  it("works through the whole batch when the budget allows", async () => {
    const harbour = await buildFixture(AUTH_CONTEXT_A, "Harbour Client");
    const queued = await queueFor(harbour, AUTH_CONTEXT_A, 3);
    const batch = await processAnalysisBatch(harbour.organizationId, queued.batchId, { budgetMs: 60_000 });

    expect(batch.processed).toHaveLength(3);
    expect(batch.remaining).toBe(0);
  });
});

describe("draining analysis jobs left in the queue", () => {
  it("finishes jobs an earlier batch abandoned", async () => {
    const harbour = await buildFixture(AUTH_CONTEXT_A, "Harbour Client");
    const queued = await queueFor(harbour, AUTH_CONTEXT_A, 3);

    await processAnalysisBatch(harbour.organizationId, queued.batchId, { budgetMs: 0 });

    await expect(drainQueuedAnalysisJobs({ budgetMs: 60_000, limit: 50 })).resolves.toMatchObject({
      processed: 2
    });
    expect(await outstandingJobsFor(harbour)).toBe(0);
  });

  it("writes each organization's finding against that organization's own project", async () => {
    const harbour = await buildFixture(AUTH_CONTEXT_A, "Harbour Client");
    const kestrel = await buildFixture(AUTH_CONTEXT_B, "Kestrel Client");

    await queueFor(harbour, AUTH_CONTEXT_A, 2);
    await queueFor(kestrel, AUTH_CONTEXT_B, 2);

    await drainQueuedAnalysisJobs({ budgetMs: 60_000, limit: 50 });

    const misplaced = await inspect<{ count: string }>(
      `SELECT count(*)::text AS count FROM scope_findings f
       JOIN projects p ON p.id=f.project_id
       WHERE p.organization_id <> f.organization_id`,
      []
    );

    expect(misplaced.rows[0].count).toBe("0");

    actingAs(AUTH_CONTEXT_A);

    const harbourFindings = await withTenant(harbour.organizationId, () => query<{ project_id: string }>(
      "SELECT project_id FROM scope_findings WHERE project_id=$1",
      [harbour.projectId]
    ));

    expect(harbourFindings.rows).toHaveLength(2);

    const leakedIntoHarbour = await withTenant(harbour.organizationId, () => query<{ count: string }>(
      "SELECT count(*)::text AS count FROM scope_findings WHERE project_id=$1",
      [kestrel.projectId]
    ));

    expect(leakedIntoHarbour.rows[0].count).toBe("0");

    actingAs(AUTH_CONTEXT_B);

    const kestrelFindings = await withTenant(kestrel.organizationId, () => query<{ project_id: string }>(
      "SELECT project_id FROM scope_findings WHERE project_id=$1",
      [kestrel.projectId]
    ));

    expect(kestrelFindings.rows).toHaveLength(2);
  });

  it("stops drawing new work once its own time budget is spent", async () => {
    const harbour = await buildFixture(AUTH_CONTEXT_A, "Harbour Client");

    await queueFor(harbour, AUTH_CONTEXT_A, 3);

    await expect(drainQueuedAnalysisJobs({ budgetMs: 0, limit: 50 })).resolves.toMatchObject({
      processed: 1
    });
    expect(await outstandingJobsFor(harbour)).toBe(2);
  });
});

describe("the scheduled endpoint that runs recovery and the drain", () => {
  const originalSecret = process.env.CRON_SECRET;
  const SECRET = "a-scheduled-secret-of-at-least-32-characters";

  function scheduledRequest(credential?: string) {
    return new Request("http://local.test/api/cron/analysis-jobs", {
      headers: credential ? { authorization: `Bearer ${credential}` } : {}
    });
  }

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalSecret;
  });

  it("refuses a caller offering no credential", async () => {
    process.env.CRON_SECRET = SECRET;

    expect((await scheduledDrain(scheduledRequest())).status).toBe(401);
  });

  it("refuses a caller offering the wrong credential", async () => {
    process.env.CRON_SECRET = SECRET;

    expect((await scheduledDrain(scheduledRequest("not-the-scheduled-secret-value"))).status).toBe(401);
  });

  it("refuses every caller when no credential is configured", async () => {
    delete process.env.CRON_SECRET;

    expect((await scheduledDrain(scheduledRequest(SECRET))).status).toBe(401);
  });

  it("recovers a stranded job and finishes it for a caller offering the credential", async () => {
    process.env.CRON_SECRET = SECRET;

    const harbour = await buildFixture(AUTH_CONTEXT_A, "Harbour Client");
    const queued = await queueFor(harbour, AUTH_CONTEXT_A, 1);

    await strandAsRunning(queued.jobIds[0], { minutesAgo: 60, attemptCount: 1 });

    const response = await scheduledDrain(scheduledRequest(SECRET));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      recovered: { requeued: 1, failed: 0 },
      drained: { processed: 1 }
    });
    expect(await statusOf(queued.jobIds[0])).toMatchObject({ status: "Succeeded" });
  });
});
