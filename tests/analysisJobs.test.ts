import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  analyze: vi.fn(),
  currentAuthContext: vi.fn(),
  databaseQuery: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/analysis", () => ({
  analyzeClientRequestDetailed: mocks.analyze,
}));

vi.mock("@/lib/auth/current", () => ({
  currentAuthContext: mocks.currentAuthContext,
}));

vi.mock("@/lib/db/client", () => ({
  query: mocks.databaseQuery,
  transaction: mocks.transaction,
}));

import {
  cancelAnalysisJob,
  processAnalysisJob,
  queueAnalysisJobs,
  recoverAnalysisJob,
  retryAnalysisJob,
  startOverAnalysisJob,
} from "@/lib/analysisJobs/service";

const organizationId = "10000000-0000-4000-8000-000000000001";
const userId = "10000000-0000-4000-8000-000000000002";
const projectId = "10000000-0000-4000-8000-000000000003";
const messageId = "10000000-0000-4000-8000-000000000004";
const sowVersionId = "10000000-0000-4000-8000-000000000005";
const boundaryMapId = "10000000-0000-4000-8000-000000000006";
const jobId = "10000000-0000-4000-8000-000000000007";

function result(rows: Record<string, unknown>[] = [], rowCount = rows.length) {
  return { rows, rowCount };
}

function approvedProject() {
  return {
    id: projectId,
    client_name: "ApertureOps",
    project_name: "Website redesign",
    hourly_rate_cents: 17_500,
    is_demo: false,
    active_sow_version_id: sowVersionId,
    active_boundary_map_id: boundaryMapId,
    content: "The engagement includes five website pages and excludes customer portals.",
    content_sha256: "sow-hash",
  };
}

function boundaryItem() {
  return {
    boundary_type: "Excluded",
    category: "Functionality",
    description: "Customer portals are excluded.",
    evidence: "excludes customer portals",
  };
}

