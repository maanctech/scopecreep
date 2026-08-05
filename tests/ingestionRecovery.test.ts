import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn(), transaction: vi.fn() }));

vi.mock("@/lib/db/client", () => ({
  query: mocks.query,
  transaction: mocks.transaction,
}));

import { recoverStaleEmailJobs } from "@/lib/ingestion/email";

const organizationId = "10000000-0000-4000-8000-000000000001";
const connectionId = "10000000-0000-4000-8000-000000000002";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.mockImplementation(
    async (work: (client: { query: typeof mocks.query }) => unknown) =>
      work({ query: mocks.query }),
  );
});

describe("IMAP job recovery", () => {
  it("atomically fails stale running jobs and marks their connection for attention", async () => {
    mocks.query
      .mockResolvedValueOnce({
        rows: [{ connection_id: connectionId }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await expect(recoverStaleEmailJobs(organizationId)).resolves.toBe(1);
    expect(mocks.query.mock.calls[0]?.[0]).toContain("status='Running'");
    expect(mocks.query.mock.calls[0]?.[0]).toContain("started_at < now()");
    expect(mocks.query.mock.calls[0]?.[1]).toEqual([organizationId, 30]);
    expect(mocks.query.mock.calls[1]?.[0]).toContain(
      "status='Needs Attention'",
    );
    expect(mocks.query.mock.calls[1]?.[1]).toEqual([
      organizationId,
      [connectionId],
    ]);
  });

  it("leaves fresh running jobs and connection state untouched", async () => {
    mocks.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await expect(recoverStaleEmailJobs(organizationId)).resolves.toBe(0);
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });
});
