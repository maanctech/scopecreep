import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { query } from "@/lib/db/client";
import { withSystemAccess } from "@/lib/db/tenantContext";
import { createSession } from "@/lib/auth/service";
import { SESSION_COOKIE_NAME } from "@/lib/auth/sessionConfig";
import { startTestDatabase, stopTestDatabase, type TestDatabase } from "./support/testDatabase";

/**
 * Authentication is swept in `routeAuthentication.test.ts`. This file asks the
 * next question: a caller who *is* signed in, but holds a role without the
 * permission, must still be refused. It therefore drives the real session path
 * with the test bypass removed, exactly as a browser would.
 */
const vitestMarker = process.env.VITEST;

const ORGANIZATION = "70000000-0000-4000-8000-000000000001";
const READ_ONLY_USER = "70000000-0000-4000-8000-000000000011";
const PROJECT = "70000000-0000-4000-8000-000000000021";

let database: TestDatabase;
let readOnlyCookie: string;

beforeAll(async () => {
  database = await startTestDatabase();

  await withSystemAccess(async () => {
    await query("INSERT INTO organizations (id, name, slug) VALUES ($1,$2,$3)", [
      ORGANIZATION, "Ledger Partners", "ledger-partners"
    ]);
    await query(
      `INSERT INTO users (id, email, normalized_email, password_hash, display_name)
       VALUES ($1,$2,$3,$4,$5)`,
      [READ_ONLY_USER, "rae@example.com", "rae@example.com", "not-a-real-hash", "Rae Nakamura"]
    );
    await query(
      "INSERT INTO organization_memberships (organization_id, user_id, role) VALUES ($1,$2,'Read Only')",
      [ORGANIZATION, READ_ONLY_USER]
    );
    await query(
      `INSERT INTO projects (id, organization_id, client_name, project_name, hourly_rate_cents)
       VALUES ($1,$2,$3,$4,$5)`,
      [PROJECT, ORGANIZATION, "Ledger Client", "Quarterly Review", 15_000]
    );
  });

  const session = await createSession({ userId: READ_ONLY_USER });

  readOnlyCookie = `${SESSION_COOKIE_NAME}=${encodeURIComponent(session.token)}`;
  delete process.env.VITEST;
});

afterAll(async () => {
  process.env.VITEST = vitestMarker;
  await stopTestDatabase(database);
});

function signedInRequest(path: string, method: string, body?: unknown) {
  return new Request(`http://local.test/api/${path}`, {
    method,
    headers: {
      host: "local.test",
      origin: "http://local.test",
      "content-type": "application/json",
      cookie: readOnlyCookie
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

const params = <T extends Record<string, string>>(values: T) => ({ params: Promise.resolve(values) });

describe("a signed-in role without the permission is refused", () => {
  /**
   * The positive control for every refusal below: the same cookie carries a
   * role that does hold `findings:read`, so it clears both gates. What the
   * store does afterwards is out of reach here, because it resolves the
   * session through `next/headers`, which needs a real request scope.
   */
  it("clears both gates for a read the role does carry", async () => {
    const { GET } = await import("@/app/api/findings/route");
    const response = await GET(signedInRequest("findings", "GET"));

    expect(response.status).not.toBe(401);
    expect(response.status).not.toBe(403);
  });

  it("refuses Read Only a project write", async () => {
    const { POST } = await import("@/app/api/projects/route");
    const response = await POST(signedInRequest("projects", "POST", {
      client_name: "Ledger Client",
      project_name: "Unauthorized Project",
      hourly_rate: 150,
      sow_text: "1. Scope\nSomething this role may not create."
    }));

    expect(response.status).toBe(403);
  });

  it("refuses Read Only a billing decision on a finding", async () => {
    const { POST } = await import("@/app/api/findings/[id]/actions/route");
    const response = await POST(
      signedInRequest("findings/00000000-0000-4000-8000-000000000001/actions", "POST", {
        expected_version: 1,
        action: "Mark as Billable"
      }),
      params({ id: "00000000-0000-4000-8000-000000000001" })
    );

    expect(response.status).toBe(403);
  });

  it("refuses Read Only the whole-organization export, which is every record the firm holds", async () => {
    const { POST } = await import("@/app/api/exports/route");
    const response = await POST(signedInRequest("exports", "POST", {}));

    expect(response.status).toBe(403);
  });

  it("refuses Read Only the download of a whole-organization export", async () => {
    const { GET } = await import("@/app/api/exports/[id]/download/route");
    const response = await GET(
      signedInRequest("exports/00000000-0000-4000-8000-000000000001/download", "GET"),
      params({ id: "00000000-0000-4000-8000-000000000001" })
    );

    expect(response.status).toBe(403);
  });

  it("refuses Read Only an integration write", async () => {
    const { POST } = await import("@/app/api/integrations/route");
    const response = await POST(signedInRequest("integrations", "POST", { provider: "Slack" }));

    expect(response.status).toBe(403);
  });

  it("refuses Read Only a lead status change", async () => {
    const { PATCH } = await import("@/app/api/leads/[id]/status/route");
    const response = await PATCH(
      signedInRequest("leads/00000000-0000-4000-8000-000000000002/status", "PATCH", { status: "Contacted" }),
      params({ id: "00000000-0000-4000-8000-000000000002" })
    );

    expect(response.status).toBe(403);
  });
});
