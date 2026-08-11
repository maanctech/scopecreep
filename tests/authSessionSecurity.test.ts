import { createHash } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { query } from "@/lib/db/client";
import { withSystemAccess } from "@/lib/db/tenantContext";
import { startTestDatabase, stopTestDatabase } from "./support/testDatabase";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  authenticateUser,
  changePassword,
  createSession,
  getAuthContext,
  revokeSession
} from "@/lib/auth/service";
import {
  checkRateLimit,
  clearRateLimitsForTests,
  PublicError,
  rateLimitEntryCountForTests,
  RateLimitError
} from "@/lib/auth/security";
import { isTestRuntime, validateProductionConfiguration } from "@/lib/config/runtime";
import { COMPATIBLE_STATUSES, initialFindingState } from "@/lib/domain/findingTransitions";
import { CLASSIFICATIONS } from "@/lib/types";

const ORGANIZATION = "50000000-0000-4000-8000-000000000001";
const USER = "50000000-0000-4000-8000-000000000011";
const PASSWORD = "CorrectHorse9Battery";

/**
 * Reads and rewrites persisted rows for assertion purposes. These are the
 * harness looking at the database, not a path the application takes, so they
 * run outside any tenant rather than being blocked by the tenant policies.
 */
const inspect: typeof query = (text, values) => withSystemAccess(() => query(text, values));

