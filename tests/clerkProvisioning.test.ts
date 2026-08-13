import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { authContextForSession, EmailAlreadyClaimedError } from "@/lib/auth/clerkProvisioning";
import type { ClerkDirectory } from "@/lib/auth/clerkDirectory";
import type { ClerkSession } from "@/lib/auth/clerkIdentity";
import { query } from "@/lib/db/client";
import { withSystemAccess } from "@/lib/db/tenantContext";
import { startTestDatabase, stopTestDatabase, type TestDatabase } from "./support/testDatabase";

let database: TestDatabase | undefined;

beforeAll(async () => {
  database = await startTestDatabase();
});

afterAll(async () => {
  await stopTestDatabase(database);
});

function directoryOf(organizations: Record<string, { name: string; slug: string | null }>, users: Record<string, { email: string | null; fullName: string | null }>): ClerkDirectory {
  return {
    organization: async (id) => organizations[id],
    user: async (id) => users[id]
  };
}

const MERIDIAN = directoryOf(
  { org_meridian: { name: "Meridian Partners", slug: "meridian-partners" } },
  { user_mara: { email: "mara@meridian.example", fullName: "Mara Okonkwo" } }
);

function sessionFor(overrides: Partial<ClerkSession> = {}): ClerkSession {
  return {
    clerkUserId: "user_mara",
    sessionId: "sess_one",
    clerkOrganizationId: "org_meridian",
    clerkOrganizationRole: "admin",
    email: "mara@meridian.example",
    expiresAt: "2027-01-15T08:00:00.000Z",
    ...overrides
  };
}

function membershipVersion(organizationId: string) {
  return withSystemAccess(async () => {
    const result = await query<{ version: string }>(
      "SELECT xmin::text AS version FROM organization_memberships WHERE organization_id = $1",
      [organizationId]
    );

    return result.rows[0].version;
  });
}

function countOf(table: string, column: string, value: string) {
  return withSystemAccess(async () => {
    const result = await query<{ total: string }>(`SELECT count(*)::text AS total FROM ${table} WHERE ${column} = $1`, [value]);

    return Number(result.rows[0].total);
  });
}

describe("resolving a Clerk session to a tenant", () => {
  it("creates the firm, the person, and their membership on first sign-in", async () => {
    const context = await authContextForSession(sessionFor(), MERIDIAN);

    expect(context?.organizationName).toBe("Meridian Partners");
    expect(context?.email).toBe("mara@meridian.example");
    expect(context?.displayName).toBe("Mara Okonkwo");
    expect(context?.role).toBe("Admin");
    expect(context?.isSystemAdmin).toBe(false);
  });

  it("scopes the context to the local organization row, never the Clerk identifier", async () => {
    const context = await authContextForSession(sessionFor(), MERIDIAN);

    expect(context?.organizationId).not.toBe("org_meridian");
    expect(context?.organizationId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("reuses the same rows when the same person signs in again", async () => {
    await authContextForSession(sessionFor({ sessionId: "sess_two" }), MERIDIAN);

    expect(await countOf("organizations", "clerk_organization_id", "org_meridian")).toBe(1);
    expect(await countOf("users", "clerk_user_id", "user_mara")).toBe(1);
  });

  it("follows a role change made in Clerk", async () => {
    const promoted = await authContextForSession(sessionFor(), MERIDIAN);
    const demoted = await authContextForSession(sessionFor({ clerkOrganizationRole: "member" }), MERIDIAN);

    expect(promoted?.role).toBe("Admin");
    expect(demoted?.role).toBe("Reviewer");

    const stored = await withSystemAccess(() =>
      query<{ role: string }>("SELECT role FROM organization_memberships WHERE organization_id = $1", [demoted!.organizationId])
    );

    expect(stored.rows).toEqual([{ role: "Reviewer" }]);
  });

  /**
   * Every page a signed-in person opens resolves their session, so a write on
   * that path is a write on every request. `xmin` is the transaction that last
   * wrote the row, which changes if and only if the row was written again.
   */
  it("does not rewrite the membership when nothing about it has changed", async () => {
    const first = await authContextForSession(sessionFor(), MERIDIAN);
    const before = await membershipVersion(first!.organizationId);

    await authContextForSession(sessionFor({ sessionId: "sess_repeat" }), MERIDIAN);

    expect(await membershipVersion(first!.organizationId)).toBe(before);
  });

  it("refuses a session with no active organization rather than guessing one", async () => {
    const context = await authContextForSession(sessionFor({ clerkOrganizationId: null }), MERIDIAN);

    expect(context).toBeNull();
  });

  it("keeps two firms apart when their names produce the same slug", async () => {
    const directory = directoryOf(
      {
        org_north: { name: "Apex Group", slug: null },
        org_south: { name: "Apex  Group", slug: null }
      },
      { user_north: { email: "a@north.example", fullName: "Ana North" }, user_south: { email: "b@south.example", fullName: "Bo South" } }
    );
    const north = await authContextForSession(
      sessionFor({ clerkUserId: "user_north", clerkOrganizationId: "org_north", email: "a@north.example" }),
      directory
    );
    const south = await authContextForSession(
      sessionFor({ clerkUserId: "user_south", clerkOrganizationId: "org_south", email: "b@south.example" }),
      directory
    );

    expect(north?.organizationId).not.toBe(south?.organizationId);
  });

  it("refuses to hand an existing account to a different Clerk identity with the same address", async () => {
    const impostor = directoryOf(
      { org_meridian: { name: "Meridian Partners", slug: "meridian-partners" } },
      { user_other: { email: "mara@meridian.example", fullName: "Not Mara" } }
    );

    await expect(
      authContextForSession(sessionFor({ clerkUserId: "user_other" }), impostor)
    ).rejects.toThrow(EmailAlreadyClaimedError);
  });

  it("gives a person a usable name when Clerk holds no name for them", async () => {
    const directory = directoryOf(
      { org_quiet: { name: "Quiet Consulting", slug: "quiet-consulting" } },
      { user_quiet: { email: "priya@quiet.example", fullName: null } }
    );
    const context = await authContextForSession(
      sessionFor({ clerkUserId: "user_quiet", clerkOrganizationId: "org_quiet", email: null }),
      directory
    );

    expect(context?.email).toBe("priya@quiet.example");
    expect(context?.displayName).toBe("priya");
  });
});
