import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/webhooks/clerk/route";
import { query } from "@/lib/db/client";
import { withSystemAccess } from "@/lib/db/tenantContext";
import { startTestDatabase, stopTestDatabase, type TestDatabase } from "./support/testDatabase";

const SIGNING_SECRET = `whsec_${Buffer.from("a-signing-secret-of-real-length").toString("base64")}`;
const ORGANIZATION = "90000000-0000-4000-8000-000000000001";

let database: TestDatabase;

beforeAll(async () => {
  database = await startTestDatabase();

  await withSystemAccess(() =>
    query("INSERT INTO organizations (id, name, slug, clerk_organization_id) VALUES ($1,$2,$3,$4)", [
      ORGANIZATION, "Wharf Consulting", "wharf-consulting", "org_wharf"
    ])
  );
});

afterAll(async () => {
  await stopTestDatabase(database);
});

afterEach(() => vi.unstubAllEnvs());

/**
 * Signed the way Clerk signs, rather than by replacing the verifier with a
 * double: a test that stubs out signature checking proves the handler runs, not
 * that an unsigned caller is refused, which is the only thing guarding this
 * route.
 */
function signedRequest(body: string, options: { secret?: string; timestamp?: number } = {}) {
  const identifier = "msg_2abcdefghijklmnop";
  const timestamp = options.timestamp ?? Math.floor(Date.now() / 1000);
  const secret = options.secret ?? SIGNING_SECRET;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const signature = createHmac("sha256", key)
    .update(`${identifier}.${timestamp}.${body}`)
    .digest("base64");

  return new NextRequest("http://local.test/api/webhooks/clerk", {
    method: "POST",
    body,
    headers: {
      "content-type": "application/json",
      "svix-id": identifier,
      "svix-timestamp": String(timestamp),
      "svix-signature": `v1,${signature}`
    }
  });
}

const RENAME = JSON.stringify({
  type: "organization.updated",
  data: { id: "org_wharf", name: "Wharf Consulting Group" }
});

function organizationName() {
  return withSystemAccess(async () => {
    const result = await query<{ name: string }>("SELECT name FROM organizations WHERE id = $1", [ORGANIZATION]);

    return result.rows[0].name;
  });
}

describe("receiving an event from Clerk", () => {
  it("applies an event that carries a valid signature", async () => {
    vi.stubEnv("CLERK_WEBHOOK_SIGNING_SECRET", SIGNING_SECRET);
    const response = await POST(signedRequest(RENAME));

    expect(response.status).toBe(200);
    expect(await organizationName()).toBe("Wharf Consulting Group");
  });

  it("refuses a body that was altered after it was signed", async () => {
    vi.stubEnv("CLERK_WEBHOOK_SIGNING_SECRET", SIGNING_SECRET);
    const before = await organizationName();
    const request = signedRequest(RENAME);
    const tampered = new NextRequest(request.url, {
      method: "POST",
      body: JSON.stringify({ type: "organization.updated", data: { id: "org_wharf", name: "Somebody Else" } }),
      headers: request.headers
    });
    const response = await POST(tampered);

    expect(response.status).toBe(400);
    expect(await organizationName()).toBe(before);
  });

  it("refuses an event signed with the wrong secret", async () => {
    vi.stubEnv("CLERK_WEBHOOK_SIGNING_SECRET", SIGNING_SECRET);
    const wrongSecret = `whsec_${Buffer.from("a-different-secret-of-length").toString("base64")}`;
    const response = await POST(signedRequest(RENAME, { secret: wrongSecret }));

    expect(response.status).toBe(400);
  });

  it("refuses an unsigned caller", async () => {
    vi.stubEnv("CLERK_WEBHOOK_SIGNING_SECRET", SIGNING_SECRET);
    const response = await POST(
      new NextRequest("http://local.test/api/webhooks/clerk", {
        method: "POST",
        body: RENAME,
        headers: { "content-type": "application/json" }
      })
    );

    expect(response.status).toBe(400);
  });

  /**
   * A correctly signed body stays correctly signed forever, so without a
   * timestamp check a captured request could be replayed back at the route
   * indefinitely.
   */
  it("refuses an event replayed long after it was signed", async () => {
    vi.stubEnv("CLERK_WEBHOOK_SIGNING_SECRET", SIGNING_SECRET);
    const sixHoursAgo = Math.floor(Date.now() / 1000) - 6 * 60 * 60;
    const response = await POST(signedRequest(RENAME, { timestamp: sixHoursAgo }));

    expect(response.status).toBe(400);
  });

  it("refuses everything when no signing secret is configured", async () => {
    vi.stubEnv("CLERK_WEBHOOK_SIGNING_SECRET", "");
    const response = await POST(signedRequest(RENAME));

    expect(response.status).toBe(400);
  });
});