function hashTokenForTest(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

let database: PGlite;

beforeAll(async () => {
  database = await startTestDatabase();

  const passwordHash = await hashPassword(PASSWORD);

  await withSystemAccess(async () => {
    await query("INSERT INTO organizations (id, name, slug) VALUES ($1,$2,$3)", [
      ORGANIZATION,
      "Cadence Partners",
      "cadence-partners"
    ]);
    await query(
      `INSERT INTO users (id, email, normalized_email, password_hash, display_name)
       VALUES ($1,$2,$3,$4,$5)`,
      [USER, "dana@example.com", "dana@example.com", passwordHash, "Dana Okafor"]
    );
    await query(
      "INSERT INTO organization_memberships (organization_id, user_id, role) VALUES ($1,$2,'Owner')",
      [ORGANIZATION, USER]
    );
  });
});

afterAll(async () => {
  await stopTestDatabase(database);
});

describe("session creation and the inet columns", () => {
  it("stores a null address when no forwarded IP is available", async () => {
    const session = await createSession({ userId: USER, ipAddress: "local" });
    const stored = await inspect<{ ip_address: string | null }>(
      "SELECT ip_address FROM user_sessions WHERE id = (SELECT id FROM user_sessions ORDER BY created_at DESC LIMIT 1)"
    );

    expect(session.token).toBeTruthy();
    expect(stored.rows[0].ip_address).toBeNull();
  });

  it("stores a genuine forwarded address unchanged", async () => {
    await createSession({ userId: USER, ipAddress: "203.0.113.7" });
    const stored = await inspect<{ ip_address: string | null }>(
      "SELECT ip_address FROM user_sessions ORDER BY created_at DESC LIMIT 1"
    );

    expect(stored.rows[0].ip_address).toBe("203.0.113.7");
  });

  it("records a sign-in and a sign-out in the audit log", async () => {
    const session = await createSession({ userId: USER, ipAddress: "198.51.100.4" });
    const signedIn = await inspect<{ action: string; ip_address: string | null }>(
      "SELECT action, ip_address FROM audit_logs WHERE action = 'user.signed_in' ORDER BY created_at DESC LIMIT 1"
    );

    expect(signedIn.rows[0].action).toBe("user.signed_in");
    expect(signedIn.rows[0].ip_address).toBe("198.51.100.4");

    await revokeSession(session.token);
    const signedOut = await inspect<{ action: string }>(
      "SELECT action FROM audit_logs WHERE action = 'user.signed_out' ORDER BY created_at DESC LIMIT 1"
    );

    expect(signedOut.rows[0].action).toBe("user.signed_out");
    expect(await getAuthContext(session.token)).toBeNull();
  });

  it("records a password change and revokes the other sessions", async () => {
    const kept = await createSession({ userId: USER });
    const other = await createSession({ userId: USER });
    const context = await getAuthContext(kept.token);

    await changePassword({
      userId: USER,
      organizationId: ORGANIZATION,
      currentPassword: PASSWORD,
      newPassword: "AnotherStrong7Secret",
      keepSessionId: context!.sessionId
    });

    expect(await getAuthContext(other.token)).toBeNull();
    expect(await getAuthContext(kept.token)).not.toBeNull();

    const logged = await inspect<{ action: string }>(
      "SELECT action FROM audit_logs WHERE action = 'user.password_changed' ORDER BY created_at DESC LIMIT 1"
    );

    expect(logged.rows[0].action).toBe("user.password_changed");

    await changePassword({
      userId: USER,
      organizationId: ORGANIZATION,
      currentPassword: "AnotherStrong7Secret",
      newPassword: PASSWORD,
      keepSessionId: context!.sessionId
    });
  });

  it("rejects a wrong current password with a message that is safe to display", async () => {
    await expect(
      changePassword({
        userId: USER,
        organizationId: ORGANIZATION,
        currentPassword: "definitely-not-it",
        newPassword: "AnotherStrong7Secret",
        keepSessionId: "50000000-0000-4000-8000-0000000000ff"
      })
    ).rejects.toBeInstanceOf(PublicError);
  });
});

describe("idle session expiry", () => {
  it("advances last_seen_at on every authenticated lookup", async () => {
    const session = await createSession({ userId: USER });

    await inspect("UPDATE user_sessions SET last_seen_at = now() - interval '30 minutes' WHERE token_hash = $1", [
      hashTokenForTest(session.token)
    ]);
    expect(await getAuthContext(session.token)).not.toBeNull();

    const touched = await inspect<{ seconds: number }>(
      "SELECT EXTRACT(EPOCH FROM (now() - last_seen_at)) AS seconds FROM user_sessions WHERE token_hash = $1",
      [hashTokenForTest(session.token)]
    );

    expect(Number(touched.rows[0].seconds)).toBeLessThan(60);
  });

  it("refuses a session that has gone idle past the timeout", async () => {
    const session = await createSession({ userId: USER });

    expect(await getAuthContext(session.token)).not.toBeNull();

    await inspect("UPDATE user_sessions SET last_seen_at = now() - interval '5 hours' WHERE token_hash = $1", [
      hashTokenForTest(session.token)
    ]);

    expect(await getAuthContext(session.token)).toBeNull();
  });
});

describe("credential verification", () => {
  it("authenticates a known user and rejects a wrong password", async () => {
    expect(await authenticateUser("Dana@Example.com", PASSWORD)).toBe(USER);
    expect(await authenticateUser("dana@example.com", "wrong-password")).toBeNull();
  });

  it("does the same Argon2 work for an unknown address as for a known one", async () => {
    // The absent-user hash must be a real Argon2 digest, otherwise verification
    // short-circuits on a parse error and the timing signal returns.
    const elapsed = async (email: string) => {
      const started = process.hrtime.bigint();

      await authenticateUser(email, PASSWORD);

      return Number(process.hrtime.bigint() - started) / 1e6;
    };

    expect(await authenticateUser("nobody@example.com", PASSWORD)).toBeNull();

    const unknown = await elapsed("nobody@example.com");
    const known = await elapsed("dana@example.com");

    expect(unknown).toBeGreaterThan(known / 4);
  });

  it("treats the absent-user hash as a parseable digest that never matches", async () => {
    const absent = "$argon2id$v=19$m=19456,t=3,p=1$JLm6Q7FbCwozRZZj7xzZ3w$LU543tIVKLOHUuBlB7kwxdSs/apvsQrtTECkxAyBIgc";

    expect(await verifyPassword(absent, PASSWORD)).toBe(false);
    expect(await verifyPassword("not-a-hash-at-all", PASSWORD)).toBe(false);
  });
});

describe("rate limiting", () => {
  beforeEach(() => {
    clearRateLimitsForTests();
  });

  it("rejects once the limit for a key is reached", () => {
    for (let i = 0; i < 3; i += 1) checkRateLimit("probe", 3, 60_000);

    expect(() => checkRateLimit("probe", 3, 60_000)).toThrow(RateLimitError);
  });

  it("stays bounded no matter how many distinct keys an attacker mints", async () => {
    // Each key stands for one spoofed X-Forwarded-For value. Without eviction
    // the map would hold every one of them for the lifetime of the process.
    for (let i = 0; i < 40_000; i += 1) {
      checkRateLimit(`spoofed-ip-${i}`, 10, 1);

      if (i % 5_000 === 0) await new Promise((resolve) => setTimeout(resolve, 2));
    }

    expect(rateLimitEntryCountForTests()).toBeLessThan(20_000);
  });

  it("keeps counting a live key across a sweep", async () => {
    for (let i = 0; i < 3; i += 1) checkRateLimit("live-key", 3, 60_000);

    for (let i = 0; i < 12_000; i += 1) checkRateLimit(`transient-${i}`, 10, 1);

    expect(() => checkRateLimit("live-key", 3, 60_000)).toThrow(RateLimitError);
  });
});

describe("test-mode bypasses", () => {
  it("engages only when the Vitest marker is present alongside NODE_ENV", () => {
    expect(isTestRuntime({ NODE_ENV: "test", VITEST: "true" })).toBe(true);
    expect(isTestRuntime({ NODE_ENV: "test" })).toBe(false);
    expect(isTestRuntime({ NODE_ENV: "production", VITEST: "true" })).toBe(false);
    expect(isTestRuntime({})).toBe(false);
  });

  it("is refused by the production configuration check", () => {
    expect(validateProductionConfiguration({ NODE_ENV: "test" })).toContain(
      "NODE_ENV=test disables authentication and origin checks and cannot be used for a commercial production start."
    );
    expect(validateProductionConfiguration({ NODE_ENV: "production" })).not.toContain(
      "NODE_ENV=test disables authentication and origin checks and cannot be used for a commercial production start."
    );
  });
});

describe("initial finding state", () => {
  it("produces a decision and status the state machine allows", () => {
    for (const classification of CLASSIFICATIONS) {
      const state = initialFindingState(classification);

      expect(COMPATIBLE_STATUSES[state.billing_decision]).toContain(state.workflow_status);
    }
  });

  it("starts in-scope work as New and everything else as Needs Review", () => {
    expect(initialFindingState("In Scope")).toEqual({
      billing_decision: "Undecided",
      workflow_status: "New"
    });
    expect(initialFindingState("Out of Scope")).toEqual({
      billing_decision: "Undecided",
      workflow_status: "Needs Review"
    });
  });
});
