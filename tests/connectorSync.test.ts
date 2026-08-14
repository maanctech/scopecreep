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
import {
  configurePlatformConnection,
  syncPlatformConnection,
  testPlatformConnection
} from "@/lib/connectors/service";

const ORGANIZATION_A = "70000000-0000-4000-8000-000000000001";
const ORGANIZATION_B = "70000000-0000-4000-8000-000000000002";
const USER_A = "70000000-0000-4000-8000-000000000011";
const USER_B = "70000000-0000-4000-8000-000000000012";
const CHANNEL = "C0HARBOUR01";

const AUTH_CONTEXT_A: AuthContext = {
  sessionId: "70000000-0000-4000-8000-000000000021",
  userId: USER_A,
  organizationId: ORGANIZATION_A,
  organizationName: "Harbour Consulting",
  email: "hana@example.com",
  displayName: "Hana Ortiz",
  role: "Owner",
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
  expiresAt: "2099-01-01T00:00:00.000Z"
};

function actingAs(context: AuthContext) {
  vi.mocked(currentAuthContext).mockResolvedValue(context);
}

const inspect: typeof query = (text, values) => withSystemAccess("diagnostics", () => query(text, values));

/**
 * The fake stops at the network boundary rather than at the connector, so the
 * Slack module's own URL building, pagination, sender lookup, and message
 * normalization all stay in the path under test.
 */
const slackHandlers = new Map<string, (parameters: URLSearchParams) => unknown>();
const slackRequests: Array<{ method: string; parameters: URLSearchParams }> = [];

function slackAnswers(method: string, handler: (parameters: URLSearchParams) => unknown) {
  slackHandlers.set(method, handler);
}

function slackFetch(input: RequestInfo | URL) {
  const url = new URL(String(input));
  const method = url.pathname.replace("/api/", "");

  slackRequests.push({ method, parameters: url.searchParams });

  const handler = slackHandlers.get(method);

  if (!handler) return Promise.resolve(new Response("no such Slack method", { status: 404 }));

  return Promise.resolve(Response.json(handler(url.searchParams)));
}

function requestedParameter(method: string, name: string) {
  return slackRequests.find((request) => request.method === method)?.parameters.get(name);
}

let database: TestDatabase;
let projectA: string;
let masterKey: string | undefined;
let realFetch: typeof fetch;

async function newSlackConnection(name: string) {
  return withTenant(ORGANIZATION_A, () => configurePlatformConnection({
    provider: "Slack",
    projectId: projectA,
    name,
    channelIds: [CHANNEL],
    botToken: "xoxb-test-token-0123456789"
  }));
}

async function connectedSlackConnection(name: string) {
  const connection = await newSlackConnection(name);

  slackAnswers("auth.test", () => ({ ok: true, team: "Harbour Workspace" }));
  slackAnswers("conversations.info", () => ({ ok: true }));
  await testPlatformConnection(connection.id);

  return connection.id;
}

