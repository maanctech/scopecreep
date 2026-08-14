import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyClerkEvent } from "@/lib/auth/clerkSync";
import { query } from "@/lib/db/client";
import { withSystemAccess } from "@/lib/db/tenantContext";
import { startTestDatabase, stopTestDatabase, type TestDatabase } from "./support/testDatabase";

const ORGANIZATION = "80000000-0000-4000-8000-000000000001";
const MEMBER = "80000000-0000-4000-8000-000000000011";

let database: TestDatabase;

beforeAll(async () => {
  database = await startTestDatabase();

  await withSystemAccess("diagnostics", async () => {
    await query("INSERT INTO organizations (id, name, slug, clerk_organization_id) VALUES ($1,$2,$3,$4)", [
      ORGANIZATION, "Harbour Advisory", "harbour-advisory", "org_harbour"
    ]);
    await query(
      `INSERT INTO users (id, email, normalized_email, display_name, clerk_user_id)
       VALUES ($1,$2,$3,$4,$5)`,
      [MEMBER, "dev@harbour.example", "dev@harbour.example", "Dev Harbour", "user_dev"]
    );
    await query(
      "INSERT INTO organization_memberships (organization_id, user_id, role) VALUES ($1,$2,'Reviewer')",
      [ORGANIZATION, MEMBER]
    );
  });
});

afterAll(async () => {
  await stopTestDatabase(database);
});

function organizationName() {
  return withSystemAccess("diagnostics", async () => {
    const result = await query<{ name: string }>("SELECT name FROM organizations WHERE id = $1", [ORGANIZATION]);

    return result.rows[0]?.name;
  });
}

function membershipRoles() {
  return withSystemAccess("diagnostics", async () => {
    const result = await query<{ role: string }>(
      "SELECT role FROM organization_memberships WHERE organization_id = $1",
      [ORGANIZATION]
    );

    return result.rows.map((row) => row.role);
  });
}

describe("keeping the firm's records in step with Clerk", () => {
  it("renames the firm when it is renamed in Clerk", async () => {
    await applyClerkEvent({ type: "organization.updated", data: { id: "org_harbour", name: "Harbour Advisory LLP" } });

    expect(await organizationName()).toBe("Harbour Advisory LLP");
  });

  it("follows a role change made by an administrator in Clerk", async () => {
    await applyClerkEvent({
      type: "organizationMembership.updated",
      data: {
        organization: { id: "org_harbour" },
        public_user_data: { user_id: "user_dev" },
        role: "org:admin"
      }
    });

    expect(await membershipRoles()).toEqual(["Admin"]);
  });

  it("removes access when a person is removed from the firm in Clerk", async () => {
    await applyClerkEvent({
      type: "organizationMembership.deleted",
      data: {
        organization: { id: "org_harbour" },
        public_user_data: { user_id: "user_dev" }
      }
    });

    expect(await membershipRoles()).toEqual([]);
  });

  it("updates the address a person is known by", async () => {
    await applyClerkEvent({
      type: "user.updated",
      data: {
        id: "user_dev",
        first_name: "Devika",
        last_name: "Harbour",
        primary_email_address_id: "idn_1",
        email_addresses: [{ id: "idn_1", email_address: "devika@harbour.example" }]
      }
    });

    const stored = await withSystemAccess("diagnostics", () =>
      query<{ email: string; display_name: string }>("SELECT email, display_name FROM users WHERE id = $1", [MEMBER])
    );

    expect(stored.rows[0]).toEqual({ email: "devika@harbour.example", display_name: "Devika Harbour" });
  });

  it("ignores an event about a firm this installation has never seen", async () => {
    await expect(
      applyClerkEvent({ type: "organization.updated", data: { id: "org_unknown", name: "Somewhere Else" } })
    ).resolves.toBeUndefined();
  });

  it("leaves a firm's records alone when Clerk deletes the organization", async () => {
    await applyClerkEvent({ type: "organization.deleted", data: { id: "org_harbour" } });

    expect(await organizationName()).toBe("Harbour Advisory LLP");
  });

  it("ignores an event type it does not handle", async () => {
    await expect(applyClerkEvent({ type: "session.created", data: { id: "sess_x" } })).resolves.toBeUndefined();
  });
});