function successfulAnalysis() {
  return {
    analysis: {
      classification: "Out of Scope",
      confidence_score: 0.94,
      reasoning: "The requested portal is explicitly excluded.",
      relevant_sow_sections: ["excludes customer portals"],
      request_type: "Engineering",
      estimated_hours: 10,
      estimated_revenue: 1750,
      suggested_change_order: "We can scope the portal separately.",
      internal_note: "Human approval required.",
    },
    metadata: {
      provider: "demo",
      model: "deterministic",
      promptVersion: "scope-audit-v3-approved-boundary",
      inputHash: "analysis-hash",
      latencyMs: 4,
      inputCharacters: 300,
      outputCharacters: 200,
      attempts: 1,
      status: "Succeeded",
      errorMessage: null,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.currentAuthContext.mockResolvedValue({
    sessionId: "session",
    userId,
    organizationId,
    organizationName: "Test firm",
    email: "owner@example.test",
    displayName: "Owner",
    role: "Owner",
    isSystemAdmin: false,
    expiresAt: "2099-01-01T00:00:00.000Z",
  });
  mocks.transaction.mockImplementation(
    async (work: (client: { query: typeof mocks.databaseQuery }) => unknown) =>
      work({ query: mocks.databaseQuery }),
  );
});

describe("controlled analysis jobs", () => {
  it("pins queued jobs to the approved SOW and boundary map", async () => {
    mocks.databaseQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM projects p")) return result([approvedProject()]);

      if (sql.includes("FROM scope_boundary_items"))
        return result([boundaryItem()]);

      if (sql.includes("FROM client_messages m"))
        return result([
          {
            id: messageId,
            message_text: "Can you add a customer portal?",
            content_sha256: "message-hash",
          },
        ]);

      if (sql.includes("INSERT INTO analysis_jobs")) return result([{ id: jobId }]);

      return result([], 1);
    });

    const queued = await queueAnalysisJobs({ projectId, messageIds: [messageId] });

    expect(queued).toMatchObject({ selected: 1, queued: 1, skipped: 0 });
    const insert = mocks.databaseQuery.mock.calls.find(([sql]) =>
      String(sql).includes("INSERT INTO analysis_jobs"),
    );

    expect(insert?.[1]).toEqual(
      expect.arrayContaining([sowVersionId, boundaryMapId, userId]),
    );
    const messageQuery = mocks.databaseQuery.mock.calls.find(([sql]) =>
      String(sql).includes("FROM client_messages m"),
    );

    expect(messageQuery?.[0]).toContain("NOT EXISTS");
  });

  it("creates one reviewable finding and one billing audit event transactionally", async () => {
    const job = {
      id: jobId,
      organization_id: organizationId,
      project_id: projectId,
      client_message_id: messageId,
      sow_version_id: sowVersionId,
      boundary_map_id: boundaryMapId,
    };

    mocks.databaseQuery.mockImplementation(async (sql: string) => {
      if (sql.startsWith("UPDATE analysis_jobs SET status='Running'"))
        return result([job]);

      if (sql.includes("SELECT m.message_text"))
        return result([
          {
            message_text: "Can you add a customer portal?",
            content_sha256: "message-hash",
            hourly_rate_cents: 17_500,
            is_demo: false,
            content: approvedProject().content,
            already_analyzed: false,
          },
        ]);

      if (sql.includes("FROM scope_boundary_items"))
        return result([boundaryItem()]);

      if (sql.includes("SELECT status,cancel_requested_at"))
        return result([{ status: "Running", cancel_requested_at: null }]);

      return result([], 1);
    });
    mocks.analyze.mockResolvedValue(successfulAnalysis());

    await expect(processAnalysisJob(organizationId, jobId)).resolves.toMatchObject({
      processed: true,
    });
    expect(mocks.analyze).toHaveBeenCalledWith(
      expect.objectContaining({
        sowText: approvedProject().content,
        boundaryMapText: expect.stringContaining("Customer portals are excluded"),
        messageText: "Can you add a customer portal?",
        hourlyRate: 175,
        signal: expect.any(AbortSignal),
      }),
    );
    expect(
      mocks.databaseQuery.mock.calls.filter(([sql]) =>
        String(sql).includes("INSERT INTO scope_findings"),
      ),
    ).toHaveLength(1);
    expect(
      mocks.databaseQuery.mock.calls.filter(([sql]) =>
        String(sql).includes("INSERT INTO billing_events"),
      ),
    ).toHaveLength(1);
  });

  it("does not persist a fallback finding when AI validation fails", async () => {
    mocks.databaseQuery.mockImplementation(async (sql: string) => {
      if (sql.startsWith("UPDATE analysis_jobs SET status='Running'"))
        return result([
          {
            id: jobId,
            project_id: projectId,
            client_message_id: messageId,
            sow_version_id: sowVersionId,
            boundary_map_id: boundaryMapId,
          },
        ]);

      if (sql.includes("SELECT m.message_text"))
        return result([
          {
            message_text: "Can you add a customer portal?",
            hourly_rate_cents: 17_500,
            is_demo: false,
            content: approvedProject().content,
            already_analyzed: false,
          },
        ]);

      if (sql.includes("FROM scope_boundary_items"))
        return result([boundaryItem()]);

      return result([], 1);
    });
    mocks.analyze.mockResolvedValue({
      ...successfulAnalysis(),
      metadata: {
        ...successfulAnalysis().metadata,
        status: "Failed",
        errorMessage: "invalid JSON",
      },
    });

    await expect(processAnalysisJob(organizationId, jobId)).resolves.toEqual({
      processed: false,
    });
    expect(
      mocks.databaseQuery.mock.calls.some(([sql]) =>
        String(sql).includes("INSERT INTO scope_findings"),
      ),
    ).toBe(false);
    expect(
      mocks.databaseQuery.mock.calls.some(([sql]) =>
        String(sql).includes("SET status='Failed'"),
      ),
    ).toBe(true);
  });

  it("refuses retries after the persisted retry limit", async () => {
    mocks.databaseQuery.mockResolvedValue(result([]));

    await expect(retryAnalysisJob(jobId)).rejects.toThrow(
      "This analysis job cannot be retried.",
    );
    expect(mocks.databaseQuery.mock.calls[0]?.[0]).toContain(
      "attempt_count < j.max_attempts",
    );
  });

  it("recovers only a running job older than the configured threshold", async () => {
    mocks.databaseQuery.mockResolvedValueOnce(
      result([{ id: jobId, status: "Failed" }]),
    );

    await expect(recoverAnalysisJob(jobId)).resolves.toEqual({
      status: "Failed",
    });
    expect(mocks.databaseQuery.mock.calls[0]?.[0]).toContain(
      "j.status='Running'",
    );
    expect(mocks.databaseQuery.mock.calls[0]?.[0]).toContain(
      "j.started_at < now()",
    );

    mocks.databaseQuery.mockResolvedValueOnce(result([]));
    await expect(recoverAnalysisJob(jobId)).rejects.toThrow(
      "Only a stale running analysis job can be recovered.",
    );
  });

  it("starts an exhausted job over once with current approved evidence", async () => {
    mocks.databaseQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM analysis_jobs j") && sql.includes("FOR UPDATE"))
        return result([
          {
            id: jobId,
            organization_id: organizationId,
            project_id: projectId,
            client_message_id: messageId,
            sow_version_id: "old-sow",
            boundary_map_id: "old-map",
            status: "Failed",
            attempt_count: 3,
            max_attempts: 3,
            input_references: {},
            message_text: "Can you add a portal?",
            content_sha256: "message-hash",
          },
        ]);

      if (sql.includes("FROM scope_findings")) return result([]);

      if (sql.includes("FROM projects p")) return result([approvedProject()]);

      if (sql.includes("FROM scope_boundary_items"))
        return result([boundaryItem()]);

      if (sql.startsWith("UPDATE analysis_jobs SET status='Queued'"))
        return result([{ id: jobId, batch_id: "new-batch" }]);

      return result([], 1);
    });

    await expect(startOverAnalysisJob(jobId)).resolves.toMatchObject({
      jobId,
      batchId: "new-batch",
    });
    const update = mocks.databaseQuery.mock.calls.find(([sql]) =>
      String(sql).startsWith("UPDATE analysis_jobs SET status='Queued'"),
    );

    expect(update?.[0]).toContain("attempt_count=0");
    expect(update?.[1]).toEqual(
      expect.arrayContaining([sowVersionId, boundaryMapId]),
    );
    expect(String(update?.[1]?.[7])).toContain('"startOverCount":1');
  });

  it("finalizes a running cancellation even if the worker disappears", async () => {
    mocks.databaseQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT id,status FROM analysis_jobs"))
        return result([{ id: jobId, status: "Running" }]);

      return result([], 1);
    });

    await expect(cancelAnalysisJob(jobId)).resolves.toEqual({
      status: "Cancelled",
    });
    expect(
      mocks.databaseQuery.mock.calls.some(([sql]) =>
        String(sql).includes("status='Cancelled',progress=100"),
      ),
    ).toBe(true);
  });
});
