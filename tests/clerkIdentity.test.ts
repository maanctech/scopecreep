import { describe, expect, it } from "vitest";
import { organizationRoleFor, sessionFromClaims } from "@/lib/auth/clerkIdentity";

/**
 * Clerk issues two session token shapes. Version 2 nests organization data
 * under `o` and drops the `org:` prefix from the role; version 1 uses flat
 * `org_id` / `org_role` claims. A reader that only understands one of them
 * signs the firm out on the day Clerk rolls the other.
 */
const VERSION_TWO = {
  v: 2,
  sub: "user_abc",
  sid: "sess_abc",
  exp: 1_800_000_000,
  email: "mara@example.com",
  o: { id: "org_abc", rol: "admin", slg: "meridian" }
};

const VERSION_ONE = {
  sub: "user_abc",
  sid: "sess_abc",
  exp: 1_800_000_000,
  org_id: "org_abc",
  org_role: "org:admin",
  org_slug: "meridian"
};

describe("reading a Clerk session token", () => {
  it("reads the organization from a version 2 token", () => {
    const session = sessionFromClaims(VERSION_TWO);

    expect(session).toEqual({
      clerkUserId: "user_abc",
      sessionId: "sess_abc",
      clerkOrganizationId: "org_abc",
      clerkOrganizationRole: "admin",
      email: "mara@example.com",
      expiresAt: "2027-01-15T08:00:00.000Z"
    });
  });

  it("reads the organization from a version 1 token, prefix stripped", () => {
    const session = sessionFromClaims(VERSION_ONE);

    expect(session?.clerkOrganizationId).toBe("org_abc");
    expect(session?.clerkOrganizationRole).toBe("admin");
  });

  it("reports no organization when the user is on a personal account", () => {
    const session = sessionFromClaims({ sub: "user_abc", sid: "sess_abc", exp: 1_800_000_000 });

    expect(session?.clerkOrganizationId).toBeNull();
    expect(session?.clerkOrganizationRole).toBeNull();
  });

  it("refuses a token with no subject rather than inventing a user", () => {
    expect(sessionFromClaims({ sid: "sess_abc", exp: 1_800_000_000 })).toBeNull();
  });
});

describe("mapping a Clerk role onto an organization role", () => {
  it("gives the person who holds the account the owning role", () => {
    expect(organizationRoleFor("owner")).toBe("Owner");
    expect(organizationRoleFor("org:owner")).toBe("Owner");
  });

  it("gives an organization admin the writing role", () => {
    expect(organizationRoleFor("admin")).toBe("Admin");
    expect(organizationRoleFor("org:admin")).toBe("Admin");
  });

  it("gives a watching colleague the role that cannot change a billing decision", () => {
    expect(organizationRoleFor("read_only")).toBe("Read Only");
    expect(organizationRoleFor("org:read_only")).toBe("Read Only");
  });

  it("gives an ordinary member the role that can review and bill", () => {
    expect(organizationRoleFor("member")).toBe("Reviewer");
    expect(organizationRoleFor("org:member")).toBe("Reviewer");
  });

  it("fails closed for a role nobody has mapped yet", () => {
    expect(organizationRoleFor("org:something_new")).toBe("Read Only");
    expect(organizationRoleFor(null)).toBe("Read Only");
  });
});