beforeAll(async () => {
  database = await startTestDatabase();
  masterKey = process.env.SCOPELEDGER_MASTER_KEY;
  process.env.SCOPELEDGER_MASTER_KEY = Buffer.alloc(32, 5).toString("base64");
  realFetch = globalThis.fetch;

  await withSystemAccess("diagnostics", async () => {
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

  actingAs(AUTH_CONTEXT_A);
  projectA = (await withTenant(ORGANIZATION_A, () => createProject({
    client_name: "Harbour Client",
    project_name: "Reporting Dashboard",
    hourly_rate: 180,
    sow_text: "1. Scope\nDeliver the reporting dashboard.\n2. Exclusions\nData migration is out of scope."
  }))).id;
});

beforeEach(() => {
  globalThis.fetch = slackFetch as unknown as typeof fetch;
  slackHandlers.clear();
  slackRequests.length = 0;
  actingAs(AUTH_CONTEXT_A);
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

afterAll(async () => {
  if (masterKey === undefined) delete process.env.SCOPELEDGER_MASTER_KEY;
  else process.env.SCOPELEDGER_MASTER_KEY = masterKey;

  await stopTestDatabase(database);
});

describe("platform connection testing", () => {
  it("marks a connection connected and reports the workspace the token belongs to", async () => {
    const connection = await newSlackConnection("Harbour Slack");

    slackAnswers("auth.test", () => ({ ok: true, team: "Harbour Workspace" }));
    slackAnswers("conversations.info", () => ({ ok: true }));

    const result = await testPlatformConnection(connection.id);

    expect(result.accountLabel).toBe("Harbour Workspace");

    const stored = await inspect<{ status: string; connection_verified_at: string | null }>(
      "SELECT status, connection_verified_at FROM communication_connections WHERE id=$1",
      [connection.id]
    );

    expect(stored.rows[0].status).toBe("Connected");
    expect(stored.rows[0].connection_verified_at).not.toBeNull();
  });

  it("leaves a connection needing attention when the provider rejects the token", async () => {
    const connection = await newSlackConnection("Rejected Slack");

    slackAnswers("auth.test", () => ({ ok: false, error: "invalid_auth" }));

    await expect(testPlatformConnection(connection.id)).rejects.toThrow(/connection test failed/);

    const stored = await inspect<{ status: string; last_error: string | null }>(
      "SELECT status, last_error FROM communication_connections WHERE id=$1",
      [connection.id]
    );

    expect(stored.rows[0].status).toBe("Needs Attention");
    expect(stored.rows[0].last_error).toMatch(/Verify credentials/);
  });

  it("never repeats the provider's own error text, which can carry token detail", async () => {
    const connection = await newSlackConnection("Leaky Slack");

    slackAnswers("auth.test", () => ({ ok: false, error: "invalid_auth for xoxb-test-token-0123456789" }));

    const raised = await testPlatformConnection(connection.id).catch((error: Error) => error.message);

    expect(raised).not.toContain("xoxb");

    const stored = await inspect<{ last_error: string | null }>(
      "SELECT last_error FROM communication_connections WHERE id=$1",
      [connection.id]
    );

    expect(stored.rows[0].last_error).not.toContain("xoxb");
  });

  it("refuses a connection belonging to another organization", async () => {
    const connection = await newSlackConnection("Not Kestrel's Slack");

    actingAs(AUTH_CONTEXT_B);

    await expect(testPlatformConnection(connection.id)).rejects.toThrow(/not found/);
  });
});

describe("platform connection synchronization", () => {
  it("refuses to sync a connection that has not passed a test", async () => {
    const connection = await newSlackConnection("Untested Slack");

    await expect(syncPlatformConnection(connection.id)).rejects.toThrow(/Test this connection successfully/);
  });

  it("stores the provider's messages against the project the connection was configured for", async () => {
    const connectionId = await connectedSlackConnection("Storing Slack");

    slackAnswers("conversations.history", () => ({
      ok: true,
      messages: [
        { ts: "1700000001.000100", user: "U01", text: "Can you also add a second dashboard theme?" },
        { ts: "1700000002.000200", user: "U01", text: "And an export to CSV while you are in there." }
      ]
    }));
    slackAnswers("users.info", () => ({
      ok: true,
      user: { real_name: "Rae Whitfield", profile: { email: "rae@harbourclient.com" } }
    }));

    const result = await syncPlatformConnection(connectionId);

    expect(result.received).toBe(2);
    expect(result.inserted).toBe(2);

    const stored = await inspect<{ message_text: string; sender: string; project_id: string }>(
      `SELECT m.message_text, m.sender, m.project_id FROM client_messages m
       JOIN communication_sources s ON s.id = m.source_id
       WHERE s.connection_id=$1 ORDER BY m.message_date`,
      [connectionId]
    );

    expect(stored.rows.map((row) => row.message_text)).toEqual([
      "Can you also add a second dashboard theme?",
      "And an export to CSV while you are in there."
    ]);
    expect(stored.rows[0].sender).toBe("Rae Whitfield");
    expect(stored.rows[0].project_id).toBe(projectA);
  });

  it("does not start analysis for the messages it imported", async () => {
    const connectionId = await connectedSlackConnection("Quiet Slack");

    slackAnswers("conversations.history", () => ({
      ok: true,
      messages: [{ ts: "1700000010.000100", user: "U01", text: "One more request for the dashboard." }]
    }));
    slackAnswers("users.info", () => ({ ok: true, user: { real_name: "Rae Whitfield" } }));

    await syncPlatformConnection(connectionId);

    const jobs = await inspect("SELECT id FROM analysis_jobs WHERE organization_id=$1", [ORGANIZATION_A]);
    const findings = await inspect("SELECT id FROM scope_findings WHERE organization_id=$1", [ORGANIZATION_A]);

    expect(jobs.rows).toEqual([]);
    expect(findings.rows).toEqual([]);
  });

  it("records a checkpoint so the next run asks the provider only for newer messages", async () => {
    const connectionId = await connectedSlackConnection("Resuming Slack");

    slackAnswers("conversations.history", () => ({
      ok: true,
      messages: [{ ts: "1700000005.000100", user: "U01", text: "First pass of the request." }]
    }));
    slackAnswers("users.info", () => ({ ok: true, user: { real_name: "Rae Whitfield" } }));
    await syncPlatformConnection(connectionId);

    const checkpoint = await inspect<{ checkpoint_value: { channels: Record<string, string> } }>(
      "SELECT checkpoint_value FROM sync_checkpoints WHERE connection_id=$1 AND checkpoint_key='provider'",
      [connectionId]
    );

    expect(checkpoint.rows[0].checkpoint_value.channels[CHANNEL]).toBe("1700000005.000100");

    slackRequests.length = 0;
    slackAnswers("conversations.history", () => ({ ok: true, messages: [] }));
    await syncPlatformConnection(connectionId);

    expect(requestedParameter("conversations.history", "oldest")).toBe("1700000005.000100");
  });

  it("skips a provider message too large to analyze and says so in the warnings", async () => {
    const connectionId = await connectedSlackConnection("Oversized Slack");

    slackAnswers("conversations.history", () => ({
      ok: true,
      messages: [
        { ts: "1700000020.000100", user: "U01", text: "x".repeat(100_001) },
        { ts: "1700000021.000200", user: "U01", text: "A request of a reasonable size." }
      ]
    }));
    slackAnswers("users.info", () => ({ ok: true, user: { real_name: "Rae Whitfield" } }));

    const result = await syncPlatformConnection(connectionId);

    expect(result.warnings).toContain("1 provider message(s) over 100,000 characters were skipped.");
    expect(result.received).toBe(1);

    const stored = await inspect<{ message_text: string }>(
      `SELECT m.message_text FROM client_messages m
       JOIN communication_sources s ON s.id = m.source_id WHERE s.connection_id=$1`,
      [connectionId]
    );

    expect(stored.rows.map((row) => row.message_text)).toEqual(["A request of a reasonable size."]);
  });

  it("records a failed ingestion job when the provider fails part way through", async () => {
    const connectionId = await connectedSlackConnection("Failing Slack");

    slackAnswers("conversations.history", () => ({ ok: false, error: "channel_not_found" }));

    await expect(syncPlatformConnection(connectionId)).rejects.toThrow(/sync failed/);

    const job = await inspect<{ status: string; error_message: string | null }>(
      "SELECT status, error_message FROM ingestion_jobs WHERE connection_id=$1",
      [connectionId]
    );
    const connection = await inspect<{ status: string }>(
      "SELECT status FROM communication_connections WHERE id=$1",
      [connectionId]
    );

    expect(job.rows[0].status).toBe("Failed");
    expect(job.rows[0].error_message).toMatch(/Review the provider permissions/);
    expect(connection.rows[0].status).toBe("Needs Attention");
  });

  it("refuses to sync a connection belonging to another organization", async () => {
    const connectionId = await connectedSlackConnection("Not Kestrel's Sync");

    actingAs(AUTH_CONTEXT_B);

    await expect(syncPlatformConnection(connectionId)).rejects.toThrow(/not found/);

    const jobs = await inspect("SELECT id FROM ingestion_jobs WHERE organization_id=$1", [ORGANIZATION_B]);

    expect(jobs.rows).toEqual([]);
  });

  it("leaves no message readable to another organization after a successful sync", async () => {
    const connectionId = await connectedSlackConnection("Isolated Slack");

    slackAnswers("conversations.history", () => ({
      ok: true,
      messages: [{ ts: "1700000030.000100", user: "U01", text: "Harbour's confidential request." }]
    }));
    slackAnswers("users.info", () => ({ ok: true, user: { real_name: "Rae Whitfield" } }));
    await syncPlatformConnection(connectionId);

    const visibleToKestrel = await withTenant(ORGANIZATION_B, () =>
      query("SELECT id FROM client_messages WHERE message_text=$1", ["Harbour's confidential request."]));

    expect(visibleToKestrel.rows).toEqual([]);
  });
});

describe("stored connector credentials", () => {
  it("never writes the bot token to the connection row or to the audit trail", async () => {
    const connection = await newSlackConnection("Secret Slack");

    const rows = await inspect<{ configuration: unknown; metadata: unknown }>(
      `SELECT c.configuration, a.metadata FROM communication_connections c
       JOIN audit_logs a ON a.resource_id = c.id::text
       WHERE c.id=$1`,
      [connection.id]
    );

    expect(JSON.stringify(rows.rows)).not.toContain("xoxb-test-token-0123456789");
  });

  it("stores the bot token as ciphertext that does not contain the token", async () => {
    const connection = await newSlackConnection("Encrypted Slack");

    const secrets = await inspect<{ name: string; ciphertext: string }>(
      "SELECT name, ciphertext FROM encrypted_secrets WHERE connection_id=$1",
      [connection.id]
    );

    expect(secrets.rows.map((row) => row.name)).toEqual(["bot-token"]);
    expect(secrets.rows[0].ciphertext).not.toContain("xoxb");
  });
});
